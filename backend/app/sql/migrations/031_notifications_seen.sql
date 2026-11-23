-- When the 🔔 list was last opened: the unread count is the same on every phone of the account
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ;
