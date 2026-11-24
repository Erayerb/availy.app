"""🔔: the newer kinds (friend check-ins, approvals, rewards, decisions, the business's own)."""
from datetime import timedelta

from tests.test_business import account, auth, business_at
from tests.test_checkin_social import befriend
from tests.test_checkins import checkin, clock, venue_id  # noqa: F401 (clock is a fixture)


def kinds(client, token):
    return {n["kind"]: n for n in client.get("/v1/notifications", headers=auth(token)).json()}


def uid(conn, username):
    return conn.execute("SELECT id FROM users WHERE username = %s", (username,)).fetchone()["id"]


def test_a_friends_check_in_and_a_quiet_watched_venue(client, conn, clock):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    kafe = venue_id(conn, "Test Kafe A")
    # The bell on, then check-ins say Sakin
    conn.execute("INSERT INTO watches (user_id, venue_id, created_at) VALUES (%s, %s, %s)", (uid(conn, "t_ali"), kafe, clock.now))
    clock.now += timedelta(minutes=1)
    assert checkin(client, ayse, kafe, level="low").status_code == 201
    got = kinds(client, ali)
    assert got["friend_checkin"]["username"] == "t_ayse" and got["friend_checkin"]["venue_id"] == kafe
    assert got["watch_quiet"]["venue_id"] == kafe
    # Only friends hear it
    assert "friend_checkin" not in kinds(client, account(client, "t_yabanci"))


def test_personal_events(client, conn, clock):
    ali = account(client, "t_ali")
    me = uid(conn, "t_ali")
    kafe = venue_id(conn, "Test Kafe A")
    conn.execute(
        "UPDATE venues SET source = 'user', added_by = %s, approved_at = %s WHERE id = %s", (me, clock.now, kafe)
    )
    # Signed up through my link
    client.post(
        "/v1/auth/register",
        json={"email": "t_yeni@example.test", "password": "gizli123", "username": "t_yeni", "role": "personal", "invited_by": "t_ali"},
    )
    conn.execute("INSERT INTO weekly_winners (week_start, user_id, points) VALUES (%s, %s, 40)", ((clock.now - timedelta(days=10)).date(), me))
    conn.execute(
        "INSERT INTO support_messages (user_id, kind, topic, body, reply, replied_at) VALUES (%s, 'bug', 'Öneri', 'xxxxxxxxxx', 'Düzelttik', %s)",
        (me, clock.now),
    )
    got = kinds(client, ali)
    assert got["venue_approved"]["venue_id"] == kafe
    assert got["invite_joined"]["username"] == "t_yeni" and "friend_accepted" not in got
    assert got["weekly_winner"]["body"] == "40"
    assert got["support_reply"]["body"] == "Düzelttik"


def test_answering_support_from_the_admin_page(client, conn, clock):
    ali, admin = account(client, "t_ali"), account(client, "t_admin")
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_admin'")
    sent = {"kind": "bug", "topic": "Öneri", "body": "Harita bazen yavaş açılıyor", "email": "", "app_info": "test"}
    assert client.post("/v1/support", json=sent, headers=auth(ali)).status_code == 201
    assert client.get("/v1/admin/support", headers=auth(ali)).status_code == 403
    inbox = client.get("/v1/admin/support", headers=auth(admin)).json()
    message = next(m for m in inbox if m["username"] == "t_ali")
    assert client.post(f"/v1/admin/support/{message['id']}/reply", json={"text": "Teşekkürler, bakıyoruz"}, headers=auth(admin)).status_code == 204
    assert kinds(client, ali)["support_reply"]["body"] == "Teşekkürler, bakıyoruz"


def test_a_full_stamp_card(client, conn, clock):
    ali = account(client, "t_ali")
    kafe = venue_id(conn, "Test Kafe A")
    conn.execute("INSERT INTO loyalty_programs (venue_id, kind, stamps_required, reward) VALUES (%s, 'stamps', 2, 'Kahve')", (kafe,))
    conn.execute("INSERT INTO loyalty_members (venue_id, user_id, rewards, reward_at) VALUES (%s, %s, 1, now())", (kafe, uid(conn, "t_ali")))
    got = kinds(client, ali)["loyalty_reward"]
    assert (got["body"], got["done"]) == ("Kahve", False)


def test_the_business_hears_reviews_issues_and_its_sponsorship(client, conn, clock):
    token, kafe = business_at(client, conn)
    ali = account(client, "t_ali")
    assert checkin(client, ali, kafe).status_code == 201
    client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 4, "body": "Güzel"}, headers=auth(ali))
    conn.execute("INSERT INTO venue_issues (venue_id, user_id, kind) VALUES (%s, %s, 'hours')", (kafe, uid(conn, "t_ali")))
    conn.execute(
        "INSERT INTO sponsorships (venue_id, starts_at, ends_at) VALUES (%s, %s, %s)",
        (kafe, clock.now - timedelta(days=8), clock.now - timedelta(days=1)),
    )
    got = kinds(client, token)
    assert got["new_review"]["body"] == "4★ Güzel" and got["new_review"]["username"] == "t_ali"
    assert got["venue_issue"]["body"] == "hours"
    assert "sponsor_started" in got and "sponsor_ended" in got
    # Not for anyone else
    assert "new_review" not in kinds(client, ali)


def test_the_same_friend_at_the_same_place_again_that_day_is_one_item(client, conn, clock):
    from app.push import deliver

    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    client.put("/v1/me/push-token", json={"token": "ExponentPushToken[abc]", "platform": "ios"}, headers=auth(ali))
    out = []

    def post(batch):
        out.extend(batch)
        return []

    deliver(conn, clock.now, post)
    kafe = venue_id(conn, "Test Kafe A")
    # Discovered by someone else first (a discovery always stays in Akış)
    assert checkin(client, account(client, "t_yabanci"), kafe).status_code == 201
    clock.now += timedelta(minutes=1)
    assert checkin(client, ayse, kafe).status_code == 201
    clock.now += timedelta(minutes=1)
    deliver(conn, clock.now, post)
    clock.now += timedelta(hours=2)
    assert checkin(client, ayse, kafe).status_code == 201
    clock.now += timedelta(minutes=1)
    deliver(conn, clock.now, post)
    items = [n for n in client.get("/v1/notifications", headers=auth(ali)).json() if n["kind"] == "friend_checkin"]
    assert len(items) == 1  # the latest one
    assert len(out) == 2  # the phone hears each check-in
    # Akış: one post too (the earlier one had nothing on it)
    feed = client.get("/v1/feed", headers=auth(ali)).json()
    assert len([f for f in feed if f["kind"] == "checkin" and f["venue_id"] == kafe]) == 1


def test_a_liked_venue_starting_a_campaign(client, conn, clock):
    token, kafe = business_at(client, conn)
    fan, gone, other = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_yabanci")
    assert client.put(f"/v1/me/favorites/{kafe}", headers=auth(fan)).status_code == 204
    assert checkin(client, gone, kafe).status_code == 201
    clock.now += timedelta(minutes=5)
    body = {"message": "Önümüzdeki 2 saat tüm kahvelerde %20 indirim", "discount": 20, "radius_km": 2, "duration_hours": 2}
    assert client.post("/v1/campaigns", json=body, headers=auth(token)).status_code in (200, 201)
    clock.now += timedelta(minutes=1)
    for person in (fan, gone):
        got = kinds(client, person)["venue_campaign"]
        assert got["venue_id"] == kafe and got["body"] == body["message"]
    assert "venue_campaign" not in kinds(client, other)
