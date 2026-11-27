/**
 * B2C plans from the business model: free (with location-based ads) and
 * Premium ₺79/month. Prototype: no payment, Premium is switched on in the app.
 * Keep the lists in step with what is really gated (watches here, streak saves in backend/app/social_streaks.py).
 */
export const PREMIUM_PRICE = '₺79 / ay';

// Free users can watch one busy venue at a time ("sakin olunca haber ver")
export const FREE_WATCH_LIMIT = 1;

export const FREE_FEATURES = [
  'Doluluğu gör: harita, filtreler, anlık durum',
  'Check-in yap, puan topla, rozet kazan',
  'Kuponları al; mekanların ödüllerini puanla aç',
  `Sakinleşince haber al: aynı anda ${FREE_WATCH_LIMIT} mekan`,
  'Serini kurtar: ayda 2 kez',
  'Reklamlı',
];

// availo+ on the Abonelik page: an icon, a short title and one line each
export const PREMIUM_PERKS: { icon: string; title: string; text: string }[] = [
  { icon: 'bell-ringing', title: 'Sınırsız "sakinleşince haber ver"', text: 'Favorilerin sakinleşince zil açmadan haber al' },
  { icon: 'chart-bar', title: 'Aylık özet', text: 'En çok gittiğin yerler, semtlerin, arkadaşlarınla kıyas' },
  { icon: 'flame', title: 'Serini kurtar: ayda 10 kez', text: 'Ücretsizde ayda 2 kez' },
  { icon: 'sparkles', title: 'Profilini öne çıkar', text: 'Kapak fotoğrafı, renkli çerçeve ve availo+ rozeti' },
  { icon: 'ad-off', title: 'Reklamsız', text: 'Ücretsiz plandaki her şey, reklamsız' },
];

export const canAddWatch = (watchCount: number, premium: boolean) => premium || watchCount < FREE_WATCH_LIMIT;
