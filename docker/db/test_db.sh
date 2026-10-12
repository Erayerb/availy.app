#!/usr/bin/env sh
# Smoke test: the db container is up and the PostGIS extension is installed.
set -eu

cd "$(dirname "$0")/../.."

docker compose exec -T db sh -c \
    'psql -v ON_ERROR_STOP=1 -qtA -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT postgis_version();"' \
    >/dev/null || { echo "FAIL: postgis extension missing"; exit 1; }

echo "OK: postgis is installed"
