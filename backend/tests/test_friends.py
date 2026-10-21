def account(client, username):
    body = {"name": username.title(), "email": f"{username}@example.test", "password": "gizli123", "username": username}
    return client.post("/v1/auth/register", json=body).json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_search_by_username(client):
    eray = account(client, "t_mert")
    account(client, "t_mertt")
    account(client, "t_ayse")
    found = client.get("/v1/users/search", params={"q": "@t_mer"}, headers=auth(eray)).json()
    assert [p["username"] for p in found] == ["t_mertt"]  # not myself
    assert found[0]["relation"] == "none"
    # Guests cannot be found
    client.post("/v1/auth/guest")
    assert client.get("/v1/users/search", params={"q": "misafir"}, headers=auth(eray)).json() == []


def test_request_then_accept(client):
    eray, ayse = account(client, "t_mert"), account(client, "t_ayse")
    sent = client.post("/v1/friends", json={"username": "t_ayse"}, headers=auth(eray)).json()
    assert sent["relation"] == "outgoing"
    lists = client.get("/v1/friends", headers=auth(ayse)).json()
    assert [p["username"] for p in lists["incoming"]] == ["t_mert"] and lists["friends"] == []
    # Ayşe adds Eray back (e.g. scanning his QR): this accepts the request
    accepted = client.post("/v1/friends", json={"username": "t_mert"}, headers=auth(ayse)).json()
    assert accepted["relation"] == "friend"
    assert [p["username"] for p in client.get("/v1/friends", headers=auth(eray)).json()["friends"]] == ["t_ayse"]


def test_remove_friend(client):
    eray, ayse = account(client, "t_mert"), account(client, "t_ayse")
    ayse_id = client.post("/v1/friends", json={"username": "t_ayse"}, headers=auth(eray)).json()["id"]
    assert client.delete(f"/v1/friends/{ayse_id}", headers=auth(eray)).status_code == 204
    assert client.get("/v1/friends", headers=auth(ayse)).json()["incoming"] == []


def test_friend_errors(client):
    eray = account(client, "t_mert")
    assert client.post("/v1/friends", json={"username": "kimseyok"}, headers=auth(eray)).status_code == 404
    assert client.post("/v1/friends", json={"username": "t_mert"}, headers=auth(eray)).status_code == 400
    guest = client.post("/v1/auth/guest").json()["token"]
    response = client.post("/v1/friends", json={"username": "t_mert"}, headers=auth(guest))
    assert response.status_code == 403 and response.json()["detail"] == "Arkadaş eklemek için kayıt ol."


def test_friends_see_the_latest_public_checkin(client, conn):
    mert, ayse = account(client, "t_mert"), account(client, "t_ayse")
    client.post("/v1/friends", json={"username": "t_ayse"}, headers=auth(mert))
    client.post("/v1/friends", json={"username": "t_mert"}, headers=auth(ayse))
    ayse_id = client.get("/v1/me", headers=auth(ayse)).json()["id"]
    kafe, cowork = (
        conn.execute("SELECT id FROM venues WHERE name = %s", (name,)).fetchone()["id"]
        for name in ("Test Kafe A", "Test Cowork B")
    )
    assert client.get("/v1/friends", headers=auth(mert)).json()["friends"][0]["last_checkin"] is None
    for venue, minutes, private in ((kafe, 60, False), (cowork, 5, True)):
        checkin_id = conn.execute(
            "INSERT INTO checkins (venue_id, user_id, level, is_private, created_at) VALUES (%s, %s, 'low', %s, now() - %s * interval '1 minute') RETURNING id",
            (venue, ayse_id, private, minutes),
        ).fetchone()["id"]
        for amount, reason in ((10, "checkin"), (50, "first_checkin")):
            conn.execute(
                "INSERT INTO points (user_id, amount, reason, checkin_id) VALUES (%s, %s, %s, %s)",
                (ayse_id, amount, reason, checkin_id),
            )
    # The newer check-in is private, so the friend sees the café, not the co-working place
    last = client.get("/v1/friends", headers=auth(mert)).json()["friends"][0]["last_checkin"]
    assert last["venue_name"] == "Test Kafe A" and last["venue_id"] == kafe and last["points"] == 60
    assert last["is_first"] is False
