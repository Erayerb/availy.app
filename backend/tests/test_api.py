from tests.conftest import KADIKOY_BBOX


def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


def test_venues_in_bbox(client):
    response = client.get("/v1/venues", params={"bbox": KADIKOY_BBOX})
    assert response.status_code == 200
    names = {v["name"] for v in response.json()}
    assert names == {"Test Kafe A", "Test Cowork B"}


def test_venue_fields(client):
    venue = client.get("/v1/venues", params={"bbox": KADIKOY_BBOX}).json()[0]
    assert set(venue) == {"id", "name", "category", "capacity", "lat", "lon", "occupancy"}
    assert venue["lat"] == 40.984
    assert venue["lon"] == 29.026


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


def test_venue_occupancy(client):
    venues = client.get("/v1/venues", params={"bbox": KADIKOY_BBOX}).json()
    by_name = {v["name"]: v["occupancy"] for v in venues}
    assert by_name["Test Kafe A"] == {
        "level": "medium",
        "ratio": 0.5,
        "updated_at": "2026-10-12T10:00:00Z",
    }
    assert "people" not in by_name["Test Cowork B"]
