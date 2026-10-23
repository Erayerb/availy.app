# Availy

Kafe, ortak çalışma alanı gibi mekanların anlık doluluğunu harita üzerinde gösteren
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
- Bitti: Karşılama ekranı (logo, Bireysel / İşletme, Giriş Yap, Kayıt Ol, Kayıt olmadan devam et) yalnızca giriş yapılmamışsa; hesap açıksa 1 sn logo ekranı, sonra uygulama
- Bitti: Favoriler (♡ mekan kartında ve haritadaki kartta, Favoriler sayfası); telefonda AsyncStorage'da saklanır
- Not: Giriş/kayıt prototip: hesaplar sadece telefonda (AsyncStorage), sunucuya gitmez; şifre değil tuzlu SHA-256 hash saklanır; yanlış şifre/kayıtsız e-posta reddedilir
- Not: Şimdilik misafir de favorileyebilir; yayında sadece giriş yapanlar için `FAVORITES_REQUIRE_LOGIN = true` (mobile/src/lib/favorites.ts)
- Not: Kart harita callout'u DEĞİL, normal view (callout iOS'ta pin atlamasına ve buton kaymasına yol açıyordu)
- Not: Seed silmez, sadece eksik demo mekanları ekler; popularity=0 olanlar hep boş. Gece kulübü yok
- Kararlar: sessizlik mekan türüne göre etiket; bölge yoğunluğu semt bazlı
- Tema: kırmızı + krem (mobile/src/theme.ts); logo: krem daire içinde kırmızı @
- Yazı logosu: küçük harf, el yazısı "availy" (Dancing Script) ve y'nin kuyruğu yazının altından a'ya uzanır (mobile/src/components/Wordmark.tsx); uygulama adı da "availy"
- "Tüm semtler" hem semt hem Avrupa/Anadolu seçimini sıfırlar
- Filtreler: Sosyalleşme, Ortak çalışma, Eğlence, Sessizlik, Yemek (restoranlar)
- Haritada seçili noktaya tekrar basınca kart kapanır
- Bitti: Web demo + GitHub Pages (.github/workflows/pages.yml, main'e push'ta): Leaflet/OSM harita (VenueMap.web.tsx), demo veri uygulamaya gömülü (EXPO_PUBLIC_DATA_MODE=static), backend gerekmez; Expo Go etkilenmez
- Not: Demo mekanların tek kaynağı backend/app/demo_data.py; web JSON'u backend/scripts/export_demo_venues.py üretir
- Bitti: B2B (proje dokümanı "Tenha Nerede" B2B senaryosuna göre; uygulama adı Availy kalıyor):
  - Kayıtta Bireysel / İşletme seçimi; işletme listeden mekan seçer veya haritadan konumla yeni mekan ekler (yeni mekan sadece o telefonda)
  - İşletme Paneli: anlık doluluk, ölü saat uyarısı (<%40) + tek tıkla hazır kampanya, bugünkü saatlik grafik (/v1/venues/{id}/hourly), semt ortalaması ve 2 km içindeki benzer mekanlarla kıyas, kampanya oluşturma (indirim, 1/2/3 saat, 1/2/5 km), kampanya listesi/bitirme, paket gösterimi (SaaS ₺1.899/ay, kampanya başı ₺150; ödeme yok)
  - Müşteri: Kampanyalar sayfası (konum izni + İstanbul içindeyse yarıçapa göre, değilse tüm aktif kampanyalar), mekan kartı ve karelerde kampanya etiketi
  - Kampanyalar ve işletme mekanları prototipte telefonda (AsyncStorage) saklanır, başka cihazlara gitmez
  - Giriş ve kayıtta Bireysel / İşletme seçimi; girişte hesap türü uyuşmazsa uyarı
  - Konum açıksa ana sayfa ve favoriler en yakından sıralanır, mekanların altında mesafe (m / km) yazar
