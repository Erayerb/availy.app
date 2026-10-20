from datetime import datetime, timedelta, timezone

import pytest

from app.checkins import HOURLY_LIMIT, validate_report
from app.checkins_api import get_clock
from app.main import app

# 12:00 in Istanbul: cafes are open, bars (17:00-03:00) are closed
NOON = datetime(2026, 10, 14, 9, 0, tzinfo=timezone.utc)
# Test Kafe A in conftest.py
KAFE_LAT, KAFE_LON = 40.9840, 29.0260
# About 50 m and 250 m north of it (limit: 150 m)
NEAR = {"lat": KAFE_LAT + 0.00045, "lon": KAFE_LON}
FAR = {"lat": KAFE_LAT + 0.00225, "lon": KAFE_LON}


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
    assert "150 m" in response.json()["detail"]


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
