import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { haptics } from '../lib/haptics';
import { Pressable } from './Pressable';

import { colors, isDarkScheme, themed } from '../theme';
import { TabIcon, type IconName } from './TabIcon';

export type Screen =
  | 'home'
  | 'business'
  | 'customers'
  | 'map'
  | 'favorites'
  | 'campaigns'
  | 'more'
  | 'profile'
  | 'settings'
  | 'support'
  | 'subscription'
  | 'friends'
  | 'verification'
  | 'about'
  | 'levels'
  | 'checkin'
  | 'addVenue'
  | 'permissions'
  | 'location'
  | 'notifications'
  | 'privacy'
  | 'legal'
  | 'user'
  | 'appearance'
  | 'venueList'
  | 'admin'
  | 'detail';

type Tab = { screen: Screen; label: string; icon: IconName };

const HOME: Tab = { screen: 'home', label: 'Ana sayfa', icon: 'home' };
const MAP: Tab = { screen: 'map', label: 'Harita', icon: 'map' };
const CAMPAIGNS: Tab = { screen: 'campaigns', label: 'Kampanyalar', icon: 'tag' };
const MORE: Tab = { screen: 'more', label: 'Daha fazla', icon: 'menu' };

// The map sits in the middle of the bar; customers' campaigns are under "Daha fazla" (v2)
export const CUSTOMER_TABS: Tab[] = [
  HOME,
  { screen: 'friends', label: 'Sosyal', icon: 'people' },
  MAP,
  { screen: 'favorites', label: 'Favoriler', icon: 'heart' },
  MORE,
];
// Businesses: panel (where the app opens), customers, map (middle; competitors), campaigns
export const BUSINESS_TABS: Tab[] = [
  { screen: 'business', label: 'Panel', icon: 'chart' },
  { screen: 'customers', label: 'Müşteriler', icon: 'people' },
  MAP,
  CAMPAIGNS,
  MORE,
];

// Pages opened from the "Daha fazla" list keep that tab highlighted
const MORE_PAGES: Screen[] = ['more', 'campaigns', 'appearance', 'permissions', 'location', 'privacy', 'legal', 'subscription', 'profile', 'settings', 'support', 'verification', 'about'];

type Props = {
  tabs: Tab[];
  current: Screen;
  onSelect: (screen: Screen) => void;
};

export function TabBar({ tabs, current, onSelect }: Props) {
  const active = tabs.some((t) => t.screen === current)
    ? current
    : MORE_PAGES.includes(current)
      ? 'more'
      : current === 'checkin' || current === 'addVenue'
        ? 'map'
        : null;

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <BlurView intensity={40} tint={isDarkScheme() ? 'dark' : 'light'} style={styles.pill}>
        <View style={styles.tint}>
        {tabs.map(({ screen, label, icon }) => {
          const selected = active === screen;
          const color = selected ? colors.primary : colors.text;
          return (
            <Pressable
              key={screen}
              style={[styles.tab, selected && styles.tabActive]}
              onPress={() => {
                if (!selected) haptics.tap();
                onSelect(screen);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              <TabIcon name={icon} color={color} active={selected} />
              <Text style={[styles.label, { color }, selected && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
        </View>
      </BlurView>
    </View>
  );
}

// Height of the floating bar over the bottom of every page: pages keep this much room under their content
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 76;
export const TAB_BAR_SPACE = TAB_BAR_HEIGHT + 24;

// A rounded, see-through bar floating over the page (as in iOS's own apps); the chosen tab in a pill of its own
const styles = themed(() => StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 6,
    // Room for the iPhone home indicator
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  pill: {
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tint: { flexDirection: 'row', padding: 5, backgroundColor: isDarkScheme() ? 'rgba(35, 27, 23, 0.72)' : 'rgba(255, 252, 246, 0.72)' },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 7, borderRadius: 28 },
  tabActive: { backgroundColor: isDarkScheme() ? 'rgba(245, 235, 221, 0.12)' : 'rgba(43, 29, 22, 0.08)' },
  label: { fontSize: 10.5 },
  labelActive: { fontWeight: '700' },
}));
