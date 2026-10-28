"""v2 venue reviews (stars + comment) and replies to them, kept on the server.

Only registered users write; anyone can read. At most two reviews per person and venue. Replies are allowed when the review's author allows them.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta

import psycopg

from app.safety import BLOCKED, FROZEN, MUTED, hidden_reply, hidden_review

MAX_BODY = 280
MAX_REVIEWS_PER_CHECKIN = 2  # each check-in at a venue allows 2 reviews there
MAX_REPLIES_PER_PERSON = 2  # replies one person may write under one review
FEED_DAYS = 3  # Akış shows this many days; "Daha eski" asks for up to MAX_FEED_DAYS
MAX_FEED_DAYS = 7
# My own Akış: the last 7 days, "Daha eski" up to 30
MAX_MY_FEED_DAYS = 30
PLAIN_CHECKIN_DAYS = 2  # a check-in with no words, likes or comments leaves Akış after this
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


def save_review(
    conn: psycopg.Connection,
    user: dict,
    venue_id: int,
    rating: int,
    body: str,
    allow_replies: bool,
    now: datetime,
    checkin_id: int | None = None,
) -> dict:
    """`checkin_id`: written right after that check-in ("Burası nasıl?"); it shows with the check-in in Akış."""
    _require_registered(user, "Yorum yazmak")
    if user.get("role") == "business":
        raise ReviewError("İşletme hesapları yorum yazamaz; yorumlara yanıt verebilir.", 403)
    if rating not in range(1, 6):
        raise ReviewError("Puan seç (1–5).")
    if conn.execute("SELECT 1 FROM venues WHERE id = %s", (venue_id,)).fetchone() is None:
        raise ReviewError("Mekan bulunamadı.", 404)
    text = _clean(body)
    allowed = review_allowance(conn, user["id"], venue_id)
    if allowed["checkins"] == 0:
        raise ReviewError("Yorum yazmak için önce bu mekana check-in yap.", 403)
    if allowed["left"] <= 0:
        raise ReviewError(
            f"Her check-in için en fazla {MAX_REVIEWS_PER_CHECKIN} yorum yazabilirsin. Yeni yorum için tekrar check-in yap.", 409
        )
    if checkin_id is not None and conn.execute(
        "SELECT 1 FROM checkins WHERE id = %s AND user_id = %s AND venue_id = %s", (checkin_id, user["id"], venue_id)
    ).fetchone() is None:
        raise ReviewError("Check-in bulunamadı.", 404)
    return conn.execute(
        """
        INSERT INTO reviews (venue_id, user_id, rating, body, allow_replies, created_at, checkin_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (venue_id, user["id"], rating, text, allow_replies, now, checkin_id),
    ).fetchone()


def edit_review(conn: psycopg.Connection, user: dict, review_id: int, rating: int, body: str) -> int:
    """Changes my review's stars and words; returns its venue."""
    if rating not in range(1, 6):
        raise ReviewError("Puan seç (1–5).")
    row = conn.execute(
        "UPDATE reviews SET rating = %s, body = %s WHERE id = %s AND user_id = %s RETURNING venue_id",
        (rating, _clean(body), review_id, user["id"]),
    ).fetchone()
    if row is None:
        raise ReviewError("Yorum bulunamadı.", 404)
    return row["venue_id"]


def review_allowance(conn: psycopg.Connection, user_id: int, venue_id: int) -> dict:
    """How many check-ins the user has at the venue and how many reviews they may still write there."""
    row = conn.execute(
        """
        SELECT (SELECT count(*) FROM checkins WHERE venue_id = %(v)s AND user_id = %(u)s AND NOT is_demo)::int AS checkins,
               (SELECT count(*) FROM reviews WHERE venue_id = %(v)s AND user_id = %(u)s)::int AS written
        """,
        {"v": venue_id, "u": user_id},
    ).fetchone()
    return {"checkins": row["checkins"], "left": row["checkins"] * MAX_REVIEWS_PER_CHECKIN - row["written"]}


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
    written = conn.execute(
        "SELECT count(*)::int AS n FROM review_replies WHERE review_id = %s AND user_id = %s", (review_id, user["id"])
    ).fetchone()["n"]
    if written >= MAX_REPLIES_PER_PERSON:
        raise ReviewError(f"Bir yoruma en fazla {MAX_REPLIES_PER_PERSON} yanıt yazabilirsin.", 409)
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
        # For the form: none for visitors without an account
        "allowance": review_allowance(conn, me["id"], venue_id) if me else None,
    }