- Bitti: Geri tuşu ekran geçmişine göre önceki ekrana döner (ana sayfa arama/konum filtreleri korunur)
- Bitti: Ana sayfada "Konum": önce İstanbul (Avr.) / İstanbul (Anadolu) (çoklu), sonra o yakanın semtleri; ikisi de/hiçbiri seçiliyse tüm İstanbul
- Bitti: Kalabalık (%75+) mekanın kartında "Daha boş alternatifler" butonu → alt pop-up: 2 km içinde aynı tür/amaçtaki, en az 10 puan daha boş ve kalabalık olmayan en fazla 3 mekan; seçince harita oraya kayar
- Bitti: Açılış: önce Bireysel / İşletme seçimi, sonra Giriş Yap + Kayıt Ol; "Kayıt olmadan devam et" her adımda görünür
- Bitti: Alternatifler pop-up'ı kaydırılabilir, sınır yok; kampanyası kullanıcıya (konum yoksa kalabalık mekana) ulaşan mekanlar en başta ve 🏷️ etiketli
- Bitti: Yeni mekan eklerken haritadan seçilen konuma göre semt/mahalle otomatik dolar (OpenStreetMap Nominatim; olmazsa en yakın mekanın semti)
- Bitti: Arama Türkçe karakterden bağımsız ("nisantasi" → Nişantaşı) ve mahalle/semt adlarında da arar
- Bitti: İstanbul'un 39 semtinin hepsi Konum'da (mekanı olmayanlar da); birden fazla semt seçilebilir
- Bitti: Alternatifler pop-up'ında 4 satır görünür, fazlası kaydırılır
- Bitti: Harita noktalarının görünmez dokunma alanı küçültüldü (yan yana noktalar birbirinin dokunuşunu almasın)
- Bitti: Çalışma saatleri (türe göre; backend/app/hours.py ve mobile/src/lib/hours.ts): kapalı mekan gri nokta, "Kapalı · 08:00", alternatiflere girmez; test mekanları 24 saat açık
- Bitti: Mekan detay sayfası (tek fotoğraf, saat, kapasite, özellikler, kampanya, sadakat, haritada gör, yol tarifi)
- Bitti: Kupon akışı: müşteri "Kuponu al" → AV-XXXX kodu; işletme "Kupon doğrula"; kampanya başına gösterim / kupon / kullanım istatistiği
- Bitti: Sadakat: işletme damga kartı (ör. 5 damga = 1 kahve) veya ücretli üyelik (gösterim, ödeme yok) kurar; müşteri kodu (M-XXXXXX) ile damga verir; availy puanı (damga 5, kupon 10). Kampanyalar sayfasında Kampanyalar / Kuponlarım / Sadakat sekmeleri
- Bitti: "%70 altına düşünce haber ver" (🔔): uygulama açıkken dakikada bir kontrol, boşalınca telefonda yerel bildirim; web'de uygulama içi uyarı. Ücretsiz planda aynı anda 1 mekan, Premium'da sınırsız
- Bitti: Haritada kullanıcının mavi noktası + "Konumum" butonu; ana sayfada Önerilen / En yakın / En sakin sıralaması; "Kapalıları gizle" ana sayfada ve haritada (Filtreler kartında "Temizle"nin altında, aynı görünümde)
- Bitti: Profil (ad, şifre, hesabı sil, puan) ve Ayarlar (renk körlüğü modu, bildirimler, konum durumu); paylaşma (⤴, web bağlantısı ?venue=Ad)
- Bitti: Ana sayfa ve favorilerde mekana dokununca önce detay sayfası; "Haritada gör" haritayı açar
- Bitti: "Kalabalık" normal modda da koyu turuncu (#D9480F) ve "!" simgeli
- Bitti: İşletme Ayarları: "Ölü saat bildirimi" ve "Otomatik kampanya" (ölü saatte hazır kampanya; en fazla 3 saatte bir); ikisi de şimdilik uygulama açıkken
- Bitti: Mekan bilgilerini düzenleme (ad, saatler, amaçlar, özellikler; telefonda saklanır, listelere uygulanır)
- Bitti: Zamanlanmış / haftalık tekrarlayan kampanyalar (sadece SaaS paketi)
- Bitti: Haftalık / aylık istatistik (/v1/venues/{id}/history: günlük ve haftanın günü ortalamaları + dönem kampanya sonuçları)
- Bitti: Geri bildirim: müşteri detay sayfasında 1–5 puan + yorum (kişi başı bir tane); işletme panelinde ortalama ve son yorumlar
- Bitti: Kapasite arayüzden kaldırıldı (veride varsayılan 50 duruyor); yeni mekan eklerken Özellikler (açık alan, Wi-Fi, priz…) seçilir
- Bitti: Sadakat QR ile: müşteri Sadakat sekmesinde QR'ını gösterir, işletme Sadakat programlarım'da "📷 Damga ver / Ödülü kullan" ile kamerayla okutur (kamera yoksa kodu elle yazma yedeği var)
- Bitti: İşletme Kampanyalar ve Sadakat alt sekmeleri: Kampanyalarım / Kuponlar (kupon QR'ı okutma + alınan kuponlar) / Sadakat programım / Rakipler (3 km içindeki diğer mekanların aktif kampanyaları)
- Bitti: Kampanyaya kişi sınırı (sınırsız, 10, 25, 50, 100 kupon); dolunca "Kuponlar tükendi"
- Bitti: Yeni mekan: açık adres yazılır, haritadan konum isteğe bağlı (adres Nominatim ile bulunur; bulunamazsa semtin ortası)
- Not: Mekan sahipliği doğrulaması şimdilik kapalı (kampanya ve sadakat doğrulamasız kullanılabilir); kod duruyor (VerificationSection)
- Bitti: Alt sekme çubuğu (Midas gibi). Müşteri: Ana Sayfa, Kampanyalar (kampanyalar, kuponlar, sadakat), Harita (ortada), Favoriler, ☰ Daha fazla. İşletme: Ana Sayfa, Panel (açılış ekranı), Harita, Kampanyalar, ☰ Daha fazla. Daha fazla: Profil / İşletme Profili, Abonelik (müşteri), Ayarlar / İşletme Ayarları, İşletme doğrulama, Hata bildir ve iletişim, Hakkında (nasıl kullanılır dahil), Çıkış
- Bitti: Kupon QR ile: müşteri Kuponlarım'da kuponun QR'ını gösterir, işletme Kampanyalar → Kuponlar'da "📷 Kupon QR'ı okut" ile okutur (elle yazma yedeği var)
- Bitti: Hata bildir sayfası, içinde İletişime geç sekmesi (konu, mesaj, e-posta; şimdilik telefonda saklanır)
- Bitti: İşletme doğrulama ekranı görünür ama etkin değil ("Yakında")
- Bitti: "Co-working" her yerde "Ortak çalışma"; işletme mekan adını İşletme Ayarları → Mekan bilgilerini düzenle'den değiştirebilir
- Bitti: Sadakat programı formu "Sadakat programı oluştur" ile açılır, İptal ile kapanır; Damga ver (her alışveriş) ve Ödülü kullandır (kart dolunca) açıklamalı
- Bitti: Mekan bilgilerini düzenle İşletme Ayarları'nda; Paket (kampanya başı / SaaS) İşletme Profili'nde; biten kampanyalar tek tek ya da topluca silinebilir
- Bitti: Ana sayfa, Favoriler ve mekan detayı 30 sn'de bir kendiliğinden yenilenir; aşağı çekince de yenilenir (harita ve panel zaten 30 sn'de bir)
- Bitti: Tanıtım (nasıl kullanılır) şimdilik Hakkında sayfasında, hesap türüne göre: renkler, nerede yer var, boşalınca haber ver, kampanya ve sadakat / panel, ölü saat, kasada QR, mekan bilgileri
- Bitti: %75 ve üstü dolu mekanın kartında ve detayında "⏳ Tahmini boşalma: ~15:20" (/v1/venues/{id}/forecast; %75'in altında 5 dk kalacağı ilk an), "Kapanana kadar kalabalık görünüyor" ya da "Tahmini boşalma belli değil"
- Bitti: Abonelik (B2C): Ücretsiz (ana sayfada reklam alanı, 1 mekan takibi) / Premium ₺79/ay (reklamsız, sınırsız takip); demo, ödeme yok
- Bitti: Biten kampanyada "↻ Tekrar gönder" (aynı mesaj, indirim, yarıçap, süre ve kupon sınırı)
- Bitti: Backend ve web demo aynı sahte doluluğu üretir (aynı rastgele sayı algoritması; iki tarafta da aynı değerleri kontrol eden test)
- Bitti: Test için her saat kalabalık
- Not: Sahte doluluk tüm mekanlarda aynı saat eğrisini kullanıyor; yoğun saatlerde herkes birlikte doluyor. İleride kategoriye göre farklı eğri (kafe öğleden sonra, bar gece) daha gerçekçi olur
- Sırada: kullanıcıyla belirlenecek (bkz. Yapılacaklar)
- Not: Proje test/prototip; amaç kendi telefonundan göstermek, Mac'i yormamak
- Kararlar: önce polling (30 sn), WebSocket sonra; MVP'de doluluk sahte

## Yapılacaklar (v2)
Yalnızca v2 (check-in) ile ilgili işler. v2 dışındakiler "Rafa kaldırıldı" bölümünde. Yapıldıkça "Durum"a taşı.
- ⚠️ GEÇİCİ: check-in mesafesi deneme için 1 km (backend/app/checkins.py `CHECKIN_RADIUS_M`, mobile/src/lib/nearby.ts `CHECKIN_RADIUS_KM`). Yayından / denemeler bitince 150 m'ye geri al

**Sunucu ve hesaplar**
- Gerçek, sunucu taraflı hesap sistemi (v1'de hesaplar ve şifre hash'i telefonda)
- İki telefonla demo: 1) Mac'teki backend, iki telefon aynı Wi-Fi'de Expo Go ile bağlanır (Mac açık olmalı); 2) backend ücretsiz bir sunucuya (ör. Render + Neon), Mac kapalıyken de çalışır
- v2 web demosu ayrı adreste (ör. /availy.app/v2/); internetteki backend'e bağlanır

