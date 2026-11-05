-- "Kurucu mekan": the first venues of the launch, marked by an admin; shown on the venue page and the map card.
ALTER TABLE venue_profiles ADD COLUMN IF NOT EXISTS founder BOOLEAN NOT NULL DEFAULT false;
-- "Buradayım, gel": after a check-in the person calls their friends, at most once per check-in.
CREATE TABLE IF NOT EXISTS come_calls (
    checkin_id  BIGINT PRIMARY KEY REFERENCES checkins(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS come_calls_user ON come_calls (user_id, created_at);
