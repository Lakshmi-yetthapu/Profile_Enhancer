"""Helpers around the admin-editable Setting key/value table (scoring thresholds, etc.)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Setting

DEFAULTS: dict[str, str] = {
    "select_threshold": "75",
    "review_threshold": "55",
    "autoreject_hidden_text": "false",
}


def all_settings(db: Session) -> dict[str, str]:
    rows = {s.key: s.value for s in db.scalars(select(Setting))}
    return {**DEFAULTS, **rows}


def get_value(db: Session, key: str) -> str:
    row = db.scalar(select(Setting).where(Setting.key == key))
    return row.value if row else DEFAULTS.get(key, "")


def set_value(db: Session, key: str, value: str) -> None:
    row = db.scalar(select(Setting).where(Setting.key == key))
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()


def get_thresholds(db: Session) -> tuple[float, float]:
    try:
        select_t = float(get_value(db, "select_threshold"))
    except ValueError:
        select_t = 75.0
    try:
        review_t = float(get_value(db, "review_threshold"))
    except ValueError:
        review_t = 55.0
    return select_t, review_t


def get_bool(db: Session, key: str) -> bool:
    return get_value(db, key).strip().lower() in {"1", "true", "yes", "on"}
