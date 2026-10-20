import pytest

from tests.conftest import KADIKOY_BBOX


def get_venues(client, **params):
    response = client.get("/v1/venues", params={"bbox": KADIKOY_BBOX, **params})
    assert response.status_code == 200, response.text
    return {v["name"]: v for v in response.json()}


def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


def test_venues_in_bbox(client):
    assert set(get_venues(client)) == {"Test Kafe A", "Test Cowork B"}


def test_venue_fields(client):
    venue = get_venues(client)["Test Kafe A"]
    assert set(venue) == {
        "id", "name", "category", "capacity", "lat", "lon",
        "neighborhood", "district", "tags", "occupancy", "district_occupancy",
        "open_now", "hours", "opens_at", "crowd", "discovery",
    }
    assert venue["hours"] == "08:00–23:00"  # cafe
    assert venue["opens_at"] == "08:00"
    assert (venue["lat"], venue["lon"]) == (40.984, 29.026)
    assert (venue["neighborhood"], venue["district"]) == ("Moda", "Kadıköy")
    assert venue["tags"] == ["socializing"]


def test_venue_occupancy(client):
    assert get_venues(client)["Test Kafe A"]["occupancy"] == {
        "level": "low",
        "ratio": 0.2,
        "updated_at": "2026-10-12T10:00:00Z",
    }


def test_district_occupancy_includes_venues_outside_bbox(client):
    # Kadıköy: 0.2, 0.5 and 0.9 (outside bbox) -> mean 0.53
    venues = get_venues(client)
    expected = {"level": "medium", "ratio": 0.53}
    assert venues["Test Kafe A"]["district_occupancy"] == expected
    assert venues["Test Cowork B"]["district_occupancy"] == expected


@pytest.mark.parametrize(
    ("tags", "expected"),
    [
        ("socializing", {"Test Kafe A"}),
        ("quiet", {"Test Cowork B"}),
        ("socializing,quiet", {"Test Kafe A", "Test Cowork B"}),
        ("entertainment", set()),  # the only bar is outside the bbox
        ("", {"Test Kafe A", "Test Cowork B"}),
    ],
)
def test_filter_by_tags(client, tags, expected):
    assert set(get_venues(client, tags=tags)) == expected


def test_unknown_tag_rejected(client):
    response = client.get("/v1/venues", params={"bbox": KADIKOY_BBOX, "tags": "quiet,party"})
    assert response.status_code == 422
    assert "party" in response.text


def test_venues_empty_area(client):
    # Middle of the Mediterranean: no venues
    response = client.get("/v1/venues", params={"bbox": "18.0,34.0,19.0,35.0"})
    assert response.status_code == 200
    assert response.json() == []


def test_venues_invalid_bbox(client):
    response = client.get("/v1/venues", params={"bbox": "not,a,valid,bbox"})
    assert response.status_code == 422


def test_venues_missing_bbox(client):
    assert client.get("/v1/venues").status_code == 422


def test_hourly_profile_endpoint(client, conn):
    venue_id = next(i for i, r in conn.ratios_by_id.items() if r == 0.2)
    response = client.get(f"/v1/venues/{venue_id}/hourly")
    assert response.status_code == 200
    body = response.json()
    assert body["venue_id"] == venue_id
    assert [h["hour"] for h in body["hours"]] == list(range(24))
    # Cafe: closed at night, open in the afternoon
    assert body["hours"][3]["open"] is False and body["hours"][15]["open"] is True
    # The fixed test provider returns the same ratio at every hour
    assert {h["ratio"] for h in body["hours"]} == {0.2}


def test_hourly_profile_unknown_venue(client):
    assert client.get("/v1/venues/999999/hourly").status_code == 404


def test_forecast_endpoint(client, conn):
    venue_id = next(i for i, r in conn.ratios_by_id.items() if r == 0.2)
    body = client.get(f"/v1/venues/{venue_id}/forecast", params={"hours": 2}).json()
    points = body["points"]
    # One point per 5-minute step, all in the future and in order
    assert len(points) == 24
    assert points == sorted(points, key=lambda p: p["at"])
    assert {p["ratio"] for p in points} == {0.2}
    assert all(isinstance(p["open"], bool) for p in points)
    assert client.get("/v1/venues/999999/forecast").status_code == 404
    assert client.get(f"/v1/venues/{venue_id}/forecast", params={"hours": 48}).status_code == 422


def test_history_endpoint(client, conn):
    venue_id = next(iter(conn.ratios_by_id))
    body = client.get(f"/v1/venues/{venue_id}/history", params={"days": 7}).json()
    assert len(body["daily"]) == 7 and len(body["weekday"]) == 7
    # The fixed test provider returns the same ratio at every hour
    assert {d["ratio"] for d in body["daily"]} == {conn.ratios_by_id[venue_id]}
    assert client.get("/v1/venues/999999/history").status_code == 404


def test_cors_allows_only_known_web_pages(client):
    allowed = client.options(
        "/v1/me",
        headers={"Origin": "https://erayerb.github.io", "Access-Control-Request-Method": "GET"},
    )
    assert allowed.headers.get("access-control-allow-origin") == "https://erayerb.github.io"
    other = client.options(
        "/v1/me", headers={"Origin": "https://example.com", "Access-Control-Request-Method": "GET"}
    )
    assert "access-control-allow-origin" not in other.headers
