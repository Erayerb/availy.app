# availy (v2)

İstanbul'daki kafe, restoran, bar, kütüphane, ortak çalışma alanı ve parkların şu an ne kadar dolu
olduğunu gösteren mobil uygulama. Doluluğu mekanda olan kullanıcılar check-in yaparak bildirir
(Swarm / Foursquare benzeri): "Şu an burası nasıl? Sakin / Orta / Kalabalık". Kullanıcı "şu an
nerede yer var?" sorusuna cevap bulur, check-in yaparak puan ve rozet kazanır, ilk check-in'i
yapan mekanı "keşfeder", arkadaşlarının nereye gittiğini ve yorumlarını görür.
İşletmeler (B2B) kendi mekanlarının check-in istatistiklerini görür, yorumlara yanıt verir ve boş
saatlerde yakındaki kullanıcılara kampanya / kupon gönderir.

v2 `v2-checkin` dalında geliştirilir ve `main`'e hiç alınmaz. v1 (sahte doluluklu ilk sürüm) `main`
dalında ve `v1` etiketinde olduğu gibi durur (bkz. en alttaki "v1" bölümü).

## Teknoloji
- Mobil: React Native 0.86 + Expo SDK 57 (TypeScript); telefonda Expo Go ile çalışır, aynı kod web'e de derlenir
  - Harita: telefonda react-native-maps (Apple Haritalar), web'de Leaflet + OpenStreetMap (VenueMap.web.tsx)
  - Tema: açık / koyu (mobile/src/theme.ts: `colors` ve `themed(...)` o anki temayı okur)
  - Telefonda saklanan küçük veriler: AsyncStorage (web'de localStorage)
- Backend: Python FastAPI + psycopg 3 (bağlantı havuzu)
- Veritabanı: PostgreSQL 18 + PostGIS 3.6; şema her açılışta backend/app/sql/schema.sql'den uygulanır (tekrar çalıştırılabilir)
- E-posta: Resend (şifre sıfırlama ve e-posta doğrulama kodları); anahtar yoksa yalnızca sunucu kaydına yazılır
- Testler: backend pytest (`docker compose run --rm backend pytest -q`), mobil node test runner (`npm test`) + `npx tsc --noEmit`
- Yerel geliştirme: Docker Compose (db + backend); `docker compose run` sonrası backend durursa `docker compose up -d backend`

## Ortamlar
- Yerel: backend http://localhost:8000; telefon Mac'in yerel IP'siyle bağlanır (mobile/.env `EXPO_PUBLIC_API_URL`, aynı Wi-Fi), `npx expo start`
- İnternet (deneme ortamı, Mac kapalıyken de çalışır):
  - Backend: Render ücretsiz web servisi `availy-api` (render.yaml, Docker, Frankfurt, `v2-checkin` dalından, her push'ta kendiliğinden yayınlanır): https://availy-api.onrender.com. 15 dk boşta kalınca uyur, ilk istek ~1 dk sürer
  - Veritabanı: Neon ücretsiz PostgreSQL (Frankfurt). Bağlantı adresi gizli: yalnızca Render'daki DATABASE_URL'de, koda ve sohbete yazılmaz
  - Render'daki diğer ayarlar: RESEND_API_KEY (henüz girilmedi), isteğe bağlı MAIL_FROM
- Web: GitHub Pages (.github/workflows/pages.yml, iki dalda da aynı dosya; her çalışmada ikisini birden derler): v1 https://erayerb.github.io/availy.app/, v2 https://erayerb.github.io/availy.app/v2/ (repo değişkeni V2_API_URL = Render adresi)
- Test hesapları (silinmez; şifre backend/app/seed_test_account.py'de): @availy_deneme (bireysel: check-in'ler, yorum, eray'a arkadaşlık isteği) ve @availy_isletme (Alfa Glory Coffee'nin işletmesi). Kurulum: `docker compose run --rm backend python -m app.seed_test_account`

## Veri kaynakları
- Mekanlar: OpenStreetMap (Overpass API; backend/app/import_osm.py, `venues.source = 'osm'`, `osm_id` ile tekrar çalıştırılabilir; OSM çalışma saati varsa o, yoksa türe göre varsayılan). Pilot bölgeler: Nişantaşı, Caddebostan, Yeditepe kampüsü çevresi (282 mekan). backend/app/copy_venues.py mekanları Neon'a kopyalar. ODbL: uygulamada "© OpenStreetMap katkıcıları" yazar
- Kullanıcıların eklediği mekanlar (`source = 'user'`, onay bekler; bkz. Durum > Mekanlar)
- Doluluk: yalnızca kullanıcıların check-in'leri (bkz. "Doluluk modeli"). Sahte doluluk yok
- Semt / mahalle adı: OpenStreetMap Nominatim (mobile/src/lib/reverseGeocode.ts)
- Alternatif mekan kaynakları (kullanılmıyor): Foursquare Open Source Places, Overture Maps Places. Google Places verisini kopyalamak kullanım şartlarına aykırı

## Klasörler
- backend/app/ : FastAPI (her konu bir modül + `*_api.py` uçları); backend/app/sql/schema.sql : şema
- backend/tests/ : pytest; backend/scripts/ : v1 web demo verisini dışa aktarma
- mobile/App.tsx : ekranlar arası gezinme ve sağlayıcılar; mobile/src/{screens,components,context,hooks,lib} ; mobile/tests/
- docker/ : backend.Dockerfile, db/ ; docker-compose.yml : yerel db + backend
- render.yaml : Render servisi; .github/workflows/pages.yml : web yayını
- docs/ : architecture.md (v1), v2-architecture.md (v2 planı)

## Kurallar
- v1 asla silinmez: `main` ve `v1` etiketi olduğu gibi kalır; v2 `main`'e alınmaz (yalnızca Pages iş akışı dosyası iki dalda ortak)
- Commit ve push yalnızca istendiğinde
- Kullanıcı verisi silinmez (gerçek hesaplar eray, availy, isletme ve onların check-in / yorumları; test hesapları availy_deneme, availy_isletme). Kullanılmayan veri silinmeden önce sorulur
- Gizli anahtarlar (.env, Render ayarları) koda ve sohbete yazılmaz
- Bildirimler olay olunca gelir (zamanlı bildirim yok)
- Kod yorumları ve değişken adları İngilizce, açıklamalar ve arayüz Türkçe; her değişikliğe kısa test
- Emin olunmayan paket / sürüm bilgisi varsayılmaz, kontrol edilir
- ⚠️ GEÇİCİ: check-in mesafesi denemeler için 1 km (backend/app/checkins.py `CHECKIN_RADIUS_M`, mobile/src/lib/nearby.ts `CHECKIN_RADIUS_KM`); yayından önce 150 m'ye geri alınacak

## Doluluk modeli
Kod: backend/app/crowd.py (`crowd_from_checkins`, `report_score`, `age_weight`), backend/app/checkins.py (`update_trust`, `load_crowds`).
1. Pencere: yalnızca son 90 dakikanın check-in'leri; her kişinin yalnızca son bildirimi sayılır.
2. Bildirim puanı: Sakin 0.20, Orta 0.55, Kalabalık 0.90. Takip sorusu kaydırır: Kalabalık + Sıra var 0.98, Kalabalık + Sıra yok 0.82, Orta + Oturacak yer yok 0.70, Orta + Oturacak yer var 0.48.
3. Ağırlık = tazelik × güven.
   - Tazelik (`AGE_WEIGHTS`): 0 dk 1.0, 30 dk 0.65, 60 dk 0.35, 90 dk 0.10; arası doğrusal.
   - Güven (users.trust): herkes 1.0'dan başlar, misafir en fazla 0.5. Yeni bildirim, aynı mekana son 30 dakikada bildirimde bulunan en az 2 kişinin ortalamasıyla karşılaştırılır (tazelikten bağımsız, ağırlıksız ortalama): fark ≥ 0.5 (ör. diğerleri Kalabalık derken Sakin) → −0.1 (alt sınır 0.2); fark ≤ 0.2 → +0.02 (üst sınır 1.0, misafirde 0.5); arası değişmez. Kayıt olan misafirin güveni ikiye katlanır (en fazla 1).
   - Örnek: sürekli çelişen biri 5 bildirimde 0.5'e, 8 bildirimde 0.2'ye düşer; geri 1.0'a çıkması için 40 uyumlu bildirim gerekir.
4. Sonuç: ağırlıklı ortalama < 0.40 Sakin, 0.40–0.75 Orta, > 0.75 Kalabalık. En az 5 kişi bildirdiyse "~%60" oranı da gösterilir; tek kişi bildirdiyse soluk renkte ve "1 kişiye göre Kalabalık".
5. "Sıra var" / "Oturacak yer var": aynı ağırlıklarla çoğunluk (eşitlikte gösterilmez).
6. İşletme hesapları check-in yapamaz (kendi mekanını boş gösteremesin).
7. Bilgi yoksa: son 90 dk boşsa "🕘 Dün bu saatlerde …" (dünün aynı saatindeki check-in'lerle aynı hesap); hiç check-in yoksa ✨ Keşfedilmedi.
8. Trend (🔥 Trendler): son 24 saatte check-in yapan farklı kişi sayısı.
9. Hile koruması: mekana yakın olmak (GPS; konum yalnızca o an kontrol edilir, saklanmaz), aynı mekana 2 saatte bir check-in, kayan 60 dakikada en fazla 10 check-in, giriş ya da misafir hesabı zorunlu, güven puanı.

## Durum (v2)
Testler: backend 202, mobil 125 (son ölçüm).

### Bitti
**Hesaplar**
- Sunucuda hesaplar (backend/app/accounts.py): kayıt (kullanıcı adı zorunlu: 3–20, a-z 0-9 . _, büyük/küçük harf fark etmeden tekil), giriş (kullanıcı adı ya da e-posta), çıkış; şifre scrypt, oturum anahtarının yalnızca hash'i saklanır (30 gün); bilinmeyen e-posta ve yanlış şifre aynı mesajı alır
- Misafir hesabı ("Kayıt olmadan devam et": otomatik id, 365 gün, güven 0.5, puanların yarısı); kayıt olunca aynı id kalır, puanlar korunur. İşletme için misafir yok
- Profil ayarları: kullanıcı adı, şifre, e-posta değiştirme (mevcut şifreyle; telefondaki e-postaya bağlı veriler yeni adrese taşınır), hesabı geçici dondurma (tekrar girişte açılır, veri silinmez), hesabı silme (check-in'ler adsız kalır); dondurma ve silmede kullanıcı adını yazarak onay
- Girişte "Beni hatırla" (kapalıysa oturum yalnızca bellekte; açıksa kullanıcı adı da hatırlanır) ve "Şifremi unuttum" (e-postaya 6 haneli kod: 15 dk, 5 deneme, dakikada bir yeni kod; şifre değişince tüm oturumlar kapanır)
- E-posta doğrulama: kayıtta kod gider; Profil ayarları / İşletme Profili'nde kalın "E-posta henüz doğrulanmadı" + Doğrula → e-posta (değiştirilirse şifre sorulur) → kod gönder → kodu yaz; e-posta değişince doğrulama sıfırlanır
- Hesap ayarları (kullanıcı adı, e-posta, şifre, çıkış, dondur, sil): müşteride Profil ayarları'nda, işletmede Daha fazla > Ayarlar'da

**Check-in ve doluluk**
- Mekan sayfasında "Şu an burası nasıl?" Sakin / Orta / Kalabalık → (Kalabalık'ta "Sıra var mı?", Orta'da "Oturacak yer var mı?") → Check-in. Gizli check-in (doluluğa sayılır, ad gösterilmez; Gizlilik'te varsayılan yapılabilir)
- Check-in sonrası buton kapalı kalır, üstünde "Tekrar check-in: 17:47"; sonuç tek satır: "+10 puan · Buraya 3. check-in'in" / "Burayı keşfeden 12. kişisin!" / "✨ Burayı sen keşfettin!"
- Haritada sağ altta "+" → Check-in yap: en yakın mekanlar ve arama; sağ üstte "➕ Mekan ekle"
- Check-in önerisi: açık bir mekanın 250 m yakınında 3 dk kalınca (uygulama açıkken) şerit + telefon bildirimi; son 2 saatte orada check-in yaptıysan sormaz
- Kayıt sonrası kısa tanıtım (müşteri 4, işletme 3 slayt; sağa / sola kaydırılır) ve "İlk check-in'in" (yakındaki en yakın açık mekan)

**Puan, rozet, keşif**
- Puanlar (`points`): check-in 10, mekanın ilk check-in'i +50 (Kâşif), onaylanan mekan eklemesi +50; misafire yarısı
- "✨ Burayı @eray keşfetti" 30 gün; rozet kataloğu (İlk Adım, Kâşif, Büyük Kâşif, Gezgin, Müdavim, Gece Kuşu, Yardımsever) ilerlemeyle
- Sıralama (Sosyal > Sıralama): Bu hafta / Tüm zamanlar × Arkadaşlar / Herkes (hafta pazartesi 00:00'da başlar)

**Sosyal**
- Arkadaşlar: kullanıcı adıyla arama, istek / kabul / reddet / çıkar (onaylı), QR'ım, QR okut, davet bağlantısı (?invite=ad). Telefon numarası, rehber ve Instagram arkadaş listesi istenmez; canlı konum yok
- Akış (GET /v1/feed): arkadaşların son 7 gündeki check-in'leri (keşif + puan), yorumları ve yanıtları, kişi başına ayrı bloklarda; Akış'tan yanıt. Akış boşken "Arkadaş ekle / Mekan keşfet / Check-in yap" kartları
- Kullanıcı profili: puan, check-in, keşif, rozetler, mekanlar (yalnızca kendin ve paylaşan arkadaşların); Arkadaş ekle / Sessize al / Arkadaşlıktan çıkar / Engelle
- 🔔 Bildirimler (GET /v1/notifications, uygulama açıkken dakikada bir): arkadaşlık isteği, kabul, yorumuna yanıt, keşif ödülü; yenileri telefona bildirim olarak da gelir

**Yorumlar**
- 1–5 yıldız + en fazla 280 karakter; her check-in o mekana 2 yorum hakkı verir (check-in yoksa yorum yok); "Başkaları yanıt verebilsin" anahtarı; kendi yorumunu / yanıtını silme
- Şikâyet (Hakaret / Spam / Yanlış bilgi / Diğer): şikâyet edene hemen, 3 şikâyette herkese gizlenir

**Gizlilik ve güvenlik**
- Gizlilik: arkadaşlar check-in'lerimi görsün, herkese açık sıralamada görüneyim, kullanıcı adımla aranabileyim; Engellenenler
- Konum ve izinler sayfası (konum / kamera / bildirim: ne için, izin vermezsen ne olur, durum ve "İzin ver"; web'de tarayıcı engellediyse nereden açılacağı). İşletmede yalnızca kamera ve bildirim ("İzinler")
- Gizlilik politikası ve kullanım koşulları taslağı (mobile/src/lib/legal.ts), kayıt ekranında onay satırı

**Harita ve ana sayfa**
- Ana sayfa: Konum (pilot semtler Ataşehir, Kadıköy, Şişli; diğerleri soluk), Ne arıyorsun (Sosyalleşme, Ortak çalışma, Eğlence, Sessizlik, Yemek, Gece hayatı, Doğa), arama (Türkçe karakterden bağımsız), Önerilen / En yakın / En sakin, Kapalıları gizle
- Harita: renkli noktalar (soluk = tek kişi, gri ? = bilgi yok, mor ✨ = keşfedilmedi), yakınlaşınca mekan adları, mavi konum noktası, "Konumuma git", yana kayan filtre şeridi, Tümü / Ziyaret ettiklerim, 🔥 Trendler
- Mekan sayfası (✓ haritadaki kartta da): kapak fotoğrafı, ✓ Doğrulanmış işletme rozeti, ⏳ Onay bekliyor, keşfeden, yıldız ortalaması, doluluk, saatler, Instagram / Ara düğmeleri, check-in, Haritada gör / Yol tarifi, kampanya, özellikler, yorumlar; "Sakin olunca haber ver" (🔕)
- Favoriler: Kaydedilenler / Ziyaret edilenler (telefonda, hesap başına)
- Görünüm: Cihaz ayarı / Açık / Koyu (koyu harita: telefonda Apple koyu mod, web'de koyulaştırılmış OSM)

**Mekanlar**
- "Mekan ekle" (giriş yapmış bireysel kullanıcı; Check-in yap ekranında sağ üstte; mobile/src/components/NewVenueForm.tsx): ad, tür, Konum seç (📍 şu anki konum ya da 🗺️ haritadan; harita çevredeki mekanları ve mavi noktanı gösterir), seçilen noktadan semt / mahalle / açık adres kendiliğinden dolar (Nominatim, değiştirilebilir), "Adresi doğrula" özeti → "Doğru, gönder". Kullanıcı seçtiği noktaya check-in mesafesinden yakın olmalı. Semt arama kutusuyla seçilir (yazınca altta liste). Yakında (60 m) aynı adlı mekan varsa eklenmez; 25 m içinde başka mekan varsa "haritada üst üste görünürler" uyarısı ve "Aynı mekan değil, yine de ekle"; kişi başı en fazla 3 onay bekleyen mekan. "⏳ Onay bekliyor" görünür, check-in alır; ekleyen dışında 3 farklı kişi en az 3 farklı günde check-in yapınca onaylanır, ekleyen 50 puan alır; 30 günde onaylanmazsa listelerden kalkar (veri silinmez)

**İşletme**
- İşletme hesabı: kayıtta mekan seçer (sunucuda: PUT /v1/me/venue; bir mekana tek işletme hesabı, başkasına bağlı mekanlar listede soluk; GET /v1/venues/taken) ya da listede yoksa aynı formla kendi mekanını ekler (her yerden, onay bekler, hesaba hemen bağlanır); check-in ve yorum yapamaz, aramada ve herkese açık sıralamada görünmez
- Panel (GET /v1/venues/{id}/stats, check-in verisinden): şu an, bugün saat saat, son 7 gün (check-in, kişi, tekrar gelen), son 30 gün hafta günleri, yakındaki benzer mekanlar, yorumlar; ölü saat uyarısı (müşteriler açık mekanı Sakin bildiriyor) + hazır kampanya; keşfedene "🎁 Ödül ver" (mekan başına bir kez, bildirim olarak gider)
- Kendi mekanının yorumlarına "İşletme" etiketiyle yanıt (yanıtlar kapalı olsa da)
- İşletme Profili'nde üstte kalın "E-posta henüz doğrulanmadı" ve "Doğrulanmamış işletme" kartları, yanlarında Doğrula (ikincisi İşletme doğrulama'ya gider)
- İşletme profili = mekan sayfası: sağ üstteki profil ikonu kendi mekan sayfasını "👁 Müşteriler mekanını böyle görüyor" olarak açar; sağ üstte "✏️ Düzenle" → Daha fazla > İşletme Profili. Orada düzenlenenler sunucuda, herkese görünür: kapak fotoğrafı, adres ve konum (açık adres, mahalle, semt; yol tarifi noktası adresten bulunur ya da "Mekandayım: konumum"; en fazla 1 km kaydırılabilir, check-in mesafesi de bu noktaya göre; OSM yeniden içe aktarılınca korunur: `venues.edited_by_business`), Instagram, telefon. ✓ rozeti `venue_profiles.verified` ile (doğrulama henüz yok; elle açılır)
- Daha fazla: İşletme Profili, İşletme doğrulama ("Yakında"), Abonelik (kampanya başı ₺150 / SaaS ₺1.899/ay; ödeme yok), Ayarlar (hesap + mekan bilgileri + ölü saat / otomatik kampanya), Görünüm, İzinler
- Kalıcı işletme test hesabı @availy_isletme

**Kampanya ve kupon** (sunucuda)
- İşletme kampanya gönderir (mesaj, indirim, 1/2/3 saat, 1/2/5 km, kişi sınırı); her telefondaki müşteri yakınındaki aktif kampanyayı görür, "Kuponu al" → AV-XXXX (0/O, 1/I, 8/B yok; kişi başı bir; sınır kilitle korunur), kasada QR ya da elle; kampanya bitince kupon kullanılamaz
- Kampanyalarım: son 7 gün sonuçları, gösterim (kişi başı bir) / kupon / kullanım; bitir, tekrar gönder, bitenleri sil (yalnızca listeden); Rakipler (3 km)
- Zamanlanmış / haftalık kampanyalar işletmenin telefonunda tutulur, zamanı gelince (uygulama açıkken) sunucuya gönderilir

**Yayın ve altyapı**
- Render + Neon + GitHub Pages /v2/ (bkz. Ortamlar); şema Neon'da `CREATE EXTENSION postgis` ile başlar; bağlantı havuzu kopan bağlantıyı yeniler; CORS: localhost:8081, localhost:8765, erayerb.github.io

### Yapılacaklar (v2)
**Yayından önce** (özet: 150 m, push bildirimleri, migration, Sentry, hukukçu kontrolü)
- Check-in mesafesini 1 km'den 150 m'ye geri al
- Push bildirimleri (bkz. Bildirimler)
- Deneme ve gerçek ortam ayrı: ikinci Render servisi + ikinci Neon veritabanı (gerçek ortam `main`'den, kod aynı)
- Planlar: Render Starter (~7 $/ay, uyumaz), Neon ücretli plan (~19 $/ay; 7–30 gün yedek)
- Veritabanı değişiklikleri sürümlü olsun (Alembic ya da numaralı SQL dosyaları)
- Hata takibi: Sentry (backend + uygulama)
- Mağaza sürümü: Expo EAS Build ile App Store / Google Play
- E-posta: Resend hesabı aç, anahtarı Render'da RESEND_API_KEY olarak gir; herkese gönderebilmek için kendi alan adını Resend'de doğrula ve MAIL_FROM'u ona çevir
- Gizlilik politikası ve kullanım koşulları: hukukçu kontrolü, şirket bilgileri, web'de yayın; KVKK: sunucular Frankfurt'ta, yurt dışına aktarım şartları hukukçuya sorulmalı

**Bildirimler** (olay olunca, uygulama kapalıyken de)
- Telefon bildirimi (push): uygulama bildirim adresini sunucuya kaydeder, sunucu olay olunca Expo push ile gönderir: arkadaşlık, yanıt, keşif ödülü, "Sakin olunca haber ver", yakında kampanya; işletmeye ölü saat
- Kısıt: iPhone'da Expo Go ile çalışmaz; EAS Build ve Apple Developer hesabı (yıllık 99 $) gerekir. Android'de Expo Go ile de denenebilir
- Uygulama kapalıyken check-in önerisi: geofencing (expo-location + TaskManager, "Her zaman" konum izni, en fazla ~20 bölge); Konum ve izinler metni o zaman güncellenmeli
- Haftalık sıralama ödülleri: ne verileceği ve nasıl dağıtılacağı

**Güvenlik ve hile**
- Girişte deneme sınırı: aynı hesaba 15 dk'da 5 yanlış şifre → 15 dk bekleme; aynı IP'den 15 dk'da en fazla 20 deneme; doğru girişte sıfırlanır
- İşletme sahibinin bireysel hesabıyla kendi mekanını "Sakin" göstermesi: "aynı telefon kuralı" (bir telefonda işletme hesabı açıldıysa o telefondaki bireysel hesapların o mekana check-in'i sayılmaz) denendi ve kaldırıldı (sahibin kendi denemelerini de engelliyordu); yayına yakın yeniden düşünülecek
- Aynı telefondan açılan birden çok bireysel hesap aynı mekanda tek kişi sayılsın (sahte hesapla doluluk şişirme)
- Yeni hesap ilk günlerinde / ilk check-in'lerinde az sayılsın; aynı mekana sürekli gelen (ör. çalışan) az sayılsın
- Şikâyet incelemesi için yönetici ekranı (şimdilik 3 şikâyette otomatik gizleniyor)
- Verilerimi indir (KVKK): hesabındaki her şey tek JSON dosyası

**İşletme**
- Sadakat (damga kartı, aylık üyelik, müşteri kodu) sunucuya: şimdi telefonda, başka telefondaki müşteri damgasını göremez
- Mekan bilgisi düzenlemeleri (saatler, özellikler, açıklama; İşletme Ayarları) sunucuya: şimdi yalnızca işletmenin telefonunda
- Mekan sahipliği doğrulaması (✓ rozeti): OSM'deki mekan e-postası / telefonu içe aktarılıp oraya kod gönderilebilir (e-posta Resend ile ücretsiz, SMS ücretli servis ister); olmayanlar için belge + yönetici incelemesi. Başka işletmeye bağlı mekanı isteyen için "bu mekan benim" itirazı
- Zamanlanmış ve otomatik kampanyalar sunucuda çalışsın
- "Check-in yapana %10" gibi check-in'e bağlı kampanyalar
- İşletme profiline belki: "Hakkımızda", menü / fiyat aralığı, genelde en sakin saatler

**Mekanlar**
- "Bilgi yanlış mı?": saatler / kapanmış / konum / ad; 3 farklı kişi aynı şeyi bildirirse "kontrol edilecek" (yönetici ekranı)

**availy puanı**
- Harcama: ödül kataloğu (ör. 200 puan = kafede %10 kupon), Premium indirimi, ortak kuponlar (Getir / Trendyol)
- Ek kazanım: yorum yazmak, Sakin saatte gitmek

**Belki (v1'de vardı, sahte veriye dayanıyordu)**
- Tahmini boşalma ("~15:20"), geçmiş haftaların check-in'lerine göre
- "Bölge: Yoğun" satırı, semtteki mekanların check-in ortalamasıyla

### Kullanılmayan kalıntılar (silinmedi; istenirse silinir)
- Veritabanı: `device_accounts` tablosu (kaldırılan aynı telefon kuralından; 3 satır) ve `checkins.counts` sütunu (artık okunmuyor)
- Backend: v1'in sahte doluluğu (`occupancy` alanı, /v1/venues/{id}/hourly, /history, /forecast, app/occupancy.py, demo_data.py, seed.py); stats'taki `week_new` artık gösterilmiyor
- Mobil kod: lib/campaigns.ts'te `createCampaign`, `endCampaign`, `parseCampaigns` yalnızca testlerde; v1'in telefonda mekan ekleme kodu (lib/localVenueStore.ts, localVenues.ts; eski telefonda eklenmiş mekanlar hâlâ okunuyor); telefona kaydedilmiş mekan fotoğrafları (`availy.photos`) sunucuda fotoğraf yoksa yedek
- Silindi: yerel veritabanındaki 43 v1 demo mekanı (Neon'da hiç yoktu; v1 web demosu kendi gömülü verisini kullanır; backend/app/seed.py yalnızca elle çalıştırılırsa yeniden ekler)
- Silindi (uygulama açılınca, mobile/src/lib/cleanup.ts): telefondaki eski kampanyalar, kuponlar, gösterim sayıları, eski ortak favori listesi, v1 değerlendirmeleri; artık gösterilmeyen mekanların sadakat programları, damga kartları ve üyelikleri

---

## v1 (main dalı, `v1` etiketi)
İlk sürüm: doluluk backend'de sahte üretilirdi; hesaplar, kampanyalar, sadakat ve işletme mekanları
yalnızca telefonda (AsyncStorage) tutulurdu. Web demosu (https://erayerb.github.io/availy.app/) backend
olmadan, uygulamaya gömülü demo veriyle çalışır. v2'de olmayan ya da değişen kısımlar:

**v1'de bitenler (v2'de kaldırıldı ya da değişti)**
- Sahte doluluk (app/occupancy.py; aynı algoritma web demosunda), %oran, 30 sn yenileme, "Test için her saat kalabalık"
- Hesaplar telefonda (tuzlu SHA-256), misafir de favorileyebilir
- İşletme paneli sahte doluluktan: anlık doluluk, ölü saat (<%40), bugünkü saatlik grafik, semt ortalaması, haftalık / aylık istatistik (/v1/venues/{id}/history)
- "⏳ Tahmini boşalma: ~15:20" (/v1/venues/{id}/forecast), "Bölge: Yoğun" satırı
- "%70 altına düşünce haber ver" (v2'de "Sakin olunca haber ver")
- Geri bildirim: 1–5 puan + yorum kişi başı bir, telefonda (v2'de sunucuda yorumlar)
- İşletme yeni mekan ekleyebilirdi (yalnızca o telefonda; adres Nominatim ile)
- Kampanya, kupon, sadakat telefonda; kampanya başına gösterim / kupon / kullanım
- 43 demo mekan (backend/app/demo_data.py; web JSON'u backend/scripts/export_demo_venues.py)
- Mimari: docs/architecture.md

**v1 kararları ve notları**
- Kişi sayısı gösterilmez, yalnızca oran; sessizlik mekan türüne göre etiket; bölge yoğunluğu semt bazlı
- Harita kartı callout değil normal view (iOS'ta pin atlaması); kendi çizdiğimiz yuvarlak pinler
- Sahte doluluk tüm mekanlarda aynı saat eğrisini kullanıyordu (kategoriye göre eğri daha gerçekçi olurdu)
- Proje dokümanı ("Tenha Nerede") Flutter / AWS / Redis diyor; prototip React Native (Expo) + FastAPI + PostGIS

**Rafa kaldırıldı (v1'in veri toplama ve diğer planları)**
- Wi-Fi cihaz sayımı (Cisco Meraki, Ubiquiti API / webhook), MAC adresleri anında hash'lenir, yalnızca sayı; sahte Wi-Fi simülatörü; iki kaynağı birleştirme modeli
- Google Maps "Popular Times" ile başlangıç
- Redis (cache, rate limit), WebSocket ile anlık güncelleme
- Yayında favoriler yalnızca giriş yapanlara (`FAVORITES_REQUIRE_LOGIN`)
- Birden fazla şube, personel hesapları (kasiyer / garson)
- Hata bildirimleri ve iletişim mesajları sunucuya / destek e-postasına
- İşletme premium aboneliğine "hesap yönetimi"
- Katılmamış işletmeler için "İşletmeye haber ver"
- Gerçek ödeme (SaaS ₺1.899/ay, kampanya başı ₺150, B2C Premium ₺79/ay), mikro rezervasyon (masa + ön sipariş, %15 komisyon)
- Tanıtım sitesi (özellikler, işletme başvurusu, fiyatlar, işbirlikleri, KVKK)
