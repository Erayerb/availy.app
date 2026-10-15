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
- Bitti: "%70 altına düşünce haber ver" (🔔): uygulama açıkken dakikada bir kontrol; telefonda yerel bildirim, web'de uygulama içi uyarı
- Bitti: Haritada kullanıcının mavi noktası + "Konumum" butonu; ana sayfada Önerilen / En yakın / En sakin sıralaması; Keşfet sayfası (en sakin, kampanyalı, çalışmak için, yemek, akşam)
- Bitti: Sidebar'da Profil (ad, şifre, hesabı sil, puan) ve Ayarlar (renk körlüğü modu, bildirimler, konum durumu); paylaşma (⤴, web bağlantısı ?venue=Ad)
- Bitti: Ana sayfa / favoriler / Keşfet'te mekana dokununca önce detay sayfası; "Haritada gör" haritayı açar
- Bitti: "Kalabalık" normal modda da koyu turuncu (#D9480F) ve "!" simgeli
- Bitti: İşletme ayarları: "Ölü saat bildirimi" ve "Otomatik kampanya" (ölü saatte hazır kampanya; 2–3 saat aralıkla, uygulama açıkken)
- Bitti: İşletme için Kampanyalar sayfası: Yakındaki / Kampanyalarım / Sadakat programlarım (aktif-pasif anahtarı; pasif program müşteriye görünmez)
- Bitti: Mekan bilgilerini düzenleme (açıklama, kapasite, saatler, amaçlar, özellikler; telefonda saklanır, listelere uygulanır)
- Bitti: Zamanlanmış / haftalık tekrarlayan kampanyalar (sadece SaaS paketi)
- Bitti: Haftalık / aylık istatistik (/v1/venues/{id}/history: günlük ve haftanın günü ortalamaları + dönem kampanya sonuçları)
- Bitti: Mekan sahipliği doğrulama (SMS kodu — demo: kod ekranda; ya da belge yükleme — demo: anında onay); doğrulanmadan kampanya/sadakat/zamanlama kilitli
- Bitti: Geri bildirim: müşteri detay sayfasında 1–5 puan + yorum (kişi başı bir tane); işletme panelinde ortalama ve son yorumlar
- Bitti: Düzen (işletme): İşletme Paneli = durum, ölü saat, grafik, kıyaslama, istatistik, kupon doğrulama, geri bildirim, paket. Kampanyalar ve Sadakat = Kampanyalarım (yeni kampanya + zamanlanmış + sonuçlar) / Sadakat programlarım (kurulum, aktif-pasif, damga) / Yakındaki. İşletme Profili = ad, şifre, mekan bilgilerini düzenle, mekan fotoğrafı (puan/favori/kupon kutuları yok)
- Bitti: Kapasite arayüzden kaldırıldı (veride varsayılan 50 duruyor); yeni mekan eklerken Özellikler (açık alan, Wi-Fi, priz…) seçilir
- Bitti: Sadakat QR ile: müşteri Sadakat sekmesinde QR'ını gösterir, işletme Sadakat programlarım'da "📷 Damga ver / Ödülü kullan" ile kamerayla okutur (kamera yoksa kodu elle yazma yedeği var)
- Bitti: İşletme Kampanyalar ve Sadakat sekmeleri: Kampanyalarım / Kuponlar (kupon doğrulama + alınan kuponlar) / Sadakat programlarım / Yakındaki
- Bitti: Kampanyaya kişi sınırı (sınırsız, 10, 25, 50, 100 kupon); dolunca "Kuponlar tükendi"
- Bitti: Yeni mekan: açık adres yazılır, haritadan konum isteğe bağlı (adres Nominatim ile bulunur; bulunamazsa semtin ortası)
- Bitti: Sidebar'da İşletme Profili, İşletme Paneli'nin hemen altında; mekan düzenlemede kısa açıklama kaldırıldı
- Not: Mekan sahipliği doğrulaması şimdilik kapalı (kampanya ve sadakat doğrulamasız kullanılabilir); kod duruyor (VerificationSection)
- Bitti: Sidebar yerine alt sekme çubuğu (Midas gibi): Ana Sayfa, Kampanyalar (kampanyalar, kuponlar ve sadakat tek sekmede), Harita (ortada), Favoriler (işletmede Panel), ☰ Daha fazla (Profil / İşletme Profili, Ayarlar / İşletme Ayarları, İşletme doğrulama, Hata bildir ve iletişim, Hakkında, Çıkış). Keşfet sayfası kaldırıldı; işletmede Favoriler yok
- Bitti: Kupon QR ile: müşteri Kuponlarım'da kuponun QR'ını gösterir, işletme Kampanyalar → Kuponlar'da "📷 Kupon QR'ı okut" ile okutur (elle yazma yedeği var)
- Bitti: Hata bildir sayfası, içinde İletişime geç sekmesi (konu, mesaj, e-posta; şimdilik telefonda saklanır)
- Bitti: İşletme doğrulama ekranı görünür ama etkin değil ("Yakında")
- Bitti: "Co-working" her yerde "Ortak çalışma"; işletme mekan adını İşletme Profili → Mekan bilgilerini düzenle'den değiştirebilir
- Bitti: Sadakat programı formu "Sadakat programı oluştur" ile açılır, İptal ile kapanır; Damga ver (her alışveriş) ve Ödülü kullandır (kart dolunca) açıklamalı
- Bitti: Mekan bilgilerini düzenle İşletme Ayarları'nda; Paket (kampanya başı / SaaS) İşletme Profili'nde; biten kampanyalar tek tek ya da topluca silinebilir
- Bitti: Test için her saat kalabalık 5 demo mekan ("Demo … Popüler …", always_busy); toplam 43 mekan
- Not: Sahte doluluk tüm mekanlarda aynı saat eğrisini kullanıyor; yoğun saatlerde herkes birlikte doluyor. İleride kategoriye göre farklı eğri (kafe öğleden sonra, bar gece) daha gerçekçi olur
- Sırada: kullanıcıyla belirlenecek (bkz. Yapılacaklar)
- Not: Proje test/prototip; amaç kendi telefonundan göstermek, Mac'i yormamak
- Kararlar: önce polling (30 sn), WebSocket sonra; MVP'de doluluk sahte

## Yapılacaklar (şimdi değil, sonra)
Konuşmalarda "şimdi olmayacak, sonra" denen her şey. Yapıldıkça "Durum"a taşı.

**Gerçek veri toplama** (MVP'de doluluk sahte)
- Wi-Fi cihaz sayımı: işletmelerin Wi-Fi cihazlarından (ör. Cisco Meraki, Ubiquiti) API/webhook ile bağlı cihaz sayısı
- MAC adresleri sunucuda anında hash'lenecek (KVKK/GDPR); sadece sayı tutulacak
- `simulator/`: sahte Wi-Fi verisi gönderen üretici (klasör boş duruyor)
- Kullanıcı check-in'i: GPS ile mekana ≤100 m doğrulama, cihaz başına sınır (rate limit)
- İki kaynağı birleştirme modeli ("büyük olanı al" ya da ağırlıklı model) — karar verilmedi
- Sahte doluluğa kategoriye göre farklı saat eğrileri (kafe öğleden sonra, bar gece) — daha gerçekçi alternatif önerileri için

**Altyapı**
- Backend'i internete koymak (ör. Render + Neon/Supabase); şu an web demo sunucusuz, Expo Go Mac'teki backend'e bağlı
- Redis (cache, rate limit) — gerçek veri gelince
- WebSocket ile anlık güncelleme (şu an 30 sn polling)
- Uygulamayı mağaza/kalıcı kurulum için derlemek (EAS Build; iOS için Apple geliştirici hesabı gerekir)

**Sunucuya taşıma ve bildirimler (öncelikli)**
- Kampanyaları, kuponları, sadakat kartlarını ve hesapları sunucuda saklamak: işletmenin açtığı kampanya başka telefonlarda da görünsün (iki telefonla gerçek demo)
- Kampanyalar yarıçap içindeki kullanıcılara bildirim olarak gelecek (push; Expo Go'da Android'de push yok, development build gerekir)
- "Boşalınca haber ver" uygulama kapalıyken de çalışsın (sunucu tarafı kontrol + push)

**Hesaplar ve veriler** (şu an her şey sadece o telefonda/tarayıcıda)
- Gerçek, sunucu taraflı hesap sistemi (şu an prototip; hesaplar telefonda, şifre hash'i telefonda)
- Favorileri, kampanyaları ve işletmelerin eklediği mekanları sunucuda saklamak (herkes görsün)
- Yayında favoriler sadece giriş yapanlara: `FAVORITES_REQUIRE_LOGIN = true` (mobile/src/lib/favorites.ts)
- İşletmenin mekan sahipliğini doğrulamak (şu an listeden herhangi bir mekan seçilebiliyor)

**B2B**
- Birden fazla şube: bir işletme hesabına birden çok mekan bağlamak, şubeler arası karşılaştırma
- Personel hesapları: kasiyer/garson için sınırlı yetkili hesap (sadece kupon doğrulama ve damga verme)
- Hata bildirimleri ve iletişim mesajları sunucuya / destek e-postasına gitsin (şimdi sadece telefonda)
- Mekan sahipliği doğrulaması: kampanya oluşturmak ve sadakat programı kurmak için zorunlu olacak (şimdilik kapalı); gerçek SMS sağlayıcısı ya da belgeyi inceleyen yönetici paneli
- Zamanlanmış kampanyaların ve otomatik kampanyanın sunucuda çalışması (şu an uygulama açıkken)
- Geri bildirimlerin sunucuda saklanması; işletmenin yorumlara yanıt vermesi; uygunsuz yorum bildirme
- Mekan düzenlemelerinin sunucuya kaydedilmesi (şu an telefonda)
- Uygulamaya henüz katılmamış işletmeler de haritada görünecek. Böyle bir mekana basınca: "Bu kafeden haberdar olmak istiyorsanız işletmeyi ikna etmemize yardımcı olun" benzeri bir yazı (ör. "İşletmeye haber ver" butonu) çıkacak; doluluk bilgisi gösterilmeyecek
- Ödeme: işletme kampanya göndermeden önce SaaS aboneliği (₺1.899/ay) almış olmalı ya da kampanya başı ₺150 ödemeli. Prototipte ödeme yok; paketler sadece gösterim
- Kampanyaları yarıçap içindeki kullanıcılara gerçek push bildirimi olarak göndermek (şu an sadece uygulama içinde görünür)

**Uygulama**
- Mekanların gerçek fotoğrafları (şu an türe göre renkli görsel) ve kalıcı logo
- Ayrı mekan detay sayfası (şu an haritadaki bilgi kartı)
- "Kalabalık" kırmızısı marka kırmızısıyla karışabilir; istenirse koyu turuncu

**Tanıtım sitesi**
- Uygulamanın web sitesi (ör. ana sayfa + işletmeler için ayrı sayfa):
  - Uygulama bilgisi: ne işe yarar, nasıl çalışır, ekran görüntüleri, indirme bağlantıları
  - Kullanıcıların neler yapabildiği: anlık doluluk, filtreler, alternatif önerileri, kampanyalar, favoriler
  - İşletmeler için: panel, ölü saat kampanyaları, istatistikler, nasıl katılınır / başvuru formu
  - Abonelikler ve fiyatlar: SaaS ₺1.899/ay, kampanya başı ₺150, B2C Premium ₺79/ay
  - İşbirlikleri ve ortaklıklar (ör. Getir/Trendyol kuponları, kampüs elçileri), iletişim, KVKK/gizlilik metni

**Proje dokümanında olup henüz yapılmayanlar**
- B2C Premium (₺79/ay): reklamsız, "X boşalınca haber ver" bildirimleri; ücretsiz katmanda konuma dayalı reklam
- Mikro rezervasyon (masa tutma + ön sipariş, %15 komisyon)
- Sadakat puanları (doğrulama/check-in ile puan, mekanlar arası ortak)
- Açılışta Google Maps "Popular Times" verisiyle başlangıç (cold start)
- Not: Dokümanın 8. bölümü Flutter/AWS/Redis diyor; prototip React Native (Expo) + FastAPI + PostGIS
