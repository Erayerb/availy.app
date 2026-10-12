# Availy — Mimari Plan (Aşama 1)

> Durum: Onaylandı. MVP'de gerçek veri toplanmaz; doluluk sahte (dummy) üretilir.

## 1. Bileşenler

| Bileşen | Görev |
|---|---|
| `mobile/` (React Native + Expo) | Harita ekranı ve mekan detayı. Görünür alanı 30 sn'de bir polling ile yeniler. |
| `backend/` (FastAPI) | REST API, mekan listesi, sahte doluluk üretimi. |
| PostgreSQL + PostGIS | Mekanlar (konum, kapasite). |

## 2. Veri akışı

```
mobile ──GET /v1/venues?bbox=… (30 sn polling)──▶ backend ──▶ Postgres: venues
                                                     │
                                                     └─ DummyOccupancyProvider → doluluk
```

## 3. Doluluk (MVP: sahte veri)

- Doluluk gerçek bir kaynaktan gelmez; backend'deki `DummyOccupancyProvider` üretir.
- Üretim deterministiktir: `(venue_id, 5 dakikalık zaman dilimi)` ile seed'lenen rastgele sayı
  + günün saatine göre basit bir eğri (öğle/akşam daha dolu). Böylece aynı 5 dk içinde
  her polling aynı sonucu döner, harita zamanla değişir.
- `ratio` (0–1) → seviye:
  - `low`: < 0.40
  - `medium`: 0.40 – 0.75
  - `high`: > 0.75
- Provider bir arayüzün (`OccupancyProvider`) arkasındadır; ileride gerçek kaynak takılabilir.
- Eşikler config'te tutulur, birim testleriyle doğrulanır.

## 4. Veritabanı şeması

- `venues(id, name, category, location geography(Point,4326), capacity int, created_at)`
  — `location` üzerinde GIST index

## 5. API uçları (v1)

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/health` | Servis + DB durumu |
| GET | `/v1/venues?bbox=minLon,minLat,maxLon,maxLat` | Haritadaki mekanlar + doluluk (en fazla 200 sonuç) |
| GET | `/v1/venues/{id}` | Mekan detayı + anlık doluluk |

MVP'de kullanıcı hesabı ve kimlik doğrulama yok.

## 6. Docker Compose servisleri

`db` (`postgis/postgis:18-3.6`), `backend` (`python:3.14-slim`, port 8000). Tüm değişkenler `.env`'den okunur.

## 7. Kapsam dışı (MVP sonrası)

**Veri toplama (tamamı ertelendi):**
- Wi-Fi cihaz sayımı (`/v1/ingest/wifi`, API anahtarı)
- `simulator/` ile sahte Wi-Fi verisi gönderimi
- MAC adresi tabanlı sayım (hash'leme, tekilleştirme)
- Kullanıcı check-in'leri (GPS ile ≤ 100 m doğrulama, rate limit, cihaz token'ı)
- Kaynakları birleştirme modeli ("büyük olanı al" / ağırlıklı model)
- Doluluk geçmişi tablosu (`wifi_readings`, `checkins`, `occupancy_snapshots`)

**Diğer:**
- Redis (cache / rate limit — gerçek veri gelince gerekir)
- WebSocket (önce polling kararı)
- Kullanıcı hesapları
- İşletme paneli ve kampanya gönderimi

## 8. Aşamalar

2. Docker Compose + DB init (sadece PostGIS extension)
3. Backend iskeleti + `venues` şeması + `/health` + `/v1/venues` (sahte seed verisiyle) + testler
4. `DummyOccupancyProvider` + birim testleri
5. Expo harita ekranı + 30 sn polling (telefonda Expo Go)
6. Mekan detay ekranı

## 9. Kararlar

- Polling aralığı: 30 sn.
- MVP'de gerçek veri toplanmaz; doluluk sahte üretilir.
