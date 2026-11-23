import { Linking, View } from 'react-native';
import { Text } from '../Text';
import { Pressable } from '../Pressable';

import { useState } from 'react';

import { useCampaigns } from '../../context/CampaignsContext';
import { BUSINESS_PLANS_URL, PLANS, SHOW_BUSINESS_PURCHASE_LINK, type PlanId } from '../../lib/plans';
import { colors } from '../../theme';
import { panel } from './panelStyles';

/** The business's package: Ücretsiz or the Aylık paket. The Aylık paket is bought on the website (the app opens
 * it); the 15-day trial starts here; going back to Ücretsiz is here too. */
export function PlanSection({ plan, onPlanChange }: { plan: PlanId; onPlanChange: (plan: PlanId) => void }) {
  const { access, startTrial } = useCampaigns();
  const [note, setNote] = useState<string | null>(null);
  const day = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Paketin</Text>
      {access?.trial_until && (
        <Text style={panel.success}>Aylık paket denemen sürüyor: {day(access.trial_until)} tarihine kadar ücretsiz.</Text>
      )}
      {access?.founder_until && (
        <Text style={panel.success}>Kurucu mekan: Aylık paket {day(access.founder_until)} tarihine kadar ücretsiz.</Text>
      )}
      {access?.trial_available && plan !== 'saas' && (
        <Pressable style={panel.primary} onPress={async () => setNote(await startTrial())}>
          <Text style={panel.primaryText}>Aylık paketi 15 gün ücretsiz dene</Text>
        </Pressable>
      )}
      {note && <Text style={panel.error}>{note}</Text>}
      {(Object.keys(PLANS) as PlanId[]).map((id) => {
        const p = PLANS[id];
        const selected = id === plan;
        return (
          <Pressable
            key={id}
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? colors.primary : colors.border,
              gap: 3,
            }}
            onPress={() => {
              if (selected) return;
              if (id === 'saas') {
                if (SHOW_BUSINESS_PURCHASE_LINK) Linking.openURL(BUSINESS_PLANS_URL).catch(() => setNote('Site açılamadı.'));
                else setNote("Aylık paketi availo web sitesinden alabilirsin.");
                return;
              }
              onPlanChange(id);
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{p.name}</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>{p.price}</Text>
            </View>
            {p.features.map((f) => (
              <Text key={f} style={panel.muted}>
                • {f}
              </Text>
            ))}
            <Text style={{ marginTop: 4, color: selected ? colors.primary : colors.textMuted, fontWeight: selected ? '600' : '400' }}>
              {selected ? '✓ Mevcut paketin' : id === 'saas' ? (SHOW_BUSINESS_PURCHASE_LINK ? 'Web sitesinden al ›' : 'Web sitesinden alınır') : 'Ücretsiz plana dön'}
            </Text>
          </Pressable>
        );
      })}
      <Text style={{ textAlign: 'center', color: colors.placeholder, fontSize: 12 }}>
        Aylık paket web sitesinden kartla alınır (online ödeme çok yakında).
      </Text>
    </View>
  );
}
