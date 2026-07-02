"""Prompt construction for resume analysis. The rubric (criteria) is injected
dynamically so admins can edit rules without code changes."""

from __future__ import annotations

import json

from app.models import Criterion

SYSTEM_PROMPT = (
    "You are an expert technical recruiter and resume evaluator for NxtWave. "
    "You analyze a candidate's resume strictly against a provided rubric and return a "
    "single, valid JSON object. Be precise, evidence-based, and never invent content that "
    "is not present in the resume. Quote short snippets from the resume as evidence. "
    "Always return ONLY the JSON object, no prose."
)

# The output contract is described to the model so the JSON is stable and parseable.
_OUTPUT_CONTRACT = """
Return a JSON object with EXACTLY this shape:

{
  "criteria": [
    {
      "key": "<criterion key from the rubric>",
      "passed": true|false,
      "score": <integer 0-100>,
      "severity": "info|low|medium|high",
      "statement": "<one-line finding that reflects reality: affirmative if passed, negative if not>",
      "comment": "<concise explanation of the verdict>",
      "evidence": "<short quote from the resume, or null>"
    }
  ],
  "projects": [
    {
      "name": "<project title>",
      "is_self_made": true|false,
      "has_github_link": true|false,
      "has_deployed_link": true|false,
      "github_url": "<url or null>",
      "deployed_url": "<url or null>"
    }
  ],
  "coding_profiles": [ { "platform": "<LeetCode|CodeChef|HackerRank|Codeforces|GeeksforGeeks>", "url": "<url>" } ],
  "skills_grouped": true|false,
  "skill_sections": { "<section name>": ["skill", ...] },
  "ungrouped_skills": ["skill", ...],
  "certifications": [ { "name": "<cert>", "issuer": "<issuer or null>", "is_nxtwave_course": true|false } ],
  "experience_includes_nxtwave_training": true|false,
  "quantified_impact": {
    "score": <0-100>,
    "bullets_with_metrics": <int>,
    "total_bullets": <int>,
    "comment": "<are achievements quantified with numbers/metrics?>"
  },
  "writing_quality": {
    "score": <0-100>,
    "weak_phrases": ["<e.g. 'responsible for'>", ...],
    "passive_voice_examples": ["..."],
    "spelling_grammar_issues": ["<issue>", ...],
    "comment": "<overall writing quality>"
  },
  "claimed_vs_evidenced_skills": {
    "unsubstantiated": ["<skill listed but never used in any project/experience>", ...],
    "comment": "<how well skills are backed by evidence>"
  },
  "contact_info": {
    "email": true|false, "phone": true|false, "linkedin": true|false, "location": true|false,
    "missing": ["<missing contact field>", ...]
  },
  "ai_generated": {
    "likelihood": "low|medium|high",
    "signals": ["<reason this may be AI-generated or templated>", ...]
  },
  "format": { "ats_friendly": true|false, "issues": ["<ATS/formatting concern>", ...] },
  "confidence": <0-100, how confident you are in this assessment>,
  "strengths": ["<strength>", ...],
  "improvements": [ { "priority": "high|medium|low", "text": "<actionable advice>" } ],
  "summary": "<2-3 sentence overall summary>"
}

Rules for filling this in:
- Produce one "criteria" entry for EVERY rubric rule, using its exact "key".
- "passed" = whether the resume satisfies that rule. "score" reflects how well.
- "statement" is a short heading describing the ACTUAL finding, not the rule name. Phrase it
  positively when passed and negatively when failed. Examples:
  passed -> "Coding profile link is included"; failed -> "No coding profile link found".
  passed -> "Skills are grouped into sections"; failed -> "Skills are not grouped into sections".
- PROJECT LINKS — be strict and literal, never assume:
  - IMPORTANT: a GitHub PROFILE link (github.com/<username>, with NO repository after it) is the
    candidate's overall account — put it in "coding_profiles" as platform "GitHub". It is NOT a
    project link. Do NOT use the profile link as any project's github_url.
  - A project "github_url" MUST be a repository URL of the form github.com/<username>/<repo>.
    If a project has no repository URL of its own, set github_url to null (never fall back to the
    profile link or another project's repo).
  - Set "deployed_url" ONLY to a real non-GitHub http(s) URL (the live/hosted site) that appears
    in the text. Else null.
  - "has_github_link" = github_url is a real repository URL; "has_deployed_link" = deployed_url is set.
  - Use the URLs in "HYPERLINKS DETECTED IN RESUME"; NEVER infer a link from words alone
    ("Link", "GitHub", "Demo"); never share one link across multiple projects.
- Group skills into sections like Frontend, Backend, Databases, AI/ML, Tools, etc.
  If skills appear as one flat list, set "skills_grouped" to false and list them in "ungrouped_skills".
- Mark any NxtWave course-completion certificate with "is_nxtwave_course": true.
- CODING PROFILES are competitive-programming / DSA judges ONLY: LeetCode, CodeChef,
  HackerRank, Codeforces, GeeksforGeeks, etc. GitHub / GitLab are code hosting, NOT coding
  profiles — never list GitHub under coding_profiles.
- quantified_impact: count resume bullet points and how many contain a concrete metric/number.
- claimed_vs_evidenced_skills.unsubstantiated: skills in the Skills section that never appear
  in any project or work-experience description.
- ai_generated: judge from generic phrasing, lack of specifics, and templated structure.
- If the text appears to have personal identifiers redacted ([REDACTED ...]), do not penalize
  for missing contact info; set those contact_info fields based on what remains.
"""


