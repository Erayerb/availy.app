import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCampaigns } from '../context/CampaignsContext';
import { useEngagement } from '../context/EngagementContext';
import { timeLeft, type Campaign } from '../lib/campaigns';
import { remainingCoupons } from '../lib/coupons';
import { colors } from '../theme';

/** Campaign line with "Kuponu al"; after claiming, the code to show at the counter. */
export function CampaignBox({ campaign }: { campaign: Campaign }) {
  const { now } = useCampaigns();
  const { coupons, userKey, claim } = useEngagement();
  const coupon = coupons.find((c) => c.campaignId === campaign.id && c.userKey === userKey);
  const remaining = remainingCoupons(campaign, coupons);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.box}>
      <Text style={styles.message}>🏷️ {campaign.message}</Text>
      <Text style={styles.time}>
        {timeLeft(campaign, now)}
        {remaining !== null ? ` · ${remaining} kupon kaldı` : ''}
      </Text>
      {coupon ? (
        <View style={styles.code}>
          <Text style={styles.codeLabel}>
            {coupon.redeemedAt ? 'Kupon kullanıldı' : "Kasada göster · QR'ı Kampanyalar → Kuponlarım'da"}
          </Text>
          <Text style={[styles.codeText, coupon.redeemedAt && styles.used]}>{coupon.code}</Text>
        </View>
      ) : remaining === 0 ? (
        <Text style={styles.full}>Kuponlar tükendi</Text>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={() => setError(claim(campaign))}
        >
          <Text style={styles.buttonText}>Kuponu al</Text>
        </Pressable>
      )}
      {error && <Text style={styles.full}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 8, borderRadius: 10, backgroundColor: colors.cream, gap: 4 },
  message: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  time: { fontSize: 12, color: colors.textMuted },
  button: {
    marginTop: 2,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  pressed: { opacity: 0.8 },
  full: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  code: {
    marginTop: 2,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  codeLabel: { fontSize: 11, color: colors.textMuted },
  codeText: { fontSize: 18, fontWeight: '800', letterSpacing: 2, color: colors.text },
  used: { textDecorationLine: 'line-through', color: colors.textMuted },
});