**Bildirimler** (yayından önce şart; olay olunca gelir, uygulama kapalıyken de; belirli bir saate kurulan bildirim değil)
- Müşteri: "Sakin olunca haber ver" (takip ettiği mekan check-in'lere göre Sakin olunca); yakınındaki bir mekan indirim kampanyası açınca
- İşletme: mekanı Sakin göründüğü an (ölü saat), tek dokunuşla kampanya gönderme önerisiyle
- Nasıl: sunucu check-in'leri ve kampanyaları izler, olay olunca Expo push ile gönderir (telefon push token'ını sunucuya kaydeder; Android için development build gerekir)
- Arkadaşlık istekleri ve yorumlarına gelen yanıtlar da push ile gelsin (şimdilik uygulama açıkken dakikada bir 🔔 listesine bakılıyor)
- Check-in önerisi uygulama kapalıyken de (yayına yaklaşırken): telefonun "bölgeye girdin" özelliği (geofencing, expo-location + TaskManager); "Her zaman" konum izni ve development build gerekir; telefon en fazla ~20 bölge izler, en yakın 20 açık mekan sürekli güncellenmeli. Konum ve izinler sayfasındaki "uygulama kapalıyken konumunu almak" maddesi o zaman güncellenmeli
- Haftalık sıralama ödülleri: ne verileceği (rozet, işletme kuponu…) ve nasıl dağıtılacağı belirlenecek

**Yayın öncesi altyapı** (deneme ortamı: Render ücretsiz + Neon ücretsiz, Frankfurt; Mac kapalıyken de çalışır)
- Deneme ve gerçek ortam ayrı: uygulama çıkarken ikinci bir Render servisi ve ikinci bir Neon veritabanı ("gerçek"); deneme ortamı v2-checkin'den, gerçek ortam main'den yayınlanır. Kod değişmez, yalnızca adresler / ayarlar
- Planlar: Render Starter (~7 $/ay, uyumaz), Neon kullanıcı artınca ücretli plan (~19 $/ay; 7–30 gün geriye dönük yedek). Ücretsiz Neon yalnızca son 24 saate döner
- Veritabanı değişiklikleri sürümlü olsun (migration aracı, ör. Alembic ya da numaralı SQL dosyaları); şimdiki "her açılışta schema.sql" yaklaşımı yalnızca demo için
- Hata takibi: Sentry (backend + uygulama), Render / Neon uyarıları
- Mağaza sürümü: Expo EAS Build ile App Store / Google Play; uygulama kapalıyken bildirimler ve check-in önerisi (geofencing) bu sürümle
- KVKK: sunucular yurt dışında (Frankfurt); yurt dışına aktarım gizlilik politikasında yazmalı, standart sözleşme / açık rıza şartları hukukçuya sorulmalı; gerekirse Türkiye'de barındırma değerlendirilir
- Yayından önce check-in mesafesini 1 km'den 150 m'ye geri al

**KVKK ve güvenlik**
- Verilerimi indir (KVKK erişim hakkı): Profil ayarları'nda hesabındaki her şeyi (hesap, check-in'ler, puanlar, arkadaşlar, yorumlar, ayarlar) tek dosya (JSON) olarak indirme
- Gizlilik politikası ve kullanım koşulları taslak (mobile/src/lib/legal.ts): yayından önce bir hukukçuya kontrol ettirilmeli; şirket unvanı / adresi / MERSİS ve iletişim e-postası doldurulmalı; mağazalar için web'de de yayınlanmalı (bağlantı App Store / Google Play formuna)
- Şikâyet incelemesi: şikâyet edilen yorum / yanıtları görüp kaldırma ya da geri açma için yönetici ekranı (şimdilik 3 şikâyette otomatik gizleniyor)

