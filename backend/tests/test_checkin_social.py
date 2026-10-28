from tests.test_business import account, auth
from tests.test_checkins import checkin, clock, venue_id  # noqa: F401 (clock is a fixture)


def befriend(client, a, b, a_name, b_name):
    client.post("/v1/friends", json={"username": b_name}, headers=auth(a))
    client.post("/v1/friends", json={"username": a_name}, headers=auth(b))


def test_review_likes_and_comments_on_a_checkin(client, conn, clock):
    ali, ayse, stranger = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_yabanci")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    kafe = venue_id(conn, "Test Kafe A")
    done = checkin(client, ali, kafe).json()
    # "Burası nasıl?" right after the check-in: a review that shows with the check-in in Akış
    review = {"rating": 5, "body": "  Kahve harika  ", "checkin_id": done["id"]}
    assert client.post(f"/v1/venues/{kafe}/reviews", json=review, headers=auth(ayse)).status_code in (403, 404)
    mine = client.post(f"/v1/venues/{kafe}/reviews", json=review, headers=auth(ali)).json()["items"][0]
    assert (mine["rating"], mine["body"]) == (5, "Kahve harika")
    # A friend likes and comments; a stranger cannot
    assert client.put(f"/v1/checkins/{done['id']}/like", json={"liked": True}, headers=auth(ayse)).status_code == 204
    assert client.put(f"/v1/checkins/{done['id']}/like", json={"liked": True}, headers=auth(stranger)).status_code == 404
    assert client.post(f"/v1/checkins/{done['id']}/comments", json={"body": "Ben de geliyorum"}, headers=auth(ayse)).status_code == 201
    assert client.post(f"/v1/checkins/{done['id']}/comments", json={"body": "?"}, headers=auth(stranger)).status_code == 404
    item = [i for i in client.get("/v1/feed", headers=auth(ayse)).json() if i["kind"] == "checkin"][0]
    assert (item["body"], item["rating"], item["likes"], item["liked"]) == ("Kahve harika", 5, 1, True)
    # Not a second time as a review of its own
    assert [i["kind"] for i in client.get("/v1/feed", headers=auth(ayse)).json()].count("review") == 0
    assert [(c["username"], c["body"], c["mine"]) for c in item["comments"]] == [("t_ayse", "Ben de geliyorum", True)]
    kinds = [n["kind"] for n in client.get("/v1/notifications", headers=auth(ali)).json()]
    assert "checkin_like" in kinds and "checkin_comment" in kinds
    # Unlike; the owner may delete a comment on their check-in
    client.put(f"/v1/checkins/{done['id']}/like", json={"liked": False}, headers=auth(ayse))
    client.delete(f"/v1/checkin-comments/{item['comments'][0]['id']}", headers=auth(ali))
    item = [i for i in client.get("/v1/feed", headers=auth(ayse)).json() if i["kind"] == "checkin"][0]
    assert (item["likes"], item["comments"]) == (0, [])


def test_edit_my_review(client, conn, clock):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    kafe = venue_id(conn, "Test Kafe A")
    checkin(client, ali, kafe)
    review = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 3, "body": "İdare eder"}, headers=auth(ali)).json()["items"][0]
    changed = client.patch(f"/v1/reviews/{review['id']}", json={"rating": 4, "body": "Aslında iyi"}, headers=auth(ali)).json()
    assert (changed["items"][0]["rating"], changed["items"][0]["body"]) == (4, "Aslında iyi")
    assert client.patch(f"/v1/reviews/{review['id']}", json={"rating": 1, "body": "x"}, headers=auth(ayse)).status_code == 404


def test_feed_keeps_bare_check_ins_two_days_and_shows_three_days(client, conn, clock):
    from datetime import timedelta

    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    kafe = venue_id(conn, "Test Kafe A")
    uid = conn.execute("SELECT id FROM users WHERE username = 't_ali'").fetchone()["id"]

    def old_checkin(days, liked=False):
        row = conn.execute(
            "INSERT INTO checkins (venue_id, user_id, level, created_at) VALUES (%s, %s, 'low', %s) RETURNING id",
            (kafe, uid, clock.now - timedelta(days=days)),
        ).fetchone()
        if liked:
            ayse_id = conn.execute("SELECT id FROM users WHERE username = 't_ayse'").fetchone()["id"]
            conn.execute("INSERT INTO checkin_likes (checkin_id, user_id) VALUES (%s, %s)", (row["id"], ayse_id))
        return row["id"]

    fresh, bare_old, liked_old, week_old = old_checkin(1), old_checkin(2.5), old_checkin(2.5, liked=True), old_checkin(5, liked=True)
    shown = lambda days="": [i["checkin_id"] for i in client.get(f"/v1/feed{days}", headers=auth(ayse)).json()]  # noqa: E731
    assert set(shown()) == {fresh, liked_old}  # 3 days; the bare one of 2.5 days is gone
    assert set(shown("?days=7")) == {fresh, liked_old, week_old}  # "Daha eski"


def test_my_feed_has_only_my_activity(client, conn, clock):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    kafe = venue_id(conn, "Test Kafe A")
    mine = checkin(client, ali, kafe).json()
    theirs = checkin(client, ayse, kafe).json()
    client.put(f"/v1/checkins/{mine['id']}/like", json={"liked": True}, headers=auth(ayse))
    # Akış: mine, with Ayşe's like; Arkadaşlarım: only Ayşe's
    item = client.get("/v1/feed?who=me", headers=auth(ali)).json()
    assert [(i["checkin_id"], i["likes"]) for i in item] == [(mine["id"], 1)]
    assert [i["checkin_id"] for i in client.get("/v1/feed", headers=auth(ali)).json()] == [theirs["id"]]
    assert item[0]["likers"] == ["t_ayse"]
    # A reply under my review shows attached to it
    review = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 4, "body": "Güzel", "checkin_id": mine["id"]}, headers=auth(ali)).json()["items"][0]
    client.post(f"/v1/reviews/{review['id']}/replies", json={"body": "Katılıyorum"}, headers=auth(ayse))
    [item] = client.get("/v1/feed?who=me", headers=auth(ali)).json()
    assert [(r["username"], r["body"]) for r in item["replies"]] == [("t_ayse", "Katılıyorum")]


def test_my_feed_goes_back_30_days(client, conn, clock):
    from datetime import timedelta

    ali = account(client, "t_ali")
    kafe = venue_id(conn, "Test Kafe A")
    uid = conn.execute("SELECT id FROM users WHERE username = 't_ali'").fetchone()["id"]
    ids = [
        conn.execute(
            "INSERT INTO checkins (venue_id, user_id, level, created_at) VALUES (%s, %s, 'low', %s) RETURNING id",
            (kafe, uid, clock.now - timedelta(days=d)),
        ).fetchone()["id"]
        for d in (6, 20)
    ]
    mine = lambda days: [i["checkin_id"] for i in client.get(f"/v1/feed?who=me&days={days}", headers=auth(ali)).json()]  # noqa: E731
    assert mine(7) == ids[:1] and mine(30) == ids
