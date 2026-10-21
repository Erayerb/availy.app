"""v2 friend endpoints."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from app.auth_api import current_user
from app.db import get_conn
from app.friends import FriendError, add_friend, list_friends, remove_friend, search_users

router = APIRouter(prefix="/v1")


class Person(BaseModel):
    id: int
    username: str
    name: str


class PersonWithRelation(Person):
    relation: Literal["friend", "outgoing", "incoming", "none"]


class FriendCheckin(BaseModel):
    venue_id: int
    venue_name: str
    at: datetime
    is_first: bool  # the venue's first check-in: "keşfetti"
    points: int  # earned with this check-in (10, or 60 for a venue's first)


class Friend(Person):
    last_checkin: FriendCheckin | None  # newest public check-in; no live location


class FriendsOut(BaseModel):
    friends: list[Friend]
    incoming: list[Person]  # they asked me
    outgoing: list[Person]  # I asked them


class AddIn(BaseModel):
    username: str


def _fail(error: FriendError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.get("/users/search", response_model=list[PersonWithRelation])
def search(q: str = Query(..., max_length=40), user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return search_users(conn, user, q)


@router.get("/friends", response_model=FriendsOut)
def friends(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return list_friends(conn, user)


@router.post("/friends", response_model=PersonWithRelation)
def add(body: AddIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Send a friend request by user name (also from an invite link / QR), or accept theirs."""
    try:
        return add_friend(conn, user, body.username)
    except FriendError as e:
        raise _fail(e) from None


@router.delete("/friends/{other_id}", status_code=204)
def remove(other_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    remove_friend(conn, user, other_id)
    return Response(status_code=204)
