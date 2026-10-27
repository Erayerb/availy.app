import { Text, View } from 'react-native';
import { Pressable } from '../Pressable';

import { PLANS, type PlanId } from '../../lib/plans';
import { colors } from '../../theme';
import { panel } from './panelStyles';

/** The business's package (pay per campaign or monthly SaaS); no payment in the prototype. */
export function PlanSection({ plan, onPlanChange }: { plan: PlanId; onPlanChange: (plan: PlanId) => void }) {
  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Paketin</Text>
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
            onPress={() => onPlanChange(id)}
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
              {selected ? '✓ Mevcut paketin' : 'Bu paketi seç'}
            </Text>
          </Pressable>
        );
      })}
      <Text style={{ textAlign: 'center', color: colors.placeholder, fontSize: 12 }}>Prototip: ödeme alınmaz.</Text>
    </View>
  );
}
