-- "Şu an burada": a photo taken at check-in, shown on the venue page for 24 hours, then deleted
CREATE TABLE IF NOT EXISTS moment_photos (
    id          BIGSERIAL PRIMARY KEY,
    checkin_id  BIGINT NOT NULL UNIQUE REFERENCES checkins(id) ON DELETE CASCADE,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo       TEXT NOT NULL,                       -- data URI (small JPEG, location data removed on the phone)
    audience    TEXT NOT NULL DEFAULT 'everyone' CHECK (audience IN ('everyone', 'friends')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    hidden_at   TIMESTAMPTZ                          -- hidden after reports, until an admin decides
);
CREATE INDEX IF NOT EXISTS moment_photos_venue ON moment_photos (venue_id, expires_at);

CREATE TABLE IF NOT EXISTS moment_reports (
    photo_id    BIGINT NOT NULL REFERENCES moment_photos(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL CHECK (reason IN ('inappropriate', 'person', 'unrelated', 'spam')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (photo_id, user_id)
);

-- The default choice when sharing (Gizlilik ayarları)
ALTER TABLE users ADD COLUMN IF NOT EXISTS moment_audience TEXT NOT NULL DEFAULT 'everyone'
    CHECK (moment_audience IN ('everyone', 'friends'));

-- +5 points for a photo (taken back when it is removed after reports); the 'moment' reason is in schema.sql
ALTER TABLE points ADD COLUMN IF NOT EXISTS moment_id BIGINT REFERENCES moment_photos(id) ON DELETE SET NULL;
