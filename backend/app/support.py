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
            f"[availo {'hata' if kind == 'bug' else 'iletişim'} #{row['id']}] {topic}",
            f"{text}\n\nKimden: {who} · {mail or 'e-posta yok'}\nUygulama: {app_info or '-'}",
        )
    return {"id": row["id"]}


def support_inbox(conn: psycopg.Connection, admin: dict) -> list[dict]:
    """Yönetim > Destek: messages not answered yet, oldest first (answered ones from the last week below)."""
    from app.moderation import require_admin

    require_admin(admin)
    return conn.execute(
        """
        SELECT s.id, s.kind, s.topic, s.body, s.email, s.created_at, s.reply, s.replied_at, u.username
        FROM support_messages s LEFT JOIN users u ON u.id = s.user_id
        WHERE s.replied_at IS NULL OR s.replied_at > now() - interval '7 days'
        ORDER BY s.replied_at IS NOT NULL, s.created_at
        LIMIT 100
        """
    ).fetchall()


def reply_support(conn: psycopg.Connection, admin: dict, message_id: int, text: str, now: datetime) -> None:
    """The answer shows in the sender's 🔔 (signed-in senders); it is also e-mailed when they left an address."""
    from app.moderation import ModerationError, require_admin

    require_admin(admin)
    text = text.strip()
    if not 2 <= len(text) <= MAX_TEXT:
        raise ModerationError(f"Yanıt 2 ile {MAX_TEXT} karakter arasında olmalı.")
    row = conn.execute(
        "UPDATE support_messages SET reply = %s, replied_at = %s WHERE id = %s RETURNING email, topic",
        (text, now, message_id),
    ).fetchone()
    if row is None:
        raise ModerationError("Mesaj bulunamadı.", 404)
    if row["email"]:
        send_email(row["email"], f"availo destek: {row['topic']}", text)
