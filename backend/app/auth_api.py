"""v2 account endpoints: sign up, sign in, sign out and the signed-in user."""
from datetime import datetime, timezone
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import JSONResponse
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
    freeze_user,
    change_email,
    upgrade_guest,
    user_for_token,
)
from app.db import get_conn
from app.friends import accept_invite
from app.email_codes import request_reset, request_verification, reset_password, verify_email

router = APIRouter(prefix="/v1")

Role = Literal["personal", "business"]


class RegisterIn(BaseModel):
    name: str = ""  # optional; the user name is used until one is set
    username: str
    email: str
    password: str
    role: Role = "personal"
    invited_by: str | None = None  # the user name in the invite link (?invite=eray)


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
    email_verified: bool = False
    is_admin: bool = False  # Daha fazla > Yönetici


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
    suggest_by_venues: bool = True  # suggested to people who go to the same venues
    regular_public: bool = False  # "👑 müdavim" shown to everyone, not only to friends
    stats_visibility: Literal["friends", "me"] = "friends"  # who sees the profile's statistics


class ProfileStepOut(BaseModel):
    key: str
    label: str
    done: bool


class NewBadgeOut(BaseModel):
    id: str
    name: str
    icon: str
    points: int


class NextLevelOut(BaseModel):
    name: str
    missing: list[str]  # "120 puan", "2 mekanda daha 3. check-in"
    progress: float  # 0–1


class LevelOut(BaseModel):
    id: Literal["newcomer", "explorer", "local", "ambassador"]
    name: str
    rank: int  # 0–3
    next: NextLevelOut | None  # None at the top


class MeOut(UserOut, PrivacyOut):
    points: int
    checkins: int
    discoveries: int  # venues where this user made the first check-in
    badges: list[BadgeOut]  # the whole catalog; locked ones have earned = false
    profile: list[ProfileStepOut]  # "Profilin %60 dolu"; all done earns the Tam Profil badge
    new_badges: list[NewBadgeOut] = []  # earned since the last look, points already added: celebrate them
    level: LevelOut  # Yeni Gelen → Kâşif → Mahalleli → Semt Elçisi, with what is left for the next
    customer_code: str | None = None  # "M-123456" for loyalty stamps (not for businesses)


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
    _send_verification(conn, user)
    accept_invite(conn, user, body.invited_by, datetime.now(timezone.utc))
    return {"token": create_session(conn, user["id"]), "user": user}


def _send_verification(conn: psycopg.Connection, user: dict) -> None:
    """Right after signing up: the code to verify the e-mail (the account works without it too)."""
    try:
        request_verification(conn, user, datetime.now(timezone.utc))
    except AccountError:
        pass


@router.post("/auth/login", response_model=SessionOut)
def login(body: LoginIn, conn: psycopg.Connection = Depends(get_conn)):
    try:
        user = authenticate(conn, body.login or body.email, body.password, body.role)
    except AccountError as e:
        # Returned, not raised: the wrong-password count is saved together with the failed request
        return JSONResponse(status_code=e.status, content={"detail": e.message})
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
        upgraded = upgrade_guest(conn, user, body.name, body.email, body.password, body.role, body.username)
    except AccountError as e:
        raise _fail(e) from None
    _send_verification(conn, upgraded)
    accept_invite(conn, upgraded, body.invited_by, datetime.now(timezone.utc))
    return upgraded


@router.post("/auth/logout", status_code=204)
def logout(authorization: str | None = Header(None), conn: psycopg.Connection = Depends(get_conn)):
    token = bearer_token(authorization)
    if token:
        delete_session(conn, token)
    return Response(status_code=204)


@router.get("/me", response_model=MeOut)
def me(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    from app.checkins import reward_badges, user_stats

    from app.loyalty import customer_code

    code = customer_code(conn, user["id"]) if user.get("role") != "business" else None
    # Badges earned away from a check-in (a photo, a friend, the e-mail): their points first, then the totals
    new = reward_badges(conn, user["id"], datetime.now(timezone.utc)) if user.get("role") != "business" else []
    return {**user, **user_stats(conn, user["id"]), "customer_code": code, "new_badges": new}


class RenameIn(BaseModel):
    # One of the two; the app now only changes the user name
    name: str | None = None
    username: str | None = None


class PasswordIn(BaseModel):
    old_password: str
    new_password: str


@router.get("/me/export")
def export_data(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """"Verilerimi indir" (KVKK): everything kept about me, as one JSON document."""
    from app.export import export_my_data

    return export_my_data(conn, user, datetime.now(timezone.utc))


@router.patch("/me", response_model=UserOut)
def rename(body: RenameIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        if body.username is not None:
            return change_username(conn, user, body.username)
        return rename_user(conn, user, body.name or "")
    except AccountError as e:
        raise _fail(e) from None


class EmailIn(BaseModel):
    email: str
    password: str  # current password


@router.post("/me/email", response_model=UserOut)
def email(body: EmailIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return change_email(conn, user, body.password, body.email)
    except AccountError as e:
        raise _fail(e) from None


@router.post("/me/password", status_code=204)
def password(body: PasswordIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        change_password(conn, user, body.old_password, body.new_password)
    except AccountError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.post("/me/freeze", status_code=204)
def freeze_me(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Hesabı dondur: registered accounts only (a guest has nothing to hide)."""
    if user["is_guest"]:
        raise HTTPException(status_code=403, detail="Misafir hesap dondurulamaz.")
    freeze_user(conn, user)
    return Response(status_code=204)


@router.delete("/me", status_code=204)
def delete_me(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    delete_user(conn, user)
    return Response(status_code=204)


class PrivacyIn(BaseModel):
    share_checkins: bool | None = None
    show_in_leaderboard: bool | None = None
    searchable: bool | None = None
    suggest_by_venues: bool | None = None
    regular_public: bool | None = None
    stats_visibility: Literal["friends", "me"] | None = None


@router.patch("/me/privacy", response_model=PrivacyOut)
def privacy(body: PrivacyIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Gizlilik ayarları: only the fields sent are changed."""
    changes = body.model_dump(exclude_none=True)
    if not changes:
        return user
    columns = ", ".join(f"{name} = %({name})s" for name in changes)
    return conn.execute(
        f"UPDATE users SET {columns} WHERE id = %(id)s RETURNING share_checkins, show_in_leaderboard, searchable, suggest_by_venues, regular_public, stats_visibility",
        {**changes, "id": user["id"]},
    ).fetchone()


class EmailIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    email: str
    code: str
    password: str


class CodeIn(BaseModel):
    code: str


@router.post("/auth/forgot", status_code=204)
def forgot(body: EmailIn, conn: psycopg.Connection = Depends(get_conn)):
    """"Şifremi unuttum": e-mails a code if the address has an account (the answer is the same either way)."""
    request_reset(conn, body.email, datetime.now(timezone.utc))
    return Response(status_code=204)


@router.post("/auth/reset", status_code=204)
def reset(body: ResetIn, conn: psycopg.Connection = Depends(get_conn)):
    try:
        reset_password(conn, body.email, body.code, body.password, datetime.now(timezone.utc))
    except AccountError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.post("/me/email/code", status_code=204)
def verification_code(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Sends (again) the code that verifies the account's e-mail."""
    try:
        request_verification(conn, user, datetime.now(timezone.utc))
    except AccountError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.post("/me/email/verify", response_model=UserOut)
def verify(body: CodeIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return verify_email(conn, user, body.code, datetime.now(timezone.utc))
    except AccountError as e:
        raise _fail(e) from None
