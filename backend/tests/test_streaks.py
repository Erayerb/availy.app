from datetime import datetime, timedelta, timezone

from app.streaks import friends_regular, weekly_streak
from tests.test_business import account, auth
from tests.test_checkin_social import befriend
from tests.test_checkins import venue_id

# A Wednesday noon in Istanbul
NOW = datetime(2026, 10, 21, 9, 0, tzinfo=timezone.utc)


def user(conn, username):
    return conn.execute("SELECT * FROM users WHERE username = %s", (username,)).fetchone()


def add_checkin(conn, user_id, venue, at, private=False):
    conn.execute(
        "INSERT INTO checkins (venue_id, user_id, level, is_private, created_at) VALUES (%s, %s, 'low', %s, %s)",
        (venue, user_id, private, at),
    )


def test_weekly_streak(client, conn):
    account(client, "t_ali")
    ali = user(conn, "t_ali")
    kafe = venue_id(conn, "Test Kafe A")
    assert weekly_streak(conn, ali["id"], NOW) == 0
    # Last week, the week before, and a gap before that
    for days in (8, 15, 29):
        add_checkin(conn, ali["id"], kafe, NOW - timedelta(days=days))
    # Nothing yet this week: the streak is still alive (2 weeks)
    assert weekly_streak(conn, ali["id"], NOW) == 2
    add_checkin(conn, ali["id"], kafe, NOW - timedelta(hours=1))
    assert weekly_streak(conn, ali["id"], NOW) == 3
    # A whole week without a check-in ends it
    assert weekly_streak(conn, ali["id"], NOW + timedelta(days=14)) == 0


def test_friends_regular(client, conn):
    ali_token, ayse_token = account(client, "t_ali"), account(client, "t_ayse")
    account(client, "t_yabanci")
    ali, ayse, stranger = user(conn, "t_ali"), user(conn, "t_ayse"), user(conn, "t_yabanci")
    kafe = venue_id(conn, "Test Kafe A")
    add_checkin(conn, ali["id"], kafe, NOW - timedelta(days=1))
    assert friends_regular(conn, ali, kafe, NOW) is None  # one visit is not enough
    add_checkin(conn, ali["id"], kafe, NOW - timedelta(days=2))
    assert friends_regular(conn, ali, kafe, NOW) == {"username": "t_ali", "visits": 2, "me": True}
    # A stranger with more visits does not count; a friend does, private check-ins do not
    for days in (1, 2, 3):
        add_checkin(conn, stranger["id"], kafe, NOW - timedelta(days=days))
        add_checkin(conn, ayse["id"], kafe, NOW - timedelta(days=days))
    add_checkin(conn, ayse["id"], kafe, NOW - timedelta(days=4), private=True)
    assert friends_regular(conn, ali, kafe, NOW)["username"] == "t_ali"
    befriend(client, ali_token, ayse_token, "t_ali", "t_ayse")
    assert friends_regular(conn, ali, kafe, NOW) == {"username": "t_ayse", "visits": 3, "me": False}
    # Older than 30 days: no longer counts
    assert friends_regular(conn, ali, kafe, NOW + timedelta(days=40)) is None
    assert client.get(f"/v1/venues/{kafe}/regular", headers=auth(ali_token)).status_code == 200
