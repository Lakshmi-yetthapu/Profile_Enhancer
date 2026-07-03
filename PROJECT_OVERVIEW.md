# ResumeEnhancer — Project Overview

**AI resume evaluation, screening & building — in one platform.**

ResumeEnhancer lets students test and improve their resumes against NxtWave's evaluation
rubric, lets admins screen candidates individually or in bulk with deep authenticity checks,
and generates ATS-friendly resumes tailored to any job description — powered by Mistral and
OpenAI with automatic API-key rotation.

> Internal document — prepared for team review.

---

## 1. Overview — three products, one platform

| Pillar | Audience | What it does |
|---|---|---|
| **Analyze & improve** | Student | Upload a resume (file, Drive link, or URL), score it against the rubric or a job description, and get a clear feedback report with prioritized fixes. |
| **Screen at scale** | Admin | Evaluate one resume or a whole cohort pasted from a sheet, with authenticity checks, plagiarism detection, a recruiter queue, CSV export, and email delivery. |
| **Build ATS resumes** | Student / Builder | Enter details plus a target JD; the AI writes ATS-optimized, achievement-focused content and renders a clean, downloadable resume — never fabricating facts. |

---

## 2. Feature catalog

### Resume intake & analysis
- **Any resume source** — PDF/DOCX upload, Google Drive share links, or external URLs, all converted to clean text. Real hyperlink URLs are extracted from the file (not just visible text), so GitHub/live/LeetCode links are detected reliably.
- **Two analysis modes** — rubric check (no JD) or JD-matched (role-fit) scoring, in one flow.
- **Feedback report** — score gauge, verdict, per-rule breakdown with evidence, strengths, prioritized improvements, and print-to-PDF export.

### Authenticity & anti-gaming
- **Live-link verification** — every GitHub and deployed link is fetched to confirm it resolves (not just that a link is present).
- **GitHub repo authenticity** — checks each project repo for existence, fork status, stars, and recency. Forks are flagged and don't count as self-made.
- **Cross-resume plagiarism** — embedding-based duplicate detection across the cohort.
- **Hidden-text / keyword-stuffing detection** — flags white/tiny text used to game ATS; plus photo and page-count/format flags.

### Skill & coding signals
- **LeetCode check** — live stats (problems solved + consistency). Below 100 solved or inconsistent practice raises a specific coaching point.
- **GitHub activity** — original vs forked repos, stars, languages, followers; too few original projects prompts a "build more projects" suggestion.
- **Claimed vs evidenced skills** — flags skills listed but never backed by a project/experience; checks skills are grouped into sections.

### Content quality
- **Quantified impact** — how many bullets carry real metrics.
- **Writing quality** — weak phrases, grammar, action verbs.
- **ATS-readiness & AI check** — contact-info completeness, formatting/ATS concerns, page count, and an AI-generated / templated likelihood signal.
- **Confidence score** — how sure the model is, so borderline cases can go to human review.

### JD matching
- **Semantic skill matrix** — embedding-based matching classifies each JD skill as have / partial / missing (catches synonyms like "ReactJS" ≈ "React.js").
- **Fit dimensions** — overall fit score plus per-dimension breakdown (must-have skills, experience, keywords, education, responsibilities).
- **Tailoring & ranking** — suggested bullet rewrites, ATS keywords to add, and ranking of multiple resumes against one saved JD.

### Admin screening & workflow
- **Bulk cohort analysis** — paste two columns from a sheet (Student ID + resume link) → an individual report per student + a downloadable results CSV (UserID, resume link, score, selected/rejected, report link). Last 5 batches are saved.
- **Recruiter queue** — shortlist / reject / review buckets, notes, cohort percentile, re-score delta, configurable pass thresholds, CSV export.
- **Email delivery** — email each candidate their own report (recipient auto-detected from the resume, greeted by the name on the resume) with a unique reference ID — individually or the whole batch at once.

### AI engine, fairness & builder
- **Mistral · OpenAI + key rotation** — choose the engine per run. Multiple Mistral keys with round-robin / failover / single modes and automatic retry on rate limits (429) or bad keys.
- **Bias-safe mode** — optionally redact name, contact details, and gendered terms before scoring; link/GitHub checks still run on the original text.
- **Resume Builder** — JD-tailored content, three templates + accent colors, a role headline, ATS score & keyword report, copy-as-text, and PDF export.

