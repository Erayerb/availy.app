"""Add fictional demo venues (Istanbul) that are not in the database yet.

Never deletes or changes existing venues; safe to run repeatedly.
Run: docker compose run --rm backend python -m app.seed
"""
import psycopg
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema
from app.demo_data import DEMO_VENUES


def seed(conn: psycopg.Connection) -> int:
    """Insert demo venues whose name is not taken yet; return how many were added."""
    apply_schema(conn)
    added = 0
    for name, category, lon, lat, capacity, neighborhood, district, tags, popularity in DEMO_VENUES:
        row = conn.execute(
            """
            INSERT INTO venues (name, category, location, capacity, neighborhood, district, tags, popularity)
            SELECT %(name)s, %(category)s, ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography,
                   %(capacity)s, %(neighborhood)s, %(district)s, %(tags)s, %(popularity)s
            WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = %(name)s)
            RETURNING id
            """,
            {
                "name": name, "category": category, "lon": lon, "lat": lat, "capacity": capacity,
                "neighborhood": neighborhood, "district": district, "tags": tags, "popularity": popularity,
            },
        ).fetchone()
        added += row is not None
    return added


if __name__ == "__main__":
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        added = seed(conn)
        total = conn.execute("SELECT count(*) AS n FROM venues").fetchone()["n"]
    print(f"Added {added} demo venues ({total} venues in total)")
