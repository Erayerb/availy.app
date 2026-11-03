-- Uygunsuz mekan adları: a new "Bilgi yanlış mı?" option; a user-added venue reported by 3 registered people
-- stays hidden (hidden_at) until an admin looks at it.
ALTER TABLE venues ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE venue_issues DROP CONSTRAINT IF EXISTS venue_issues_kind_check;
ALTER TABLE venue_issues ADD CONSTRAINT venue_issues_kind_check
    CHECK (kind IN ('closed', 'hours', 'location', 'name', 'offensive_name'));
