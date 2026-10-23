"""v2 "İşletmeye haber ver": customers ask a venue that has no business account to join availy.

Each person counts once. When the count reaches 3, 5, 10, 25, 50 or 100 and the venue's e-mail is known,
the venue gets an e-mail with the number only: never who asked.
"""
from datetime import datetime

import psycopg

from app.mailer import send_email

MAIL_AT = (3, 5, 10, 25, 50, 100)


class RequestError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def _has_business(conn: psycopg.Connection, venue_id: int) -> bool:
    return conn.execute("SELECT 1 FROM users WHERE role = 'business' AND venue_id = %s", (venue_id,)).fetchone() is not None


def request_status(conn: psycopg.Connection, me: dict | None, venue_id: int) -> dict:
    count = conn.execute("SELECT count(*)::int AS n FROM venue_requests WHERE venue_id = %s", (venue_id,)).fetchone()["n"]
    mine = bool(me) and conn.execute(
        "SELECT 1 FROM venue_requests WHERE venue_id = %s AND user_id = %s", (venue_id, me["id"])
    ).fetchone() is not None
    return {"has_business": _has_business(conn, venue_id), "count": count, "mine": mine}


def ask_business(conn: psycopg.Connection, user: dict, venue_id: int, now: datetime) -> dict:
    if user.get("role") == "business":
        raise RequestError("İşletme hesapları haber veremez.", 403)
    venue = conn.execute(
        "SELECT name, contact_email, requests_mailed FROM venues WHERE id = %s FOR UPDATE", (venue_id,)
    ).fetchone()
    if venue is None:
        raise RequestError("Mekan bulunamadı.", 404)
    if _has_business(conn, venue_id):
        raise RequestError("Bu mekan zaten availy'de.", 409)
    conn.execute(
        "INSERT INTO venue_requests (venue_id, user_id, created_at) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
        (venue_id, user["id"], now),
    )
    status = request_status(conn, user, venue_id)
    reached = [n for n in MAIL_AT if venue["requests_mailed"] < n <= status["count"]]
    if reached and venue["contact_email"]:
        send_email(
            venue["contact_email"],
            f"{status['count']} kişi {venue['name']}'i availy'de bekliyor",
            f"Merhaba,\n\n{status['count']} availy kullanıcısı {venue['name']} için \"İşletmeye haber ver\" dedi. "
            "Bu kişiler mekanınızın anlık doluluğunu görmek, kampanyalarınızdan ve sadakat programınızdan "
            "haberdar olmak istiyor.\n\nİşletme hesabını ücretsiz açmak için availy uygulamasında "
            "\"İşletme\" ile kayıt olup mekanınızı seçebilirsiniz.\n\navaily",
        )
        conn.execute("UPDATE venues SET requests_mailed = %s WHERE id = %s", (status["count"], venue_id))
    return status
