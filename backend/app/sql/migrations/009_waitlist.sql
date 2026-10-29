-- Tanıtım sayfası (mobile/public/tanitim): "Moda'da ilk sen dene" and "Mekanını ekle" sign-ups before launch
CREATE TABLE IF NOT EXISTS waitlist (
    id          BIGSERIAL PRIMARY KEY,
    kind        TEXT NOT NULL CHECK (kind IN ('user', 'business')),
    contact     TEXT NOT NULL,  -- e-mail or @instagram
    district    TEXT,
    venue_name  TEXT,           -- business sign-ups
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_contact ON waitlist (kind, lower(contact));
