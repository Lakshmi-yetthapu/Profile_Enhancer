from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import BannedProject, Criterion, User
from app.schemas import (
    BannedProjectCreate,
    BannedProjectOut,
    CriterionCreate,
    CriterionOut,
    CriterionUpdate,
    SettingsUpdate,
)
from app.services import appsettings

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------- Settings (scoring thresholds, etc.) ----------


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    return appsettings.all_settings(db)


@router.put("/settings")
def update_settings(
    payload: SettingsUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)
) -> dict:
    for key, value in payload.settings.items():
        if key in appsettings.DEFAULTS:
            appsettings.set_value(db, key, value)
    return appsettings.all_settings(db)


# ---------- Criteria ----------


@router.get("/criteria", response_model=list[CriterionOut])
def list_criteria(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return list(db.scalars(select(Criterion).order_by(Criterion.id)))


@router.post("/criteria", response_model=CriterionOut, status_code=201)
def create_criterion(
    payload: CriterionCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    if db.scalar(select(Criterion).where(Criterion.key == payload.key)):
        raise HTTPException(status_code=400, detail="Criterion key already exists")
    crit = Criterion(**payload.model_dump())
    db.add(crit)
    db.commit()
    db.refresh(crit)
    return crit


@router.patch("/criteria/{criterion_id}", response_model=CriterionOut)
def update_criterion(
    criterion_id: int,
    payload: CriterionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    crit = db.get(Criterion, criterion_id)
    if not crit:
        raise HTTPException(status_code=404, detail="Criterion not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(crit, field, value)
    db.commit()
    db.refresh(crit)
    return crit


@router.delete("/criteria/{criterion_id}", status_code=204)
def delete_criterion(
    criterion_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    crit = db.get(Criterion, criterion_id)
    if crit:
        db.delete(crit)
        db.commit()


# ---------- Banned projects ----------


@router.get("/banned-projects", response_model=list[BannedProjectOut])
def list_banned(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return list(db.scalars(select(BannedProject).order_by(BannedProject.name)))


@router.post("/banned-projects", response_model=BannedProjectOut, status_code=201)
def add_banned(
    payload: BannedProjectCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    if db.scalar(select(BannedProject).where(BannedProject.name == payload.name)):
        raise HTTPException(status_code=400, detail="Project already in list")
    bp = BannedProject(name=payload.name)
    db.add(bp)
    db.commit()
    db.refresh(bp)
    return bp


@router.delete("/banned-projects/{project_id}", status_code=204)
def delete_banned(
    project_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    bp = db.get(BannedProject, project_id)
    if bp:
        db.delete(bp)
        db.commit()
