"""v2 Çalışan hesapları: a business invites its staff with a code. They keep their own personal account and
only work the counter of that venue (coupon and loyalty QR): no statistics, campaigns, reviews or settings."""
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

import psycopg

INVITE_DAYS = 7
MAX_STAFF = 20
# No 0/O, 1/I, 8/B (read out over the counter)
ALPHABET = "23456789ACDEFGHJKLMNPQRSTUVWXYZ"
CODE_LENGTH = 5
# A short code must not be guessable: wrong tries per person per hour (one server, so kept in memory)
MAX_WRONG_TRIES = 10
_wrong_tries: dict[int, list[datetime]] = {}


@dataclass
class StaffError(Exception):
    message: str
    status: int = 400


def _owner_venue(user: dict) -> int:
    if user.get("role") != "business" or not user.get("venue_id"):
        raise StaffError("Bu işlem işletme hesabı içindir.", 403)
    return user["venue_id"]


def staff_venue(conn: psycopg.Connection, user_id: int) -> int | None:
    row = conn.execute("SELECT venue_id FROM venue_staff WHERE user_id = %s", (user_id,)).fetchone()
    return row["venue_id"] if row else None


def counter_venue(conn: psycopg.Connection, user: dict) -> int | None:
    """The venue whose counter this person works: their own business, or where they are staff."""
    if user.get("role") == "business":
        return user.get("venue_id")
    return staff_venue(conn, user["id"])


def log_counter(conn: psycopg.Connection, venue_id: int, user: dict, kind: str, now: datetime) -> None:
    conn.execute(
        "INSERT INTO counter_actions (venue_id, user_id, kind, created_at) VALUES (%s, %s, %s, %s)",
        (venue_id, user["id"], kind, now),
    )


def create_invite(conn: psycopg.Connection, user: dict, now: datetime) -> dict:
    venue_id = _owner_venue(user)
    count = conn.execute("SELECT count(*) AS n FROM venue_staff WHERE venue_id = %s", (venue_id,)).fetchone()["n"]
    if count >= MAX_STAFF:
        raise StaffError(f"En fazla {MAX_STAFF} çalışan ekleyebilirsin.", 409)
    while True:
        code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
        if not conn.execute("SELECT 1 FROM staff_invites WHERE code = %s", (code,)).fetchone():
            break
    expires = now + timedelta(days=INVITE_DAYS)
    conn.execute(
        "INSERT INTO staff_invites (code, venue_id, created_at, expires_at) VALUES (%s, %s, %s, %s)",
        (code, venue_id, now, expires),
    )
    return {"code": code, "expires_at": expires}


def my_staff(conn: psycopg.Connection, user: dict) -> list[dict]:
    """The owner's list: who, since when, and what they did at the counter."""
    venue_id = _owner_venue(user)
    return conn.execute(
        """
        SELECT u.id, u.username, s.joined_at,
               count(*) FILTER (WHERE a.kind = 'coupon')::int AS coupons,
               count(*) FILTER (WHERE a.kind = 'stamp')::int AS stamps,
               count(*) FILTER (WHERE a.kind = 'reward')::int AS rewards
        FROM venue_staff s JOIN users u ON u.id = s.user_id
        LEFT JOIN counter_actions a ON a.user_id = s.user_id AND a.venue_id = s.venue_id
        WHERE s.venue_id = %s
        GROUP BY u.id, u.username, s.joined_at ORDER BY s.joined_at
        """,
        (venue_id,),
    ).fetchall()


def remove_staff(conn: psycopg.Connection, user: dict, staff_id: int) -> None:
    conn.execute("DELETE FROM venue_staff WHERE user_id = %s AND venue_id = %s", (staff_id, _owner_venue(user)))


def join_with_code(conn: psycopg.Connection, user: dict, raw_code: str, now: datetime) -> dict:
    if user.get("role") == "business" or user.get("is_guest"):
        raise StaffError("Çalışan olmak için bireysel bir hesapla giriş yapmalısın.", 403)
    tries = [t for t in _wrong_tries.get(user["id"], []) if t > now - timedelta(hours=1)]
    if len(tries) >= MAX_WRONG_TRIES:
        raise StaffError("Çok fazla yanlış kod denedin; bir saat sonra tekrar dene.", 429)
    code = "".join(raw_code.split()).upper()
    invite = conn.execute("SELECT * FROM staff_invites WHERE code = %s FOR UPDATE", (code,)).fetchone()
    if invite is None or invite["used_at"] is not None or invite["expires_at"] <= now:
        _wrong_tries[user["id"]] = [*tries, now]
        raise StaffError("Bu kod geçersiz ya da süresi dolmuş. İşletmeden yeni kod iste.", 404)
    if staff_venue(conn, user["id"]) is not None:
        raise StaffError("Zaten bir mekanda çalışan olarak kayıtlısın; önce oradan ayrıl.", 409)
    conn.execute("UPDATE staff_invites SET used_at = %s WHERE code = %s", (now, code))
    conn.execute(
        "INSERT INTO venue_staff (user_id, venue_id, joined_at) VALUES (%s, %s, %s)", (user["id"], invite["venue_id"], now)
    )
    return my_workplace(conn, user)


def my_workplace(conn: psycopg.Connection, user: dict) -> dict | None:
    """Where this person is staff, with what the counter needs."""
    return conn.execute(
        """
        SELECT v.id AS venue_id, v.name AS venue_name, s.joined_at,
               p.kind = 'stamps' AND p.active AS has_stamps
        FROM venue_staff s JOIN venues v ON v.id = s.venue_id
        LEFT JOIN loyalty_programs p ON p.venue_id = s.venue_id
        WHERE s.user_id = %s
        """,
        (user["id"],),
    ).fetchone()


def leave_workplace(conn: psycopg.Connection, user: dict) -> None:
    conn.execute("DELETE FROM venue_staff WHERE user_id = %s", (user["id"],))
