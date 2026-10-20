"""Add fictional demo venues (Istanbul) that are not in the database yet.

Never deletes or changes existing venues; safe to run repeatedly.
Run: docker compose run --rm backend python -m app.seed
"""
import psycopg
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema
from app.demo_data import DEMO_VENUES, demo_venue_rows  # noqa: F401 (DEMO_VENUES re-exported for tests)


def seed(conn: psycopg.Connection) -> int:
    """Insert demo venues whose name is not taken yet; return how many were added."""
    apply_schema(conn)
    added = 0
    for venue in demo_venue_rows():
        row = conn.execute(
            """
            INSERT INTO venues (name, category, location, capacity, neighborhood, district, tags, popularity, always_busy, source)
            SELECT %(name)s, %(category)s, ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography,
                   %(capacity)s, %(neighborhood)s, %(district)s, %(tags)s, %(popularity)s, %(always_busy)s, 'demo'
            WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name = %(name)s)
            RETURNING id
            """,
            venue,
        ).fetchone()
        added += row is not None
    return added


if __name__ == "__main__":
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        added = seed(conn)
        total = conn.execute("SELECT count(*) AS n FROM venues").fetchone()["n"]
    print(f"Added {added} demo venues ({total} venues in total)")
