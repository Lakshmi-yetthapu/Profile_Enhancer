"""Job-description lifecycle: parse with the LLM, embed for semantic matching, store,
and rank resumes against a stored JD."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Analysis, JobDescription, Resume
from app.services import semantic
from app.services.llm import LLMProvider, get_provider
from app.services.prompts import JD_PARSE_SYSTEM, build_jd_parse_prompt


def jd_embed_text(structured: dict, raw_text: str) -> str:
    """Compact representative text of the JD used to produce its embedding."""
    parts = [
        structured.get("title") or "",
        " ".join(structured.get("must_have_skills") or []),
        " ".join(structured.get("nice_to_have_skills") or []),
        " ".join(structured.get("responsibilities") or []),
        " ".join(structured.get("ats_keywords") or []),
    ]
    text = "\n".join(p for p in parts if p).strip()
    return text or raw_text[:4000]


def parse_and_store(
    db: Session,
    user_id: int,
    raw_text: str,
    title: str | None,
    company: str | None,
    provider_name: str | None,
) -> JobDescription:
    provider = get_provider(provider_name)
    structured = provider.complete_json(JD_PARSE_SYSTEM, build_jd_parse_prompt(raw_text))

    embedding: list | None = None
    try:
        vecs = provider.embed([jd_embed_text(structured, raw_text)])
        embedding = vecs[0] if vecs else None
    except Exception:
        embedding = None

    jd = JobDescription(
        user_id=user_id,
        title=title or structured.get("title") or "Untitled role",
        company=company or structured.get("company"),
        raw_text=raw_text,
        structured_json=structured,
        embedding=embedding,
        provider=provider.name,
    )
    db.add(jd)
    db.commit()
    db.refresh(jd)
    return jd


def ensure_resume_embedding(
    db: Session, resume: Resume, provider: LLMProvider
) -> list[float] | None:
    if resume.embedding:
        return resume.embedding
    try:
        vecs = provider.embed([resume.extracted_text[:8000]])
    except Exception:
        return None
    if vecs:
        resume.embedding = vecs[0]
        db.commit()
        return vecs[0]
    return None


def jd_skill_list(structured: dict) -> list[str]:
    return list(structured.get("must_have_skills") or []) + list(
        structured.get("nice_to_have_skills") or []
    )


def rank_resumes_for_jd(db: Session, jd: JobDescription, requester) -> list[dict]:
    """Rank the analyses run against this JD by LLM fit score (primary), with the
    embedding-based semantic similarity surfaced alongside."""
    stmt = (
        select(Analysis)
        .where(Analysis.job_description_id == jd.id)
        .order_by(Analysis.jd_fit_score.desc().nullslast(), Analysis.created_at.desc())
    )
    analyses = list(db.scalars(stmt))

    rows: list[dict] = []
    seen_resumes: set[int] = set()
    for a in analyses:
        if a.resume_id in seen_resumes:  # keep only the latest analysis per resume
            continue
        seen_resumes.add(a.resume_id)
        resume = db.get(Resume, a.resume_id)
        if not resume:
            continue
        if requester.role != "admin" and resume.user_id != requester.id:
            continue
        sem = None
        if jd.embedding and resume.embedding:
            sem = round(semantic.cosine(jd.embedding, resume.embedding) * 100, 1)
        rows.append(
            {
                "analysis_id": a.id,
                "resume_id": resume.id,
                "resume_name": resume.original_filename or f"Resume #{resume.id}",
                "jd_fit_score": a.jd_fit_score,
                "semantic_similarity": sem,
                "verdict": (a.result_json.get("jd_match") or {}).get("verdict"),
                "created_at": a.created_at,
            }
        )
    return rows
