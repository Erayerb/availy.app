"""Places from open data that are not on availo's map yet ("aday" places).

The full list is kept hidden: the map shows only venues people use. A search can still find a
candidate ("Haritada yok mu? · Ekle ve check-in yap"), and adding it makes a normal venue, marked
with its source. A candidate that matches a venue already on the map (same name, within 50 m) is
linked to it instead, so the same place never appears twice.
"""
import csv
import re
from datetime import date, datetime
from difflib import SequenceMatcher

import psycopg

from app.venues import _FOLD

MIN_CONFIDENCE = 0.6
SAME_PLACE_M = 50

# Overture's taxonomy → availo's categories
CATEGORY = {
    "library": "library",
    "coworking_space": "coworking",
    "bar": "bar", "pub": "bar", "cocktail_bar": "bar", "wine_bar": "bar", "lounge": "bar", "beer_bar": "bar",
    "brewery": "bar", "hookah_bar": "bar",
}
RESTAURANT_HINTS = ("restaurant", "food", "kebab", "pizza", "burger", "steak", "sushi", "grill", "creperie")


def availo_category(raw: str) -> str:
    raw = (raw or "").lower()
    if raw in CATEGORY:
        return CATEGORY[raw]
    if any(h in raw for h in RESTAURANT_HINTS):
        return "restaurant"
    return "cafe"  # cafés, coffee, bakeries, patisseries, ice cream, tea houses, juice bars


class CandidateError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", (name or "").translate(_FOLD).lower()).strip()


def same_name(a: str, b: str) -> bool:
    x, y = _norm(a), _norm(b)
    return bool(x and y) and (x == y or x in y or y in x or SequenceMatcher(None, x, y).ratio() >= 0.8)


def import_csv(conn: psycopg.Connection, path: str) -> dict:
    """Load a CSV made by scripts/fetch_overture_places.py (id|name|category|confidence|sources|...|lat|lon)."""
    added = skipped = 0
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="|"):
            confidence = float(row.get("confidence") or 0)
            if not row.get("name") or confidence < MIN_CONFIDENCE:
                skipped += 1
                continue
            conn.execute(
                """
                INSERT INTO place_candidates (id, name, category, raw_category, location, confidence, sources)
                VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s, %s)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category,
                    raw_category = EXCLUDED.raw_category, location = EXCLUDED.location,
                    confidence = EXCLUDED.confidence, sources = EXCLUDED.sources
                """,
                (row["id"], row["name"], availo_category(row["category"]), row["category"], float(row["lon"]),
                 float(row["lat"]), confidence, row.get("sources")),
            )
            added += 1
    linked = link_existing(conn)
    return {"imported": added, "skipped": skipped, "linked_to_venues": linked}


FRESH_YEARS = 2  # a Foursquare place not refreshed for this long is likely gone


def fsq_category(label: str) -> str | None:
    """Foursquare's "Dining and Drinking > Cafe, Coffee, and Tea House > Café" → availo's category (None: not ours)."""
    label = label or ""
    if "Library" in label:
        return "library"
    if "Coworking" in label:
        return "coworking"
    if not label.startswith("Dining and Drinking"):
        return None
    leaf = label.split(">")[-1].strip().lower()
    return availo_category(leaf.replace(" ", "_"))


def import_fsq_csv(conn: psycopg.Connection, path: str, today: date | None = None) -> dict:
    """Foursquare OS Places (id|name|category|lat|lon|date_closed|date_refreshed|flags): open, recently refreshed,
    our kinds only; a place Overture already gave (same name, within 50 m) is not added a second time."""
    today = today or date.today()
    fresh_since = str(today.replace(year=today.year - FRESH_YEARS))
    added = skipped = duplicates = 0
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="|"):
            category = fsq_category(row.get("category", ""))
            if not row.get("name") or not category or row.get("date_closed") or (row.get("date_refreshed") or "") < fresh_since:
                skipped += 1
                continue
            lon, lat = float(row["lon"]), float(row["lat"])
            near = conn.execute(
                f"""
                SELECT name FROM place_candidates
                WHERE id NOT LIKE 'fsq:%%' AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, {SAME_PLACE_M})
                """,
                (lon, lat),
            ).fetchall()
            if any(same_name(row["name"], n["name"]) for n in near):
                duplicates += 1
                continue
            conn.execute(
                """
                INSERT INTO place_candidates (id, name, category, raw_category, location, confidence, sources)
                VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 0.7, 'Foursquare')
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category,
                    raw_category = EXCLUDED.raw_category, location = EXCLUDED.location
                """,
                ("fsq:" + row["id"], row["name"], category, row.get("category"), lon, lat),
            )
            added += 1
    linked = link_existing(conn)
    return {"imported": added, "skipped": skipped, "same_as_overture": duplicates, "linked_to_venues": linked}


