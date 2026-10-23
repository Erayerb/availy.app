/**
 * Gizlilik politikası (KVKK aydınlatma metni) and kullanım koşulları.
 * DRAFT: written from what the app actually does; must be checked by a lawyer and the
 * bracketed company details filled in before the release.
 */
export type LegalSection = { title: string; paragraphs: string[] };
export type LegalDoc = { id: 'privacy' | 'terms'; title: string; updated: string; sections: LegalSection[] };

// Filled in before the release
const CONTROLLER = '[Şirket unvanı, adresi ve MERSİS no]';
const CONTACT = '[iletişim e-postası]';

export const PRIVACY_POLICY: LegalDoc = {
  id: 'privacy',
  title: 'Gizlilik politikası',
  updated: '21 Ekim 2026',
  sections: [
    {
      title: 'Veri sorumlusu',
      paragraphs: [
        `6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu ${CONTROLLER}'dir ("availy"). Sorularını ${CONTACT} adresine yazabilirsin.`,
      ],
    },
    {
      title: 'Hangi verileri işliyoruz?',
      paragraphs: [
        'Hesap: kullanıcı adın, e-posta adresin ve şifrenin geri çevrilemez özeti (şifrenin kendisi saklanmaz). Misafir hesapta yalnızca otomatik bir numara tutulur.',
        "Check-in'ler: hangi mekana, hangi saatte check-in yaptığın, verdiğin doluluk bilgisi (Sakin / Orta / Kalabalık, sıra / oturacak yer) ve check-in'in gizli olup olmadığı.",
        'Konum: yalnızca check-in anında, mekana yakın olduğunu doğrulamak için kullanılır ve kaydedilmez. Yakındaki mekanları göstermek ve check-in önerisi için konumun telefonunda kullanılır, sunucuya gönderilmez.',
        'Sosyal: arkadaşlıkların, engellediğin ve sessize aldığın kişiler, mekan yorumların ve yanıtların, şikâyetlerin; bir davet bağlantısıyla kayıt olduysan seni kimin davet ettiği.',
        '"Rehberden bul" (isteğe bağlı): kendi telefon numaran yalnızca geri çevrilemez, anahtarlı bir özet olarak saklanır ve kimseye gösterilmez. Rehberindeki numaralar yalnızca availy kullanan tanıdıklarını bulmak için bir kez gönderilir, karşılaştırılır ve saklanmaz. Numaranı istediğin zaman kaldırabilirsin.',
        'Puanlar ve rozetler, gizlilik ve bildirim ayarların.',
        'Telefonda kalanlar: favorilerin, bildirim tercihlerin ve uygulama ayarların yalnızca telefonunda saklanır.',
      ],
    },
    {
      title: 'Neden işliyoruz? (amaç ve hukuki sebep)',
      paragraphs: [
        "Hizmeti sunmak (KVKK m.5/2-c, sözleşmenin ifası): hesabını açmak, check-in'lerinden mekanların doluluğunu hesaplamak, puan ve rozet vermek, arkadaşlarınla paylaşmak.",
        'Güvenlik ve kötüye kullanımı önlemek (m.5/2-f, meşru menfaat): sahte check-in ve spam yorumları ayıklamak, şikâyetleri incelemek.',
        'Yasal yükümlülükler (m.5/2-ç): yetkili kurumların talepleri.',
        'Reklam veya pazarlama için verini satmıyor, üçüncü kişilerle paylaşmıyoruz.',
      ],
    },
    {
      title: 'Kimler görebilir?',
      paragraphs: [
        "Herkes: kullanıcı adın, mekan yorumların ve yanıtların, (açıksa) herkese açık sıralamadaki puanın, gizli olmayan ilk check-in'lerin için \"Burayı @kullaniciadi keşfetti\" yazısı.",
        "Arkadaşların: gizli olmayan check-in'lerin (mekan ve saat; canlı konum asla), profilindeki keşfettiğin ve check-in yaptığın mekanlar. Gizlilik ayarlarından kapatabilirsin.",
        'Mekan sahipleri: kim olduğun olmadan, yalnızca toplam doluluk ve yorumlar.',
        'Hizmet sağlayıcılar: sunucu ve veritabanı barındırma hizmeti (yurt dışında olabilir; KVKK m.9 kapsamında gerekli güvenceler alınarak).',
      ],
    },
    {
      title: 'Ne kadar saklıyoruz?',
      paragraphs: [
        'Hesabın açık olduğu sürece. Hesabını sildiğinde hesabın, yorumların, yanıtların, arkadaşlıkların ve puanların silinir; check-in\'lerin yalnızca kim olduğun bilinmeden doluluk istatistiği olarak kalır.',
        'Oturum anahtarları en fazla 30 gün (misafirde 365 gün) geçerlidir.',
      ],
    },
    {
      title: 'Hakların (KVKK m.11)',
      paragraphs: [
        'Verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini ya da silinmesini isteme, itiraz etme ve zararın giderilmesini isteme haklarına sahipsin.',
        `Hesabını Profil ayarları'ndan silebilirsin. Diğer talepler için ${CONTACT} adresine yaz; en geç 30 gün içinde yanıtlarız.`,
      ],
    },
    {
      title: 'Çocuklar',
      paragraphs: ['availy 13 yaşından küçükler için değildir.'],
    },
  ],
};

