CREATE TABLE IF NOT EXISTS venues (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    location    GEOGRAPHY(Point, 4326) NOT NULL,
    capacity    INTEGER NOT NULL CHECK (capacity > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added for filtering and the short location label ("Moda, Kadıköy")
ALTER TABLE venues ADD COLUMN IF NOT EXISTS neighborhood TEXT NOT NULL DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS district TEXT NOT NULL DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
-- Scales the dummy occupancy (0 = always empty, 1 = normal)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS popularity REAL NOT NULL DEFAULT 1
    CHECK (popularity >= 0 AND popularity <= 1);
-- Test venues that are crowded at every hour (dummy occupancy only)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS always_busy BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS venues_location_gist ON venues USING GIST (location);
CREATE INDEX IF NOT EXISTS venues_tags_gin ON venues USING GIN (tags);
CREATE INDEX IF NOT EXISTS venues_district ON venues (district);
