import { createContext, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';
import { Tip } from './Tip';

import { useNotifications } from '../context/NotificationsContext';
import { colors, themed } from '../theme';
import { TabIcon } from './TabIcon';
import { Icon } from './Icon';
import { useCampaigns } from '../context/CampaignsContext';
import { useLoyalty } from '../context/LoyaltyContext';
import { couponValid } from '../lib/coupons';

type Actions = {
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  // Customers: coupons and loyalty cards (Kampanyalar > Kuponlarım); absent for businesses and guests
  onOpenWallet?: () => void;
};

/** Where the two icons lead; set once by the app so every tab can show them. */
export const HeaderActionsContext = createContext<Actions>({ onOpenProfile: () => {}, onOpenNotifications: () => {} });

/** Top right of every tab except the map: 🔔 notifications (with the unread count) and the profile. */
export function HeaderButtons(props: Partial<Actions>) {
  const actions = useContext(HeaderActionsContext);
  const onOpenProfile = props.onOpenProfile ?? actions.onOpenProfile;
  const onOpenNotifications = props.onOpenNotifications ?? actions.onOpenNotifications;
  const { unread } = useNotifications();
  const onOpenWallet = actions.onOpenWallet;
  const { coupons, now } = useCampaigns();
  const { programs } = useLoyalty();
  // A red dot when something is ready to use at the counter
  const ready =
    coupons.some((c) => !c.redeemedAt && couponValid(c, now)) || programs.some((p) => (p.member?.rewards ?? 0) > 0);
  return (
    <View style={styles.row}>
      {onOpenWallet && (
        <Tip
          id="campaignsButton"
          placement="below"
          align="center"
          shift={-40}
          radius={22}
          text="Kampanyalar burada: yakındaki indirimler, aldığın kuponlar, sadakat kartların ve puanla alabileceklerin."
        >
          <Pressable
            onPress={onOpenWallet}
            style={styles.button}
            hitSlop={8}
            accessibilityLabel={ready ? 'Kuponların ve kartların, kullanılabilir var' : 'Kuponların ve kartların'}
          >
            <Icon name="ticket" size={21} color={colors.text} />
            {ready && <View style={styles.dot} />}
          </Pressable>
        </Tip>
      )}
      <Pressable
        onPress={onOpenNotifications}
        style={styles.button}
        hitSlop={8}
        accessibilityLabel={unread ? `Bildirimler, ${unread} yeni` : 'Bildirimler'}
      >
        <TabIcon name="bell" color={colors.text} active={false} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </Pressable>
      <Pressable onPress={onOpenProfile} style={styles.button} hitSlop={8} accessibilityLabel="Profil">
        <TabIcon name="person" color={colors.text} active={false} />
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  dot: { position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
}));
