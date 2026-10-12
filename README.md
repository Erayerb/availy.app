# Availy

Mekanların anlık doluluğunu haritada gösteren mobil uygulama. (Geliştirme aşamasında)

## Çalıştırma

```bash
cp .env.example .env
docker compose up -d --build --wait
docker compose run --rm backend python -m app.seed
```

- API: http://localhost:8000 (dokümantasyon: http://localhost:8000/docs)
- Örnek: http://localhost:8000/v1/venues?bbox=28.95,40.97,29.05,41.10

## Testler

```bash
./docker/db/test_db.sh
docker compose run --rm backend pytest -q
```
