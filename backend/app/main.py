from contextlib import asynccontextmanager
from typing import Literal
from datetime import datetime, timezone

import psycopg
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth_api import router as auth_router
from app.campaigns_api import router as campaigns_router
from app.checkins_api import router as checkins_router
from app.friends_api import router as friends_router
from app.reviews_api import router as reviews_router
from app.social_api import router as social_router
from app.safety_api import router as safety_router
from app.business_api import router as business_router
from app.venues_api import router as venues_router
from app.automation_api import router as automation_router
from app.groups_api import router as groups_router
from app.lists_api import router as lists_router
from app.loyalty_api import router as loyalty_router
from app.checkins import load_crowds, load_discoveries, load_trends
from app.config import settings
from app.db import apply_schema, get_conn, pool
from app.hours import local_hour, venue_hours
from app.venue_profiles import load_profiles
from app.occupancy import Level
from app.venues import (
    find_venues_in_bbox,
    list_districts,
    parse_bbox,
    parse_ids,
    parse_tags,
    search_venues,
)

TAGS_DESCRIPTION = "Comma-separated: socializing,coworking,entertainment,quiet,food"


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    with pool.connection() as conn:
        apply_schema(conn)
    yield
    pool.close()


app = FastAPI(title="Availy API", lifespan=lifespan)
# Sign-in uses the Authorization header, not cookies, so credentials stay off
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)
app.include_router(checkins_router)
app.include_router(friends_router)
app.include_router(reviews_router)
app.include_router(social_router)
app.include_router(safety_router)
app.include_router(business_router)
app.include_router(campaigns_router)
app.include_router(venues_router)
app.include_router(loyalty_router)
app.include_router(groups_router)
app.include_router(lists_router)
app.include_router(automation_router)


class CrowdOut(BaseModel):
    """v2: occupancy from recent check-ins."""

    state: Literal["live", "stale", "unexplored"]
    level: Level | None
    ratio: float | None  # only with at least 5 people in the last 90 minutes
    reporters: int
    last_report_at: datetime | None
    queue: bool | None
    seats: bool | None
    yesterday_level: Level | None = None  # stale only: the level at this time yesterday


class DiscoveryOut(BaseModel):
    """v2: "Burayı X keşfetti" (first check-in, shown for 30 days)."""

    name: str | None  # None when the first check-in was private
    username: str | None = None  # shown as "@eray"; None when private (or a guest)
    at: datetime


class Venue(BaseModel):
    id: int
    name: str
    category: str
    capacity: int
    lat: float
    lon: float
    neighborhood: str
    district: str
    tags: list[str]
    crowd: CrowdOut
    discovery: DiscoveryOut | None
    trend: int = 0  # different people who checked in during the last 24 hours ("Trendler")
    open_now: bool
    hours: str  # e.g. "08:00–23:00" or "24 saat açık"
    opens_at: str  # next opening time, shown when closed
    address: str | None = None  # written by the venue's business
    pending: bool = False  # added by a user, waiting for approval ("⏳ Onay bekliyor")
    # The business's profile: cover photo (GET /v1/venues/{id}/photo), links, "✓ Doğrulanmış işletme"
    photo_at: datetime | None = None
    instagram: str | None = None
    phone: str | None = None
    verified: bool = False
    # Written by the venue's business ("Mekan bilgilerini düzenle"); no features: guessed from the type
    description: str | None = None
    amenity_keys: list[str] | None = None


@app.get("/health")
def health(conn: psycopg.Connection = Depends(get_conn)):
    try:
        conn.execute("SELECT 1")
    except psycopg.Error:
        return JSONResponse(status_code=503, content={"status": "error", "db": "down"})
    return {"status": "ok", "db": "ok"}


@app.get("/v1/venues", response_model=list[Venue])
def list_venues(
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat"),
    tags: str | None = Query(None, description=TAGS_DESCRIPTION),
    conn: psycopg.Connection = Depends(get_conn),
):
    try:
        parsed = parse_bbox(bbox)
        parsed_tags = parse_tags(tags)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    venues = find_venues_in_bbox(conn, parsed, settings.max_venues_per_request, parsed_tags)
    return with_crowds(conn, venues)


@app.get("/v1/venues/search", response_model=list[Venue])
def search(
    q: str = Query("", max_length=50, description="Part of the venue name"),
    district: str | None = Query(None),
    tags: str | None = Query(None, description=TAGS_DESCRIPTION),
    ids: str | None = Query(None, description="Comma-separated venue ids, e.g. favorites"),
    conn: psycopg.Connection = Depends(get_conn),
):
    try:
        parsed_tags = parse_tags(tags)
        parsed_ids = parse_ids(ids, settings.max_venues_per_request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    venues = search_venues(
        conn, q.strip(), district or None, parsed_tags, settings.max_venues_per_request, parsed_ids
    )
    return with_crowds(conn, venues)


@app.get("/v1/districts", response_model=list[str])
def districts(conn: psycopg.Connection = Depends(get_conn)):
    return list_districts(conn)


def with_crowds(conn: psycopg.Connection, venues: list[dict]) -> list[dict]:
    """Each venue with its crowd from check-ins, discovery, trend, business profile and opening hours."""
    now = datetime.now(timezone.utc)
    hour = local_hour(now)
    ids = [v["id"] for v in venues]
    crowds = load_crowds(conn, ids, now)
    discoveries = load_discoveries(conn, ids, now)
    trends = load_trends(conn, ids, now)
    profiles = load_profiles(conn, ids)
    result = []
    for v in venues:
        opening = venue_hours(v)
        result.append(
            {
                **v,
                **profiles.get(v["id"], {}),
                "crowd": crowds[v["id"]],
                "discovery": discoveries.get(v["id"]),
                "trend": trends.get(v["id"], 0),
                "open_now": opening.is_open_at_hour(hour),
                "hours": opening.label(),
                "opens_at": opening.opens_at,
            }
        )
    return result
