/**
 * Gizlilik politikası (KVKK aydınlatma metni) and kullanım koşulları, shown in Daha fazla > Kullanım koşulları.
 * GENERATED from docs/hukuk/gizlilik-politikasi.md and docs/hukuk/kullanim-kosullari.md (edit those, then
 * regenerate): a DRAFT, to be checked by a lawyer and its bracketed company details filled in before the release.
 */
export type LegalSection = { title: string; paragraphs: string[] };
export type LegalDoc = { id: 'privacy' | 'terms'; title: string; updated: string; sections: LegalSection[] };

const UPDATED = '25 Kasım 2026 (taslak)';

export const PRIVACY_POLICY: LegalDoc = {
  id: 'privacy',
  title: 'Gizlilik politikası',
  updated: UPDATED,
  sections: [
    {
      title: "1. Veri Sorumlusu ve Kapsam",
      paragraphs: [
        "6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla [Şirket unvanı] (\"availo\", \"biz\") tarafından bu metinde açıklanan kapsamda işlenmektedir.",
        "• Adres: [Şirket adresi]",
        "• MERSİS No: [MERSİS numarası]",
        "• E-posta: [iletişim e-postası]",
        "• KEP adresi: [KEP adresi]",
        "Bu metin; availo mobil uygulamasını, availo web sitesini (tanıtım sayfaları dahil) ve bunlar aracılığıyla sunulan hizmetleri (\"Hizmet\") kapsar; bireysel kullanıcılar, misafir kullanıcılar, işletme hesabı kullanıcıları ve web sitesindeki bekleme listesine kayıt olanlar için geçerlidir. Kişisel verilerin korunmasına ilişkin genel ilkelerimiz [Kişisel Verilerin İşlenmesi ve Korunması Politikası] içinde ayrıca yer almaktadır.",
        "Bu metin bir sözleşme değildir ve kabul edilmesi gerekmez; açık rızanızın gerektiği durumlarda rızanız ayrıca ve isteğe bağlı olarak alınır.",
      ],
    },
    {
      title: "2. İşlenen Kişisel Veriler",
      paragraphs: [
        "Kimlik — Kullanıcı adı",
        "İletişim — E-posta adresi; destek ve bekleme listesi için verdiğiniz e-posta veya Instagram kullanıcı adı",
        "Hesap — Hesap numarası, hesap türü (bireysel / işletme / misafir), oluşturma tarihi, şifrenin geri döndürülemez özeti, oturum anahtarlarının özeti, geçici doğrulama ve şifre sıfırlama kodları",
        "Lokasyon — Check-in ve yakındaki mekanlar / ödüller için anlık konum (saklanmaz); haritada seçtiğiniz nokta ve aradığınız yer adı",
        "Müşteri işlem — Check-in'ler (mekan, tarih-saat, doluluk bildirimi, gizlilik tercihi, not), yorumlar, puanlamalar, yanıtlar, beğeniler, favoriler, listeler, takipler, puan, puan harcamaları, rozet, seviye, seri, sıralama, müdavimlik, kupon ve sadakat kartı işlemleri, eklediğiniz mekanlar ve \"Bilgi yanlış mı?\" bildirimleri",
        "Sosyal — Arkadaşlıklar, gruplar, engellenen ve sessize alınan kullanıcılar, sizi davet eden kullanıcı",
        "Görsel kayıt — Profil ve kapak fotoğrafı, \"Şu an burada\" fotoğrafları, işletmelerin yüklediği mekan fotoğrafları",
        "İşlem güvenliği — IP adresi, istek kayıtları, cihazın bildirim adresi (push token), işletim sistemi (iOS / Android), uygulama sürümü, hatalı giriş denemeleri, şikâyet ve moderasyon kayıtları",
        "Talep / şikâyet — Destek, hata bildirimi ve iletişim mesajları, kişisel veri başvuruları",
        "Pazarlama — Ticari elektronik ileti onayı ve tercihleri",
        "Finans — Abonelik ve paket durumu, fatura bilgileri (kart bilgileri ödeme kuruluşlarında kalır, availo'ya iletilmez)",
        "İşletme — İşletme hesabını kullanan kişinin hesap bilgileri, bağlı mekan, mekan bilgileri (ad, adres, konum, saatler, telefon, Instagram, açıklama), kampanya ve ödül kayıtları",
        "Hukuki işlem — Yetkili kurumlarla yazışmalar, uyuşmazlık ve başvuru dosyaları",
        "Konum hakkında:",
        "• Check-in sırasında konumunuz yalnızca mekana yakın olduğunuzu doğrulamak için o an kullanılır ve saklanmaz; kaydedilen yalnızca check-in yaptığınız mekandır.",
        "• Konum, yalnızca uygulama açıkken ve cihaz izninizle kullanılır. Arka planda konum toplanmaz, konum geçmişiniz tutulmaz ve canlı konumunuz kimseyle paylaşılmaz.",
        "• Check-in önerileri telefonunuzda hesaplanır.",
        "Özel nitelikli veriler: availo, KVKK'nın 6. maddesindeki özel nitelikli kişisel verileri (sağlık, din, siyasi görüş vb.) işlemeyi amaçlamaz. Mekan türleri kafe, restoran, bar, kütüphane ve ortak çalışma alanı gibi yerlerle sınırlıdır; kullanıcılar da yalnızca bu türlerde mekan ekleyebilir. Yorum ve notlarınızda bu tür bilgileri paylaşmamanızı rica ederiz.",
        "\"Şu an burada\" fotoğrafları: Fotoğraf gönderilmeden önce telefonunuzda yeniden kodlanır; içindeki konum (GPS) ve cihaz (EXIF) bilgileri silinir.",
      ],
    },
    {
      title: "3. Kişisel Verilerin Toplanma Yöntemi",
      paragraphs: [
        "Kişisel verileriniz;",
        "• uygulama ve web sitesindeki formlar, check-in, yorum, fotoğraf ve diğer işlemler aracılığıyla doğrudan sizden,",
        "• cihazınızın izin verdiğiniz özellikleri (konum, kamera, bildirimler) aracılığıyla,",
        "• Hizmeti kullanırken sunucularımızda kendiliğinden oluşan kayıtlardan,",
        "• App Store / Google Play ve ödeme kuruluşlarından (yalnızca abonelik ve ödeme durumu)",
        "tamamen veya kısmen otomatik yollarla toplanır.",
      ],
    },
    {
      title: "4. İşleme Amaçları ve Hukuki Sebepler",
      paragraphs: [
        "Hesabın oluşturulması, oturum açma, e-posta doğrulama, şifre sıfırlama — Kimlik, iletişim, hesap — Sözleşmenin kurulması ve ifası (m.5/2-c)",
        "Check-in'in mekanda yapıldığının doğrulanması ve doluluğun hesaplanıp gösterilmesi — Lokasyon, müşteri işlem — Sözleşmenin ifası (m.5/2-c)",
        "Puan, rozet, seviye, seri, sıralama, kupon, ödül ve sadakat kartlarının yönetimi — Müşteri işlem — Sözleşmenin ifası (m.5/2-c)",
        "Arkadaşlık, akış, gruplar ve sosyal bildirimler — Kimlik, sosyal, müşteri işlem, görsel — Sözleşmenin ifası (m.5/2-c)",
        "Hizmetle ilgili telefon bildirimleri (arkadaş etkinliği, takip ettiğiniz mekan vb.) — İşlem güvenliği (push token), müşteri işlem — Sözleşmenin ifası (m.5/2-c)",
        "Mekanların kampanyalarına ilişkin ticari bildirimler — İletişim, pazarlama, müşteri işlem — Ticari elektronik ileti onayı (6563 sayılı Kanun); açık rıza (m.5/1)",
        "Sahte check-in, puan ve kampanya istismarının, dolandırıcılığın önlenmesi; güvenlik — Lokasyon, müşteri işlem, işlem güvenliği — Meşru menfaat (m.5/2-f)",
        "İçerik moderasyonu, şikâyetlerin incelenmesi — Müşteri işlem, görsel, sosyal — Meşru menfaat (m.5/2-f); hukuki yükümlülük (m.5/2-ç)",
        "İşletmelere anonim istatistik ve kampanya sonuçlarının sunulması — Müşteri işlem (anonim) — Meşru menfaat (m.5/2-f)",
        "Ücretli hizmetlerin sunulması, faturalandırma, muhasebe — Finans, iletişim, işletme — Sözleşmenin ifası (m.5/2-c); kanunlarda öngörülme (m.5/2-a); hukuki yükümlülük (m.5/2-ç)",
        "Destek taleplerinin ve kişisel veri başvurularının yanıtlanması — Talep / şikâyet, iletişim — Sözleşmenin ifası (m.5/2-c); hukuki yükümlülük (m.5/2-ç)",
        "Hizmetin geliştirilmesi için toplu analiz — Müşteri işlem, işlem güvenliği — Meşru menfaat (m.5/2-f)",
        "Bekleme listesine yazılanlara uygulama yayına girince haber verilmesi — İletişim — Açık rıza (m.5/1)",
        "Yetkili makamların taleplerinin karşılanması; uyuşmazlıklarda hakların korunması; kayıtların saklanması — Tüm ilgili veriler, hukuki işlem — Kanunlarda öngörülme (m.5/2-a); hukuki yükümlülük (m.5/2-ç); hakkın tesisi, kullanılması veya korunması (m.5/2-e)",
        "Kişisel verileriniz satılmaz ve reklam amacıyla üçüncü kişilerle paylaşılmaz. Hakkınızda yalnızca otomatik işlemeye dayanan ve sizi hukuken etkileyen bir karar verilmez. Check-in'lerin güvenilirliğini değerlendiren otomatik \"güven puanı\" yalnızca doluluk hesaplamasında bildirimlerin ağırlığını belirler.",
      ],
    },
    {
      title: "5. Kişisel Verilerin Aktarılması",
      paragraphs: [
        "5.1. Diğer kullanıcılar ve işletmeler:",
        "Herkes şunları görebilir:",
        "• Kullanıcı adınız, profil fotoğrafınız ve seviyeniz.",
        "• Mekan yorumlarınız ve yanıtlarınız.",
        "• Gizli olmayan ilk check-in'leriniz için \"Burayı @kullanıcıadı keşfetti\" yazısı.",
        "• Herkese açık sıralamada görünmeyi seçtiyseniz puanınız.",
        "• Müdavimliğinizi herkese açık bıraktıysanız müdavimi olduğunuz mekanlar. Kapalıysa yine müdavim sayılırsınız; ancak arkadaşınız olmayanlar adınız yerine \"Gizli müdavim\" görür.",
        "Arkadaşlarınız şunları görebilir:",
        "• Gizli olmayan check-in'leriniz (mekan ve zaman; canlı konum asla).",
        "• Check-in yaptığınız ve keşfettiğiniz mekanlar.",
        "• Seriniz ve (ayarınıza göre) istatistikleriniz.",
        "İşletmeler şunları görebilir:",
        "• Mekanlarına ilişkin, kimliğinizi içermeyen toplu istatistikler.",
        "• Mekana yazdığınız yorum, kullanıcı adınızla birlikte.",
        "Kupon veya sadakat kartı kullandığınızda işletme kimliğinizi görmez; yalnızca kod doğrulanır.",
        "Gizli check-in'leriniz kimseye gösterilmez. Görünürlük tercihlerinizi Gizlilik ayarlarından değiştirebilirsiniz.",
        "5.2. Üçüncü kişilere aktarım:",
        "Altyapı ve barındırma hizmet sağlayıcıları (Render Services, Inc.; Neon, Inc.; GitHub, Inc.) — Hizmet kapsamındaki tüm veriler — Uygulama sunucusu, veritabanı, web sitesi — Sözleşmenin ifası (m.5/2-c); meşru menfaat (m.5/2-f)",
        "E-posta hizmet sağlayıcısı (Resend, Inc.) — E-posta adresi, doğrulama kodu — Doğrulama ve şifre sıfırlama e-postaları — Sözleşmenin ifası (m.5/2-c)",
        "Bildirim altyapısı (Expo / 650 Industries, Inc.; Apple Inc.; Google LLC) — Push token, bildirim içeriği — Telefon bildirimlerinin iletilmesi — Sözleşmenin ifası (m.5/2-c)",
        "Harita ve adres hizmetleri (Apple Inc.; Google LLC; OpenStreetMap Vakfı – Nominatim; komoot GmbH – Photon) — Haritada görüntülenen alan, seçilen nokta, aranan yer adı (Photon'a sunucumuz üzerinden, kimliğiniz ve IP adresiniz olmadan; yaklaşık bölge ile) — Harita gösterimi, adres ve yer bulma — Sözleşmenin ifası (m.5/2-c)",
        "Uygulama mağazaları (Apple Inc.; Google LLC) — Abonelik durumu — availo+ aboneliğinin yönetimi — Sözleşmenin ifası (m.5/2-c)",
        "Ödeme kuruluşu ([ödeme kuruluşu]) — Fatura ve ödeme bilgileri — İşletme paketlerinin ödemesi — Sözleşmenin ifası (m.5/2-c); hukuki yükümlülük (m.5/2-ç)",
        "Yetkili kamu kurum ve kuruluşları, adli makamlar — Talep edilen veriler — Hukuki yükümlülüklerin yerine getirilmesi — Kanunlarda öngörülme (m.5/2-a); hukuki yükümlülük (m.5/2-ç)",
        "Olası pay devri, birleşme, devralma veya varlık devrinde taraflar — Gerekli veriler — Hizmetin devamlılığı ve devir süreçlerinin yürütülmesi — Meşru menfaat (m.5/2-f); gerekiyorsa açık rıza",
        "5.3. Yurt dışına aktarım:",
        "Sunucularımız ve veritabanımız Almanya'da (Frankfurt) bulunmaktadır. Bazı hizmet sağlayıcılarımız ABD'de yerleşiktir. Bu nedenle kişisel verileriniz yurt dışına aktarılmaktadır.",
        "Aktarım, KVKK'nın 9. maddesi ve Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik uyarınca yapılır. Dayanak, uygun güvencelerden biri (ör. Kurul'un ilan ettiği standart sözleşmenin imzalanıp Kurum'a bildirilmesi) veya arızi aktarım hallerinden biridir. [Hukukçu: her sağlayıcı için aktarım dayanağı netleştirilmeli.]",
      ],
    },
    {
      title: "6. Saklama Süreleri",
      paragraphs: [
        "Hesap, sosyal ve müşteri işlem verileri — Hesap açık olduğu sürece; hesap silinince en geç 30 gün içinde silinir veya anonim hale getirilir",
        "Check-in'ler — Hesap silinince kimliğinizden ayrılarak yalnızca anonim doluluk istatistiği olarak kalır",
        "Check-in sırasındaki konum — Saklanmaz",
        "\"Şu an burada\" fotoğrafları — Mekan kapandıktan 1 saat sonra; 24 saat açık mekanlarda 24 saat sonra silinir",
        "Oturum anahtarları — En fazla 30 gün; misafir hesapta 365 gün",
        "Doğrulama ve şifre sıfırlama kodları — 15 dakika",
        "Uygulama içi bildirimler — 30 gün",
        "İşlem güvenliği kayıtları — [5651 sayılı Kanun ve ilgili mevzuata göre belirlenecek süre]",
        "Destek ve iletişim mesajları — [Süre, ör. 2 yıl]",
        "Bekleme listesi — Uygulama yayına girip bilgilendirme yapılana kadar, en fazla [süre]",
        "Fatura ve muhasebe kayıtları — 10 yıl (6102 sayılı TTK m.82; 213 sayılı VUK)",
        "Süresi dolan veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca periyodik olarak silinir, yok edilir veya anonim hale getirilir.",
      ],
    },
    {
      title: "7. Veri Güvenliği",
      paragraphs: [
        "Kişisel verilerinizin güvenliği için aşağıdaki teknik ve idari tedbirleri alıyoruz:",
        "• Şifreleri ve oturum anahtarlarını özetleyerek saklıyoruz.",
        "• Sunucuyla iletişim şifreli (HTTPS) yapılır.",
        "• Fotoğraflardaki konum ve cihaz bilgileri gönderilmeden önce silinir.",
        "• Verilere yalnızca yetkili kişiler erişebilir.",
        "• İstek sınırlamaları ve hatalı giriş denemelerine karşı koruma uygulanır.",
        "Bir veri ihlali halinde Kurul'a ve etkilenen kişilere mevzuatta öngörülen sürede bildirim yapılır.",
      ],
    },
    {
      title: "8. Çocuklar",
      paragraphs: [
        "availo 13 yaşından küçükler için değildir ve bilerek 13 yaşından küçüklerden veri toplanmaz. 18 yaşından küçükler Hizmeti yasal temsilcilerinin bilgisi ve onayıyla kullanmalıdır. Ücretli hizmetler 18 yaşını doldurmuş olmayı gerektirir. [Hukukçu: yaş sınırı netleştirilmeli.]",
      ],
    },
    {
      title: "9. Haklarınız (KVKK m.11)",
      paragraphs: [
        "KVKK'nın 11. maddesi uyarınca veri sorumlusuna başvurarak:",
        "• Kişisel verilerinizin işlenip işlenmediğini öğrenme,",
        "• İşlenmişse buna ilişkin bilgi talep etme,",
        "• İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,",
        "• Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,",
        "• Eksik veya yanlış işlenmişse düzeltilmesini isteme,",
        "• KVKK'nın 7. maddesindeki şartlar çerçevesinde silinmesini veya yok edilmesini isteme,",
        "• Düzeltme, silme ve yok etme işlemlerinin, verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,",
        "• Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme,",
        "• Kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme",
        "haklarına sahipsiniz.",
        "Uygulama içinden: Profil ayarları'ndan verilerinizin bir kopyasını indirebilir, bilgilerinizi düzeltebilir, hesabınızı dondurabilir veya silebilirsiniz. Gizlilik, bildirim ve konum izinlerinizi istediğiniz zaman değiştirebilir ve verdiğiniz açık rızaları geri alabilirsiniz.",
        "Başvuru: Diğer talepleriniz için, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca:",
        "• availo hesabınıza kayıtlı e-posta adresinden [iletişim e-postası] adresine,",
        "• KEP adresiniz üzerinden [KEP adresi] adresine,",
        "• veya kimliğinizi gösteren belgelerle birlikte yazılı olarak adresimize",
        "başvurabilirsiniz. Başvurunuz en geç 30 gün içinde sonuçlandırılır. İşlemin ayrıca bir maliyet gerektirmesi halinde Kurul'un belirlediği tarife uygulanabilir. Başvurunuzun reddedilmesi, cevabın yetersiz bulunması veya süresinde cevap verilmemesi halinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz.",
      ],
    },
    {
      title: "10. Çerezler ve Benzeri Teknolojiler",
      paragraphs: [
        "Mobil uygulama reklam veya izleme amaçlı çerez ya da benzeri teknoloji kullanmaz. Oturumunuzun açık kalması ve ayarlarınızın hatırlanması için cihazınızda zorunlu bilgiler saklanır.",
        "Web sitemiz çerez, analiz veya reklam aracı kullanmaz; yazı tipleri ve simgeler de kendi sunucumuzdan yüklenir, bu nedenle ziyaretiniz üçüncü taraflara iletilmez. Formlara yazdığınız bilgiler yalnızca formu gönderdiğinizde sunucumuza iletilir.",
      ],
    },
    {
      title: "11. Değişiklikler",
      paragraphs: [
        "Bu metni güncelleyebiliriz. Önemli değişiklikleri uygulama içinde ve/veya e-posta ile duyururuz. Güncel metin her zaman uygulamada ve web sitemizde yer alır.",
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  id: 'terms',
  title: 'Kullanım koşulları',
  updated: UPDATED,
  sections: [
    {
      title: "1. Tanımlar",
      paragraphs: [
        "• availo: [Şirket unvanı] ([adres], MERSİS: [numara]).",
        "• Hizmet: availo mobil uygulaması, web sitesi ve bunlar üzerinden sunulan tüm özellikler.",
        "• Kullanıcı: Hizmeti bireysel, misafir veya işletme hesabıyla kullanan kişi.",
        "• İşletme: Hizmette listelenen bir mekanı temsil eden ve işletme hesabı açan gerçek veya tüzel kişi.",
        "• Check-in: Kullanıcının bir mekanda bulunduğunu ve oradaki doluluğu Hizmet üzerinden bildirmesi.",
        "• Kullanıcı İçeriği: Kullanıcının Hizmete yüklediği yorum, puanlama, yanıt, not, fotoğraf, mekan bilgisi ve benzeri içerik.",
        "• Puan: Hizmet içinde kazanılan ve yalnızca Hizmet içinde kullanılabilen, parasal değeri olmayan sanal birim.",
        "• Kampanya, kupon, kalıcı ödül, sadakat programı: İşletmelerin Hizmet üzerinden kullanıcılara sunduğu indirim ve avantajlar.",
      ],
    },
    {
      title: "2. Kabul ve Kapsam",
      paragraphs: [
        "2.1. Hizmeti kullanarak veya hesap oluşturarak bu Koşulları kabul etmiş olursunuz. Kabul etmiyorsanız Hizmeti kullanmayınız.",
        "2.2. Kişisel verilerinizin işlenmesine ilişkin bilgiler, ayrı bir metin olan Gizlilik Politikası ve Aydınlatma Metni'nde yer alır. Aydınlatma metni bu Koşulların parçası değildir ve kabul edilmesi gerekmez.",
        "2.3. Bölüm A tüm kullanıcılara; Bölüm B bireysel kullanıcılara; Bölüm C işletme hesaplarına; Bölüm D ücretli hizmetlere uygulanır. Belirli bir kampanya veya özellik için ayrıca ilan edilen kurallar, o konuda bu Koşullardan önce gelir.",
      ],
    },
    {
      title: "3. Hizmetin Niteliği",
      paragraphs: [
        "3.1. availo, mekanların anlık doluluğunu kullanıcıların check-in'lerinden derleyerek gösteren, kullanıcılara puan, rozet ve ödül kazandıran ve işletmelerin kampanya ve ödül sunmasına aracılık eden bir platformdur.",
        "3.2. Doluluk bilgisi kullanıcı bildirimlerine dayanır. Doğru, eksiksiz veya güncel olduğu garanti edilmez. Mekan bilgileri (ad, adres, çalışma saatleri, özellikler) OpenStreetMap gibi açık kaynaklardan, kullanıcılardan ve işletmelerden derlenir ve hatalı olabilir.",
        "3.3. availo, mekanlarda sunulan ürün ve hizmetlerin satışına taraf değildir. Ürünlerin içeriği, kalitesi, fiyatı, alerjen bilgisi, hijyeni ve kampanya koşullarının yerine getirilmesi ilgili işletmenin sorumluluğundadır. Bu konulardaki sorularınızı doğrudan işletmeye iletmeniz gerekir.",
      ],
    },
    {
      title: "4. Hesap",
      paragraphs: [
        "4.1. Hesap bilgilerinizin doğru ve güncel olması gerekir. Kullanıcı adınız herkese görünür; başkasını taklit eden, başkasına ait bir ad veya markayı izinsiz kullanan, yanıltıcı veya uygunsuz kullanıcı adları kaldırılabilir.",
        "4.2. Şifrenizin ve hesabınızın güvenliğinden siz sorumlusunuz. Hesabınızı başkasıyla paylaşamaz, başkasının hesabını kullanamazsınız. Yetkisiz kullanımı fark ederseniz derhal şifrenizi değiştirmeli ve bize bildirmelisiniz.",
        "4.3. Bir kişi yalnızca bir bireysel hesap açabilir. Askıya alınan veya kapatılan bir hesabın yerine yeni hesap açılması yasaktır.",
        "4.4. Misafir hesap: Kayıt olmadan kullanılan misafir hesap cihaza bağlıdır; bazı özellikler kısıtlıdır ve puanlar yarı oranda kazanılır. Uygulama silinirse veya cihaz değişirse misafir hesaba erişim kaybolabilir.",
        "4.5. Hesabınızı Profil ayarları'ndan dondurabilir veya silebilirsiniz. Silinen hesap geri getirilemez; kalan puanlar, ödüller ve kullanılmamış kuponlar sona erer.",
      ],
    },
    {
      title: "5. Yaş Sınırı",
      paragraphs: [
        "Hizmet 13 yaşından küçükler için değildir. 18 yaşından küçükler Hizmeti yasal temsilcilerinin bilgisi ve onayıyla kullanmalıdır. Ücretli hizmetleri yalnızca 18 yaşını doldurmuş kişiler satın alabilir. [Hukukçu: yaş sınırı netleştirilmeli.]",
      ],
    },
    {
      title: "6. Kullanıcı İçeriği",
      paragraphs: [
        "6.1. Kullanıcı İçeriğinizden siz sorumlusunuz; içeriğin hukuka uygun olduğunu ve üzerinde gerekli haklara sahip olduğunuzu beyan edersiniz.",
        "6.2. İçeriğin fikri hakları sizde kalır. İçeriği yükleyerek availo'ya, içerik Hizmette kaldığı sürece, onu Hizmet içinde gösterme, çoğaltma, biçimini Hizmete uyarlama ve kamuya iletme için ücretsiz ve münhasır olmayan bir kullanım hakkı tanırsınız. Bu hak, Hizmetin sunulması için gerekli olduğu ölçüde hizmet sağlayıcılarımıza devredilebilir. Check-in'lerden üretilen anonim doluluk istatistikleri, içeriği kaldırmanızdan sonra da kullanılabilir. İçeriğinizin Hizmet dışında tanıtım amacıyla kullanılması için ayrıca izniniz alınır.",
        "6.3. Yasak içerikler:",
        "• Hakaret, tehdit, taciz, nefret söylemi, ayrımcılık, müstehcenlik veya şiddet içeren içerik,",
        "• Başkalarının kişisel verilerini (telefon, adres, kimlik bilgisi vb.) içeren içerik,",
        "• Gerçek bir deneyime dayanmayan, yanıltıcı veya menfaat karşılığı yazılmış yorumlar,",
        "• Reklam, spam ve konu dışı tekrarlayan içerik,",
        "• Başkalarının fikri mülkiyet, kişilik veya ticari itibar haklarını ihlal eden içerik,",
        "• Sağlık, din, siyasi görüş gibi özel nitelikli kişisel veriler,",
        "• Yasa dışı faaliyetleri destekleyen veya mevzuata aykırı her türlü içerik.",
        "6.4. Fotoğraflar: \"Şu an burada\" fotoğrafları yalnızca mekanın o anki ortamını göstermelidir. Başkalarını rızası olmadan tanınabilir şekilde çekip paylaşmak yasaktır. Bu fotoğraflar mekan kapandıktan 1 saat sonra (24 saat açık mekanlarda 24 saat sonra) kendiliğinden silinir.",
        "6.5. Şikâyet ve kaldırma: Kurallara aykırı içerikleri uygulamadaki \"Şikâyet et\" ile bildirebilirsiniz. Belirli sayıda şikâyet alan içerik incelenene kadar gizlenebilir. availo, kurallara veya mevzuata aykırı bulduğu içeriği kaldırabilir, ilgili puanları geri alabilir ve hesabı kısıtlayabilir. Kişilik haklarınızın ihlal edildiğini düşünüyorsanız [iletişim e-postası] adresine başvurabilirsiniz.",
        "6.6. availo yorumların doğruluğunu tek tek doğrulamaz; yorumlar yazanların kendi görüşüdür.",
        "6.7. Geri bildirim: Hizmetle ilgili ilettiğiniz öneri ve fikirleri availo, size herhangi bir yükümlülük doğmaksızın kullanabilir.",
      ],
    },
    {
      title: "7. Yasak Davranışlar",
      paragraphs: [
        "Aşağıdaki davranışlar yasaktır:",
        "• Mekanda bulunmadan check-in yapmak, konum değiştirici (sahte GPS) uygulamalar kullanmak, doluluğu kasıtlı olarak yanlış bildirmek,",
        "• Puan, rozet, seviye, seri, kupon veya ödül elde etmek için otomatik araçlar, botlar, birden fazla hesap veya hileli yöntemler kullanmak; davet sistemini sahte hesaplarla istismar etmek,",
        "• Hizmetin işleyişini bozmak, güvenlik önlemlerini aşmaya çalışmak, Hizmete yetkisiz erişmek, aşırı yük oluşturmak,",
        "• Tersine mühendislik yapmak, Hizmetten otomatik araçlarla veri toplamak (scraping), içeriği ticari amaçla kopyalamak,",
        "• Diğer kullanıcıları veya işletme çalışanlarını taciz etmek, takip etmek ya da onlara karşı uygunsuz davranmak,",
        "• Hizmeti mevzuata aykırı herhangi bir amaçla kullanmak.",
      ],
    },
    {
      title: "8. Puanlar, Rozetler, Seviyeler ve Ödüller",
      paragraphs: [
        "8.1. Puanlar check-in, keşif, rozet, seviye, seri, davet ve benzeri etkinliklerle kazanılır. Puan kuralları ve miktarları availo tarafından belirlenir ve Hizmette açıklanır.",
        "8.2. Puanların parasal değeri yoktur. Nakde çevrilemez, satılamaz, başkasına devredilemez ve miras yoluyla geçmez. Puanlar yalnızca Hizmet içinde, işletmelerin sunduğu ödüller ve availo'nun sunduğu imkânlar için kullanılabilir.",
        "8.3. Harcanan puanlar sıralamayı ve seviyeyi etkilemez ve iade edilmez. İstisna olarak, işletme kalıcı ödülünü kaldırırsa, kullanılmamış kuponlar için harcanan puanlar geri verilir.",
        "8.4. Seviye hediyeleri (ör. hoş geldin hediyesi, süreli availo+) seviyeye ilk ulaşıldığında bir kez verilir; nakde çevrilemez ve devredilemez. Süreli availo+ süre sonunda kendiliğinden biter.",
        "8.5. Kurallara aykırı kazanılan puanlar, rozetler, seviyeler ve ödüller geri alınabilir.",
        "8.6. availo puan sistemini, ödülleri ve kazanma kurallarını değiştirebilir veya sona erdirebilir. Bu durumda kullanıcılara en az [30] gün önceden bildirim yapılır ve kazanılmış puanların kullanılabilmesi için makul bir süre tanınır.",
      ],
    },
    {
      title: "9. Kampanyalar, Kuponlar ve İşletme Ödülleri",
      paragraphs: [
        "9.1. Kampanyalar, kuponlar, kalıcı ödüller ve sadakat programları ilgili işletme tarafından sunulur; koşulların yerine getirilmesi işletmenin sorumluluğundadır. Bir işletmenin kupon koşullarına uymadığını [iletişim e-postası] adresine veya uygulama içinden bildirebilirsiniz; availo gerekli önlemleri alabilir.",
        "9.2. Kuponlar yalnızca belirtilen süre içinde, ilgili mekanda ve belirtilen koşullarla geçerlidir; devredilemez ve nakde çevrilemez.",
        "9.3. Kampanyalar kişi, cihaz, hesap veya konum bazında sınırlandırılabilir. Kötüye kullanım tespit edilirse kupon iptal edilebilir.",
        "9.4. \"Sponsorlu\" ibaresi taşıyan içerikler, işletmelerin ücret karşılığında öne çıkardığı içeriklerdir.",
      ],
    },
    {
      title: "10. Bildirimler",
      paragraphs: [
        "10.1. Hizmet; arkadaş etkinlikleri, takip ettiğiniz mekanlar ve hesabınızla ilgili konularda uygulama içi ve telefon bildirimleri gönderir. Bunları Bildirim ayarları'ndan ve cihazınızın ayarlarından yönetebilirsiniz.",
        "10.2. İşletme kampanyaları gibi ticari nitelikli bildirimler yalnızca onayınız varsa gönderilir. Onayınızı istediğiniz zaman geri alabilirsiniz.",
      ],
    },
    {
      title: "11. Güvenlik ve Buluşmalar",
      paragraphs: [
        "Check-in'leriniz ve arkadaşlarınızın gittiği yerler hakkındaki bilgiler, kendi tercihinizle paylaşılır. Diğer kullanıcılarla mekanlarda buluşmak kendi sorumluluğunuzdadır; tanımadığınız kişilerle buluşurken gerekli özeni gösteriniz. Rahatsız edildiğinizde kullanıcıyı engelleyebilir ve bize bildirebilirsiniz.",
      ],
    },
    {
      title: "12. Fikri Mülkiyet",
      paragraphs: [
        "12.1. availo adı, logosu, uygulamanın tasarımı, yazılımı ve içeriği (Kullanıcı İçeriği ve üçüncü taraf verileri hariç) availo'ya aittir. Hizmeti yalnızca kişisel ve ticari olmayan amaçlarla kullanmanız için size kişisel, münhasır olmayan, devredilemez ve geri alınabilir bir kullanım hakkı tanınır.",
        "12.2. Harita ve mekan verilerinin bir kısmı OpenStreetMap katkıcılarına aittir ve Open Database License (ODbL) kapsamında kullanılır. Önerilen yerler ve işletme doğrulamasında kullanılan iletişim bilgilerinin bir kısmı Overture Maps Foundation (Community Data License Agreement – Permissive 2.0) ve Foursquare Open Source Places (Apache License 2.0; Copyright 2024 Foursquare Labs, Inc.) kaynaklarından alınır. Bu lisansların metinleri uygulamada Hakkında > Lisanslar ve veri kaynakları bölümündedir.",
      ],
    },
    {
      title: "13. Üçüncü Taraf Bağlantıları",
      paragraphs: [
        "Hizmet, availo'nun kontrolünde olmayan web sitelerine ve hizmetlere (ör. yol tarifi için harita uygulamaları, işletmelerin Instagram sayfaları) bağlantı içerebilir. Bu sitelerin içerik ve uygulamalarından availo sorumlu değildir.",
      ],
    },
    {
      title: "14. Uygulama Mağazaları",
      paragraphs: [
        "Uygulamayı App Store veya Google Play'den indirdiyseniz:",
        "• Bu Koşullar Apple veya Google ile değil, sizinle availo arasındadır.",
        "• Uygulamanın bakımı, desteği ve uygulamayla ilgili talepler availo'nun sorumluluğundadır.",
        "• İlgili mağazanın kullanım kuralları ayrıca geçerlidir.",
        "Apple Inc. ve iştirakleri, bu Koşulların üçüncü kişi lehtarıdır ve Koşulları size karşı uygulama hakkına sahiptir. [Hukukçu: Apple'ın standart EULA asgari koşullarıyla uyum kontrol edilmeli.]",
      ],
    },
    {
      title: "15. Hizmetin Değiştirilmesi, Askıya Alınması ve Sona Ermesi",
      paragraphs: [
        "15.1. availo Hizmetin tamamını veya bir kısmını değiştirebilir, askıya alabilir veya sona erdirebilir. Kullanıcıları önemli ölçüde etkileyen değişiklikler önceden duyurulur. Bakım ve teknik zorunluluklar nedeniyle geçici kesintiler olabilir.",
        "15.2. Bu Koşulların ağır veya tekrarlanan ihlalinde, mevzuat veya mahkeme kararı gerektirdiğinde ya da başkalarına zarar verildiğinde, availo hesabınızı kısıtlayabilir, askıya alabilir veya kapatabilir. Hatalı bir işlem yapıldığını düşünüyorsanız bize başvurabilirsiniz; başvurunuz incelenir.",
        "15.3. Hizmeti dilediğiniz zaman bırakabilir ve hesabınızı silebilirsiniz.",
      ],
    },
    {
      title: "16. Sorumluluk",
      paragraphs: [
        "16.1. Hizmet \"olduğu gibi\" sunulur. availo; Hizmetin kesintisiz ve hatasız olacağını, doluluk ve mekan bilgilerinin doğru olacağını garanti etmez.",
        "16.2. availo; kullanıcı ve işletmelerin içeriklerinden, mekanlarda yaşanan olaylardan, işletmelerin ürün, hizmet ve kampanya yükümlülüklerinden ve üçüncü taraf hizmetlerinden doğan zararlardan, mevzuatın izin verdiği ölçüde sorumlu değildir.",
        "16.3. availo'nun kasıt veya ağır ihmalinden doğan sorumluluğu ile tüketicilere karşı emredici hükümler gereği sınırlandırılamayan sorumluluğu saklıdır.",
        "16.4. Bu Koşulları veya mevzuatı ihlal etmeniz nedeniyle availo'ya yöneltilen üçüncü kişi taleplerinden doğan zararları karşılamayı kabul edersiniz.",
      ],
    },
    {
      title: "17. Mücbir Sebep",
      paragraphs: [
        "Doğal afet, salgın, yangın, savaş, terör, grev, altyapı ve internet kesintileri, hizmet sağlayıcıların arızaları ve resmi makamların kararları gibi availo'nun kontrolü dışındaki olaylar nedeniyle yükümlülüklerin geç veya hiç yerine getirilememesinden availo sorumlu değildir.",
      ],
    },
    {
      title: "18. Değişiklikler",
      paragraphs: [
        "availo bu Koşulları güncelleyebilir. Önemli değişiklikler yürürlükten en az [15] gün önce uygulama içinde ve/veya e-posta ile duyurulur. Değişiklikler geriye dönük uygulanmaz. Değişiklikleri kabul etmiyorsanız hesabınızı silerek sözleşmeyi sona erdirebilirsiniz. Değişikliklerin yürürlüğünden sonra Hizmeti kullanmaya devam etmeniz, güncel Koşulları kabul ettiğiniz anlamına gelir.",
      ],
    },
    {
      title: "19. Şikâyet ve Uyuşmazlık Çözümü",
      paragraphs: [
        "19.1. Şikâyetlerinizi öncelikle uygulamadaki \"Hata bildir ve iletişim\" bölümünden veya [iletişim e-postası] adresinden bize iletmenizi rica ederiz; bu, yasal başvuru haklarınızı sınırlamaz.",
        "19.2. Bu Koşullar Türkiye Cumhuriyeti hukukuna tabidir.",
        "19.3. Tüketiciler, 6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca belirlenen parasal sınırlar dahilinde kendi yerleşim yerlerindeki veya işlemin yapıldığı yerdeki Tüketici Hakem Heyetlerine, bu sınırları aşan uyuşmazlıklarda Tüketici Mahkemelerine başvurabilir.",
        "19.4. Tüketici uyuşmazlığı olmayan durumlarda [İstanbul (Çağlayan)] mahkemeleri ve icra daireleri yetkilidir.",
        "19.5. availo'nun sunucu ve veritabanı kayıtları, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun 193. maddesi kapsamında delil niteliğindedir; karşı delil sunma hakkınız saklıdır. [Hukukçu: tüketici açısından geçerliliği değerlendirilmeli.]",
      ],
    },
    {
      title: "20. Diğer Hükümler",
      paragraphs: [
        "20.1. Bu Koşulların bir hükmünün geçersiz sayılması, diğer hükümlerin geçerliliğini etkilemez.",
        "20.2. availo'nun bir hakkını kullanmaması veya geç kullanması, o haktan vazgeçtiği anlamına gelmez.",
        "20.3. Sorularınız ve bildirimleriniz için: [iletişim e-postası], [KEP adresi], [adres].",
      ],
    },
    {
      title: "21. Check-in",
      paragraphs: [
        "21.1. Check-in yalnızca mekanda fiilen bulunurken yapılabilir; uygulama check-in anında konumunuzun mekana yakın olduğunu doğrular.",
        "21.2. Hileyi önlemek için aynı mekanda belirli aralıklarla ve belirli bir süre içinde sınırlı sayıda check-in yapılabilir.",
        "21.3. Check-in'lerinizi gizli yapabilirsiniz; gizli check-in'ler yalnızca anonim doluluk hesaplamasında kullanılır ve kimseye gösterilmez.",
      ],
    },
    {
      title: "22. Sosyal Özellikler",
      paragraphs: [
        "22.1. Arkadaşlarınız, gizlilik ayarlarınıza göre gizli olmayan check-in'lerinizi ve profil bilgilerinizi görebilir. Bir mekanda son 30 günde en çok check-in yapan kullanıcı o mekanın müdavimi olarak gösterilir; adınızın herkese görünüp görünmeyeceğini Gizlilik ayarlarından seçebilirsiniz.",
        "22.2. Davet bağlantınızla katılan kişi ilk check-in'ini yaptığında her iki taraf da Hizmette belirtilen puanı kazanır. Davet puanları belirli bir süre içinde sınırlı sayıda verilir.",
      ],
    },
    {
      title: "23. İşletme Hesabı",
      paragraphs: [
        "23.1. İşletme hesabını açan kişi, ilgili mekanı temsil etmeye ve bu Koşulları işletme adına kabul etmeye yetkili olduğunu beyan eder.",
        "23.2. Bir mekan yalnızca bir işletme hesabına bağlanabilir. Gerçek sahibi olmadığı halde bir mekanı sahiplenen hesaplar kapatılabilir.",
        "23.3. Doğrulama: availo, mekan sahipliğini gösteren belge (vergi levhası, işletme ruhsatı vb.) veya mekan telefonuyla doğrulama isteyebilir. Doğrulanmamış işletmeler için bazı özellikler kısıtlıdır.",
      ],
    },
    {
      title: "24. Mekan Bilgileri ve Yorumlar",
      paragraphs: [
        "24.1. İşletme, mekan sayfasındaki bilgilerin (ad, adres, konum, saatler, özellikler, iletişim bilgileri, fotoğraflar) doğru ve güncel olmasından ve yüklediği içerik üzerinde gerekli haklara sahip olmaktan sorumludur.",
        "24.2. İşletme yorumlara yalnızca işletme olarak, saygılı ve gerçeğe uygun şekilde yanıt verebilir. Yorum kaldırtmak için baskı yapmak, sahte yorum yazmak veya yazdırmak ya da yorum karşılığında menfaat sağlamak yasaktır.",
        "24.3. İşletme, doluluğu yanlış göstermek amacıyla check-in yapamaz veya yaptıramaz.",
      ],
    },
    {
      title: "25. Kampanyalar, Kuponlar ve Ödüller",
      paragraphs: [
        "25.1. İşletme; kampanya, kupon, kalıcı ödül ve sadakat programı koşullarını açık ve doğru biçimde belirlemekten ve geçerli kuponu ibraz eden kullanıcıya taahhüt ettiği indirimi veya ürünü sağlamaktan tek başına sorumludur.",
        "25.2. Kampanyalar 6502 sayılı Kanun, Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği ve diğer mevzuata uygun olmalıdır. Yanıltıcı veya yasa dışı kampanya oluşturulamaz.",
        "25.3. availo, mevzuata veya bu Koşullara aykırı kampanyaları yayından kaldırabilir.",
      ],
    },
    {
      title: "26. İstatistikler ve Verilerin Kullanımı",
      paragraphs: [
        "26.1. İşletmeye sunulan istatistikler anonim ve toplu verilerdir. İşletme bunları kullanıcıları tanımlamak amacıyla kullanamaz.",
        "26.2. İşletme, kupon kodu ve müşteri kodu gibi bilgileri yalnızca kupon ve sadakat kartının doğrulanması için kullanabilir.",
      ],
    },
    {
      title: "27. Kurucu Mekan Programı ve Deneme Süresi",
      paragraphs: [
        "Kurucu mekan programı ve ücretsiz deneme süresi, availo'nun belirlediği koşullarla ve sınırlı sayıda sunulur. Süre sonunda ayrıcalıklar kendiliğinden sona erer; işletme ücretli pakete geçmezse ücretsiz pakete döner.",
      ],
    },
    {
      title: "28. availo+ (Bireysel Abonelik)",
      paragraphs: [
        "28.1. availo+, App Store veya Google Play üzerinden aylık abonelik olarak satın alınır. Ödeme, yenileme, iptal ve iade ilgili mağazanın koşullarına tabidir. Dönem sonundan önce iptal edilmeyen abonelik kendiliğinden yenilenir.",
        "28.2. İptal, mağazanın abonelik ayarlarından yapılır. İptalde availo+ ödenmiş dönemin sonuna kadar sürer.",
        "28.3. availo+ kapsamındaki özellikler uygulamada ve web sitesinde açıklanır. Özellikler makul bir süre önceden bildirilerek değiştirilebilir.",
        "28.4. Cayma hakkı: Mesafeli Sözleşmeler Yönetmeliği uyarınca, elektronik ortamda anında ifa edilen hizmetlerde, ifaya onayınızla başlanmışsa cayma hakkı kullanılamaz. [Hukukçu: mağaza üzerinden satışta ön bilgilendirme, cayma ve iade düzeni netleştirilmeli.]",
      ],
    },
    {
      title: "29. İşletme Paketleri ve \"Öne Çık\"",
      paragraphs: [
        "29.1. Aylık paket ve \"Öne çık\" hizmetleri web sitesinden, anlaşmalı ödeme kuruluşu aracılığıyla satın alınır. Fiyatlar, vergilerin dahil olup olmadığı belirtilerek ilan edilir.",
        "29.2. Aylık paket, iptal edilmediği sürece her ay yenilenir; iptal yenileme tarihinden önce yapılmalıdır. İptalde paket ödenmiş dönemin sonuna kadar sürer; kullanılmayan süre için iade yapılmaz. [Hukukçu: tacirler arası iade ve fesih koşulları netleştirilmeli.]",
        "29.3. \"Öne çık\", satın alınan süre boyunca mekanın ilgili alanlarda \"Sponsorlu\" ibaresiyle gösterilmesini sağlar. Belirli bir gösterim, tıklama veya müşteri sayısı garanti edilmez.",
        "29.4. Faturalar, işletmenin bildirdiği bilgilere göre elektronik ortamda düzenlenir.",
      ],
    },
  ],
};

export const LEGAL_DOCS = [PRIVACY_POLICY, TERMS];
