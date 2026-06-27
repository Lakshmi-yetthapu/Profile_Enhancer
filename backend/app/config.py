from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/resume_enhancer"

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # LLM
    default_llm_provider: str = "mistral"
    mistral_api_key: str = ""
    mistral_model: str = "mistral-large-latest"
    mistral_embed_model: str = "mistral-embed"
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_embed_model: str = "text-embedding-3-small"

    # App
    cors_origins: str = "http://localhost:5173"
    max_upload_mb: int = 10
    upload_dir: str = "./storage/uploads"

    # Screening integrations
    github_token: str = ""  # optional; raises GitHub API rate limit from 60 to 5000/hr
    enable_link_checks: bool = True
    plagiarism_threshold: float = 0.95

    # Email (SMTP) for sharing reports with candidates
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""  # falls back to smtp_user
    smtp_use_tls: bool = True  # STARTTLS (port 587). Port 465 uses implicit SSL.
    app_public_url: str = "http://localhost:5173"

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def smtp_sender(self) -> str:
        return self.smtp_from or self.smtp_user  # cosine above which two resumes are near-duplicates

    admin_email: str = "admin@nxtwave.local"
    admin_password: str = "ChangeMe123!"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
