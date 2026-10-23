"""Import real venues of the pilot areas from OpenStreetMap (Overpass API).

OpenStreetMap data is © OpenStreetMap contributors, licensed under the ODbL:
the app must show the attribution. Re-running updates venues by their OSM id
and never touches other venues (demo venues stay, they are only hidden in v2).

Run: docker compose run --rm backend python -m app.import_osm
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass

import psycopg
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema
from app.hours import parse_opening_hours

# Public Overpass servers; the next one is tried when one is busy
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
USER_AGENT = "availy-prototype (pilot venue import)"


@dataclass(frozen=True)
class Area:
    key: str
    bbox: str  # south,west,north,east
    neighborhood: str  # used when the venue has no address suburb
    district: str


PILOT_AREAS = [
    Area("nisantasi", "41.045,28.983,41.057,29.000", "Nişantaşı", "Şişli"),
    Area("caddebostan", "40.958,29.053,40.973,29.077", "Caddebostan", "Kadıköy"),
    Area("yeditepe", "40.964,29.138,40.981,29.166", "Kayışdağı", "Ataşehir"),
]

# OSM tag -> (availy category, purposes)
CATEGORIES = {
    "cafe": ("cafe", ["socializing"]),
    "restaurant": ("restaurant", ["food", "socializing"]),
    "bar": ("bar", ["entertainment", "nightlife", "socializing"]),
    "pub": ("bar", ["entertainment", "nightlife", "socializing"]),
    "nightclub": ("bar", ["entertainment", "nightlife"]),
    "library": ("library", ["quiet", "coworking"]),
    "coworking": ("coworking", ["coworking", "quiet"]),
    # leisure=park / garden, natural=beach
    "park": ("park", ["nature", "quiet"]),
    "beach": ("park", ["nature", "socializing"]),
}
DEFAULT_CAPACITY = 50


def overpass_query(bbox: str) -> str:
    return (
        f'[out:json][timeout:25];(nwr["amenity"~"^(cafe|restaurant|bar|pub|nightclub|library)$"]({bbox});'
        f'nwr["office"="coworking"]({bbox});nwr["amenity"="coworking_space"]({bbox});'
        f'nwr["leisure"~"^(park|garden)$"]["name"]({bbox});nwr["natural"="beach"]["name"]({bbox}););out tags center;'
    )


def fetch(bbox: str, attempts: int = 3) -> list[dict]:
    body = urllib.parse.urlencode({"data": overpass_query(bbox)}).encode()
    last_error: Exception | None = None
    for attempt in range(attempts):
        for url in OVERPASS_URLS:
            try:
                request = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(request, timeout=60) as response:
                    return json.loads(response.read())["elements"]
            except Exception as e:  # busy server, timeout, bad answer: try the next one
                last_error = e
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Overpass did not answer: {last_error}")


def venue_from_element(element: dict, area: Area) -> dict | None:
    """One OSM element -> a venue row, or None when it is unnamed or not a venue we show."""
    tags = element.get("tags", {})
    name = (tags.get("name:tr") or tags.get("name") or "").strip()
    kind = tags.get("amenity")
    if kind == "coworking_space" or tags.get("office") == "coworking":
        kind = "coworking"
    elif tags.get("leisure") in ("park", "garden"):
        kind = "park"
    elif tags.get("natural") == "beach":
        kind = "beach"
    if not name or kind not in CATEGORIES:
        return None
    lat = element.get("lat", element.get("center", {}).get("lat"))
    lon = element.get("lon", element.get("center", {}).get("lon"))
    if lat is None or lon is None:
        return None
    category, purposes = CATEGORIES[kind]
    purposes = list(purposes)
    if category == "cafe" and tags.get("internet_access") in ("yes", "wlan", "wifi"):
        purposes.append("coworking")
    hours = parse_opening_hours(tags.get("opening_hours"))
    return {
        "osm_id": f"{element['type']}/{element['id']}",
        "name": name,
        "category": category,
        "lat": lat,
        "lon": lon,
        "neighborhood": tags.get("addr:suburb") or tags.get("addr:neighbourhood") or area.neighborhood,
        "district": area.district,
        "tags": sorted(set(purposes)),
        "open_hour": hours[0] if hours else None,
        "close_hour": hours[1] if hours else None,
    }


def upsert(conn: psycopg.Connection, venue: dict) -> bool:
    """Insert or update by OSM id; True when the venue is new."""
    row = conn.execute(
        """
        INSERT INTO venues (osm_id, source, name, category, location, capacity, neighborhood, district, tags,
                            open_hour, close_hour)
        VALUES (%(osm_id)s, 'osm', %(name)s, %(category)s,
                ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography, %(capacity)s,
                %(neighborhood)s, %(district)s, %(tags)s, %(open_hour)s, %(close_hour)s)
        ON CONFLICT (osm_id) WHERE osm_id IS NOT NULL DO UPDATE SET
            name = EXCLUDED.name, category = EXCLUDED.category,
            -- What the venue's business corrected stays
            location = CASE WHEN venues.edited_by_business THEN venues.location ELSE EXCLUDED.location END,
            neighborhood = CASE WHEN venues.edited_by_business THEN venues.neighborhood ELSE EXCLUDED.neighborhood END,
            district = CASE WHEN venues.edited_by_business THEN venues.district ELSE EXCLUDED.district END,
            tags = EXCLUDED.tags,
            open_hour = EXCLUDED.open_hour, close_hour = EXCLUDED.close_hour
        RETURNING (xmax = 0) AS inserted
        """,
        {**venue, "capacity": DEFAULT_CAPACITY},
    ).fetchone()
    return row["inserted"]


def main() -> None:
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        apply_schema(conn)
        for area in PILOT_AREAS:
            elements = fetch(area.bbox)
            venues = [v for v in (venue_from_element(e, area) for e in elements) if v]
            new = sum(upsert(conn, v) for v in venues)
            print(f"{area.key}: {len(elements)} OSM elements, {len(venues)} venues ({new} new)")
            conn.commit()
            time.sleep(2)  # be gentle with the free servers
        total = conn.execute("SELECT count(*) AS n FROM venues WHERE source = 'osm'").fetchone()["n"]
    print(f"{total} OpenStreetMap venues in the database")


if __name__ == "__main__":
    sys.exit(main())
