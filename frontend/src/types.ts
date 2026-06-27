export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: "student" | "admin";
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Resume {
  id: number;
  source_type: string;
  source_ref: string;
  original_filename: string | null;
  created_at: string;
}

export interface CriterionResult {
  criterion_key: string;
  title: string;
  passed: boolean;
  score: number;
  severity: "info" | "low" | "medium" | "high" | string;
  comment: string;
  evidence: string | null;
}

export interface LeetCodeData {
  username?: string;
  fetch_failed?: boolean;
  total_solved: number;
  easy: number;
  medium: number;
  hard: number;
  current_streak: number;
  active_days: number;
  guidance: string;
  meets_problem_bar?: boolean;
  consistent?: boolean;
  min_problems?: number;
  improvement_points?: string[];
  profile_url?: string;
}

export interface JdDimension {
  name: string;
  score: number;
  comment: string;
}

export interface BulletRewrite {
  original: string;
  improved: string;
  reason: string;
}

export interface TailoringAction {
  priority: "high" | "medium" | "low" | string;
  text: string;
}

export interface SkillMatch {
  jd_skill: string;
  status: "have" | "partial" | "missing";
  best_match: string | null;
  similarity: number;
}

export interface JdMatch {
  score: number;
  verdict?: "strong" | "moderate" | "weak" | string;
  matched_skills: string[];
  missing_skills: string[];
  matched_keywords: string[];
  missing_keywords: string[];
  alignment_summary: string;
  dimensions?: JdDimension[];
  ats_keywords_to_add?: string[];
  experience_gap?: string;
  bullet_rewrites?: BulletRewrite[];
  tailoring_actions?: TailoringAction[];
  semantic_skill_matrix?: SkillMatch[];
  semantic_coverage?: number;
  semantic_similarity?: number;
}

export interface JobDescriptionStructured {
  title?: string;
  company?: string | null;
  seniority?: string;
  required_years?: number | null;
  must_have_skills?: string[];
  nice_to_have_skills?: string[];
  education?: string | null;
  certifications?: string[];
  responsibilities?: string[];
  ats_keywords?: string[];
  domain?: string | null;
}

export interface JobDescription {
  id: number;
  title: string;
  company: string | null;
  raw_text: string;
  structured_json: JobDescriptionStructured;
  provider: string;
  created_at: string;
}

export interface JDListItem {
  id: number;
  title: string;
  company: string | null;
  provider: string;
  created_at: string;
}

export interface RankedResume {
  analysis_id: number;
  resume_id: number;
  resume_name: string;
  jd_fit_score: number | null;
  semantic_similarity: number | null;
  verdict: string | null;
  created_at: string;
}

export interface ProjectInfo {
  name: string;
  is_self_made: boolean;
  has_github_link: boolean;
  has_deployed_link: boolean;
  github_url: string | null;
  deployed_url: string | null;
  github_live?: boolean | null;
  deployed_live?: boolean | null;
  repo_exists?: boolean;
  repo_is_fork?: boolean;
}

export interface GithubProfile {
  username: string;
  public_repos: number;
  followers: number;
  original_repos: number;
  forked_repos: number;
  total_stars: number;
  top_languages: string[];
  last_active: string | null;
}

