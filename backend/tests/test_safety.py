def account(client, username):
    body = {"email": f"{username}@example.test", "password": "gizli123", "username": username}
    return client.post("/v1/auth/register", json=body).json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def befriend(client, a, b, a_name, b_name):
    client.post("/v1/friends", json={"username": b_name}, headers=auth(a))
    client.post("/v1/friends", json={"username": a_name}, headers=auth(b))


def kafe(conn):
    return conn.execute("SELECT id FROM venues WHERE name = 'Test Kafe A'").fetchone()["id"]


def checkin(conn, client, token, venue, private=False, first=False):
    uid = client.get("/v1/me", headers=auth(token)).json()["id"]
    conn.execute(
        "INSERT INTO checkins (venue_id, user_id, level, is_private, is_first) VALUES (%s, %s, 'low', %s, %s)",
        (venue, uid, private, first),
    )


def test_profile_shows_venues_to_me_and_friends_only(client, conn):
    ali, ayse, can = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_can")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    checkin(conn, client, ayse, kafe(conn), first=True)
    checkin(conn, client, ayse, conn.execute("SELECT id FROM venues WHERE name = 'Test Cowork B'").fetchone()["id"], private=True)
    friend_view = client.get("/v1/users/t_ayse", headers=auth(ali)).json()
    assert friend_view["relation"] == "friend" and friend_view["checkins"] == 2
    assert [(v["venue_name"], v["discovered"]) for v in friend_view["venues"]] == [("Test Kafe A", True)]  # private left out
    assert client.get("/v1/users/t_ayse", headers=auth(can)).json()["venues"] is None  # not a friend
    own = client.get("/v1/users/t_ayse", headers=auth(ayse)).json()
    assert own["relation"] == "self" and len(own["venues"]) == 2 and len(own["badges"]) == len(friend_view["badges"])
    assert client.get("/v1/users/yokboyle", headers=auth(ali)).status_code == 404


def test_block_ends_friendship_and_hides_both_ways(client, conn):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    review = client.post(f"/v1/venues/{kafe(conn)}/reviews", json={"rating": 5, "body": "Süper"}, headers=auth(ayse)).json()
    assert client.post("/v1/users/t_ayse/block", headers=auth(ali)).status_code == 204
    assert client.get("/v1/friends", headers=auth(ali)).json()["friends"] == []
    assert client.get(f"/v1/venues/{kafe(conn)}/reviews", headers=auth(ali)).json()["count"] == 0
    assert client.get(f"/v1/venues/{kafe(conn)}/reviews").json()["count"] == 1  # others still see it
    assert client.get("/v1/users/t_ali", headers=auth(ayse)).status_code == 404
    assert client.post("/v1/friends", json={"username": "t_ali"}, headers=auth(ayse)).status_code == 404
    assert client.post("/v1/friends", json={"username": "t_ayse"}, headers=auth(ali)).status_code == 403
    assert client.post(f"/v1/reviews/{review['items'][0]['id']}/replies", json={"body": "?"}, headers=auth(ali)).status_code == 403
    assert [b["username"] for b in client.get("/v1/me/blocked", headers=auth(ali)).json()] == ["t_ayse"]
    client.delete("/v1/users/t_ayse/block", headers=auth(ali))
    assert client.get(f"/v1/venues/{kafe(conn)}/reviews", headers=auth(ali)).json()["count"] == 1


def test_mute_keeps_the_friend_out_of_the_feed(client, conn):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    client.post(f"/v1/venues/{kafe(conn)}/reviews", json={"rating": 4}, headers=auth(ayse))
    assert len(client.get("/v1/feed", headers=auth(ali)).json()) == 1
    client.post("/v1/users/t_ayse/mute", headers=auth(ali))
    assert client.get("/v1/feed", headers=auth(ali)).json() == []
    assert client.get("/v1/users/t_ayse", headers=auth(ali)).json()["muted"] is True
    assert client.get("/v1/friends", headers=auth(ali)).json()["friends"] != []  # still friends
    client.delete("/v1/users/t_ayse/mute", headers=auth(ali))
    assert len(client.get("/v1/feed", headers=auth(ali)).json()) == 1


def test_reported_review_is_hidden_for_the_reporter_then_for_everyone(client, conn):
    author = account(client, "t_yazar")
    review = client.post(f"/v1/venues/{kafe(conn)}/reviews", json={"rating": 1, "body": "reklam"}, headers=auth(author)).json()
    review_id = review["items"][0]["id"]
    assert client.post(f"/v1/reviews/{review_id}/report", json={"reason": "spam"}, headers=auth(author)).status_code == 400
    reporters = [account(client, f"t_sikayet{i}") for i in range(3)]
    client.post(f"/v1/reviews/{review_id}/report", json={"reason": "spam"}, headers=auth(reporters[0]))
    assert client.get(f"/v1/venues/{kafe(conn)}/reviews", headers=auth(reporters[0])).json()["count"] == 0
    assert client.get(f"/v1/venues/{kafe(conn)}/reviews").json()["count"] == 1
    for token in reporters[1:]:
        client.post(f"/v1/reviews/{review_id}/report", json={"reason": "insult"}, headers=auth(token))
    assert client.get(f"/v1/venues/{kafe(conn)}/reviews").json()["count"] == 0  # 3 reports: hidden for all
    guest = client.post("/v1/auth/guest").json()["token"]
    assert client.post(f"/v1/reviews/{review_id}/report", json={"reason": "spam"}, headers=auth(guest)).status_code == 403


def test_reported_reply(client, conn):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    review = client.post(f"/v1/venues/{kafe(conn)}/reviews", json={"rating": 5}, headers=auth(ali)).json()["items"][0]
    reply = client.post(f"/v1/reviews/{review['id']}/replies", json={"body": "kötü söz"}, headers=auth(ayse)).json()
    assert client.post(f"/v1/replies/{reply['id']}/report", json={"reason": "insult"}, headers=auth(ali)).status_code == 204
    items = client.get(f"/v1/venues/{kafe(conn)}/reviews", headers=auth(ali)).json()["items"]
    assert items[0]["replies"] == []
