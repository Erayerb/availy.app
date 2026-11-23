"""v2 leaderboard (weekly / all time, friends / everyone) and in-app notifications."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.levels import level_ids
from app.safety import BLOCKED, hidden_reply, hidden_review

ISTANBUL = ZoneInfo("Europe/Istanbul")
LEADERBOARD_LIMIT = 50
NOTIFICATION_DAYS = 30


CALL_WINDOW = timedelta(minutes=90)  # "Buradayım, gel": like a check-in's own life


def week_start(now: datetime) -> datetime:
    """Monday 00:00 in Istanbul: the weekly ranking starts again then."""
    local = now.astimezone(ISTANBUL)
    return (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def last_week_winners(conn: psycopg.Connection, now: datetime) -> list[dict]:
    """"Haftanın 1.si": who finished last week first in the public ranking (a tie: all of them). No clock needed:
    the first request of the week writes it down (once), from the points of that closed week."""
    end = week_start(now)
    start = end - timedelta(days=7)
    query = """
        SELECT w.user_id, u.username FROM weekly_winners w JOIN users u ON u.id = w.user_id
        WHERE w.week_start = %s ORDER BY lower(u.username)
    """
    rows = conn.execute(query, (start.date(),)).fetchall()
    if rows:
        return rows
    conn.execute(
        """
        INSERT INTO weekly_winners (week_start, user_id, points)
        SELECT %(week)s, id, points FROM (
            SELECT u.id, sum(p.amount)::int AS points, RANK() OVER (ORDER BY sum(p.amount) DESC) AS place
            FROM users u JOIN points p ON p.user_id = u.id AND p.created_at >= %(start)s AND p.created_at < %(end)s
            WHERE u.show_in_leaderboard AND NOT u.is_guest AND u.role = 'personal' AND u.username IS NOT NULL AND NOT u.frozen
            GROUP BY u.id
        ) ranked
        WHERE place = 1 AND points > 0
        ON CONFLICT DO NOTHING
        """,
        {"week": start.date(), "start": start, "end": end},
    )
    return conn.execute(query, (start.date(),)).fetchall()


def leaderboard(conn: psycopg.Connection, me: dict, period: str, scope: str, now: datetime, group_id: int | None = None) -> dict:
    """Ranked rows (same points, same rank) and my own place, also when I am not in the list.
    `scope` "group": the members of `group_id` (the caller checks that I am one)."""
    since = week_start(now) if period == "week" else datetime.min.replace(tzinfo=ISTANBUL)
    friends = """
        SELECT CASE WHEN requester_id = %(me)s THEN addressee_id ELSE requester_id END
        FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)
    """
    # Friends: me and my friends, also with 0 points. Everyone: registered people who want to be shown
    # Group: its members
    people = (
        f"u.id = %(me)s OR (u.id IN ({friends}) AND NOT u.frozen)"
        if scope == "friends"
        else "u.id IN (SELECT user_id FROM group_members WHERE group_id = %(group)s AND status = 'member') AND NOT u.frozen"
        if scope == "group"
        else f"u.id = %(me)s OR (u.show_in_leaderboard AND NOT u.is_guest AND u.role = 'personal' AND u.username IS NOT NULL AND u.id NOT IN {BLOCKED})"
    )
    rows = conn.execute(
        f"""
        WITH scores AS (
            SELECT u.id, u.username, COALESCE(sum(p.amount), 0)::int AS points
            FROM users u LEFT JOIN points p ON p.user_id = u.id AND p.created_at >= %(since)s
            WHERE {people}
            GROUP BY u.id, u.username
        )
        SELECT id, username, points, (RANK() OVER (ORDER BY points DESC))::int AS rank
        FROM scores WHERE points > 0 OR %(friends_scope)s OR id = %(me)s
        ORDER BY points DESC, lower(username)
        """,
        {"me": me["id"], "since": since, "friends_scope": scope in ("friends", "group"), "group": group_id},
    ).fetchall()
    mine = next((r for r in rows if r["id"] == me["id"]), None)
    shown = [r for r in rows if r["id"] != me["id"] or r["points"] > 0 or scope in ("friends", "group")][:LEADERBOARD_LIMIT]
    levels = level_ids(conn, [r["username"] for r in shown if r["username"]])
    return {
        "rows": [
            {"rank": r["rank"], "username": r["username"], "points": r["points"], "me": r["id"] == me["id"], "level": levels.get(r["username"])}
            for r in shown
        ],
        "me": {"rank": mine["rank"], "points": mine["points"]} if mine else None,
        "last_week_winners": [w["username"] for w in last_week_winners(conn, now)],
    }


def notifications(conn: psycopg.Connection, me: dict, now: datetime) -> list[dict]:
    """Newest first: friend requests to me, my requests that were accepted, replies to my reviews,
    and rewards from venues I discovered (always kept: shown at the counter).

    Items stay after they are acted on (a request accepted, a program joined; `done` tells) until
    the user deletes them; "Temizle" deletes everything up to now.
    """
    rows = conn.execute(
        f"""
        SELECT * FROM (
            SELECT 'friend_request' AS kind, f.created_at AS at, u.username, NULL::bigint AS venue_id,
                   NULL AS venue_name, NULL AS body, f.status = 'accepted' AS done
            FROM friendships f JOIN users u ON u.id = f.requester_id
            WHERE f.addressee_id = %(me)s AND (f.status = 'pending' OR f.created_at > %(since)s) AND NOT u.frozen
            UNION ALL
            SELECT 'friend_accepted', f.accepted_at, u.username, NULL, NULL, NULL, false
            FROM friendships f JOIN users u ON u.id = f.addressee_id
            WHERE f.requester_id = %(me)s AND f.status = 'accepted' AND f.accepted_at > %(since)s AND NOT u.frozen
              AND u.invited_by IS DISTINCT FROM %(me)s  -- joined through my invite: "invite_joined" says it
            UNION ALL
            SELECT 'reply', p.created_at, u.username, v.id, v.name, p.body, false
            FROM review_replies p JOIN reviews r ON r.id = p.review_id JOIN users u ON u.id = p.user_id
            JOIN venues v ON v.id = r.venue_id
            WHERE r.user_id = %(me)s AND p.user_id <> %(me)s AND p.created_at > %(since)s
              AND p.user_id NOT IN {BLOCKED} AND NOT {hidden_reply("p")}
            UNION ALL
            SELECT 'reward', w.created_at, NULL, v.id, v.name, w.message, false
            FROM discoverer_rewards w JOIN venues v ON v.id = w.venue_id
            WHERE w.user_id = %(me)s
            UNION ALL
            -- Likes and comments on my check-ins
            SELECT 'checkin_like', l.created_at, u.username, v.id, v.name, NULL, false
            FROM checkin_likes l JOIN checkins c ON c.id = l.checkin_id JOIN users u ON u.id = l.user_id
            JOIN venues v ON v.id = c.venue_id
            WHERE c.user_id = %(me)s AND l.user_id <> %(me)s AND l.created_at > %(since)s AND l.user_id NOT IN {BLOCKED}
            UNION ALL
            SELECT 'checkin_comment', k.created_at, u.username, v.id, v.name, k.body, false
            FROM checkin_comments k JOIN checkins c ON c.id = k.checkin_id JOIN users u ON u.id = k.user_id
            JOIN venues v ON v.id = c.venue_id
            WHERE c.user_id = %(me)s AND k.user_id <> %(me)s AND k.created_at > %(since)s AND k.user_id NOT IN {BLOCKED}
            UNION ALL
            -- A friend at a venue: "Buradayım, gel" (not the ones I muted)
            SELECT 'come_here', k.created_at, u.username, v.id, v.name, NULL, false
            FROM come_calls k JOIN users u ON u.id = k.user_id JOIN venues v ON v.id = k.venue_id
            WHERE k.created_at > %(since)s AND NOT u.frozen AND k.user_id NOT IN {BLOCKED}
              AND k.user_id NOT IN (SELECT muted_id FROM mutes WHERE muter_id = %(me)s)
              AND k.user_id IN (
                  SELECT CASE WHEN requester_id = %(me)s THEN addressee_id ELSE requester_id END
                  FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)
              )
            UNION ALL
            -- The business: its venue is quiet ("Ölü saat"), and the campaign sent for it
            SELECT a.kind, a.created_at, NULL, v.id, v.name, c.message, false
            FROM business_alerts a JOIN venues v ON v.id = a.venue_id LEFT JOIN campaigns c ON c.id = a.campaign_id
            WHERE a.venue_id = %(venue)s AND a.created_at > %(since)s
            UNION ALL
            -- Invited to a group (done: I joined it)
            SELECT 'group_invite', m.created_at, u.username, NULL, NULL, g.name, m.status = 'member'
            FROM group_members m JOIN groups g ON g.id = m.group_id JOIN users u ON u.id = m.invited_by
            WHERE m.user_id = %(me)s AND m.created_at > %(since)s AND NOT u.frozen
            UNION ALL
            -- A venue I checked in at (or discovered) started a loyalty program (done: I joined it)
            SELECT 'loyalty', p.activated_at, NULL, v.id, v.name,
                   CASE WHEN p.kind = 'stamps' THEN p.stamps_required || ' damga = ' || p.reward
                        ELSE p.price || ' ₺/ay · ' || p.perk END,
                   EXISTS (SELECT 1 FROM loyalty_members m WHERE m.venue_id = p.venue_id AND m.user_id = %(me)s)
            FROM loyalty_programs p JOIN venues v ON v.id = p.venue_id
            WHERE p.active AND p.activated_at > %(since)s
              AND EXISTS (SELECT 1 FROM checkins c WHERE c.venue_id = p.venue_id AND c.user_id = %(me)s)
            UNION ALL
            -- A friend checked in (not a private one, not the ones I muted; "Buradayım, gel" says it already).
            -- Only the last day: older ones are news no more, and would bury everything else
            SELECT 'friend_checkin', c.created_at, u.username, v.id, v.name, NULL, false
            FROM checkins c JOIN users u ON u.id = c.user_id JOIN venues v ON v.id = c.venue_id
            WHERE c.created_at > GREATEST(%(since)s, %(now)s - interval '1 day') AND c.created_at <= %(now)s AND NOT c.is_private AND u.share_checkins
              AND NOT u.frozen AND c.user_id NOT IN {BLOCKED}
              AND c.user_id NOT IN (SELECT muted_id FROM mutes WHERE muter_id = %(me)s)
              AND NOT EXISTS (SELECT 1 FROM come_calls k WHERE k.checkin_id = c.id)
              AND c.user_id IN (
                  SELECT CASE WHEN requester_id = %(me)s THEN addressee_id ELSE requester_id END
                  FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)
              )
            UNION ALL
            -- A friend reviewed a venue (last day, like their check-ins)
            SELECT 'friend_review', r.created_at, u.username, v.id, v.name, r.rating || '★ ' || r.body, false
            FROM reviews r JOIN users u ON u.id = r.user_id JOIN venues v ON v.id = r.venue_id
            WHERE r.created_at > GREATEST(%(since)s, %(now)s - interval '1 day') AND r.created_at <= %(now)s
              AND NOT {hidden_review("r")} AND NOT u.frozen AND r.user_id NOT IN {BLOCKED}
              AND r.user_id NOT IN (SELECT muted_id FROM mutes WHERE muter_id = %(me)s)
              AND r.user_id IN (
                  SELECT CASE WHEN requester_id = %(me)s THEN addressee_id ELSE requester_id END
                  FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)
              )
            UNION ALL
            -- A friend checked in where I already was: "birlikte", points for both (told to the one who came first)
            SELECT 'together', c2.created_at, u.username, v.id, v.name, NULL, false
            FROM checkin_together t JOIN checkins c1 ON c1.id = t.checkin_id JOIN checkins c2 ON c2.id = t.other_checkin_id
            JOIN users u ON u.id = c2.user_id JOIN venues v ON v.id = c1.venue_id
            WHERE c1.user_id = %(me)s AND c2.created_at > c1.created_at AND c2.created_at > %(since)s
            UNION ALL
            -- A venue I added was approved (enough check-ins, or an admin)
            SELECT 'venue_approved', v.approved_at, NULL, v.id, v.name, NULL, false
            FROM venues v WHERE v.added_by = %(me)s AND v.source = 'user' AND v.approved_at > %(since)s
            UNION ALL
            -- Someone signed up through my invite link
            SELECT 'invite_joined', u.created_at, u.username, NULL, NULL, NULL, false
            FROM users u WHERE u.invited_by = %(me)s AND u.created_at > %(since)s AND NOT u.frozen
            UNION ALL
            -- A stamp card filled up (done: the reward was used)
            SELECT 'loyalty_reward', m.reward_at, NULL, v.id, v.name, p.reward, m.rewards = 0
            FROM loyalty_members m JOIN loyalty_programs p ON p.venue_id = m.venue_id JOIN venues v ON v.id = m.venue_id
            WHERE m.user_id = %(me)s AND m.reward_at > %(since)s
            UNION ALL
            -- First of the week (written down when the week is over)
            SELECT 'weekly_winner', (w.week_start + 7)::timestamp AT TIME ZONE 'Europe/Istanbul', NULL, NULL, NULL,
                   w.points::text, false
            FROM weekly_winners w
            WHERE w.user_id = %(me)s AND (w.week_start + 7)::timestamp AT TIME ZONE 'Europe/Istanbul' > %(since)s
            UNION ALL
            -- The answer to my message to support
            SELECT 'support_reply', s.replied_at, NULL, NULL, NULL, s.reply, false
            FROM support_messages s WHERE s.user_id = %(me)s AND s.replied_at > %(since)s
            UNION ALL
            -- Kept lines: a photo removed, the decision on a photo I reported
            SELECT n.kind, n.created_at, NULL, v.id, v.name, n.body, false
            FROM user_notices n LEFT JOIN venues v ON v.id = n.venue_id
            WHERE n.user_id = %(me)s AND n.created_at > %(since)s
            UNION ALL
            -- The decision on a review or reply I reported (body: kept / removed)
            SELECT 'report_result', COALESCE(rp.dismissed_at, r.removed_at, p.removed_at), NULL, v.id, v.name,
                   CASE WHEN rp.dismissed_at IS NOT NULL THEN 'kept' ELSE 'removed' END, false
            FROM reports rp LEFT JOIN reviews r ON r.id = rp.review_id
            LEFT JOIN review_replies p ON p.id = rp.reply_id LEFT JOIN reviews pr ON pr.id = p.review_id
            JOIN venues v ON v.id = COALESCE(r.venue_id, pr.venue_id)
            WHERE rp.reporter_id = %(me)s AND COALESCE(rp.dismissed_at, r.removed_at, p.removed_at) > %(since)s
            UNION ALL
            -- The business: a new review of its venue
            SELECT 'new_review', r.created_at, u.username, v.id, v.name, r.rating || '★ ' || r.body, false
            FROM reviews r JOIN users u ON u.id = r.user_id JOIN venues v ON v.id = r.venue_id
            WHERE r.venue_id = %(venue)s AND r.removed_at IS NULL AND r.created_at > %(since)s
            UNION ALL
            -- The business: a coupon used at the counter
            SELECT 'coupon_redeemed', k.redeemed_at, NULL, v.id, v.name, c.message, false
            FROM coupons k JOIN campaigns c ON c.id = k.campaign_id JOIN venues v ON v.id = c.venue_id
            WHERE c.venue_id = %(venue)s AND k.redeemed_at > %(since)s AND k.redeemed_at <= %(now)s
            UNION ALL
            -- The business: four fifths of a campaign's coupons are taken (body: "8/10")
            SELECT 'coupon_limit', k.claimed_at, NULL, v.id, v.name,
                   ceil(c.max_claims * 0.8)::int || '/' || c.max_claims, false
            FROM campaigns c JOIN venues v ON v.id = c.venue_id
            JOIN LATERAL (
                SELECT claimed_at FROM coupons WHERE campaign_id = c.id ORDER BY claimed_at
                OFFSET ceil(c.max_claims * 0.8)::int - 1 LIMIT 1
            ) k ON true
            WHERE c.venue_id = %(venue)s AND c.max_claims >= 2 AND k.claimed_at > %(since)s
            UNION ALL
            -- The business: a campaign ended (body: "seen,taken,used")
            SELECT 'campaign_ended', c.ends_at, NULL, v.id, v.name,
                   (SELECT count(*) FROM campaign_views w WHERE w.campaign_id = c.id) || ','
                   || (SELECT count(*) FROM coupons k WHERE k.campaign_id = c.id) || ','
                   || (SELECT count(*) FROM coupons k WHERE k.campaign_id = c.id AND k.redeemed_at IS NOT NULL), false
            FROM campaigns c JOIN venues v ON v.id = c.venue_id
            WHERE c.venue_id = %(venue)s AND c.ends_at > %(since)s AND c.ends_at <= %(now)s AND NOT c.standing
            UNION ALL
            -- The business: the free trial of the Aylık paket, and the kurucu mekan's free months, ended
            SELECT 'trial_ended', p.trial_until, NULL, v.id, v.name, NULL, false
            FROM venue_profiles p JOIN venues v ON v.id = p.venue_id
            WHERE p.venue_id = %(venue)s AND p.trial_until > %(since)s AND p.trial_until <= %(now)s
            UNION ALL
            SELECT 'founder_ended', p.founder_until, NULL, v.id, v.name, NULL, false
            FROM venue_profiles p JOIN venues v ON v.id = p.venue_id
            WHERE p.venue_id = %(venue)s AND p.founder AND p.founder_until > %(since)s AND p.founder_until <= %(now)s
            UNION ALL
            -- The business: "Öne çık" went live, and ended
            SELECT 'sponsor_started', s.starts_at, NULL, v.id, v.name, NULL, false
            FROM sponsorships s JOIN venues v ON v.id = s.venue_id
            WHERE s.venue_id = %(venue)s AND s.starts_at > %(since)s AND s.starts_at <= %(now)s
            UNION ALL
            SELECT 'sponsor_ended', s.ends_at, NULL, v.id, v.name, NULL, false
            FROM sponsorships s JOIN venues v ON v.id = s.venue_id
            WHERE s.venue_id = %(venue)s AND s.ends_at > %(since)s AND s.ends_at <= %(now)s
            UNION ALL
            -- The business: someone said the venue's information is wrong ("Bilgi yanlış mı?")
            SELECT 'venue_issue', i.created_at, NULL, v.id, v.name, i.kind, i.resolved_at IS NOT NULL
            FROM venue_issues i JOIN venues v ON v.id = i.venue_id
            WHERE i.venue_id = %(venue)s AND i.created_at > %(since)s
        ) items
        WHERE %(cleared)s::timestamptz IS NULL OR at > %(cleared)s
        ORDER BY at DESC LIMIT 100
        """,
        {
            "me": me["id"],
            "venue": me.get("venue_id") if me.get("role") == "business" else None,
            "since": now - timedelta(days=NOTIFICATION_DAYS),
            "now": now,
            "cleared": _cleared_at(conn, me["id"]),
        },
    ).fetchall()
    cleared = _cleared_at(conn, me["id"])
    quiet = [*quiet_watches(conn, me, now), *quiet_favorites(conn, me, now), *monthly_report_item(conn, me, now)]
    rows = sorted([*rows, *(w for w in quiet if cleared is None or w["at"] > cleared)],
                  key=lambda r: r["at"], reverse=True)
    dismissed = {r["key"] for r in conn.execute("SELECT key FROM notification_dismissals WHERE user_id = %s", (me["id"],))}
    items = [{**r, "key": notification_key(r)} for r in rows]
    return [i for i in items if i["key"] not in dismissed][:50]


WATCH_HOURS = 6  # as on the phone: the bell turns itself off after this long


def quiet_watches(conn: psycopg.Connection, me: dict, now: datetime) -> list[dict]:
    """"Sakin olunca haber ver": a watched venue reported Sakin by check-ins made after the bell was turned on."""
    from app.checkins import load_crowds

    watches = conn.execute(
        """
        SELECT w.venue_id, w.created_at, v.name FROM watches w JOIN venues v ON v.id = w.venue_id
        WHERE w.user_id = %s AND w.created_at > %s
        """,
        (me["id"], now - timedelta(hours=WATCH_HOURS)),
    ).fetchall()
    if not watches:
        return []
    crowds = load_crowds(conn, [w["venue_id"] for w in watches], now)
    return [
        {"kind": "watch_quiet", "at": crowd.last_report_at, "username": None, "venue_id": w["venue_id"],
         "venue_name": w["name"], "body": None, "done": False}
        for w in watches
        if (crowd := crowds[w["venue_id"]]).state == "live" and crowd.level == "low" and crowd.last_report_at > w["created_at"]
    ]


def monthly_report_item(conn: psycopg.Connection, me: dict, now: datetime) -> list[dict]:
    """The business, from the 1st of the month: "Geçen ay availo ile 23 kişi geldi, 9'u ilk kez" (body:
    "people,new,coupons used"). Only when the month had check-ins."""
    from app.business import month_report
    from app.summary import month_bounds

    if me.get("role") != "business" or not me.get("venue_id"):
        return []
    report = month_report(conn, me["venue_id"], now, 1)
    if not report["checkins"]:
        return []
    start, _ = month_bounds(now)
    venue = conn.execute("SELECT name FROM venues WHERE id = %s", (me["venue_id"],)).fetchone()
    return [{"kind": "monthly_report", "at": start, "username": None, "venue_id": me["venue_id"], "venue_name": venue["name"],
             "body": f"{report['people']},{report['new_people']},{report['coupons_used']}", "done": False}]


FAVORITE_BUSY_BEFORE = timedelta(hours=3)


def quiet_favorites(conn: psycopg.Connection, me: dict, now: datetime) -> list[dict]:
    """availo+: a favourite venue that was busy in the last three hours is now reported Sakin, without
    turning a bell on (Bildirim ayarları > "Favorilerim sakinleşince"). Watched venues tell it already."""
    from app.checkins import load_crowds

    person = conn.execute("SELECT plan, app_settings FROM users WHERE id = %s", (me["id"],)).fetchone()
    if person["plan"] != "premium" or not (person["app_settings"] or {}).get("favoriteQuietNotifications"):
        return []
    favorites = conn.execute(
        """
        SELECT f.venue_id, v.name FROM favorites f JOIN venues v ON v.id = f.venue_id
        WHERE f.user_id = %(me)s
          AND NOT EXISTS (SELECT 1 FROM watches w WHERE w.user_id = %(me)s AND w.venue_id = f.venue_id AND w.created_at > %(watch)s)
          AND EXISTS (SELECT 1 FROM checkins c WHERE c.venue_id = f.venue_id AND c.level IN ('medium', 'high')
                      AND c.created_at > %(busy)s AND c.created_at <= %(now)s)
        """,
        {"me": me["id"], "watch": now - timedelta(hours=WATCH_HOURS), "busy": now - FAVORITE_BUSY_BEFORE, "now": now},
    ).fetchall()
    if not favorites:
        return []
    crowds = load_crowds(conn, [f["venue_id"] for f in favorites], now)
    return [
        {"kind": "favorite_quiet", "at": crowd.last_report_at, "username": None, "venue_id": f["venue_id"],
         "venue_name": f["name"], "body": None, "done": False}
        for f in favorites
        if (crowd := crowds[f["venue_id"]]).state == "live" and crowd.level == "low"
    ]


class CallError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def call_friends(conn: psycopg.Connection, me: dict, checkin_id: int, now: datetime) -> int:
    """"Buradayım, gel": my friends get a notification, once per check-in, while the check-in is fresh.
    Returns how many friends there are to hear it."""
    checkin = conn.execute(
        "SELECT venue_id, is_private, created_at FROM checkins WHERE id = %s AND user_id = %s", (checkin_id, me["id"])
    ).fetchone()
    if checkin is None:
        raise CallError("Check-in bulunamadı.", 404)
    if checkin["is_private"]:
        raise CallError("Gizli check-in'de arkadaşlarına haber verilemez.", 403)
    if now - checkin["created_at"] > CALL_WINDOW:
        raise CallError("Bu check-in eskidi; yeniden check-in yapınca çağırabilirsin.", 409)
    friends = conn.execute(
        "SELECT count(*)::int AS n FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)",
        {"me": me["id"]},
    ).fetchone()["n"]
    if friends == 0:
        raise CallError("Henüz arkadaşın yok.", 409)
    conn.execute(
        "INSERT INTO come_calls (checkin_id, user_id, venue_id, created_at) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING",
        (checkin_id, me["id"], checkin["venue_id"], now),
    )
    return friends


def notification_key(item: dict) -> str:
    """Names one 🔔 item, for deleting it: what, where, who and when (to the microsecond)."""
    at = item["at"]
    return f"{item['kind']}:{item['venue_id'] or ''}:{item['username'] or ''}:{round(at.timestamp() * 1_000_000)}"


def _cleared_at(conn: psycopg.Connection, user_id: int) -> datetime | None:
    return conn.execute("SELECT notifications_cleared_at AS at FROM users WHERE id = %s", (user_id,)).fetchone()["at"]


def dismiss_notification(conn: psycopg.Connection, me: dict, key: str) -> None:
    conn.execute(
        "INSERT INTO notification_dismissals (user_id, key) VALUES (%s, %s) ON CONFLICT DO NOTHING", (me["id"], key[:200])
    )


def clear_notifications(conn: psycopg.Connection, me: dict, now: datetime) -> None:
    """"Temizle": everything so far goes; the one-by-one deletions are not needed any more."""
    conn.execute("UPDATE users SET notifications_cleared_at = %s WHERE id = %s", (now, me["id"]))
    conn.execute("DELETE FROM notification_dismissals WHERE user_id = %s", (me["id"],))
