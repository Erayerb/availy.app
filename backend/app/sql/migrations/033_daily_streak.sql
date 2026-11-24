-- The streak is daily now ("🔥 5 gün üst üste"): a save covers one day (older rows: the Monday of a week)
ALTER TABLE streak_saves RENAME COLUMN week_start TO day;
