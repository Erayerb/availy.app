/** How to use availy: shown on the Hakkında page, by account type. */
export type IntroSection = { icon: string; title: string; lines: string[]; legend?: boolean };

export const CUSTOMER_SLIDES: IntroSection[] = [
  {
    icon: '🟢',
    title: 'Renkler ne anlatıyor?',
    lines: [
      'Doluluğu mekanda olan kullanıcılar bildirir: son 90 dakikadaki check-in\'lere bakılır.',
      'En az 5 kişi bildirdiyse yaklaşık yüzde de görünür (~%60). Gri: güncel bilgi yok.',
      '"Sıra var" ve "Oturacak yer yok" cevapları doluluğu biraz artırır, "Sıra yok" ve "Oturacak yer var" biraz azaltır.',
      '✨: henüz kimse check-in yapmadı.',
    ],
    legend: true,
  },
  {
    icon: '📍',
    title: 'Check-in',
    lines: [
      'Mekandayken (150 m içinde) detay sayfasında "Şu an burası nasıl?" sorusuna cevap ver: Sakin, Orta ya da Kalabalık.',
      'Seçince Check-in açılır. Bir mekana 2 saatte bir check-in yapabilirsin; konumun saklanmaz.',
      'Haritadaki + düğmesi en yakın mekanları listeler; aradığın mekana dokunup check-in yapabilirsin.',
      'Gizli check-in doluluğa sayılır ama adın kimseye gösterilmez.',
      '✨ simgeli mekanın ilk check-in\'ini yapan burayı keşfetmiş olur; her check-in 10, ilk check-in +50 puan (misafirlere yarısı).',
    ],
  },
  {
    icon: '🗺️',
    title: 'Nerede yer var?',
    lines: [
      'Ana Sayfa\'da semtini ve ne aradığını seç; Harita\'da çevrene bak.',
      'Kalabalık bir mekanda "Daha boş alternatifler" yakındaki sakin yerleri gösterir.',
    ],
  },
  {
    icon: '🔔',
    title: 'Sakin olunca haber ver',
    lines: [
      'Orta ya da kalabalık bir mekandaki 🔕 simgesine dokun.',
      'Check-in\'ler mekanı sakin gösterince telefonuna bildirim gelir.',
    ],
  },
  {
    icon: '🏷️',
    title: 'Kampanya ve sadakat',
    lines: [
      'Yakındaki kampanyalardan kupon al, kasada kuponun QR\'ını okut.',
      'Sadakat kartlarında damga topla, availy puanı kazan.',
    ],
  },
];

export const BUSINESS_SLIDES: IntroSection[] = [
  {
    icon: '📊',
    title: 'Panel',
    lines: [
      'Mekanının anlık doluluğu, bugünün saatleri ve semt ortalaması.',
      'Yakındaki rakiplerle kıyaslama, haftalık ve aylık istatistik.',
    ],
  },
  {
    icon: '⏱️',
    title: 'Ölü saatte kampanya',
    lines: [
      'Mekanın %40\'ın altına düşünce bildirim gelir.',
      'Tek dokunuşla yakındaki kullanıcılara kampanya gönder; istersen zamanla ya da otomatik gönder.',
    ],
  },
  {
    icon: '📷',
    title: 'Kasada QR',
    lines: [
      'Kampanyalar → Kuponlar: müşterinin kupon QR\'ını okut.',
      'Kampanyalar → Sadakat programım: damga ver ya da kart dolunca ödülü kullandır.',
    ],
  },
  {
    icon: '✏️',
    title: 'Mekanını güncel tut',
    lines: [
      'İşletme Ayarları: ad, çalışma saatleri, özellikler.',
      'İşletme Profili: fotoğraf ve paket.',
    ],
  },
];
