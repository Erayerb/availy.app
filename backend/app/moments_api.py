from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.moderation import ModerationError
from app.moments import (
    MomentError,
    decide_moment,
    delete_moment,
    moment_image,
    report_moment,
    reported_moments,
    save_moment,
    venue_moments,
)
from app.reviews_api import optional_user

router = APIRouter(prefix="/v1")


def _fail(e: MomentError | ModerationError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


class MomentIn(BaseModel):
    photo: str = Field(..., max_length=900_000)  # data URI from the camera
    audience: Literal["everyone", "friends"] | None = None  # None: the Gizlilik default


class MomentOut(BaseModel):
    id: int
    created_at: datetime
    expires_at: datetime
    audience: Literal["everyone", "friends"]
    level: Literal["low", "medium", "high"] | None = None
    username: str | None = None  # None: a private check-in ("Bir ziyaretçi")
    mine: bool = False
    points: int = 0


@router.post("/checkins/{checkin_id}/moment", response_model=MomentOut, status_code=201)
def add_moment(
    checkin_id: int,
    body: MomentIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return save_moment(conn, user, checkin_id, body.photo, body.audience, now)
    except MomentError as e:
        raise _fail(e) from None


@router.get("/venues/{venue_id}/moments", response_model=list[MomentOut])
def moments(
    venue_id: int,
    viewer: dict | None = Depends(optional_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    return venue_moments(conn, venue_id, viewer, now)


@router.get("/moments/{photo_id}/image")
def image(
    photo_id: int,
    viewer: dict | None = Depends(optional_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    found = moment_image(conn, photo_id, viewer, now)
    if found is None:
        raise HTTPException(status_code=404, detail="Fotoğraf yok.")
    media_type, data = found
    # Private: friends-only photos must not sit in shared caches
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, max-age=3600"})


@router.delete("/moments/{photo_id}", status_code=204)
def remove(photo_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        delete_moment(conn, user, photo_id)
    except MomentError as e:
        raise _fail(e) from None
    return Response(status_code=204)


class ReportIn(BaseModel):
    reason: Literal["inappropriate", "person", "unrelated", "spam"]


@router.post("/moments/{photo_id}/report", status_code=204)
def report(
    photo_id: int,
    body: ReportIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        report_moment(conn, user, photo_id, body.reason, now)
    except MomentError as e:
        raise _fail(e) from None
    return Response(status_code=204)


class ReportedMomentOut(BaseModel):
    id: int
    created_at: datetime
    hidden_at: datetime | None
    venue_id: int
    venue_name: str
    author: str | None
    reports: int
    reasons: list[str]


@router.get("/admin/moments", response_model=list[ReportedMomentOut])
def admin_list(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    try:
        return reported_moments(conn, user, now)
    except ModerationError as e:
        raise _fail(e) from None


class DecisionIn(BaseModel):
    keep: bool


@router.post("/admin/moments/{photo_id}", status_code=204)
def admin_decide(photo_id: int, body: DecisionIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        decide_moment(conn, user, photo_id, body.keep)
    except ModerationError as e:
        raise _fail(e) from None
    return Response(status_code=204)
