# availo (v2)

İstanbul'daki kafe, restoran, bar, kütüphane ve ortak çalışma alanlarının **şu an ne kadar dolu** olduğunu gösteren mobil uygulama. Doluluğu mekandaki kullanıcılar check-in ile bildirir: "Şu an burası nasıl? Sakin / Orta / Kalabalık". Sahte ya da tahmini doluluk yok; her şey gerçek check-in'lerden.

- **Kullanıcı:** "Şu an nerede yer var?" sorusuna cevap bulur; check-in yapıp puan, rozet, seviye kazanır; bir mekanın ilk check-in'ini yapıp orayı "keşfeder"; arkadaşlarının nereye gittiğini görür; puanını kafelerin indirimlerinde harcar.
- **İşletme:** Kendi mekanının check-in istatistiklerini görür, yorumlara yanıt verir, boş saatlerde yakındakilere kampanya ve kupon gönderir, sadakat kartı ve kalıcı ödül kurar.

**Ad:** Availo (eski adı availy). Depo, sunucu ve site adresleri (availy-api, erayerb.github.io/availy.app), telefondaki kayıt anahtarları, QR önekleri ve test hesapları eski adla kalıyor. Logo: kemer ve nokta (components/Logo, scripts/build-logo.py); logo yazısı Tinos.

## Kurallar
- v2 `v2-checkin` dalında geliştirilir, `main`'e hiç alınmaz. `main` ve `v1` etiketi (ilk, sahte doluluklu sürüm) olduğu gibi kalır, silinmez (yalnızca Pages iş akışı dosyası iki dalda ortak)
- Commit ve push yalnızca istendiğinde
- Kullanıcı verisi silinmez: gerçek hesaplar eray, availo, isletme, kafe ve test hesapları availy_deneme, availy_isletme. Kullanılmayan veriyi silmeden önce sorulur
- Gizli anahtarlar (Neon DATABASE_URL, RESEND_API_KEY, HF_TOKEN, .env, Render ayarları) koda ve sohbete yazılmaz
- Bildirimler olay olunca gelir. Yalnızca iki zamanlı istisna var: 4 gün check-in yapmayana bir kez hatırlatma (backend/app/reminders.py) ve favori mekanın kampanyasının son saati
- Kod yorumları ve değişken adları İngilizce; arayüz ve açıklamalar Türkçe. Düğme ve başlıklarda yalnızca ilk kelime büyük ("Giriş yap"). Her değişikliğe kısa test
- Emin olunmayan paket / sürüm bilgisi varsayılmaz, kontrol edilir
- Uygulama yalnızca mobil (iOS / Android) yayınlanır; web derlemesi yalnızca önizleme içindir. Tanıtım sitesi ayrı
- ⚠️ **GEÇİCİ:** check-in mesafesi denemeler için 1 km (backend/app/checkins.py `CHECKIN_RADIUS_M`, mobile/src/lib/nearby.ts `CHECKIN_RADIUS_KM`); yayından önce 150 m'ye geri alınacak

