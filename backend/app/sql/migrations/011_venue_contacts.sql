-- Contact details of venues from open data (Overture Maps: CDLA-Permissive-2.0 / CC0 / Apache-2.0),
-- kept only to verify a business (a code to that phone or e-mail): never shown in the app.
-- venues.contact_email already exists ("İşletmeye haber ver" e-mails).
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_website TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_source TEXT;  -- e.g. "overture:<id> (meta)", for the attribution
