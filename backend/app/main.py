from contextlib import asynccontextmanager
from datetime import datetime, timezone

import psycopg
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import settings
from app.db import apply_schema, get_conn, pool
from app.occupancy import Level, OccupancyProvider, average_occupancy, get_occupancy_provider
from app.venues import (
    find_venues_by_district,
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


class OccupancyOut(BaseModel):
    level: Level
    ratio: float
    updated_at: datetime


class AreaOccupancyOut(BaseModel):
    level: Level
    ratio: float


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
    occupancy: OccupancyOut
    district_occupancy: AreaOccupancyOut


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
    provider: OccupancyProvider = Depends(get_occupancy_provider),
):
    try:
        parsed = parse_bbox(bbox)
        parsed_tags = parse_tags(tags)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    venues = find_venues_in_bbox(conn, parsed, settings.max_venues_per_request, parsed_tags)
    return with_occupancy(conn, provider, venues)


@app.get("/v1/venues/search", response_model=list[Venue])
def search(
    q: str = Query("", max_length=50, description="Part of the venue name"),
    district: str | None = Query(None),
    tags: str | None = Query(None, description=TAGS_DESCRIPTION),
    ids: str | None = Query(None, description="Comma-separated venue ids, e.g. favorites"),
    conn: psycopg.Connection = Depends(get_conn),
    provider: OccupancyProvider = Depends(get_occupancy_provider),
):
    try:
        parsed_tags = parse_tags(tags)
        parsed_ids = parse_ids(ids, settings.max_venues_per_request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    venues = search_venues(
        conn, q.strip(), district or None, parsed_tags, settings.max_venues_per_request, parsed_ids
    )
    return with_occupancy(conn, provider, venues)


@app.get("/v1/districts", response_model=list[str])
def districts(conn: psycopg.Connection = Depends(get_conn)):
    return list_districts(conn)


def with_occupancy(conn: psycopg.Connection, provider: OccupancyProvider, venues: list[dict]) -> list[dict]:
    """Attach each venue's occupancy and its district's average occupancy."""
    now = datetime.now(timezone.utc)

    # District busyness covers every venue in the district, not only the visible ones
    members = find_venues_by_district(conn, sorted({v["district"] for v in venues}))
    district_occupancy = {
        district: average_occupancy([provider.get(m["id"], now, m["popularity"]).ratio for m in group])
        for district, group in members.items()
    }

    return [
        {
            **v,
            "occupancy": provider.get(v["id"], now, v["popularity"]),
            "district_occupancy": district_occupancy[v["district"]],
        }
        for v in venues
    ]
