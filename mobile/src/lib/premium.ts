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
  'Konuma göre reklamlar',
];

export const PREMIUM_FEATURES = [
  'Profilini güzelleştir: kapak fotoğrafı, renkli çerçeveler ve availo+ rozeti',
  'Aylık özetini gör: en çok gittiğin yerler, semtlerin, arkadaşlarınla kıyas',
  'Favorilerin sakinleşince haber al (zil açmadan)',
  'Sakinleşince haber al: sınırsız mekan',
  'Serini kurtar: ayda 10 kez',
  'Reklamsız kullan',
  'Ücretsiz plandaki her şey',
];

export const canAddWatch = (watchCount: number, premium: boolean) => premium || watchCount < FREE_WATCH_LIMIT;
