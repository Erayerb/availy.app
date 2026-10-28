-- Moderation (Daha fazla > Yönetici): an admin removes a reported review or reply for everyone,
-- or dismisses its reports (they then no longer hide it). Admins are set by hand in the database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE review_replies ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
