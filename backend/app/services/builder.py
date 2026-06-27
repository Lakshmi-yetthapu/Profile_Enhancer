"""Resume builder: turn structured user input (+ optional JD) into ATS-friendly,
JD-tailored content via the LLM. Never fabricates — only rephrases/strengthens what
the user provided."""

from __future__ import annotations

import json

from app.services.llm import get_provider

BUILDER_SYSTEM = (
    "You are an expert resume writer and ATS optimization specialist. You rewrite a "
    "candidate's provided details into concise, ATS-friendly, achievement-oriented content. "
    "Hard rules: (1) NEVER invent facts, employers, metrics, or skills that are not in the "
    "input — only rephrase and strengthen what is given. (2) Use strong action verbs and, when "
    "the user supplied numbers, quantify; do not fabricate numbers. (3) Naturally incorporate "
    "keywords from the job description ONLY where they truthfully apply to the candidate. "
    "(4) Return ONLY a single valid JSON object."
)

_OUTPUT_CONTRACT = """
Return a JSON object with EXACTLY this shape:

{
  "summary": "<2-3 line professional summary tailored to the JD, using only real facts>",
  "skills": { "<category>": ["skill", ...] },
  "projects": [
    {
      "title": "<title>",
      "tech_stack": ["..."],
      "bullets": ["<ATS bullet, action verb first>", ...],
      "live_url": "<or null>",
      "repo_url": "<or null>"
    }
  ],
  "experience": [
    {
      "title": "<role>",
      "company": "<company>",
      "start_date": "<or null>",
      "end_date": "<or null>",
      "bullets": ["<ATS bullet, action verb first>", ...]
    }
  ],
  "certifications": ["..."],
  "achievements": ["..."],
  "ats": {
    "score": <integer 0-100, ATS-friendliness + JD keyword match>,
    "matched_keywords": ["<JD keyword genuinely present>", ...],
    "missing_keywords": ["<important JD keyword the candidate could add IF true>", ...],
    "tips": ["<short, concrete improvement tip>", ...]
  }
}

Guidance:
- 2-4 bullets per project, 3-5 per experience. Each bullet: action verb first, one line, concrete.
- Keep skills grouped by the given categories; you may reorder to surface JD-relevant skills first,
  but do not add skills the candidate didn't list.
- Preserve live_url / repo_url verbatim from the input (or null).
- If no JD is provided, optimize generically for ATS and clarity.
- missing_keywords are SUGGESTIONS for the candidate — never insert them into bullets as if true.
"""


def build_prompt(input_data: dict, jd_text: str | None) -> str:
    jd_block = (
        f'JOB DESCRIPTION (tailor toward this role):\n"""\n{jd_text}\n"""\n\n'
        if jd_text
        else "No job description provided — optimize generically for ATS.\n\n"
    )
    return (
        jd_block
        + _OUTPUT_CONTRACT
        + "\n\nCANDIDATE INPUT (the only facts you may use):\n"
        + json.dumps(input_data, indent=2)
    )


def enhance(input_data: dict, jd_text: str | None, provider_name: str | None) -> tuple[dict, str]:
    provider = get_provider(provider_name)
    result = provider.complete_json(BUILDER_SYSTEM, build_prompt(input_data, jd_text))
    # Always carry the personal block through unchanged for the template.
    result["personal"] = input_data.get("personal", {})
    return result, provider.name
