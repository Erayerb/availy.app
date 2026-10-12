/**
 * Business plans from the financial model. Display only for now.
 * TODO (later): require an active SaaS subscription or a ₺150 one-time payment
 * before a campaign can be sent. The prototype sends campaigns without payment.
 */
export type PlanId = 'saas' | 'pay_per_use';

export const PLANS: Record<PlanId, { name: string; price: string; features: string[] }> = {
  saas: {
    name: 'SaaS Panel',
    price: '₺1.899 / ay',
    features: ['Anlık doluluk analizi', 'Rakip karşılaştırması', 'Sınırsız kampanya'],
  },
  pay_per_use: {
    name: 'Kampanya Başı',
    price: '₺150 / kampanya',
    features: ['Aylık ücret yok', 'Her kampanya için tek seferlik ödeme'],
  },
};

export const DEFAULT_PLAN: PlanId = 'pay_per_use';

/** Text shown before sending a campaign. */
export function campaignCostNote(plan: PlanId): string {
  return plan === 'saas' ? 'Paketine dahil (sınırsız).' : 'Bu kampanya ₺150 (demo, ödeme alınmaz).';
}
