"""v2 account endpoints: sign up, sign in, sign out and the signed-in user."""
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel

from app.accounts import (
    GUEST_SESSION_DAYS,
    AccountError,
    authenticate,
    change_password,
    create_guest,
    create_session,
    create_user,
    delete_session,
    delete_user,
    rename_user,
    change_username,
    upgrade_guest,
    user_for_token,
)
from app.db import get_conn

router = APIRouter(prefix="/v1")

Role = Literal["personal", "business"]


class RegisterIn(BaseModel):
    name: str = ""  # optional; the user name is used until one is set
    username: str
    email: str
    password: str
    role: Role = "personal"


class LoginIn(BaseModel):
    # E-mail or user name; `email` is the older field name and still accepted
    login: str = ""
    email: str = ""
    password: str
    # The account type chosen in the app; a mismatch gets a helpful message
    role: Role | None = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str | None  # None for guests
    username: str | None  # "@eray"; None for guests
    role: Role
    is_guest: bool
    venue_id: int | None
    plan: str | None


class BadgeOut(BaseModel):
    id: str
    name: str
    icon: str
    description: str
    progress: int
    target: int
    earned: bool


class PrivacyOut(BaseModel):
    share_checkins: bool  # friends see my check-ins
    show_in_leaderboard: bool  # shown in the "Herkes" ranking
    searchable: bool  # others find me by user-name search


class MeOut(UserOut, PrivacyOut):
    points: int
    checkins: int
    discoveries: int  # venues where this user made the first check-in
    badges: list[BadgeOut]  # the whole catalog; locked ones have earned = false


class SessionOut(BaseModel):
    token: str
    user: UserOut


def bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        return None
    return token.strip() or None


def current_user(
    authorization: str | None = Header(None),
    conn: psycopg.Connection = Depends(get_conn),
) -> dict:
    """Dependency for endpoints that need a signed-in user (Authorization: Bearer <token>)."""
    token = bearer_token(authorization)
    user = user_for_token(conn, token) if token else None
    if user is None:
        raise HTTPException(status_code=401, detail="Giriş yapmalısın.")
    return user


def _fail(error: AccountError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.post("/auth/register", response_model=SessionOut, status_code=201)
def register(body: RegisterIn, conn: psycopg.Connection = Depends(get_conn)):
    try:
        user = create_user(conn, body.name, body.email, body.password, body.role, body.username)
    except AccountError as e:
        raise _fail(e) from None
    return {"token": create_session(conn, user["id"]), "user": user}


@router.post("/auth/login", response_model=SessionOut)
def login(body: LoginIn, conn: psycopg.Connection = Depends(get_conn)):
    try:
        user = authenticate(conn, body.login or body.email, body.password, body.role)
    except AccountError as e:
        raise _fail(e) from None
    return {"token": create_session(conn, user["id"]), "user": user}


@router.post("/auth/guest", response_model=SessionOut, status_code=201)
def guest(conn: psycopg.Connection = Depends(get_conn)):
    """'Kayıt olmadan devam et': a guest account with an automatic id."""
    user = create_guest(conn)
    return {"token": create_session(conn, user["id"], days=GUEST_SESSION_DAYS), "user": user}


@router.post("/auth/upgrade", response_model=UserOut)
def upgrade(body: RegisterIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """A guest signs up and keeps the same id; the current session stays valid."""
    try:
        return upgrade_guest(conn, user, body.name, body.email, body.password, body.role, body.username)
    except AccountError as e:
        raise _fail(e) from None


@router.post("/auth/logout", status_code=204)
def logout(authorization: str | None = Header(None), conn: psycopg.Connection = Depends(get_conn)):
    token = bearer_token(authorization)
    if token:
        delete_session(conn, token)
    return Response(status_code=204)


@router.get("/me", response_model=MeOut)
def me(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    from app.checkins import user_stats

    return {**user, **user_stats(conn, user["id"])}


class RenameIn(BaseModel):
    # One of the two; the app now only changes the user name
    name: str | None = None
    username: str | None = None


class PasswordIn(BaseModel):
    old_password: str
    new_password: str


@router.patch("/me", response_model=UserOut)
def rename(body: RenameIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        if body.username is not None:
            return change_username(conn, user, body.username)
        return rename_user(conn, user, body.name or "")
    except AccountError as e:
        raise _fail(e) from None


@router.post("/me/password", status_code=204)
def password(body: PasswordIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        change_password(conn, user, body.old_password, body.new_password)
    except AccountError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.delete("/me", status_code=204)
def delete_me(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    delete_user(conn, user)
    return Response(status_code=204)


class PrivacyIn(BaseModel):
    share_checkins: bool | None = None
    show_in_leaderboard: bool | None = None
    searchable: bool | None = None


@router.patch("/me/privacy", response_model=PrivacyOut)
def privacy(body: PrivacyIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Gizlilik ayarları: only the fields sent are changed."""
    changes = body.model_dump(exclude_none=True)
    if not changes:
        return user
    columns = ", ".join(f"{name} = %({name})s" for name in changes)
    return conn.execute(
        f"UPDATE users SET {columns} WHERE id = %(id)s RETURNING share_checkins, show_in_leaderboard, searchable",
        {**changes, "id": user["id"]},
    ).fetchone()
