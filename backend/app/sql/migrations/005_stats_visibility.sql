-- Who sees the statistics on a profile (points, check-ins, discoveries, streak, badges):
-- 'friends' (default) or 'me' (only the person)
ALTER TABLE users ADD COLUMN IF NOT EXISTS stats_visibility TEXT NOT NULL DEFAULT 'friends'
    CHECK (stats_visibility IN ('friends', 'me'));
