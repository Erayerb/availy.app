"""v2 endpoints: what used to live only on the phone, per account on the server: favorites (♡),
"Sakin olunca haber ver" watches and the app settings (Görünüm, bildirim ayarları...)."""
import json
from datetime import datetime, timedelta

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn

router = APIRouter(prefix="/v1/me")

WATCH_HOURS = 6  # the bell turns itself off after this long (mobile lib/watch.ts)
MAX_SETTINGS_BYTES = 4000


def _venue_exists(conn: psycopg.Connection, venue_id: int) -> None:
    if conn.execute("SELECT 1 FROM venues WHERE id = %s", (venue_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail="Mekan bulunamadı.")


@router.get("/favorites", response_model=list[int])
def favorites(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Favorite venue ids, oldest first (the order they were saved in)."""
    rows = conn.execute("SELECT venue_id FROM favorites WHERE user_id = %s ORDER BY created_at, venue_id", (user["id"],))
    return [r["venue_id"] for r in rows.fetchall()]


@router.put("/favorites/{venue_id}", status_code=204)
def add_favorite(venue_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    _venue_exists(conn, venue_id)
    conn.execute("INSERT INTO favorites (user_id, venue_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (user["id"], venue_id))
    return Response(status_code=204)


@router.delete("/favorites/{venue_id}", status_code=204)
def remove_favorite(venue_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    conn.execute("DELETE FROM favorites WHERE user_id = %s AND venue_id = %s", (user["id"], venue_id))
    return Response(status_code=204)


class WatchOut(BaseModel):
    venue_id: int
    venue_name: str
    created_at: datetime


class WatchIn(BaseModel):
    created_at: datetime | None = None  # when the bell was turned on (a phone's older watch); now by default


@router.get("/watches", response_model=list[WatchOut])
def watches(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """Bells still on (turned on in the last 6 hours)."""
    return conn.execute(
        """
        SELECT w.venue_id, v.name AS venue_name, w.created_at FROM watches w JOIN venues v ON v.id = w.venue_id
        WHERE w.user_id = %s AND w.created_at > %s ORDER BY w.created_at
        """,
        (user["id"], now - timedelta(hours=WATCH_HOURS)),
    ).fetchall()


@router.put("/watches/{venue_id}", status_code=204)
def add_watch(
    venue_id: int,
    body: WatchIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    _venue_exists(conn, venue_id)
    at = min(body.created_at or now, now)
    conn.execute(
        """
        INSERT INTO watches (user_id, venue_id, created_at) VALUES (%s, %s, %s)
        ON CONFLICT (user_id, venue_id) DO UPDATE SET created_at = EXCLUDED.created_at
        """,
        (user["id"], venue_id, at),
    )
    return Response(status_code=204)


@router.delete("/watches/{venue_id}", status_code=204)
def remove_watch(venue_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    conn.execute("DELETE FROM watches WHERE user_id = %s AND venue_id = %s", (user["id"], venue_id))
    return Response(status_code=204)


@router.get("/settings")
def settings(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)) -> dict | None:
    """The app settings saved by any of the user's phones; null until the first save."""
    return conn.execute("SELECT app_settings FROM users WHERE id = %s", (user["id"],)).fetchone()["app_settings"]


@router.put("/settings", status_code=204)
def save_settings(body: dict, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    if len(json.dumps(body)) > MAX_SETTINGS_BYTES:
        raise HTTPException(status_code=413, detail="Ayarlar çok büyük.")
    conn.execute("UPDATE users SET app_settings = %s WHERE id = %s", (Jsonb(body), user["id"]))
    return Response(status_code=204)
