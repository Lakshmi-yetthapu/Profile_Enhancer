"""Orchestrates a full resume analysis: deterministic checks + LLM evaluation +
LeetCode enrichment + scoring/verdict, then persists the result."""

from __future__ import annotations

import re
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import HTTPException

from app.config import settings
from app.models import Analysis, BannedProject, Criterion, CriterionResult, JobDescription, Resume
from app.services import appsettings
from app.services import github as github_service
from app.services import jd as jd_service
from app.services import leetcode, links, redact, semantic
from app.services.llm import get_provider
from app.services.prompts import (
    SYSTEM_PROMPT,
    build_jd_prompt,
    build_no_jd_prompt,
)

def _active_criteria(db: Session) -> list[Criterion]:
    return list(db.scalars(select(Criterion).where(Criterion.is_active.is_(True))))


def _banned_project_names(db: Session) -> list[str]:
    return list(db.scalars(select(BannedProject.name).where(BannedProject.is_active.is_(True))))


def detect_banned_projects(resume_text: str, banned: list[str]) -> list[str]:
    """Deterministic safety net: match banned project names in the resume text.

    Uses a case-insensitive substring match, plus a token-presence check that catches
    reworded multi-word titles (e.g. "Nxt Trendz – an ecommerce clone") without pulling
    in a fuzzy-matching dependency.
    """
    text_low = resume_text.lower()
    text_tokens = set(re.findall(r"[a-z0-9]+", text_low))
    hits: list[str] = []
    for name in banned:
        name_low = name.lower()
        if name_low in text_low:
            hits.append(name)
            continue
        # all significant tokens of a multi-word title appearing => strong signal
        core = [t for t in re.findall(r"[a-z0-9]+", name_low) if len(t) > 3]
        if len(core) >= 2 and all(t in text_tokens for t in core):
            hits.append(name)
    return sorted(set(hits))


def _is_http(url) -> bool:
    return bool(url) and str(url).strip().lower().startswith(("http://", "https://"))


def _ground_project_links(result: dict) -> None:
    """Trust only real URLs found in the text — null out anything the model assumed, then
    recompute the project-links criterion so the rubric and the projects table always agree."""
    projects = result.get("projects") or []
    for p in projects:
        gh = (p.get("github_url") or "").strip()
        dep = (p.get("deployed_url") or "").strip()
        # A project repo link must be github.com/<owner>/<repo>, NOT a bare profile link.
        gh_ok = _is_http(gh) and github_service.parse_repo(gh) is not None
        dep_ok = _is_http(dep) and "github.com" not in dep.lower()
        p["github_url"] = gh if gh_ok else None
        p["deployed_url"] = dep if dep_ok else None
        p["has_github_link"] = gh_ok
        p["has_deployed_link"] = dep_ok

    if not projects:
        return

    total = len(projects)
    both = sum(1 for p in projects if p["has_github_link"] and p["has_deployed_link"])
    missing_desc = []
    for p in projects:
        miss = []
        if not p["has_github_link"]:
            miss.append("GitHub")
        if not p["has_deployed_link"]:
            miss.append("deployed")
        if miss:
            missing_desc.append(f"{p.get('name', 'project')} (missing {', '.join(miss)})")

    for c in result.get("criteria", []):
        if c.get("key") == "project_links_present":
            c["passed"] = both == total
            c["score"] = round(100 * both / total) if total else 0
            c["comment"] = (
                "Every project includes both a GitHub and a deployed link."
                if both == total
                else "Some projects are missing links — " + "; ".join(missing_desc)
            )
            c["evidence"] = None
            break


def _enrich_leetcode(result: dict, resume_text: str) -> None:
    """If a LeetCode profile is present, fetch solved count + consistency, assess against
    the bar, and add improvement point(s) to the coding section when below it."""
    profiles = result.get("coding_profiles") or []
    url = None
    for p in profiles:
        u = (p.get("url") or "")
        if "leetcode" in u.lower() or (p.get("platform", "").lower() == "leetcode"):
            url = u or p.get("url")
            break
    if not url:
        url = leetcode.find_leetcode_url(resume_text)
    if not url:
        return

    stats = leetcode.fetch_stats(url)
    if not stats:
        # Profile present but stats couldn't be fetched (private/rate-limited/unreachable).
        result["leetcode"] = {"profile_url": url, "fetch_failed": True}
        return

    assessment = leetcode.assess(stats)
    result["leetcode"] = {**stats, **assessment, "profile_url": url}

    # Surface coding improvement points in the main improvements list too.
    if assessment["improvement_points"]:
        improvements = result.setdefault("improvements", [])
        priority = "high" if not assessment["meets_problem_bar"] else "medium"
        for point in assessment["improvement_points"]:
            improvements.append({"priority": priority, "text": f"Coding: {point}"})


