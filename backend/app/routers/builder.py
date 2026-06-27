from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import ResumeBuild, User
from app.schemas import BuilderRequest, BuildListItem, BuildOut
from app.services import builder

router = APIRouter(prefix="/api/builder", tags=["builder"])


@router.post("", response_model=BuildOut, status_code=201)
def create_build(
    payload: BuilderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ResumeBuild:
    inp = payload.input
    if not inp.projects and not inp.experience:
        raise HTTPException(
            status_code=400, detail="Add at least one project or work experience."
        )

    input_data = inp.model_dump()
    result, provider = builder.enhance(input_data, payload.jd_text, payload.provider)

    build = ResumeBuild(
        user_id=user.id,
        title=payload.title or f"{inp.personal.name}'s resume",
        jd_text=payload.jd_text,
        input_json=input_data,
        result_json=result,
        provider=provider,
    )
    db.add(build)
    db.commit()
    db.refresh(build)
    return build


@router.get("", response_model=list[BuildListItem])
def list_builds(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[ResumeBuild]:
    return list(
        db.scalars(
            select(ResumeBuild)
            .where(ResumeBuild.user_id == user.id)
            .order_by(ResumeBuild.created_at.desc())
        )
    )


def _owned(db: Session, build_id: int, user: User) -> ResumeBuild:
    build = db.get(ResumeBuild, build_id)
    if not build or (build.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Resume build not found")
    return build


@router.get("/{build_id}", response_model=BuildOut)
def get_build(
    build_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> ResumeBuild:
    return _owned(db, build_id, user)


@router.delete("/{build_id}", status_code=204)
def delete_build(
    build_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> None:
    build = _owned(db, build_id, user)
    db.delete(build)
    db.commit()