## Teknoloji ve ortamlar
- **Mobil:** React Native 0.88 + Expo SDK 58 (TypeScript), Expo Go ile çalışır. Harita: telefonda react-native-maps (iPhone Apple Haritalar, Android Google Haritalar), web önizlemede Leaflet + OSM (VenueMap.web.tsx). Tema açık / koyu (theme.ts `colors`, `themed(...)`). Telefonda küçük veriler AsyncStorage'da
- **Backend:** FastAPI + psycopg 3; PostgreSQL 18 + PostGIS 3.6. Şema backend/app/sql/schema.sql (her açılışta tekrar çalışır), değişiklikler backend/app/sql/migrations/ (numaralı, açılışta bir kez; son: 037)
- **Yerel:** Docker Compose (db + backend), backend http://localhost:8000. Telefon Mac'in yerel IP'siyle bağlanır (mobile/.env `EXPO_PUBLIC_API_URL`, aynı Wi-Fi); `npx expo start` (mobile/)
- **İnternet (deneme ortamı):** backend Render ücretsiz servis `availy-api` (Docker, Frankfurt, `v2-checkin`'den her push'ta yayınlanır; https://availy-api.onrender.com, 15 dk boşta uyur). Veritabanı Neon ücretsiz (Frankfurt; adres yalnızca Render'daki DATABASE_URL'de). Render'da RESEND_API_KEY var, isteğe bağlı MAIL_FROM, SUPPORT_EMAIL, PHOTON_URL
- **Web:** GitHub Pages (.github/workflows/pages.yml): v2 uygulama https://erayerb.github.io/availy.app/v2/, tanıtım sitesi …/v2/tanitim/
- **Testler:** backend `docker compose run --rm backend pytest -q` (310) ve sonra `docker compose restart backend`; mobil `npm test` (131) + `npx tsc --noEmit`. pytest ara sıra kilitlenirse yeniden çalıştırmak yeter
- **Test hesapları** (silinmez; şifre backend/app/seed_test_account.py'de, sohbete yazılmaz): @availy_deneme (bireysel) ve @availy_isletme (Alfa Glory Coffee'nin işletmesi). Kurulum: `docker compose run --rm backend python -m app.seed_test_account`

### Klasörler ve üretilen dosyalar
- backend/app/ (her konu bir modül + `*_api.py`), backend/tests/, backend/scripts/ (veri içe aktarma)
- mobile/App.tsx (gezinme ve sağlayıcılar), mobile/src/{screens,components,context,hooks,lib}, mobile/tests/
- mobile/public/tanitim/ tanıtım sitesi; docs/hukuk/ yasal taslaklar; docs/social-sign-in.md
- Üretilen dosyalar (elle düzenlenmez, komutla yenilenir):
  - İkonlar: yeni bir ikon adı kullanınca `<iconvenv>/bin/python scripts/build-icons.py` (mobile/; fontTools). Kodda tırnak içinde geçen Tabler adları alınır
  - Lisans listesi: paket ekleyip güncelleyince `node scripts/build-licenses.js` (mobile/) → src/lib/licenses.json
  - Yasal metinler: `python3 mobile/scripts/build-legal.py docs/hukuk/gizlilik-politikasi.md docs/hukuk/kullanim-kosullari.md > mobile/src/lib/legal.ts` ve `python3 mobile/scripts/build-legal-web.py` (tanitim/gizlilik.html, kosullar.html; hukukçu notları dışarıda kalır)
  - Site yazı tipleri ve ikonları: sayfaya yeni `ti ti-…` ikonu eklenince `<iconvenv>/bin/python mobile/scripts/build-site-assets.py`

## Paketler (ücretsiz ve ücretli)
Ödeme altyapısı henüz yok: paketler seçilince açılır ("Prototip"). Sınırları sunucu kontrol eder (backend/app/plans.py, users.plan); ücretli bir şey denenince uygulama Abonelik'e yönlendirir (UpgradeContext).

**Bireysel**
- **Ücretsiz:** harita ve anlık doluluk, filtreler; check-in, puan, seviye, rozet, sıralama; arkadaşlar, akış, yorumlar, listeler, fotoğraflar; kuponlar, sadakat kartları, mekanların puanla alınan ödülleri; "Sakin olunca haber ver" aynı anda 1 mekan; ayda 2 seri kurtarma; reklamlı (reklam ağı henüz yok)
- **availo+ (₺79/ay):** sınırsız "Sakin olunca haber ver" ve favoriler sakinleşince zilsiz haber; aylık özet (en çok gidilen yerler, semtler, arkadaşlarla kıyas); ayda 10 seri kurtarma; profilde kapak fotoğrafı, renkli çerçeve, availo+ rozeti; reklamsız

**İşletme**
- **Ücretsiz:** mekan profili, fotoğraf, saatler; yorumlara yanıt; sadakat damga kartı; kalıcı ödül ("200 puan = %10", kampanya hakkından düşmez); kupon doğrulama; ölü saat bildirimi; aylık "availo ile" kartı; mekan doğrulanınca ayda 3 kampanya
- **Aylık paket (₺599/ay):** sınırsız kampanya; istatistikler (saat saat bugün, son 7 gün, haftanın günleri, geçen ayla kıyas, en sakin saatler); yakındaki benzer mekanların doluluğu; zamanlanmış haftalık ve otomatik ölü saat kampanyaları. Ücretsiz planda bu kartlar örnek sayılarla bulanık ve kilitli görünür ("Aylık pakete dahil"). 15 gün ücretsiz deneme (mekan başına bir kez)
- **"Öne çık" (Sponsorlu):** ₺300/hafta, ₺1.000/ay; şimdilik yönetici açar. Ana sayfa listelerinde önde ve "Sponsorlu" etiketiyle
- **Kurucu mekanlar:** ilk 10 mekana 3 ay ücretsiz Aylık paket, "Kurucu mekan" rozeti, kapı çıkartması (yönetici verir; venue_profiles.founder)

## Doluluk modeli
Kod: backend/app/crowd.py, checkins.py (`update_trust`, `load_crowds`).
1. Son 90 dakikanın check-in'leri (tek kişiyse 60 dk); her kişinin yalnızca son bildirimi
2. Puan: Sakin 0.20, Orta 0.55, Kalabalık 0.90. Takip sorusu kaydırır: Kalabalık + sıra var 0.98 / yok 0.82; Orta + oturacak yer yok 0.70 / var 0.48
3. Ağırlık = tazelik × güven. Tazelik: 0 dk 1.0 → 30 dk 0.65 → 60 dk 0.35 → 90 dk 0.15. Güven (users.trust) 1.0'dan başlar (misafir en fazla 0.5); son 30 dakikada aynı mekana en az 2 kişinin ortalamasıyla çelişen bildirim −0.1 (alt sınır 0.2), uyumlu bildirim +0.02
4. Sonuç: < 0.40 Sakin, 0.40–0.75 Orta, > 0.75 Kalabalık. 5+ kişi bildirdiyse "~%60"; tek kişiyse soluk ve "1 kişiye göre"
5. Bilgi yoksa: "Dün bu saatlerde …" ya da mekanın geçmişinden "Genelde bu saatte sakin (tahmini)"; hiç check-in yoksa ✨ Keşfedilmedi. Güncel bildirim yoksa kartlarda etiket çıkmaz, mekan sayfasında "Şu an bildirim yok"
6. İşletme hesapları check-in yapamaz. Hile koruması: mekana yakın olmak (konum o an kontrol edilir, saklanmaz), aynı mekana 90 dakikada bir, 60 dakikada en fazla 10 check-in, güven puanı
7. Trend: son 24 saatte check-in yapan farklı kişi sayısı

## Özellikler

### Doluluk ve check-in
- Mekan sayfasında "Şu an burası nasıl?" → (Kalabalık'ta "Sıra var mı?", Orta'da "Oturacak yer var mı?") → check-in. Gizli check-in doluluğa sayılır, ad görünmez. Kapalı mekanda check-in yok
- Check-in sonrası kutlama, "Burası nasıl?" (yıldız + kısa yorum), "Arkadaşlarına paylaş" ve "Buradayım, gel!" (arkadaşlara bildirim; 2 saat sonra "…mekanındaydı" olur, 1 gün sonra düşer)
- "Bugünün ilk bilgisini sen ver": o gün mekanın ilk check-in'i çift puan
- Check-in önerisi: açık bir mekanın yakınında birkaç dakika kalınca (uygulama açıkken şerit, arka plandaysa bildirim; saatte en fazla bir)
- "Sakin olunca haber ver": kalabalık mekana zil kur, Sakin bildirilince haber gelir (6 saat sonra kapanır)
- "Daha boş alternatifler", "Şu an normalden daha sakin / kalabalık" (bu saatin olağan seviyesiyle), "Cumartesi genelde 18–20 kalabalık" (son 8 hafta; app/typical.py)

### Harita ve ana sayfa
- **Uygulama haritayla açılır** (işletmede Panel). Harita: renkli noktalar ve sayılı gruplar (lib/clusters.ts), yakınlaşınca adlar, mavi konum, filtre şeridi, Tümü / Gittiklerim, 🔥 Trendler, kalıcı ödülü olan mekanda 🎁, sağ altta Check-in
- **Harita araması:** mekanlar (kendi sunucumuz) ve yer önerileri (sokak, mahalle) yazarken altta listelenir. Yer önerileri sunucumuz üzerinden Photon'dan gelir (bkz. Teknik notlar)
- **Ana sayfa:** "Arkadaşların nerede?" (misafire kayıt kartı), İstanbul / semt seçici ve arama; yana kayan satırlar: "Şu an sakin, yakınında", "Ne arıyorsun?" (açılışta saate göre seçili: hafta içi sabah Ortak çalışma, öğle ve akşam Yemek, akşam Sosyalleşme, gece Gece hayatı; lib/filters.ts `tagForTime`), "Trend olanlar", "Keşfedilmeyi bekleyenler". Altında "Tüm mekanlar": ilk 20 (sponsorlu önce, sonra karışık; konum varsa yakından), "Daha fazla göster". Filtreler: Sırala (Önerilen / En yakın / En sakin), Ne arıyorsun?, Kapalıları gizle
- **Mekan sayfası:** kapak fotoğrafı (yalnızca doğrulanmış işletme yükler), ✓ doğrulanmış, keşfeden, yıldız ortalaması, doluluk, saatler, Instagram / Ara, check-in, Haritada gör / Yol tarifi / Listeye ekle, kampanya, kalıcı ödül, sadakat, özellikler, yorumlar, "Bilgi yanlış mı?", "Şu an burada" fotoğrafları, burada olan arkadaşlar, müdavim
- **Fotoğrafsız mekan kartı (G, 2026-11-27):** kategorinin koyu tonu (açık temada pasteli) ve köşeden taşan, kartın boyunda ince çizgili büyük kategori çizimi (%50 opak). Küçük önizlemelerde simge ortada. Renkler lib/visuals.ts `tile` / `accent` (doluluk renklerinden uzak tutulur), çizim components/VenuePhoto.tsx
- **Kartta "arkadaşın burada":** son bir saatte orada check-in yapan arkadaşların fotoğrafları kartın sağ alt köşesinde (en fazla 2 + "+N"). Dokununca pencere: kimler, ne zaman check-in yaptı, dokununca profili; altta "Yanına git" (yol tarifi). Tek arkadaş listesinden (context/FriendsHereContext.tsx, 2 dakikada bir yenilenir; lib/friends.ts `friendsHereByVenue`), components/FriendsHereBadge.tsx. "Arkadaşların nerede?" satırında gösterilmez (orada zaten kartın altında yazıyor)
- **Yönetici "Satış özeti"** mekan sayfasında kapalı gelir, dokununca açılır (components/SalesPitch.tsx)

### Puan, rozet, seviye
- **Puan kazanma:** check-in 10 (günün ilki 20), keşif +50, rozet (zorluğa göre 5–50), seviye +30, fotoğraf 5, birlikte check-in 10, davet +50 (iki tarafa, davet eden 30 günde en fazla 5), eklenen mekan onaylanınca +50, damga 5, kullanılan kupon 10, haftalık seri +10, İlk adımlar görevleri +10 (hepsi "Hızlı başlangıç" rozeti). Misafire yarısı. Puan kasmaya karşı: başka mekandan sonraki 30 dk ve günde 8'den sonrası puansız
- **Puan harcama:** mekanların kalıcı ödülleri ve puanla açılan özel kuponlar (point_spends). Seviye ve sıralama kazanılan toplamla hesaplanır, harcama etkilemez. Puanların sayfası: harcanabilir puan, puanla alınabilecekler, geçmiş (rozet ve seviye adıyla: "Rozet: Gece kuşu", "Seviye atladın: Mahalleli"; points.task)
- **Seviyeler** (app/levels.py): Yeni gelen → Kâşif (100 puan ya da 1 keşif; hoş geldin hediyesi: bir ödülü puansız alma) → Mahalleli (500 puan, 3 mekanda 3+ check-in; 1 hafta availo+) → Semt elçisi (2.000 puan, bir semtte 10 mekan, bütün rozetler; 1 ay availo+, altın çerçeve)
- **Rozetler** (10 tane: Tam profil, İlk adım, Kâşif, Büyük kâşif, Gezgin, Müdavim, Gece kuşu, Yardımsever, Haftanın 1.si, Hızlı başlangıç): altın madalya, çizgi ikonlar (lib/badgeIcons.ts; sunucunun gönderdiği emoji kullanılmıyor). "Yeni rozet!" kutlaması. Misafir rozetleri kayıt olunca gelir
- **Günlük seri** ve seri kurtarma (arkadaşın kurtarır; ücretsiz 30 günde 2, availo+ 10). **Müdavim:** mekanda son 30 günde en çok check-in yapan (yeri kaptırana bildirim). **Haftanın 1.si:** geçen haftanın genel birincisi
- **Sıralama** (Sosyal > Sıralama): Bu hafta / Tüm zamanlar × Arkadaşlar / Herkes / Gruplar; ilk üç podyumda (boş basamak silik)

### Sosyal
- **Arkadaşlar:** kullanıcı adıyla arama, istek / kabul, QR, davet bağlantısı (?invite=ad; kayıt olan otomatik arkadaş olur). Canlı konum ve rehber yok
- **Sosyal sekmeleri:** Akış (arkadaşların check-in, yorum, fotoğrafları), Paylaşımlarım (kendininkiler; yakın zamanda yoksa son gönderiler), Sıralama. Check-in'lere beğeni ve yorum. Akış boşken önerilen kişiler ve yeni keşfedilen mekanlar
- **Önerilen kişiler** (Akış boşken; profil fotoğraflı): önce ortak arkadaşı olanlar, sonra aynı mekanlara gidenler (iki taraf da izin verdiyse), sonra bu hafta en çok puan alanlar; en fazla 5 (app/suggestions.py)
- **Gruplar:** kendi haftalık / tüm zamanlar sıralaması olan arkadaş grupları (en fazla 50 üye)
- **Listeler:** Favoriler > Listeler; gizli / arkadaşlar / bağlantıyla herkes; başkasının listesini kaydetme; "şu an N tanesi sakin"
- **Favoriler sekmeleri:** Favoriler, Listeler, Gittiklerim
- **Kullanıcı profili:** puan, check-in, keşif, rozetler, gittiği mekanlar, seviye; arkadaş ekle / sessize al / engelle
- **Yorumlar:** 1–5 yıldız + 280 karakter (check-in yapan yazar, check-in başına 2); yanıtlar; "Şikâyet et" üç nokta menüsünde (3 şikâyette gizlenir)

### Kampanya, kupon, sadakat
- **Kampanya** (işletme): mesaj, indirim, 1/2/3 saat, 1/2/5 km, kişi sınırı; yakındaki müşteri görür, "Kuponu al" → AV-XXXX, kasada QR ya da kodla. "Yalnızca check-in yapanlara" seçeneği. Puanla açılan özel kupon (50–400 puan)
- **Kampanya bildirimi:** favori mekanın ya da son 90 günde gidilen mekanın kampanyası başlayınca ve son saatinde (Bildirim ayarlarından kapanır; ticari ileti onayı hukukçuya soruldu)
- **Kalıcı ödül:** "200 puan = %10", mekan sayfasında hep durur, kişi başı haftada bir
- **Sadakat:** damga kartı (ör. 5 damga = 1 kahve); müşteri katılır, kasada sadakat QR'ı (M-123456) okutulur
- **Müşteri tarafı:** Kampanyalar sayfası (Kampanyalar / Kuponlarım / Sadakat); yakında kampanya yoksa "Puanla alabileceklerin" (kalıcı ödüller ve özel kuponlar, dokununca mekan sayfası). Üstteki bilet simgesi doğrudan Kampanyalar'ı açar, yakında kampanya ya da kullanılabilir kupon / ödül varsa kırmızı nokta

### İşletme
- **Sekmeler:** Panel, Müşteriler, Harita, Kampanyalar, Daha fazla
- **Panel:** "availo ile" ay kartı ve görsel aylık özet, profil tamamlama, şu an, Öne çık kartı, bugün / son 7 gün / haftanın günleri, en sakin saatler (tek dokunuşla haftalık kampanya), yakındaki benzer mekanlar, "Şimdi yap" (ölü saatte hazır kampanya)
- **Müşteriler:** son 30 gün farklı kişi ve müdavimler (adsız), sadakat özeti, yanıt bekleyen yorumlar
- **Kampanyalar:** Kampanyalar (yeni, haftalık, aktif, geçmiş) · Kuponlar (kupon doğrulama) · Ödüller (kalıcı ödül ve damga kartı)
- **Otomasyon sunucuda** (app/automation.py; işletmenin uygulaması kapalıyken de): ölü saat bildirimi ve otomatik kampanya, zamanlanmış kampanyalar
- **İşletme profili:** kapak fotoğrafı, ad, saatler, özellikler, adres ve konum, Instagram, telefon; Kapı QR'ı (yazdırılır). Mekan seçimi kayıtta (bir mekana tek işletme hesabı) ya da yeni mekan ekleyerek

### Mekanlar
- **Kaynaklar:** OpenStreetMap (app/import_osm.py; pilot: Nişantaşı, Caddebostan, Kayışdağı, Etiler, Beşiktaş, Bilgi santral, Bakırköy). Arka planda ~91 bin "aday" yer (Overture + Foursquare OS Places; place_candidates), haritada görünmez, aramada "Haritada yok mu?" ve "Mekan ekle"de "Bu mu?" ile eklenir. Yenileme ayda bir: backend/scripts/fetch_overture_places.py + fetch_foursquare_places.py → import_place_candidates.py
- **Mekan ekle** (kayıtlı bireysel): ad, tür, konum (haritadan ya da şu anki), adres kendiliğinden dolar. Kişi başı en fazla 3 onay bekleyen. Ekleyen dışında 3 kişi 3 farklı günde check-in yapınca onaylanır; 30 günde onaylanmazsa listelerden kalkar
- **"İşletmeye haber ver":** işletmesi olmayan mekanda; belli eşiklerde mekana sayıyı bildiren e-posta
- **"Bilgi yanlış mı?":** kapanmış / saatler / konum / ad; 3 kişi bildirince yönetici listesine düşer. Uygunsuz mekan adı kontrolü (app/name_check.py)

### Hesap, gizlilik, güvenlik
- **Hesap:** kullanıcı adı (3–20, a-z 0-9 . _) + e-posta + şifre; Google / Apple ile giriş kodu hazır (kimlikler girilince görünür). Misafir hesap ("Kayıt olmadan devam et"; güven 0.5, puanın yarısı; kayıt olunca aynı hesap devam eder)
- **Şifre:** yeni şifrelerde en az 8 karakter, büyük ve küçük harf, rakam, noktalama (kayıtta canlı kontrol listesi). 3 yanlışta hesap kilitlenir, "Şifremi unuttum" (e-posta kodu) ile açılır; bir IP'den 15 dakikada 20 yanlış girişte o IP 15 dk bekletilir
- **Oturum kullandıkça uzar:** kayıtlı hesap 90 gün, misafir 365 gün hiç açılmazsa kapanır
- **Profil ayarları:** kullanıcı adı, e-posta (doğrulama kodu), şifre, profil fotoğrafı, Verilerimi indir (JSON), hesabı dondur, hesabı sil (check-in'ler adsız kalır)
- **Gizlilik ayarları:** check-in'lerimi kim görsün, herkese açık sıralama, aranabilirlik, önerilme, müdavimlik görünürlüğü, istatistik görünürlüğü, engellenenler
- **Konum ve izinler:** her iznin ne için olduğu, izin vermezsen ne olacağı; konum saklanmaz
- **Kayıt ekranı:** "Kullanım koşulları" ve "Gizlilik politikası" bağlantıları sitedeki sayfaları uygulama içinde açar
- **Hakkında > Lisanslar ve veri kaynakları:** OSM, Overture, Foursquare atıfları ve lisansları, harita / adres hizmetleri, yazı tipleri ve ikonlar, her açık kaynak paket (components/Licenses.tsx)

### Bildirimler
- 🔔 listesi (silinene kadar kalır, "Temizle"): arkadaşlık, yanıt, beğeni ve yorum, arkadaşın check-in'i ve yorumu, birlikte check-in, sadakat, damga kartı doldu, mekan onayı, davet, müdavimlik, kampanya, favori sakinleşti (availo+), 4 gün hatırlatması; işletmeye yorum, kupon, kampanya sonucu, ölü saat, "Bilgi yanlış mı?"
- Telefon bildirimi (push) kodu hazır (backend/app/push.py, Expo push); gerçek uygulama sürümü gerektirir. Metinler iki yerde: push.py `text` ve mobile/src/lib/social.ts `notificationText` (birlikte değişmeli)
- Uygulama 6 saatten uzun aradan sonra açılınca "Sen yokken" kartı

### Arayüz
- Alt şerit yüzen, buzlu (expo-blur); sayfalar arkada açık kalır, kaydırma yeri korunur (components/ScreenStack, PageContext); sol kenardan çekince geri
- Yazı tipleri: metin Figtree, 20 pt üstü başlıklar Tinos (components/Text). İkonlar: çerçeve kendi çizimimiz (TabIcon), içerik Tabler (components/Icon, InlineIcon)
- Tek seferlik ipucu baloncukları (components/Tip, lib/tips.ts); tanıtım ve kayıt sonrası pencereler açıkken çıkmaz
- Görünüm: Cihaz ayarı / Açık / Koyu ve renk körü dostu renkler
- Ana sayfa boşlukları her bölümde aynı: başlık → içerik 12, bölüm → bölüm 24; başlık satırları başlık yüksekliğinde (22), yanındaki düğmeler (Konum, arama, Filtreler) taşar. Bölüm başlıkları 17 punto kalın; kartta mekan adı 14 punto
- Kayıt sonrası kısa tanıtım (müşteri 4, işletme 3 slayt), davet ekranı ve "İlk check-in'in"
- Abonelik sayfası: availo+ altın vurgulu kartla üstte (ikonlu faydalar), ücretsiz plan altında sade

### Tanıtım sitesi
- mobile/public/tanitim (yayında …/v2/tanitim/): index.html (kullanıcılar), isletme.html (işletmeler, paketler, kurucu program, başvuru), gizlilik.html, kosullar.html (taslak), hesap-silme.html (Google Play hesap silme sayfası)
- Bekleme listesi formları (zorunlu açık rıza kutusu; POST /v1/waitlist; Yönetici > Bekleme listesi)
- Yazı tipleri ve ikonlar sitenin kendi klasöründe (tanitim/assets); Google Fonts / jsDelivr'e bağlanmaz. Çerez, analiz, reklam aracı yok (çerez bannerı gerekmez)
- Mağaza linkleri gelince index.html'deki `STORES` doldurulur

### Yönetici
- users.is_admin (elle verilir): Daha fazla > Yönetici: şikâyetler (kaldır / reddet), onay bekleyen ve kontrol edilecek mekanlar, bekleme listesi, kurucu mekan ve Öne çık verme, mekan sayfasında "Satış özeti"

## Teknik notlar
- **Yer araması (Photon):** GET /v1/places (backend/app/places_api.py) → komoot'un ücretsiz Photon'u. Sunucu 1 gün önbellekte tutar, durak / peron ve İstanbul dışını atar, IP başına dakikada 40 istek; Photon meşgulse boş liste döner ve Render loguna "photon failed" yazar. Kapasite tahmini: günde birkaç yüz aktif kullanıcıya kadar sorun yok, ~1.000 ya da lansman anları riskli. Yetmezse (kolaydan zora): önbelleği büyüt (CACHE_SIZE / CACHE_SECONDS); kendi Photon sunucumuz (Hetzner ~5–10 €/ay, Türkiye dökümü, Render'da `PHOTON_URL`); Geoapify (places_api.py'de sağlayıcı değişir). Uygulama hep /v1/places'i çağırır, değişiklik sunucuda kalır
- **Adres (pin → adres, adresten konum):** Nominatim, yalnızca kullanıcı nokta seçince / düğmeye basınca (lib/reverseGeocode.ts)
- **Web önizleme haritası** tile.openstreetmap.org kullanıyor: yalnızca önizleme için; web gerçek kullanıcıya açılırsa başka tile sağlayıcı gerekir
- **Android harita anahtarı:** mağaza sürümünde gerekli (Expo Go kendi anahtarını kullanır). Google Cloud'da "Maps SDK for Android", paket adı ve imzaya kısıtlı anahtar, EAS'ta `GOOGLE_MAPS_ANDROID_API_KEY` (mobile/app.config.js okur). Telefon haritası ücretsiz; özel map ID kullanılmamalı
- **Lisans yükümlülükleri:** OSM atfı görünür kalmalı. Overture (CDLA) lisans metni ve Foursquare (Apache 2.0) telif satırı + değişiklik notu Hakkında'da (scripts/build-licenses.js `FOURSQUARE`; aday yerler yenilenince nottaki tarih güncellenmeli). Google Places verisi kopyalanmaz
- **Puan geçmişi adları:** points.task "badge:…" / "level:…" (migration 037 eskileri doldurdu)
- **availo+ bilgisi** yalnızca sunucudaki plandan gelir (users.plan; App.tsx telefondaki ayarı ona eşitler). Hesap ayarlarının sunucu yedeği (SettingsSync) `premium`'u taşımaz; taşıdığı dönemde eski yedek seviye hediyesi availo+'yı telefonda kapatıyordu
- **Deneme mekanları** (eray'ın elle eklediği kafe3, ery, kafe34, dondurma evim, sevencan kafe, kafe2, orsp cafe) migration 038 / 039 ile kapatıldı (kayıtlar ve check-in'ler duruyor). Aday listesinden eklenen gerçek mekanlar (Poco, Soft Dondurma Tozu; source 'overture') kaldı. "Yeni keşfedilen mekanlar" kapalı ve gizli mekanları göstermez
- **Rehberden bul** kaldırıldı (2026-11-26): kod git geçmişinde; users.phone_hash boş, config.py'de phone_pepper Render ayarı geçerli kalsın diye duruyor. Geri gelirse açık rıza ekranı, gizlilik maddesi ve PHONE_PEPPER gerekir

## Yasal durum
- **Taslaklar** (docs/hukuk/): gizlilik-politikasi.md, kullanim-kosullari.md, acik-riza-ve-onay-metinleri.md (ticari ileti, bekleme listesi, kayıt beyanı, reklam ağı rızası), hukukcu-icin-kontrol-listesi.md (12 soru, ilk dördü öncelikli), availo-yasal-metinler-taslak.docx. Paylaşılan sayfa: https://claude.ai/artifact/VoGRTD4HjEmUduG9AtUu1V (scratchpad'deki build_docx.js / build_page.py ile üretilir)
- **Hukukçu bekleniyor:** ticari ileti onayı (kampanya bildirimleri şu an varsayılan açık; "ticari ileti" denirse varsayılan kapalı + İYS), yurt dışı aktarım, yaş sınırı (kayıtta yaş beyanı gerekebilir), kullanıcı içeriği ve 5651, puanlar, sınırlayıcı hükümler, abonelik, VERBİS ve belgeler, küçük sayılarda kişi tanınabilirliği, reklam ve yorumlar (reklam ağı rızası dahil), çekiliş, marka. Cevaplar gelince şirket bilgileri doldurulup metinler yayınlanır
- **Reklam:** kendi reklamımız ("Sponsorlu") izin istemez, etiket her yerde kalmalı (tüm listeler VenueTile kullanıyor). Reklam ağı (AdMob; banner ve kapatılabilir tam ekran, video yok) henüz yok; Abonelik'te ücretsiz "Reklamlı", availo+ "Reklamsız" yazıyor

## Yapılacaklar

### Yayından önce
- Check-in mesafesini 1 km'den 150 m'ye geri al
- İşletme doğrulama: doğrulanmamış mekan kampanya gönderemiyor ve kapak yükleyemiyor ama ekran hâlâ "Yakında". Ya doğrulamayı aç (e-posta kodu / SMS / belge + yönetici onayı) ya da şimdilik elle doğrula (isletme, kafe, sawa) ve yazıyı düzelt
- Push bildirimleri ve mağaza sürümü: Expo EAS Build (`eas init`, `eas build`), iPhone için Apple Developer, Android için Firebase (FCM)
- Resend için alan adı (ör. availy.app) ve DNS doğrulaması; olmadan "Şifremi unuttum" e-postası yalnızca hesap sahibine gider (kilitlenen hesaplar açılamaz)
- Deneme ve gerçek ortam ayrı: ikinci Render servisi + ikinci Neon veritabanı (gerçek ortam `main`'den değil, ayrı bir yayın dalından düşünülmeli)
- Ücretli planlar: Render Starter (~7 $/ay, uyumaz), Neon ücretli (~19 $/ay, yedek)
- Hata takibi: Sentry (backend + uygulama)
- Android harita anahtarı (bkz. Teknik notlar)
- Hesap güvenliği: Render, Neon, Resend, GitHub, Expo, Apple, Google hesaplarını projeye ait bir adrese taşı (okul e-postası mezuniyette kapanabilir), her birinde iki adımlı doğrulama ve yedek kodlar, mümkünse ikinci yönetici. Ele geçirilirse anahtarlar ve şifreler değiştirilir
- Mağaza formları: App Store "App Privacy" ve Google Play "Data safety" (gizlilik metniyle aynı), yaş derecelendirme (büyük olasılıkla 12+ / Teen), "reklam içerir"; gizlilik politikası adresi tanitim/gizlilik.html
- Apple ile giriş ve Google ile giriş birlikte açılmalı (App Store 4.8; kod hazır, kimlikler girilecek)
- Misafir hesaplar için saklama süresi ve otomatik silme (kodda yok)
- Kapı QR'ı şimdilik GitHub Pages adresine gidiyor: alan adı alınmadan çok basılmamalı

### Ödeme
- availo+: App Store / Google Play aboneliği, RevenueCat ile; sunucu webhook'la users.plan'ı günceller, prototip geçiş kalkar
- İşletme (Aylık paket, Öne çık): web sitesinden kartla (iyzico / PayTR / Param), webhook paketi açar. Uygulamadan siteye satın alma linki mağaza kurallarına göre iOS'ta kapatılabilir (`SHOW_BUSINESS_PURCHASE_LINK`)
- İkisi için: şirket (şahıs şirketi), vergi levhası, e-arşiv / e-fatura, mesafeli satış sözleşmesi, ön bilgilendirme formu

### Reklam ağı (hukukçu cevabından sonra)
- AdMob hesabı, sitede app-ads.txt (alan adı gerekir)
- iPhone ATT izni ve `NSUserTrackingUsageDescription`; izin yoksa kişiselleştirilmemiş reklam
- Onay ekranı (hukukçunun metniyle) ve Gizlilik ayarlarında "Kişiselleştirilmiş reklam" anahtarı; 18 yaş altına kişiselleştirilmiş reklam yok
- Pop-up kuralları: uygulama açılırken ya da check-in, kupon, ödeme sırasında yok; kapatma düğmesi hemen görünür; oturumda en fazla bir kez; banner haritayı ve tab çubuğunu kapatmaz. availo+'ya reklam yok
- Gizlilik politikasına reklam sağlayıcıları ve yurt dışı aktarım, mağaza formlarına reklam verileri

### Şirket ve kayıtlar
- Şirket kuruluşu, KEP adresi, VERBİS gerekip gerekmediği, yurt dışı aktarım sözleşmeleri, hizmet sağlayıcılarla veri işleme sözleşmeleri (Render, Neon, Resend, Expo), saklama ve imha politikası, veri ihlali süreci
- Marka: "availo" adı ve logosu için TÜRKPATENT araması ve tescil
- Giderler: Apple Developer 99 $/yıl, Google Play 25 $ (bir kez), Render ve Neon ücretli planlar, alan adı; Expo push ve telefon haritaları ücretsiz; lisans parası ödenecek kütüphane yok

### Arayüz (karar bekleyen)
- Erişilebilirlik (yayından önce): bütün basılabilir öğelere ekran okuyucu rolü ve kısa adı ("Alfa Glory Coffee, kafe, Sakin"), çiplerin seçili durumu, en az 44 px dokunma alanı, büyük yazı ayarında taşma kontrolü. Üstteki simge düğmeleri yapıldı

### Sonra yapılacak özellikler
- **Arkadaşların buraya gitti:** mekan sayfasında üst üste 2–3 profil fotoğrafı ve "@eray ve @ayse son 30 günde buraya gitti"
- **Sürpriz paket** (Too Good To Go benzeri): gün sonu indirimli paket, adetli ayırma, kodla teslim; kampanya / kupon altyapısıyla
- **Yakındaki kampanya bildirimi** (konuma göre, isteğe bağlı): son konum ~1 km'ye yuvarlanıp 24 saat tutulur; gizlilik metni ve ayrı izin gerekir
- **Uygulama kapalıyken check-in önerisi:** geofencing ("Her zaman" konum izni); izin metinleri güncellenir
- **Toplu olay bildirimi:** "Moda'da 3 kafe şu an sakinleşti"
- **Ana ekran widget'ı:** favori mekanın anlık doluluğu
- **Instagram / TikTok paylaşımından availo'ya** ve kapı QR'ının doğrudan uygulamayı açması (universal link; alan adı gerekir)
- **Puan:** availo+ indirimi puanla (ör. 1.000 puan = bir ay %50), haftalık çekiliş (izin gerekir, hukukçuya soruldu), yorum ve sakin saatte gitme için ek puan. Puan nakde çevrilemez ve devredilemez kalmalı
- **availo+'ya teşvik:** sınıra takılınca yerinde gösterim, kapatılabilir küçük kart, 7 gün deneme, seri ödülü
- **İşletme:** kendi doluluğunu bildirme ("işletme bildirdi", Aylık paket), birden fazla şube, çalışan hesapları (kod git geçmişinde: app/staff.py, migration 012), "Hakkımızda" / menü / fiyat aralığı, geçen haftayla karşılaştırma, etkinlik duyurusu, hazır yorum yanıtları
- **Hile:** aynı telefondan açılan birden çok hesap aynı mekanda tek kişi sayılsın; işletme sahibinin bireysel hesapla kendi mekanını "Sakin" göstermesine karşı önlem
- **Check-in sonrası tek soru** (priz, Wi-Fi, sessizlik) ile mekan özelliklerini kullanıcıların doldurması
- **Öneri şeridinden tek dokunuşla check-in** ve "Geri al"

### Tanıtım ve büyüme
- Instagram / TikTok serileri: "Kadıköy'de şu an sakin 3 yer", "Çalışmaya uygun" listeleri, kurucu kafe tanıtımları, haftanın kâşifi
- Tek bölgede yoğun başlangıç; ekip ve elçi kullanıcılar ilk haftalarda düzenli bildirim
- Ölçüm: bekleme listesine yazılan ve check-in yapan kişi sayısı
- İsim kesinleşince alan adı ve sitenin kök adrese taşınması

### Belki
- Mekanların aylık üyelik programı (tablo ve alanlar duruyor, sunucu kabul etmiyor), kuponun parayla satılması
- Tahmini boşalma saati ve "Bölge: Yoğun" satırı (geçmiş check-in'lerle)
