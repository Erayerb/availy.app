from dataclasses import dataclass

import psycopg

# Purpose tags used by the mobile filter chips
TAGS = frozenset({"socializing", "coworking", "entertainment", "quiet", "food"})


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


def parse_ids(raw: str | None, max_count: int) -> list[int] | None:
    """Parse '3,1,2' into ids; None means no id filter."""
    if raw is None:
        return None
    try:
        ids = sorted({int(p) for p in raw.split(",") if p.strip()})
    except ValueError:
        raise ValueError("ids must be comma-separated integers") from None
    if len(ids) > max_count:
        raise ValueError(f"at most {max_count} ids allowed")
    return ids


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
        SELECT id, name, category, capacity, neighborhood, district, tags, popularity, always_busy,
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
    """All venues (id, popularity, always_busy) per district, ignoring bbox and filters."""
    rows = conn.execute(
        "SELECT id, popularity, always_busy, district FROM venues WHERE district = ANY(%s) ORDER BY id",
        (districts,),
    ).fetchall()
    result: dict[str, list[dict]] = {}
    for row in rows:
        result.setdefault(row["district"], []).append(row)
    return result


# Turkish letters folded to plain ASCII so "nisantasi" finds "Nişantaşı"
_TR_FROM = "ÇĞİIÖŞÜçğıöşüÂâÎîÛû"
_TR_TO = "cgiiosucgiosuaaiiuu"
_FOLD = str.maketrans(_TR_FROM, _TR_TO)


def fold_tr(text: str) -> str:
    return text.translate(_FOLD).lower()


def _folded_sql(column: str) -> str:
    """SQL twin of fold_tr (translate before lower avoids locale issues with İ)."""
    return f"lower(translate({column}, '{_TR_FROM}', '{_TR_TO}'))"


def escape_like(text: str) -> str:
    """Make %, _ and \\ match literally inside an ILIKE pattern."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_venues(
    conn: psycopg.Connection,
    query: str,
    district: str | None,
    tags: list[str],
    limit: int,
    ids: list[int] | None = None,
) -> list[dict]:
    """Venues whose name, neighborhood or district contains `query` (case- and Turkish-accent-insensitive),
    optionally filtered by district, tags and ids."""
    sql = """
        SELECT id, name, category, capacity, neighborhood, district, tags, popularity, always_busy,
               ST_Y(location::geometry) AS lat,
               ST_X(location::geometry) AS lon
        FROM venues
        WHERE (%(query)s = ''
               OR {name} LIKE '%%' || %(query)s || '%%'
               OR {neighborhood} LIKE '%%' || %(query)s || '%%'
               OR {district} LIKE '%%' || %(query)s || '%%')
          AND (%(district)s::text IS NULL OR district = %(district)s)
          AND (cardinality(%(tags)s::text[]) = 0 OR tags && %(tags)s::text[])
          AND (%(ids)s::bigint[] IS NULL OR id = ANY(%(ids)s::bigint[]))
        ORDER BY name COLLATE "tr-TR-x-icu"
        LIMIT %(limit)s
    """.format(
        name=_folded_sql("name"),
        neighborhood=_folded_sql("neighborhood"),
        district=_folded_sql("district"),
    )
    return conn.execute(
        sql,
        {"query": escape_like(fold_tr(query)), "district": district, "tags": tags, "ids": ids, "limit": limit},
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


def find_venue_profile(conn: psycopg.Connection, venue_id: int) -> dict | None:
    """Dummy occupancy settings of one venue: popularity and always_busy."""
    return conn.execute(
        "SELECT category, popularity, always_busy FROM venues WHERE id = %s", (venue_id,)
    ).fetchone()
