"""Copy the real (OpenStreetMap) venues from this database to another one, e.g. Neon.

Only venues: no accounts, check-ins or reviews. Venues already there (same OSM id)
are left alone; nothing is ever deleted. Safe to run repeatedly.
Run: docker compose run --rm -e TARGET_DATABASE_URL='postgresql://…' backend python -m app.copy_venues
"""
import os

import psycopg
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema

COLUMNS = "osm_id, source, name, category, location, capacity, neighborhood, district, tags, open_hour, close_hour"


def main() -> None:
    target_url = os.environ.get("TARGET_DATABASE_URL")
    if not target_url:
        raise SystemExit("TARGET_DATABASE_URL eksik (Neon bağlantı adresi).")
    with psycopg.connect(settings.database_url, row_factory=dict_row) as source:
        venues = source.execute(f"SELECT {COLUMNS} FROM venues WHERE source = 'osm' ORDER BY id").fetchall()
    with psycopg.connect(target_url, row_factory=dict_row) as target:
        apply_schema(target)
        added = 0
        for v in venues:
            row = target.execute(
                f"""
                INSERT INTO venues ({COLUMNS})
                VALUES (%(osm_id)s, %(source)s, %(name)s, %(category)s, %(location)s, %(capacity)s,
                        %(neighborhood)s, %(district)s, %(tags)s, %(open_hour)s, %(close_hour)s)
                -- Already there: only the purpose tags are refreshed (e.g. "wifi" was added later)
                ON CONFLICT (osm_id) WHERE osm_id IS NOT NULL DO UPDATE SET tags = EXCLUDED.tags
                RETURNING (xmax = 0) AS inserted
                """,
                v,
            ).fetchone()
            added += row["inserted"]
        target.commit()
    print(f"{len(venues)} mekan okundu, {added} tanesi hedefe eklendi, diğerlerinin amaçları güncellendi.")


if __name__ == "__main__":
    main()
