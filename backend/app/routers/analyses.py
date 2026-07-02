import csv
import io
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import Analysis, BulkBatch, JobDescription, Resume, User
from app.schemas import (
    AnalysisOut,
    AnalyzeRequest,
    BatchListItem,
    BatchOut,
    BulkEmailRequest,
    BulkEmailResponse,
    BulkEmailResultItem,
    BulkRequest,
    BulkResponse,
    BulkResultItem,
    EmailShareRequest,
    EmailShareResponse,
    ReviewUpdate,
    ScreeningItem,
)
from app.services import ingestion
from app.services import jd as jd_service
from app.services.analysis import run_analysis
from app.services.email import detect_candidate_email, detect_candidate_name, send_report_email
from app.services.llm import get_provider

router = APIRouter(prefix="/api/analyses", tags=["analyses"])

_BULK_MAX = 100


def _owned_resume(db: Session, resume_id: int, user: User) -> Resume:
    resume = db.get(Resume, resume_id)
    if not resume or (resume.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


def _attach_computed(db: Session, analysis: Analysis) -> Analysis:
    """Add cohort percentile and improvement delta (non-persisted, read-time only)."""
    total = db.scalar(select(func.count(Analysis.id)).where(Analysis.mode == analysis.mode)) or 0
    if total:
        lower = db.scalar(
            select(func.count(Analysis.id)).where(
                Analysis.mode == analysis.mode,
                Analysis.overall_score <= analysis.overall_score,
            )
        )
        analysis.percentile = round(100 * (lower or 0) / total, 1)

    resume = db.get(Resume, analysis.resume_id)
    if resume:
        owner = db.get(User, resume.user_id)
        analysis.candidate_email = detect_candidate_email(resume, owner.email if owner else None)
        analysis.candidate_name = detect_candidate_name(resume)
        analysis.candidate_ref = resume.candidate_ref
        prev = db.scalars(
            select(Analysis)
            .join(Resume, Resume.id == Analysis.resume_id)
            .where(Resume.user_id == resume.user_id, Analysis.created_at < analysis.created_at)
            .order_by(Analysis.created_at.desc())
            .limit(1)
        ).first()
        if prev:
            analysis.previous_score = prev.overall_score
            analysis.score_delta = round(analysis.overall_score - prev.overall_score, 1)
    return analysis


@router.post("", response_model=AnalysisOut, status_code=201)
def analyze(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Analysis:
    resume = _owned_resume(db, payload.resume_id, user)
    analysis = run_analysis(
        db,
        resume=resume,
        mode=payload.mode,
        jd_text=payload.jd_text,
        provider_name=payload.provider,
        job_description_id=payload.job_description_id,
        bias_safe=payload.bias_safe,
    )
    return _attach_computed(db, analysis)


@router.post("/bulk", response_model=BulkResponse)
def bulk_analyze(
    payload: BulkRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> BulkResponse:
    """Analyze many resumes at once (Student ID + resume link per row). Each row produces
    its own persisted report; failures are isolated so one bad row doesn't stop the batch."""
    items = payload.items[:_BULK_MAX]

    # If a JD is supplied, parse/embed it once and reuse for the whole batch.
    jd: JobDescription | None = None
    if payload.jd_text:
        jd = jd_service.parse_and_store(db, admin.id, payload.jd_text, None, None, payload.provider)

    results: list[BulkResultItem] = []
    for item in items:
        ext = (item.external_id or "").strip()
        link = (item.resume_link or "").strip()
        if not link:
            results.append(BulkResultItem(external_id=ext, resume_link=link, error="Missing resume link"))
            continue
        try:
            if "drive.google.com" in link.lower():
                text, meta = ingestion.text_from_drive(link)
                stype = "drive"
            else:
                text, meta = ingestion.text_from_link(link)
                stype = "link"
            if not text.strip():
                raise ValueError("No readable text extracted from the link")

            resume = Resume(
                user_id=admin.id,
                source_type=stype,
                source_ref=link,
                extracted_text=text,
                ingest_meta=meta,
                candidate_ref=ext,
            )
            db.add(resume)
            db.commit()
            db.refresh(resume)

            # Best-effort embed so cross-resume plagiarism works within the batch.
            try:
                jd_service.ensure_resume_embedding(db, resume, get_provider(None))
            except Exception:
                pass

            analysis = run_analysis(
                db,
                resume=resume,
                mode="jd" if jd else "no_jd",
                jd_text=None,
                provider_name=payload.provider,
                job_description_id=jd.id if jd else None,
            )
            results.append(
                BulkResultItem(
                    external_id=ext,
                    resume_link=link,
                    analysis_id=analysis.id,
                    overall_score=analysis.overall_score,
                    jd_fit_score=analysis.jd_fit_score,
                    verdict=analysis.verdict,
                    report_path=f"/report/{analysis.id}",
                )
            )
        except HTTPException as exc:
            db.rollback()
            results.append(BulkResultItem(external_id=ext, resume_link=link, error=str(exc.detail)[:200]))
        except Exception as exc:  # noqa: BLE001 - isolate per-row failures
            db.rollback()
            results.append(BulkResultItem(external_id=ext, resume_link=link, error=str(exc)[:200]))

    # Persist the batch and keep only the last 5 per admin.
    batch = BulkBatch(
        user_id=admin.id,
        title=f"Batch of {len(results)}",
        jd_text=payload.jd_text,
        provider=payload.provider or "mistral",
        item_count=len(results),
        results_json=[r.model_dump() for r in results],
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    old = list(
        db.scalars(
            select(BulkBatch)
            .where(BulkBatch.user_id == admin.id)
            .order_by(BulkBatch.created_at.desc())
            .offset(5)
        )
    )
    for b in old:
        db.delete(b)
    if old:
        db.commit()

    return BulkResponse(batch_id=batch.id, results=results)


@router.get("/batches", response_model=list[BatchListItem])
def list_batches(
    db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> list[BulkBatch]:
    return list(
        db.scalars(
            select(BulkBatch)
            .where(BulkBatch.user_id == admin.id)
            .order_by(BulkBatch.created_at.desc())
            .limit(5)
        )
    )


@router.get("/batches/{batch_id}", response_model=BatchOut)
def get_batch(
    batch_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> BulkBatch:
    batch = db.get(BulkBatch, batch_id)
    if not batch or batch.user_id != admin.id:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.get("/screening", response_model=list[ScreeningItem])
def screening_queue(
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[ScreeningItem]:
    stmt = select(Analysis).order_by(Analysis.created_at.desc())
    if status:
        stmt = stmt.where(Analysis.status == status)
    items: list[ScreeningItem] = []
    for a in db.scalars(stmt):
        resume = db.get(Resume, a.resume_id)
        candidate = None
        if resume and resume.user:
            candidate = resume.user.full_name or resume.user.email
        items.append(
            ScreeningItem(
                id=a.id,
                resume_id=a.resume_id,
                resume_name=(resume.original_filename if resume else None) or f"Resume #{a.resume_id}",
                candidate=candidate,
                mode=a.mode,
                overall_score=a.overall_score,
                jd_fit_score=a.jd_fit_score,
                verdict=a.verdict,
                confidence=a.confidence,
                status=a.status,
                created_at=a.created_at,
            )
        )
    return items


@router.get("/export.csv")
def export_csv(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["analysis_id", "candidate", "resume", "mode", "overall_score", "jd_fit_score",
         "verdict", "confidence", "status", "created_at"]
    )
    for a in db.scalars(select(Analysis).order_by(Analysis.created_at.desc())):
        resume = db.get(Resume, a.resume_id)
        candidate = (resume.user.full_name or resume.user.email) if resume and resume.user else ""
        writer.writerow(
            [a.id, candidate, resume.original_filename if resume else "", a.mode,
             a.overall_score, a.jd_fit_score if a.jd_fit_score is not None else "",
             a.verdict, a.confidence if a.confidence is not None else "", a.status,
             a.created_at.isoformat()]
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=screening.csv"},
    )


@router.get("/{analysis_id}", response_model=AnalysisOut)
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Analysis:
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    _owned_resume(db, analysis.resume_id, user)
    return _attach_computed(db, analysis)


@router.patch("/{analysis_id}/review", response_model=AnalysisOut)
def review(
    analysis_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> Analysis:
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if payload.status is not None:
        analysis.status = payload.status
    if payload.recruiter_notes is not None:
        analysis.recruiter_notes = payload.recruiter_notes
    analysis.reviewed_by = admin.id
    analysis.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(analysis)
    return _attach_computed(db, analysis)


@router.post("/{analysis_id}/email", response_model=EmailShareResponse)
def email_report(
    analysis_id: int,
    payload: EmailShareRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> EmailShareResponse:
    analysis = db.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    resume = db.get(Resume, analysis.resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    candidate = db.get(User, resume.user_id)
    # Prefer the email the admin confirmed; else the candidate's email from the resume itself.
    recipient = (
        str(payload.recipient)
        if payload.recipient
        else detect_candidate_email(resume, candidate.email if candidate else None)
    )
    if not recipient:
        raise HTTPException(status_code=400, detail="No recipient email available")

    if not analysis.share_code:
        analysis.share_code = "RE-" + secrets.token_hex(4).upper()
        db.commit()
        db.refresh(analysis)

    send_report_email(analysis, resume, candidate, recipient)
    return EmailShareResponse(sent=True, recipient=recipient, share_code=analysis.share_code)


@router.post("/bulk-email", response_model=BulkEmailResponse)
def bulk_email(
    payload: BulkEmailRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> BulkEmailResponse:
    """Email each report to its own candidate (email auto-detected from that resume)."""
    results: list[BulkEmailResultItem] = []
    sent = failed = 0
    for aid in dict.fromkeys(payload.analysis_ids):  # de-dupe, keep order
        try:
            analysis = db.get(Analysis, aid)
            if not analysis:
                raise ValueError("Analysis not found")
            resume = db.get(Resume, analysis.resume_id)
            if not resume:
                raise ValueError("Resume not found")
            # Only the candidate's own email from the resume — never fall back to the admin.
            recipient = detect_candidate_email(resume, None)
            if not recipient:
                raise ValueError("No candidate email found on the resume")
            if not analysis.share_code:
                analysis.share_code = "RE-" + secrets.token_hex(4).upper()
                db.commit()
            send_report_email(analysis, resume, db.get(User, resume.user_id), recipient)
            results.append(BulkEmailResultItem(analysis_id=aid, recipient=recipient, sent=True))
            sent += 1
        except HTTPException as exc:
            results.append(BulkEmailResultItem(analysis_id=aid, sent=False, error=str(exc.detail)[:200]))
            failed += 1
        except Exception as exc:  # noqa: BLE001
            results.append(BulkEmailResultItem(analysis_id=aid, sent=False, error=str(exc)[:200]))
            failed += 1
    return BulkEmailResponse(results=results, sent_count=sent, failed_count=failed)


@router.get("", response_model=list[AnalysisOut])
def my_analyses(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[Analysis]:
    stmt = (
        select(Analysis)
        .join(Resume, Resume.id == Analysis.resume_id)
        .order_by(Analysis.created_at.desc())
    )
    if user.role != "admin":
        stmt = stmt.where(Resume.user_id == user.id)
    analyses = list(db.scalars(stmt))
    # attach a candidate label (name from resume / bulk student id) for the history list
    for a in analyses:
        resume = db.get(Resume, a.resume_id)
        if resume:
            a.candidate_name = detect_candidate_name(resume)
            a.candidate_ref = resume.candidate_ref
    return analyses
