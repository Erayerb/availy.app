"""Overture places (cafés, restaurants, bars, libraries, coworking…) in İstanbul → CSV for import_place_candidates.py.

Not part of the app (needs: pip install duckdb). Usage: python scripts/fetch_overture_places.py data/overture-places.csv
"""
import sys
import duckdb

out = sys.argv[1]
AREAS = {"İstanbul": (40.80, 28.00, 41.60, 29.95)}
CATS = ("cafe", "coffee_shop", "restaurant", "bar", "pub", "library", "coworking_space", "bakery", "tea_room",
        "dessert_shop", "fast_food_restaurant", "cocktail_bar", "wine_bar", "lounge", "breakfast_and_brunch_restaurant",
        "ice_cream_shop", "frozen_yoghurt_shop", "patisserie", "pastry_shop", "juice_bar", "tea_house", "hookah_bar",
        "brewery", "beer_bar", "internet_cafe", "food_court", "creperie", "waffle_shop", "bubble_tea")
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
where = " OR ".join(
    f"(bbox.xmin BETWEEN {w} AND {e} AND bbox.ymin BETWEEN {s} AND {n})" for s, w, n, e in AREAS.values()
)
q = f"""
COPY (
  SELECT id, names.primary AS name, taxonomy.primary AS category, confidence,
         list_transform(sources, x -> x.dataset) AS sources,
         operating_status,
         (bbox.ymin + bbox.ymax) / 2 AS lat, (bbox.xmin + bbox.xmax) / 2 AS lon
  FROM read_parquet('s3://overturemaps-us-west-2/release/2026-10-21.0/theme=places/type=place/*', hive_partitioning=1)
  WHERE ({where}) AND list_has_any(taxonomy.hierarchy, {list(CATS)})
) TO '{out}' (HEADER, DELIMITER '|')
"""
try:
    con.execute(q)
except duckdb.BinderException:
    # Older schema without operating_status
    con.execute(q.replace("operating_status,", "NULL AS operating_status,"))
print(con.execute(f"SELECT count(*) FROM read_csv('{out}', delim='|', header=true)").fetchone())
