# Availy

Kafe/coworking gibi mekanların anlık doluluğunu harita üzerinde gösteren
mobil uygulama. Kullanıcı "şu an nerede yer var?" sorusuna cevap bulur.
Gelir modeli (B2B): işletmelere boş saatlerde yakındaki kullanıcıya
kampanya gönderme aracı.

## Teknoloji
- Mobil: React Native + Expo (TypeScript), react-native-maps; telefonda Expo Go ile çalışır
- Backend: Python FastAPI
- Veritabanı: PostgreSQL + PostGIS (Redis ertelendi)
- Altyapı: Docker Compose

## Veri kaynakları
MVP'de gerçek veri toplanmaz; doluluk backend'de sahte üretilir.
Wi-Fi sayımı, MAC, check-in ve simülatör kapsam dışı (bkz. docs/architecture.md §7).

## Klasörler
- backend/ : FastAPI
- mobile/ : Expo (React Native)
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
- Bitti: Aşama 5 (Expo harita, renkli pinler, alt bilgi kartı, %oran gösterimi, 30 sn polling; iPhone'da çalışıyor)
- Not: Kişi sayısı gösterilmez ve API'den kaldırıldı; sadece oran
- Bitti: Ana sayfa (varsayılan ekran): semt seçimi (tek, tekrar basınca kalkar; "✕ Temizle" semt+filtreleri sıfırlar), amaç filtreleri (çoklu, haritayla ortak), mekan arama, 2 sütun kare mekan kartları (türe göre renkli görsel + isim); arama yokken öneriler karışık sırada. Karta dokununca harita o mekanda, bilgi kartı açık açılır
- Bitti: Harita: geri tuşu (ana sayfaya döner), kendi çizdiğimiz yuvarlak pinler (48px dokunma alanı; iOS'un kendi pin vurgusu başka pine atlıyordu), açılır/kapanır filtre kartı + ✕, pin üstünde bilgi kartı (tür, oran, "Bölge: Yoğun", konum, yol tarifi)
- Bitti: Sidebar: selamlama + Ana Sayfa / Harita / Favoriler / Keşfet / Kampanyalar / Hakkında (Keşfet ve Kampanyalar "Yakında") + altta Giriş Yap / Çıkış Yap
- Bitti: Karşılama ekranı (logo, ad, Giriş Yap, Kayıt Ol, Kayıt olmadan devam et); giriş yapılmamışsa her açılışta görünür
- Bitti: Favoriler (♡ mekan kartında ve haritadaki kartta, Favoriler sayfası); telefonda AsyncStorage'da saklanır
- Not: Giriş/kayıt prototip: hesaplar sadece telefonda (AsyncStorage), sunucuya gitmez; şifre değil tuzlu SHA-256 hash saklanır; yanlış şifre/kayıtsız e-posta reddedilir
- Not: Şimdilik misafir de favorileyebilir; yayında sadece giriş yapanlar için `FAVORITES_REQUIRE_LOGIN = true` (mobile/src/lib/favorites.ts)
- Not: Kart harita callout'u DEĞİL, normal view (callout iOS'ta pin atlamasına ve buton kaymasına yol açıyordu)
- Not: Seed silmez, sadece eksik demo mekanları ekler; popularity=0 olanlar hep boş. Gece kulübü yok
- Kararlar: sessizlik mekan türüne göre etiket; bölge yoğunluğu semt bazlı
- Tema: kırmızı + krem (mobile/src/theme.ts); logo: krem daire içinde kırmızı @
- Filtreler: Sosyalleşme, Co-working, Eğlence, Sessizlik, Yemek (restoranlar)
- Haritada seçili noktaya tekrar basınca kart kapanır
- Bitti: Web demo + GitHub Pages (.github/workflows/pages.yml, main'e push'ta): Leaflet/OSM harita (VenueMap.web.tsx), demo veri uygulamaya gömülü (EXPO_PUBLIC_DATA_MODE=static), backend gerekmez; Expo Go etkilenmez
- Not: Demo mekanların tek kaynağı backend/app/demo_data.py; web JSON'u backend/scripts/export_demo_venues.py üretir
- Sırada: kullanıcıyla belirlenecek
- Not: Proje test/prototip; amaç kendi telefonundan göstermek, Mac'i yormamak
- Kararlar: önce polling (30 sn), WebSocket sonra; MVP'de doluluk sahte
