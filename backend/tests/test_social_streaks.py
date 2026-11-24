from datetime import timedelta

from tests.test_business import account, auth
from tests.test_checkins import NOON, checkin, clock, venue_id  # noqa: F401 (clock is a fixture)


def befriend(client, a, b, a_name, b_name):
    client.post("/v1/friends", json={"username": b_name}, headers=auth(a))
    client.post("/v1/friends", json={"username": a_name}, headers=auth(b))


def together_points(conn, username):
    return conn.execute(
        "SELECT COALESCE(sum(amount), 0) AS p FROM points p JOIN users u ON u.id = p.user_id WHERE u.username = %s AND reason = 'together'",
        (username,),
    ).fetchone()["p"]


def test_friends_checking_in_together_get_10_each_once(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    ali, ayse, veli = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_veli")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    clock.now = NOON
    assert checkin(client, ayse, kafe).json()["together"] == []
    clock.now = NOON + timedelta(minutes=40)
    mine = checkin(client, ali, kafe).json()
    assert mine["together"] == ["t_ayse"]
    assert together_points(conn, "t_ali") == 10 and together_points(conn, "t_ayse") == 10
    # Not a friend: nothing
    assert checkin(client, veli, kafe).json()["together"] == []
    # Over an hour later: no bonus
    clock.now = NOON + timedelta(hours=3)
    assert checkin(client, ayse, kafe).json()["together"] == []
    # The feed says they were there together
    feed = client.get("/v1/feed", headers=auth(ayse)).json()
    assert any(f["username"] == "t_ali" and f["together"] == ["t_ayse"] for f in feed)


def test_the_days_first_checkin_grows_the_streak(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    ali = account(client, "t_ali")
    clock.now = NOON - timedelta(days=1)
    assert checkin(client, ali, kafe).json()["streak_up"] is True
    clock.now = NOON
    first = checkin(client, ali, kafe).json()
    assert first["streak_up"] is True and first["streak"] == 2
    clock.now = NOON + timedelta(hours=2)
    assert checkin(client, ali, kafe).json()["streak_up"] is False


def test_a_friend_saves_a_streak_twice_a_month(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    clock.now = NOON - timedelta(days=2)
    checkin(client, ayse, kafe)
    clock.now = NOON - timedelta(days=1)
    checkin(client, ayse, kafe)
    clock.now = NOON  # today: no check-in yet
    friend = client.get("/v1/friends", headers=auth(ali)).json()["friends"][0]
    assert (friend["streak"], friend["at_risk"], friend["can_save"]) == (2, True, True)
    saved = client.post("/v1/friends/t_ayse/save-streak", headers=auth(ali))
    assert saved.status_code == 200 and saved.json()["streak"] == 3
    friend = client.get("/v1/friends", headers=auth(ali)).json()["friends"][0]
    assert friend["at_risk"] is False and friend["can_save"] is False
    # Not twice the same day; the next day again (the second save this month), then no more
    assert client.post("/v1/friends/t_ayse/save-streak", headers=auth(ali)).status_code == 400
    clock.now = NOON + timedelta(days=1)
    assert client.post("/v1/friends/t_ayse/save-streak", headers=auth(ali)).json()["streak"] == 4
    clock.now = NOON + timedelta(days=2)
    assert client.post("/v1/friends/t_ayse/save-streak", headers=auth(ali)).status_code == 429
    # Only friends
    stranger = account(client, "t_veli")
    assert client.post("/v1/friends/t_ayse/save-streak", headers=auth(stranger)).status_code == 404


def test_group_streak_and_who_is_missing(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    group = client.post("/v1/groups", json={"name": "Kahveciler", "usernames": ["t_ayse"]}, headers=auth(ali)).json()
    gid = group["id"]
    client.post(f"/v1/groups/{gid}/join", headers=auth(ayse))
    conn.execute("UPDATE group_members SET created_at = %s", (NOON - timedelta(days=30),))
    clock.now = NOON - timedelta(days=7)
    checkin(client, ali, kafe)
    checkin(client, ayse, kafe)
    clock.now = NOON
    checkin(client, ali, kafe)
    streak = client.get(f"/v1/groups/{gid}/streak", headers=auth(ali)).json()
    assert streak["weeks"] == 1 and streak["missing"] == ["t_ayse"] and 1 <= streak["days_left"] <= 7
    outsider = account(client, "t_veli")
    assert client.get(f"/v1/groups/{gid}/streak", headers=auth(outsider)).status_code == 403


def test_availo_plus_saves_ten_times_a_month(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    ali = account(client, "t_ali")
    assert client.put("/v1/me/plan", json={"premium": True}, headers=auth(ali)).status_code == 204
    friends = []
    for i in range(11):
        name = f"t_f{i}"
        token = account(client, name)
        befriend(client, ali, token, "t_ali", name)
        clock.now = NOON - timedelta(days=1)
        checkin(client, token, kafe)
        friends.append(name)
    clock.now = NOON
    codes = [client.post(f"/v1/friends/{n}/save-streak", headers=auth(ali)).status_code for n in friends]
    assert codes == [200] * 10 + [429]
