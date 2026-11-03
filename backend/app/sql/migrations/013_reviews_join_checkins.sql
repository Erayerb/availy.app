-- A review written on the venue page within a day of a check-in shows under that check-in in Akış,
-- like the ones written right after it. Each check-in takes one (the earliest).
UPDATE reviews r SET checkin_id = m.checkin_id
FROM (
    SELECT DISTINCT ON (x.checkin_id) x.id, x.checkin_id
    FROM (
        SELECT r2.id, r2.created_at,
               (SELECT c.id FROM checkins c
                WHERE c.user_id = r2.user_id AND c.venue_id = r2.venue_id AND NOT c.is_demo
                  AND c.created_at <= r2.created_at AND c.created_at > r2.created_at - interval '24 hours'
                ORDER BY c.created_at DESC LIMIT 1) AS checkin_id
        FROM reviews r2 WHERE r2.checkin_id IS NULL
    ) x
    WHERE x.checkin_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM reviews taken WHERE taken.checkin_id = x.checkin_id)
    ORDER BY x.checkin_id, x.created_at
) m
WHERE r.id = m.id;
