"""'Şu an burada' photos: taken with the camera at check-in, shown on the venue page until an hour after
the venue closes (24 hours for places open all day).

Rules: only for one's own fresh check-in at the venue (the check-in itself proved the person was there),
one photo per check-in, at most MAX_PER_DAY a day. 'friends' photos are seen only by the author's friends.
Two reports hide a photo until an admin restores or removes it; removal takes the points back.
Expired photos are deleted when photos are next saved or read (no timed job).
"""
import base64
from datetime import datetime, timedelta

import psycopg

from app.hours import next_closing, venue_hours
from app.moderation import require_admin
from app.safety import BLOCKED
from app.venue_profiles import MAX_PHOTO_BYTES, PHOTO_PATTERN

LIFETIME = timedelta(hours=24)  # places open all day
AFTER_CLOSING = timedelta(hours=1)
# The photo belongs to the moment of the check-in: it has to be sent soon after
CHECKIN_WINDOW = timedelta(minutes=30)
MAX_PER_DAY = 5
POINTS = 5
REPORTS_TO_HIDE = 2
REASONS = {"inappropriate", "person", "unrelated", "spam"}

FRIENDS_OF = """(SELECT addressee_id FROM friendships WHERE requester_id = %(me)s AND status = 'accepted'
                 UNION SELECT requester_id FROM friendships WHERE addressee_id = %(me)s AND status = 'accepted')"""


class MomentError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def delete_expired(conn: psycopg.Connection, now: datetime) -> None:
    conn.execute("DELETE FROM moment_photos WHERE expires_at <= %s", (now,))


