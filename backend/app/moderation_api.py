"""v2 endpoints: moderation for admins (Daha fazla > Yönetici)."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.moderation import ModerationError, dismiss_reports, remove_item, reported_items
from app.venue_issues import open_issues, report_issue, resolve_issue

router = APIRouter(prefix="/v1/admin")
# "Bilgi yanlış mı?" from the venue page (any signed-in user)
venue_router = APIRouter(prefix="/v1")

Kind = Literal["review", "reply"]


class ReportedOut(BaseModel):
    kind: Kind
    id: int
    body: str
    rating: int | None
    author: str | None
    venue_name: str
    venue_id: int
    reports: int
    reasons: list[str]
    last_at: datetime
    from_business: bool  # the venue's own business reported it


def _fail(e: ModerationError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


@router.get("/reports", response_model=list[ReportedOut])
def reports(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return reported_items(conn, user)
    except ModerationError as e:
        raise _fail(e) from None


@router.post("/{kind}/{item_id}/remove", status_code=204)
def remove(kind: Kind, item_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """Kaldır: gone for everyone."""
    try:
        remove_item(conn, user, kind, item_id, now)
    except ModerationError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.post("/{kind}/{item_id}/dismiss", status_code=204)
def dismiss(kind: Kind, item_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """Şikâyeti reddet: it stays and is no longer hidden by these reports."""
    try:
        dismiss_reports(conn, user, kind, item_id, now)
    except ModerationError as e:
        raise _fail(e) from None
    return Response(status_code=204)


IssueKind = Literal["closed", "hours", "location", "name"]


class IssueIn(BaseModel):
    kind: IssueKind
    note: str | None = Field(None, max_length=500)


@venue_router.post("/venues/{venue_id}/issues", status_code=204)
def report(venue_id: int, body: IssueIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """Bilgi yanlış mı?: kapanmış / saatler / konum / ad."""
    try:
        report_issue(conn, user, venue_id, body.kind, body.note, now)
    except ModerationError as e:
        raise _fail(e) from None
    return Response(status_code=204)


class IssueOut(BaseModel):
    venue_id: int
    venue_name: str
    district: str
    open_hour: int | None
    close_hour: int | None
    kind: IssueKind
    reports: int
    notes: list[str]
    last_at: datetime


@router.get("/venue-issues", response_model=list[IssueOut])
def issues(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Kontrol edilecek mekanlar: the same thing reported by 3 people."""
    try:
        return open_issues(conn, user)
    except ModerationError as e:
        raise _fail(e) from None


class ResolveIn(BaseModel):
    action: Literal["close", "fixed", "dismiss"]
    name: str | None = Field(None, max_length=80)
    open_hour: int | None = Field(None, ge=0, le=24)
    close_hour: int | None = Field(None, ge=0, le=24)


@router.post("/venue-issues/{venue_id}/{kind}", status_code=204)
def resolve(
    venue_id: int,
    kind: IssueKind,
    body: ResolveIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """Kapandı (off the map) / Düzelttim (name, hours) / Bildirim yanlış."""
    try:
        resolve_issue(conn, user, venue_id, kind, body.action, now, body.name, body.open_hour, body.close_hour)
    except ModerationError as e:
        raise _fail(e) from None
    return Response(status_code=204)
