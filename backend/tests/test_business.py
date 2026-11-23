from datetime import timedelta

from tests.test_checkins import NEAR, NOON, checkin, clock, venue_id  # noqa: F401 (clock is a fixture)


def account(client, username, role="personal"):
    body = {"email": f"{username}@example.test", "password": "gizli123", "username": username, "role": role}
    return client.post("/v1/auth/register", json=body).json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def business_at(client, conn, username="t_isletme", venue="Test Kafe A", plan="saas"):
    """A business at the venue; on the monthly plan unless told (statistics and schedules need it)."""
    token = account(client, username, "business")
    vid = venue_id(conn, venue)
    assert client.put("/v1/me/venue", json={"venue_id": vid}, headers=auth(token)).status_code == 200
    assert client.put("/v1/business/plan", json={"plan": plan}, headers=auth(token)).status_code == 200
    return token, vid


def test_business_cannot_check_in_or_review_and_is_not_social(client, conn, clock):
    token, kafe = business_at(client, conn)
    response = checkin(client, token, kafe)
    assert response.status_code == 403 and "İşletme" in response.json()["detail"]
    assert client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 5}, headers=auth(token)).status_code == 403
    ali = account(client, "t_ali")
    assert client.get("/v1/users/search", params={"q": "t_is"}, headers=auth(ali)).json() == []
    everyone = client.get("/v1/leaderboard", params={"scope": "everyone"}, headers=auth(ali)).json()["rows"]
    assert "t_isletme" not in [r["username"] for r in everyone]


def test_business_replies_on_its_own_venue_with_the_mark(client, conn, visit):
    token, kafe = business_at(client, conn)
    ali = account(client, "t_ali")
    visit("t_ali", kafe)
    visit("t_ali", venue_id(conn, "Test Cowork B"))
    review = client.post(
        f"/v1/venues/{kafe}/reviews", json={"rating": 2, "body": "Soğuktu", "allow_replies": False}, headers=auth(ali)
    ).json()["items"][0]
    # Replies closed by the author, but the venue's business can still answer
    assert client.post(f"/v1/reviews/{review['id']}/replies", json={"body": "Özür dileriz"}, headers=auth(token)).status_code == 201
    reply = client.get(f"/v1/venues/{kafe}/reviews").json()["items"][0]["replies"][0]
    assert reply["is_business"] is True and reply["username"] == "t_isletme"
    # Not on a competitor's reviews
    other = client.post(f"/v1/venues/{venue_id(conn, 'Test Cowork B')}/reviews", json={"rating": 5}, headers=auth(ali)).json()
    assert client.post(f"/v1/reviews/{other['items'][0]['id']}/replies", json={"body": "Bize gelin"}, headers=auth(token)).status_code == 403


def test_panel_stats_from_check_ins(client, conn, clock):
    token, kafe = business_at(client, conn)
    regular, newcomer = account(client, "t_mudavim"), account(client, "t_yeni")
    clock.now = NOON - timedelta(days=10)
    checkin(client, regular, kafe, level="low")
    clock.now = NOON
    checkin(client, regular, kafe, level="high", queue=True)
    checkin(client, newcomer, kafe, level="medium")
    stats = client.get(f"/v1/venues/{kafe}/stats", headers=auth(token)).json()
    assert stats["today_checkins"] == 2 and stats["week_checkins"] == 2 and stats["total_checkins"] == 3
    assert stats["week_people"] == 2 and stats["week_returning"] == 1
    noon_hour = [h for h in stats["today"] if h["checkins"]]
    assert len(noon_hour) == 1 and noon_hour[0]["hour"] == 12 and noon_hour[0]["level"] == "high"  # (0.98 + 0.55) / 2
    assert sum(stats["weekday"]) == 3 and stats["discovered_by"]["username"] == "t_mudavim"
    # Only the venue's own business sees them
    assert client.get(f"/v1/venues/{kafe}/stats", headers=auth(regular)).status_code == 403
    assert client.put("/v1/me/venue", json={"venue_id": kafe}, headers=auth(regular)).status_code == 403


def test_a_venue_has_one_business(client, conn):
    first, kafe = business_at(client, conn)
    second = account(client, "t_ikinci", "business")
    taken = client.put("/v1/me/venue", json={"venue_id": kafe}, headers=auth(second))
    assert taken.status_code == 409 and "başka bir işletme" in taken.json()["detail"]
    assert client.put("/v1/me/venue", json={"venue_id": kafe}, headers=auth(first)).status_code == 200  # its own again
    taken_ids = client.get("/v1/venues/taken").json()
    assert kafe in taken_ids


def test_this_month_against_last_month(client, conn, clock):
    from zoneinfo import ZoneInfo

    ISTANBUL_TZ = ZoneInfo("Europe/Istanbul")
    token, kafe = business_at(client, conn)
    clock.now = NOON
    month_start = NOON.astimezone(ISTANBUL_TZ).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_day = (month_start - timedelta(days=1)).replace(day=1, hour=10)
    this_month_day = month_start.replace(hour=10)
    for at, n in ((last_month_day, 5), (this_month_day, 6)):
        for _ in range(n):
            conn.execute("INSERT INTO checkins (venue_id, level, created_at) VALUES (%s, 'low', %s)", (kafe, at))
    stats = client.get(f"/v1/venues/{kafe}/stats", headers=auth(token)).json()
    assert (stats["month_checkins"], stats["last_month_checkins"], stats["month_change_pct"]) == (6, 5, 20)
