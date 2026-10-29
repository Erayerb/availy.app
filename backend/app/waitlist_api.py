"""v2: the waiting list of the Tanıtım sayfası (before launch): people, and businesses that want in."""
import re
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.moderation import ModerationError, require_admin

router = APIRouter(prefix="/v1")

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
INSTAGRAM = re.compile(r"^@?[A-Za-z0-9._]{2,30}$")


class WaitlistIn(BaseModel):
    kind: Literal["user", "business"]
    contact: str = Field(..., max_length=120)
    district: str | None = Field(None, max_length=60)
    venue_name: str | None = Field(None, max_length=120)


@router.post("/waitlist", status_code=204)
def join(body: WaitlistIn, conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """No account needed; the same contact twice is kept once."""
    contact = body.contact.strip()
    if not (EMAIL.match(contact) or INSTAGRAM.match(contact)):
        raise HTTPException(status_code=422, detail="Geçerli bir e-posta ya da Instagram kullanıcı adı yaz.")
    if body.kind == "business" and not (body.venue_name or "").strip():
        raise HTTPException(status_code=422, detail="Mekanının adını yaz.")
    if INSTAGRAM.match(contact) and not contact.startswith("@"):
        contact = f"@{contact}"
    conn.execute(
        """
        INSERT INTO waitlist (kind, contact, district, venue_name, created_at) VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (kind, lower(contact)) DO NOTHING
        """,
        (body.kind, contact, (body.district or "").strip() or None, (body.venue_name or "").strip() or None, now),
    )
    return Response(status_code=204)


class WaitlistOut(BaseModel):
    kind: Literal["user", "business"]
    contact: str
    district: str | None
    venue_name: str | None
    created_at: datetime


@router.get("/admin/waitlist", response_model=list[WaitlistOut])
def waitlist(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Daha fazla > Yönetici: the latest sign-ups."""
    try:
        require_admin(user)
    except ModerationError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None
    return conn.execute(
        "SELECT kind, contact, district, venue_name, created_at FROM waitlist ORDER BY created_at DESC LIMIT 500"
    ).fetchall()
