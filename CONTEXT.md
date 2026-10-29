# availy (v2)

İstanbul'daki kafe, restoran, bar, kütüphane ve ortak çalışma alanlarının şu an ne kadar dolu
olduğunu gösteren mobil uygulama. Doluluğu mekanda olan kullanıcılar check-in yaparak bildirir
(Swarm / Foursquare benzeri): "Şu an burası nasıl? Sakin / Orta / Kalabalık". Kullanıcı "şu an
nerede yer var?" sorusuna cevap bulur, check-in yaparak puan ve rozet kazanır, ilk check-in'i
yapan mekanı "keşfeder", arkadaşlarının nereye gittiğini ve yorumlarını görür.
İşletmeler (B2B) kendi mekanlarının check-in istatistiklerini görür, yorumlara yanıt verir ve boş
saatlerde yakındaki kullanıcılara kampanya / kupon gönderir.

v2 `v2-checkin` dalında geliştirilir ve `main`'e hiç alınmaz. v1 (sahte doluluklu ilk sürüm) `main`
dalında ve `v1` etiketinde olduğu gibi durur (bkz. en alttaki "v1" bölümü).

## Teknoloji
- Mobil: React Native 0.88 + Expo SDK 58 (TypeScript); telefonda Expo Go ile çalışır, aynı kod web'e de derlenir
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
5. "Sıra var mı?" / "Oturacak yer var mı?" cevapları yalnızca puanı kaydırır; uygulamada ayrıca gösterilmez (sunucu `crowd.queue` / `crowd.seats` olarak yine hesaplıyor).
6. İşletme hesapları check-in yapamaz (kendi mekanını boş gösteremesin).
7. Bilgi yoksa: son 90 dk boşsa "🕘 Dün bu saatlerde …" (dünün aynı saatindeki check-in'lerle aynı hesap); hiç check-in yoksa ✨ Keşfedilmedi.
8. Trend (🔥 Trendler): son 24 saatte check-in yapan farklı kişi sayısı.
9. Hile koruması: mekana yakın olmak (GPS; konum yalnızca o an kontrol edilir, saklanmaz), aynı mekana 90 dakikada bir check-in, kayan 60 dakikada en fazla 10 check-in, giriş ya da misafir hesabı zorunlu, güven puanı.

## Durum (v2)
Testler: backend 217, mobil 124 (son ölçüm).

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
- Kapalı mekanda check-in yok: kutuda "🔒 Şu an kapalı" ve kapalı "Kapalı · 08:00'de açılır" düğmesi (sunucu da reddeder)
- Check-in sonrası "💬 Burası nasıl?": yıldız + birkaç kelime = mekan yorumu (reviews.checkin_id ile check-in'e bağlı); mekan sayfasında yorum, Akış'ta check-in'in altında görünür (ayrı yorum satırı çıkmaz), "Arkadaşlarına paylaş" metnine de eklenir; Düzenle (PATCH /v1/reviews/{id}) / Sil. Eski check-in notları (checkins.note) yalnızca gösterilir
- 🔔 Bildirimler silinene kadar kalır (kabul edilen istek "artık arkadaşsınız", katılınan sadakat "Katıldın" olarak): her satırda 🗑 (notification_dismissals), üstte "Temizle" (users.notifications_cleared_at)
- "Sakin olunca haber ver": yalnızca zil açıldıktan sonraki check-in'ler Sakin derse haber verir; 6 saat sonra kendiliğinden kapanır
- Veritabanı değişiklikleri: backend/app/sql/migrations/ (numaralı dosyalar, açılışta bir kez; schema_migrations). schema.sql temel şema
- İşletme otomasyonu sunucuda: mekan bilgileri (ad, saatler, amaçlar, özellikler, açıklama; PUT /v1/venues/{id}/details), ölü saat bildirimi ve otomatik kampanya (her check-in'den sonra, açık mekanda 2+ kişi Sakin: işletmenin 🔔'üne, 2 saatte bir; otomatik kampanya 3 saatte bir), zamanlanmış kampanyalar (kampanya listesi istenince ya da check-in olunca zamanı gelen başlar; günde bir). İşletmenin uygulaması kapalı olsa da çalışır (backend/app/automation.py)
- Kayıttan sonra: tanıtım → "Arkadaşlarını davet et" (bağlantı / rehber) → ilk check-in
- Görünüm: her düğmede basma efekti (components/Pressable), ikonlar Ionicons (@expo/vector-icons; mekan görseli, favori, haber ver, paylaş, liste, geri, konum, bildirimler); profil fotoğrafı (Profil ayarları; PUT /v1/me/photo, GET /v1/users/{ad}/photo)
- Yanlış şifre: 2. yanlışta uyarı, 3. yanlışta şifreyle giriş kilitlenir; "Şifremi unuttum" (e-posta kodu) ile yeni şifre belirleyince açılır (users.failed_logins / password_locked)
- Verilerimi indir (KVKK): Profil ayarları'nda; sunucudaki her şey tek JSON dosyası (GET /v1/me/export; şifre, oturum, telefon özeti yok)
- 📋 Listeler: Favoriler > Listelerim (istediğin kadar liste), listenin içinde "＋ Mekan ekle" araması ve mekan sayfasındaki liste simgesi; listede mekanlar satır olarak, sahibi "Çıkar" ile çıkarır; liste gizli / arkadaşlar (profilde görünür) / bağlantıyla herkes (?list=KOD); başkasının listesi "Listeyi kaydet" ile kopyalanır; listede "şu an N tanesi sakin" (backend/app/lists.py)
- 🔥 Haftalık seri: üst üste kaç hafta (Pazartesi–Pazar, İstanbul saati) en az bir check-in; bu hafta henüz yoksa seri hafta bitene kadar sürer. Check-in kutlamasında (2+ hafta) ve profilde (backend/app/streaks.py)
- 👑 Müdavim: mekan sayfasında son 30 günde en çok (en az 2) gizli olmayan check-in yapan; arkadaşlar her zaman, diğerleri yalnızca "Müdavimi olduğum mekanlarda herkes görsün" (Gizlilik, users.regular_public) açıksa (GET /v1/venues/{id}/regular)
- "Daha boş alternatifler": önce güncel check-in'lere göre daha boş benzer mekanlar, sonra yakındaki açık benzer mekanlardan bilgisi olmayanlar ("şu an bilgi yok")
- Haritada gruplama: yakın noktalar sayılı tek daire (renk: açık / güncel noktaların çoğunluğu; hiç gri olmaz, yalnız kapalı / eski bilgili gruplar mor), dokununca en fazla 2 seviye yakınlaşır; 16. yakınlaştırmadan sonra grup yok (mobile/src/lib/clusters.ts, ek kütüphane yok)
- "✨ Şu an normalden daha sakin (bu saatte genelde Kalabalık)" / "normalden daha kalabalık": canlı doluluk ile bu saatin önceki günlerdeki olağan seviyesi (typical usual_now) karşılaştırılır; mekan sayfasında
- 👥 Gruplar (Sosyal > Sıralama > Gruplar): "＋ Grup oluştur" (ad + davet: arkadaşlar, çevrendekiler / öneriler, kullanıcı adıyla arama), davet 🔔'ye düşer, "Katıl" / "Reddet"; her grubun kendi haftalık / tüm zamanlar sıralaması; üyeler davet edebilir, son üye çıkınca grup silinir (backend/app/groups.py; en fazla 50 üye, kişi başı 20 grup)
- Konum ve izinler > Konum: özelliklerin yanında tik kutuları; "Haritada konumum" (mavi nokta) ve "Check-in önerisi" kapatılabilir, check-in her zaman konum ister
- Daha fazla > Destek: site açılana kadar "Yakında", basılmaz
- Daha fazla: Profil ayarları (çıkış yok; Çıkış Yap Daha fazla'nın altında), Bildirim ayarları, Görünüm (tema + renk körlüğü), Gizlilik ayarları; her satırda içinde ne olduğu yazar. Ana sayfada reklam yeri yok
- Check-in sonrası kısa kutlama (🎉 "Check-in yapıldı!" / ✨ "Burayı sen keşfettin!" + "+10 puan · Buraya 3. check-in'in") ve "📣 Arkadaşlarına paylaş" (mekan, doluluk ve web bağlantısı); buton kapalı kalır, üstünde "Tekrar check-in: 17:47"
- Haritada sağ altta "+" → Check-in yap: en yakın mekanlar ve arama; sağ üstte "➕ Mekan ekle"
- Check-in önerisi: açık bir mekanın 250 m yakınında 3 dk kalınca (uygulama açıkken) şerit + telefon bildirimi; son 90 dakikada orada check-in yaptıysan sormaz
- Kayıt sonrası kısa tanıtım (müşteri 4, işletme 3 slayt; sağa / sola kaydırılır) ve "İlk check-in'in" (yakındaki en yakın açık mekan)

**Puan, rozet, keşif**
- Puanlar (`points`): check-in 10, mekanın ilk check-in'i +50 (Kâşif), onaylanan mekan eklemesi +50, davet +50; misafire yarısı
- Puan kasmaya karşı (dip dibe kafeler): başka bir mekanda check-in yaptıktan sonraki 30 dakika içinde yapılan check-in puan getirmez; günde en fazla 8 check-in puan getirir; doluluğa yine sayılır, mesajda neden puan olmadığı yazar (points_note)
- "✨ Burayı @eray keşfetti" 30 gün; rozet kataloğu (İlk Adım, Kâşif, Büyük Kâşif, Gezgin, Müdavim, Gece Kuşu, Yardımsever) ilerlemeyle
- Sıralama (Sosyal > Sıralama): Bu hafta / Tüm zamanlar × Arkadaşlar / Herkes (hafta pazartesi 00:00'da başlar)

**Sosyal**
- Arkadaşlar: kullanıcı adıyla arama, istek / kabul / reddet / çıkar (onaylı), QR'ım, QR okut, davet bağlantısı (?invite=ad). Davet bağlantısıyla kayıt olan davet edenle otomatik arkadaş olur, davet eden 50 puan alır (ayda en fazla 5 davet ödülü; users.invited_by). Canlı konum yok
- "📱 Rehberden bul" (isteğe bağlı, yalnızca telefonda; app/contacts.py): rehber izni yeter; kendi numaranı da yazarsan (isteğe bağlı; telefonlar uygulamaya kendi numarasını vermez) seni de bulurlar (yalnızca gizli anahtarlı özeti saklanır: users.phone_hash, PHONE_PEPPER; "Numaramı kaldır"); rehberdeki numaralar sunucuda eşleştirilir ve saklanmaz; yalnızca aranabilir bireysel hesaplar bulunur. Tüm rehber listelenir: availy'de olanlarda Ekle / Kabul et, olmayanlarda "Davet et" (SMS: "Arkadaşın seni availy'ye davet ediyor. Sen de ilk check-in'i yap." + bağlantı); uzun rehberde arama
- Akış (GET /v1/feed): arkadaşların ve kendi son 7 gündeki check-in'leri (keşif + puan + not), yorumları ve yanıtları, kişi başına ayrı bloklarda; Akış'tan yanıt. Check-in'lere ♡ beğeni ve yorum (checkin_likes, checkin_comments; kişi başı 5 yorum; yorumu yazan ya da check-in sahibi silebilir; yalnızca arkadaşlar) Akış boşken (arkadaşı yoksa en üstte "📨 Arkadaşlarını davet et") "Arkadaş ekle / Mekan keşfet / Check-in yap" kartları, "Önerilen kişiler" (ortak arkadaşı olanlar, aynı mekanlara gidenler (ikisi de izin verdiyse: Gizlilik > "Arkadaş olarak önerilmeye izin ver", users.suggest_by_venues, gizli check-in sayılmaz), sonra bu hafta en çok puan alanlar; Ekle) ve "✨ Yakında yeni keşfedilen mekanlar" (son 14 günün ilk check-in'leri, yakından uzağa) (GET /v1/suggestions)
- "👥 @ayse ve @can burada · 20 dk önce check-in": mekan sayfasında ve haritadaki kartta, son 60 dakikada orada (gizli olmayan) check-in yapan arkadaşlar (GET /v1/venues/{id}/friends-here; check-in'lerini paylaşmayanlar görünmez). Arkadaşın profilinde en üstte son check-in'i ("📍 X'de check-in yaptı · 20 dk önce"). Haritada arkadaş işareti yok (istenmedi)
- Kullanıcı profili: puan, check-in, keşif, rozetler, mekanlar (yalnızca kendin ve paylaşan arkadaşların); Arkadaş ekle / Sessize al / Arkadaşlıktan çıkar / Engelle
- 🔔 Bildirimler (GET /v1/notifications, uygulama açıkken dakikada bir): arkadaşlık isteği, kabul, yorumuna yanıt, check-in'ine beğeni ve yorum (dokununca Akış), keşif ödülü, sadakat programı. Ayarlar'da "Bildirimler" (check-in önerileri, sakin olunca haber ver) ve "Sosyal bildirimler" (arkadaşlık istekleri, arkadaşlık onayları, check-in yorumları, check-in beğenileri, yorumlarıma yanıtlar) ayrı; yenileri telefona bildirim olarak da gelir

**Yorumlar**
- 1–5 yıldız + en fazla 280 karakter; her check-in o mekana 2 yorum hakkı verir; bir yoruma kişi başı en fazla 2 yanıt (check-in yoksa yorum yok); "Başkaları yanıt verebilsin" anahtarı; kendi yorumunu / yanıtını silme
- Şikâyet (Hakaret / Spam / Yanlış bilgi / Diğer): şikâyet edene hemen, 3 şikâyette herkese gizlenir

**Destek**
- Daha fazla > "Destek" (Yakında): tanıtım sitesi yapılınca mobile/src/lib/share.ts `SUPPORT_SITE_URL` ile sitedeki destek sayfası açılır; o zamana kadar "Hata bildir ve iletişim" açılır
- "Hata bildir" / "İletişime geç" sunucuya gider (support_messages; POST /v1/support, giriş olmadan da; kişi başı günde 10); SUPPORT_EMAIL ayarlıysa oraya e-posta da gider (Render'da girilmeli)

**Gizlilik ve güvenlik**
- Gizlilik: arkadaşlar check-in'lerimi görsün, herkese açık sıralamada görüneyim, kullanıcı adımla aranabileyim, arkadaş olarak önerilmeye izin ver; Engellenenler
- Konum erişimi (Konum ve izinler > Konum açılınca, ayrı sayfa yok): şimdiki izin (Kapalı / Uygulamayı kullanırken / Daima) + Düzenle, ve o izinle hangi özelliklerin çalıştığı (✓ / !): check-in, harita, check-in önerisi, kapalıyken check-in önerisi (yakında, "Daima" ister)
- Konum ve izinler sayfası (konum / kamera / bildirim: ne için, izin vermezsen ne olur, durum ve "İzin ver"; izin verilmişse "Ayarlara git"; web'de tarayıcı ayarlarının yeri). İşletmede yalnızca kamera ve bildirim ("İzinler")
- Gizlilik politikası ve kullanım koşulları taslağı (mobile/src/lib/legal.ts), kayıt ekranında onay satırı

**Harita ve ana sayfa**
- Ana sayfa: Konum (pilot semtler Ataşehir, Kadıköy, Şişli; diğerleri soluk), Ne arıyorsun (Sosyalleşme, Ortak çalışma, Eğlence, Sessizlik, Yemek, Gece hayatı, Ücretsiz Wi-Fi), arama (Türkçe karakterden bağımsız), Önerilen / En yakın / En sakin, Kapalıları gizle
- Harita: üstte "🔍 Mekan ara" (seçilen mekanda harita yeniden açılır, kartı açık); renkli noktalar (soluk = tek kişi, gri ? = bilgi yok, mor ✨ = keşfedilmedi), yakınlaşınca mekan adları, mavi konum noktası, "Konumuma git", yana kayan filtre şeridi, Tümü / Ziyaret ettiklerim, 🔥 Trendler
- Ücretsiz Wi-Fi: OSM'de Wi-Fi'ı olup ücreti olmayan (ya da müşteriye ücretsiz) mekanlar ve ortak çalışma alanları `wifi` amacı alır (pilot: 267 mekanın 22'si); filtrede ve mekan özelliklerinde "📶 Ücretsiz Wi-Fi" (artık tahmin edilmiyor). Parklar ve "Doğa" kaldırıldı: OSM'den çekilmiyor, eski park kayıtları gizli (check-in'leriyle duruyor). Neon'da Wi-Fi bilgisi için copy_venues yeniden çalıştırılmalı (mevcut mekanların amaçlarını günceller)
- "📈 Cumartesi günleri genelde 18:00–20:00 kalabalık · En sakin: 10:00–11:00": son 8 haftanın check-in puanları gün ve saat başına ortalanır (en az 3 check-in olan saatler); bugünün gününde yeterli veri yoksa tüm günler birlikte (GET /v1/venues/{id}/typical, app/typical.py)
- Mekan sayfası (✓ haritadaki kartta da): kapak fotoğrafı, ✓ Doğrulanmış işletme rozeti, ⏳ Onay bekliyor, keşfeden, yıldız ortalaması, doluluk, saatler, Instagram / Ara düğmeleri, check-in, Haritada gör / Yol tarifi, kampanya, özellikler, yorumlar; "Sakin olunca haber ver" (🔕)
- Favoriler: yalnızca kayıtlı kullanıcılar (misafire "Kayıt ol / Giriş yap"); Kaydedilenler / Ziyaret edilenler (telefonda, hesap başına)
- Ana sayfa: "Mekan ara"nın altında "Filtrele" (açılan alt menü: Ne arıyorsun?, Sırala: Önerilen / En yakın / En sakin, Kapalıları gizle; "N mekanı göster", "Sıfırla"); seçilenler düğmenin yanında ✕ ile kaldırılır; Konum > Temizle yalnızca konumu temizler
- Hesapla taşınanlar (migration 008, /v1/me/favorites, /watches, /settings): favoriler, "Sakin olunca haber ver" zilleri ve ayarlar sunucuda; telefon kopya tutar, telefondaki eski liste ilk girişte bir kez yüklenir; ayarlarda sunucudaki kopya kazanır. Eski yerel mekan fotoğrafları (KEYS.photos) yalnızca telefonda kaldı (yeni fotoğraflar zaten sunucuda)
- Akıcılık: önemli dokunuşlarda titreşim (lib/haptics: check-in, ♡, zil, beğeni, çipler), check-in kutlama animasyonu (components/Celebration), yüklenirken iskelet (components/Skeleton: ana sayfa kartları, Sosyal akış)
- Yorum hakkı sayacı gösterilmez; sınır (check-in başına 2) aşılınca sunucunun uyarısı çıkar
- Yazı tipleri: metinler Figtree, 20 pt ve üstü başlıklar Tinos (components/Text: React Native'de genel font olmadığı için tüm Text / TextInput buradan gelir, fontWeight doğru font dosyasını seçer)
- İkonlar: uygulamanın çerçevesi (alt menü, üst düğmeler, geri oku, arama) kendi çizimimiz (components/TabIcon, SVG); içerikteki ikonlar Tabler (MIT; components/Icon, font dosyaları assets/fonts, ad → karakter haritası lib/tabler*Glyphs.json); emojiler yerine InlineIcon (yazının boyutunu ve rengini alır). Telefon bildirimi metinleri ve paylaşım mesajlarında emoji kaldı (uygulama dışı); rozet simgeleri sunucudan emoji olarak geliyor
- Veri yokken mekan sayfasında "Genelde bu saatte sakin (tahmini)" (mekanın kendi geçmiş check-in'leri, /typical usual_now)
- "Bugünün ilk bilgisini sen ver": mekanda gece yarısından beri check-in yoksa (keşif hariç) check-in 2 kat puan (first_today)
- Seviyeler (app/levels.py, saklanmaz, her seferinde hesaplanır): Yeni Gelen → Kâşif (100 puan ya da 1 keşif) → Mahalleli (500 puan ve 3 mekanda 3+ check-in) → Semt Elçisi (2.000 puan ve bir semtte 10 farklı mekan); profilde LevelCard (kendi profilinde "Kâşif → Mahalleli", puan yok); basınca Seviyeler ekranı (LevelsScreen: sonraki seviyeye kalanlar, dört seviye, gereklilikler, avantajlar); istatistikler gizli olsa da seviye görünür
- İşletme paneli: profil eksikse en üstte ProfileProgress (fotoğraf yoksa "Mekanının fotoğrafı yok" kartı ve tek dokunuşla yükleme; "Profilin %60 dolu" çubuğu ve eksikler: fotoğraf, adres, Instagram, telefon, özellikler; "Hakkımızda" yok). İşletme Profili: kapak fotoğrafı, mekan bilgileri (ad, saatler, ne için uygun, özellikler; Ayarlar'dan taşındı), adres ve konum (adresten bul, haritadan seç, konumum), iletişim
- Ana sayfa: "Filtrele"nin yanında sıralama çipleri (Önerilen / En yakın / En sakin), seçili filtreler altında; kart fotoğrafı genişliğin %78'i; yazısız puanlar (kendi puanın da) yorum listesinde görünmez
- İkon fontları scripts/build-icons.py ile üretilir (yalnızca kodda geçen ikonlar, Tabler'ın kendi numaralarıyla, derlemeler arasında değişmez; font adları availy-icons / availy-icons-filled; satır ölçüleri eşitlendi, ikonlar daire içinde ortalı; Tabler'ın hazır TTF'i iPhone'da yüklenmiyordu: bozuk post tablosu, U+FFFF üstü karakterler, iki fontta aynı iç ad). Yeni ikon adından sonra çalıştırılmalı (pip install fonttools)
- Kişisel profil doluluğu (Daha fazla'da ProfileCompletion): profil fotoğrafı, e-posta doğrulama, ilk check-in, ilk arkadaş, ilk yorum; hepsi tamamlanınca Tam Profil rozeti (+20 puan); karta basınca Profil ayarları açılır
- Rozetler puan kazandırır, zorluğa göre (İlk Adım 5, Gece Kuşu 10, Kâşif 15, Tam Profil 20, Gezgin 20, Müdavim 25, Büyük Kâşif 40, Yardımsever 50; misafire yarısı), bir kez (user_badges, migration 010; eski hesapların önceden kazandıkları puansız yazıldı); check-in yanıtında ve /v1/me'de new_badges → uygulamada "Yeni rozet!" penceresi (components/BadgeCelebration); rozet simgeleri Tabler (BadgeGrid)
- Haritada işletmenin kendi mekanı (ownVenueId): büyük, kırmızı halkalı, "Mekanın · ad" yazılı, gruplamaya girmez
- İşletme Profili: kapak fotoğrafı en üstte mekan adının yanında (kalemli; components/business/CoverPhoto); "Mekan bilgilerini düzenle" ve "Adres ve konum" açılıp kapanır; panelde mekan adının yanında "Düzenle" (İşletme Profili'ni açar)
- Mekan iletişim bilgileri (migration 011: contact_phone, contact_website, contact_source; contact_email zaten vardı): Overture Maps'ten app/import_contacts.py ile (ad + 80 m eşleşme; semt adları yok sayılır); yalnızca işletme doğrulaması için, uygulamada gösterilmez. Yerelde 286 mekanın 191'i: 175 telefon, 96 e-posta, 124 web. Neon'da da çalıştırılmalı
- Mekan eklerken "Adresi haritada bul" (yazılan adres haritada açılır, pin kapıya getirilir); konum seçme haritasında üstte arama, yazdıkça sonuçlar arama çubuğunun hemen altında küçük liste (Google Maps gibi; Nominatim searchPlaces)
- Daha fazla > Hakkında: "Web sitemiz" (tanıtım sayfası)
- Logo yazısı (Wordmark): "availy", Tinos (serif, @expo-google-fonts/tinos), temanın ana renginde; y altında kıvrım yok
- Görünüm: Cihaz ayarı / Açık / Koyu (denenen Koyu mavi, Petrol ve Grafit kaldırıldı; kayıtlıysa Cihaz ayarına döner)

**Mekanlar**
- "🏪 İşletmesi henüz availy'ye katılmadı · İşletmeye haber ver": işletmesi olmayan mekanın sayfasında (mekan availy'de görünür, yalnızca işletmesi yok); kişi başı bir kez, "N kişi istedi"; 3 / 5 / 10 / 25 / 50 / 100 kişide mekanın e-postası biliniyorsa yalnızca sayıyı yazan bir e-posta gider, kimin istediği yazmaz (venue_requests, venues.contact_email)
- "Mekan ekle" (giriş yapmış bireysel kullanıcı; Check-in yap ekranında sağ üstte; mobile/src/components/NewVenueForm.tsx): ad, tür, Konum seç (📍 şu anki konum ya da 🗺️ haritadan; harita çevredeki mekanları ve mavi noktanı gösterir), seçilen noktadan semt / mahalle / açık adres kendiliğinden dolar (Nominatim, değiştirilebilir), "Adresi doğrula" özeti → "Doğru, gönder". Kullanıcı seçtiği noktaya check-in mesafesinden yakın olmalı. Semt arama kutusuyla seçilir (yazınca altta liste). Yakında (60 m) aynı adlı mekan varsa eklenmez; 25 m içinde başka mekan varsa "haritada üst üste görünürler" uyarısı ve "Aynı mekan değil, yine de ekle"; kişi başı en fazla 3 onay bekleyen mekan. "⏳ Onay bekliyor" görünür, check-in alır; ekleyen dışında 3 farklı kişi en az 3 farklı günde check-in yapınca onaylanır, ekleyen 50 puan alır; 30 günde onaylanmazsa listelerden kalkar (veri silinmez)

**İşletme**
- Mekanı yalnızca telefonda kalmış (sunucu öncesi eklenmiş) işletme hesapları açılışta yeniden "Mekanını seç / ekle" ekranına gelir
- İşletme hesabı: kayıtta mekan seçer (sunucuda: PUT /v1/me/venue; bir mekana tek işletme hesabı, başkasına bağlı mekanlar listede soluk; GET /v1/venues/taken) ya da listede yoksa aynı formla kendi mekanını ekler (her yerden, onay bekler, hesaba hemen bağlanır); check-in ve yorum yapamaz, aramada ve herkese açık sıralamada görünmez
- Alt sekmeler: Panel (açılış), Müşteriler, Harita, Kampanyalar, Daha fazla (Ana Sayfa yok)
- Müşteriler: son 30 gün farklı kişi, müdavim (3+ check-in), en sık gelenlerin check-in sayıları (adsız), sadakat üye ve damga sayısı (program yoksa "Sadakat programı oluştur", varsa "Programı yönet" → Kampanyalar > Sadakat programım), "💬 N yorum yanıt bekliyor" ve yorumlar ("İşletme" etiketiyle yanıt)
- Panel (GET /v1/venues/{id}/stats, check-in verisinden): şu an, bugün saat saat, son 7 gün (check-in, kişi, tekrar gelen), son 30 gün hafta günleri, yakındaki benzer mekanlar; ölü saat uyarısı (müşteriler açık mekanı Sakin bildiriyor) + hazır kampanya; keşfedene "🎁 Ödül ver" (mekan başına bir kez, bildirim olarak gider)
- Kendi mekanının yorumlarına "İşletme" etiketiyle yanıt (yanıtlar kapalı olsa da)
- İşletme Profili'nde üstte kalın "E-posta henüz doğrulanmadı" ve "Doğrulanmamış işletme" kartları, yanlarında Doğrula (ikincisi İşletme doğrulama'ya gider)
- İşletme profili = mekan sayfası: sağ üstteki profil ikonu kendi mekan sayfasını "👁 Müşteriler mekanını böyle görüyor" olarak açar; sağ üstte "✏️ Düzenle" → Daha fazla > İşletme Profili. Orada düzenlenenler sunucuda, herkese görünür: kapak fotoğrafı, adres ve konum (açık adres, mahalle, semt; yol tarifi noktası adresten bulunur ya da "Mekandayım: konumum"; en fazla 1 km kaydırılabilir, check-in mesafesi de bu noktaya göre; OSM yeniden içe aktarılınca korunur: `venues.edited_by_business`), Instagram, telefon. ✓ rozeti `venue_profiles.verified` ile (doğrulama henüz yok; elle açılır)
- Daha fazla: İşletme Profili, İşletme doğrulama ("Yakında"), Abonelik (kampanya başı ₺150 / SaaS ₺1.899/ay; ödeme yok), Ayarlar (hesap + mekan bilgileri + ölü saat / otomatik kampanya), Görünüm, İzinler
- Kalıcı işletme test hesabı @availy_isletme

**Sadakat** (sunucuda: loyalty_programs, loyalty_members; app/loyalty.py)
- İşletme damga kartı ya da ücretli üyelik (gösterim, ödeme yok) kurar, açar / kapatır; müşteri Kampanyalar → Sadakat'ta ya da mekan sayfasında "Katıl" der (otomatik katılım yok), çıkabilir
- Kasada müşterinin QR'ı / kodu (M-123456, sunucuda hesaba bağlı; GET /v1/me `customer_code`) okutulur: damga (kart dolunca ödül), ödülü kullandır; katılmamış müşteriye damga yok
- O mekanda check-in yapmış (keşfetmiş, sık giden) ve katılmamış müşterilere 🔔 "⭐ … sadakat programı başlattı" bildirimi; program yeniden açılınca tekrar
- Damga başına 5 availy puanı (uygulamada sayılır)

**Kampanya ve kupon** (sunucuda)
- İşletme kampanya gönderir (mesaj, indirim, 1/2/3 saat, 1/2/5 km, kişi sınırı); her telefondaki müşteri yakınındaki aktif kampanyayı görür, "Kuponu al" → AV-XXXX (0/O, 1/I, 8/B yok; kişi başı bir; sınır kilitle korunur), kasada QR ya da elle; kampanya bitince kupon kullanılamaz
- Kampanyalarım: son 7 gün sonuçları, gösterim (kişi başı bir) / kupon / kullanım; bitir, tekrar gönder, bitenleri sil (yalnızca listeden); Rakipler (3 km)
- "Check-in yapana kupon": kampanyada "Kupon kimlere? Yalnızca check-in yapanlar"; müşteride "📍 Check-in yap, kuponu kap", check-in yapınca kupon kendiliğinden verilir ve kutlamada görünür (campaigns.checkin_only; kampanya başladıktan sonraki check-in gerekir)
- Zamanlanmış / haftalık kampanyalar işletmenin telefonunda tutulur, zamanı gelince (uygulama açıkken) sunucuya gönderilir

**Akış, gizlilik ve moderasyon**
- Sosyal: Akış = kendi check-in ve yorumlarım, Arkadaşlarım = arkadaşlarınki (GET /v1/feed?who=me|friends); ikisi de zaman çizgisi: tarih başlıkları (Bugün / Dün / tarih), solda simge (bende) ya da kişinin fotoğrafı, çizgi yalnızca aynı günün paylaşımlarını bağlar; altında ↳ ile beğenenler, check-in yorumları ve yoruma gelen yanıtlar (son 3, "Önceki yanıtları gör"); sağdaki kişi+ simgesi arkadaş ekleme, istekler ve QR
- Akış süreleri: bende son 7 gün açık, daha eskisi (30 güne kadar) "Daha eski" altında; arkadaşlarda son 3 gün, "Daha eski" ile 7; arkadaşların yazısız, beğenisiz, yorumsuz check-in'i 2 günde düşer
- Profil istatistikleri: Gizlilik > "Arkadaşlarım / Sadece ben" (users.stats_visibility); gizliyse puan, check-in, rozet görünmez
- Şikâyet: işletme ya da kullanıcı yorumu/yanıtı şikâyet eder; yönetici (users.is_admin, sunucuda elle verilir) Daha fazla > Yönetici'den "Kaldır" (removed_at) ya da "Şikâyeti reddet" (reports.dismissed_at); /v1/admin/*
- Mekan yorumları: yazısız (yalnızca puan) yorumlar listede tek tek görünmez, ortalamaya sayılır (kendi puanın da)
- Görünüm: Cihaz ayarı / Açık / Koyu / Petrol / Grafit (son ikisi deneme; theme.ts petrolColors: gece petrolü #061A1E + mercan #FF7A59; kaldırılan bir tema kayıtlıysa Cihaz ayarına döner; graphiteColors: koyu gri #111113 + indigo #8B7CFF, düğme yazısı koyu; ikisi de koyu tema gibi davranır: koyu harita, açık durum çubuğu)
- "Bilgi yanlış mı?" (mekan adının sağında, pop-up): kapanmış / saatler / konum / ad + isteğe bağlı not (venue_issues); aynı şeyi 3 kişi bildirince Yönetici > Kontrol edilecek mekanlar: "Kapandı, kaldır" (venues.closed_at, haritadan ve aramadan çıkar), adı / saatleri kaydet, "Düzelttim" (konum), "Bildirim yanlış"
- Konum ve izinler: konum özellikleri yalnızca ✓ / ! gösterir, seçilmez; Fotoğraflar izni listede yok; profil fotoğrafı menüsü (seç / çek / sil) iOS'ta menü kapandıktan sonra açılır

**Yayın ve altyapı**
- Render + Neon + GitHub Pages /v2/ (bkz. Ortamlar); şema Neon'da `CREATE EXTENSION postgis` ile başlar; bağlantı havuzu kopan bağlantıyı yeniler; CORS: localhost:8081, localhost:8765, erayerb.github.io

### Yapılacaklar (v2)
**Yayından önce** (özet: 150 m, push bildirimleri, migration, Sentry, hukukçu kontrolü)
- Render ayarları (availy-api → Environment): `PHONE_PEPPER` = uzun, rastgele bir metin (girilmezse "Rehberden bul" güvensiz varsayılan metinle çalışır; ayrıntı: Tanıdıkları bulmak) ve isteğe bağlı `SUPPORT_EMAIL` = hata bildirimleri ve iletişim mesajlarının e-postayla da geleceği adres (Resend alan adı doğrulanana kadar yalnızca Resend hesabının adresine gider)
- Check-in mesafesini 1 km'den 150 m'ye geri al
- Push bildirimleri (bkz. Bildirimler)
- Deneme ve gerçek ortam ayrı: ikinci Render servisi + ikinci Neon veritabanı (gerçek ortam `main`'den, kod aynı)
- Planlar: Render Starter (~7 $/ay, uyumaz), Neon ücretli plan (~19 $/ay; 7–30 gün yedek)
- Hata takibi: Sentry (backend + uygulama)
- Mağaza sürümü: Expo EAS Build ile App Store / Google Play
- E-posta: Resend hesabı açıldı, anahtar Render'da (`resend` ortam grubu, RESEND_API_KEY). Alan adı olmadan Resend yalnızca hesap sahibinin adresine gönderir; herkese gidebilmesi için alan adı al (ör. availy.app), Resend → Domains'te doğrula (DNS: SPF, DKIM) ve Render'da MAIL_FROM = "availy <no-reply@alanadı>" yap
- Gizlilik politikası ve kullanım koşulları: hukukçu kontrolü, şirket bilgileri, web'de yayın; KVKK: sunucular Frankfurt'ta, yurt dışına aktarım şartları hukukçuya sorulmalı

**Sürpriz paket** (Too Good To Go benzeri)
- İşletme gün sonunda satılmayan ürünlerden indirimli "sürpriz paket" açar: fiyat, normal değeri, adet, teslim saati (ör. 18:00–19:00), kabaca içerik
- Kullanıcı uygulamadan ayırır (kişi başı bir; adet bitince kapanır), saatinde kod / QR ile alır; ödeme önce kasada, sonra uygulamada
- Mevcut kampanya ve kupon altyapısı kullanılır (kişi sınırı = adet, kupon = ayırma kodu); ölü saatte ya da kapanışa yakın "paket aç" önerisi

**Puan ve seviyeler**
- Puanı Premium'a çevirme: ör. 300 puan = 1 hafta Premium (ödeme altyapısı gelince gerçek Premium)
- Seviyelere göre kazançlar: ör. Kâşif'e hoş geldin kuponu, Mahalleli'ye kurucu kafelerde ikram / indirim, Semt Elçisi'ne erken erişim ve aylık Premium; seviye atlayınca kutlama ve bildirim
- Sıralamada ve Akış'ta kullanıcı adının yanında seviye simgesi, Semt Elçisi'ne profil fotoğrafı çerçevesi

**Tanıtım (reklam)**
- Tanıtım sayfası: mobile/public/tanitim (yayında https://erayerb.github.io/availy.app/v2/tanitim/); bekleme listesi (kullanıcı / işletme, POST /v1/waitlist, Yönetici > Bekleme listesi). İsim kesinleşince alan adı ve kök adrese taşıma; haritadan kısa video / gif eklenebilir
- Instagram ve TikTok serileri (haftada 2–3): "Moda'nın en sakin 5 kafesi" (her kafe 3 sn, "Salı 15:00 · sakin · priz var", sonda "Şu an hangisi sakin? Uygulamada canlı"); gün içinde "Kadıköy'de şu an sakin 3 yer" hikâyeleri (uygulamadan ekran görüntüsü); "Çalışmaya uygun" ve "Sınav haftası" listeleri (priz, Wi-Fi, sessizlik; uygulamadaki listelerden); kurucu kafelerin kısa tanıtımları; haftanın kâşifi ve "Burayı sen keşfettin" paylaşımları (paylaşana bonus puan)
- Kurucu mekan programı (tanıtım sayfasında): ilk 10 mekana 3 ay ücretsiz Aylık Paket, "Kurucu Mekan" rozeti (uygulamada henüz yok), kapıya "availy'de · QR ile check-in" çıkartması, ekipten biri fotoğraf çeker, açılışta öne çıkma
- Tek semtte yoğun başlangıç (Moda / Kadıköy): ekip ve elçi kullanıcılar ilk haftalarda düzenli bildirim
- Ölçüm: takipçi değil; bekleme listesine yazılan ve check-in yapan kişi sayısı

**Mekan verisi (yayında çok mekan için)**
- Foursquare OS Places (Apache 2.0, ücretsiz; tel / website / e-posta / Instagram alanları var ama çoğu boş) ve Overture Maps Places (çoğu CDLA-Permissive-2.0; telefon, web, e-posta, sosyal alanları) OSM'ye ek olarak içe aktarılabilir; Google Places verisi saklanamaz (yalnızca place_id)

**Premium'a teşvik** (ana sayfadaki "REKLAM" yeri kaldırıldı)
- Premium'un ne kazandırdığını yerinde göster: ikinci mekanı takip etmeye çalışınca ("Sakin olunca haber ver" sınırı), geçmiş doluluk / tipik saatler ayrıntısında, haftalık özet kartında
- Ana sayfada küçük, kapatılabilir bir kart (ör. haftada bir): "Premium ile sınırsız takip ve reklamsız kullanım"
- Deneme süresi (7 gün ücretsiz) ve seri ödülü: ör. 4 haftalık seriye 1 hafta Premium
- Gerçek reklamlar gelince: yakındaki mekanların kampanyaları, Premium'da gizli

**Görünüm**
- Not: Expo Go geliştirme modunda çalışır (sıkıştırılmamış kod, ek kontroller); yavaş sayfa geçişleri gerçek (release) sürümde büyük ölçüde düzelir

**Bildirimler** (olay olunca, uygulama kapalıyken de)
- Telefon bildirimi (push): uygulama bildirim adresini sunucuya kaydeder, sunucu olay olunca Expo push ile gönderir: arkadaşlık, yanıt, keşif ödülü, "Sakin olunca haber ver", yakında kampanya; işletmeye ölü saat
- Kısıt: iPhone'da Expo Go ile çalışmaz; EAS Build ve Apple Developer hesabı (yıllık 99 $) gerekir. Android'de Expo Go ile de denenebilir
- Uygulama kapalıyken check-in önerisi: geofencing (expo-location + TaskManager, "Her zaman" konum izni, en fazla ~20 bölge); Konum ve izinler metni o zaman güncellenmeli
- Haftalık sıralama ödülleri: ne verileceği ve nasıl dağıtılacağı
- Olaya bağlı toplu bildirim: "Moda'da 3 kafe şu an sakinleşti" (favori semt / favori mekanlar sakinleşince; push gerekir)
- iPhone ana ekran widget'ı: favori mekanın şu anki doluluğu (EAS Build + iOS widget eklentisi; Android widget'ı da düşünülebilir)

**Güvenlik ve hile**
- Aynı IP'den çok sayıda giriş denemesine sınır (hesap kilidi var, IP sınırı yok)
- Yanlış şifre kilidi: Resend alan adı doğrulanmadan "Şifremi unuttum" e-postası yalnızca hesap sahibine gider; yayından önce alan adı şart. Başkası bilerek yanlış şifre girip bir hesabı kilitleyebilir (e-postayla açılır)
- İşletme sahibinin bireysel hesabıyla kendi mekanını "Sakin" göstermesi: "aynı telefon kuralı" (bir telefonda işletme hesabı açıldıysa o telefondaki bireysel hesapların o mekana check-in'i sayılmaz) denendi ve kaldırıldı (sahibin kendi denemelerini de engelliyordu); yayına yakın yeniden düşünülecek
- Aynı telefondan açılan birden çok bireysel hesap aynı mekanda tek kişi sayılsın (sahte hesapla doluluk şişirme)
- Yeni hesap ilk günlerinde / ilk check-in'lerinde az sayılsın

**İşletme**
- Mekan sahipliği doğrulaması (✓ rozeti; şimdi ekran "Yakında", `venue_profiles.verified` elle): OSM'den telefon / e-posta içe aktar (pilot: 282 mekanın 32'sinde telefon, 7'sinde e-posta) → e-postası varsa kod, telefonu varsa SMS (ücretli) ya da arama → yoksa vergi levhası / ruhsat + mekandayken konum + yönetici onayı → ✓, kampanya ve sadakat açılır; başkasına bağlı mekan için "Bu mekan benim" aynı yolla
- "Check-in yapana %10" gibi check-in'e bağlı kampanyalar
- İşletme profiline belki: "Hakkımızda", menü / fiyat aralığı, genelde en sakin saatler

**Tanıdıkları bulmak**
- Render'da PHONE_PEPPER ayarı girilmeli. Ne işe yarar: "Rehberden bul"da telefon numaraları açık hâliyle saklanmaz, bu gizli metinle karıştırılıp geri çevrilemez bir özete (hash) dönüştürülür. Türkiye'de olası numara sayısı az olduğu için gizli metin olmadan özetler denenerek numaraya geri çevrilebilir; gizli metin bunu imkânsız yapar. Değer: uzun, rastgele bir metin (ör. 40+ karakter); bir kez girilir, sonra değiştirilmez (değişirse kayıtlı numaralar artık eşleşmez). Girilmezse geliştirme için yazılmış varsayılan metin kullanılır (güvensiz)
- Rehberden bul için gizlilik politikasına madde (hukukçu kontrolü)

**availy puanı** (kullanıcı "puan ne işe yarar?" diye soracak: yayından önce bir karşılığı olmalı ve uygulamada anlatılmalı)
- Puan harcama: ör. 200 puan = katılan bir kafede %10 kupon (işletme ödülü kendisi belirler, sponsor olur); işletmeleri sisteme bağlamanın da yolu. Puan kasmaya karşı kurallar (başka mekandan sonra 30 dk / günde 8) ödül verilmeden önce yeniden gözden geçirilmeli (ör. aynı sokakta art arda check-in'lere bakmak, hesap yaşı)
- Harcama: ödül kataloğu (ör. 200 puan = kafede %10 kupon), Premium indirimi, ortak kuponlar (Getir / Trendyol)
- Ek kazanım: yorum yazmak, Sakin saatte gitmek

**İşletmeye haber ver / işletme bildirimi**
- Mekanların e-postasını (ve telefonunu) OpenStreetMap'ten içe aktarmak (venues.contact_email); yoksa ekip arar
- İşletme katılınca haber veren müşterilere bildirim

**Testte bulunanlar (29 Ekim)**
- İşletme kendi doluluğunu bildiremiyor (panelde "Bilgi yok") → "Şu an: Sakin / Orta / Kalabalık" ("işletme bildirdi" etiketiyle)
- Mekanların çoğunda veri yok ("?" / "✨"): veri olanları üstte göster, tipik saat tahmini
- Harita çipleri ile ana sayfa "Filtrele" ayrı → birleştir; Görünüm açıklaması eski; "Destek" ve "İşletme doğrulama" hâlâ "Yakında"
- Daha fazla menüsü uzun: ayarları tek "Ayarlar" altında topla; "Giriş Yap / Kayıt Ol / Çıkış Yap" yazım birliği
- Kampanya ücreti (₺150) ve Aylık Paket için ödeme yok

**Belki (v1'de vardı, sahte veriye dayanıyordu)**
- Tahmini boşalma ("~15:20"), geçmiş haftaların check-in'lerine göre
- "Bölge: Yoğun" satırı, semtteki mekanların check-in ortalamasıyla

### Kaldırılan kalıntılar
- v1'in sahte doluluğu (backend `occupancy` alanı, /hourly, /history, /forecast, demo_data.py, seed.py; uygulamada gömülü demo veri, statik mod, telefonda mekan ekleme ve mekan düzenlemeleri), `device_accounts` tablosu ve `checkins.counts` sütunu (migration 003). v1 web demosu `main` dalından derlendiği için etkilenmez
- Telefonda kalan eski işletme verileri (availy.venueOverrides, availy.schedules, availy.localVenues) artık okunmuyor ama silinmedi; sahibine sorulmadan silinmez

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