def friend_feed(
    conn: psycopg.Connection, me: dict, now: datetime, days: int = FEED_DAYS, who: str = "friends"
) -> list[dict]:
    """Activity of the last `days` days (friends: 3, up to 7; mine: 7, up to 30 with "Daha eski"), newest first: check-ins, reviews
    and replies. who="friends" (Sosyal > Arkadaşlarım): friends' public ones, a bare check-in (no words,
    likes or comments) stays 2 days. who="me" (Sosyal > Akış): all of mine, with friends' likes and comments."""
    days = max(1, min(days, MAX_MY_FEED_DAYS if who == "me" else MAX_FEED_DAYS))
    params = {
        "me": me["id"],
        "since": now - timedelta(days=days),
        "plain_since": now - timedelta(days=PLAIN_CHECKIN_DAYS),
        "limit": FEED_LIMIT * (days // FEED_DAYS + 1),
    }
    # Friends, without the ones I muted
    friends = f"""
        SELECT CASE WHEN requester_id = %(me)s THEN addressee_id ELSE requester_id END
        FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)
        EXCEPT {MUTED} EXCEPT {FROZEN}
    """
    if who == "me":
        checkin_who, author_in = "c.user_id = %(me)s", "= %(me)s"
        plain, shared = "true", "true"
    else:
        checkin_who, author_in = f"c.user_id IN ({friends}) AND u.share_checkins AND NOT c.is_private", f"IN ({friends})"
        # Older than 2 days: only check-ins with something to look at
        plain = """(c.created_at > %(plain_since)s OR rv.id IS NOT NULL OR c.note IS NOT NULL
                   OR EXISTS (SELECT 1 FROM checkin_likes l WHERE l.checkin_id = c.id)
                   OR EXISTS (SELECT 1 FROM checkin_comments k WHERE k.checkin_id = c.id))"""
        shared = "NOT c2.is_private AND u.share_checkins"
    return conn.execute(
        f"""
        SELECT * FROM (
            -- A review written right after the check-in shows with it (older check-ins may have a note)
            SELECT 'checkin' AS kind, c.created_at AS at, u.username, v.id AS venue_id, v.name AS venue_name,
                   c.is_first, (SELECT COALESCE(sum(p.amount), 0) FROM points p WHERE p.checkin_id = c.id)::int AS points,
                   rv.rating, COALESCE(rv.body, c.note) AS body, NULL AS review_author,
                   rv.id AS review_id, COALESCE(rv.allow_replies, false) AS allow_replies, c.id AS checkin_id
            FROM checkins c JOIN users u ON u.id = c.user_id JOIN venues v ON v.id = c.venue_id
            LEFT JOIN LATERAL (
                SELECT r.id, r.rating, r.body, r.allow_replies FROM reviews r
                WHERE r.checkin_id = c.id AND NOT {hidden_review("r")} ORDER BY r.created_at DESC LIMIT 1
            ) rv ON true
            WHERE {checkin_who} AND NOT c.is_demo AND c.created_at > %(since)s AND {plain}
            UNION ALL
            SELECT 'review', r.created_at, u.username, v.id, v.name, false, 0, r.rating, r.body, NULL,
                   r.id, r.allow_replies, NULL::bigint
            FROM reviews r JOIN users u ON u.id = r.user_id JOIN venues v ON v.id = r.venue_id
            WHERE r.user_id {author_in} AND r.created_at > %(since)s AND NOT {hidden_review("r")}
              -- Already shown with its check-in
              AND NOT EXISTS (
                  SELECT 1 FROM checkins c2 WHERE c2.id = r.checkin_id AND NOT c2.is_demo AND {shared}
              )
            UNION ALL
            SELECT 'reply', p.created_at, u.username, v.id, v.name, false, 0, NULL, p.body, a.username,
                   r.id, r.allow_replies, NULL::bigint
            FROM review_replies p JOIN users u ON u.id = p.user_id JOIN reviews r ON r.id = p.review_id
            JOIN users a ON a.id = r.user_id JOIN venues v ON v.id = r.venue_id
            WHERE p.user_id {author_in} AND p.created_at > %(since)s AND NOT {hidden_reply("p")}
              AND r.user_id NOT IN {BLOCKED}
        ) feed
        ORDER BY at DESC LIMIT %(limit)s
        """,
        params,
    ).fetchall()


def replies_for(conn: psycopg.Connection, me: dict, review_ids: list[int]) -> dict[int, list[dict]]:
    """Replies under these reviews (oldest first): shown attached to my posts in Akış."""
    if not review_ids:
        return {}
    out: dict[int, list[dict]] = {}
    for r in conn.execute(
        f"""
        SELECT p.id, p.review_id, u.username, p.body, p.created_at AS at, p.user_id = %(me)s AS mine
        FROM review_replies p JOIN users u ON u.id = p.user_id
        WHERE p.review_id = ANY(%(ids)s) AND p.user_id NOT IN {BLOCKED} AND NOT {hidden_reply("p")}
        ORDER BY p.created_at
        """,
        {"ids": review_ids, "me": me["id"]},
    ).fetchall():
        out.setdefault(r.pop("review_id"), []).append(r)
    return out
