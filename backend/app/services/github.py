"""GitHub enrichment: verify a project repo is real & original, and summarize a
candidate's public GitHub activity. Uses the public REST API; an optional token raises
the rate limit. All functions are best-effort and return None on any failure."""

from __future__ import annotations

import re

import httpx

from app.config import settings

_API = "https://api.github.com"
_REPO_RE = re.compile(r"github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?(?:/|$)")
_USER_RE = re.compile(r"github\.com/([A-Za-z0-9_-]+)/?$")
# A profile link: github.com/<username> not followed by a repository path.
_PROFILE_RE = re.compile(r"https?://(?:www\.)?github\.com/([A-Za-z0-9_-]+)/?(?=\s|$)", re.IGNORECASE)
_RESERVED = {"orgs", "sponsors", "settings", "marketplace", "about", "features", "topics", "u"}


def _headers() -> dict:
    h = {"Accept": "application/vnd.github+json", "User-Agent": "ResumeEnhancer"}
    if settings.github_token:
        h["Authorization"] = f"Bearer {settings.github_token}"
    return h


def parse_repo(url: str) -> tuple[str, str] | None:
    m = _REPO_RE.search(url or "")
    if not m:
        return None
    owner, repo = m.group(1), m.group(2)
    if owner in {"orgs", "sponsors", "settings", "marketplace"}:
        return None
    return owner, repo


def find_profile_url(text: str) -> str | None:
    """Find a GitHub profile URL (github.com/<username>, not a repo) in free text."""
    for m in _PROFILE_RE.finditer(text or ""):
        user = m.group(1)
        if user.lower() not in _RESERVED:
            return f"https://github.com/{user}"
    return None


def parse_username(url_or_handle: str) -> str | None:
    m = _USER_RE.search(url_or_handle or "")
    if m:
        return m.group(1)
    s = (url_or_handle or "").strip().lstrip("@")
    if s and "/" not in s and " " not in s and "." not in s:
        return s
    return None


def fetch_repo(url: str) -> dict | None:
    parsed = parse_repo(url)
    if not parsed:
        return None
    owner, repo = parsed
    try:
        with httpx.Client(timeout=12, headers=_headers()) as client:
            resp = client.get(f"{_API}/repos/{owner}/{repo}")
            if resp.status_code != 200:
                return {"url": url, "exists": False, "owner": owner, "repo": repo}
            d = resp.json()
    except (httpx.HTTPError, ValueError):
        return None
    return {
        "url": url,
        "exists": True,
        "owner": owner,
        "repo": repo,
        "is_fork": bool(d.get("fork")),
        "stars": d.get("stargazers_count", 0),
        "language": d.get("language"),
        "last_push": d.get("pushed_at"),
        "created_at": d.get("created_at"),
        "owner_login": (d.get("owner") or {}).get("login"),
    }


def fetch_profile(url_or_handle: str) -> dict | None:
    username = parse_username(url_or_handle)
    if not username:
        return None
    try:
        with httpx.Client(timeout=12, headers=_headers()) as client:
            u = client.get(f"{_API}/users/{username}")
            if u.status_code != 200:
                return None
            user = u.json()
            repos_resp = client.get(
                f"{_API}/users/{username}/repos",
                params={"per_page": 100, "sort": "pushed"},
            )
            repos = repos_resp.json() if repos_resp.status_code == 200 else []
    except (httpx.HTTPError, ValueError):
        return None

    if not isinstance(repos, list):
        repos = []
    original = [r for r in repos if not r.get("fork")]
    languages: dict[str, int] = {}
    total_stars = 0
    for r in original:
        total_stars += r.get("stargazers_count", 0)
        lang = r.get("language")
        if lang:
            languages[lang] = languages.get(lang, 0) + 1
    top_languages = [k for k, _ in sorted(languages.items(), key=lambda kv: -kv[1])[:6]]

    return {
        "username": user.get("login"),
        "public_repos": user.get("public_repos", 0),
        "followers": user.get("followers", 0),
        "original_repos": len(original),
        "forked_repos": len(repos) - len(original),
        "total_stars": total_stars,
        "top_languages": top_languages,
        "last_active": original[0].get("pushed_at") if original else None,
    }
