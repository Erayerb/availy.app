"""v2 "Verilerimi indir" (KVKK): everything the server keeps about the signed-in person, as one JSON file.

Secrets are left out (password hash, session tokens, e-mail codes); the phone number is only said to be
saved, since only an irreversible hash of it is kept.
"""
from datetime import datetime

import psycopg


def _rows(conn: psycopg.Connection, sql: str, user_id: int) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, {"me": user_id}).fetchall()]


def export_my_data(conn: psycopg.Connection, me: dict, now: datetime) -> dict:
    uid = me["id"]
    account = conn.execute(
        """
        SELECT email, username, name, role, created_at, email_verified, customer_code, share_checkins,
               show_in_leaderboard, searchable, suggest_by_venues, regular_public, frozen,
               phone_hash IS NOT NULL AS phone_saved,
               (SELECT username FROM users i WHERE i.id = u.invited_by) AS invited_by
        FROM users u WHERE id = %(me)s
        """,
        {"me": uid},
    ).fetchone()
    return {
        "exported_at": now.isoformat(),
        "account": dict(account),
        "checkins": _rows(
            conn,
            """
            SELECT c.created_at, v.name AS venue, c.level, c.queue, c.seats, c.is_first, c.is_private, c.note
            FROM checkins c JOIN venues v ON v.id = c.venue_id WHERE c.user_id = %(me)s ORDER BY c.created_at
            """,
            uid,
        ),
        "points": _rows(conn, "SELECT created_at, amount, reason FROM points WHERE user_id = %(me)s ORDER BY created_at", uid),
        "reviews": _rows(
            conn,
            """
            SELECT r.created_at, v.name AS venue, r.rating, r.body, r.allow_replies
            FROM reviews r JOIN venues v ON v.id = r.venue_id WHERE r.user_id = %(me)s ORDER BY r.created_at
            """,
            uid,
        ),
        "replies": _rows(
            conn,
            """
            SELECT p.created_at, v.name AS venue, p.body
            FROM review_replies p JOIN reviews r ON r.id = p.review_id JOIN venues v ON v.id = r.venue_id
            WHERE p.user_id = %(me)s ORDER BY p.created_at
            """,
            uid,
        ),
        "checkin_comments": _rows(
            conn, "SELECT created_at, body FROM checkin_comments WHERE user_id = %(me)s ORDER BY created_at", uid
        ),
        "favorites": _rows(
            conn,
            "SELECT f.created_at, v.name AS venue FROM favorites f JOIN venues v ON v.id = f.venue_id WHERE f.user_id = %(me)s ORDER BY f.created_at",
            uid,
        ),
        "checkin_likes": _rows(conn, "SELECT created_at FROM checkin_likes WHERE user_id = %(me)s ORDER BY created_at", uid),
        "friends": _rows(
            conn,
            """
            SELECT u.username, f.status, f.created_at, f.accepted_at, f.requester_id = %(me)s AS i_asked
            FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = %(me)s THEN f.addressee_id ELSE f.requester_id END
            WHERE %(me)s IN (f.requester_id, f.addressee_id) ORDER BY f.created_at
            """,
            uid,
        ),
        "groups": _rows(
            conn,
            """
            SELECT g.name, m.status, m.created_at FROM group_members m JOIN groups g ON g.id = m.group_id
            WHERE m.user_id = %(me)s ORDER BY m.created_at
            """,
            uid,
        ),
        "blocked": _rows(
            conn,
            "SELECT u.username, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = %(me)s",
            uid,
        ),
        "muted": _rows(
            conn, "SELECT u.username, m.created_at FROM mutes m JOIN users u ON u.id = m.muted_id WHERE m.muter_id = %(me)s", uid
        ),
        "coupons": _rows(
            conn, "SELECT code, claimed_at, redeemed_at FROM coupons WHERE user_id = %(me)s ORDER BY claimed_at", uid
        ),
        "loyalty_cards": _rows(
            conn,
            """
            SELECT v.name AS venue, m.joined_at, m.stamps, m.rewards, m.total_stamps
            FROM loyalty_members m JOIN venues v ON v.id = m.venue_id WHERE m.user_id = %(me)s
            """,
            uid,
        ),
        "rewards_from_venues": _rows(
            conn,
            """
            SELECT v.name AS venue, w.message, w.created_at
            FROM discoverer_rewards w JOIN venues v ON v.id = w.venue_id WHERE w.user_id = %(me)s
            """,
            uid,
        ),
        "venue_requests": _rows(
            conn,
            "SELECT v.name AS venue, q.created_at FROM venue_requests q JOIN venues v ON v.id = q.venue_id WHERE q.user_id = %(me)s",
            uid,
        ),
        "reports": _rows(conn, "SELECT reason, created_at FROM reports WHERE reporter_id = %(me)s", uid),
        "support_messages": _rows(
            conn, "SELECT kind, topic, body, email, created_at FROM support_messages WHERE user_id = %(me)s", uid
        ),
        "venues_added": _rows(conn, "SELECT name, category, created_at FROM venues WHERE added_by = %(me)s", uid),
    }
