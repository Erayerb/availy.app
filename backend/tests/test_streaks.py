from datetime import datetime, timedelta, timezone

from app.streaks import day_streak, venue_regular
from tests.test_business import account, auth
from tests.test_checkin_social import befriend
from tests.test_checkins import clock, venue_id  # noqa: F401 (clock is a fixture)

# A Wednesday noon in Istanbul
NOW = datetime(2026, 10, 21, 9, 0, tzinfo=timezone.utc)


def user(conn, username):
    return conn.execute("SELECT * FROM users WHERE username = %s", (username,)).fetchone()


def add_checkin(conn, user_id, venue, at, private=False):
    conn.execute(
        "INSERT INTO checkins (venue_id, user_id, level, is_private, created_at) VALUES (%s, %s, 'low', %s, %s)",
        (venue, user_id, private, at),
    )


def test_day_streak(client, conn):
    account(client, "t_ali")
    ali = user(conn, "t_ali")
    kafe = venue_id(conn, "Test Kafe A")
    assert day_streak(conn, ali["id"], NOW) == 0
    # Yesterday, the day before, and a gap before that
    for days in (1, 2, 4):
        add_checkin(conn, ali["id"], kafe, NOW - timedelta(days=days))
    # Nothing yet today: the streak is still alive (2 days)
    assert day_streak(conn, ali["id"], NOW) == 2
    add_checkin(conn, ali["id"], kafe, NOW - timedelta(hours=1))
    assert day_streak(conn, ali["id"], NOW) == 3
    # A whole day without a check-in ends it
    assert day_streak(conn, ali["id"], NOW + timedelta(days=2)) == 0


def test_venue_regular_is_the_same_for_everyone(client, conn):
    ali_token, ayse_token = account(client, "t_ali"), account(client, "t_ayse")
    account(client, "t_yabanci")
    ali, ayse, stranger = user(conn, "t_ali"), user(conn, "t_ayse"), user(conn, "t_yabanci")
    kafe = venue_id(conn, "Test Kafe A")
    add_checkin(conn, ali["id"], kafe, NOW - timedelta(days=1))
    add_checkin(conn, ali["id"], kafe, NOW - timedelta(days=2))
    assert venue_regular(conn, ali, kafe, NOW) is None  # two visits are not enough
    add_checkin(conn, ali["id"], kafe, NOW - timedelta(days=5))
    assert venue_regular(conn, ali, kafe, NOW) == {"username": "t_ali", "visits": 3, "me": True, "friend": False}
    # A stranger with more (public) visits is the regular for everyone; private check-ins do not count
    for days in (1, 2, 3, 4):
        add_checkin(conn, stranger["id"], kafe, NOW - timedelta(days=days))
    add_checkin(conn, ayse["id"], kafe, NOW - timedelta(days=4), private=True)
    # Kept to friends: still the regular, but without a name for Ali ("Gizli müdavim")
    assert venue_regular(conn, ali, kafe, NOW) == {"username": None, "visits": 4, "me": False, "friend": False}
    assert venue_regular(conn, ayse, kafe, NOW)["visits"] == 4
    conn.execute("UPDATE users SET regular_public = true WHERE id = %s", (stranger["id"],))
    assert venue_regular(conn, ali, kafe, NOW)["username"] == "t_yabanci"
    # A friend sees the name even when it is kept to friends
    for days in (1, 2, 3, 4, 5):
        add_checkin(conn, ayse["id"], kafe, NOW - timedelta(hours=days))
    befriend(client, ali_token, ayse_token, "t_ali", "t_ayse")
    assert venue_regular(conn, ali, kafe, NOW) == {"username": "t_ayse", "visits": 5, "me": False, "friend": True}
    # Older than 30 days: no longer counts
    assert venue_regular(conn, ali, kafe, NOW + timedelta(days=40)) is None
    assert client.get(f"/v1/venues/{kafe}/regular", headers=auth(ali_token)).status_code == 200


def test_losing_the_regular_place_is_told_and_levels_bring_gifts(client, conn, clock):
    from tests.test_checkins import checkin

    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    kafe = venue_id(conn, "Test Kafe A")
    a, b = user(conn, "t_ali"), user(conn, "t_ayse")
    for days in (3, 2):
        add_checkin(conn, a["id"], kafe, clock.now - timedelta(days=days))
    checkin(client, ali, kafe)  # the third: Ali is the regular
    assert conn.execute("SELECT user_id FROM venue_regulars WHERE venue_id = %s", (kafe,)).fetchone()["user_id"] == a["id"]
    for days in (3, 2, 1):
        add_checkin(conn, b["id"], kafe, clock.now - timedelta(days=days, hours=1))
    clock.now += timedelta(hours=1)
    checkin(client, ayse, kafe)  # Ayşe: 4, the regular now; Ali is told
    lost = [n for n in client.get("/v1/notifications", headers=auth(ali)).json() if n["kind"] == "regular_lost"]
    assert len(lost) == 1 and lost[0]["venue_id"] == kafe and lost[0]["username"] is None  # she keeps it to friends
    # Mahalleli: a week of availo+ and +30
    from app.levels import grant_plus, reward_levels

    conn.execute("INSERT INTO points (user_id, amount, reason) VALUES (%s, 600, 'checkin')", (a["id"],))
    for name in ("Test Cowork B", "Test Bar Uzak"):
        for d in range(3):
            add_checkin(conn, a["id"], venue_id(conn, name), clock.now - timedelta(days=d + 1))
    new = reward_levels(conn, a["id"], clock.now)
    assert [n["id"] for n in new] == ["level_explorer", "level_local"] and "availo+" in new[1]["name"]
    row = conn.execute("SELECT plan, plus_until FROM users WHERE id = %s", (a["id"],)).fetchone()
    assert row["plan"] == "premium" and row["plus_until"] > clock.now + timedelta(days=6)
    assert reward_levels(conn, a["id"], clock.now) == []  # once
    # A bought availo+ is left alone
    conn.execute("UPDATE users SET plan = 'premium', plus_until = NULL WHERE id = %s", (b["id"],))
    grant_plus(conn, b["id"], 7, clock.now)
    assert conn.execute("SELECT plus_until FROM users WHERE id = %s", (b["id"],)).fetchone()["plus_until"] is None


def test_every_week_of_the_streak_brings_10(client, conn, clock):
    from tests.test_checkins import checkin

    ali = account(client, "t_ali")
    a = user(conn, "t_ali")
    kafe = venue_id(conn, "Test Kafe A")
    for days in range(1, 7):
        add_checkin(conn, a["id"], kafe, clock.now - timedelta(days=days))
    checkin(client, ali, kafe)  # the 7th day
    streak = conn.execute("SELECT amount FROM points WHERE user_id = %s AND reason = 'streak'", (a["id"],)).fetchall()
    assert [r["amount"] for r in streak] == [10]
