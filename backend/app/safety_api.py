"""v2 endpoints: a person's profile, block / mute, and reporting reviews or replies."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth_api import BadgeOut, current_user, LevelOut
from app.checkins_api import get_clock
from app.db import get_conn
from app.safety import SafetyError, block, blocked_people, mute, profile, report, unblock
from app.user_photos import PhotoError, delete_user_photo, load_user_photo, save_user_photo

router = APIRouter(prefix="/v1")


class ProfileVenue(BaseModel):
    venue_id: int
    venue_name: str
    category: str
    visits: int
    last_at: datetime
    discovered: bool  # made the venue's first check-in


class ProfileOut(BaseModel):
    id: int
    username: str
    relation: Literal["self", "friend", "outgoing", "incoming", "none"]
    muted: bool
    # None: the person shows statistics only to friends, or only to themselves (stats_hidden)
    points: int | None
    checkins: int | None
    discoveries: int | None
    badges: list[BadgeOut]  # the whole catalog with progress (empty when hidden)
    venues: list[ProfileVenue] | None  # None: not visible (not a friend, or they do not share check-ins)
    weekly_streak: int | None = 0  # "🔥 4 haftalık seri"
    stats_hidden: bool = False
    level: LevelOut | None = None  # shown even when the statistics are hidden (a status, like a badge)
    photo_at: datetime | None = None  # profile photo: GET /v1/users/{username}/photo?v=<photo_at>


class PhotoIn(BaseModel):
    photo: str = Field(..., max_length=900_000)  # data URI


@router.get("/users/{username}/photo")
def user_photo(username: str, conn: psycopg.Connection = Depends(get_conn)):
    """A profile photo; with ?v=<photo_at> it never changes, so it may be kept long."""
    found = load_user_photo(conn, username)
    if found is None:
        raise HTTPException(status_code=404, detail="Fotoğraf yok.")
    media_type, data = found
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "public, max-age=86400"})


@router.put("/me/photo")
def set_my_photo(
    body: PhotoIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)
):
    try:
        return {"photo_at": save_user_photo(conn, user, body.photo, now)}
    except PhotoError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


@router.delete("/me/photo", status_code=204)
def remove_my_photo(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    delete_user_photo(conn, user)
    return Response(status_code=204)


class BlockedOut(BaseModel):
    username: str
    created_at: datetime


class ReportIn(BaseModel):
    reason: Literal["insult", "spam", "false", "other"]


def _fail(error: SafetyError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.get("/users/{username}", response_model=ProfileOut)
def user_profile(
    username: str,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return profile(conn, user, username, now)
    except SafetyError as e:
        raise _fail(e) from None


def _do(action, *args) -> Response:
    try:
        action(*args)
    except SafetyError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.post("/users/{username}/block", status_code=204)
def block_user(username: str, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Engelle: the friendship ends, no requests, and each other's reviews are hidden."""
    return _do(block, conn, user, username)


@router.delete("/users/{username}/block", status_code=204)
def unblock_user(username: str, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return _do(unblock, conn, user, username)


@router.post("/users/{username}/mute", status_code=204)
def mute_user(username: str, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Sessize al: still friends, but nothing from them in my feed."""
    return _do(mute, conn, user, username, True)


@router.delete("/users/{username}/mute", status_code=204)
def unmute_user(username: str, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return _do(mute, conn, user, username, False)


@router.get("/me/blocked", response_model=list[BlockedOut])
def my_blocked(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return blocked_people(conn, user)


@router.post("/reviews/{review_id}/report", status_code=204)
def report_review(review_id: int, body: ReportIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return _do(report, conn, user, body.reason, review_id, None)


@router.post("/replies/{reply_id}/report", status_code=204)
def report_reply(reply_id: int, body: ReportIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return _do(report, conn, user, body.reason, None, reply_id)