def save_moment(conn: psycopg.Connection, user: dict, checkin_id: int, data_uri: str, audience: str | None, now: datetime) -> dict:
    if user["is_guest"]:
        raise MomentError("Fotoğraf paylaşmak için kayıt ol.", 403)
    checkin = conn.execute(
        "SELECT id, venue_id, user_id, created_at, is_private FROM checkins WHERE id = %s", (checkin_id,)
    ).fetchone()
    if checkin is None or checkin["user_id"] != user["id"]:
        raise MomentError("Check-in bulunamadı.", 404)
    if now - checkin["created_at"] > CHECKIN_WINDOW:
        raise MomentError("Fotoğraf check-in anında çekilmeli.")
    match = PHOTO_PATTERN.match(data_uri.strip())
    if not match:
        raise MomentError("Fotoğraf okunamadı (JPEG ya da PNG olmalı).")
    if len(base64.b64decode(match.group(2), validate=True)) > MAX_PHOTO_BYTES:
        raise MomentError("Fotoğraf çok büyük.")
    today = conn.execute(
        "SELECT count(*) AS n FROM moment_photos WHERE user_id = %s AND created_at > %s", (user["id"], now - timedelta(days=1))
    ).fetchone()["n"]
    if today >= MAX_PER_DAY:
        raise MomentError(f"Günde en fazla {MAX_PER_DAY} fotoğraf paylaşabilirsin.", 429)
    if audience not in ("everyone", "friends"):
        audience = conn.execute("SELECT moment_audience FROM users WHERE id = %s", (user["id"],)).fetchone()["moment_audience"]
    delete_expired(conn, now)
    # Gone an hour after the venue closes today (a photo of the room means nothing the next day)
    venue = conn.execute(
        "SELECT category, open_hour, close_hour, always_busy FROM venues WHERE id = %s", (checkin["venue_id"],)
    ).fetchone()
    closing = next_closing(venue_hours(venue), now)
    expires = min(now + LIFETIME, closing + AFTER_CLOSING) if closing else now + LIFETIME
    try:
        with conn.transaction():
            row = conn.execute(
                """
                INSERT INTO moment_photos (checkin_id, venue_id, user_id, photo, audience, created_at, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, created_at, expires_at, audience
                """,
                (checkin_id, checkin["venue_id"], user["id"], data_uri.strip(), audience, now, expires),
            ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise MomentError("Bu check-in'e zaten fotoğraf ekledin.", 409) from None
    conn.execute(
        "INSERT INTO points (user_id, amount, reason, checkin_id, moment_id, created_at) VALUES (%s, %s, 'moment', %s, %s, %s)",
        (user["id"], POINTS, checkin_id, row["id"], now),
    )
    return {**row, "points": POINTS}


def venue_moments(conn: psycopg.Connection, venue_id: int, viewer: dict | None, now: datetime) -> list[dict]:
    """Live photos of a venue, newest first, that this viewer may see."""
    me = viewer["id"] if viewer else None
    return conn.execute(
        f"""
        SELECT m.id, m.created_at, m.expires_at, m.audience, c.level, COALESCE(m.user_id = %(me)s, false) AS mine,
               CASE WHEN c.is_private THEN NULL ELSE u.username END AS username
        FROM moment_photos m JOIN checkins c ON c.id = m.checkin_id JOIN users u ON u.id = m.user_id
        WHERE m.venue_id = %(venue)s AND m.expires_at > %(now)s AND m.hidden_at IS NULL AND NOT u.frozen
          AND (%(me)s::bigint IS NULL OR u.id NOT IN {BLOCKED})
          AND (m.audience = 'everyone' OR m.user_id = %(me)s OR m.user_id IN {FRIENDS_OF})
        ORDER BY m.created_at DESC
        """,
        {"venue": venue_id, "now": now, "me": me},
    ).fetchall()


def moment_image(conn: psycopg.Connection, photo_id: int, viewer: dict | None, now: datetime) -> tuple[str, bytes] | None:
    me = viewer["id"] if viewer else None
    row = conn.execute(
        f"""
        SELECT m.photo FROM moment_photos m
        WHERE m.id = %(id)s AND m.expires_at > %(now)s
          AND (m.hidden_at IS NULL OR m.user_id = %(me)s OR %(admin)s)
          AND (m.audience = 'everyone' OR m.user_id = %(me)s OR m.user_id IN {FRIENDS_OF} OR %(admin)s)
        """,
        {"id": photo_id, "now": now, "me": me, "admin": bool(viewer and viewer.get("is_admin"))},
    ).fetchone()
    if row is None:
        return None
    match = PHOTO_PATTERN.match(row["photo"])
    return (match.group(1), base64.b64decode(match.group(2))) if match else None


def delete_moment(conn: psycopg.Connection, user: dict, photo_id: int) -> None:
    """The author takes their photo down (the points stay: it was a real moment)."""
    done = conn.execute("DELETE FROM moment_photos WHERE id = %s AND user_id = %s", (photo_id, user["id"])).rowcount
    if not done:
        raise MomentError("Fotoğraf bulunamadı.", 404)


def report_moment(conn: psycopg.Connection, user: dict, photo_id: int, reason: str, now: datetime) -> None:
    if reason not in REASONS:
        raise MomentError("Bir sebep seç.")
    photo = conn.execute("SELECT user_id FROM moment_photos WHERE id = %s AND expires_at > %s", (photo_id, now)).fetchone()
    if photo is None:
        raise MomentError("Fotoğraf bulunamadı.", 404)
    if photo["user_id"] == user["id"]:
        raise MomentError("Kendi fotoğrafını silebilirsin.")
    conn.execute(
        "INSERT INTO moment_reports (photo_id, user_id, reason, created_at) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING",
        (photo_id, user["id"], reason, now),
    )
    reports = conn.execute("SELECT count(*) AS n FROM moment_reports WHERE photo_id = %s", (photo_id,)).fetchone()["n"]
    if reports >= REPORTS_TO_HIDE:
        conn.execute("UPDATE moment_photos SET hidden_at = %s WHERE id = %s AND hidden_at IS NULL", (now, photo_id))


def reported_moments(conn: psycopg.Connection, admin: dict, now: datetime) -> list[dict]:
    require_admin(admin)
    return conn.execute(
        """
        SELECT m.id, m.created_at, m.hidden_at, v.name AS venue_name, v.id AS venue_id, u.username AS author,
               count(r.*)::int AS reports, array_agg(DISTINCT r.reason) AS reasons
        FROM moment_photos m JOIN moment_reports r ON r.photo_id = m.id
        JOIN venues v ON v.id = m.venue_id JOIN users u ON u.id = m.user_id
        WHERE m.expires_at > %s
        GROUP BY m.id, v.name, v.id, u.username
        ORDER BY (m.hidden_at IS NOT NULL) DESC, count(r.*) DESC, m.created_at DESC
        """,
        (now,),
    ).fetchall()


def decide_moment(conn: psycopg.Connection, admin: dict, photo_id: int, keep: bool) -> None:
    """Restore (reports cleared) or remove (the photo and its points go)."""
    require_admin(admin)
    if keep:
        conn.execute("UPDATE moment_photos SET hidden_at = NULL WHERE id = %s", (photo_id,))
        conn.execute("DELETE FROM moment_reports WHERE photo_id = %s", (photo_id,))
    else:
        conn.execute("DELETE FROM points WHERE moment_id = %s", (photo_id,))
        conn.execute("DELETE FROM moment_photos WHERE id = %s", (photo_id,))


def load_moment_counts(conn: psycopg.Connection, venue_ids: list[int], now: datetime) -> dict[int, int]:
    """Live photos anyone may see, per venue: the 📸 on the home tile and the map card."""
    if not venue_ids:
        return {}
    rows = conn.execute(
        """
        SELECT m.venue_id, count(*)::int AS n FROM moment_photos m JOIN users u ON u.id = m.user_id
        WHERE m.venue_id = ANY(%s) AND m.expires_at > %s AND m.hidden_at IS NULL AND m.audience = 'everyone' AND NOT u.frozen
        GROUP BY m.venue_id
        """,
        (venue_ids, now),
    ).fetchall()
    return {r["venue_id"]: r["n"] for r in rows}
