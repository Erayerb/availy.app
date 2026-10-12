from dataclasses import dataclass

import psycopg

# Purpose tags used by the mobile filter chips
TAGS = frozenset({"socializing", "coworking", "entertainment", "quiet"})


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


def parse_tags(raw: str | None) -> list[str]:
    """Parse 'quiet,coworking'; empty means no filter. Raise ValueError on unknown tags."""
    if not raw:
        return []
    tags = sorted({t.strip() for t in raw.split(",") if t.strip()})
    unknown = set(tags) - TAGS
    if unknown:
        raise ValueError(f"unknown tags: {', '.join(sorted(unknown))}")
    return tags


def find_venues_in_bbox(
    conn: psycopg.Connection, bbox: BBox, limit: int, tags: list[str] | None = None
) -> list[dict]:
    """Venues inside bbox; with tags, only venues having at least one of them."""
    return conn.execute(
        """
        SELECT id, name, category, capacity, neighborhood, district, tags, popularity,
               ST_Y(location::geometry) AS lat,
               ST_X(location::geometry) AS lon
        FROM venues
        WHERE location && ST_MakeEnvelope(%(min_lon)s, %(min_lat)s, %(max_lon)s, %(max_lat)s, 4326)::geography
          AND (cardinality(%(tags)s::text[]) = 0 OR tags && %(tags)s::text[])
        ORDER BY id
        LIMIT %(limit)s
        """,
        {
            "min_lon": bbox.min_lon,
            "min_lat": bbox.min_lat,
            "max_lon": bbox.max_lon,
            "max_lat": bbox.max_lat,
            "tags": tags or [],
            "limit": limit,
        },
    ).fetchall()


def find_venues_by_district(conn: psycopg.Connection, districts: list[str]) -> dict[str, list[dict]]:
    """All venues (id, popularity) per district, ignoring bbox and filters."""
    rows = conn.execute(
        "SELECT id, popularity, district FROM venues WHERE district = ANY(%s) ORDER BY id",
        (districts,),
    ).fetchall()
    result: dict[str, list[dict]] = {}
    for row in rows:
        result.setdefault(row["district"], []).append(row)
    return result


def escape_like(text: str) -> str:
    """Make %, _ and \\ match literally inside an ILIKE pattern."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_venues(
    conn: psycopg.Connection,
    query: str,
    district: str | None,
    tags: list[str],
    limit: int,
) -> list[dict]:
    """Venues whose name contains `query` (case-insensitive), optionally by district and tags."""
    return conn.execute(
        """
        SELECT id, name, category, capacity, neighborhood, district, tags, popularity,
               ST_Y(location::geometry) AS lat,
               ST_X(location::geometry) AS lon
        FROM venues
        WHERE (%(query)s = '' OR name ILIKE '%%' || %(query)s || '%%')
          AND (%(district)s::text IS NULL OR district = %(district)s)
          AND (cardinality(%(tags)s::text[]) = 0 OR tags && %(tags)s::text[])
        ORDER BY name COLLATE "tr-TR-x-icu"
        LIMIT %(limit)s
        """,
        {"query": escape_like(query), "district": district, "tags": tags, "limit": limit},
    ).fetchall()


def list_districts(conn: psycopg.Connection) -> list[str]:
    rows = conn.execute(
        """
        SELECT district FROM venues
        WHERE district <> ''
        GROUP BY district
        ORDER BY district COLLATE "tr-TR-x-icu"
        """
    ).fetchall()
    return [row["district"] for row in rows]
