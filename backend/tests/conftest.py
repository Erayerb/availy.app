from datetime import datetime, timezone

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema, get_conn
from app.main import app
from app.occupancy import Level, Occupancy, classify, get_occupancy_provider

# (name, category, lon, lat, neighborhood, district, tags, fixed ratio)
TEST_VENUES = [
    ("Test Kafe A", "cafe", 29.0260, 40.9840, "Moda", "Kadıköy", ["socializing"], 0.2),
    ("Test Cowork B", "coworking", 29.0330, 40.9880, "Osmanağa", "Kadıköy", ["coworking", "quiet"], 0.5),
    # Same district but outside KADIKOY_BBOX: counts for district busyness only
    ("Test Bar Uzak", "bar", 29.1000, 40.9800, "Fikirtepe", "Kadıköy", ["entertainment"], 0.9),
    ("Test Kafe Ankara", "cafe", 32.8597, 39.9334, "Kızılay", "Çankaya", ["quiet"], 0.5),
]
KADIKOY_BBOX = "29.00,40.97,29.05,41.00"
FIXED_TIME = datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)


class FixedOccupancyProvider:
    """Returns a fixed ratio per venue so API tests are predictable."""

    def __init__(self, ratios_by_id: dict[int, float]):
        self.ratios_by_id = ratios_by_id

    def get(self, venue_id, at, popularity=1.0, always_busy=False):
        ratio = self.ratios_by_id.get(venue_id, 0.5)  # venues a test added
        return Occupancy(level=classify(ratio), ratio=ratio, updated_at=FIXED_TIME)


@pytest.fixture
def conn():
    """A connection inside a transaction that is always rolled back."""
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        with conn.transaction(force_rollback=True):
            apply_schema(conn)
            # Isolate tests from any seeded demo data
            conn.execute("DELETE FROM venues")
            conn.ratios_by_id = {}
            for name, category, lon, lat, neighborhood, district, tags, ratio in TEST_VENUES:
                row = conn.execute(
                    """
                    INSERT INTO venues (name, category, location, capacity, neighborhood, district, tags)
                    VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 30, %s, %s, %s)
                    RETURNING id
                    """,
                    (name, category, lon, lat, neighborhood, district, tags),
                ).fetchone()
                conn.ratios_by_id[row["id"]] = ratio
            yield conn


@pytest.fixture
def client(conn):
    # No `with` block: skip the lifespan so the app pool is never opened
    app.dependency_overrides[get_conn] = lambda: conn
    app.dependency_overrides[get_occupancy_provider] = lambda: FixedOccupancyProvider(conn.ratios_by_id)
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
