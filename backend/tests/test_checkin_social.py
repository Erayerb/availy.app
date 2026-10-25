from tests.test_business import account, auth
from tests.test_checkins import checkin, clock, venue_id  # noqa: F401 (clock is a fixture)


def befriend(client, a, b, a_name, b_name):
    client.post("/v1/friends", json={"username": b_name}, headers=auth(a))
    client.post("/v1/friends", json={"username": a_name}, headers=auth(b))


def test_note_likes_and_comments_on_a_checkin(client, conn, clock):
    ali, ayse, stranger = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_yabanci")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    kafe = venue_id(conn, "Test Kafe A")
    done = checkin(client, ali, kafe).json()
    assert client.patch(f"/v1/checkins/{done['id']}/note", json={"note": "  Kahve harika  "}, headers=auth(ali)).json()["note"] == "Kahve harika"
    assert client.patch(f"/v1/checkins/{done['id']}/note", json={"note": "benim değil"}, headers=auth(ayse)).status_code == 404
    # A friend likes and comments; a stranger cannot
    assert client.put(f"/v1/checkins/{done['id']}/like", json={"liked": True}, headers=auth(ayse)).status_code == 204
    assert client.put(f"/v1/checkins/{done['id']}/like", json={"liked": True}, headers=auth(stranger)).status_code == 404
    assert client.post(f"/v1/checkins/{done['id']}/comments", json={"body": "Ben de geliyorum"}, headers=auth(ayse)).status_code == 201
    assert client.post(f"/v1/checkins/{done['id']}/comments", json={"body": "?"}, headers=auth(stranger)).status_code == 404
    item = [i for i in client.get("/v1/feed", headers=auth(ayse)).json() if i["kind"] == "checkin"][0]
    assert (item["body"], item["likes"], item["liked"]) == ("Kahve harika", 1, True)
    assert [(c["username"], c["body"], c["mine"]) for c in item["comments"]] == [("t_ayse", "Ben de geliyorum", True)]
    kinds = [n["kind"] for n in client.get("/v1/notifications", headers=auth(ali)).json()]
    assert "checkin_like" in kinds and "checkin_comment" in kinds
    # Unlike; the owner may delete a comment on their check-in
    client.put(f"/v1/checkins/{done['id']}/like", json={"liked": False}, headers=auth(ayse))
    client.delete(f"/v1/checkin-comments/{item['comments'][0]['id']}", headers=auth(ali))
    item = [i for i in client.get("/v1/feed", headers=auth(ayse)).json() if i["kind"] == "checkin"][0]
    assert (item["likes"], item["comments"]) == (0, [])
