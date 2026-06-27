from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import JobDescription, User
from app.schemas import JDCreate, JDListItem, JDOut, RankedResume
from app.services import jd as jd_service

router = APIRouter(prefix="/api/jds", tags=["job-descriptions"])


def _owned_jd(db: Session, jd_id: int, user: User) -> JobDescription:
    jd = db.get(JobDescription, jd_id)
    if not jd or (jd.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Job description not found")
    return jd


@router.post("", response_model=JDOut, status_code=201)
def create_jd(
    payload: JDCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JobDescription:
    return jd_service.parse_and_store(
        db,
        user_id=user.id,
        raw_text=payload.raw_text,
        title=payload.title,
        company=payload.company,
        provider_name=payload.provider,
    )


@router.get("", response_model=list[JDListItem])
def list_jds(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[JobDescription]:
    stmt = select(JobDescription).order_by(JobDescription.created_at.desc())
    if user.role != "admin":
        stmt = stmt.where(JobDescription.user_id == user.id)
    return list(db.scalars(stmt))


@router.get("/{jd_id}", response_model=JDOut)
def get_jd(
    jd_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> JobDescription:
    return _owned_jd(db, jd_id, user)


@router.get("/{jd_id}/ranking", response_model=list[RankedResume])
def rank(
    jd_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[dict]:
    jd = _owned_jd(db, jd_id, user)
    return jd_service.rank_resumes_for_jd(db, jd, user)


@router.delete("/{jd_id}", status_code=204)
def delete_jd(
    jd_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    jd = _owned_jd(db, jd_id, user)
    db.delete(jd)
    db.commit()
