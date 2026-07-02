from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import admin, analyses, auth, builder, jds, resumes

# Lightweight "migrations" for columns added after the initial create_all run.
# Idempotent; safe on every startup. (Use Alembic for anything more involved.)
_SCHEMA_PATCHES = [
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS embedding JSONB",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS ingest_meta JSONB",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS candidate_ref VARCHAR(120)",
    "ALTER TABLE analyses ADD COLUMN IF NOT EXISTS job_description_id INTEGER",
    "ALTER TABLE analyses ADD COLUMN IF NOT EXISTS jd_fit_score DOUBLE PRECISION",
    "ALTER TABLE analyses ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION",
    "ALTER TABLE analyses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'",
    "ALTER TABLE analyses ADD COLUMN IF NOT EXISTS recruiter_notes TEXT",
    "ALTER TABLE analyses ADD COLUMN IF NOT EXISTS reviewed_by INTEGER",
    "ALTER TABLE analyses ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
    "ALTER TABLE analyses ADD COLUMN IF NOT EXISTS share_code VARCHAR(20)",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (simple quick-start; swap for Alembic in production).
    import app.models  # noqa: F401  (ensure models are registered)

    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        for stmt in _SCHEMA_PATCHES:
            conn.execute(text(stmt))

    from app.seed import run_all

    db = SessionLocal()
    try:
        run_all(db)
    finally:
        db.close()
    yield


app = FastAPI(title="ResumeEnhancer API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(resumes.router)
app.include_router(analyses.router)
app.include_router(jds.router)
app.include_router(builder.router)
app.include_router(admin.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/config")
def public_config() -> dict:
    """Lets the frontend know which providers are usable (key configured)."""
    return {
        "providers": {
            "mistral": bool(settings.mistral_key_list),
            "openai": bool(settings.openai_api_key),
        },
        "default_provider": settings.default_llm_provider,
        "max_upload_mb": settings.max_upload_mb,
        "email_enabled": settings.smtp_configured,
        "mistral_keys": len(settings.mistral_key_list),
    }
