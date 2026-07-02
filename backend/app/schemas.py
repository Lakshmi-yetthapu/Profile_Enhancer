from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

# ---------- Auth ----------


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------- Criteria (admin) ----------


class CriterionBase(BaseModel):
    key: str
    category: Literal["do", "dont"] = "do"
    title: str
    description: str
    weight: float = 1.0
    is_critical: bool = False
    is_active: bool = True


class CriterionCreate(CriterionBase):
    pass


class CriterionUpdate(BaseModel):
    category: Literal["do", "dont"] | None = None
    title: str | None = None
    description: str | None = None
    weight: float | None = None
    is_critical: bool | None = None
    is_active: bool | None = None


class CriterionOut(CriterionBase):
    id: int
    model_config = {"from_attributes": True}


class BannedProjectOut(BaseModel):
    id: int
    name: str
    is_active: bool
    model_config = {"from_attributes": True}


class BannedProjectCreate(BaseModel):
    name: str


# ---------- Resume / Analysis ----------


class ResumeSubmit(BaseModel):
    """Used for drive/link sources. PDF uploads use multipart form."""

    source_type: Literal["drive", "link"]
    source_ref: str


class AnalyzeRequest(BaseModel):
    resume_id: int
    mode: Literal["no_jd", "jd"] = "no_jd"
    jd_text: str | None = None
    job_description_id: int | None = None
    provider: Literal["mistral", "openai"] | None = None
    bias_safe: bool = False


# ---------- Job descriptions ----------


class JDCreate(BaseModel):
    raw_text: str = Field(min_length=20)
    title: str | None = None
    company: str | None = None
    provider: Literal["mistral", "openai"] | None = None


class JDOut(BaseModel):
    id: int
    title: str
    company: str | None
    raw_text: str
    structured_json: dict[str, Any]
    provider: str
    created_at: datetime
    model_config = {"from_attributes": True}


class JDListItem(BaseModel):
    id: int
    title: str
    company: str | None
    provider: str
    created_at: datetime
    model_config = {"from_attributes": True}


class RankedResume(BaseModel):
    analysis_id: int
    resume_id: int
    resume_name: str
    jd_fit_score: float | None
    semantic_similarity: float | None
    verdict: str | None
    created_at: datetime


class CriterionResultOut(BaseModel):
    criterion_key: str
    title: str
    passed: bool
    score: float
    severity: str
    comment: str
    evidence: str | None = None
    model_config = {"from_attributes": True}


class ResumeOut(BaseModel):
    id: int
    source_type: str
    source_ref: str
    original_filename: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class AnalysisOut(BaseModel):
    id: int
    resume_id: int
    mode: str
    provider: str
    model: str
    job_description_id: int | None = None
    overall_score: float
    jd_fit_score: float | None = None
    verdict: str
    confidence: float | None = None
    share_code: str | None = None
    status: str = "pending"
    recruiter_notes: str | None = None
    reviewed_at: datetime | None = None
    result_json: dict[str, Any]
    criterion_results: list[CriterionResultOut]
    created_at: datetime
    # computed at read time
    percentile: float | None = None
    previous_score: float | None = None
    score_delta: float | None = None
    candidate_email: str | None = None
    candidate_name: str | None = None
    candidate_ref: str | None = None
    model_config = {"from_attributes": True}


class ScreeningItem(BaseModel):
    id: int
    resume_id: int
    resume_name: str
    candidate: str | None = None
    mode: str
    overall_score: float
    jd_fit_score: float | None = None
    verdict: str
    confidence: float | None = None
    status: str
    created_at: datetime


class ReviewUpdate(BaseModel):
    status: Literal["pending", "shortlisted", "rejected", "review"] | None = None
    recruiter_notes: str | None = None


# ---------- Bulk analysis ----------


class BulkItemIn(BaseModel):
    external_id: str
    resume_link: str


class BulkRequest(BaseModel):
    jd_text: str | None = None
    provider: Literal["mistral", "openai"] | None = None
    items: list[BulkItemIn]


class BulkResultItem(BaseModel):
    external_id: str
    resume_link: str
    analysis_id: int | None = None
    overall_score: float | None = None
    jd_fit_score: float | None = None
    verdict: str | None = None
    report_path: str | None = None
    error: str | None = None


class BulkResponse(BaseModel):
    batch_id: int | None = None
    results: list[BulkResultItem]


class BulkEmailRequest(BaseModel):
    analysis_ids: list[int]


class BulkEmailResultItem(BaseModel):
    analysis_id: int
    recipient: str | None = None
    sent: bool = False
    error: str | None = None


class BulkEmailResponse(BaseModel):
    results: list[BulkEmailResultItem]
    sent_count: int
    failed_count: int


class BatchListItem(BaseModel):
    id: int
    title: str
    item_count: int
    created_at: datetime
    model_config = {"from_attributes": True}


class BatchOut(BaseModel):
    id: int
    title: str
    jd_text: str | None
    provider: str
    item_count: int
    results_json: list[Any]
    created_at: datetime
    model_config = {"from_attributes": True}


class EmailShareRequest(BaseModel):
    recipient: EmailStr | None = None  # defaults to the candidate's account email


class EmailShareResponse(BaseModel):
    sent: bool
    recipient: EmailStr
    share_code: str


class SettingsUpdate(BaseModel):
    settings: dict[str, str]


# ---------- Resume builder ----------


class PersonalInfo(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    github: str | None = None
    coding_profile: str | None = None
    portfolio: str | None = None


class SkillGroup(BaseModel):
    category: str
    skills: list[str] = []


class ProjectInput(BaseModel):
    title: str
    tech_stack: list[str] = []
    description: str = ""
    live_url: str | None = None
    repo_url: str | None = None


class ExperienceInput(BaseModel):
    title: str
    company: str
    start_date: str | None = None
    end_date: str | None = None
    responsibilities: str = ""


class BuilderInput(BaseModel):
    personal: PersonalInfo
    skills: list[SkillGroup] = []
    projects: list[ProjectInput] = []
    experience: list[ExperienceInput] = []
    certifications: list[str] = []
    achievements: list[str] = []


class BuilderRequest(BaseModel):
    title: str | None = None
    jd_text: str | None = None
    provider: Literal["mistral", "openai"] | None = None
    input: BuilderInput


class BuildListItem(BaseModel):
    id: int
    title: str
    created_at: datetime
    model_config = {"from_attributes": True}


class BuildOut(BaseModel):
    id: int
    title: str
    jd_text: str | None
    input_json: dict[str, Any]
    result_json: dict[str, Any]
    provider: str
    created_at: datetime
    model_config = {"from_attributes": True}
