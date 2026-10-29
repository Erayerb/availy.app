"""Add contact details (phone, e-mail, website) to existing venues from Overture Maps places.

Overture places are open data (mostly CDLA-Permissive-2.0, some CC0-1.0 / Apache-2.0; the source of each
record is kept in venues.contact_source). The details are only for verifying a business (a code sent
to that phone or e-mail) and are never shown in the app. Venues are matched by name and distance
(at most 80 m); a detail the venue already has is not replaced.

1. Download the places of the area (the overturemaps tool: pip install overturemaps):
   overturemaps download --bbox=28.97,40.95,29.17,41.07 -f geojsonseq --type=place -o places.geojsonseq
2. Run: docker compose run --rm backend python -m app.import_contacts places.geojsonseq
   (the file next to backend/, so the container sees it; add --dry-run to only count the matches)
"""
import json
import math
import re
import sys
from difflib import SequenceMatcher

import psycopg
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema
from app.venues import fold_tr

MAX_METERS = 80
MIN_NAME_SCORE = 0.72
# Words that say what a place is, not which one it is
FILLER = {"cafe", "kafe", "coffee", "kahve", "restaurant", "restoran", "bar", "pub", "the", "ve", "and", "co", "lokanta", "lokantasi"}
# Neighbourhood and district names ("Kronotrop Caddebostan" and "Nou Caddebostan" are not the same place);
# filled from the venues' own neighbourhoods and districts when the import runs
PLACE_WORDS: set[str] = {"istanbul", "kadikoy", "moda", "caddebostan", "nisantasi", "tesvikiye", "erenkoy", "besiktas", "sisli"}


def normalize_name(name: str) -> str:
    words = re.findall(r"[a-z0-9]+", fold_tr(name))
    kept = [w for w in words if w not in FILLER and w not in PLACE_WORDS]
    return " ".join(kept or words)


def name_score(a: str, b: str) -> float:
    a, b = normalize_name(a), normalize_name(b)
    if not a or not b:
        return 0.0
    if a == b or (len(a) >= 4 and a in b) or (len(b) >= 4 and b in a):
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dy = (lat2 - lat1) * 111_320
    dx = (lon2 - lon1) * 111_320 * math.cos(math.radians(lat1))
    return math.hypot(dx, dy)


def turkish_phone(raw: str) -> str | None:
    """"+90 216 555 12 34" style; numbers that are not Turkish landlines or mobiles are dropped."""
    digits = re.sub(r"\D", "", raw)
    # Some records carry a wrong country code on a Turkish number ("+1 533…")
    for prefix in ("90", "1"):
        if digits.startswith(prefix) and len(digits) == len(prefix) + 10:
            digits = digits[len(prefix):]
            break
    digits = digits.removeprefix("0")
    if len(digits) != 10 or digits[0] not in "2345":
        return None
    return f"+90 {digits[:3]} {digits[3:6]} {digits[6:8]} {digits[8:]}"


def read_places(path: str) -> list[dict]:
    places = []
    with open(path, encoding="utf-8") as file:
        for line in file:
            line = line.strip().lstrip("\x1e")
            if not line:
                continue
            feature = json.loads(line)
            p = feature["properties"]
            if not (p.get("phones") or p.get("emails") or p.get("websites")):
                continue
            lon, lat = feature["geometry"]["coordinates"][:2]
            name = (p.get("names") or {}).get("primary") or ""
            datasets = sorted({s.get("dataset") for s in p.get("sources") or [] if s.get("dataset") not in (None, "Overture")})
            places.append({
                "id": p.get("id") or feature.get("id"),
                "name": name,
                "lat": lat,
                "lon": lon,
                "phones": p.get("phones") or [],
                "emails": p.get("emails") or [],
                "websites": p.get("websites") or [],
                "datasets": datasets,
            })
    return places


def best_match(venue: dict, places: list[dict]) -> dict | None:
    best, best_score = None, 0.0
    for place in places:
        if abs(place["lat"] - venue["lat"]) > 0.001 or abs(place["lon"] - venue["lon"]) > 0.0013:
            continue
        if meters(venue["lat"], venue["lon"], place["lat"], place["lon"]) > MAX_METERS:
            continue
        score = name_score(venue["name"], place["name"])
        if score >= MIN_NAME_SCORE and score > best_score:
            best, best_score = place, score
    return best


def main(path: str, dry_run: bool) -> None:
    places = read_places(path)
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        apply_schema(conn)
        for row in conn.execute("SELECT DISTINCT neighborhood, district FROM venues"):
            for name in (row["neighborhood"], row["district"]):
                PLACE_WORDS.update(re.findall(r"[a-z0-9]+", fold_tr(name or "")))
        venues = conn.execute(
            """
            SELECT id, name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon,
                   contact_phone, contact_email, contact_website
            FROM venues WHERE source <> 'demo'
            """
        ).fetchall()
        counts = {"matched": 0, "phone": 0, "email": 0, "website": 0}
        for venue in venues:
            place = best_match(venue, places)
            if not place:
                continue
            counts["matched"] += 1
            phone = next((p for p in map(turkish_phone, place["phones"]) if p), None)
            email = next((e.strip().lower() for e in place["emails"] if "@" in e), None)
            website = next((w.strip() for w in place["websites"] if w.startswith("http")), None)
            counts["phone"] += bool(phone and not venue["contact_phone"])
            counts["email"] += bool(email and not venue["contact_email"])
            counts["website"] += bool(website and not venue["contact_website"])
            if dry_run:
                continue
            conn.execute(
                """
                UPDATE venues SET
                    contact_phone = COALESCE(contact_phone, %(phone)s),
                    contact_email = COALESCE(contact_email, %(email)s),
                    contact_website = COALESCE(contact_website, %(website)s),
                    contact_source = %(source)s
                WHERE id = %(id)s
                """,
                {
                    "id": venue["id"],
                    "phone": phone,
                    "email": email,
                    "website": website,
                    "source": f"overture:{place['id']} ({', '.join(place['datasets']) or 'overture'})",
                },
            )
        print(f"{len(venues)} mekan, {counts['matched']} eşleşti; yeni telefon {counts['phone']}, "
              f"e-posta {counts['email']}, web {counts['website']}{' (deneme, kaydedilmedi)' if dry_run else ''}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    if not args:
        sys.exit(__doc__)
    main(args[0], "--dry-run" in sys.argv)
