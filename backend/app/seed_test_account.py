"""A test account for trying the social features with a second person.

Creates @availy_deneme (if missing) with a few check-ins and a review in
Caddebostan, and sends a friend request to the user name given (default: eray).
Never deletes anything; safe to run repeatedly.
Run: docker compose run --rm backend python -m app.seed_test_account [kullaniciadi]

Sign in with: availy_deneme / deneme123 (test account, not a real person)

Also creates the business test account @availy_isletme for the venue @availy_deneme
reviewed, so its panel shows a check-in and a review to answer.
Sign in with: availy_isletme / deneme123 (choose "İşletme")
"""
import sys
from datetime import datetime, timedelta, timezone

import psycopg
from psycopg.rows import dict_row

from app.accounts import create_user
from app.checkins import award_points
from app.config import settings
from app.db import apply_schema
from app.friends import FriendError, add_friend
from app.reviews import ReviewError, save_review

BUSINESS_USERNAME = "availy_isletme"
BUSINESS_EMAIL = "availy_isletme@example.test"
USERNAME = "availy_deneme"
EMAIL = "availy_deneme@example.test"
PASSWORD = "deneme123"
# Caddebostan pilot area (OpenStreetMap venues)
AREA = (29.053, 40.958, 29.077, 40.973)


def test_user(conn: psycopg.Connection) -> dict:
    row = conn.execute("SELECT * FROM users WHERE lower(username) = %s", (USERNAME,)).fetchone()
    return row or create_user(conn, "", EMAIL, PASSWORD, "personal", USERNAME) | {"is_guest": False}


def add_activity(conn: psycopg.Connection, user: dict, now: datetime) -> int:
    """Two public check-ins and a review, only the first time (an account without check-ins)."""
    if conn.execute("SELECT 1 FROM checkins WHERE user_id = %s", (user["id"],)).fetchone():
        return 0
    venues = conn.execute(
        """
        SELECT id, name FROM venues
        WHERE source = 'osm' AND category IN ('cafe', 'restaurant')
          AND location && ST_MakeEnvelope(%s, %s, %s, %s, 4326)::geography
        ORDER BY name LIMIT 2
        """,
        AREA,
    ).fetchall()
    for minutes, venue, level in zip((90, 20), venues, ("medium", "low")):
        at = now - timedelta(minutes=minutes)
        first = not conn.execute("SELECT 1 FROM checkins WHERE venue_id = %s", (venue["id"],)).fetchone()
        checkin = conn.execute(
            "INSERT INTO checkins (venue_id, user_id, level, is_first, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id, is_first",
            (venue["id"], user["id"], level, first, at),
        ).fetchone()
        award_points(conn, user, checkin, at)
    if venues:
        try:
            save_review(conn, user, venues[-1]["id"], 4, "Öğleden sonra sakin, çalışmak için iyi.", True, now)
        except ReviewError:
            pass
    return len(venues)


def business_user(conn: psycopg.Connection, customer: dict) -> dict:
    """The business test account, at the venue the customer test account reviewed."""
    row = conn.execute("SELECT * FROM users WHERE lower(username) = %s", (BUSINESS_USERNAME,)).fetchone()
    business = row or create_user(conn, "", BUSINESS_EMAIL, PASSWORD, "business", BUSINESS_USERNAME)
    venue = conn.execute(
        "SELECT venue_id FROM reviews WHERE user_id = %s ORDER BY created_at LIMIT 1", (customer["id"],)
    ).fetchone()
    if venue and business.get("venue_id") is None:
        conn.execute("UPDATE users SET venue_id = %s WHERE id = %s", (venue["venue_id"], business["id"]))
    return business


def main(friend: str) -> None:
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        apply_schema(conn)
        user = test_user(conn)
        added = add_activity(conn, user, datetime.now(timezone.utc))
        try:
            relation = add_friend(conn, user, friend)["relation"]
        except FriendError as e:
            relation = e.message
        business_user(conn, user)
        conn.commit()
    print(f"@{USERNAME}: {added} check-in eklendi; @{friend} ile: {relation}; @{BUSINESS_USERNAME} hazır")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "eray")