def _compute_score_and_verdict(
    criteria: list[Criterion],
    llm_criteria: list[dict],
    critical_failed: bool,
    select_threshold: float,
    review_threshold: float,
) -> tuple[float, str, list[dict]]:
    by_key = {c.key: c for c in criteria}
    rows: list[dict] = []
    total_weight = 0.0
    weighted_sum = 0.0

    for item in llm_criteria:
        key = item.get("key")
        crit = by_key.get(key)
        if not crit:
            continue
        passed = bool(item.get("passed"))
        score = float(item.get("score", 0))
        total_weight += crit.weight
        weighted_sum += crit.weight * score
        if crit.is_critical and not passed:
            critical_failed = True
        rows.append(
            {
                "criterion_key": key,
                "title": crit.title,
                "passed": passed,
                "score": score,
                "severity": item.get("severity", "info"),
                "comment": item.get("comment", ""),
                "evidence": item.get("evidence"),
            }
        )

    overall = round(weighted_sum / total_weight, 1) if total_weight else 0.0

    if critical_failed:
        verdict = "reject"
    elif overall >= select_threshold:
        verdict = "select"
    elif overall >= review_threshold:
        verdict = "review"
    else:
        verdict = "reject"

    return overall, verdict, rows


def _find_duplicate(db: Session, resume: Resume) -> dict | None:
    """Cross-resume plagiarism: nearest other resume by embedding cosine."""
    if not resume.embedding:
        return None
    others = db.scalars(
        select(Resume)
        .where(Resume.id != resume.id, Resume.embedding.is_not(None))
        .order_by(Resume.created_at.desc())
        .limit(1000)
    )
    best_sim, best = 0.0, None
    for o in others:
        sim = semantic.cosine(resume.embedding, o.embedding)
        if sim > best_sim:
            best_sim, best = sim, o
    if best and best_sim >= settings.plagiarism_threshold:
        return {
            "resume_id": best.id,
            "name": best.original_filename or f"Resume #{best.id}",
            "similarity": round(best_sim * 100, 1),
        }
    return None


def _screening_enrichments(db: Session, resume: Resume, result: dict) -> None:
    """Deterministic authenticity/quality signals layered on top of the LLM output.
    Every external call is best-effort and must never raise."""
    projects = result.get("projects") or []
    profiles = result.get("coding_profiles") or []

    urls: list[str] = []
    for p in projects:
        for k in ("github_url", "deployed_url"):
            if p.get(k):
                urls.append(p[k])
    for pr in profiles:
        if pr.get("url"):
            urls.append(pr["url"])

    checks: dict[str, dict] = {}
    if settings.enable_link_checks and urls:
        try:
            checks = links.verify_links(urls)
        except Exception:
            checks = {}
    result["link_checks"] = checks

    # Annotate projects with liveness + GitHub repo authenticity
    repo_info: list[dict] = []
    for p in projects:
        gh, dep = p.get("github_url"), p.get("deployed_url")
        p["github_live"] = checks.get(gh, {}).get("live") if gh else None
        p["deployed_live"] = checks.get(dep, {}).get("live") if dep else None
        if gh:
            try:
                info = github_service.fetch_repo(gh)
            except Exception:
                info = None
            if info:
                info["project"] = p.get("name")
                repo_info.append(info)
                p["repo_exists"] = info.get("exists")
                p["repo_is_fork"] = info.get("is_fork")
    result["project_authenticity"] = repo_info

    # GitHub profile stats — prefer an actual profile link (not a repo), then resume text,
    # then the owner of a project repo.
    gh_profile_url = None
    for pr in profiles:
        url = (pr.get("url") or "")
        if "github.com" in url.lower() and github_service.parse_repo(url) is None:
            gh_profile_url = url
            break
    if not gh_profile_url:
        gh_profile_url = github_service.find_profile_url(resume.extracted_text)
    if not gh_profile_url and repo_info:
        owner = repo_info[0].get("owner_login") or repo_info[0].get("owner")
        if owner:
            gh_profile_url = f"https://github.com/{owner}"
    if gh_profile_url:
        try:
            prof = github_service.fetch_profile(gh_profile_url)
        except Exception:
            prof = None
        if prof:
            result["github"] = prof

    # Cross-resume plagiarism
    dup = _find_duplicate(db, resume)
    if dup:
        result["duplicate"] = dup

    # Ingestion signals (pages, images/photo, hidden text)
    if resume.ingest_meta:
        result["ingest"] = resume.ingest_meta


def _resume_skills_from_result(llm_result: dict) -> list[str]:
    skills: list[str] = []
    for group in (llm_result.get("skill_sections") or {}).values():
        skills.extend(group or [])
    skills.extend(llm_result.get("ungrouped_skills") or [])
    return skills


