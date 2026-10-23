from datetime import datetime, timezone

from app.social import week_start


def account(client, username):
    body = {"email": f"{username}@example.test", "password": "gizli123", "username": username}
    return client.post("/v1/auth/register", json=body).json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def user_id(client, token):
    return client.get("/v1/me", headers=auth(token)).json()["id"]


def give(conn, uid, amount, days_ago=0):
    conn.execute(
        "INSERT INTO points (user_id, amount, reason, created_at) VALUES (%s, %s, 'checkin', now() - %s * interval '1 day')",
        (uid, amount, days_ago),
    )


def befriend(client, a, b, a_name, b_name):
    client.post("/v1/friends", json={"username": b_name}, headers=auth(a))
    client.post("/v1/friends", json={"username": a_name}, headers=auth(b))


def test_week_starts_on_monday_in_istanbul():
    # Wednesday 21 Oct 2026, 09:00 UTC -> Monday 19 Oct 00:00 Istanbul (= Sunday 21:00 UTC)
    start = week_start(datetime(2026, 10, 21, 9, 0, tzinfo=timezone.utc))
    assert start.astimezone(timezone.utc) == datetime(2026, 10, 18, 21, 0, tzinfo=timezone.utc)


def test_friends_leaderboard_week_and_all_time(client, conn):
    ali, ayse, can = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_can")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    befriend(client, ali, can, "t_ali", "t_can")
    give(conn, user_id(client, ali), 20)
    give(conn, user_id(client, ayse), 60)
    give(conn, user_id(client, can), 100, days_ago=30)  # long ago: all time only
    week = client.get("/v1/leaderboard", params={"period": "week"}, headers=auth(ali)).json()
    assert [(r["username"], r["points"], r["rank"]) for r in week["rows"]] == [("t_ayse", 60, 1), ("t_ali", 20, 2), ("t_can", 0, 3)]
    assert week["me"] == {"rank": 2, "points": 20} and [r["me"] for r in week["rows"]] == [False, True, False]
    total = client.get("/v1/leaderboard", params={"period": "all"}, headers=auth(ali)).json()
    assert [r["username"] for r in total["rows"]] == ["t_can", "t_ayse", "t_ali"]


def test_everyone_leaderboard_respects_privacy(client, conn):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    give(conn, user_id(client, ali), 10)
    give(conn, user_id(client, ayse), 50)
    rows = client.get("/v1/leaderboard", params={"scope": "everyone"}, headers=auth(ali)).json()["rows"]
    assert "t_ayse" in [r["username"] for r in rows]
    client.patch("/v1/me/privacy", json={"show_in_leaderboard": False}, headers=auth(ayse))
    after = client.get("/v1/leaderboard", params={"scope": "everyone"}, headers=auth(ali)).json()
    assert "t_ayse" not in [r["username"] for r in after["rows"]] and after["me"]["points"] == 10


def test_privacy_settings_and_search(client):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    assert client.get("/v1/me", headers=auth(ayse)).json()["searchable"] is True
    changed = client.patch("/v1/me/privacy", json={"searchable": False}, headers=auth(ayse)).json()
    assert changed == {"share_checkins": True, "show_in_leaderboard": True, "searchable": False}
    assert client.get("/v1/users/search", params={"q": "t_ay"}, headers=auth(ali)).json() == []
    # An exact user name (QR code, invite link) still works
    assert client.post("/v1/friends", json={"username": "t_ayse"}, headers=auth(ali)).status_code == 200


def test_notifications(client, conn, visit):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    client.post("/v1/friends", json={"username": "t_ayse"}, headers=auth(ali))
    assert [n["kind"] for n in client.get("/v1/notifications", headers=auth(ayse)).json()] == ["friend_request"]
    client.post("/v1/friends", json={"username": "t_ali"}, headers=auth(ayse))
    kafe = conn.execute("SELECT id FROM venues WHERE name = 'Test Kafe A'").fetchone()["id"]
    visit("t_ali", kafe)
    review = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 5}, headers=auth(ali)).json()["items"][0]
    client.post(f"/v1/reviews/{review['id']}/replies", json={"body": "Katılıyorum"}, headers=auth(ayse))
    client.post(f"/v1/reviews/{review['id']}/replies", json={"body": "Kendime not"}, headers=auth(ali))
    items = client.get("/v1/notifications", headers=auth(ali)).json()
    assert [(n["kind"], n["username"]) for n in items] == [("reply", "t_ayse"), ("friend_accepted", "t_ayse")]
    assert items[0]["body"] == "Katılıyorum" and items[0]["venue_name"] == "Test Kafe A"
    assert client.get("/v1/notifications", headers=auth(ayse)).json() == []
