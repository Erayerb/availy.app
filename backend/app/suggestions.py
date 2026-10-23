"""v2 Sosyal > Akış for someone with little in it: people to add and venues discovered nearby lately.

People: friends of my friends first (most mutual friends), then people who check in at the same venues
(both allow it: Gizlilik > "Aynı mekanlara gidenlere önerileyim"), then the most active people this week;
only searchable personal accounts that are not already my friends, asked, blocked or frozen.
Venues: first check-ins of the last 14 days (the discoverer's name unless it was private), nearest first.
"""
from datetime import datetime, timedelta

import psycopg

from app.safety import BLOCKED
from app.social import week_start

PEOPLE = 5
VENUES = 5
DISCOVERED_DAYS = 14

# Everyone I am connected to in any way (friends and requests both ways)
CONNECTED = """(SELECT addressee_id FROM friendships WHERE requester_id = %(me)s
                UNION SELECT requester_id FROM friendships WHERE addressee_id = %(me)s)"""
MY_FRIENDS = """(SELECT addressee_id FROM friendships WHERE requester_id = %(me)s AND status = 'accepted'
                 UNION SELECT requester_id FROM friendships WHERE addressee_id = %(me)s AND status = 'accepted')"""


def suggested_people(conn: psycopg.Connection, me: dict, now: datetime) -> list[dict]:
    return conn.execute(
        f"""
        WITH candidates AS (
            SELECT u.id, u.username,
                   (SELECT count(*) FROM friendships f
                    WHERE f.status = 'accepted'
                      AND ((f.requester_id = u.id AND f.addressee_id IN {MY_FRIENDS})
                        OR (f.addressee_id = u.id AND f.requester_id IN {MY_FRIENDS})))::int AS mutual,
                   (SELECT COALESCE(sum(amount), 0) FROM points p WHERE p.user_id = u.id AND p.created_at >= %(week)s)::int AS week_points,
                   CASE WHEN u.suggest_by_venues AND %(by_venues)s THEN
                       (SELECT count(DISTINCT c.venue_id) FROM checkins c
                        WHERE c.user_id = u.id AND NOT c.is_private
                          AND c.venue_id IN (SELECT venue_id FROM checkins WHERE user_id = %(me)s AND NOT is_private))
                   ELSE 0 END::int AS shared_venues
            FROM users u
            WHERE u.role = 'personal' AND NOT u.is_guest AND u.searchable AND u.username IS NOT NULL
              AND u.id <> %(me)s AND u.id NOT IN {CONNECTED} AND u.id NOT IN {BLOCKED}
        )
        SELECT username, mutual, shared_venues, week_points FROM candidates
        WHERE mutual > 0 OR shared_venues > 0 OR week_points > 0
        ORDER BY mutual DESC, shared_venues DESC, week_points DESC, username
        LIMIT %(limit)s
        """,
        {"me": me["id"], "week": week_start(now), "limit": PEOPLE, "by_venues": me.get("suggest_by_venues", True)},
    ).fetchall()


def discovered_venues(conn: psycopg.Connection, lat: float | None, lon: float | None, now: datetime) -> list[dict]:
    here = "ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography"
    distance = f"ST_Distance(v.location, {here})" if lat is not None and lon is not None else "NULL::float"
    return conn.execute(
        f"""
        SELECT v.id, v.name, v.category, v.neighborhood, v.district, c.created_at AS discovered_at,
               CASE WHEN c.is_private OR u.frozen THEN NULL ELSE u.username END AS username,
               round({distance})::int AS distance_m
        FROM checkins c JOIN venues v ON v.id = c.venue_id LEFT JOIN users u ON u.id = c.user_id
        WHERE c.is_first AND NOT c.is_demo AND c.created_at > %(since)s
        ORDER BY {distance} NULLS LAST, c.created_at DESC
        LIMIT %(limit)s
        """,
        {"lat": lat, "lon": lon, "since": now - timedelta(days=DISCOVERED_DAYS), "limit": VENUES},
    ).fetchall()