export const TERMS: LegalDoc = {
  id: 'terms',
  title: 'Kullanım koşulları',
  updated: '21 Ekim 2026',
  sections: [
    {
      title: 'Hizmet',
      paragraphs: [
        "availy, mekanların şu anki doluluğunu kullanıcıların check-in'lerinden gösterir. Doluluk bilgisi kullanıcı bildirimlerine dayanır ve yanlış ya da eski olabilir; kesinliği garanti edilmez.",
      ],
    },
    {
      title: 'Hesabın',
      paragraphs: [
        'Kayıt olurken verdiğin bilgiler doğru olmalı; şifrenin güvenliğinden sen sorumlusun. Başkasının adını taşıyan ya da yanıltıcı kullanıcı adları kaldırılabilir.',
      ],
    },
    {
      title: "Check-in'ler",
      paragraphs: [
        "Check-in yalnızca mekandayken yapılır. Sahte check-in, mekanda olmadan konum değiştiren uygulamalar ya da puan toplamak için otomatik araçlar yasaktır; bu durumda puanların silinebilir, hesabın kapatılabilir.",
      ],
    },
    {
      title: 'Yorumlar ve davranış',
      paragraphs: [
        'Yorumların gerçek deneyimine dayanmalı. Hakaret, taciz, nefret söylemi, kişisel bilgi paylaşmak, reklam / spam ve yasa dışı içerik yasaktır.',
        'Uygunsuz bir yorumu "Şikâyet et" ile bildirebilirsin. Çok şikâyet alan içerik incelenene kadar gizlenir; kurallara uymayan içerik kaldırılabilir ve hesap kapatılabilir.',
        'Yazdığın yorumların sorumluluğu sana aittir; availy\'de gösterilmeleri için bize ücretsiz bir kullanım izni vermiş olursun.',
      ],
    },
    {
      title: 'Puanlar ve ödüller',
      paragraphs: [
        'Puanların ve rozetlerin parasal değeri yoktur, başkasına devredilemez. Haftalık ödüllerin kuralları ayrıca duyurulur; kurallara aykırı kazanılan puanlar silinebilir.',
      ],
    },
    {
      title: 'Değişiklikler ve iletişim',
      paragraphs: [
        `Bu koşulları güncelleyebiliriz; önemli değişiklikleri uygulamada duyururuz. Sorular için: ${CONTACT}. Uyuşmazlıklarda Türkiye Cumhuriyeti hukuku uygulanır.`,
      ],
    },
  ],
};

export const LEGAL_DOCS = [PRIVACY_POLICY, TERMS];
