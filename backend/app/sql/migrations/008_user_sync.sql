-- Kept on the server instead of the phone, so they survive a new phone or signing out:
-- favorites (♡), "Sakin olunca haber ver" watches and the app settings
CREATE TABLE IF NOT EXISTS favorites (
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venue_id   BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, venue_id)
);
CREATE TABLE IF NOT EXISTS watches (
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venue_id   BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,  -- the bell turns itself off 6 hours after this
    PRIMARY KEY (user_id, venue_id)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_settings JSONB;
