"""Embedding-based semantic helpers: cosine similarity, a skill match matrix, and
overall resume<->JD similarity. Pure-Python math, no numpy/pgvector dependency."""

from __future__ import annotations

import math

from app.services.llm import LLMProvider

# Cosine thresholds for classifying a JD skill against the resume's skills.
HAVE_THRESHOLD = 0.74
PARTIAL_THRESHOLD = 0.58


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _norm(s: str) -> str:
    return "".join(ch for ch in s.lower() if ch.isalnum())


def build_skill_matrix(
    provider: LLMProvider, jd_skills: list[str], resume_skills: list[str]
) -> list[dict]:
    """For each JD skill, find the closest resume skill and label have/partial/missing.

    Literal/substring matches short-circuit to "have". Everything else is decided by
    embedding cosine similarity, so synonyms (ReactJS ~ React.js) are caught.
    """
    jd_skills = [s for s in dict.fromkeys(s.strip() for s in jd_skills) if s]
    resume_skills = [s for s in dict.fromkeys(s.strip() for s in resume_skills) if s]
    if not jd_skills:
        return []

    resume_norms = {s: _norm(s) for s in resume_skills}

    # Resolve literal matches first; only embed the JD skills that still need it.
    matrix: list[dict] = []
    unresolved: list[str] = []
    for jd_skill in jd_skills:
        jn = _norm(jd_skill)
        literal = next(
            (rs for rs, rn in resume_norms.items() if rn and (rn == jn or rn in jn or jn in rn)),
            None,
        )
        if literal:
            matrix.append(
                {"jd_skill": jd_skill, "status": "have", "best_match": literal, "similarity": 1.0}
            )
        else:
            unresolved.append(jd_skill)

    if unresolved and resume_skills:
        try:
            vectors = provider.embed(unresolved + resume_skills)
        except Exception:
            vectors = []
        if vectors:
            jd_vecs = vectors[: len(unresolved)]
            res_vecs = vectors[len(unresolved) :]
            for jd_skill, jv in zip(unresolved, jd_vecs):
                best_sim, best_match = 0.0, None
                for rs, rv in zip(resume_skills, res_vecs):
                    sim = cosine(jv, rv)
                    if sim > best_sim:
                        best_sim, best_match = sim, rs
                status = (
                    "have"
                    if best_sim >= HAVE_THRESHOLD
                    else "partial"
                    if best_sim >= PARTIAL_THRESHOLD
                    else "missing"
                )
                matrix.append(
                    {
                        "jd_skill": jd_skill,
                        "status": status,
                        "best_match": best_match if status != "missing" else None,
                        "similarity": round(best_sim, 3),
                    }
                )
        else:
            for jd_skill in unresolved:
                matrix.append(
                    {"jd_skill": jd_skill, "status": "missing", "best_match": None, "similarity": 0.0}
                )
    else:
        for jd_skill in unresolved:
            matrix.append(
                {"jd_skill": jd_skill, "status": "missing", "best_match": None, "similarity": 0.0}
            )

    # preserve original JD skill order
    order = {s: i for i, s in enumerate(jd_skills)}
    matrix.sort(key=lambda m: order.get(m["jd_skill"], 0))
    return matrix


def coverage_percent(matrix: list[dict]) -> float:
    if not matrix:
        return 0.0
    score = sum(1.0 if m["status"] == "have" else 0.5 if m["status"] == "partial" else 0.0 for m in matrix)
    return round(100 * score / len(matrix), 1)
