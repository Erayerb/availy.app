"""v2 venue endpoints for users and businesses: "Mekan ekle" and the business profile."""
from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.reviews_api import optional_user
from app.user_venues import VenueError, add_venue
from app.venue_profiles import ProfileError, load_photo, save_address, save_links, save_photo
from app.support import SupportError, send_support
from app.venue_requests import RequestError, ask_business, request_status

router = APIRouter(prefix="/v1")


class NewVenueIn(BaseModel):
    name: str
    category: str
    lat: float
    lon: float
    neighborhood: str = ""
    district: str = ""
    address: str = ""
    # Where the user is (a customer must be near the venue)
    user_lat: float | None = None
    user_lon: float | None = None
    confirm_near: bool = False  # "Yine de ekle": another venue is right there


class LinksIn(BaseModel):
    instagram: str = ""
    phone: str = ""


class AddressIn(BaseModel):
    address: str = ""
    neighborhood: str = ""
    district: str
    lat: float
    lon: float


class PhotoIn(BaseModel):
    photo: str  # data URI


@router.post("/venues", status_code=201)
def create(
    body: NewVenueIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return add_venue(
            conn, user, body.name, body.category, body.lat, body.lon, body.neighborhood, body.district, now,
            body.address, body.user_lat, body.user_lon, body.confirm_near,
        )
    except VenueError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


@router.put("/venues/{venue_id}/profile")
def links(
    venue_id: int,
    body: LinksIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return save_links(conn, user, venue_id, body.instagram, body.phone, now)
    except ProfileError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


@router.put("/venues/{venue_id}/address")
def address(
    venue_id: int,
    body: AddressIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
):
    try:
        return save_address(conn, user, venue_id, body.address, body.neighborhood, body.district, body.lat, body.lon)
    except ProfileError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


@router.put("/venues/{venue_id}/photo")
def photo(
    venue_id: int,
    body: PhotoIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return {"photo_at": save_photo(conn, user, venue_id, body.photo, now)}
    except ProfileError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


@router.get("/venues/{venue_id}/photo")
def show_photo(venue_id: int, conn: psycopg.Connection = Depends(get_conn)):
    """The cover photo; the app adds ?v=<photo_at>, so it can be cached for long."""
    found = load_photo(conn, venue_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Fotoğraf yok.")
    media_type, data = found
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "public, max-age=31536000"})


class RequestOut(BaseModel):
    has_business: bool
    count: int  # people who asked
    mine: bool


@router.get("/venues/{venue_id}/business-request", response_model=RequestOut)
def business_request(venue_id: int, me: dict | None = Depends(optional_user), conn: psycopg.Connection = Depends(get_conn)):
    return request_status(conn, me, venue_id)


@router.post("/venues/{venue_id}/business-request", response_model=RequestOut)
def ask(
    venue_id: int,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """"İşletmeye haber ver"."""
    try:
        return ask_business(conn, user, venue_id, now)
    except RequestError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


class SupportIn(BaseModel):
    kind: str  # "bug" or "contact"
    topic: str
    body: str
    email: str = ""
    app_info: str = ""  # platform and app version


@router.post("/support", status_code=201)
def support(
    body: SupportIn,
    me: dict | None = Depends(optional_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """"Hata bildir" / "İletişime geç" (also without an account)."""
    try:
        return send_support(conn, me, body.kind, body.topic, body.body, body.email, body.app_info, now)
    except SupportError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None
