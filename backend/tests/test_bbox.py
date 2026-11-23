import pytest

from app.venues import BBox, parse_bbox


def test_parse_valid_bbox():
    assert parse_bbox("29.0,40.9,29.1,41.0") == BBox(29.0, 40.9, 29.1, 41.0)


@pytest.mark.parametrize(
    "raw",
    [
        "29.0,40.9,29.1",  # too few values
        "a,b,c,d",  # not numbers
        "200,40,201,41",  # longitude out of range
        "29,95,30,96",  # latitude out of range
        "29.1,40.9,29.0,41.0",  # min > max
        "29.0,40.9,29.0,41.0",  # zero width
    ],
)
def test_parse_invalid_bbox(raw):
    with pytest.raises(ValueError):
        parse_bbox(raw)


def test_a_zoomed_out_map_shows_every_part_of_the_box(client, conn, monkeypatch):
    """More venues than the limit: they are spread over the box, not all from its busiest corner."""
    from app.config import settings

    # A busy corner (many popular venues) and a quiet corner (one venue) in the same box
    for i in range(6):
        conn.execute(
            """INSERT INTO venues (name, category, capacity, location, neighborhood, district, popularity, source)
               VALUES (%s, 'cafe', 40, ST_SetSRID(ST_MakePoint(%s, 41.000), 4326)::geography, 'A', 'Şişli', 0.9, 'osm')""",
            (f"Kalabalık köşe {i}", 29.000 + i * 0.0001),
        )
    conn.execute(
        """INSERT INTO venues (name, category, capacity, location, neighborhood, district, popularity, source)
           VALUES ('Sakin köşe', 'cafe', 40, ST_SetSRID(ST_MakePoint(29.090, 41.090), 4326)::geography, 'B', 'Şişli', 0.1, 'osm')"""
    )
    monkeypatch.setattr(settings, "max_venues_per_request", 3)
    names = [v["name"] for v in client.get("/v1/venues", params={"bbox": "28.99,40.99,29.10,41.10"}).json()]
    assert len(names) == 3 and "Sakin köşe" in names
