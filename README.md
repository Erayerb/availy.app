# Availy

Mekanların anlık doluluğunu haritada gösteren mobil uygulama. (Geliştirme aşamasında)

## Çalıştırma

```bash
cp .env.example .env
docker compose up -d --build --wait
docker compose run --rm backend python -m app.import_osm   # pilot bölgelerin mekanları (OpenStreetMap)
```

Veritabanı değişiklikleri: `backend/app/sql/migrations/` (numaralı dosyalar, sunucu açılırken bir kez çalışır;
ayrıntı orada README'de).

- API: http://localhost:8000 (dokümantasyon: http://localhost:8000/docs)
- Örnek: http://localhost:8000/v1/venues?bbox=28.95,40.97,29.05,41.10

## Testler

```bash
./docker/db/test_db.sh
docker compose run --rm backend pytest -q
```

## Mobil uygulama (telefonda)

1. Telefona **Expo Go** uygulamasını kur (App Store / Google Play).
2. Telefon ve Mac aynı Wi-Fi'da olmalı. `mobile/.env` içindeki IP Mac'in IP'si olmalı (`ipconfig getifaddr en0`).
3. Backend çalışıyor olmalı (`docker compose up -d`).
4. Başlat ve çıkan QR kodu telefonla okut:

```bash
cd mobile && npm start
```

Testler: `cd mobile && npm test && npm run typecheck`

## Web (GitHub Pages)

Her push'ta GitHub Actions iki sürümü yayınlar:
- https://erayerb.github.io/availy.app/ : v1 (`main` dalı), backend olmadan gömülü demo verisiyle
- https://erayerb.github.io/availy.app/v2/ : v2 (`v2-checkin` dalı), çevrimiçi backend'le (`V2_API_URL`)
