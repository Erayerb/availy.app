import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';

import { useCampaigns } from '../context/CampaignsContext';
import { timeLeft, type Campaign } from '../lib/campaigns';
import { remainingCoupons } from '../lib/coupons';
import { colors, themed } from '../theme';
import { GradientFill } from './GradientFill';
import { Icon, InlineIcon } from './Icon';

/** Campaign line with "Kuponu al"; after claiming, the code to show at the counter. */
export function CampaignBox({ campaign }: { campaign: Campaign }) {
  const { now, coupons, claim } = useCampaigns();
  const coupon = coupons.find((c) => c.campaignId === campaign.id);
  const remaining = remainingCoupons(campaign);
  const [error, setError] = useState<string | null>(null);
  const [taking, setTaking] = useState(false);

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <View style={styles.iconBox}>
          <GradientFill colors={['#7A2E1F', '#D9480F']} />
          <Icon name="tag" size={18} color="#fff" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.message}>{campaign.message}</Text>
          <View style={styles.pills}>
            <Text style={styles.pill}><InlineIcon name="clock" /> {timeLeft(campaign, now)}</Text>
          </View>
        </View>
      </View>
      {coupon ? (
        <View style={styles.code}>
          <Text style={[styles.codeText, coupon.redeemedAt && styles.used]}>{coupon.code}</Text>
          <Text style={styles.codeLabel}>
            {coupon.redeemedAt ? 'Kupon kullanıldı' : "Kasada göster · QR'ı Kampanyalar → Kuponlarım'da"}
          </Text>
        </View>
      ) : remaining === 0 ? (
        <Text style={styles.full}>Kuponlar tükendi</Text>
      ) : campaign.checkinOnly ? (
        <Text style={styles.checkin}><InlineIcon name="map-pin" /> Check-in yap, kuponu kap</Text>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.button, (pressed || taking) && styles.pressed]}
          disabled={taking}
          onPress={async () => {
            setTaking(true);
            setError(await claim(campaign));
            setTaking(false);
          }}
        >
          <Text style={styles.buttonText}>Kuponu al</Text>
        </Pressable>
      )}
      {error && <Text style={styles.full}>{error}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 5 },
  message: { fontSize: 15, fontWeight: '700', color: colors.text },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { fontSize: 12, fontWeight: '600', color: colors.text, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.cream },
  button: { paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  code: { alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary },
  codeText: { fontSize: 20, fontWeight: '800', letterSpacing: 2, color: colors.text },
  used: { textDecorationLine: 'line-through', color: colors.textMuted },
  codeLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  full: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  checkin: { fontSize: 14, fontWeight: '700', color: colors.primary },
}));
