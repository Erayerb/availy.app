"""availo+ and the newer notifications: push delivery, friends' reviews, favourites turning quiet,
the monthly summary and the profile (cover photo, frame)."""
from datetime import timedelta

from app.push import deliver, text
from tests.test_business import account, auth
from tests.test_checkin_social import befriend
from tests.test_checkins import checkin, clock, venue_id  # noqa: F401 (clock is a fixture)

PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="


def plus(conn, username):
    conn.execute("UPDATE users SET plan = 'premium' WHERE username = %s", (username,))


def test_new_items_go_to_the_phone_once_and_honour_the_settings(client, conn, clock):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    token = "ExponentPushToken[abc]"
    assert client.put("/v1/me/push-token", json={"token": "x", "platform": "ios"}, headers=auth(ali)).status_code == 400
    assert client.put("/v1/me/push-token", json={"token": token, "platform": "ios"}, headers=auth(ali)).status_code == 204
    out = []

    def post(batch):
        out.extend(batch)
        return []

    deliver(conn, clock.now, post)  # the first time only sets the marker
    clock.now += timedelta(minutes=1)
    kafe = venue_id(conn, "Test Kafe A")
    assert checkin(client, ayse, kafe).status_code == 201
    clock.now += timedelta(minutes=1)
    deliver(conn, clock.now, post)
    assert [m["body"] for m in out] == ["@t_ayse şu an Test Kafe A mekanında. Sen de katıl!"]
    assert out[0]["to"] == token and out[0]["data"] == {"venueId": kafe}
    deliver(conn, clock.now, post)  # not twice
    assert len(out) == 1
    # Turned off in Bildirim ayarları: not sent (still in the 🔔 list)
    conn.execute("UPDATE users SET app_settings = '{\"friendCheckinNotifications\": false}' WHERE username = 't_ali'")
    clock.now += timedelta(hours=2)
    checkin(client, ayse, venue_id(conn, "Test Cowork B"))
    clock.now += timedelta(minutes=1)
    deliver(conn, clock.now, post)
    assert len(out) == 1
    # Signed out on that phone: forgotten
    assert client.request("DELETE", "/v1/me/push-token", json={"token": token}, headers=auth(ali)).status_code == 204
    assert conn.execute("SELECT count(*)::int AS n FROM push_tokens").fetchone()["n"] == 0


def test_every_kind_has_a_phone_text():
    from typing import get_args

    from app.social_api import NotificationOut

    for kind in get_args(NotificationOut.model_fields["kind"].annotation):
        assert text({"kind": kind, "username": "a", "venue_name": "V", "body": "b"}) != "Yeni bir bildirimin var.", kind


def test_a_friends_review(client, conn, clock):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    kafe = venue_id(conn, "Test Kafe A")
    checkin(client, ayse, kafe)
    client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 5, "body": "Harika"}, headers=auth(ayse))
    got = {n["kind"]: n for n in client.get("/v1/notifications", headers=auth(ali)).json()}
    assert got["friend_review"]["body"] == "5★ Harika"


def test_a_favourite_turning_quiet_is_told_with_availo_plus(client, conn, clock):
    ali, a, b = account(client, "t_ali"), account(client, "t_a"), account(client, "t_b")
    kafe = venue_id(conn, "Test Kafe A")
    assert client.put(f"/v1/me/favorites/{kafe}", headers=auth(ali)).status_code == 204
    checkin(client, a, kafe, level="high")
    clock.now += timedelta(minutes=95)
    checkin(client, b, kafe, level="low")

    def kinds():
        return [n["kind"] for n in client.get("/v1/notifications", headers=auth(ali)).json()]

    assert "favorite_quiet" not in kinds()  # not availo+
    plus(conn, "t_ali")
    assert "favorite_quiet" not in kinds()  # not turned on
    conn.execute("UPDATE users SET app_settings = '{\"favoriteQuietNotifications\": true}' WHERE username = 't_ali'")
    assert "favorite_quiet" in kinds()


