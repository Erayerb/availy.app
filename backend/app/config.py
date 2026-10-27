from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    max_venues_per_request: int = 200

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
    # Secret mixed into phone-number hashes ("Rehberden bul"); set PHONE_PEPPER on the server
    phone_pepper: str = "availy-dev-pepper"
    mail_from: str = "availy <onboarding@resend.dev>"
    # Bug reports and contact messages are also e-mailed here (empty: only kept in the database)
    support_email: str = ""

    # Local time of the venues (opening hours, "today", weekly rankings)
    dummy_timezone: str = "Europe/Istanbul"


settings = Settings()
