-- "Google ile devam et" / "Apple ile devam et": which outside account belongs to which user
CREATE TABLE IF NOT EXISTS user_identities (
    provider    TEXT NOT NULL,          -- 'google' or 'apple'
    subject     TEXT NOT NULL,          -- the provider's stable id for the person ("sub")
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS user_identities_user ON user_identities (user_id);
