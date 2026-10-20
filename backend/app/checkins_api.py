"""v2 check-in endpoint."""
from datetime import datetime, timezone
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth_api import current_user
from app.checkins import CheckinError, create_checkin
from app.db import get_conn

router = APIRouter(prefix="/v1")


def get_clock() -> datetime:
    """Current time; replaced in tests."""
    return datetime.now(timezone.utc)


class CheckinIn(BaseModel):
    level: Literal["low", "medium", "high"]
    queue: bool | None = None  # only with "high"
    seats: bool | None = None  # only with "medium"
    lat: float
    lon: float


class CheckinOut(BaseModel):
    id: int
    venue_id: int
    level: str
    queue: bool | None
    seats: bool | None
    is_first: bool
    created_at: datetime


@router.post("/venues/{venue_id}/checkins", response_model=CheckinOut, status_code=201)
def checkin(
    venue_id: int,
    body: CheckinIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return create_checkin(conn, user, venue_id, body.level, body.queue, body.seats, body.lat, body.lon, now)
    except CheckinError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None
