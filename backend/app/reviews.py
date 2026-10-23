"""v2 venue reviews (stars + comment) and replies to them, kept on the server.

Only registered users write; anyone can read. At most two reviews per person and venue. Replies are allowed when the review's author allows them.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta

import psycopg

from app.safety import BLOCKED, FROZEN, MUTED, hidden_reply, hidden_review

MAX_BODY = 280
MAX_REVIEWS_PER_VENUE = 2
FEED_DAYS = 7
FEED_LIMIT = 50


@dataclass
class ReviewError(Exception):
    message: str
    status: int = 400


def _require_registered(user: dict, what: str) -> None:
    if user["is_guest"]:
        raise ReviewError(f"{what} için kayıt ol.", 403)


def _clean(body: str) -> str:
    text = body.strip()
    if len(text) > MAX_BODY:
        raise ReviewError(f"En fazla {MAX_BODY} karakter yazabilirsin.")
    return text


def save_review(conn: psycopg.Connection, user: dict, venue_id: int, rating: int, body: str, allow_replies: bool, now: datetime) -> dict:
    _require_registered(user, "Yorum yazmak")
    if user.get("role") == "business":
        raise ReviewError("İşletme hesapları yorum yazamaz; yorumlara yanıt verebilir.", 403)
    if rating not in range(1, 6):
        raise ReviewError("Puan seç (1–5).")
    if conn.execute("SELECT 1 FROM venues WHERE id = %s", (venue_id,)).fetchone() is None:
        raise ReviewError("Mekan bulunamadı.", 404)
    text = _clean(body)
    written = conn.execute(
        "SELECT count(*) AS n FROM reviews WHERE venue_id = %s AND user_id = %s", (venue_id, user["id"])
    ).fetchone()["n"]
    if written >= MAX_REVIEWS_PER_VENUE:
        raise ReviewError(f"Bir mekana en fazla {MAX_REVIEWS_PER_VENUE} yorum yazabilirsin. Yenisi için birini sil.", 409)
    return conn.execute(
        """
        INSERT INTO reviews (venue_id, user_id, rating, body, allow_replies, created_at)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (venue_id, user["id"], rating, text, allow_replies, now),
    ).fetchone()


def delete_review(conn: psycopg.Connection, user: dict, review_id: int) -> None:
    conn.execute("DELETE FROM reviews WHERE id = %s AND user_id = %s", (review_id, user["id"]))


def add_reply(conn: psycopg.Connection, user: dict, review_id: int, body: str, now: datetime) -> dict:
    _require_registered(user, "Yanıt yazmak")
    review = conn.execute("SELECT user_id, venue_id, allow_replies FROM reviews WHERE id = %s", (review_id,)).fetchone()
    if review is None:
        raise ReviewError("Yorum bulunamadı.", 404)
    from app.safety import is_blocked_between

    if is_blocked_between(conn, user["id"], review["user_id"]):
        raise ReviewError("Bu yoruma yanıt verilemiyor.", 403)
    owner = user.get("role") == "business" and user.get("venue_id") == review["venue_id"]
    # Businesses answer only on their own venue (not on competitors')
    if user.get("role") == "business" and not owner:
        raise ReviewError("İşletme hesabıyla yalnızca kendi mekanının yorumlarını yanıtlayabilirsin.", 403)
    # The author, and the venue's business, can always answer
    if not review["allow_replies"] and review["user_id"] != user["id"] and not owner:
        raise ReviewError("Bu yoruma yanıt verilemiyor.", 403)
    text = _clean(body)
    if not text:
        raise ReviewError("Yanıt boş olamaz.")
    return conn.execute(
        "INSERT INTO review_replies (review_id, user_id, body, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
        (review_id, user["id"], text, now),
    ).fetchone()


def delete_reply(conn: psycopg.Connection, user: dict, reply_id: int) -> None:
    conn.execute("DELETE FROM review_replies WHERE id = %s AND user_id = %s", (reply_id, user["id"]))


