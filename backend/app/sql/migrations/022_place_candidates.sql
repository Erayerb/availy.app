-- Places from open data (Overture Maps, incl. Foursquare-sourced records) that are not on the map yet.
-- They are found by search ("Haritada yok mu?") and become a venue when someone adds them or checks in.
CREATE TABLE IF NOT EXISTS place_candidates (
    id          TEXT PRIMARY KEY,                 -- the source's id (Overture GERS id)
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,                    -- availo category (cafe, restaurant, bar, library, coworking)
    raw_category TEXT,
    location    GEOGRAPHY(POINT, 4326) NOT NULL,
    confidence  DOUBLE PRECISION NOT NULL,
    sources     TEXT,                             -- e.g. "meta,Foursquare"
    venue_id    BIGINT REFERENCES venues(id) ON DELETE SET NULL,  -- set once it became (or matched) a venue
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS place_candidates_location ON place_candidates USING GIST (location);
