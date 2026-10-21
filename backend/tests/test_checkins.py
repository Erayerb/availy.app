from datetime import datetime, timedelta, timezone

import pytest

from app.checkins import CHECKIN_RADIUS_M, HOURLY_LIMIT, validate_report
from app.checkins_api import get_clock
from app.main import app

# 12:00 in Istanbul: cafes are open, bars (17:00-03:00) are closed
NOON = datetime(2026, 10, 14, 9, 0, tzinfo=timezone.utc)
# Test Kafe A in conftest.py
KAFE_LAT, KAFE_LON = 40.9840, 29.0260
# About 50 m north of it, and 100 m beyond the check-in limit (1° of latitude ≈ 111 km)
NEAR = {"lat": KAFE_LAT + 0.00045, "lon": KAFE_LON}
FAR = {"lat": KAFE_LAT + (CHECKIN_RADIUS_M + 100) / 111_000, "lon": KAFE_LON}


class Clock:
    def __init__(self, now):
        self.now = now

    def __call__(self):
        return self.now


@pytest.fixture
def clock(client):
    c = Clock(NOON)
    app.dependency_overrides[get_clock] = c
    return c


def venue_id(conn, name):
    return conn.execute("SELECT id FROM venues WHERE name = %s", (name,)).fetchone()["id"]


def guest_token(client):
    return client.post("/v1/auth/guest").json()["token"]


def checkin(client, token, venue, **body):
    payload = {"level": "medium", **NEAR, **body}
    return client.post(f"/v1/venues/{venue}/checkins", json=payload, headers={"Authorization": f"Bearer {token}"})


def test_report_rules():
    assert validate_report("high", True, None) is None
    assert validate_report("medium", None, False) is None
    assert validate_report("low", None, None) is None
    assert "Kalabalık" in validate_report("low", True, None)
    assert "Orta" in validate_report("high", None, True)
    assert validate_report("full", None, None) is not None


def test_checkin_near_an_open_venue(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    response = checkin(client, guest_token(client), kafe, level="high", queue=True)
    assert response.status_code == 201
    body = response.json()
    assert body["venue_id"] == kafe and body["level"] == "high" and body["queue"] is True
    # The very first check-in of the venue
    assert body["is_first"] is True


def test_location_is_not_stored(client, conn, clock):
    checkin(client, guest_token(client), venue_id(conn, "Test Kafe A"))
    columns = {r["column_name"] for r in conn.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'checkins'"
    ).fetchall()}
    assert not columns & {"lat", "lon", "location"}


