import os
import re
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

_NUMBERED_KEY_LINE = re.compile(r"^\s*MISTRAL_API_KEY_\d+\s*=\s*(.+?)\s*$")
_NUMBERED_KEY_NAME = re.compile(r"^MISTRAL_API_KEY_\d+$")


def _numbered_keys_from_env_file(path: str = ".env") -> list[str]:
    """Read MISTRAL_API_KEY_1..N from the .env file (pydantic ignores undeclared vars)."""
    out: list[str] = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if line.lstrip().startswith("#"):
                    continue
                m = _NUMBERED_KEY_LINE.match(line)
                if m:
                    val = m.group(1).strip().strip('"').strip("'").strip()
                    if val:
                        out.append(val)
    except OSError:
        pass
    return out


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
    mistral_api_keys: str = ""  # optional comma-separated list for key rotation
    mistral_model: str = "mistral-large-latest"
    mistral_embed_model: str = "mistral-embed"
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_embed_model: str = "text-embedding-3-small"

    @property
    def mistral_key_list(self) -> list[str]:
        """All configured Mistral keys, de-duplicated. Supports three formats:
        MISTRAL_API_KEY (single), MISTRAL_API_KEYS (comma list), and MISTRAL_API_KEY_1..N."""
        raw = [self.mistral_api_key, *self.mistral_api_keys.split(",")]
        # numbered keys set as real environment variables
        raw += [v for name, v in os.environ.items() if _NUMBERED_KEY_NAME.match(name)]
        # numbered keys from the .env file
        raw += _numbered_keys_from_env_file()
        seen: list[str] = []
        for k in (x.strip() for x in raw):
            if k and k not in seen:
                seen.append(k)
        return seen

    # App
    cors_origins: str = "http://localhost:5173"
    max_upload_mb: int = 10
    upload_dir: str = "./storage/uploads"

    # Screening integrations
    github_token: str = ""  # optional; raises GitHub API rate limit from 60 to 5000/hr
    enable_link_checks: bool = True
    plagiarism_threshold: float = 0.95

    # Email for sharing reports with candidates.
    # Preferred on hosts that block SMTP (e.g. Render): Resend HTTP API over HTTPS.
    resend_api_key: str = ""
    resend_from: str = "onboarding@resend.dev"  # verified domain sender, or Resend's test sender
    # SMTP fallback (works locally; blocked on many cloud hosts)
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
        return self.smtp_from or self.smtp_user

    @property
    def email_configured(self) -> bool:
        """Email works if either Resend (HTTP) or SMTP is configured."""
        return bool(self.resend_api_key) or self.smtp_configured  # cosine above which two resumes are near-duplicates

    admin_email: str = "admin@nxtwave.local"
    admin_password: str = "ChangeMe123!"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
