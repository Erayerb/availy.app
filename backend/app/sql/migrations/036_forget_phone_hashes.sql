-- "Rehberden bul" was removed (2026-11-26): the saved phone-number hashes are no longer used, so they are
-- forgotten (asked for). The column stays empty in case the feature comes back with a new consent.
UPDATE users SET phone_hash = NULL WHERE phone_hash IS NOT NULL;
