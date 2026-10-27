-- Removes what nothing reads any more (approved by the owner):
--   * device_accounts: the "same phone" rule, tried and taken out
--   * checkins.counts: whether a check-in counted for the occupancy under that rule
DROP TABLE IF EXISTS device_accounts;
ALTER TABLE checkins DROP COLUMN IF EXISTS counts;
