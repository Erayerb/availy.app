"""v2 endpoints: a person's profile, block / mute, and reporting reviews or replies."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.auth_api import BadgeOut, current_user
from app.db import get_conn
from app.safety import SafetyError, block, blocked_people, mute, profile, report, unblock

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
    points: int
    checkins: int
    discoveries: int
    badges: list[BadgeOut]  # the whole catalog with progress
    venues: list[ProfileVenue] | None  # None: not visible (not a friend, or they do not share check-ins)


class BlockedOut(BaseModel):
    username: str
    created_at: datetime


class ReportIn(BaseModel):
    reason: Literal["insult", "spam", "false", "other"]


def _fail(error: SafetyError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.get("/users/{username}", response_model=ProfileOut)
def user_profile(username: str, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return profile(conn, user, username)
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
