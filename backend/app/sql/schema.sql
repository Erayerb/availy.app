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

-- v2 availy points: one row per award (check-in, first check-in bonus); the total is their sum
CREATE TABLE IF NOT EXISTS points (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      INTEGER NOT NULL,
    reason      TEXT NOT NULL CHECK (reason IN ('checkin', 'first_checkin')),
    checkin_id  BIGINT REFERENCES checkins(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS points_user ON points (user_id);

-- v2: where a venue comes from. 'demo' = fictional v1 demo venues (hidden in v2), 'osm' = OpenStreetMap
ALTER TABLE venues ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS osm_id TEXT;  -- e.g. "node/123456", for re-imports
CREATE UNIQUE INDEX IF NOT EXISTS venues_osm_id ON venues (osm_id) WHERE osm_id IS NOT NULL;
-- Opening hours from the data source; NULL = default hours of the category
ALTER TABLE venues ADD COLUMN IF NOT EXISTS open_hour SMALLINT CHECK (open_hour BETWEEN 0 AND 24);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS close_hour SMALLINT CHECK (close_hour BETWEEN 0 AND 24);
-- Demo venues added before the column existed
UPDATE venues SET source = 'demo' WHERE source = 'manual' AND name LIKE 'Demo %';

-- v2: check-ins can be private: they still count for the occupancy, but the name is never shown
-- ("Burayı X keşfetti", and later to friends)
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- v2: unique user name ("@eray") for finding friends; guests have none
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users (lower(username)) WHERE username IS NOT NULL;

-- v2 friends: a request becomes a friendship when the other person accepts it
CREATE TABLE IF NOT EXISTS friendships (
    requester_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS friendships_addressee ON friendships (addressee_id);

-- v2 reviews: one per person and venue (a new one replaces the old), stars + an optional comment.
-- Other registered users can reply if the author allows it.
CREATE TABLE IF NOT EXISTS reviews (
    id             BIGSERIAL PRIMARY KEY,
    venue_id       BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body           TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 280),
    allow_replies  BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (venue_id, user_id)
);
CREATE TABLE IF NOT EXISTS review_replies (
    id          BIGSERIAL PRIMARY KEY,
    review_id   BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 280),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_replies_review ON review_replies (review_id);

-- v2: two reviews per person and venue (no longer one)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_venue_id_user_id_key;
CREATE INDEX IF NOT EXISTS reviews_venue_user ON reviews (venue_id, user_id);

-- v2 privacy: what others may see (all on by default)
ALTER TABLE users ADD COLUMN IF NOT EXISTS share_checkins BOOLEAN NOT NULL DEFAULT true;       -- friends see my check-ins
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_in_leaderboard BOOLEAN NOT NULL DEFAULT true;  -- "Herkes" ranking
ALTER TABLE users ADD COLUMN IF NOT EXISTS searchable BOOLEAN NOT NULL DEFAULT true;           -- found by user-name search

-- v2 notifications: when a friend request was accepted
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS points_created ON points (created_at);

-- v2 safety: blocking (no friendship, no requests, their content hidden both ways),
-- muting (still friends, but nothing from them in my feed) and reporting reviews / replies
CREATE TABLE IF NOT EXISTS blocks (
    blocker_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS mutes (
    muter_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muted_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (muter_id, muted_id),
    CHECK (muter_id <> muted_id)
);
CREATE TABLE IF NOT EXISTS reports (
    id           BIGSERIAL PRIMARY KEY,
    reporter_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_id    BIGINT REFERENCES reviews(id) ON DELETE CASCADE,
    reply_id     BIGINT REFERENCES review_replies(id) ON DELETE CASCADE,
    reason       TEXT NOT NULL CHECK (reason IN ('insult', 'spam', 'false', 'other')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((review_id IS NULL) <> (reply_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_once ON reports (reporter_id, COALESCE(review_id, 0), COALESCE(reply_id, 0));
