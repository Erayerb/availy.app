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

-- v2: server-side accounts. Only a scrypt hash of the password is stored.
CREATE TABLE IF NOT EXISTS users (
    id             BIGSERIAL PRIMARY KEY,
    email          TEXT NOT NULL UNIQUE,  -- stored lower-case
    name           TEXT NOT NULL,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'personal' CHECK (role IN ('personal', 'business')),
    -- Business accounts: the venue they run and their package
    venue_id       BIGINT REFERENCES venues(id) ON DELETE SET NULL,
    plan           TEXT,
    -- How much this user's check-ins count (lowered when they keep contradicting others)
    trust          REAL NOT NULL DEFAULT 1 CHECK (trust >= 0 AND trust <= 1),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sign-in sessions: the app keeps a random token, the server only its SHA-256 hash
CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- v2 guests: an account created automatically with only an id (no e-mail or password yet).
-- Their check-ins and points are kept when they later sign up (same id).
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

-- v2 check-ins: each one is a visit and an occupancy report. The user's location is
-- only checked at check-in time and never stored.
CREATE TABLE IF NOT EXISTS checkins (
    id          BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,  -- NULL once anonymised
    level       TEXT NOT NULL CHECK (level IN ('low', 'medium', 'high')),
    queue       BOOLEAN,  -- "Sıra var mı?" (only for Kalabalık)
    seats       BOOLEAN,  -- "Oturacak yer var mı?" (only for Orta)
    is_first    BOOLEAN NOT NULL DEFAULT false,  -- the venue's first check-in ("Burayı X keşfetti")
    is_demo     BOOLEAN NOT NULL DEFAULT false,  -- generated demo data, not a real visit
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (queue IS NULL OR level = 'high'),
    CHECK (seats IS NULL OR level = 'medium')
);
CREATE INDEX IF NOT EXISTS checkins_venue_time ON checkins (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkins_user_time ON checkins (user_id, created_at DESC);
-- Only one first check-in per venue, even if two people check in at the same moment
CREATE UNIQUE INDEX IF NOT EXISTS checkins_one_first ON checkins (venue_id) WHERE is_first;
