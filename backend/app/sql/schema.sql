-- PostGIS (the local Docker image creates it in docker/db/init.sql; hosted databases such as Neon need it here)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS venues (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    location    GEOGRAPHY(Point, 4326) NOT NULL,
    capacity    INTEGER NOT NULL CHECK (capacity > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added for filtering and the short location label ("Moda, Kadıköy")
ALTER TABLE venues ADD COLUMN IF NOT EXISTS neighborhood TEXT NOT NULL DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS district TEXT NOT NULL DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
-- Scales the dummy occupancy (0 = always empty, 1 = normal)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS popularity REAL NOT NULL DEFAULT 1
    CHECK (popularity >= 0 AND popularity <= 1);
-- Test venues that are crowded at every hour (dummy occupancy only)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS always_busy BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS venues_location_gist ON venues USING GIST (location);
CREATE INDEX IF NOT EXISTS venues_tags_gin ON venues USING GIN (tags);
CREATE INDEX IF NOT EXISTS venues_district ON venues (district);

-- v2: server-side accounts. Only a scrypt hash of the password is stored.
CREATE TABLE IF NOT EXISTS users (
    id             BIGSERIAL PRIMARY KEY,
    email          TEXT NOT NULL UNIQUE,  -- stored lower-case
    name           TEXT NOT NULL,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'personal' CHECK (role IN ('personal', 'business')),
    -- Business accounts: the venue they run and their package
    venue_id       BIGINT REFERENCES venues(id) ON DELETE SET NULL,
    plan           TEXT,
    -- How much this user's check-ins count (lowered when they keep contradicting others)
    trust          REAL NOT NULL DEFAULT 1 CHECK (trust >= 0 AND trust <= 1),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sign-in sessions: the app keeps a random token, the server only its SHA-256 hash
CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- v2 guests: an account created automatically with only an id (no e-mail or password yet).
-- Their check-ins and points are kept when they later sign up (same id).
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

-- v2 check-ins: each one is a visit and an occupancy report. The user's location is
-- only checked at check-in time and never stored.
CREATE TABLE IF NOT EXISTS checkins (
    id          BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,  -- NULL once anonymised
    level       TEXT NOT NULL CHECK (level IN ('low', 'medium', 'high')),
    queue       BOOLEAN,  -- "Sıra var mı?" (only for Kalabalık)
    seats       BOOLEAN,  -- "Oturacak yer var mı?" (only for Orta)
    is_first    BOOLEAN NOT NULL DEFAULT false,  -- the venue's first check-in ("Burayı X keşfetti")
    is_demo     BOOLEAN NOT NULL DEFAULT false,  -- generated demo data, not a real visit
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (queue IS NULL OR level = 'high'),
    CHECK (seats IS NULL OR level = 'medium')
);
CREATE INDEX IF NOT EXISTS checkins_venue_time ON checkins (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkins_user_time ON checkins (user_id, created_at DESC);
-- Only one first check-in per venue, even if two people check in at the same moment
CREATE UNIQUE INDEX IF NOT EXISTS checkins_one_first ON checkins (venue_id) WHERE is_first;

-- v2 availy points: one row per award (check-in, first check-in bonus); the total is their sum
CREATE TABLE IF NOT EXISTS points (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      INTEGER NOT NULL,
    reason      TEXT NOT NULL CHECK (reason IN ('checkin', 'first_checkin')),
    checkin_id  BIGINT REFERENCES checkins(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS points_user ON points (user_id);

-- v2: where a venue comes from. 'demo' = fictional v1 demo venues (hidden in v2), 'osm' = OpenStreetMap
ALTER TABLE venues ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS osm_id TEXT;  -- e.g. "node/123456", for re-imports
CREATE UNIQUE INDEX IF NOT EXISTS venues_osm_id ON venues (osm_id) WHERE osm_id IS NOT NULL;
-- Opening hours from the data source; NULL = default hours of the category
ALTER TABLE venues ADD COLUMN IF NOT EXISTS open_hour SMALLINT CHECK (open_hour BETWEEN 0 AND 24);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS close_hour SMALLINT CHECK (close_hour BETWEEN 0 AND 24);
-- Demo venues added before the column existed
UPDATE venues SET source = 'demo' WHERE source = 'manual' AND name LIKE 'Demo %';

-- v2: check-ins can be private: they still count for the occupancy, but the name is never shown
-- ("Burayı X keşfetti", and later to friends)
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- v2: unique user name ("@eray") for finding friends; guests have none
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users (lower(username)) WHERE username IS NOT NULL;

-- v2 friends: a request becomes a friendship when the other person accepts it
CREATE TABLE IF NOT EXISTS friendships (
    requester_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS friendships_addressee ON friendships (addressee_id);

-- v2 reviews: one per person and venue (a new one replaces the old), stars + an optional comment.
-- Other registered users can reply if the author allows it.
CREATE TABLE IF NOT EXISTS reviews (
    id             BIGSERIAL PRIMARY KEY,
    venue_id       BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body           TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 280),
    allow_replies  BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (venue_id, user_id)
);
CREATE TABLE IF NOT EXISTS review_replies (
    id          BIGSERIAL PRIMARY KEY,
    review_id   BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 280),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_replies_review ON review_replies (review_id);

-- v2: two reviews per person and venue (no longer one)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_venue_id_user_id_key;
CREATE INDEX IF NOT EXISTS reviews_venue_user ON reviews (venue_id, user_id);

-- v2 privacy: what others may see (all on by default)
ALTER TABLE users ADD COLUMN IF NOT EXISTS share_checkins BOOLEAN NOT NULL DEFAULT true;       -- friends see my check-ins
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_in_leaderboard BOOLEAN NOT NULL DEFAULT true;  -- "Herkes" ranking
ALTER TABLE users ADD COLUMN IF NOT EXISTS searchable BOOLEAN NOT NULL DEFAULT true;           -- found by user-name search

-- v2 notifications: when a friend request was accepted
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS points_created ON points (created_at);

-- v2 safety: blocking (no friendship, no requests, their content hidden both ways),
-- muting (still friends, but nothing from them in my feed) and reporting reviews / replies
CREATE TABLE IF NOT EXISTS blocks (
    blocker_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS mutes (
    muter_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muted_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (muter_id, muted_id),
    CHECK (muter_id <> muted_id)
);
CREATE TABLE IF NOT EXISTS reports (
    id           BIGSERIAL PRIMARY KEY,
    reporter_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_id    BIGINT REFERENCES reviews(id) ON DELETE CASCADE,
    reply_id     BIGINT REFERENCES review_replies(id) ON DELETE CASCADE,
    reason       TEXT NOT NULL CHECK (reason IN ('insult', 'spam', 'false', 'other')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((review_id IS NULL) <> (reply_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_once ON reports (reporter_id, COALESCE(review_id, 0), COALESCE(reply_id, 0));

-- v2: "Hesabı dondur": the account stays, but its profile and activity are hidden until the next sign-in
ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT false;

-- v2: a business thanks the customer who discovered its venue (once per venue); the customer
-- gets it as a notification and shows it at the counter
CREATE TABLE IF NOT EXISTS discoverer_rewards (
    venue_id    BIGINT PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2: business campaigns and their coupons, on the server so every customer sees them
CREATE TABLE IF NOT EXISTS campaigns (
    id              BIGSERIAL PRIMARY KEY,
    venue_id        BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    business_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    message         TEXT NOT NULL,
    discount        INTEGER CHECK (discount IS NULL OR discount BETWEEN 1 AND 90),
    radius_km       NUMERIC NOT NULL CHECK (radius_km > 0 AND radius_km <= 10),
    max_claims      INTEGER CHECK (max_claims IS NULL OR max_claims > 0),
    duration_hours  INTEGER NOT NULL CHECK (duration_hours BETWEEN 1 AND 24),
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    hidden          BOOLEAN NOT NULL DEFAULT false  -- "Sil": gone from the business's list, coupons stay
);
CREATE INDEX IF NOT EXISTS campaigns_ends ON campaigns (ends_at);
CREATE INDEX IF NOT EXISTS campaigns_venue ON campaigns (venue_id);
CREATE TABLE IF NOT EXISTS coupons (
    code         TEXT PRIMARY KEY,  -- "AV-7K3P", shown at the counter
    campaign_id  BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    claimed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    redeemed_at  TIMESTAMPTZ,
    UNIQUE (campaign_id, user_id)
);
CREATE INDEX IF NOT EXISTS coupons_user ON coupons (user_id);
-- "gösterim": each person counts once per campaign
CREATE TABLE IF NOT EXISTS campaign_views (
    campaign_id  BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, user_id)
);

-- v2: "Şifremi unuttum" and e-mail verification: a 6-digit code sent by e-mail (only its hash is kept)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS email_codes (
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose     TEXT NOT NULL CHECK (purpose IN ('reset', 'verify')),
    code_hash   TEXT NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, purpose)
);

-- v2: the business's public profile, shown on its venue page (cover photo, Instagram, phone, ✓ badge)
CREATE TABLE IF NOT EXISTS venue_profiles (
    venue_id    BIGINT PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
    photo       TEXT,  -- data URI of the cover photo (small JPEG)
    photo_at    TIMESTAMPTZ,
    instagram   TEXT,  -- user name without "@"
    phone       TEXT,
    verified    BOOLEAN NOT NULL DEFAULT false,  -- "✓ Doğrulanmış işletme": set after an ownership check
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2: "Mekan ekle": venues added by users (source 'user') wait for approval; three different people on
-- different days checking in there approve them; unapproved ones disappear after 30 days
ALTER TABLE venues ADD COLUMN IF NOT EXISTS added_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE points DROP CONSTRAINT IF EXISTS points_reason_check;
ALTER TABLE points ADD CONSTRAINT points_reason_check
    CHECK (reason IN ('checkin', 'first_checkin', 'venue_added', 'invite'));

-- v2: the business corrects its venue's address, neighbourhood / district and map point (where "Yol tarifi" goes);
-- an OpenStreetMap re-import then keeps them
ALTER TABLE venues ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS edited_by_business BOOLEAN NOT NULL DEFAULT false;

-- v2: loyalty on the server. A venue runs a stamp card or a paid membership (shown only, no payment);
-- customers join it themselves and the business stamps them with their customer code (M-123456)
CREATE TABLE IF NOT EXISTS loyalty_programs (
    venue_id         BIGINT PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
    kind             TEXT NOT NULL CHECK (kind IN ('stamps', 'membership')),
    stamps_required  INTEGER NOT NULL DEFAULT 5 CHECK (stamps_required BETWEEN 2 AND 20),
    reward           TEXT NOT NULL DEFAULT '',
    price            INTEGER NOT NULL DEFAULT 0,
    perk             TEXT NOT NULL DEFAULT '',
    active           BOOLEAN NOT NULL DEFAULT true,
    activated_at     TIMESTAMPTZ NOT NULL DEFAULT now()  -- when customers could last start seeing it (notification)
);
CREATE TABLE IF NOT EXISTS loyalty_members (
    venue_id      BIGINT NOT NULL REFERENCES loyalty_programs(venue_id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    stamps        INTEGER NOT NULL DEFAULT 0,  -- on the current card
    rewards       INTEGER NOT NULL DEFAULT 0,  -- full cards not used yet
    total_stamps  INTEGER NOT NULL DEFAULT 0,  -- for availy points
    PRIMARY KEY (venue_id, user_id)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_code TEXT UNIQUE;  -- "M-123456", shown as a QR at the counter

-- v2: who invited whom (the invite link ?invite=eray): they become friends, the inviter gets points
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
-- v2: "Benimle aynı mekanlara gidenlere önerilebileyim" (Gizlilik)
ALTER TABLE users ADD COLUMN IF NOT EXISTS suggest_by_venues BOOLEAN NOT NULL DEFAULT true;
-- v2: "Rehberden bul" (optional): only a keyed hash of the user's own phone number is kept; the
-- numbers from the phone's contacts are compared and never stored
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_hash TEXT;
CREATE INDEX IF NOT EXISTS users_phone_hash ON users (phone_hash) WHERE phone_hash IS NOT NULL;

-- v2: "İşletmeye haber ver": customers ask a venue without a business account to join; at some
-- counts the venue's e-mail (when known, e.g. from OpenStreetMap) gets a note with the number only
CREATE TABLE IF NOT EXISTS venue_requests (
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (venue_id, user_id)
);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS requests_mailed INTEGER NOT NULL DEFAULT 0;  -- count at the last e-mail

-- v2: "Check-in yapana kupon": the coupon goes only to people who check in at the venue
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS checkin_only BOOLEAN NOT NULL DEFAULT false;

-- v2: "Hata bildir" and "İletişime geç" messages from the app (also e-mailed to SUPPORT_EMAIL when set)
CREATE TABLE IF NOT EXISTS support_messages (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('bug', 'contact')),
    topic       TEXT NOT NULL,
    body        TEXT NOT NULL,
    email       TEXT,  -- where to answer
    app_info    TEXT,  -- platform and app version, for bug reports
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2: after a check-in the user may add a few words ("Fikrini yaz"); friends like and comment on check-ins
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS note TEXT;
CREATE TABLE IF NOT EXISTS checkin_likes (
    checkin_id  BIGINT NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (checkin_id, user_id)
);
CREATE TABLE IF NOT EXISTS checkin_comments (
    id          BIGSERIAL PRIMARY KEY,
    checkin_id  BIGINT NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkin_comments_checkin ON checkin_comments (checkin_id);

-- v2: the 🔔 list keeps items until the user deletes them (one by one, or "Temizle" for all)
CREATE TABLE IF NOT EXISTS notification_dismissals (
    user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key      TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_cleared_at TIMESTAMPTZ;

-- v2: the words after a check-in are a review now ("Burası nasıl?"); it shows with the check-in in Akış
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS checkin_id BIGINT REFERENCES checkins(id) ON DELETE SET NULL;

-- v2: groups ("Grup oluştur"): a name and members, with their own ranking; people join when invited
CREATE TABLE IF NOT EXISTS groups (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
    owner_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS group_members (
    group_id    BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT NOT NULL CHECK (status IN ('invited', 'member')),
    invited_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS group_members_user ON group_members (user_id);

-- v2: wrong passwords. The 2nd wrong one warns, the 3rd locks password sign-in until the
-- password is reset with a code sent by e-mail ("Şifremi unuttum")
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_locked BOOLEAN NOT NULL DEFAULT false;

-- v2: "👑 Buranın müdavimi" on a venue page: friends always see it (when check-ins are shared); everyone only with this on
ALTER TABLE users ADD COLUMN IF NOT EXISTS regular_public BOOLEAN NOT NULL DEFAULT false;

-- v2: venue lists ("Ders çalışılacak yerler"): private, for friends, or for anyone with the link
CREATE TABLE IF NOT EXISTS venue_lists (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
    visibility  TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'link')),
    share_code  TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venue_lists_owner ON venue_lists (owner_id);
CREATE TABLE IF NOT EXISTS venue_list_items (
    list_id   BIGINT NOT NULL REFERENCES venue_lists(id) ON DELETE CASCADE,
    venue_id  BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (list_id, venue_id)
);
