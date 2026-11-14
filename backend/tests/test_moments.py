import base64
from datetime import timedelta

from tests.test_business import account, auth
from tests.test_checkins import NOON, clock  # noqa: F401 (clock is a fixture)
from tests.test_reviews import venue

PHOTO = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff" + b"x" * 100).decode()


def checkin(conn, username, venue_id, at, private=False):
    return conn.execute(
        """
        INSERT INTO checkins (venue_id, user_id, level, is_private, created_at)
        SELECT %s, id, 'high', %s, %s FROM users WHERE username = %s RETURNING id
        """,
        (venue_id, private, at, username),
    ).fetchone()["id"]


def befriend(client, a, b, a_name, b_name):
    client.post("/v1/friends", json={"username": b_name}, headers=auth(a))
    client.post("/v1/friends", json={"username": a_name}, headers=auth(b))


def points(conn, username):
    return conn.execute(
        "SELECT COALESCE(sum(amount), 0) AS p FROM points p JOIN users u ON u.id = p.user_id WHERE u.username = %s AND reason = 'moment'",
        (username,),
    ).fetchone()["p"]


def test_a_moment_shows_for_24_hours_with_points(client, conn, clock):
    kafe, ali = venue(conn), account(client, "t_ali")
    own = checkin(conn, "t_ali", kafe, NOON)
    clock.now = NOON + timedelta(minutes=5)
    added = client.post(f"/v1/checkins/{own}/moment", json={"photo": PHOTO}, headers=auth(ali))
    assert added.status_code == 201 and added.json()["points"] == 5 and added.json()["audience"] == "everyone"
    assert points(conn, "t_ali") == 5
    # One per check-in
    assert client.post(f"/v1/checkins/{own}/moment", json={"photo": PHOTO}, headers=auth(ali)).status_code == 409
    # Anyone sees it, signed in or not, with the level reported at that moment
    shown = client.get(f"/v1/venues/{kafe}/moments").json()
    assert [(m["username"], m["level"]) for m in shown] == [("t_ali", "high")]
    # The 📸 count on the venue itself (venue lists use the real clock, the test a fixed day)
    conn.execute("UPDATE moment_photos SET expires_at = now() + interval '1 hour'")
    by_id = client.get("/v1/venues/search", params={"ids": str(kafe)}).json()
    assert by_id[0]["moments"] == 1
    conn.execute("UPDATE moment_photos SET expires_at = %s", (NOON + timedelta(hours=24, minutes=5),))
    image = client.get(f"/v1/moments/{shown[0]['id']}/image")
    assert image.status_code == 200 and image.headers["content-type"] == "image/jpeg"
    # A day later it is gone
    clock.now = NOON + timedelta(hours=24, minutes=6)
    assert client.get(f"/v1/venues/{kafe}/moments").json() == []
    assert client.get(f"/v1/moments/{shown[0]['id']}/image").status_code == 404


def test_only_at_the_moment_of_ones_own_checkin(client, conn, clock):
    kafe, ali, veli = venue(conn), account(client, "t_ali"), account(client, "t_veli")
    own = checkin(conn, "t_ali", kafe, NOON)
    clock.now = NOON + timedelta(minutes=5)
    assert client.post(f"/v1/checkins/{own}/moment", json={"photo": PHOTO}, headers=auth(veli)).status_code == 404
    clock.now = NOON + timedelta(hours=2)
    late = client.post(f"/v1/checkins/{own}/moment", json={"photo": PHOTO}, headers=auth(ali))
    assert late.status_code == 400
    guest = client.post("/v1/auth/guest").json()["token"]
    assert client.post(f"/v1/checkins/{own}/moment", json={"photo": PHOTO}, headers=auth(guest)).status_code == 403