def _enrich_jd_match(
    db: Session, resume: Resume, jd: JobDescription, llm_result: dict
) -> float | None:
    """Add the embedding-based semantic skill matrix + resume<->JD similarity, and
    return the LLM's overall fit score for storage/ranking. Best-effort; embedding
    failures never block the analysis."""
    jd_match = llm_result.get("jd_match") or {}

    try:
        embed_provider = get_provider(jd.provider)
        jd_skills = jd_service.jd_skill_list(jd.structured_json)
        resume_skills = _resume_skills_from_result(llm_result)
        matrix = semantic.build_skill_matrix(embed_provider, jd_skills, resume_skills)
        jd_match["semantic_skill_matrix"] = matrix
        jd_match["semantic_coverage"] = semantic.coverage_percent(matrix)

        if jd.embedding:
            resume_vec = jd_service.ensure_resume_embedding(db, resume, embed_provider)
            if resume_vec:
                jd_match["semantic_similarity"] = round(
                    semantic.cosine(jd.embedding, resume_vec) * 100, 1
                )
    except Exception:
        pass

    llm_result["jd_match"] = jd_match
    score = jd_match.get("score")
    try:
        return float(score) if score is not None else None
    except (TypeError, ValueError):
        return None


def run_analysis(
    db: Session,
    resume: Resume,
    mode: str,
    jd_text: str | None,
    provider_name: str | None,
    job_description_id: int | None = None,
    bias_safe: bool = False,
) -> Analysis:
    criteria = _active_criteria(db)
    banned = _banned_project_names(db)

    provider = get_provider(provider_name)

    # Bias-safe mode: score against redacted text (links/GitHub checks still use original).
    resume_text = resume.extracted_text
    redactions: list[str] = []
    if bias_safe:
        resume_text, redactions = redact.redact_pii(resume_text)

    jd: JobDescription | None = None
    if mode == "jd":
        if job_description_id is not None:
            jd = db.get(JobDescription, job_description_id)
            if not jd:
                raise HTTPException(status_code=404, detail="Job description not found")
        elif jd_text:
            # inline JD: parse + embed + store so it can be reused and ranked against
            jd = jd_service.parse_and_store(
                db, resume.user_id, jd_text, None, None, provider_name
            )
        else:
            raise HTTPException(
                status_code=400, detail="jd_text or job_description_id is required for JD mode"
            )
        user_prompt = build_jd_prompt(resume_text, jd.structured_json, criteria, banned)
    else:
        user_prompt = build_no_jd_prompt(resume_text, criteria, banned)

    llm_result = provider.complete_json(SYSTEM_PROMPT, user_prompt)

    # Deterministic banned-project detection augments the LLM's view.
    banned_hits = detect_banned_projects(resume.extracted_text, banned)
    llm_result["detected_banned_projects"] = banned_hits
    if bias_safe:
        llm_result["bias_safe"] = {"enabled": True, "redacted": redactions}

    # Ground project links on real URLs only (no assumptions), reconcile the criterion.
    _ground_project_links(llm_result)

    # Encourage a minimum of 2 projects.
    project_count = len(llm_result.get("projects") or [])
    if project_count < 2:
        llm_result.setdefault("improvements", []).insert(
            0,
            {
                "priority": "high",
                "text": (
                    f"Include at least 2 projects (only {project_count} found) — add another "
                    "self-made project with GitHub and deployed links to strengthen your resume."
                ),
            },
        )
    llm_result["project_count"] = project_count

    # LeetCode enrichment (rule #4) — use original text so the link is found even in bias-safe mode.
    _enrich_leetcode(llm_result, resume.extracted_text)

    # Authenticity / quality / plagiarism enrichments.
    _screening_enrichments(db, resume, llm_result)

    jd_fit_score: float | None = None
    if jd is not None:
        jd_fit_score = _enrich_jd_match(db, resume, jd, llm_result)

    # Hidden-text keyword stuffing can force a reject if the admin enabled it.
    hidden = bool((resume.ingest_meta or {}).get("hidden_text"))
    extra_critical = bool(banned_hits) or (
        hidden and appsettings.get_bool(db, "autoreject_hidden_text")
    )

    select_t, review_t = appsettings.get_thresholds(db)
    overall, verdict, rows = _compute_score_and_verdict(
        criteria, llm_result.get("criteria", []), extra_critical, select_t, review_t
    )

    confidence = llm_result.get("confidence")
    try:
        confidence = float(confidence) if confidence is not None else None
    except (TypeError, ValueError):
        confidence = None

    analysis = Analysis(
        resume_id=resume.id,
        mode=mode,
        provider=provider.name,
        model=provider.model,
        jd_text=jd_text if jd is None else jd.raw_text,
        job_description_id=jd.id if jd else None,
        overall_score=overall,
        jd_fit_score=jd_fit_score,
        verdict=verdict,
        confidence=confidence,
        share_code="RE-" + secrets.token_hex(4).upper(),
        result_json=llm_result,
    )
    analysis.criterion_results = [CriterionResult(**row) for row in rows]
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis
