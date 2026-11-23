-- Phone notifications while the app is closed (Expo push): each signed-in phone's address
CREATE TABLE IF NOT EXISTS push_tokens (
    token       TEXT PRIMARY KEY,  -- "ExponentPushToken[...]"
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user ON push_tokens (user_id);
-- The newest 🔔 item already sent to the person's phones
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

-- availo+ profile: a cover photo and a coloured frame round the photo
CREATE TABLE IF NOT EXISTS user_covers (
    user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    photo       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS frame_color TEXT;
