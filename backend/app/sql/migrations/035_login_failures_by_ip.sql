-- Wrong passwords per IP address: one address trying many accounts is slowed down
-- (the 3-tries lock is per account). Rows older than a day are cleared as new ones come in.
CREATE TABLE IF NOT EXISTS login_failures (
    ip          TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_failures_ip ON login_failures (ip, created_at);
