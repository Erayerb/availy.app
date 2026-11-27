-- Test venues added while trying the app (asked to be removed, 2026-11-27): taken off the map, search and
-- "Yeni keşfedilen mekanlar" like a closed venue. Rows and check-ins stay (user data is not deleted).
UPDATE venues SET closed_at = now()
WHERE source = 'user' AND name IN ('kafe3', 'ery', 'kafe34') AND closed_at IS NULL;
