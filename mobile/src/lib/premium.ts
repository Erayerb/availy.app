/**
 * B2C plans from the business model: free (with location-based ads) and
 * Premium ₺79/month. Prototype: no payment, Premium is switched on in the app.
 */
export const PREMIUM_PRICE = '₺79 / ay';

// Free users can watch one busy venue at a time ("boşalınca haber ver")
export const FREE_WATCH_LIMIT = 1;

export const FREE_FEATURES = [
  'Anlık doluluk, harita ve filtreler',
  'Kampanyalar, kuponlar ve sadakat kartları',
  `"Boşalınca haber ver": aynı anda ${FREE_WATCH_LIMIT} mekan`,
  'Konuma göre reklamlar',
];

export const PREMIUM_FEATURES = [
  'Reklamsız',
  '"Boşalınca haber ver": sınırsız mekan',
  'Ücretsiz plandaki her şey',
];

export const canAddWatch = (watchCount: number, premium: boolean) => premium || watchCount < FREE_WATCH_LIMIT;
