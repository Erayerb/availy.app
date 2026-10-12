from datetime import datetime, timezone

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema, get_conn
from app.main import app
from app.occupancy import Level, Occupancy, get_occupancy_provider

# Fixture venues: two inside the Kadıköy test bbox, one far away (Ankara)
TEST_VENUES = [
    ("Test Kafe A", "cafe", 29.0260, 40.9840, 40),
    ("Test Cowork B", "coworking", 29.0330, 40.9880, 60),
    ("Test Kafe Ankara", "cafe", 32.8597, 39.9334, 30),
]
KADIKOY_BBOX = "29.00,40.97,29.05,41.00"
FIXED_TIME = datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)


class FixedOccupancyProvider:
    """Returns half-full for every venue so API tests are predictable."""

    def get(self, venue_id, capacity, at):
        return Occupancy(level=Level.MEDIUM, ratio=0.5, people=capacity // 2, updated_at=FIXED_TIME)


@pytest.fixture
def conn():
    """A connection inside a transaction that is always rolled back."""
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        with conn.transaction(force_rollback=True):
            apply_schema(conn)
            # Isolate tests from any seeded demo data
            conn.execute("DELETE FROM venues")
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO venues (name, category, location, capacity)
                    VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
                    """,
                    TEST_VENUES,
                )
            yield conn


@pytest.fixture
def client(conn):
    # No `with` block: skip the lifespan so the app pool is never opened
    app.dependency_overrides[get_conn] = lambda: conn
    app.dependency_overrides[get_occupancy_provider] = FixedOccupancyProvider
    yield TestClient(app)
    app.dependency_overrides.clear()
