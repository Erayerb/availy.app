"""Write the demo venues as JSON for the mobile app's static (web) data mode.

Run from the repo root: python3 backend/scripts/export_demo_venues.py
Only uses the standard library, so it also runs in CI without dependencies.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.demo_data import demo_venue_rows  # noqa: E402

OUTPUT = ROOT / "mobile" / "src" / "data" / "demoVenues.json"

def main() -> None:
    venues = [{"id": i, **row} for i, row in enumerate(demo_venue_rows(), start=1)]
    OUTPUT.write_text(json.dumps(venues, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(venues)} venues to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
