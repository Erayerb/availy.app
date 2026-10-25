"""v2 endpoints: groups and invitations (Sosyal > Sıralama > Gruplar); the ranking is GET /v1/leaderboard?scope=group."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.groups import MAX_MEMBERS, GroupError, create_group, invite, join, leave, my_groups

router = APIRouter(prefix="/v1")


class GroupOut(BaseModel):
    id: int
    name: str
    status: Literal["member", "invited"]
    invited_by: str | None  # who invited me
    members: int


class GroupIn(BaseModel):
    name: str = Field(..., max_length=80)
    usernames: list[str] = Field(default_factory=list, max_length=MAX_MEMBERS)


class InviteIn(BaseModel):
    usernames: list[str] = Field(..., max_length=MAX_MEMBERS)


class CreatedOut(BaseModel):
    id: int
    invited: list[str]  # the people who got an invitation


def _fail(e: GroupError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


@router.get("/groups", response_model=list[GroupOut])
def groups(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return my_groups(conn, user)


@router.post("/groups", response_model=CreatedOut, status_code=201)
def new_group(
    body: GroupIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return create_group(conn, user, body.name, body.usernames, now)
    except GroupError as e:
        raise _fail(e) from None


@router.post("/groups/{group_id}/invite", response_model=list[str])
def invite_people(
    group_id: int,
    body: InviteIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return invite(conn, user, group_id, body.usernames, now)
    except GroupError as e:
        raise _fail(e) from None


@router.post("/groups/{group_id}/join", status_code=204)
def join_group(group_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        join(conn, user, group_id)
    except GroupError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.delete("/groups/{group_id}/membership", status_code=204)
def leave_group(group_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Leave the group, or turn the invitation down."""
    leave(conn, user, group_id)
    return Response(status_code=204)
