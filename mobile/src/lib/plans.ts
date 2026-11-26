/**
 * İşletme paketleri. The server keeps the plan and checks the limits (backend/app/plans.py); no payment yet:
 * choosing a plan switches it. 'pay_per_use' is the free plan (the old name stays in the data).
 * Kurucu mekanlar get everything free; a verified venue gets 2 extra campaigns once.
 */
export type PlanId = 'saas' | 'pay_per_use';

export const PLANS: Record<PlanId, { name: string; price: string; features: string[] }> = {
  pay_per_use: {
    name: 'Ücretsiz',
    price: '₺0',
    features: [
      'Mekanını doğrulayınca ayda 3 kampanya (doğrulama ücretsiz)',
      'Mekan profili, yorumlara yanıt, sadakat damga kartı, kupon doğrulama',
      'Ölü saat bildirimi ve tüm işletme bildirimleri',
    ],
  },
  saas: {
    name: 'Aylık paket',
    price: '₺599 / ay',
    features: [
      'Sınırsız kampanya',
      'İstatistikler: saat saat bugün, son 7 gün, haftanın günleri, geçen ayla karşılaştırma, en sakin saatler',
      'Yakındaki benzer mekanların anlık doluluğu',
      'Zamanlanmış haftalık kampanyalar',
      'Otomatik ölü saat kampanyası',
    ],
  },
};

export const DEFAULT_PLAN: PlanId = 'pay_per_use';

// The Aylık paket is bought on the website (card payment there; iyzico or similar later), not in the app
export const BUSINESS_PLANS_URL = 'https://erayerb.github.io/availy.app/v2/tanitim/isletme.html#paketler';
// ⚠️ App Store (outside the US) and Google Play restrict links to purchases outside the app: turn this off on
// iOS before review if needed (CONTEXT.md > Ödeme)
export const SHOW_BUSINESS_PURCHASE_LINK = true;
