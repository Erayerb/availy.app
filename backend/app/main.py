from contextlib import asynccontextmanager
from datetime import datetime, timezone

import psycopg
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import settings
from app.db import apply_schema, get_conn, pool
from app.occupancy import Level, OccupancyProvider, get_occupancy_provider
from app.venues import find_venues_in_bbox, parse_bbox


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


class Venue(BaseModel):
    id: int
    name: str
    category: str
    capacity: int
    lat: float
    lon: float
    occupancy: OccupancyOut


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
    conn: psycopg.Connection = Depends(get_conn),
    provider: OccupancyProvider = Depends(get_occupancy_provider),
):
    try:
        parsed = parse_bbox(bbox)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    venues = find_venues_in_bbox(conn, parsed, settings.max_venues_per_request)
    now = datetime.now(timezone.utc)
    return [
        {**v, "occupancy": provider.get(v["id"], now)}
        for v in venues
    ]
