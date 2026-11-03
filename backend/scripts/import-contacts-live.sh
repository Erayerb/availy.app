#!/usr/bin/env bash
# Adds phone, e-mail and website from Overture Maps to the venues of a database (app/import_contacts.py).
# Asks for the database address (it is not shown or saved), downloads the places (~150 MB, a few minutes),
# imports them and deletes the file. Needs Docker running. Add --dry-run to only count the matches.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/backend/overture-places.geojsonseq"
TOOLS="$(mktemp -d)"
trap 'rm -rf "$TOOLS" "$FILE"' EXIT

read -rsp "Veritabanı adresi (postgresql://...): " DATABASE_URL
echo
# Neon's "Connect" box may give it as: psql 'postgresql://...'
DATABASE_URL="${DATABASE_URL#psql }"
DATABASE_URL="${DATABASE_URL//\'/}"
DATABASE_URL="${DATABASE_URL//\"/}"
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | tr -d '[:space:]')"
export DATABASE_URL

# Before the long download: is it one address, and does it connect? (The address itself is never printed)
case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *) echo "Adres postgresql:// ile başlamalı. Yalnızca adresi yapıştır."; exit 1 ;;
esac
if [ "$(printf '%s' "$DATABASE_URL" | grep -o '://' | wc -l | tr -d ' ')" != "1" ]; then
  echo "Adres iki kez yapıştırılmış görünüyor. Yalnızca bir kez yapıştır."
  exit 1
fi
cd "$ROOT"
echo "Veritabanına bağlanılıyor..."
if ! docker compose run --rm -T -e DATABASE_URL backend python -c \
  "import os, psycopg; psycopg.connect(os.environ['DATABASE_URL'], connect_timeout=20).close()" >/dev/null 2>&1; then
  echo "Veritabanına bağlanılamadı. Adresi Neon'dan yeniden kopyala (sonunda fazladan bir şey olmasın) ve Docker'ın açık olduğuna bak."
  exit 1
fi
echo "Bağlantı tamam."

echo "İndirme aracı kuruluyor..."
python3 -m venv "$TOOLS/venv"
"$TOOLS/venv/bin/pip" install -q overturemaps

echo "Mekan dosyası indiriliyor (birkaç dakika sürebilir)..."
"$TOOLS/venv/bin/overturemaps" download --bbox=28.97,40.95,29.17,41.07 -f geojsonseq --type=place -o "$FILE"

cd "$ROOT"
docker compose run --rm -e DATABASE_URL backend python -m app.import_contacts overture-places.geojsonseq "$@"