def _format_rubric(criteria: list[Criterion]) -> str:
    rows = []
    for c in criteria:
        rows.append(
            {
                "key": c.key,
                "category": c.category,
                "title": c.title,
                "rule": c.description,
                "critical": c.is_critical,
            }
        )
    return json.dumps(rows, indent=2)


def build_no_jd_prompt(resume_text: str, criteria: list[Criterion], banned_projects: list[str]) -> str:
    return f"""Evaluate the following resume against the NxtWave rubric.

RUBRIC (each rule has a key you MUST reuse in your output):
{_format_rubric(criteria)}

KNOWN NXTWAVE INTERNAL PROJECTS (these are NOT self-made; if any appear as the candidate's
own project, the relevant rule fails):
{json.dumps(banned_projects)}

{_OUTPUT_CONTRACT}

RESUME TEXT:
\"\"\"
{resume_text}
\"\"\"
"""


# ---------------------------------------------------------------------------
# JD parsing
# ---------------------------------------------------------------------------

JD_PARSE_SYSTEM = (
    "You are an expert technical recruiter. Extract a clean, structured summary of a job "
    "description as a single valid JSON object. Return ONLY the JSON, no prose."
)

_JD_PARSE_CONTRACT = """
Return a JSON object with EXACTLY this shape:

{
  "title": "<role title>",
  "company": "<company name or null>",
  "seniority": "<intern|junior|mid|senior|lead|unknown>",
  "required_years": <number or null>,
  "must_have_skills": ["<hard skill>", ...],
  "nice_to_have_skills": ["<skill>", ...],
  "education": "<degree requirement or null>",
  "certifications": ["<cert>", ...],
  "responsibilities": ["<key responsibility>", ...],
  "ats_keywords": ["<exact term an ATS would scan for>", ...],
  "domain": "<industry/domain or null>"
}

Guidelines:
- Separate genuinely required skills (must_have) from preferred ones (nice_to_have).
- ats_keywords are concrete terms (tools, frameworks, methodologies) likely used for
  automated keyword screening. Keep them short.
"""


def build_jd_parse_prompt(jd_text: str) -> str:
    return f"""Parse the following job description.

{_JD_PARSE_CONTRACT}

JOB DESCRIPTION:
\"\"\"
{jd_text}
\"\"\"
"""


# ---------------------------------------------------------------------------
# JD matching (enhanced, pure-LLM scoring)
# ---------------------------------------------------------------------------

_JD_MATCH_CONTRACT = """

ADDITIONALLY, score how well this resume fits the job. Extend the JSON object with a
"jd_match" field shaped EXACTLY like this:

  "jd_match": {
    "score": <integer 0-100, overall fit>,
    "verdict": "strong|moderate|weak",
    "alignment_summary": "<2-3 sentences on overall fit>",
    "dimensions": [
      { "name": "Must-have skills", "score": <0-100>, "comment": "<why>" },
      { "name": "Nice-to-have skills", "score": <0-100>, "comment": "<why>" },
      { "name": "Experience relevance", "score": <0-100>, "comment": "<why>" },
      { "name": "ATS keyword coverage", "score": <0-100>, "comment": "<why>" },
      { "name": "Education & certifications", "score": <0-100>, "comment": "<why>" },
      { "name": "Responsibility alignment", "score": <0-100>, "comment": "<why>" }
    ],
    "matched_skills": ["..."],
    "missing_skills": ["..."],
    "matched_keywords": ["..."],
    "missing_keywords": ["..."],
    "ats_keywords_to_add": ["<keyword the resume should include>", ...],
    "experience_gap": "<gap vs required experience, or empty string>",
    "bullet_rewrites": [
      { "original": "<a real bullet from the resume>",
        "improved": "<rewrite aligned to the JD, keep it truthful>",
        "reason": "<why this is better for this role>" }
    ],
    "tailoring_actions": [
      { "priority": "high|medium|low", "text": "<concrete action to better fit this JD>" }
    ]
  }

Scoring guidance:
- Judge the overall "score" holistically but consistently; weight must-have skills and
  experience relevance most heavily.
- Provide 2-4 bullet_rewrites using ACTUAL bullets found in the resume (do not fabricate
  achievements; only rephrase/quantify what is plausibly there).
"""


def build_jd_prompt(
    resume_text: str,
    structured_jd: dict,
    criteria: list[Criterion],
    banned_projects: list[str],
) -> str:
    base = build_no_jd_prompt(resume_text, criteria, banned_projects)
    return base + _JD_MATCH_CONTRACT + f"""

STRUCTURED JOB DESCRIPTION (use this as the source of truth for requirements):
{json.dumps(structured_jd, indent=2)}
"""
