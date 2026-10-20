def account(client, username):
    body = {"name": username.title(), "email": f"{username}@example.test", "password": "gizli123", "username": username}
    return client.post("/v1/auth/register", json=body).json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_search_by_username(client):
    eray = account(client, "eray")
    account(client, "erayy")
    account(client, "ayse")
    found = client.get("/v1/users/search", params={"q": "@era"}, headers=auth(eray)).json()
    assert [p["username"] for p in found] == ["erayy"]  # not myself
    assert found[0]["relation"] == "none"
    # Guests cannot be found
    client.post("/v1/auth/guest")
    assert client.get("/v1/users/search", params={"q": "misafir"}, headers=auth(eray)).json() == []


def test_request_then_accept(client):
    eray, ayse = account(client, "eray"), account(client, "ayse")
    sent = client.post("/v1/friends", json={"username": "ayse"}, headers=auth(eray)).json()
    assert sent["relation"] == "outgoing"
    lists = client.get("/v1/friends", headers=auth(ayse)).json()
    assert [p["username"] for p in lists["incoming"]] == ["eray"] and lists["friends"] == []
    # Ayşe adds Eray back (e.g. scanning his QR): this accepts the request
    accepted = client.post("/v1/friends", json={"username": "eray"}, headers=auth(ayse)).json()
    assert accepted["relation"] == "friend"
    assert [p["username"] for p in client.get("/v1/friends", headers=auth(eray)).json()["friends"]] == ["ayse"]


def test_remove_friend(client):
    eray, ayse = account(client, "eray"), account(client, "ayse")
    ayse_id = client.post("/v1/friends", json={"username": "ayse"}, headers=auth(eray)).json()["id"]
    assert client.delete(f"/v1/friends/{ayse_id}", headers=auth(eray)).status_code == 204
    assert client.get("/v1/friends", headers=auth(ayse)).json()["incoming"] == []


def test_friend_errors(client):
    eray = account(client, "eray")
    assert client.post("/v1/friends", json={"username": "kimseyok"}, headers=auth(eray)).status_code == 404
    assert client.post("/v1/friends", json={"username": "eray"}, headers=auth(eray)).status_code == 400
    guest = client.post("/v1/auth/guest").json()["token"]
    response = client.post("/v1/friends", json={"username": "eray"}, headers=auth(guest))
    assert response.status_code == 403 and response.json()["detail"] == "Arkadaş eklemek için kayıt ol."
