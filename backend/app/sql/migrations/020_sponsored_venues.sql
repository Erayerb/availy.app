-- "Sponsorlu mekan": a business pays to be shown first (until payments exist an admin switches it on)
CREATE TABLE IF NOT EXISTS sponsorships (
    id          BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    created_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS sponsorships_venue ON sponsorships (venue_id, ends_at);

-- How often the sponsored card was seen and tapped, per day (counts only, no people)
CREATE TABLE IF NOT EXISTS sponsor_events (
    venue_id  BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    kind      TEXT NOT NULL CHECK (kind IN ('view', 'tap')),
    day       DATE NOT NULL,
    count     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (venue_id, kind, day)
);

-- A business asks to be shown first; the admin sees the request
CREATE TABLE IF NOT EXISTS sponsor_requests (
    venue_id    BIGINT PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    days        INTEGER NOT NULL CHECK (days IN (7, 30)),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
