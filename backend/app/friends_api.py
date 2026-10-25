"""v2 friend endpoints."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from app.auth_api import current_user
from app.db import get_conn
from app.contacts import ContactsError, match_contacts, remove_phone, set_phone
from app.checkins_api import get_clock
from app.friends import FriendError, add_friend, friends_here, list_friends, remove_friend, search_users

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


class PhoneIn(BaseModel):
    phone: str


class ContactsIn(BaseModel):
    phones: list[str]  # numbers from the phone's contacts; compared, never stored


@router.put("/me/phone", status_code=204)
def phone(body: PhoneIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """"Rehberden bul": my own number, kept only as a keyed hash."""
    try:
        set_phone(conn, user, body.phone)
    except ContactsError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None
    return Response(status_code=204)


@router.delete("/me/phone", status_code=204)
def forget_phone(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    remove_phone(conn, user)
    return Response(status_code=204)


class ContactMatch(PersonWithRelation):
    phone: str  # the contact's number as the app sent it


@router.post("/friends/contacts", response_model=list[ContactMatch])
def contacts(body: ContactsIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return match_contacts(conn, user, body.phones)
    except ContactsError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


class FriendHere(BaseModel):
    username: str
    at: datetime  # their check-in


@router.get("/venues/{venue_id}/friends-here", response_model=list[FriendHere])
def here(
    venue_id: int,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """"👥 @ayse burada": friends who checked in here in the last hour."""
    return friends_here(conn, user, venue_id, now)


class RegularOut(BaseModel):
    username: str
    visits: int  # in the last 30 days
    me: bool


@router.get("/venues/{venue_id}/regular", response_model=RegularOut | None)
def regular(
    venue_id: int,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """"👑 müdavim": among me and my friends, the most check-ins here lately (none: null)."""
    from app.streaks import friends_regular

    return friends_regular(conn, user, venue_id, now)
