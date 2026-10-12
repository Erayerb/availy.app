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
    }
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