def test_only_the_first_checkin_is_first(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    assert checkin(client, guest_token(client), kafe).json()["is_first"] is True
    assert checkin(client, guest_token(client), kafe).json()["is_first"] is False


def test_needs_sign_in(client, conn, clock):
    response = client.post(f"/v1/venues/{venue_id(conn, 'Test Kafe A')}/checkins", json={"level": "low", **NEAR})
    assert response.status_code == 401


def test_too_far_from_the_venue(client, conn, clock):
    response = checkin(client, guest_token(client), venue_id(conn, "Test Kafe A"), **FAR)
    assert response.status_code == 403
    assert f"{CHECKIN_RADIUS_M} m" in response.json()["detail"]


def test_closed_venue(client, conn, clock):
    bar = venue_id(conn, "Test Bar Uzak")
    lat, lon = conn.execute(
        "SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon FROM venues WHERE id = %s", (bar,)
    ).fetchone().values()
    response = checkin(client, guest_token(client), bar, level="low", lat=lat, lon=lon)
    assert response.status_code == 409
    assert response.json()["detail"] == "Mekan şu an kapalı."


def test_unknown_venue(client, clock):
    assert checkin(client, guest_token(client), 999999).status_code == 404


def test_follow_up_question_must_match_the_level(client, conn, clock):
    response = checkin(client, guest_token(client), venue_id(conn, "Test Kafe A"), level="low", queue=True)
    assert response.status_code == 400


def test_same_venue_once_every_two_hours(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    token = guest_token(client)
    assert checkin(client, token, kafe).status_code == 201
    clock.now = NOON + timedelta(hours=1, minutes=59)
    again = checkin(client, token, kafe)
    assert again.status_code == 429
    # 12:00 + 2 h = 14:00 Istanbul
    assert again.json()["detail"].endswith("Tekrar: 14:00")
    clock.now = NOON + timedelta(hours=2)
    assert checkin(client, token, kafe).status_code == 201
    # Someone else is not affected
    assert checkin(client, guest_token(client), kafe).status_code == 201


def test_at_most_ten_checkins_in_sixty_minutes(client, conn, clock):
    token = guest_token(client)
    user_id = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"}).json()["id"]
    other = venue_id(conn, "Test Cowork B")
    # Ten check-ins at another venue during the last hour
    for minutes in range(HOURLY_LIMIT):
        conn.execute(
            "INSERT INTO checkins (venue_id, user_id, level, created_at) VALUES (%s, %s, 'low', %s)",
            (other, user_id, NOON - timedelta(minutes=minutes * 5)),
        )
    kafe = venue_id(conn, "Test Kafe A")
    blocked = checkin(client, token, kafe)
    assert blocked.status_code == 429
    assert "10" in blocked.json()["detail"]
    # The rolling window: once the oldest is more than 60 minutes old, it works again
    clock.now = NOON + timedelta(minutes=16)
    assert checkin(client, token, kafe).status_code == 201


def me(client, token):
    return client.get("/v1/me", headers={"Authorization": f"Bearer {token}"}).json()


def user_token(client, email):
    body = {"name": "Kullanıcı", "email": email, "password": "gizli123", "username": email.split("@")[0]}
    return client.post("/v1/auth/register", json=body).json()["token"]


def test_points_and_badges(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    first_user, second_user = user_token(client, "bir@example.test"), user_token(client, "iki@example.test")
    first = checkin(client, first_user, kafe).json()
    assert first["is_first"] and first["points_earned"] == 60  # 10 + 50 first check-in bonus
    second = checkin(client, second_user, kafe).json()
    assert not second["is_first"] and second["points_earned"] == 10
    stats = me(client, first_user)
    assert stats["points"] == 60 and stats["checkins"] == 1 and stats["discoveries"] == 1
    earned = {b["id"] for b in stats["badges"] if b["earned"]}
    assert earned == {"first_step", "explorer"}
    great = next(b for b in stats["badges"] if b["id"] == "great_explorer")
    assert (great["progress"], great["target"], great["earned"]) == (1, 5, False)
    assert {b["id"] for b in me(client, second_user)["badges"] if b["earned"]} == {"first_step"}


def test_guests_get_half_points_and_keep_them_after_sign_up(client, conn, clock):
    token = guest_token(client)
    assert checkin(client, token, venue_id(conn, "Test Kafe A")).json()["points_earned"] == 30  # (10 + 50) / 2
    body = {"name": "Ayşe", "email": "ayse.kasif@example.test", "password": "gizli123", "username": "ayse.kasif"}
    client.post("/v1/auth/upgrade", json=body, headers={"Authorization": f"Bearer {token}"})
    stats = me(client, token)
    assert not stats["is_guest"] and stats["points"] == 30
    assert any(b["id"] == "explorer" and b["earned"] for b in stats["badges"])
    # From now on full points
    assert checkin(client, token, venue_id(conn, "Test Cowork B"), lat=40.9880, lon=29.0330).json()["points_earned"] == 60


def test_venue_shows_who_discovered_it_for_30_days(client, conn, clock):
    from app.checkins import load_discoveries

    kafe = venue_id(conn, "Test Kafe A")
    token = guest_token(client)
    name = me(client, token)["name"]
    checkin(client, token, kafe)
    assert load_discoveries(conn, [kafe], NOON + timedelta(days=29))[kafe]["name"] == name
    assert load_discoveries(conn, [kafe], NOON + timedelta(days=31)) == {}


def test_discovery_has_the_user_name(client, conn, clock):
    from app.checkins import load_discoveries

    kafe = venue_id(conn, "Test Kafe A")
    body = {"email": "t_kasif@example.test", "password": "gizli123", "username": "t_kasif"}
    token = client.post("/v1/auth/register", json=body).json()["token"]
    checkin(client, token, kafe)
    assert load_discoveries(conn, [kafe], NOON)[kafe]["username"] == "t_kasif"


def test_visitor_rank_and_visits(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    tokens = [guest_token(client) for _ in range(3)]
    ranks = [checkin(client, t, kafe).json()["visitor_rank"] for t in tokens]
    assert ranks == [1, 2, 3]
    clock.now = NOON + timedelta(hours=3)
    again = checkin(client, tokens[0], kafe).json()
    assert again["visitor_rank"] is None and again["my_visits"] == 2
    visits = client.get("/v1/me/visits", headers={"Authorization": f"Bearer {tokens[0]}"}).json()
    assert visits == [{"venue_id": kafe, "visits": 2, "last_at": visits[0]["last_at"]}]


def test_private_checkin_hides_the_name(client, conn, clock):
    from app.checkins import load_discoveries

    kafe = venue_id(conn, "Test Kafe A")
    body = checkin(client, guest_token(client), kafe, private=True).json()
    assert body["is_private"] and body["is_first"]
    found = load_discoveries(conn, [kafe], NOON)[kafe]
    assert found["name"] is None and found["username"] is None
    # It still counts for the occupancy
    from app.checkins import load_crowds

    assert load_crowds(conn, [kafe], NOON)[kafe].reporters == 1


def trust_of(conn, token, client):
    user_id = me(client, token)["id"]
    return conn.execute("SELECT trust FROM users WHERE id = %s", (user_id,)).fetchone()["trust"]


def test_trust_drops_when_contradicting_others(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    for i in range(2):
        checkin(client, user_token(client, f"sakin{i}@example.test"), kafe, level="low")
    liar = user_token(client, "yalanci@example.test")
    checkin(client, liar, kafe, level="high")  # Kalabalık while two others say Sakin
    assert trust_of(conn, liar, client) == 0.9


def test_trust_rises_when_agreeing(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    for i in range(2):
        checkin(client, user_token(client, f"sakin{i}@example.test"), kafe, level="low")
    honest = user_token(client, "dogru@example.test")
    conn.execute("UPDATE users SET trust = 0.5 WHERE email = 'dogru@example.test'")
    checkin(client, honest, kafe, level="low")
    assert trust_of(conn, honest, client) == 0.52


def test_trust_needs_two_other_reports(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    checkin(client, user_token(client, "tek@example.test"), kafe, level="low")
    lone = user_token(client, "yalniz@example.test")
    checkin(client, lone, kafe, level="high")
    assert trust_of(conn, lone, client) == 1


def test_trust_has_a_floor(client, conn, clock):
    from app.checkins import TRUST_FLOOR, update_trust

    kafe = venue_id(conn, "Test Kafe A")
    for i in range(2):
        checkin(client, user_token(client, f"sakin{i}@example.test"), kafe, level="low")
    token = user_token(client, "dibe@example.test")
    user = conn.execute("SELECT id, is_guest FROM users WHERE email = 'dibe@example.test'").fetchone()
    for _ in range(12):
        update_trust(conn, user, kafe, "high", NOON)
    assert trust_of(conn, token, client) == TRUST_FLOOR
