"""Send a candidate their resume evaluation report over SMTP (stdlib only)."""

from __future__ import annotations

import os
import re
import smtplib
import ssl
from email.message import EmailMessage

from fastapi import HTTPException

from app.config import settings
from app.models import Analysis, Resume, User

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def detect_candidate_email(resume: Resume, fallback: str | None) -> str | None:
    """The candidate's email is usually printed on their resume — prefer that over the
    uploader's account email (which, for admin uploads, is the admin)."""
    m = _EMAIL_RE.search(resume.extracted_text or "")
    return m.group(0) if m else fallback


def _verdict_label(verdict: str) -> str:
    return {"select": "Shortlisted", "review": "Under review", "reject": "Not selected"}.get(
        verdict, verdict.title()
    )


def _build_message(analysis: Analysis, resume: Resume, candidate: User, recipient: str) -> EmailMessage:
    r = analysis.result_json or {}
    name = candidate.full_name or candidate.email.split("@")[0]
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

    msg = EmailMessage()
    msg["Subject"] = f"Your Resume Evaluation Report [{code}]"
    msg["From"] = settings.smtp_sender
    msg["To"] = recipient
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    # Attach the resume file for PDF/DOCX uploads (link-based resumes are referenced in the body).
    if resume.source_type == "pdf" and resume.source_ref and os.path.exists(resume.source_ref):
        try:
            with open(resume.source_ref, "rb") as f:
                data = f.read()
            filename = resume.original_filename or os.path.basename(resume.source_ref)
            msg.add_attachment(data, maintype="application", subtype="octet-stream", filename=filename)
        except OSError:
            pass

    return msg


def send_report_email(analysis: Analysis, resume: Resume, candidate: User, recipient: str) -> None:
    print(candidate.email)
    print(f"Sending report email to {recipient} for analysis {analysis.id}...")
    if not settings.smtp_configured:
        raise HTTPException(
            status_code=400,
            detail="Email is not configured. Set SMTP_HOST / SMTP_USER / SMTP_PASSWORD in .env.",
        )
    msg = _build_message(analysis, resume, candidate, recipient)
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