**İşletme tarafı** (müşteri tarafı bittikten sonra)
- Kampanya, kupon, sadakat, mekan düzenlemeleri ve yorumları sunucuya taşımak (v1'de telefonda)
- Check-in ile bağlamak: ör. "check-in yapana %10" kampanyası
- Panel istatistikleri (saatlik grafik, haftalık / aylık, kıyaslama) check-in verisi biriktikçe geri gelecek
- Zamanlanmış ve otomatik kampanyalar sunucuda çalışsın
- Mekan sahipliği doğrulaması: kampanya ve sadakat için zorunlu; gerçek SMS (mekanın kayıtlı telefonuna) ya da yöneticinin incelediği belge; bir mekanı yalnızca bir hesap alabilir

**v1'den geri gelebilecekler** (sahte veriye dayanıyorlardı; v2'de kaldırıldı)
- Belki eklenir: tahmini boşalma ("Tahmini boşalma: ~15:20"), geçmiş haftaların check-in'lerine göre
- Belki eklenir: "Bölge: Yoğun" satırı, semtteki mekanların güncel check-in'lerinin ortalamasıyla

**Gerçek mekan verisi (pilot bölgeler)** — OSM içe aktarma yapıldı (aşağıdaki notlar bilgi için)
- OpenStreetMap (Overpass API, ücretsiz; ODbL lisansı: uygulamada "© OpenStreetMap katkıcıları" yazmak şart, veritabanını dağıtırsak aynı lisansla). Ekim 2026 sorgusu: Nişantaşı çevresinde 149 mekan (72 kafe, 66 restoran, 7 bar…; 103'ü isimli, 21'inde çalışma saati), Yeditepe kampüsü çevresinde 10; Caddebostan sorgusu sunucu meşgul olduğu için alınamadı
- Alternatifler: Foursquare Open Source Places (Apache 2.0, ücretsiz), Overture Maps Places (açık lisans). Google Places / Google Maps verisini kopyalamak kullanım şartlarına aykırı (yalnızca kendi ekranında, kısa süre saklama)
- Yapılacak: pilot bölgeler için içe aktarma betiği (OSM → `venues`, `osm_id` ile tekrar çalıştırılabilir), kategori eşleme (cafe/restaurant/bar/library/coworking), çalışma saati varsa onu, yoksa türe göre varsayılanı kullanmak; haritada OSM atfı

**availy puanı**
- Kazanım (v2 planı): check-in 10, mekanın ilk check-in'i 50 puan + Kâşif rozeti
- Harcama fikirleri: ödül kataloğu (ör. 200 puan = istenen kafede %10 kupon, işletmeler sponsorlar), Premium indirimi (ör. 500 puan = 1 ay Premium), Getir/Trendyol gibi ortak kuponlar
- Ek kazanım fikirleri: yorum yazmak, Sakin saatte gitmek (kalabalığı dağıtır, işletmenin de işine yarar)

