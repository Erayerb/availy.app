import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema, get_conn
from app.main import app

# (name, category, lon, lat, neighborhood, district, tags)
TEST_VENUES = [
    ("Test Kafe A", "cafe", 29.0260, 40.9840, "Moda", "Kadıköy", ["socializing"]),
    ("Test Cowork B", "coworking", 29.0330, 40.9880, "Osmanağa", "Kadıköy", ["coworking", "quiet"]),
    # Same district but outside KADIKOY_BBOX
    ("Test Bar Uzak", "bar", 29.1000, 40.9800, "Fikirtepe", "Kadıköy", ["entertainment"]),
    ("Test Kafe Ankara", "cafe", 32.8597, 39.9334, "Kızılay", "Çankaya", ["quiet"]),
]
KADIKOY_BBOX = "29.00,40.97,29.05,41.00"


@pytest.fixture
def conn():
    """A connection inside a transaction that is always rolled back."""
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        with conn.transaction(force_rollback=True):
            apply_schema(conn)
            # Isolate tests from any seeded demo data
            conn.execute("DELETE FROM venues")
            for name, category, lon, lat, neighborhood, district, tags in TEST_VENUES:
                conn.execute(
                    """
                    INSERT INTO venues (name, category, location, capacity, neighborhood, district, tags)
                    VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 30, %s, %s, %s)
                    """,
                    (name, category, lon, lat, neighborhood, district, tags),
                )
            yield conn


@pytest.fixture
def client(conn):
    # No `with` block: skip the lifespan so the app pool is never opened
    app.dependency_overrides[get_conn] = lambda: conn
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def visit(conn):
    """visit("t_ali", venue_id): an old private check-in, so the user may review the venue."""

    def make(username: str, venue_id: int, times: int = 1) -> None:
        for _ in range(times):
            conn.execute(
                """
                INSERT INTO checkins (venue_id, user_id, level, is_private, created_at)
                SELECT %s, id, 'low', true, now() - interval '30 days' FROM users WHERE username = %s
                """,
                (venue_id, username),
            )

    return make