---

## 3. Evaluation rubric

Admin-editable rules stored in the database. **Critical** rules force a reject; others contribute
a weighted score. Findings are phrased dynamically to reflect what's actually present
(e.g. "No coding profile link found" when it's missing).

| Rule | What it checks | Type |
|---|---|---|
| No NxtWave internal projects | Projects must be self-made; ~45 NxtWave portal projects matched against a block-list. | **Critical** |
| GitHub + deployed link per project | Every project needs both a real repository link and a live/deployed link (grounded on actual URLs). | Weighted |
| No NxtWave training as experience | Experience section must not list NxtWave training as professional experience. | **Critical** |
| Coding profile present | A competitive-programming profile (LeetCode / CodeChef / HackerRank…) must be included; GitHub does not count. | Weighted |
| Skills grouped into sections | Skills organized into Frontend / Backend / Databases / AI — not a flat list. | Weighted |

Certifications are handled as coaching (internal NxtWave certs allowed; an external cert encouraged),
and a minimum of two projects is nudged when fewer are found.

**Outcomes:** `Selected` · `Needs review` · `Rejected`.

---

## 4. How it works — analysis pipeline

A hybrid pipeline: deterministic checks ground the facts, the LLM judges quality, embeddings handle semantics.

1. **Ingest** — fetch & parse the resume; extract text + real hyperlinks; flag hidden text.
2. **Analyze** — LLM scores every rubric rule and writes findings, strengths & fixes.
3. **Verify** — deterministic checks: banned projects, live links, GitHub repos, plagiarism.
4. **Enrich** — LeetCode & GitHub stats; semantic JD skill matrix; confidence.
5. **Decide** — weighted score + thresholds → Selected / Review / Rejected, saved as JSON.

> Reports are stored as **structured JSON in PostgreSQL** (not as files) and rendered live — the
> same analysis powers the web report, the PDF export, the email, and the screening CSV.

---

## 5. Technology & data model

**Stack**

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, TailwindCSS, Framer Motion |
| Backend | Python, FastAPI, SQLAlchemy 2.0, Pydantic |
| Database | PostgreSQL (JSONB for reports & embeddings) |
| AI | Mistral large + OpenAI — chat & embeddings |
| Parsing | pdfplumber, python-docx, BeautifulSoup, httpx |
| Integrations | LeetCode API, GitHub API, SMTP email |
| Auth | JWT (access + refresh), bcrypt |

**Core tables:** `users`, `criteria`, `banned_projects`, `resumes`, `analyses`,
`criterion_results`, `job_descriptions`, `resume_builds`, `bulk_batches`, `settings`.

Analyses store the full report in a `result_json` JSONB column plus a queryable per-rule breakdown.
Resumes cache extracted text, embeddings (for ranking & plagiarism), and ingestion metadata.

---

## 6. Roles & access

**Student**
- Register / sign in
- Upload or link a resume
- Run rubric or JD-based analysis
- View reports & download PDF
- Build an ATS resume
- See their own analysis history

**Admin** (everything a student can do, plus)
- Bulk analysis from a sheet + CSV export
- Screening queue: shortlist / reject / notes
- Email reports to candidates (single or batch)
- Edit rubric rules, banned projects & thresholds
- Configure Mistral key rotation

---

## 7. Security & privacy

- API keys and SMTP credentials live only in `backend/.env` (git-ignored); the frontend only learns
  *which* providers are available, never the keys.
- Passwords hashed with bcrypt; JWT access + refresh tokens; student vs admin authorization.
- Bias-safe mode redacts personal identifiers before AI scoring.

---

## 8. Local setup

**Backend**
```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# configure .env (DB, API keys, SMTP)
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```
cd frontend
npm install
npm run dev
# open http://localhost:5173
```

Tables and the default rubric, banned-projects list, and admin user are created automatically on
first startup. API docs at `/docs`.

---

## 9. Roadmap

- **Background bulk jobs** — run large cohorts asynchronously with a live progress bar.
- **Public report links** — shareable read-only report pages using the reference code.
- **Prefill builder from a resume** — parse an uploaded resume to populate the builder form.
- **Alembic migrations** — versioned migrations for production deploys.
- **Edit & regenerate** — tweak a bullet in a built resume and re-run just that section.
- **Analytics dashboard** — cohort-level score distributions, common gaps, pass rates over time.
