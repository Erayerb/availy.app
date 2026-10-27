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
    min_size=1,
    # Hosted databases (Neon) close idle connections: check one before handing it out
    check=ConnectionPool.check_connection,
)


MIGRATIONS_PATH = Path(__file__).parent / "sql" / "migrations"
# Any number: one process at a time changes the schema (two starting together used to deadlock)
SCHEMA_LOCK = 72_901


def apply_schema(conn: psycopg.Connection) -> None:
    """The base schema (schema.sql, safe to run again), then each numbered migration once.

    New database changes go into a new file in sql/migrations ("004_what_it_does.sql"); a file
    that ran is recorded in schema_migrations and never runs again, so it is not edited later.
    """
    conn.execute("SELECT pg_advisory_xact_lock(%s)", (SCHEMA_LOCK,))
    conn.execute(SCHEMA_PATH.read_text())
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
    )
    done = {r["name"] if isinstance(r, dict) else r[0] for r in conn.execute("SELECT name FROM schema_migrations")}
    for path in sorted(MIGRATIONS_PATH.glob("*.sql")):
        if path.name in done:
            continue
        conn.execute(path.read_text())
        conn.execute("INSERT INTO schema_migrations (name) VALUES (%s)", (path.name,))


def get_conn() -> Iterator[psycopg.Connection]:
    """FastAPI dependency: borrow a connection from the pool."""
    with pool.connection() as conn:
        yield conn
