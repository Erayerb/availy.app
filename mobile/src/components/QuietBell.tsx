import { StyleSheet } from 'react-native';

import { useFavorites } from '../context/FavoritesContext';
import { useSettings } from '../context/SettingsContext';
import { useUpgrade } from '../context/UpgradeContext';
import { haptics } from '../lib/haptics';
import { colors, themed } from '../theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

/** Favoriler, on a card under the heart: availo+ "Favorilerim sakinleşince" for this venue. On for every
 * favourite (no bell to turn on); a tap turns this one off. Without availo+ it shows what availo+ gives. */
export function QuietBell({ venueId }: { venueId: number }) {
  const { quietOn, setQuiet } = useFavorites();
  const settings = useSettings();
  const { promptUpgrade } = useUpgrade();
  const on = settings.premium && settings.favoriteQuietNotifications && quietOn(venueId);
  const press = () => {
    haptics.tap();
    if (!settings.premium) return promptUpgrade('Favorilerin sakinleşince zil açmadan haber almak availo+ ile.');
    // Turned off in Bildirim ayarları: the bell turns it back on, for this one
    if (!settings.favoriteQuietNotifications) {
      settings.update({ favoriteQuietNotifications: true });
      setQuiet(venueId, true);
      return;
    }
    setQuiet(venueId, !quietOn(venueId));
  };
  return (
    <Pressable
      onPress={press}
      hitSlop={8}
      style={styles.bell}
      accessibilityLabel={on ? 'Sakinleşince haber verme' : 'Sakinleşince haber ver'}
      accessibilityState={{ checked: on }}
    >
      <Icon name={on ? 'bell-ringing' : 'bell-off'} size={15} color={on ? colors.primary : colors.textMuted} />
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  bell: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
}));
