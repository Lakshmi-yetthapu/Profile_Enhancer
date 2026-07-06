"""Send a candidate their resume evaluation report.

Transport is chosen automatically: the Resend HTTP API (works on hosts that block SMTP,
e.g. Render) when RESEND_API_KEY is set, otherwise SMTP for local development.
"""

from __future__ import annotations

import base64
import os
import re
import smtplib
import ssl
from email.message import EmailMessage

import httpx
from fastapi import HTTPException

from app.config import settings
from app.models import Analysis, Resume, User

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def detect_candidate_email(resume: Resume, fallback: str | None) -> str | None:
    """The candidate's email is usually printed on their resume — prefer that over the
    uploader's account email (which, for admin uploads, is the admin)."""
    m = _EMAIL_RE.search(resume.extracted_text or "")
    return m.group(0) if m else fallback


def display_name_from_email(email: str) -> str:
    """Turn an email into a friendly name, e.g. 'pramodh.kumar@x.com' -> 'Pramodh Kumar'."""
    local = (email or "").split("@")[0]
    cleaned = re.sub(r"[._+-]+", " ", local).strip()
    return cleaned.title() if cleaned else "there"


_NAME_SKIP = {"resume", "curriculum vitae", "cv", "portfolio", "profile"}


def detect_candidate_name(resume: Resume) -> str | None:
    """Pull the candidate's name from the top of the resume (usually the first line)."""
    for raw in (resume.extracted_text or "").splitlines()[:8]:
        line = raw.strip().strip("|•-–").strip()
        if not line:
            continue
        low = line.lower()
        if "@" in line or "http" in low or any(ch.isdigit() for ch in line):
            continue
        if low in _NAME_SKIP or low.startswith(("resume", "curriculum")):
            continue
        words = line.split()
        if not (2 <= len(words) <= 4) or len(line) > 40:
            continue
        if not re.fullmatch(r"[A-Za-z .'-]+", line):
            continue
        # most words should be capitalized (name-like)
        if sum(1 for w in words if w[:1].isupper()) >= len(words) - 1:
            return line.title() if line.isupper() else line
    return None


def _verdict_label(verdict: str) -> str:
    return {"select": "Shortlisted", "review": "Under review", "reject": "Not selected"}.get(
        verdict, verdict.title()
    )


def _resume_attachment(resume: Resume) -> tuple[str, bytes] | None:
    """(filename, bytes) for a locally-stored PDF/DOCX upload, else None.
    On ephemeral hosts the file may be gone — that's fine, we just skip it."""
    if resume.source_type == "pdf" and resume.source_ref and os.path.exists(resume.source_ref):
        try:
            with open(resume.source_ref, "rb") as f:
                return (resume.original_filename or os.path.basename(resume.source_ref)), f.read()
        except OSError:
            return None
    return None


def _build_parts(analysis: Analysis, resume: Resume, recipient: str) -> dict:
    r = analysis.result_json or {}
    # Prefer the name printed on the resume; fall back to the email's username.
    name = detect_candidate_name(resume) or display_name_from_email(recipient)
    score = round(analysis.overall_score)
    verdict = _verdict_label(analysis.verdict)
    code = analysis.share_code or f"RE-{analysis.id}"
    improvements = [i.get("text", "") for i in (r.get("improvements") or [])][:6]
    summary = r.get("summary") or ""

    report_link = f"{settings.app_public_url.rstrip('/')}/report/{analysis.id}"
    resume_ref = "" if resume.source_type == "pdf" else resume.source_ref

    text = (
        f"Hello {name},\n\n"
        f"Your resume has been evaluated. Reference ID: {code}\n\n"
        f"Overall score: {score}/100\n"
        f"Outcome: {verdict}\n\n"
        f"{summary}\n\n"
    )
    if improvements:
        text += "Key suggestions:\n" + "\n".join(f"  - {i}" for i in improvements) + "\n\n"
    if resume_ref:
        text += f"Resume on file: {resume_ref}\n"
    text += f"\nFull report: {report_link}\n\nRegards,\nNxtWave Evaluation Team\n"

    bullets = "".join(f"<li>{i}</li>" for i in improvements)
    html = f"""\
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;color:#1f2937">
  <h2 style="margin:0 0 4px">Resume Evaluation Report</h2>
  <p style="color:#6b7280;margin:0 0 16px">Reference ID: <strong>{code}</strong></p>
  <p>Hello {name},</p>
  <p>Your resume has been evaluated. Here is a summary of your report.</p>
  <table style="border-collapse:collapse;margin:12px 0">
    <tr><td style="padding:6px 12px;background:#f3f4f6">Overall score</td>
        <td style="padding:6px 12px;font-weight:700">{score}/100</td></tr>
    <tr><td style="padding:6px 12px;background:#f3f4f6">Outcome</td>
        <td style="padding:6px 12px;font-weight:700">{verdict}</td></tr>
  </table>
  {'<p>' + summary + '</p>' if summary else ''}
  {'<h3>Key suggestions</h3><ul>' + bullets + '</ul>' if bullets else ''}
  {'<p>Resume on file: <a href="' + resume_ref + '">' + resume_ref + '</a></p>' if resume_ref else ''}
  <p><a href="{report_link}">View the full report</a></p>
  <p style="color:#6b7280;font-size:13px">Regards,<br/>NxtWave Evaluation Team</p>
</div>
"""
    return {
        "subject": f"Your Resume Evaluation Report [{code}]",
        "html": html,
        "text": text,
        "attachment": _resume_attachment(resume),
    }


def _send_via_resend(parts: dict, recipient: str) -> None:
    payload: dict = {
        "from": settings.resend_from,
        "to": [recipient],
        "subject": parts["subject"],
        "html": parts["html"],
        "text": parts["text"],
    }
    if parts["attachment"]:
        filename, data = parts["attachment"]
        payload["attachments"] = [
            {"filename": filename, "content": base64.b64encode(data).decode("ascii")}
        ]
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json=payload,
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send email: {exc}") from exc
    if resp.status_code >= 300:
        raise HTTPException(status_code=502, detail=f"Resend error: {resp.text[:300]}")


def _send_via_smtp(parts: dict, recipient: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = parts["subject"]
    msg["From"] = settings.smtp_sender
    msg["To"] = recipient
    msg.set_content(parts["text"])
    msg.add_alternative(parts["html"], subtype="html")
    if parts["attachment"]:
        filename, data = parts["attachment"]
        msg.add_attachment(data, maintype="application", subtype="octet-stream", filename=filename)
    try:
        if settings.smtp_port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=30) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
                if settings.smtp_use_tls:
                    server.starttls(context=ssl.create_default_context())
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send email: {exc}") from exc


def send_report_email(analysis: Analysis, resume: Resume, candidate: User, recipient: str) -> None:
    if not settings.email_configured:
        raise HTTPException(
            status_code=400,
            detail="Email is not configured. Set RESEND_API_KEY (recommended) or SMTP_* in the environment.",
        )
    parts = _build_parts(analysis, resume, recipient)
    if settings.resend_api_key:
        _send_via_resend(parts, recipient)
    else:
        _send_via_smtp(parts, recipient)
