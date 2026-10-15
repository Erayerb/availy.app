/** How to use availy: shown on the Hakkında page, by account type. */
export type IntroSection = { icon: string; title: string; lines: string[]; legend?: boolean };

export const CUSTOMER_SLIDES: IntroSection[] = [
  {
    icon: '🟢',
    title: 'Renkler ne anlatıyor?',
    lines: [
      'Yüzde, mekanın şu an ne kadar dolu olduğunu gösterir (kişi sayısı değil).',
      'Sakin: %40 altı · Orta: %40–75 · Kalabalık: %75 üstü.',
    ],
    legend: true,
  },
  {
    icon: '📍',
    title: 'Nerede yer var?',
    lines: [
      'Ana Sayfa\'da semtini ve ne aradığını seç; Harita\'da çevrene bak.',
      'Kalabalık bir mekanda "Daha boş alternatifler" yakındaki sakin yerleri gösterir.',
    ],
  },
  {
    icon: '🔔',
    title: 'Boşalınca haber ver',
    lines: [
      'Kalabalık bir mekandaki 🔕 simgesine dokun.',
      'Mekan %70\'in altına düşünce telefonuna bildirim gelir.',
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
