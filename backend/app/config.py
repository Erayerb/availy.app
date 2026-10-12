from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    max_venues_per_request: int = 200

    # Occupancy level thresholds (ratio = people / capacity)
    occupancy_low_max: float = 0.40
    occupancy_medium_max: float = 0.75

    # Dummy occupancy: values stay constant within one time bucket
    dummy_bucket_seconds: int = 300
    dummy_timezone: str = "Europe/Istanbul"


settings = Settings()
