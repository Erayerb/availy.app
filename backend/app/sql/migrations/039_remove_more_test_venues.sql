-- More test venues typed in by hand while trying the app (asked, 2026-11-27): the ones eray added himself
-- (source 'user'), not the real places he added from the candidate list (source 'overture' / 'foursquare').
-- Taken off like a closed venue; rows and check-ins stay.
UPDATE venues SET closed_at = now()
WHERE source = 'user' AND closed_at IS NULL
  AND name IN ('dondurma evim', 'sevencan kafe', 'kafe2', 'orsp cafe')
  AND added_by = (SELECT id FROM users WHERE lower(username) = 'eray');
