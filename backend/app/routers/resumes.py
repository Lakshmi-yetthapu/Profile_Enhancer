import os
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Resume, User
from app.schemas import ResumeOut, ResumeSubmit
from app.services import ingestion
from app.services.jd import ensure_resume_embedding
from app.services.llm import get_provider

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


def _try_embed(db: Session, resume: Resume) -> None:
    """Best-effort embed at ingestion so semantic ranking & plagiarism work later.
    Never blocks upload if no provider key is configured."""
    try:
        ensure_resume_embedding(db, resume, get_provider(None))
    except Exception:
        pass


@router.post("/upload", response_model=ResumeOut, status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Resume:
    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_mb} MB")

    text, meta = ingestion.text_from_upload(file.filename or "resume.pdf", data)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the file")

    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = f"{user.id}_{int(time.time())}_{os.path.basename(file.filename or 'resume.pdf')}"
    path = os.path.join(settings.upload_dir, safe_name)
    with open(path, "wb") as f:
        f.write(data)

    resume = Resume(
        user_id=user.id,
        source_type="pdf",
        source_ref=path,
        original_filename=file.filename,
        extracted_text=text,
        ingest_meta=meta,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    _try_embed(db, resume)
    return resume


@router.post("/link", response_model=ResumeOut, status_code=201)
def submit_link(
    payload: ResumeSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Resume:
    if payload.source_type == "drive":
        text, meta = ingestion.text_from_drive(payload.source_ref)
    else:
        text, meta = ingestion.text_from_link(payload.source_ref)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the link")

    resume = Resume(
        user_id=user.id,
        source_type=payload.source_type,
        source_ref=payload.source_ref,
        extracted_text=text,
        ingest_meta=meta,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    _try_embed(db, resume)
    return resume


@router.get("", response_model=list[ResumeOut])
def my_resumes(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[Resume]:
    return list(
        db.scalars(
            select(Resume).where(Resume.user_id == user.id).order_by(Resume.created_at.desc())
        )
    )
