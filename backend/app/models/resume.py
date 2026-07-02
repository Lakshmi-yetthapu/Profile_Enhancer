from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)  # pdf | drive | link
    source_ref: Mapped[str] = mapped_column(Text, nullable=False)  # file path or URL
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # external student/candidate identifier (used by bulk analysis from a sheet)
    candidate_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # cached embedding of the resume text, used for semantic ranking against JDs
    embedding: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # ingestion-time signals: page count, image count, hidden/white text snippets
    ingest_meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="resumes")  # noqa: F821
    analyses: Mapped[list["Analysis"]] = relationship(  # noqa: F821
        back_populates="resume", cascade="all, delete-orphan"
    )