def venue_reviews(conn: psycopg.Connection, venue_id: int, me: dict | None) -> dict:
    """Average, count and the reviews (newest first) with their replies (oldest first)."""
    # Without an account: no blocks or own reports, only the "reported too often" rule
    my_id = me["id"] if me else -1
    reviews = conn.execute(
        f"""
        SELECT r.id, r.rating, r.body, r.allow_replies, r.created_at, u.username, r.user_id = %(me)s AS mine
        FROM reviews r JOIN users u ON u.id = r.user_id
        WHERE r.venue_id = %(venue)s AND r.user_id NOT IN {BLOCKED} AND NOT {hidden_review("r")}
        ORDER BY r.created_at DESC
        """,
        {"me": my_id, "venue": venue_id},
    ).fetchall()
    replies = conn.execute(
        f"""
        SELECT p.id, p.review_id, p.body, p.created_at, u.username, p.user_id = %(me)s AS mine,
               (u.role = 'business' AND u.venue_id = r.venue_id) AS is_business
        FROM review_replies p JOIN users u ON u.id = p.user_id JOIN reviews r ON r.id = p.review_id
        WHERE p.review_id = ANY(%(ids)s) AND p.user_id NOT IN {BLOCKED} AND NOT {hidden_reply("p")}
        ORDER BY p.created_at
        """,
        {"me": my_id, "ids": [r["id"] for r in reviews]},
    ).fetchall()
    by_review: dict[int, list[dict]] = {}
    for reply in replies:
        by_review.setdefault(reply.pop("review_id"), []).append(reply)
    average = round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else None
    return {
        "average": average,
        "count": len(reviews),
        "items": [{**r, "replies": by_review.get(r["id"], [])} for r in reviews],
    }


def friend_feed(conn: psycopg.Connection, me: dict, now: datetime) -> list[dict]:
    """Friends' activity of the last 7 days, newest first: public check-ins, reviews and replies."""
    params = {"me": me["id"], "since": now - timedelta(days=FEED_DAYS), "limit": FEED_LIMIT}
    # Friends, without the ones I muted
    friends = f"""
        SELECT CASE WHEN requester_id = %(me)s THEN addressee_id ELSE requester_id END
        FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)
        EXCEPT {MUTED} EXCEPT {FROZEN}
    """
    return conn.execute(
        f"""
        SELECT * FROM (
            SELECT 'checkin' AS kind, c.created_at AS at, u.username, v.id AS venue_id, v.name AS venue_name,
                   c.is_first, (SELECT COALESCE(sum(p.amount), 0) FROM points p WHERE p.checkin_id = c.id)::int AS points,
                   NULL::smallint AS rating, NULL AS body, NULL AS review_author,
                   NULL::bigint AS review_id, false AS allow_replies
            FROM checkins c JOIN users u ON u.id = c.user_id JOIN venues v ON v.id = c.venue_id
            WHERE c.user_id IN ({friends}) AND NOT c.is_private AND NOT c.is_demo AND u.share_checkins
              AND c.created_at > %(since)s
            UNION ALL
            SELECT 'review', r.created_at, u.username, v.id, v.name, false, 0, r.rating, r.body, NULL,
                   r.id, r.allow_replies
            FROM reviews r JOIN users u ON u.id = r.user_id JOIN venues v ON v.id = r.venue_id
            WHERE r.user_id IN ({friends}) AND r.created_at > %(since)s AND NOT {hidden_review("r")}
            UNION ALL
            SELECT 'reply', p.created_at, u.username, v.id, v.name, false, 0, NULL, p.body, a.username,
                   r.id, r.allow_replies
            FROM review_replies p JOIN users u ON u.id = p.user_id JOIN reviews r ON r.id = p.review_id
            JOIN users a ON a.id = r.user_id JOIN venues v ON v.id = r.venue_id
            WHERE p.user_id IN ({friends}) AND p.created_at > %(since)s AND NOT {hidden_reply("p")}
              AND r.user_id NOT IN {BLOCKED}
        ) feed
        ORDER BY at DESC LIMIT %(limit)s
        """,
        params,
    ).fetchall()
