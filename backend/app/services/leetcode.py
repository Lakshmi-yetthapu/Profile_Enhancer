"""Fetch public LeetCode stats (problems solved + recent consistency) via the
unofficial GraphQL endpoint. Used to back rule #4 (coding profiles)."""

from __future__ import annotations

import re

import httpx

_LEETCODE_GQL = "https://leetcode.com/graphql"
_USERNAME_RE = re.compile(r"leetcode\.com/(?:u/)?([A-Za-z0-9_\-]+)")
_URL_RE = re.compile(r"https?://(?:www\.)?leetcode\.com/\S+", re.IGNORECASE)

# Org bar for the coding/problem-solving signal.
MIN_PROBLEMS = 100
MIN_ACTIVE_DAYS = 50  # rough "solves consistently" threshold

_QUERY = """
query userStats($username: String!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
    userCalendar { streak totalActiveDays }
  }
}
"""


def extract_username(url_or_handle: str) -> str | None:
    m = _USERNAME_RE.search(url_or_handle)
    if m:
        candidate = m.group(1)
        if candidate not in {"u", "problems", "contest", "discuss"}:
            return candidate
    if url_or_handle and "/" not in url_or_handle and " " not in url_or_handle:
        return url_or_handle.strip()
    return None


def fetch_stats(url_or_handle: str) -> dict | None:
    username = extract_username(url_or_handle)
    if not username:
        return None
    try:
        with httpx.Client(timeout=15, headers={"Referer": "https://leetcode.com"}) as client:
            resp = client.post(
                _LEETCODE_GQL,
                json={"query": _QUERY, "variables": {"username": username}},
            )
            resp.raise_for_status()
            data = resp.json().get("data", {}).get("matchedUser")
    except (httpx.HTTPError, ValueError):
        return None

    if not data:
        return None

    solved = {item["difficulty"]: item["count"] for item in
              data["submitStatsGlobal"]["acSubmissionNum"]}
    calendar = data.get("userCalendar") or {}
    return {
        "username": data["username"],
        "total_solved": solved.get("All", 0),
        "easy": solved.get("Easy", 0),
        "medium": solved.get("Medium", 0),
        "hard": solved.get("Hard", 0),
        "current_streak": calendar.get("streak", 0),
        "active_days": calendar.get("totalActiveDays", 0),
    }


def find_leetcode_url(text: str) -> str | None:
    """Pull a LeetCode profile URL straight from the resume text (fallback when the
    LLM doesn't surface it in coding_profiles)."""
    m = _URL_RE.search(text or "")
    return m.group(0).rstrip(").,;") if m else None


def assess(stats: dict) -> dict:
    """Evaluate the problem count + consistency against the org bar and produce explicit
    improvement points for the coding section."""
    total = stats.get("total_solved", 0)
    active_days = stats.get("active_days", 0)

    meets_problem_bar = total >= MIN_PROBLEMS
    consistent = active_days >= MIN_ACTIVE_DAYS

    improvement_points: list[str] = []
    if total == 0:
        improvement_points.append(
            "No problems solved yet on LeetCode — start solving daily, beginning with easy problems."
        )
    elif not meets_problem_bar:
        improvement_points.append(
            f"Only {total} problems solved — solve at least {MIN_PROBLEMS} "
            f"(add more Medium problems) to meet the bar."
        )
    if not consistent:
        improvement_points.append(
            f"Practice isn't consistent ({active_days} active days, current streak "
            f"{stats.get('current_streak', 0)}) — solve problems regularly to build a steady streak."
        )

    if meets_problem_bar and consistent:
        guidance = (
            f"Strong coding profile: {total} solved (Easy {stats.get('easy', 0)}, "
            f"Medium {stats.get('medium', 0)}, Hard {stats.get('hard', 0)}) with consistent practice."
        )
    else:
        guidance = (
            f"{total} problems solved (Easy {stats.get('easy', 0)}, Medium {stats.get('medium', 0)}, "
            f"Hard {stats.get('hard', 0)}); {active_days} active days. " + " ".join(improvement_points)
        )

    return {
        "meets_problem_bar": meets_problem_bar,
        "consistent": consistent,
        "min_problems": MIN_PROBLEMS,
        "improvement_points": improvement_points,
        "guidance": guidance,
    }
