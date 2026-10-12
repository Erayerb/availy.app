# Availy

Kafe/coworking gibi mekanların anlık doluluğunu harita üzerinde gösteren
mobil uygulama. Kullanıcı "şu an nerede yer var?" sorusuna cevap bulur.
Gelir modeli (B2B): işletmelere boş saatlerde yakındaki kullanıcıya
kampanya gönderme aracı.

## Teknoloji
- Mobil: Flutter + flutter_map (OpenStreetMap), Riverpod, Dio
- Backend: Python FastAPI
- Veritabanı: PostgreSQL + PostGIS, Redis
- Altyapı: Docker Compose

## Veri kaynakları
1. Wi-Fi cihaz sayısı (MVP'de simülatörden gelir)
2. Kullanıcı check-in'leri (GPS ile mekana en fazla 100 m)
Kişisel veri saklanmaz; MAC adresleri sunucuda hash'lenir.

## Klasörler
- backend/ : FastAPI
- mobile/ : Flutter
- simulator/ : sahte Wi-Fi veri üreticisi
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
- Sırada: Aşama 1 (mimari plan, kod yok)
- Kararlar: önce polling, WebSocket sonra
