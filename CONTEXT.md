# Availy

Kafe/coworking gibi mekanların anlık doluluğunu harita üzerinde gösteren
mobil uygulama. Kullanıcı "şu an nerede yer var?" sorusuna cevap bulur.
Gelir modeli (B2B): işletmelere boş saatlerde yakındaki kullanıcıya
kampanya gönderme aracı.

## Teknoloji
- Mobil: Flutter + flutter_map (OpenStreetMap), Riverpod, Dio
- Backend: Python FastAPI
- Veritabanı: PostgreSQL + PostGIS (Redis ertelendi)
- Altyapı: Docker Compose

## Veri kaynakları
MVP'de gerçek veri toplanmaz; doluluk backend'de sahte üretilir.
Wi-Fi sayımı, MAC, check-in ve simülatör kapsam dışı (bkz. docs/architecture.md §7).

## Klasörler
- backend/ : FastAPI
- mobile/ : Flutter
- simulator/ : (ertelendi) sahte Wi-Fi veri üreticisi
- docker/ : Dockerfile ve DB scriptleri
- docs/ : mimari notlar

## Kurallar
- Küçük, test edilebilir adımlarla ilerle; onay almadan sonraki adıma geçme
- Kod yorumları ve değişken adları İngilizce, açıklamalar Türkçe
- Gizli anahtarlar .env'de, koda gömülmez
- Her modül için kısa test ekle
- Emin olmadığın paket/sürüm bilgisini varsayma, belirt

## Durum
- Bitti: repo ve klasör yapısı
- Bitti: Aşama 1 mimari plan (docs/architecture.md)
- Bitti: Aşama 2 (docker-compose.yml + docker/db/init.sql, PostGIS çalışıyor)
- Bitti: Aşama 3 (FastAPI backend, venues şeması, 10 sahte mekan, /health, /v1/venues, 13 test)
- Bitti: Aşama 4 (sahte doluluk: app/occupancy.py, /v1/venues içinde occupancy alanı, 25 test)
- Sırada: Aşama 5 (Flutter harita + 30 sn polling; önce Flutter kurulumu)
- Kararlar: önce polling (30 sn), WebSocket sonra; MVP'de doluluk sahte
