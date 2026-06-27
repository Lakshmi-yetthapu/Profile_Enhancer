"""Verify that the links on a resume actually resolve (HTTP-reachable). Backs the
"GitHub + deployed link for every project" rule by proving links are live, not just present."""

from __future__ import annotations

import httpx

_HEADERS = {"User-Agent": "Mozilla/5.0 (ResumeEnhancer link checker)"}


def check_url(client: httpx.Client, url: str) -> dict:
    result = {"url": url, "live": False, "status": None, "error": None}
    if not url or not url.lower().startswith(("http://", "https://")):
        result["error"] = "not a valid URL"
        return result
    try:
        resp = client.get(url)
        result["status"] = resp.status_code
        result["live"] = 200 <= resp.status_code < 400
    except httpx.HTTPError as exc:
        result["error"] = type(exc).__name__
    return result


def verify_links(urls: list[str]) -> dict[str, dict]:
    """Return {url: check_result} for each unique non-empty URL."""
    unique = [u for u in dict.fromkeys(urls) if u]
    out: dict[str, dict] = {}
    if not unique:
        return out
    with httpx.Client(
        follow_redirects=True, timeout=12, headers=_HEADERS, verify=True
    ) as client:
        for url in unique:
            out[url] = check_url(client, url)
    return out
