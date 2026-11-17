"""Foursquare OS Places in İstanbul → CSV for import_place_candidates.py (closed / stale ones are dropped on import).

Not part of the app (needs: pip install duckdb). The dataset is gated on Hugging Face: accept its terms, make a read
token and put HF_TOKEN=... in .env (never commit it). Usage:
    HF_TOKEN=... python scripts/fetch_foursquare_places.py data/foursquare-places.csv
"""
import os, sys
import duckdb

out = sys.argv[1]
AREAS = [(40.80, 28.00, 41.60, 29.95)]  # İstanbul il sınırını kapsayan kutu
KINDS = ["Café", "Coffee", "Restaurant", "Bar", "Pub", "Bakery", "Ice Cream", "Dessert", "Tea", "Library",
         "Coworking", "Pastry", "Juice", "Brewery", "Lounge", "Diner", "Pizzeria", "Steakhouse", "Kebab", "Burger"]
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
con.execute(f"CREATE SECRET hf (TYPE HUGGINGFACE, TOKEN '{os.environ['HF_TOKEN']}')")
box = " OR ".join(f"(latitude BETWEEN {s} AND {n} AND longitude BETWEEN {w} AND {e})" for s, w, n, e in AREAS)
kind = " OR ".join(f"array_to_string(fsq_category_labels, '|') ILIKE '%{k}%'" for k in KINDS)
con.execute(f"""
COPY (
  SELECT fsq_place_id AS id, name, fsq_category_labels[1] AS category, latitude AS lat, longitude AS lon,
         date_closed, date_refreshed, array_to_string(unresolved_flags, ',') AS flags
  FROM read_parquet('hf://datasets/foursquare/fsq-os-places/release/dt=2026-10-15/places/parquet/*.parquet')
  WHERE country = 'TR' AND ({box}) AND ({kind})
) TO '{out}' (HEADER, DELIMITER '|')
""")
print(con.execute(f"SELECT count(*) FROM read_csv('{out}', delim='|', header=true)").fetchone())
