"""Best-effort PII redaction for bias-safe screening. Removes name/contact/gender
signals from the text sent to the LLM so scoring focuses on merit. Deterministic
checks (links, GitHub) still run on the original text."""

from __future__ import annotations

import re

_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_PHONE_RE = re.compile(r"(?:(?:\+?\d{1,3}[-\s.]?)?(?:\(?\d{2,4}\)?[-\s.]?){2,4}\d{2,4})")
_PRONOUN_RE = re.compile(r"\b(he|him|his|she|her|hers|mr|mrs|ms|miss)\b", re.IGNORECASE)


def _looks_like_name(line: str) -> bool:
    words = line.split()
    if not (1 < len(words) <= 4):
        return False
    if any(ch.isdigit() for ch in line):
        return False
    # mostly capitalized words, short line => likely the header name
    caps = sum(1 for w in words if w[:1].isupper())
    return caps >= len(words) - 1 and len(line) <= 40


def redact_pii(text: str) -> tuple[str, list[str]]:
    redactions: list[str] = []
    lines = text.splitlines()

    # Redact a name-like header in the first few lines.
    for i, line in enumerate(lines[:4]):
        stripped = line.strip()
        if stripped and _looks_like_name(stripped):
            redactions.append("name")
            lines[i] = "[REDACTED NAME]"
            break

    redacted = "\n".join(lines)

    if _EMAIL_RE.search(redacted):
        redactions.append("email")
        redacted = _EMAIL_RE.sub("[REDACTED EMAIL]", redacted)
    if _PHONE_RE.search(redacted):
        redactions.append("phone")
        redacted = _PHONE_RE.sub("[REDACTED PHONE]", redacted)
    if _PRONOUN_RE.search(redacted):
        redactions.append("gendered terms")
        redacted = _PRONOUN_RE.sub("[REDACTED]", redacted)

    return redacted, sorted(set(redactions))
