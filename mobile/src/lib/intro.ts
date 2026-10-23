/** How to use availy: shown on the Hakkında page, by account type. */
export type IntroSection = { icon: string; title: string; lines: string[]; legend?: boolean };

// Short on purpose: few slides, two lines each
export const CUSTOMER_SLIDES: IntroSection[] = [
  {
    icon: '🟢',
    title: 'Renkler',
    lines: ["Doluluğu mekandaki kullanıcılar check-in'le bildirir.", 'Gri: güncel bilgi yok · ✨: henüz kimse gitmedi.'],
    legend: true,
  },
  {
    icon: '📍',
    title: 'Check-in yap, puan kazan',
    lines: ['Mekandayken "Şu an burası nasıl?" sorusunu cevapla.', "Bir mekanın ilk check-in'ini yapan orayı ✨ keşfeder."],
  },
  {
    icon: '👥',
    title: 'Arkadaşlar',
    lines: ["Sosyal'de arkadaşlarını ekle, check-in ve yorumlarını gör.", 'Haftanın sıralamasında puanını karşılaştır.'],
  },
  {
    icon: '🔔',
    title: 'Sakin olunca haber ver',
    lines: ["Kalabalık bir mekandaki 🔕'e dokun; sakinleşince bildirim gelir."],
  },
];

export const BUSINESS_SLIDES: IntroSection[] = [
  {
    icon: '📊',
    title: 'Panel',
    lines: ["Müşterilerin check-in'lerinden mekanının doluluğu ve istatistikleri.", 'Müşteriler: müdavimlerin, sadakat üyelerin ve yanıt bekleyen yorumlar.'],
  },
  {
    icon: '🏷️',
    title: 'Kampanyalar',
    lines: ['Ölü saatte yakındaki kullanıcılara kampanya gönder.', "Kasada kupon ve sadakat QR'ını okut."],
  },
  {
    icon: '✏️',
    title: 'Mekanını güncel tut',
    lines: ['Ayarlar: saatler ve özellikler. Abonelik: paketin.'],
  },
];