def test_monthly_summary(client, conn, clock):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    assert client.get("/v1/me/monthly-summary", headers=auth(ali)).status_code == 402
    plus(conn, "t_ali")
    kafe, cowork = venue_id(conn, "Test Kafe A"), venue_id(conn, "Test Cowork B")
    checkin(client, ali, kafe)
    clock.now += timedelta(hours=1)
    checkin(client, ali, cowork)
    clock.now += timedelta(hours=1)
    assert checkin(client, ali, kafe).status_code == 201
    summary = client.get("/v1/me/monthly-summary", headers=auth(ali)).json()
    assert summary["checkins"] == 3 and summary["venues"] == 2
    assert summary["top_venues"][0]["name"] == "Test Kafe A" and summary["top_venues"][0]["visits"] == 2
    assert summary["top_districts"] == [{"district": "Kadıköy", "visits": 3}]
    assert (summary["friends"], summary["rank_among_friends"], summary["friends_average"]) == (1, 1, 0.0)


def test_cover_photo_and_frame_are_availo_plus(client, conn, clock):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    assert client.put("/v1/me/cover", json={"photo": PHOTO}, headers=auth(ali)).status_code == 402
    assert client.put("/v1/me/frame", json={"color": "gold"}, headers=auth(ali)).status_code == 402
    plus(conn, "t_ali")
    assert client.put("/v1/me/cover", json={"photo": PHOTO}, headers=auth(ali)).status_code == 200
    assert client.put("/v1/me/frame", json={"color": "rainbow"}, headers=auth(ali)).status_code == 400
    assert client.put("/v1/me/frame", json={"color": "gold"}, headers=auth(ali)).status_code == 204
    seen = client.get("/v1/users/t_ali", headers=auth(ayse)).json()
    assert seen["plus"] and seen["frame_color"] == "gold" and seen["cover_at"]
    assert client.get("/v1/users/t_ali/cover").status_code == 200
    # availo+ ended: kept, not shown
    conn.execute("UPDATE users SET plan = NULL WHERE username = 't_ali'")
    seen = client.get("/v1/users/t_ali", headers=auth(ayse)).json()
    assert (seen["plus"], seen["frame_color"], seen["cover_at"]) == (False, None, None)
    assert client.get("/v1/users/t_ali/cover").status_code == 404


def test_the_business_hears_about_its_coupons_and_finished_campaigns(client, conn, clock):
    from tests.test_business import business_at
    from tests.test_campaigns import CAMPAIGN

    token, _ = business_at(client, conn)
    campaign = client.post("/v1/campaigns", json={**CAMPAIGN, "max_claims": 5}, headers=auth(token)).json()
    codes = [client.post(f"/v1/campaigns/{campaign['id']}/coupon", headers=auth(account(client, f"t_m{i}"))).json()["code"] for i in range(4)]
    client.post("/v1/coupons/redeem", json={"code": codes[0]}, headers=auth(token))
    clock.now += timedelta(hours=3)  # the campaign ran 2 hours
    got = {n["kind"]: n for n in client.get("/v1/notifications", headers=auth(token)).json()}
    assert got["coupon_limit"]["body"] == "4/5"
    assert "coupon_redeemed" in got
    assert got["campaign_ended"]["body"] == "0,4,1"
    assert text(got["campaign_ended"]) == "Kampanyan bitti: 0 kişi gördü, 4 kupon alındı, 1 kullanıldı."


def test_four_quiet_days_bring_one_reminder_and_the_while_away_card(client, conn, clock):
    from app.reminders import remind_inactive

    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    kafe = venue_id(conn, "Test Kafe A")
    conn.execute("UPDATE users SET created_at = %s WHERE username IN ('t_ali', 't_ayse')", (clock.now - timedelta(days=10),))
    checkin(client, ali, kafe)
    opened = clock.now
    clock.now += timedelta(days=4, hours=1)
    checkin(client, ayse, kafe)
    while clock.now.hour != 9:  # 12:00 in Istanbul: daytime
        clock.now += timedelta(hours=1)
    remind_inactive(conn, clock.now)
    remind_inactive(conn, clock.now)  # once per quiet spell
    mine = [n for n in client.get("/v1/notifications", headers=auth(ali)).json() if n["kind"] == "comeback"]
    assert len(mine) == 1 and "Arkadaşların bu arada 1 farklı yere gitti" in mine[0]["body"]
    away = client.get("/v1/me/while-away", params={"since": opened.isoformat()}, headers=auth(ali)).json()
    assert away["friend_checkins"] == 1 and away["friend_places"] == ["Test Kafe A"] and away["notifications"] >= 1
