from dataclasses import dataclass

import psycopg


@dataclass(frozen=True)
class BBox:
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float


def parse_bbox(raw: str) -> BBox:
    """Parse 'minLon,minLat,maxLon,maxLat'; raise ValueError if invalid."""
    parts = raw.split(",")
    if len(parts) != 4:
        raise ValueError("bbox must have 4 comma-separated numbers")
    try:
        min_lon, min_lat, max_lon, max_lat = (float(p) for p in parts)
    except ValueError:
        raise ValueError("bbox values must be numbers") from None
    if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180):
        raise ValueError("longitude must be between -180 and 180")
    if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
        raise ValueError("latitude must be between -90 and 90")
    if min_lon >= max_lon or min_lat >= max_lat:
        raise ValueError("min values must be smaller than max values")
    return BBox(min_lon, min_lat, max_lon, max_lat)


def find_venues_in_bbox(conn: psycopg.Connection, bbox: BBox, limit: int) -> list[dict]:
    return conn.execute(
        """
        SELECT id, name, category, capacity,
               ST_Y(location::geometry) AS lat,
               ST_X(location::geometry) AS lon
        FROM venues
        WHERE location && ST_MakeEnvelope(%s, %s, %s, %s, 4326)::geography
        ORDER BY id
        LIMIT %s
        """,
        (bbox.min_lon, bbox.min_lat, bbox.max_lon, bbox.max_lat, limit),
    ).fetchall()
