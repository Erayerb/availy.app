"""Load open-data places as hidden candidates: Overture first, then Foursquare (its copies of Overture skipped).

    docker compose run --rm -e PYTHONPATH=/app backend python scripts/import_place_candidates.py data/overture-places.csv data/foursquare-places.csv
"""
import sys

import psycopg
from psycopg.rows import dict_row

from app.config import settings
from app.db import apply_schema
from app.place_candidates import import_csv, import_fsq_csv

if __name__ == "__main__":
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        apply_schema(conn)
        # python scripts/import_place_candidates.py overture.csv [foursquare.csv]
        print("Overture:", import_csv(conn, sys.argv[1]))
        if len(sys.argv) > 2:
            print("Foursquare:", import_fsq_csv(conn, sys.argv[2]))