export interface ResultJson {
  projects?: ProjectInfo[];
  coding_profiles?: { platform: string; url: string }[];
  skills_grouped?: boolean;
  skill_sections?: Record<string, string[]>;
  ungrouped_skills?: string[];
  certifications?: { name: string; issuer: string | null; is_nxtwave_course: boolean }[];
  experience_includes_nxtwave_training?: boolean;
  strengths?: string[];
  improvements?: { priority: "high" | "medium" | "low" | string; text: string }[];
  summary?: string;
  detected_banned_projects?: string[];
  project_count?: number;
  leetcode?: LeetCodeData;
  jd_match?: JdMatch;
  // screening additions
  quantified_impact?: {
    score: number;
    bullets_with_metrics: number;
    total_bullets: number;
    comment: string;
  };
  writing_quality?: {
    score: number;
    weak_phrases?: string[];
    passive_voice_examples?: string[];
    spelling_grammar_issues?: string[];
    comment: string;
  };
  claimed_vs_evidenced_skills?: { unsubstantiated?: string[]; comment: string };
  contact_info?: {
    email: boolean;
    phone: boolean;
    linkedin: boolean;
    location: boolean;
    missing?: string[];
  };
  ai_generated?: { likelihood: "low" | "medium" | "high" | string; signals?: string[] };
  format?: { ats_friendly: boolean; issues?: string[] };
  confidence?: number;
  link_checks?: Record<string, { url: string; live: boolean; status: number | null; error: string | null }>;
  project_authenticity?: {
    url: string;
    exists: boolean;
    is_fork?: boolean;
    stars?: number;
    language?: string | null;
    last_push?: string | null;
    owner_login?: string | null;
    project?: string;
  }[];
  github?: GithubProfile;
  duplicate?: { resume_id: number; name: string; similarity: number };
  ingest?: { pages: number | null; images: number; hidden_text: string[] };
  bias_safe?: { enabled: boolean; redacted: string[] };
}

export interface Analysis {
  id: number;
  resume_id: number;
  mode: "no_jd" | "jd";
  provider: string;
  model: string;
  job_description_id: number | null;
  overall_score: number;
  jd_fit_score: number | null;
  verdict: "select" | "reject" | "review" | string;
  confidence?: number | null;
  share_code?: string | null;
  status?: string;
  recruiter_notes?: string | null;
  reviewed_at?: string | null;
  result_json: ResultJson;
  criterion_results: CriterionResult[];
  created_at: string;
  percentile?: number | null;
  previous_score?: number | null;
  score_delta?: number | null;
  candidate_email?: string | null;
}

export interface ScreeningItem {
  id: number;
  resume_id: number;
  resume_name: string;
  candidate: string | null;
  mode: string;
  overall_score: number;
  jd_fit_score: number | null;
  verdict: string;
  confidence: number | null;
  status: string;
  created_at: string;
}

export interface Criterion {
  id: number;
  key: string;
  category: "do" | "dont";
  title: string;
  description: string;
  weight: number;
  is_critical: boolean;
  is_active: boolean;
}

export interface BannedProject {
  id: number;
  name: string;
  is_active: boolean;
}

export interface AppConfig {
  providers: { mistral: boolean; openai: boolean };
  default_provider: string;
  max_upload_mb: number;
  email_enabled?: boolean;
}

// ---------- Resume builder ----------

export interface PersonalInfo {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  coding_profile?: string;
  portfolio?: string;
}

export interface SkillGroupInput {
  category: string;
  skills: string[];
}

export interface ProjectInputForm {
  title: string;
  tech_stack: string[];
  description: string;
  live_url?: string;
  repo_url?: string;
}

export interface ExperienceInputForm {
  title: string;
  company: string;
  start_date?: string;
  end_date?: string;
  responsibilities: string;
}

export interface BuilderInput {
  personal: PersonalInfo;
  skills: SkillGroupInput[];
  projects: ProjectInputForm[];
  experience: ExperienceInputForm[];
  certifications: string[];
  achievements: string[];
}

export interface BuildResult {
  personal?: PersonalInfo;
  summary?: string;
  skills?: Record<string, string[]>;
  projects?: {
    title: string;
    tech_stack: string[];
    bullets: string[];
    live_url: string | null;
    repo_url: string | null;
  }[];
  experience?: {
    title: string;
    company: string;
    start_date: string | null;
    end_date: string | null;
    bullets: string[];
  }[];
  certifications?: string[];
  achievements?: string[];
  ats?: {
    score: number;
    matched_keywords: string[];
    missing_keywords: string[];
    tips: string[];
  };
}

export interface Build {
  id: number;
  title: string;
  jd_text: string | null;
  input_json: BuilderInput;
  result_json: BuildResult;
  provider: string;
  created_at: string;
}

export interface BuildListItem {
  id: number;
  title: string;
  created_at: string;
}
