/**
 * B2C plans from the business model: free (with location-based ads) and
 * Premium ₺79/month. Prototype: no payment, Premium is switched on in the app.
 * Keep the lists in step with what is really gated (watches here, streak saves in backend/app/social_streaks.py).
 */
export const PREMIUM_PRICE = '₺79 / ay';

// Free users can watch one busy venue at a time ("sakin olunca haber ver")
export const FREE_WATCH_LIMIT = 1;

export const FREE_FEATURES = [
  'Anlık doluluk, harita ve filtreler',
  'Kampanyalar ve sadakat kartları; kuponlar puanla alınır',
  `"Sakin olunca haber ver": aynı anda ${FREE_WATCH_LIMIT} mekan`,
  'Ayda 1 seri kurtarma hakkı',
  'Konuma göre reklamlar',
];

export const PREMIUM_FEATURES = [
  '"availo+" rozeti profilinde',
  'Reklamsız',
  '"Sakin olunca haber ver": sınırsız mekan',
  'Favorilerin sakinleşince zil açmadan haber (açıp kapatabilirsin)',
  'Aylık özet: en çok gittiğin mekanlar ve semtler, arkadaşlarınla kıyas',
  'Profilinde kapak fotoğrafı ve renkli çerçeve',
  'Ayda 3 seri kurtarma hakkı',
  'Ücretsiz plandaki her şey',
];

export const canAddWatch = (watchCount: number, premium: boolean) => premium || watchCount < FREE_WATCH_LIMIT;
