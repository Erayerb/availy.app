from datetime import timedelta

from tests.test_business import account, auth
from tests.test_checkins import checkin, clock, venue_id  # noqa: F401 (clock is a fixture)


def register(client, username, **extra):
    body = {"email": f"{username}@example.test", "password": "Gizli.123", "username": username, **extra}
    return client.post("/v1/auth/register", json=body).json()["token"]


def test_an_invite_makes_friends_and_the_first_checkin_rewards_both(client, conn, clock):
    ali = account(client, "t_ali")
    before = client.get("/v1/me", headers=auth(ali)).json()["points"]
    ayse = register(client, "t_ayse", invited_by="T_Ali")
    assert [f["username"] for f in client.get("/v1/friends", headers=auth(ayse)).json()["friends"]] == ["t_ali"]
    assert client.get("/v1/me", headers=auth(ali)).json()["points"] == before  # not for signing up alone
    # Ayşe's first check-in: +50 each (once)
    pts = lambda: conn.execute(  # noqa: E731
        "SELECT reason, amount FROM points p JOIN users u ON u.id = p.user_id WHERE u.username = %s AND reason IN ('invite', 'invited')",
        ("t_ali",),
    ).fetchall()
    kafe = venue_id(conn, "Test Kafe A")
    assert checkin(client, ayse, kafe).json()["points_earned"] >= 50
    assert [(r["reason"], r["amount"]) for r in pts()] == [("invite", 50)]
    clock.now += timedelta(hours=3)
    checkin(client, ayse, venue_id(conn, "Test Cowork B"))
    assert len(pts()) == 1
    # An unknown or own name does nothing
    assert client.post("/v1/auth/register", json={"email": "t_can@example.test", "password": "Gizli.123", "username": "t_can", "invited_by": "yokboyle"}).status_code == 201


def test_people_who_go_to_the_same_venues(client, conn, clock):
    me, other = account(client, "t_ben"), account(client, "t_komsu")
    kafe = venue_id(conn, "Test Kafe A")
    checkin(client, me, kafe)
    checkin(client, other, kafe)
    people = {p["username"]: p for p in client.get("/v1/suggestions", headers=auth(me)).json()["people"]}
    assert people["t_komsu"]["shared_venues"] == 1
    client.patch("/v1/me/privacy", json={"suggest_by_venues": False}, headers=auth(other))
    people = {p["username"]: p for p in client.get("/v1/suggestions", headers=auth(me)).json()["people"]}
    assert people.get("t_komsu", {"shared_venues": 0})["shared_venues"] == 0