def test_friends_only_photos_and_private_checkins(client, conn, clock):
    kafe = venue(conn)
    ali, ayse, veli = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_veli")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    clock.now = NOON + timedelta(minutes=1)
    friends_only = checkin(conn, "t_ali", kafe, NOON)
    client.post(f"/v1/checkins/{friends_only}/moment", json={"photo": PHOTO, "audience": "friends"}, headers=auth(ali))
    # The default from Gizlilik ayarları
    client.patch("/v1/me/privacy", json={"moment_audience": "friends"}, headers=auth(veli))
    assert client.get("/v1/me", headers=auth(veli)).json()["moment_audience"] == "friends"
    secret = checkin(conn, "t_veli", kafe, NOON, private=True)
    assert client.post(f"/v1/checkins/{secret}/moment", json={"photo": PHOTO}, headers=auth(veli)).json()["audience"] == "friends"
    assert client.get(f"/v1/venues/{kafe}/moments").json() == []
    seen = client.get(f"/v1/venues/{kafe}/moments", headers=auth(ayse)).json()
    assert [m["username"] for m in seen] == ["t_ali"]
    # Veli's own friends-only photo from a private check-in: he sees it, without his name
    mine = client.get(f"/v1/venues/{kafe}/moments", headers=auth(veli)).json()
    assert [(m["username"], m["mine"]) for m in mine] == [(None, True)]
    assert client.get(f"/v1/moments/{seen[0]['id']}/image").status_code == 404


def test_two_reports_hide_it_and_removal_takes_the_points(client, conn, clock):
    kafe = venue(conn)
    ali, a, b = account(client, "t_ali"), account(client, "t_a"), account(client, "t_b")
    admin = account(client, "t_yonetici")
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_yonetici'")
    clock.now = NOON + timedelta(minutes=1)
    photo = client.post(f"/v1/checkins/{checkin(conn, 't_ali', kafe, NOON)}/moment", json={"photo": PHOTO}, headers=auth(ali)).json()["id"]
    assert client.post(f"/v1/moments/{photo}/report", json={"reason": "person"}, headers=auth(ali)).status_code == 400
    client.post(f"/v1/moments/{photo}/report", json={"reason": "person"}, headers=auth(a))
    assert len(client.get(f"/v1/venues/{kafe}/moments").json()) == 1
    client.post(f"/v1/moments/{photo}/report", json={"reason": "spam"}, headers=auth(b))
    assert client.get(f"/v1/venues/{kafe}/moments").json() == []
    assert client.get("/v1/admin/moments", headers=auth(a)).status_code == 403
    listed = client.get("/v1/admin/moments", headers=auth(admin)).json()
    assert listed[0]["id"] == photo and listed[0]["reports"] == 2 and listed[0]["hidden_at"]
    # Restored: back on the page
    client.post(f"/v1/admin/moments/{photo}", json={"keep": True}, headers=auth(admin))
    assert len(client.get(f"/v1/venues/{kafe}/moments").json()) == 1
    # Removed: the photo and its points go
    client.post(f"/v1/admin/moments/{photo}", json={"keep": False}, headers=auth(admin))
    assert client.get(f"/v1/venues/{kafe}/moments").json() == [] and points(conn, "t_ali") == 0


def test_the_author_deletes_and_the_daily_limit(client, conn, clock):
    kafe, ali = venue(conn), account(client, "t_ali")
    clock.now = NOON + timedelta(minutes=1)
    ids = []
    for i in range(5):
        r = client.post(f"/v1/checkins/{checkin(conn, 't_ali', kafe, NOON)}/moment", json={"photo": PHOTO}, headers=auth(ali))
        assert r.status_code == 201
        ids.append(r.json()["id"])
    sixth = client.post(f"/v1/checkins/{checkin(conn, 't_ali', kafe, NOON)}/moment", json={"photo": PHOTO}, headers=auth(ali))
    assert sixth.status_code == 429
    assert client.delete(f"/v1/moments/{ids[0]}", headers=auth(ali)).status_code == 204
    assert len(client.get(f"/v1/venues/{kafe}/moments").json()) == 4
