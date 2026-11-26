from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    max_venues_per_request: int = 400
    # Sign in with Google / Apple: our app's ids there (empty: the button stays hidden)
    google_client_ids: list[str] = []  # web, iOS and Android OAuth client ids
    apple_audiences: list[str] = []  # the iOS bundle id (and a Services ID for the web)

    # v2 shows real venues only; the fictional v1 demo venues stay in the database but are hidden
    hidden_venue_sources: list[str] = ["demo"]

    # Web pages allowed to call the API from a browser (the phone app is not affected by CORS)
    cors_origins: list[str] = [
        "http://localhost:8081",  # expo start --web
        "http://localhost:8765",  # local web build preview
        "https://erayerb.github.io",  # web demo
    ]

    # Occupancy level thresholds (ratio: 0 = empty, 1 = full)
    occupancy_low_max: float = 0.40
    occupancy_medium_max: float = 0.75

    # E-mail (codes for "Şifremi unuttum" and verification) via Resend; without a key the
    # e-mail is only written to the server log (local development)
    resend_api_key: str = ""
    # Was the secret for "Rehberden bul" phone hashes (removed 2026-11-26); kept so the server's PHONE_PEPPER setting stays valid
    phone_pepper: str = "availy-dev-pepper"
    mail_from: str = "availo <onboarding@resend.dev>"
    # Place suggestions while typing (places_api.py): komoot's free public Photon; our own Photon server's
    # address (…/api/) when that one is not enough (PHOTON_URL on Render)
    photon_url: str = "https://photon.komoot.io/api/"
    # Bug reports and contact messages are also e-mailed here (empty: only kept in the database)
    support_email: str = ""

    # Phone notifications while the app is closed: new 🔔 items go to Expo's push service this often
    # (0: off, e.g. in tests). The items themselves come from events; this only delivers them.
    push_interval_seconds: int = 30

    # Local time of the venues (opening hours, "today", weekly rankings)
    dummy_timezone: str = "Europe/Istanbul"


settings = Settings()
