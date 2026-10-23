"""Sends e-mail through Resend (https://resend.com); without RESEND_API_KEY it only logs it.

`outbox` keeps the e-mails that were only logged, so tests and local development can read the codes.
"""
import json
import logging
import urllib.request

from app.config import settings

log = logging.getLogger("availy.mail")
outbox: list[dict] = []


def send_email(to: str, subject: str, text: str) -> bool:
    message = {"from": settings.mail_from, "to": [to], "subject": subject, "text": text}
    if not settings.resend_api_key:
        outbox.append(message)
        log.warning("E-posta gönderilmedi (RESEND_API_KEY yok): %s · %s\n%s", to, subject, text)
        return True
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(message).encode(),
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return 200 <= response.status < 300
    except Exception:  # noqa: BLE001 - a failed e-mail must not break the request
        log.exception("E-posta gönderilemedi: %s", to)
        return False
