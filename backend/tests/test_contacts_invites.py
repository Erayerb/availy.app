from app.contacts import normalize_phone
from tests.test_business import account, auth
from tests.test_checkins import checkin, clock, venue_id  # noqa: F401 (clock is a fixture)


def register(client, username, **extra):
    body = {"email": f"{username}@example.test", "password": "gizli123", "username": username, **extra}
    return client.post("/v1/auth/register", json=body).json()["token"]


def test_phone_numbers_normalize():
    for raw in ("0532 123 45 67", "+90 (532) 123-45-67", "5321234567", "905321234567", "0090 532 123 45 67"):
        assert normalize_phone(raw) == "+905321234567", raw
    assert normalize_phone("123") is None


def test_signing_up_with_an_invite_makes_friends_and_rewards_the_inviter(client, conn):
    ali = account(client, "t_ali")
    before = client.get("/v1/me", headers=auth(ali)).json()["points"]
    ayse = register(client, "t_ayse", invited_by="T_Ali")
    assert [f["username"] for f in client.get("/v1/friends", headers=auth(ayse)).json()["friends"]] == ["t_ali"]
    assert client.get("/v1/me", headers=auth(ali)).json()["points"] == before + 50
    # An unknown or own name does nothing
    assert client.post("/v1/auth/register", json={"email": "t_can@example.test", "password": "gizli123", "username": "t_can", "invited_by": "yokboyle"}).status_code == 201


def test_find_friends_from_contacts(client, conn):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    # Own number not given: searching still works (only others cannot find Ali)
    assert client.post("/v1/friends/contacts", json={"phones": ["05321234567"]}, headers=auth(ali)).json() == []
    assert client.put("/v1/me/phone", json={"phone": "12"}, headers=auth(ali)).status_code == 400
    assert client.put("/v1/me/phone", json={"phone": "0532 000 00 01"}, headers=auth(ali)).status_code == 204
    assert client.put("/v1/me/phone", json={"phone": "+90 532 123 45 67"}, headers=auth(ayse)).status_code == 204
    found = client.post("/v1/friends/contacts", json={"phones": ["0532 123 45 67", "555"]}, headers=auth(ali)).json()
    assert [(p["username"], p["relation"], p["phone"]) for p in found] == [("t_ayse", "none", "0532 123 45 67")]
    assert conn.execute("SELECT phone_hash FROM users WHERE username = 't_ayse'").fetchone()["phone_hash"] != "+905321234567"
    # Not searchable: not found
    client.patch("/v1/me/privacy", json={"searchable": False}, headers=auth(ayse))
    assert client.post("/v1/friends/contacts", json={"phones": ["05321234567"]}, headers=auth(ali)).json() == []


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
