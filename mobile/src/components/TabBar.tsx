import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { TabIcon, type IconName } from './TabIcon';

export type Screen =
  | 'home'
  | 'business'
  | 'map'
  | 'favorites'
  | 'campaigns'
  | 'more'
  | 'profile'
  | 'settings'
  | 'support'
  | 'verification'
  | 'about'
  | 'detail';

type Tab = { screen: Screen; label: string; icon: IconName };

const HOME: Tab = { screen: 'home', label: 'Ana Sayfa', icon: 'home' };
const MAP: Tab = { screen: 'map', label: 'Harita', icon: 'map' };
const CAMPAIGNS: Tab = { screen: 'campaigns', label: 'Kampanyalar', icon: 'tag' };
const MORE: Tab = { screen: 'more', label: 'Daha fazla', icon: 'menu' };

// The map sits in the middle of the bar
export const CUSTOMER_TABS: Tab[] = [HOME, CAMPAIGNS, MAP, { screen: 'favorites', label: 'Favoriler', icon: 'heart' }, MORE];
// Businesses have their panel instead of favorites
export const BUSINESS_TABS: Tab[] = [HOME, CAMPAIGNS, MAP, { screen: 'business', label: 'Panel', icon: 'chart' }, MORE];

// Pages opened from the "Daha fazla" list keep that tab highlighted
const MORE_PAGES: Screen[] = ['more', 'profile', 'settings', 'support', 'verification', 'about'];

type Props = {
  tabs: Tab[];
  current: Screen;
  onSelect: (screen: Screen) => void;
};

export function TabBar({ tabs, current, onSelect }: Props) {
  const active = tabs.some((t) => t.screen === current) ? current : MORE_PAGES.includes(current) ? 'more' : null;

  return (
    <View style={styles.bar}>
      {tabs.map(({ screen, label, icon }) => {
        const selected = active === screen;
        const color = selected ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={screen}
            style={styles.tab}
            onPress={() => onSelect(screen)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
          >
            <TabIcon name={icon} color={color} active={selected} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
    // Room for the iPhone home indicator
    paddingBottom: Platform.OS === 'ios' ? 26 : 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  label: { fontSize: 10 },
});
