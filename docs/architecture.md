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
- **Semt yoğunluğu:** Aynı semtteki tüm mekanların (harita alanı ve filtreden bağımsız) ortalama oranı → aynı seviyeler.

## 4. Veritabanı şeması

- `venues(id, name, category, location geography(Point,4326), capacity int, neighborhood, district, tags text[], created_at)`
  — `location` GIST, `tags` GIN, `district` index
- `popularity` (0–1): sahte doluluğu ölçekler; 0 = her zaman boş
- `category`: cafe, bar, coworking, library (gece kulübü yok)
- `tags` (amaç filtresi): socializing, coworking, entertainment, quiet — bir mekanın birden fazla etiketi olabilir

## 5. API uçları (v1)

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/health` | Servis + DB durumu |
| GET | `/v1/venues?bbox=minLon,minLat,maxLon,maxLat&tags=quiet,coworking` | Haritadaki mekanlar + doluluk + semt yoğunluğu (en fazla 200). `tags` verilirse en az birine uyanlar. |
| GET | `/v1/venues/search?q=&district=&tags=` | İsimle arama (büyük/küçük harf duyarsız), semt ve amaç filtresi |
| GET | `/v1/districts` | Semt listesi (Türkçe sıralı) |

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
