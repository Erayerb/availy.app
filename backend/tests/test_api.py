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
        "neighborhood", "district", "tags",
        "open_now", "hours", "opens_at", "crowd", "discovery", "trend",
        "pending", "photo_at", "instagram", "phone", "verified", "address", "description", "amenity_keys",
    }
    assert venue["hours"] == "08:00–23:00"  # cafe
    assert venue["opens_at"] == "08:00"
    assert (venue["lat"], venue["lon"]) == (40.984, 29.026)
    assert (venue["neighborhood"], venue["district"]) == ("Moda", "Kadıköy")
    assert venue["tags"] == ["socializing"]


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