def link_existing(conn: psycopg.Connection) -> int:
    """Candidates that are already a venue (same name, within 50 m) point to it, so they are not offered."""
    rows = conn.execute(
        f"""
        SELECT c.id, c.name, v.id AS venue_id, v.name AS venue_name
        FROM place_candidates c JOIN venues v ON ST_DWithin(v.location, c.location, {SAME_PLACE_M})
        WHERE c.venue_id IS NULL AND v.closed_at IS NULL
        """
    ).fetchall()
    linked = 0
    for r in rows:
        if same_name(r["name"], r["venue_name"]):
            conn.execute("UPDATE place_candidates SET venue_id = %s WHERE id = %s AND venue_id IS NULL", (r["venue_id"], r["id"]))
            linked += 1
    return linked


def search_candidates(conn: psycopg.Connection, q: str, lat: float | None, lon: float | None, limit: int = 8) -> list[dict]:
    """Places not on the map yet whose name matches; nearest first when the location is known."""
    words = _norm(q)
    if len(words) < 2:
        return []
    near = "ST_Distance(c.location, ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography)" if lat is not None else "NULL"
    rows = conn.execute(
        f"""
        SELECT c.id, c.name, c.category, ST_Y(c.location::geometry) AS lat, ST_X(c.location::geometry) AS lon,
               {near} AS distance_m
        FROM place_candidates c
        WHERE c.venue_id IS NULL AND lower(translate(c.name, %(src)s, %(dst)s)) LIKE %(like)s
        ORDER BY distance_m NULLS LAST, c.confidence DESC
        LIMIT %(limit)s
        """,
        {"lat": lat, "lon": lon, "like": f"%{words}%", "limit": limit, "src": "ÇĞİIÖŞÜçğıöşü", "dst": "cgiiosucgiosu"},
    ).fetchall()
    return [{**r, "distance_m": round(r["distance_m"]) if r["distance_m"] is not None else None} for r in rows]


def candidate_to_venue(conn: psycopg.Connection, user: dict, candidate_id: str, now: datetime) -> dict:
    """Make the candidate a venue (or return the venue it already is); the neighbourhood comes from the nearest venue."""
    if user.get("is_guest") or user.get("role") == "business":
        raise CandidateError("Mekan eklemek için bireysel hesapla giriş yap.", 403)
    c = conn.execute(
        "SELECT *, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon FROM place_candidates WHERE id = %s",
        (candidate_id,),
    ).fetchone()
    if c is None:
        raise CandidateError("Bu yer bulunamadı.", 404)
    if c["venue_id"]:
        return {"id": c["venue_id"], "created": False}
    # Someone may have added it by hand meanwhile
    for v in conn.execute(
        f"SELECT id, name FROM venues WHERE ST_DWithin(location, %s, {SAME_PLACE_M}) AND closed_at IS NULL", (c["location"],)
    ).fetchall():
        if same_name(c["name"], v["name"]):
            conn.execute("UPDATE place_candidates SET venue_id = %s WHERE id = %s", (v["id"], candidate_id))
            return {"id": v["id"], "created": False}
    area = conn.execute(
        """
        SELECT neighborhood, district FROM venues WHERE source <> 'demo' AND district <> ''
        ORDER BY location <-> %s LIMIT 1
        """,
        (c["location"],),
    ).fetchone() or {"neighborhood": "", "district": ""}
    venue = conn.execute(
        """
        INSERT INTO venues (name, category, location, capacity, neighborhood, district, tags, source, approved_at, added_by, created_at)
        VALUES (%s, %s, %s, 40, %s, %s, '{}', 'overture', %s, %s, %s) RETURNING id
        """,
        (c["name"], c["category"], c["location"], area["neighborhood"], area["district"], now, user["id"], now),
    ).fetchone()
    conn.execute("UPDATE place_candidates SET venue_id = %s WHERE id = %s", (venue["id"], candidate_id))
    return {"id": venue["id"], "created": True}
