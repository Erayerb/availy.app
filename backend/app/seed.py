"""Insert fake demo venues (Istanbul) if the venues table is empty.

Run: docker compose run --rm backend python -m app.seed
"""
import psycopg
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema

# (name, category, lon, lat, capacity) — fictional venues for demo purposes only
DEMO_VENUES = [
    ("Demo Kafe Moda", "cafe", 29.0260, 40.9840, 40),
    ("Demo Kafe Kadıköy Çarşı", "cafe", 29.0250, 40.9905, 25),
    ("Demo Cowork Kadıköy", "coworking", 29.0330, 40.9880, 60),
    ("Demo Kafe Yeldeğirmeni", "cafe", 29.0200, 40.9960, 30),
    ("Demo Kafe Beşiktaş", "cafe", 29.0060, 41.0430, 35),
    ("Demo Cowork Levent", "coworking", 29.0110, 41.0820, 120),
    ("Demo Kafe Cihangir", "cafe", 28.9830, 41.0315, 20),
    ("Demo Kafe Karaköy", "cafe", 28.9770, 41.0240, 45),
    ("Demo Cowork Şişli", "coworking", 28.9870, 41.0600, 80),
    ("Demo Kafe Üsküdar", "cafe", 29.0150, 41.0260, 30),
]


def seed(conn: psycopg.Connection) -> int:
    apply_schema(conn)
    if conn.execute("SELECT count(*) AS n FROM venues").fetchone()["n"] > 0:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO venues (name, category, location, capacity)
            VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
            """,
            DEMO_VENUES,
        )
    return len(DEMO_VENUES)


if __name__ == "__main__":
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        inserted = seed(conn)
    print(f"Inserted {inserted} demo venues" if inserted else "Venues already present, nothing inserted")
