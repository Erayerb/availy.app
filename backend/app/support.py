"""v2 "Hata bildir" / "İletişime geç": messages from the app, kept on the server (and e-mailed to SUPPORT_EMAIL)."""
import re
from datetime import datetime, timedelta

import psycopg

from app.config import settings
from app.mailer import send_email

MIN_TEXT = 10
MAX_TEXT = 1000
DAILY_LIMIT = 10  # per account (or per e-mail without one)
TOPICS = {
    "bug": ("Uygulama hatası", "Yanlış mekan bilgisi", "Doluluk yanlış görünüyor", "Öneri"),
    "contact": ("Genel", "İşletme / iş birliği", "Hesap", "Gizlilik (KVKK)"),
}
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class SupportError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def send_support(
    conn: psycopg.Connection,
    me: dict | None,
    kind: str,
    topic: str,
    body: str,
    email: str,
    app_info: str,
    now: datetime,
) -> dict:
    if kind not in TOPICS or topic not in TOPICS[kind]:
        raise SupportError("Konuyu seç.")
    text, mail = body.strip(), email.strip()
    if not MIN_TEXT <= len(text) <= MAX_TEXT:
        raise SupportError(f"{MIN_TEXT} ile {MAX_TEXT} karakter arasında yaz.")
    if kind == "contact" and not mail:
        raise SupportError("Sana dönebilmemiz için e-posta adresini yaz.")
    if mail and not EMAIL.match(mail):
        raise SupportError("Geçerli bir e-posta adresi yaz.")
    sent_today = conn.execute(
        "SELECT count(*)::int AS n FROM support_messages WHERE created_at > %s AND (user_id = %s OR (user_id IS NULL AND email = %s))",
        (now - timedelta(days=1), me["id"] if me else -1, mail or "-"),
    ).fetchone()["n"]
    if sent_today >= DAILY_LIMIT:
        raise SupportError("Bugün çok mesaj gönderdin; yarın tekrar dene.", 429)
    row = conn.execute(
        """
        INSERT INTO support_messages (user_id, kind, topic, body, email, app_info, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (me["id"] if me else None, kind, topic, text, mail or None, app_info[:200] or None, now),
    ).fetchone()
    if settings.support_email:
        who = f"@{me['username']}" if me and me.get("username") else ("misafir" if me else "giriş yapmamış")
        send_email(
            settings.support_email,
            f"[availy {'hata' if kind == 'bug' else 'iletişim'} #{row['id']}] {topic}",
            f"{text}\n\nKimden: {who} · {mail or 'e-posta yok'}\nUygulama: {app_info or '-'}",
        )
    return {"id": row["id"]}
