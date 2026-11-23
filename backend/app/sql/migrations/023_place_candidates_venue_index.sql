-- Deleting or merging a venue clears place_candidates.venue_id; without an index that scans every candidate
CREATE INDEX IF NOT EXISTS place_candidates_venue ON place_candidates (venue_id) WHERE venue_id IS NOT NULL;
