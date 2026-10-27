-- Profile photos (until now the app showed the user name's first letter). A table of their own,
-- so the users row stays small; the picture is a small JPEG as a data URI, like venue covers.
CREATE TABLE IF NOT EXISTS user_photos (
    user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    photo       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
