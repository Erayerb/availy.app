import { createContext, useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNotifications } from '../context/NotificationsContext';
import { colors } from '../theme';
import { TabIcon } from './TabIcon';

type Actions = { onOpenProfile: () => void; onOpenNotifications: () => void };

/** Where the two icons lead; set once by the app so every tab can show them. */
export const HeaderActionsContext = createContext<Actions>({ onOpenProfile: () => {}, onOpenNotifications: () => {} });

/** Top right of every tab except the map: 🔔 notifications (with the unread count) and the profile. */
export function HeaderButtons(props: Partial<Actions>) {
  const actions = useContext(HeaderActionsContext);
  const onOpenProfile = props.onOpenProfile ?? actions.onOpenProfile;
  const onOpenNotifications = props.onOpenNotifications ?? actions.onOpenNotifications;
  const { unread } = useNotifications();
  return (
    <View style={styles.row}>
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
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
});
