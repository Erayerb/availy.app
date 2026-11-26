"""Place suggestions for the map's search box while typing ("Moda Cad" → Moda Caddesi, Caferağa).

The app asks us, we ask Photon (komoot's free OpenStreetMap search, made for search-as-you-type; Nominatim does
not allow that). Going through the server lets us keep the answers for a day, drop bus stops and the like, ask
politely with our own User-Agent, and change the provider later without a new app version.
"""
import json
import logging
import threading
import time
import urllib.parse
import urllib.request
from collections import OrderedDict

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth_api import client_ip
from app.config import settings

router = APIRouter(prefix="/v1")
log = logging.getLogger(__name__)

USER_AGENT = "availo-api/1.0 (place search; https://erayerb.github.io/availy.app/v2/tanitim/)"
ISTANBUL_BBOX = "27.9,40.75,29.95,41.6"  # west, south, east, north
TIMEOUT_SECONDS = 4
CACHE_SECONDS = 24 * 3600
CACHE_SIZE = 3000
PER_IP_PER_MINUTE = 40  # the app waits for a pause in typing, so a person sends far fewer
MAX_RESULTS = 8

# Stops, platforms, entrances: they share the neighbourhood's name and push the useful rows out
SKIP = {
    "highway": None,  # every highway feature that is not a street itself (bus_stop, platform, junction…)
    "railway": {"tram_stop", "stop", "subway_entrance", "platform", "halt", "level_crossing"},
    "public_transport": None,
    "amenity": {"ticket_validator", "bus_station", "parking", "parking_entrance", "bicycle_rental", "atm", "taxi"},
}


class Place(BaseModel):
    label: str
    detail: str  # "Caferağa, Kadıköy"
    lat: float
    lon: float


_cache: OrderedDict[str, tuple[float, list[dict]]] = OrderedDict()
_calls: dict[str, list[float]] = {}
_lock = threading.Lock()


def fetch_photon(params: dict) -> dict:
    request = urllib.request.Request(f"{settings.photon_url}?{urllib.parse.urlencode(params)}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.load(response)


def _skipped(props: dict) -> bool:
    key, value = props.get("osm_key"), props.get("osm_value")
    # The box also takes in a bit of Kocaeli and Tekirdağ
    if props.get("state") not in (None, "İstanbul"):
        return True
    if key == "highway":
        return props.get("type") != "street"
    if key in SKIP:
        return SKIP[key] is None or value in SKIP[key]
    return False


def to_places(collection: dict) -> list[dict]:
    """Photon's GeoJSON → label + the area under it, best first, one row per name and area."""
    places: list[dict] = []
    for feature in collection.get("features", []):
        props, coords = feature.get("properties") or {}, (feature.get("geometry") or {}).get("coordinates")
        if _skipped(props) or not coords:
            continue
        label = props.get("name") or " ".join(filter(None, [props.get("street"), props.get("housenumber")]))
        if not label:
            continue
        areas: list[str] = []
        for area in (props.get("locality"), props.get("district"), props.get("city"), props.get("county")):
            area = (area or "").removesuffix(" Mahallesi").strip()
            if area and area not in areas and area != label and area != "İstanbul":
                areas.append(area)
        place = {"label": label, "detail": ", ".join(areas[:2]), "lat": coords[1], "lon": coords[0]}
        if not any(p["label"] == place["label"] and p["detail"] == place["detail"] for p in places):
            places.append(place)
    return places[:MAX_RESULTS]


def _too_many(ip: str, now: float) -> bool:
    recent = [t for t in _calls.get(ip, []) if now - t < 60]
    recent.append(now)
    _calls[ip] = recent
    if len(_calls) > 10_000:  # forget quiet addresses now and then
        for other in [k for k, v in _calls.items() if not v or now - v[-1] > 60]:
            _calls.pop(other, None)
    return len(recent) > PER_IP_PER_MINUTE


@router.get("/places", response_model=list[Place])
def search_places(
    request: Request,
    q: str = Query(min_length=3, max_length=80),
    lat: float | None = Query(default=None, ge=40.0, le=42.0),
    lon: float | None = Query(default=None, ge=27.0, le=31.0),
):
    text = " ".join(q.split())
    # Near the user first; rounded so neighbours share the cache (0.1° ≈ 10 km)
    bias = (round(lat, 1), round(lon, 1)) if lat is not None and lon is not None else (41.0, 29.0)
    key = f"{text.casefold()}|{bias[0]}|{bias[1]}"
    now = time.time()
    with _lock:
        if _too_many(client_ip(request), now):
            return JSONResponse(status_code=429, content={"detail": "Çok hızlı arıyorsun, biraz bekle."})
        hit = _cache.get(key)
        if hit and now - hit[0] < CACHE_SECONDS:
            _cache.move_to_end(key)
            return hit[1]
    try:
        places = to_places(fetch_photon({"q": text, "lat": bias[0], "lon": bias[1], "bbox": ISTANBUL_BBOX, "limit": 15}))
    except Exception as e:  # Photon slow or busy: no suggestions this time (an older answer if we have one)
        # In Render's log: many of these mean the free Photon is no longer enough (CONTEXT: "Photon yetmezse")
        log.warning("photon failed: %s", e)
        return hit[1] if hit else []
    with _lock:
        _cache[key] = (now, places)
        _cache.move_to_end(key)
        while len(_cache) > CACHE_SIZE:
            _cache.popitem(last=False)
    return places
