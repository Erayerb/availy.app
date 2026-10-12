from collections.abc import Iterator
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import settings

SCHEMA_PATH = Path(__file__).parent / "sql" / "schema.sql"

pool = ConnectionPool(
    settings.database_url,
    kwargs={"row_factory": dict_row},
    open=False,
)


def apply_schema(conn: psycopg.Connection) -> None:
    conn.execute(SCHEMA_PATH.read_text())


def get_conn() -> Iterator[psycopg.Connection]:
    """FastAPI dependency: borrow a connection from the pool."""
    with pool.connection() as conn:
        yield conn
