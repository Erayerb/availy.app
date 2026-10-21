def account(client, username):
    body = {"email": f"{username}@example.test", "password": "gizli123", "username": username}
    return client.post("/v1/auth/register", json=body).json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def venue(conn, name="Test Kafe A"):
    return conn.execute("SELECT id FROM venues WHERE name = %s", (name,)).fetchone()["id"]


def test_two_reviews_per_person_and_venue(client, conn):
    kafe, ali = venue(conn), account(client, "t_ali")
    first = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 4, "body": " Kahvesi güzel "}, headers=auth(ali))
    assert first.status_code == 201
    assert first.json()["items"][0]["body"] == "Kahvesi güzel" and first.json()["items"][0]["mine"] is True
    client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 2, "body": "Bugün kalabalıktı"}, headers=auth(ali))
    third = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 5}, headers=auth(ali))
    assert third.status_code == 409 and "en fazla 2" in third.json()["detail"]
    public = client.get(f"/v1/venues/{kafe}/reviews").json()
    assert public["count"] == 2 and public["average"] == 3.0
    assert [r["body"] for r in public["items"]] == ["Bugün kalabalıktı", "Kahvesi güzel"]
    assert public["items"][0]["username"] == "t_ali" and public["items"][0]["mine"] is False


def test_review_rules(client, conn):
    kafe = venue(conn)
    guest = client.post("/v1/auth/guest").json()["token"]
    assert client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 5}, headers=auth(guest)).status_code == 403
    ali = account(client, "t_ali")
    assert client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 6}, headers=auth(ali)).status_code == 400
    assert client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 5, "body": "x" * 281}, headers=auth(ali)).status_code == 400
    assert client.post("/v1/venues/999999/reviews", json={"rating": 5}, headers=auth(ali)).status_code == 404


def test_replies_and_their_permission(client, conn):
    kafe, ali, ayse = venue(conn), account(client, "t_ali"), account(client, "t_ayse")
    review = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 5, "body": "Harika"}, headers=auth(ali)).json()["items"][0]
    reply = client.post(f"/v1/reviews/{review['id']}/replies", json={"body": "Katılıyorum"}, headers=auth(ayse))
    assert reply.status_code == 201
    replies = client.get(f"/v1/venues/{kafe}/reviews", headers=auth(ayse)).json()["items"][0]["replies"]
    assert [(r["username"], r["body"], r["mine"]) for r in replies] == [("t_ayse", "Katılıyorum", True)]
    assert client.post(f"/v1/reviews/{review['id']}/replies", json={"body": "  "}, headers=auth(ayse)).status_code == 400

    # The author closes replies: others cannot answer, the author still can
    client.delete(f"/v1/reviews/{review['id']}", headers=auth(ali))
    closed = client.post(
        f"/v1/venues/{kafe}/reviews", json={"rating": 3, "body": "Fena değil", "allow_replies": False}, headers=auth(ali)
    ).json()["items"][0]
    assert client.post(f"/v1/reviews/{closed['id']}/replies", json={"body": "?"}, headers=auth(ayse)).status_code == 403
    assert client.post(f"/v1/reviews/{closed['id']}/replies", json={"body": "Ek: tatlılar iyi"}, headers=auth(ali)).status_code == 201


def test_only_own_reviews_and_replies_can_be_deleted(client, conn):
    kafe, ali, ayse = venue(conn), account(client, "t_ali"), account(client, "t_ayse")
    review = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 5}, headers=auth(ali)).json()["items"][0]
    reply = client.post(f"/v1/reviews/{review['id']}/replies", json={"body": "Evet"}, headers=auth(ayse)).json()
    client.delete(f"/v1/replies/{reply['id']}", headers=auth(ali))  # not Ali's reply: nothing happens
    client.delete(f"/v1/reviews/{review['id']}", headers=auth(ayse))  # not Ayşe's review
    assert client.get(f"/v1/venues/{kafe}/reviews").json()["items"][0]["replies"] != []
    client.delete(f"/v1/replies/{reply['id']}", headers=auth(ayse))
    client.delete(f"/v1/reviews/{review['id']}", headers=auth(ali))
    assert client.get(f"/v1/venues/{kafe}/reviews").json()["count"] == 0


def test_feed_has_friends_checkins_reviews_and_replies(client, conn):
    kafe, ali, ayse, other = venue(conn), account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_yabanci")
    client.post("/v1/friends", json={"username": "t_ayse"}, headers=auth(ali))
    client.post("/v1/friends", json={"username": "t_ali"}, headers=auth(ayse))
    ayse_id = client.get("/v1/me", headers=auth(ayse)).json()["id"]
    conn.execute(
        "INSERT INTO checkins (venue_id, user_id, level, is_first, created_at) VALUES (%s, %s, 'low', true, now() - interval '3 hours')",
        (kafe, ayse_id),
    )
    review = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 4, "body": "Sakin"}, headers=auth(ayse)).json()["items"][0]
    stranger = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 1}, headers=auth(other)).json()["items"]
    client.post(f"/v1/reviews/{[r for r in stranger if r['username'] == 't_yabanci'][0]['id']}/replies", json={"body": "Neden?"}, headers=auth(ayse))
    feed = client.get("/v1/feed", headers=auth(ali)).json()
    assert [(f["kind"], f["username"]) for f in feed] == [("reply", "t_ayse"), ("review", "t_ayse"), ("checkin", "t_ayse")]
    assert feed[0]["review_author"] == "t_yabanci" and feed[1]["rating"] == 4 and feed[2]["is_first"] is True
    # Reviews and replies carry the review to answer from the feed
    assert feed[1]["review_id"] == review["id"] and feed[1]["allow_replies"] is True
    # Ayşe stops sharing her check-ins: they leave the feed
    client.patch("/v1/me/privacy", json={"share_checkins": False}, headers=auth(ayse))
    assert [f["kind"] for f in client.get("/v1/feed", headers=auth(ali)).json()] == ["reply", "review"]
    assert review["id"]
    # Not friends: nothing from Ayşe
    assert client.get("/v1/feed", headers=auth(other)).json() == []
