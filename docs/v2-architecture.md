# availy v2: check-in ile doluluk (mimari plan, taslak)

Durum: onaylandı (Aşama 2'den itibaren aşama aşama ilerleniyor).

v1 `v1` etiketinde ve `main` dalında olduğu gibi kalır (web demosu: erayerb.github.io/availy.app).
v2 `v2-checkin` dalında geliştirilir ve hiçbir zaman `main`'e alınmaz; hazır olunca ayrı adreste yayınlanır
(ör. erayerb.github.io/availy.app/v2/).

## 1. Fikir
v1'de doluluk sahte üretiliyordu (gerçekte mekanın Wi-Fi verisi gerekecekti). v2'de doluluğu mekanda
bulunan kullanıcılar bildirir: önce mekanın ne kadar dolu olduğunu işaretler, sonra check-in yapar
(Swarm / Foursquare benzeri). Her check-in hem bir ziyaret kaydı hem bir doluluk bildirimidir.

Sıra: önce müşteri tarafı, sonra işletme tarafı v2'ye uyarlanır.

## 2. Bileşenler
| Bileşen | v1'den farkı |
|---|---|
| `mobile/` (Expo) | Harita, ana sayfa, detay ve sekmeler kalır. Doluluk sunucudaki check-in'lerden gelir; check-in ekranı eklenir; hesaplar sunucuya taşınır |
| `backend/` (FastAPI) | Kullanıcılar, oturum, check-in tabloları ve uç noktaları eklenir; doluluk check-in'lerden hesaplanır |
| PostgreSQL + PostGIS | `users`, `sessions`, `checkins`, `points` tabloları; 150 m kontrolü PostGIS ile |

v2 baştan sunucu ister: check-in'ler herkesin telefonuna gitmeli.
- Önce: Mac'teki backend, telefonlar aynı Wi-Fi'de Expo Go ile bağlanır (iki telefonla deneme)
- Sonra: backend ve veritabanı internete (ör. Render + Neon); v2 web demosu ancak bundan sonra çalışır

## 3. Check-in akışı (müşteri)
Mekan detay sayfasında ve haritadaki kartta "Check-in" bölümü:
1. "Şu an burası nasıl?" → **Sakin / Orta / Kalabalık** (biri seçilmeden Check-in butonu kapalı)
2. Ek soru, seçime göre:
   - Kalabalık → "Sıra var mı?" (Evet / Hayır)
   - Orta → "Oturacak yer var mı?" (Evet / Hayır)
   - Sakin → ek soru yok
3. **Check-in** butonu açılır → konum izni yoksa yeniden istenir (reddedilirse "Check-in için konum izni gerekli")
   → telefon konumu alınır → sunucu doğrular → "Check-in yapıldı · +10 puan"
   (mekanın ilk check-in'iyse "İlk check-in senin! · +50 puan · Kâşif rozeti")

Seçim ekranının biçimi yüzde kararına bağlı (13. bölüm): Sakin / Orta / Kalabalık düğmeleri ya da yüzde düğmeleri.

Konum izni: uygulama açılışında istenir (harita, "En yakın", check-in). Verilmediyse gereken yerde (check-in,
"En yakın" sıralaması, haritada "Konumum") tekrar istenir. iOS bir kez reddedilen izni bir daha sormaz; o durumda
"Ayarlar'dan konum iznini aç" düğmesi telefonun ayarlarını açar.

Hata mesajları: "Check-in için mekana 150 m'den yakın olmalısın", "Bu mekana az önce check-in yaptın", "Giriş yapmalısın".

## 4. Doluluk hesabı
Son 90 dakikadaki check-in'ler kullanılır; yeni bildirim daha ağır basar.
- Seviye puanı: Sakin = 0.2, Orta = 0.55, Kalabalık = 0.9
- Ağırlık = yaş ağırlığı × kullanıcı güveni; yaş ağırlığı yarılanma süresi 30 dk (`0.5 ^ (dakika / 30)`)
- Ağırlıklı ortalama → v1 eşikleriyle seviye: < 0.40 Sakin, ≤ 0.75 Orta, üstü Kalabalık
- Aynı kullanıcının penceredeki yalnızca son bildirimi sayılır
- Ek bilgi: son Kalabalık bildirimlerinin çoğu "sıra var" diyorsa "Sıra var"; Orta bildirimlerinde "Oturacak yer var / yok"

Mekanın dört durumu:
| Durum | Ne zaman | Görünüm |
|---|---|---|
| `live` | Son 90 dk'da en az 1 bildirim | Seviye rengi + "Son bildirim 12 dk önce · 4 kişi" |
| `stale` | Bildirim var ama 90 dk'dan eski | Gri nokta + "Son bildirim 3 saat önce" |
| `unexplored` | Hiç check-in almamış | Ayrı simge (✨) + "İlk check-in'i sen yap, +50 puan" |
| kapalı | Çalışma saati dışında | v1'deki gibi gri, "08:00'de açılır" |

Hesap tek bir saf fonksiyonda (`crowd_from_checkins`) olur; test edilmesi kolay, ileride modeli değiştirmek tek yerde.

## 5. Hile koruması
- Giriş zorunlu, ama misafir de sayılır: "Kayıt olmadan devam et" sunucuda otomatik bir misafir hesabı açar
  (yalnızca id, adı "Misafir 12"). Misafir check-in yapabilir, puan kazanır; bildirimi daha az sayılır (güven 0.5).
  Sonradan kayıt olursa aynı id kalır, check-in'leri ve puanları korunur, güveni 1'e çıkar.
  Bu kullanıcıya açıkça söylenir: check-in ekranında "Misafir check-in'leri daha az sayılır. Kayıt olursan tam sayılır
  ve puanların korunur." ve bir "Kayıt ol" bağlantısı
- Saatlik sınır: kayan 60 dakika (her an son 60 dakikadaki check-in'ler sayılır)
- Mesafe: check-in anında gönderilen konum mekana ≤ 150 m olmalı (`ST_DWithin`); konum kontrol edilir, **saklanmaz**
- Bekleme: aynı kullanıcı aynı mekana 2 saatte bir check-in yapabilir;
  toplamda saatte en fazla 10 check-in. Amaç: tek kişinin aynı yerde art arda check-in yapıp hem "4 kişi" sayısını
  şişirmesini hem puan toplamasını engellemek
- Güven puanı (0.2–1, başlangıç 1): bir bildirim, aynı mekana ±30 dk içindeki diğer bildirimlerle sürekli
  çelişiyorsa kullanıcının güveni düşer, uyuşuyorsa yavaşça yükselir. Düşük güvenli kullanıcının bildirimi
  hesapta az etki eder (ör. rakibini hep "Kalabalık" gösteren işletme)
- İlk check-in ödülü yalnızca mesafe kontrolünü geçen check-in'e verilir

## 6. İlk check-in ödülü ve puan
- Hiç check-in almamış mekan haritada ✨ simgesiyle durur; amaç kullanıcıların yeni yerleri "keşfetmek" için gitmesi
- İlk geçerli check-in: +50 puan ve "Kâşif" rozeti; mekan detayında 30 gün "Burayı Eray keşfetti" yazar (yalnızca ad)
- Her check-in: +10 puan (availy puanı v1'deki gibi birikir; harcama yerleri yapılacaklarda)
- Puanlar `points` tablosunda hareket olarak tutulur (neden + tarih); toplam buradan hesaplanır

## 7. Veri modeli (ilk taslak)
- `users(id, email UNIQUE NULL, name, password_hash NULL, role, venue_id, plan, trust REAL DEFAULT 1, is_guest, created_at)`
  — misafirde e-posta ve şifre yok; oturumu 365 gün geçerli (şifresi olmadığı için yeniden giriş yapamaz)
  - şifre sunucuda scrypt ile hash'lenir (Python'un kendi `hashlib.scrypt`'i; ek paket yok)
- `sessions(token_hash, user_id, expires_at)` — uygulama rastgele bir oturum anahtarı saklar, sunucu yalnızca hash'ini
- `checkins(id, venue_id, user_id, level, queue BOOLEAN NULL, seats BOOLEAN NULL, is_first BOOLEAN, created_at)`
  - konum sütunu yok; indeksler `(venue_id, created_at)` ve `(user_id, venue_id, created_at)`
- `points(id, user_id, amount, reason, checkin_id NULL, created_at)`
- KVKK: check-in kullanıcıya bağlı (bekleme ve güven için gerekli). 30 günden eski check-in'lerde `user_id`
  silinir (anonimleşir); hesap silinince kullanıcının check-in'leri anonimleşir, puanları silinir

## 8. API (v2)
| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/v1/auth/register` | Ad, e-posta, şifre, hesap türü → oturum anahtarı |
| POST | `/v1/auth/login` | E-posta, şifre (ve seçilen hesap türü) → oturum anahtarı |
| POST | `/v1/auth/guest` | Misafir hesabı açar (otomatik id) → oturum anahtarı |
| POST | `/v1/auth/upgrade` | Misafir kayıt olur: ad, e-posta, şifre; aynı id kalır |
| POST | `/v1/auth/logout` | Oturumu kapatır |
| GET | `/v1/me` | Profil, toplam puan, rozetler |
| POST | `/v1/venues/{id}/checkins` | `{level, queue?, seats?, lat, lon}` (giriş gerekli) → check-in, kazanılan puan, ilk mi |
| GET | `/v1/me/checkins` | Kendi check-in geçmişim |
| GET | `/v1/venues?bbox=…` | v1'deki gibi + `crowd: {state, level, ratio, reporters, last_report_at, queue, seats}`; v1'in `occupancy` alanı uygulama v2'ye geçince (Aşama 6) kalkar |
| GET | `/v1/venues/search` | Aynı değişiklikle |

## 9. Mobilde değişenler
- `Venue` tipi: `occupancy` → `crowd`; nokta ve kartlar dört durumu gösterir (yüzde yerine seviye + kişi sayısı)
- Detay sayfası ve harita kartı: check-in bölümü (3. bölüm)
- Hesaplar: telefondaki prototip hesaplar yerine sunucu hesabı; oturum anahtarı telefonda saklanır
- Ana sayfa sıralaması: "En sakin" yalnızca `live` mekanları sıralar; "Kapalıları gizle" kalır
- Şimdilik kaldırılan / bekleyen (v1 sahte veriye dayanıyordu): tahmini boşalma, "boşalınca haber ver"
  (v2'de "Sakin olunca haber ver" olacak), işletme panelindeki saatlik grafik ve istatistikler.
  Check-in verisi biriktikçe geçmişe dayalı haliyle geri gelir (yapılacaklarda)
- İşletme kısmı (kampanya, kupon, sadakat) ilk aşamada v1'deki gibi telefonda kalır; müşteri tarafı bitince
  sunucuya taşınır ve check-in ile bağlanır (ör. "check-in yapana %10")

## 10. Web demosu (v2)
GitHub Pages bir repoda tek site yayınlar. v2 hazır olunca yayın işi iki sürümü birlikte derler:
`v1` etiketi ana adrese, `v2-checkin` dalı `/v2/` altına. v2 demosu internetteki backend'e bağlanır
(sahte veriyle çalışan v1 demosu gibi sunucusuz olamaz).

## 11. Pilot bölge ve demo verisi
- Pilot: Nişantaşı, Caddebostan, Yeditepe Üniversitesi kampüsü ve çevresi; demo mekanlar bu üç bölgede toplanır
  (Yeditepe çevresine yeni demo mekanlar eklenir)
- Demo check-in'leri: az kullanıcıyla haritanın dolu görünmesi için sunucu "demo" işaretli sahte check-in'ler üretir;
  gerçek check-in'lerle karışmaz, ayarla kapatılabilir; bazı mekanlar bilerek ✨ keşfedilmemiş bırakılır

## 12. Aşamalar
1. Bu planın onayı
2. Backend: `users`, `sessions`, kayıt / giriş / `me` + testler
3. Backend: `checkins` + check-in uç noktası (giriş, 150 m, bekleme, saatlik sınır) + testler
4. Backend: doluluk hesabı (`crowd_from_checkins`) + `/v1/venues` çıktısı + testler
5. Mobil: sunucu hesabıyla giriş / kayıt
6. Mobil: check-in akışı, haritada ve listelerde dört durum
7. İlk check-in ödülü, puan, Kâşif rozeti
8. Güven puanı
9. İki telefonla deneme (Mac backend, aynı Wi-Fi)
10. Backend'i internete koyma + v2 web demosu (`/v2/`)
11. İşletme tarafını v2'ye uyarlama

## 13. Kararlar
- Puan: check-in 10, mekanın ilk check-in'i 50 (şimdilik)
- Doluluk hesabı son 90 dakikanın check-in'lerini kullanır
- Aynı kullanıcı aynı mekana 2 saatte bir check-in yapabilir
- Yüzde: kullanıcı Sakin / Orta / Kalabalık seçer. Son 90 dk'da en az 3 kişi bildirdiyse ağırlıklı ortalamadan
  hesaplanan yüzde de gösterilir ("~%60"), daha azsa yalnızca seviye
- "Burayı X keşfetti" 30 gün görünür
- Demo check-in'leri üretilir; pilot bölge Nişantaşı + Caddebostan + Yeditepe kampüsü ve çevresi

## 14. Sonraki sürümler için (sosyal)
- Check-in'i paylaş: check-in ekranında "Arkadaşlarımla paylaş" anahtarı (son seçim hatırlanır). Paylaşılan check-in
  arkadaşların ana ekranındaki akışta görünür ("Ayşe 10 dk önce Moda Kahve Evi'nde · Sakin"); isteyen arkadaş için
  bildirim de gider (arkadaş başına aç / kapat). Paylaşılmayan check-in hiçbir arkadaşa görünmez. Uygulama dışına
  (WhatsApp vb.) paylaşma v1'deki ⤴ düğmesiyle zaten var
- Arkadaşlar: kullanıcı izin verirse arkadaşları onun check-in'lerini görür (izin kullanıcıda; varsayılan kapalı)
- Liderlik tablosu: herkese açık (puana göre; haftalık ve tüm zamanlar)
- Mekan yorumları ve geri bildirim (v1'deki puan + yorum sunucuya taşınır); diğer kullanıcılar yorumlara cevap
  verebilir, yorum sahibi buna izin verdiyse