## Versiyon 2: check-in ile doluluk (planlama aşamasında, kod yok)
v1 silinmez: `v1` etiketinde ve `main` dalında olduğu gibi kalır, web demosu v1'i gösterir.
v2 `v2-checkin` dalında geliştirilir, `main`'e hiç alınmaz; hazır olunca ayrı adreste yayınlanır (ör. /availy.app/v2/).
- Bitti: v2 Aşama 1 mimari plan (docs/v2-architecture.md, onaylandı)
- Bitti: v2 misafir hesabı: POST /v1/auth/guest otomatik id'li hesap açar ("Misafir 12", oturum 365 gün, güven 0.5); POST /v1/auth/upgrade ile kayıt olunca aynı id kalır (toplam 100 test)
- Bitti: v2 Aşama 2 (backend: `users` ve `sessions` tabloları, app/accounts.py, POST /v1/auth/register, /login, /logout, GET /v1/me; şifre scrypt, oturum anahtarının sadece hash'i saklanır, 30 gün geçerli; bilinmeyen e-posta ve yanlış şifre aynı mesajı alır; 15 yeni test, toplam 94)
- Bitti: v2 Aşama 3 (`checkins` tablosu, app/checkins.py, POST /v1/venues/{id}/checkins: giriş/misafir gerekli, Sakin/Orta/Kalabalık + "Sıra var mı?" / "Oturacak yer var mı?", mekana ≤150 m (PostGIS; konum saklanmaz), kapalı mekana check-in yok, aynı mekana 2 saatte bir ("Tekrar: 14:00"), kayan 60 dk'da en fazla 10, mekanın ilk check-in'i işaretlenir (aynı anda iki kişi olsa da tek); 11 yeni test, toplam 111)
- Bitti: check-in yarıçapı 150 m
- Bitti: v2 Aşama 4 (app/crowd.py `crowd_from_checkins`: son 90 dk, kişi başı son bildirim, 30 dk yarılanma × güven, Sakin 0.2 / Orta 0.55 / Kalabalık 0.9 → v1 eşikleri; en az 3 kişide oran; "Sıra var" / "Oturacak yer" ağırlıklı çoğunluk; durumlar live / stale / unexplored. /v1/venues ve /search çıktısında `crowd`; v1'in sahte `occupancy` alanı uygulama v2'ye geçene kadar (Aşama 6) duruyor; toplam 120 test)
- Bitti: v2 Aşama 5 (mobil hesaplar sunucuda: mobile/src/lib/accountApi.ts, useAuth sunucuya bağlı; "Kayıt olmadan devam et" sunucuda misafir hesabı açar; misafir Profil'den kayıt olunca aynı id kalır; v1'den kalan telefondaki hesaplar yeniden giriş ister; işletmenin seçtiği mekan ve paket şimdilik telefonda kalır (businessProfiles). Backend'e PATCH /v1/me, POST /v1/me/password, DELETE /v1/me (check-in'ler anonimleşir) ve CORS (localhost + erayerb.github.io) eklendi. Backend 125 test, mobil 98 test; web'de misafir → kayıt → çıkış → giriş denendi)
- Bitti: v2 Aşama 6 (mobil check-in: detay sayfasında "Şu an burası nasıl?" Sakin / Orta / Kalabalık → Kalabalık'ta "Sıra var mı?", Orta'da "Oturacak yer var mı?" → Check-in; konum izni check-in'de yeniden istenir, iOS'ta reddedildiyse Ayarlar'a yönlendirir; misafire "daha az sayılır" notu; ilk check-in'de "✨ İlk check-in senin!". Harita noktaları, kartlar, kutucuklar, alternatifler, "En sakin" sıralaması, paylaşma metni ve "Sakin olunca haber ver" check-in doluluğunu kullanır; durumlar: renkli seviye + "Son bildirim 12 dk önce · 4 kişi" + "~%60" (3+ kişi) + "Sıra var / Oturacak yer var", gri "?" Bilgi yok, mor "✨" Keşfedilmedi. Haritadaki kartta Detaylar yerine "📍 Check-in" (detay sayfasını açar). Tahmini boşalma ve "Bölge" satırı kaldırıldı. İşletme paneli işletme tarafı düzenlenene kadar v1'in sahte doluluğunu kullanıyor. Mobil 103 test; web'de misafir → check-in → ilk check-in → 2 saat kuralı denendi)
- Bitti: Ana sayfa Konum filtresinde yalnızca pilot semtler (Ataşehir, Kadıköy, Şişli) seçilebilir; diğerleri soluk, seçilemez; altında "Şimdilik pilot bölgeler: …" notu
- Bitti: v2 Aşama 7 (`points` tablosu: check-in 10, mekanın ilk check-in'i +50; GET /v1/me puan, check-in sayısı, keşif sayısı ve rozetler ("Kâşif": en az bir ilk check-in) döner; mekan çıktısında `discovery` = ilk check-in yapanın adı, 30 gün; misafir kayıt olunca puanlar korunur. Uygulamada check-in sonrası "+10 puan" / "İlk check-in senin! · +60 puan · Kâşif rozeti", detayda "✨ Burayı X keşfetti · 20 Ekim", Profil'de availy puanı (check-in + v1 damga/kupon puanı), check-in, keşif ve Rozetlerin. Backend 128, mobil 105 test; web'de misafir check-in → kayıt → Profil'de 60 puan + Kâşif denendi)
- Bitti: misafirler her puanın yarısını alır (ilk check-in senaryosu: 5 + 25 = 30); kayıt olunca kazandıkları kalır, sonrası tam
- Bitti: gizli check-in (doluluğa sayılır, ad gösterilmez: "Burayı gizli bir kullanıcı keşfetti"; ileride arkadaşlara da görünmez)
- Bitti: check-in sonrası "Burayı keşfeden 12. kişisin!" (mekana ilk gelişte) ya da "Buraya 3. check-in'in."
- Bitti: rozet kataloğu (İlk Adım, Kâşif, Büyük Kâşif, Gezgin, Müdavim, Gece Kuşu, Yardımsever); Profil'de yuvarlak rozetler, kazanılanlar renkli, kilitliler gri + 🔒 + ilerleme (1/5)
- Bitti: haritada altta "Tümü / Ziyaret ettiklerim" (GET /v1/me/visits)
- Bitti: OpenStreetMap içe aktarma (backend/app/import_osm.py; `venues.source` = osm, `osm_id` ile tekrar çalıştırılabilir, OSM çalışma saati varsa `open_hour` / `close_hour`); v1 demo mekanları silinmedi, v2'de gizli (`hidden_venue_sources`). Atıf: detay ve Hakkında'da "© OpenStreetMap katkıcıları"
- Bitti: kullanıcı adı (kayıtta zorunlu, büyük/küçük harf fark etmeden tekil, 3–20: a-z 0-9 . _; misafir kayıt olurken de seçer); Profil'de @kullaniciadi
- Bitti: arkadaşlar (backend/app/friends.py): kullanıcı adıyla arama, istek / kabul / reddet / çıkar; Daha fazla → Arkadaşlar: QR'ım, QR okut, davet bağlantısını paylaş (WhatsApp / Instagram hikayesi), web'de ?invite=ad ile açılınca istek gider. Misafir arkadaş ekleyemez
- Bitti: kayıt sonrası (ve ilk misafir girişinde) geçilebilen tanıtım, ardından Swarm'daki gibi "İlk check-in'in": konumdan 150 m içindeki en yakın açık mekanın sayfası açılır; yoksa "Devam" haritayı açar (işletmede yalnızca tanıtım)
- Bitti: v2 Aşama 8 (güven puanı: yeni bildirim, aynı mekana son 30 dk'daki en az 2 kişinin bildirimiyle karşılaştırılır; çok farklıysa (Sakin ↔ Kalabalık) güven -0.1, alt sınır 0.2; uyuşuyorsa +0.02, üst sınır 1 (misafirde 0.5); kayıt olan misafirin güveni ikiye katlanır, en fazla 1). Backend 160, mobil 111 test
- Bitti: kayıtta ayrı "Ad" alanı kaldırıldı (kullanıcı adı görünen ad olur; Profil'de ad yok, "Kullanıcı adını değiştir" var: PATCH /v1/me {username}); giriş kullanıcı adı ya da e-postayla. Harita açıklamasında yalnızca "Keşfedilmedi"
- Bitti: yüzde ("~%60") artık en az 5 kişi bildirdiyse görünür (önce 3)
- Bitti: Arkadaşlar'da her arkadaşın son (gizli olmayan) check-in'i: "📍 Mekan · 2 saat önce", basınca mekan açılır (GET /v1/friends `last_checkin`)
- Bitti: Favoriler'de "Kaydedilenler / Ziyaret edilenler" sekmeleri; haritada sol altta "Konumuma git" (izin yoksa yeniden sorar); harita açıklamasında Keşfedilmedi alt satırda; misafir Profil sayfası kaydırılabilir. Backend 163, mobil 111 test
- Bitti: kullanıcı adları her yerde "@eray" (detayda "✨ Burayı @eray keşfetti": `discovery.username`); favoriler telefonda hesap başına ayrı (eski ortak liste silinmedi, kullanılmıyor); alt sekmeler Ana Sayfa · Sosyal · Harita · Favoriler · Daha fazla (Kampanyalar Daha fazla'da; Sosyal: arkadaşların son check-in'leri, istekler, arama, arkadaşlar, QR / davet); haritada Google Maps gibi mavi konum noktası (canlı takip) ve sağ altta "+" → "Check-in yap": en yakın mekanlar + arama, mekana basınca detay; harita açıklamasında "Bilgi yok" yok. Backend 165 test
- Bitti: haritada yakınlaşınca (zoom 16+) mekan adları noktaların altında; çakışan adlar ve başka noktanın üstüne gelen adlar gizlenir, yaklaştıkça açılır (mobile/src/lib/labels.ts). Sosyal'de iki sekme: Akış (arkadaşların son check-in'i + kazandığı puan) ve Arkadaşlar (istekler, arkadaş ekle, beni ekle / QR, arkadaş listesi). Backend 165, mobil 114 test
- Bitti: tek kişinin bildirdiği seviye soluk renkte ve "1 kişiye göre Kalabalık" (2+ kişide normal renk); harita adları Apple Haritalar gibi ikonun sağında, ikon renginde, en fazla 2 satır; "Tekrar: 14:00" alt satırda; Ne arıyorsun'a Gece hayatı (bar, pub, gece kulübü) ve Doğa (OSM park / bahçe / plaj, yeni `park` kategorisi, 24 saat açık) eklendi, OSM yeniden içe aktarıldı (282 mekan); ana sayfada "Önerilen" konum varsa yakından uzağa; akışta "keşfetti" ve puan; haritada Filtreler yalnızca düğme, basınca açılır; "+" ve "Konumuma git" aynı boyda (52); ana sayfa sağ üstte profil ikonu; v1 demo mekanlarına ait (telefonda kayıtlı) sadakat programları ve kampanyalar v2'de gösterilmez, silinmedi. Backend 166, mobil 116 test
- Bitti: mekan yorumları sunucuda (backend/app/reviews.py: `reviews`, `review_replies`; kişi başı mekan başına bir yorum, yenisi eskisinin yerine geçer; 1–5 yıldız + en fazla 280 karakter; "Başkaları yorumuma yanıt verebilsin" anahtarı, yazar her zaman yanıtlayabilir; yalnızca kayıtlı kullanıcılar yazar, herkes okur; kendi yorumunu / yanıtını silebilir). Sosyal > Akış artık GET /v1/feed: arkadaşların son 7 gündeki check-in'leri (keşif + puan), yorumları ve yanıtları. v1'in telefondaki değerlendirmeleri silinmedi; işletme panelindeki geri bildirim bölümü işletme tarafı düzenlenene kadar onları göstermeye devam ediyor. Haritada katlanmış filtrede Temizle ve Kapalıları gizle görünür; kullanıcı adı değişince kartın altında "✓ … olarak değişti"; Sosyal'de de sağ üstte profil. Backend 171, mobil 116 test
- Bitti: bir mekana kişi başı en fazla 2 yorum; Akış'ta yorumlara oradan yanıt; Sosyal > Sıralama (Bu hafta / Tüm zamanlar × Arkadaşlar / Herkes, pazartesi 00:00'da hafta başlar, kendi satırın renkli, altta "Haftalık ödüller kazanabilirsin"; GET /v1/leaderboard); 🔔 bildirimler (Ana Sayfa ve Sosyal'de sağ üstte, okunmamış sayısıyla; arkadaşlık isteği, kabul, yorumuna yanıt; GET /v1/notifications; uygulama açıkken yenileri telefona bildirim olarak da gelir); Ayarlar'da Bildirimler (check-in önerileri, arkadaşlık, yanıtlar, sakin olunca haber ver) ve Gizlilik (varsayılan gizli check-in; sunucuda: arkadaşlar check-in'lerimi görsün, herkese açık sıralamada görüneyim, kullanıcı adımla aranabileyim; PATCH /v1/me/privacy); Daha fazla → Konum ve izinler (konum / kamera / bildirim: ne için, asla ne yapılmaz, izin durumu); check-in önerisi: açık bir mekanın 250 m yakınında 3 dk kalınca (uygulama açıkken) şerit + telefon bildirimi, daha önce gittiysen "Yine … yakınındasın · Daha önce 3 kez check-in yaptın", son 2 saatte orada check-in yaptıysan sormaz. Backend 176, mobil 121 test
- Bitti: kullanıcı profili (sağ üstteki profil ikonu = kendi profilin; Akış'ta, arkadaş listesinde, sıralamada ve yorumlarda isme basınca başkasınınki): puan, check-in, keşif, rozetler, keşfettiği ve check-in yaptığı mekanlar (yalnızca kendin ve check-in'lerini paylaşan arkadaşların), Arkadaş ekle / Kabul et / Sessize al / Arkadaşlıktan çıkar / Engelle (GET /v1/users/{ad}, /block, /mute). Engelleme arkadaşlığı bitirir, istekleri ve birbirinizin yorumlarını gizler; sessize alınan arkadaş Akış'ta görünmez. Yorum ve yanıt şikâyeti (Hakaret / Spam / Yanlış bilgi / Diğer; şikâyet edene hemen, 3 şikâyette herkese gizlenir). Daha fazla: "Profil ayarları" (kullanıcı adı, şifre, çıkış, hesabı silme), ayrı "Gizlilik" (ayarlar + Engellenenler) ve "Konum ve izinler", "Gizlilik politikası ve kullanım koşulları" (taslak; kayıt ekranında onay satırı). 🔔 ve profil ikonu harita dışındaki tüm sekmelerde; Akış kişi başına ayrı bloklarda; mekan sayfasında Haritada gör / Yol tarifi check-in kutusunun altında. Backend 181, mobil 122 test
- Bitti: takip soruları doluluğu etkiler (backend/app/crowd.py `report_score`): Kalabalık + Sıra var 0.98, Kalabalık + Sıra yok 0.82, Orta + Oturacak yer yok 0.70, Orta + Oturacak yer var 0.48 (cevapsız: Sakin 0.2, Orta 0.55, Kalabalık 0.9); seviye ve yüzde bu puanların ağırlıklı ortalamasından. Profil ayarları ve Konum ve izinler açılır-kapanır bölümler (kapalıyken kısa özet; "… izin vermezsen" kalın); profilde mekan listeleri 3 satır, gerisi kutu içinde kayar; arkadaşlıktan çıkarmada onay; "Kullanım koşulları" menü adı. Backend 182, mobil 122 test
- Bitti: haritada filtreler Snapchat gibi yana kayan tek şerit (Temizle, Ziyaret ettiklerim, Kapalıları gizle, amaçlar); internete çıkış hazırlığı: render.yaml (Render ücretsiz web servisi, Docker), Neon için şemada `CREATE EXTENSION postgis`, bağlantı havuzu kopan bağlantıyı yeniler, $PORT; backend/app/copy_venues.py (OSM mekanlarını Neon'a kopyalar); GitHub Pages iş akışı her çalışmada ikisini birden derler: main → kök (v1), v2-checkin → /v2/ (repo değişkeni V2_API_URL ile)
- Bitti: Hesabı geçici olarak dondur (POST /v1/me/freeze: profil, check-in'ler, yorumlar, arkadaş listeleri, sıralama ve aramada görünmez, her yerde çıkış yapılır; tekrar giriş yapınca açılır, veri silinmez); dondurma ve silmede "emin misin?" + kullanıcı adını yazarak onay; profilde "Keşfettiği / Check-in yaptığı mekanlar"da "Tümü ›" ayrı sayfada; haritada 🔥 Trendler (son 24 saatte en çok farklı kişinin check-in yaptığı 20 mekan, venue.trend); Konum ve izinler'de "Asla yapmıyoruz" listeleri kaldırıldı. Backend 184, mobil 123 test
- Bitti: "Bilgi yok" mekanlarda "🕘 Dün bu saatlerde kalabalıktı / orta doluydu / sakindi" (crowd.yesterday_level: 24 saat önceki 90 dakikanın check-in'lerinden); harita filtreleri küçük şerit hâlinde geri tuşunun altında, sağ üstte "✕ Temizle", "Tümü / Ziyaret ettiklerim" altta; profil "Tümü" sayfası keşfedilen ve check-in yapılan mekanları birlikte gösterir; dondurma / silme onayında boş, kırmızı çerçeveli yazma kutusu (doğru yazılınca yeşil). Backend 185, mobil 124 test
- Bitti: e-posta değiştirme (Profil ayarları; POST /v1/me/email, mevcut şifre ister); telefonda e-postaya bağlı veriler (favoriler, kuponlar, damga kartları, üyelikler, değerlendirmeler, 🔔 okundu bilgisi) yeni adrese taşınır (mobile/src/lib/accountData.ts), e-posta başka cihazdan değişse de. Backend 186, mobil 125 test
- Bitti: dark mode. Ayarlar > Görünüm: Cihaz ayarı / Açık / Koyu (varsayılan cihaz; app.json userInterfaceStyle "automatic"). mobile/src/theme.ts: lightColors / darkColors (sıcak koyu kahve zemin #17110E, kırmızı #E0263F); `colors` ve `themed(() => StyleSheet.create(...))` o anki temayı okur, tema değişince ekran yerinde kalarak yeniden çizilir. Koyu temada doluluk renkleri biraz parlak, kategori kutucukları koyulaştırılmış, harita: telefonda Apple Haritalar koyu modu, web'de OpenStreetMap tarayıcıda koyulaştırılmış (koyu harita servisleri API anahtarı istiyor), mekan adlarının çevresi zemin renginde
- Bitti: işletme check-in yapamaz, yorum yazamaz, aramada ve herkese açık sıralamada görünmez; işletmenin mekanı sunucuda (PUT /v1/me/venue); kendi mekanının yorumlarına "İşletme" etiketiyle yanıt (yanıtlar kapalı olsa da), rakiplere yanıt yok; işletme için misafir girişi yok. İşletme paneli check-in verisinden (GET /v1/venues/{id}/stats: bugün saat saat, son 7 gün kişi / ilk kez / tekrar gelen, son 30 gün hafta günleri, keşfeden); sahte doluluk panelden kalktı; ölü saat = müşteriler açık mekanı Sakin bildiriyor; panelde yorumlar. Check-in kutusu son 2 saatte check-in yapıldıysa "Tekrar check-in: 17:47" gösterir. Akış'ta "Yanıt verdi: …". Görünüm Daha fazla'da ayrı sayfa. Backend 189, mobil 126 test
- Yapılacak: eski panel dosyalarını sil (StatsSection, FeedbackSection, HourlyChart, useBusinessData); kalıcı işletme test hesabı (seed)
- Sırada: v2 Aşama 9 (iki telefonla deneme: Mac backend + Expo Go, aynı Wi-Fi), sonra demo check-in'leri ve backend'i internete koyma
Konuşulan kararlar:
- Doluluğu mekanlar değil, check-in yapan kullanıcılar belirler (Swarm / Foursquare benzeri)
- Check-in akışı: önce doluluk seçilir (Sakin / Orta / Kalabalık), sonra Check-in butonu açılır
  - Kalabalık seçilirse ek soru: "Sıra var mı?"
  - Orta seçilirse ek soru: "Oturacak yer var mı?"
- Veri tazeliği: bir bildirim 60–90 dk geçerli, yeni bildirimler daha ağır basar; ekranda "Son bildirim 12 dk önce · 4 kişi"
- Hile koruması: mekana ≤150 m (GPS), aynı mekana birkaç saatte en fazla bir check-in, giriş zorunlu, diğer bildirimlerle sürekli çelişen kullanıcının ağırlığı düşer
- Hiç check-in almamış mekan haritada ayrı bir simgeyle durur; ilk check-in'i yapan ödül kazanır (insanlar yeni yerleri "keşfetmek" için koştursun). Mekan detayında bir süre "Burayı X keşfetti" yazar
- Puan (şimdilik): check-in 10, ilk check-in 50
- Misafir de check-in yapabilir (otomatik id'li hesap); bildirimi daha az sayılır ve bu kullanıcıya check-in ekranında söylenir; kayıt olunca tam sayılır, puanları korunur
- Konum izni açılışta istenir; verilmediyse gereken yerde (check-in, "En yakın", "Konumum") tekrar istenir (iOS'ta reddedildiyse Ayarlar'a yönlendirilir)
- Saatte en fazla 10 check-in: kayan 60 dakika
- Doluluk hesabı son 90 dk'nın check-in'lerini kullanır; aynı kullanıcı aynı mekana 2 saatte bir check-in yapabilir
- Yüzde: Sakin / Orta / Kalabalık seçilir (Sıra var mı? / Oturacak yer var mı? cevabı puanı biraz kaydırır); son 90 dk'da en az 5 kişi varsa "~%60" gibi yüzde de gösterilir, yoksa yalnızca seviye
- "Burayı X keşfetti" 30 gün görünür
- Demo için "demo" işaretli sahte check-in'ler üretilecek (az kullanıcıyla haritayı göstermek için)
- Pilot bölge: Nişantaşı, Caddebostan, Yeditepe Üniversitesi kampüsü ve çevresi. Ana sayfadaki Konum filtresinde şimdilik yalnızca bu semtler (Şişli, Kadıköy, Ataşehir) seçilebilir; diğerleri görünür ama soluk ve seçilemez
- "Boşalınca haber ver" v2'de "Sakin olunca haber ver" olacak
- Arkadaş bulma: kullanıcı adıyla arama, davet bağlantısı / QR (WhatsApp, Instagram hikayesi). Telefon numarası, telefon rehberi ve Instagram arkadaş listesi istenmeyecek
- Arkadaşlar yalnızca birbirinin check-in yaptığı mekanı görür (gizli olmayanları); canlı konum görme yok
- Sonraki sürümler (sosyal): check-in'i arkadaşlarla paylaş (check-in ekranında anahtar; arkadaşların ana ekran akışında görünür, isteyene bildirim gider); arkadaşlar izin verilirse birbirinin check-in'lerini görür; herkese açık liderlik tablosu; mekan yorumları ve geri bildirim, yorumlara diğer kullanıcılar cevap verebilir (yorum sahibi izin verdiyse)
- KVKK: konum yalnızca check-in anında kontrol edilir, saklanmaz; kimin nerede olduğu başkalarına gösterilmez
- Arkadaş akışı (Swarm gibi) olacak, ama ilk sürümde değil
- İşletme kısmı v2'de de olacak: önce müşteri tarafı, sonra işletme düzenlenir
- Check-in'ler herkese görünmeli; v2 baştan sunucuyla çalışır (önce Mac'teki backend, sonra internet)

## Rafa kaldırıldı
v1'in veri toplama planı. v2'de doluluk check-in'lerden geleceği için şimdilik yapılmayacak.
- Wi-Fi cihaz sayımı: işletmelerin Wi-Fi cihazlarından (ör. Cisco Meraki, Ubiquiti) API/webhook ile bağlı cihaz sayısı
- MAC adresleri sunucuda anında hash'lenecek (KVKK/GDPR); sadece sayı tutulacak
- Sahte Wi-Fi verisi gönderen bir simülatör (gerçek veri entegrasyonunu denemek için)
- İki kaynağı birleştirme modeli ("büyük olanı al" ya da ağırlıklı model) — karar verilmedi
- Sahte doluluğa kategoriye göre farklı saat eğrileri (kafe öğleden sonra, bar gece) — daha gerçekçi alternatif önerileri için
- Açılışta Google Maps "Popular Times" verisiyle başlangıç (cold start)

v1'in v2 dışında kalan yapılacakları (gerekince geri alınır):
- Altyapı: Redis (cache, rate limit); WebSocket ile anlık güncelleme (şu an 30 sn yenileme); mağaza / kalıcı kurulum için derleme (EAS Build; iOS için Apple geliştirici hesabı)
- Yayında favoriler sadece giriş yapanlara: `FAVORITES_REQUIRE_LOGIN = true` (mobile/src/lib/favorites.ts)
- Birden fazla şube: bir işletme hesabına birden çok mekan, şubeler arası karşılaştırma
- Personel hesapları: kasiyer / garson için sınırlı yetkili hesap (sadece kupon doğrulama ve damga verme)
- Hata bildirimleri ve iletişim mesajları sunucuya / destek e-postasına gitsin
- İşletme premium aboneliğine (SaaS) "hesap yönetimi": isteyen işletmenin availy hesabını bizim ekibimiz yönetir
- İşletmenin yorumlara yanıt vermesi; uygunsuz yorum bildirme
- Uygulamaya katılmamış işletmeler: "Bu kafeden haberdar olmak istiyorsanız işletmeyi ikna etmemize yardımcı olun" (ör. "İşletmeye haber ver" butonu)
- Ödeme: kampanya için SaaS aboneliği (₺1.899/ay) ya da kampanya başı ₺150; şu an kural uygulanmıyor ("Kampanya Başı" paketinde de sınırsız kampanya)
- Tanıtım (nasıl kullanılır) uygulama ilk yüklendiğinde en başta da çıksın; şimdilik sadece Hakkında'da
- Mekanların gerçek fotoğrafları ve kalıcı logo
- Tanıtım sitesi: uygulama bilgisi, kullanıcı özellikleri, işletmeler için sayfa ve başvuru formu, fiyatlar (SaaS ₺1.899/ay, kampanya başı ₺150, B2C Premium ₺79/ay), işbirlikleri (Getir/Trendyol, kampüs elçileri), iletişim, KVKK metni
- Proje dokümanından: B2C Premium'da gerçek ödeme ve gerçek konuma dayalı reklamlar (ekranı demo olarak var); mikro rezervasyon (masa tutma + ön sipariş, %15 komisyon)
- Not: Dokümanın 8. bölümü Flutter/AWS/Redis diyor; prototip React Native (Expo) + FastAPI + PostGIS
