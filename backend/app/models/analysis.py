from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), index=True)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)  # no_jd | jd
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # mistral | openai
    model: Mapped[str] = mapped_column(String(60), nullable=False)
    jd_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_description_id: Mapped[int | None] = mapped_column(
        ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)  # rubric score
    jd_fit_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # JD match score
    verdict: Mapped[str] = mapped_column(String(20), default="review")  # select | reject | review
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    share_code: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    result_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    # recruiter workflow
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|shortlisted|rejected|review
    recruiter_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    resume: Mapped["Resume"] = relationship(back_populates="analyses")  # noqa: F821
    job_description: Mapped["JobDescription | None"] = relationship(  # noqa: F821
        back_populates="analyses"
    )
    criterion_results: Mapped[list["CriterionResult"]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )


class CriterionResult(Base):
    __tablename__ = "criterion_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    criterion_key: Mapped[str] = mapped_column(String(60), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    severity: Mapped[str] = mapped_column(String(20), default="info")  # info | low | medium | high
    comment: Mapped[str] = mapped_column(Text, default="")
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)

    analysis: Mapped["Analysis"] = relationship(back_populates="criterion_results")
