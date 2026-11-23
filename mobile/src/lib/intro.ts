/** How to use availo: shown on the Hakkında page, by account type. */
import type { IconName } from '../components/Icon';

export type IntroSection = { icon: IconName; title: string; lines: string[]; legend?: boolean; colors?: [string, string] };

// Short on purpose: few slides, two lines each; each its own colour (the app's icon boxes)
export const CUSTOMER_SLIDES: IntroSection[] = [
  {
    icon: 'circle-dot',
    title: 'Renkler',
    lines: ["Doluluğu mekandaki kullanıcılar check-in'le bildirir.", 'Gri: güncel bilgi yok · ✨: henüz kimse gitmedi, ilk sen git.'],
    legend: true,
    colors: ['#123A2A', '#2E9E4F'],
  },
  {
    icon: 'map-pin',
    title: 'Check-in yap, puan kazan',
    lines: ['Mekandayken "Şu an burası nasıl?" sorusunu cevapla: 10 saniye.', "İlk adımları tamamla: ilk check-in, liste, arkadaş, fotoğraf; her biri +10 puan."],
    colors: ['#7A2E1F', '#C8102E'],
  },
  {
    icon: 'gift',
    title: 'Puanını harca',
    lines: ['Mekanların ödüllerini puanla al: ör. 200 puan = %10 indirim.', 'Harcadığın puan seviyeni ve sıralamanı düşürmez.'],
    colors: ['#5A3A12', '#C9962B'],
  },
  {
    icon: 'users',
    title: 'Arkadaşlarınla',
    lines: ['Arkadaşın bir yere gidince "Sen de katıl!" bildirimi gelir.', 'Aynı yerde check-in yapınca ikiniz de puan kazanırsınız.'],
    colors: ['#13304F', '#2F6AA3'],
  },
  {
    icon: 'bell',
    title: 'Sakin olunca haber ver',
    lines: ['Kalabalık bir mekandaki zile dokun; sakinleşince bildirim gelir.', 'availo+ ile favorilerin sakinleşince de haber alırsın.'],
    colors: ['#2B2350', '#7B5EA7'],
  },
];

export const BUSINESS_SLIDES: IntroSection[] = [
  {
    icon: 'chart-bar',
    title: 'Panel',
    lines: ['Bugün kaç kişi geldi, kaçı yeni müşteri.', '"Bu ay availo ile 23 kişi geldi, 9\'u ilk kez" raporu her ay.'],
    colors: ['#13304F', '#2F6AA3'],
  },
  {
    icon: 'tag',
    title: 'Kampanyalar',
    lines: ['Mekanını doğrula: ayda 3 ücretsiz kampanya.', 'Mekan sakinleşince "kampanya başlat" bildirimi gelir.'],
    colors: ['#7A2E1F', '#D9480F'],
  },
  {
    icon: 'gift',
    title: 'Kalıcı ödül',
    lines: ['"200 puan = %10 indirim": availo kullanıcıları puanlarını sende harcar.', "Kasada kupon ve sadakat QR'ını okut."],
    colors: ['#5A3A12', '#C9962B'],
  },
  {
    icon: 'crown',
    title: 'Aylık paket',
    lines: ['Sınırsız kampanya, istatistikler, zamanlanmış kampanyalar, aylık özet.', '15 gün ücretsiz dene: Abonelik.'],
    colors: ['#2B2350', '#7B5EA7'],
  },
  {
    icon: 'pencil',
    title: 'Mekanını güncel tut',
    lines: ['İşletme profili: kapak fotoğrafı, saatler ve özellikler.'],
    colors: ['#123A2A', '#2E9E4F'],
  },
];
