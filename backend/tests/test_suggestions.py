from tests.test_business import account, auth
from tests.test_checkins import NEAR, checkin, clock, venue_id  # noqa: F401 (clock is a fixture)


def befriend(client, a, b, b_name, a_name):
    client.post("/v1/friends", json={"username": b_name}, headers=auth(a))
    client.post("/v1/friends", json={"username": a_name}, headers=auth(b))


def test_people_and_venues_for_an_empty_feed(client, conn, clock):
    new, ali, ayse, can = (account(client, n) for n in ("t_yeni", "t_ali", "t_ayse", "t_can"))
    def mine(found):  # the database may have real people too
        return [p for p in found["people"] if p["username"].startswith("t_")]

    empty = client.get("/v1/suggestions", headers=auth(new)).json()
    assert mine(empty) == [] and empty["venues"] == []
    # Ayşe checked in (points this week) and discovered the venue; Can is Ali's friend
    checkin(client, ayse, venue_id(conn, "Test Kafe A"))
    befriend(client, new, ali, "t_ali", "t_yeni")
    befriend(client, ali, can, "t_can", "t_ali")
    found = client.get("/v1/suggestions", params=NEAR, headers=auth(new)).json()
    # Can first (a mutual friend), then Ayşe (points); Ali is already a friend
    assert [p["username"] for p in mine(found)] == ["t_can", "t_ayse"]
    assert found["people"][0]["username"] == "t_can" and found["people"][0]["mutual"] == 1
    assert found["venues"][0]["name"] == "Test Kafe A" and found["venues"][0]["username"] == "t_ayse"
    assert found["venues"][0]["distance_m"] < 100


def test_friends_here_and_regulars(client, conn, clock):
    from datetime import timedelta

    from tests.test_business import business_at
    from tests.test_checkins import NOON

    token, kafe = business_at(client, conn)
    me, ali, stranger = account(client, "t_ben"), account(client, "t_ali"), account(client, "t_yabanci")
    befriend(client, me, ali, "t_ali", "t_ben")
    checkin(client, ali, kafe)
    checkin(client, stranger, kafe)
    assert [f["username"] for f in client.get(f"/v1/venues/{kafe}/friends-here", headers=auth(me)).json()] == ["t_ali"]
    clock.now = NOON + timedelta(minutes=65)
    assert client.get(f"/v1/venues/{kafe}/friends-here", headers=auth(me)).json() == []
    # Ali came three times in a month: a regular
    for hours in (3, 6):
        clock.now = NOON + timedelta(hours=hours)
        checkin(client, ali, kafe)
    stats = client.get(f"/v1/venues/{kafe}/stats", headers=auth(token)).json()
    assert (stats["month_people"], stats["regulars"], stats["top_visits"]) == (2, 1, [3, 1])
