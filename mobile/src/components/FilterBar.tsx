import { ScrollView, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';

import { TAG_OPTIONS, type Tag } from '../lib/filters';
import { colors, themed } from '../theme';
import { InlineIcon, type IconName } from './Icon';

const TAG_ICONS: Record<Tag, IconName> = {
  socializing: 'users',
  coworking: 'device-laptop',
  entertainment: 'confetti',
  quiet: 'volume-off',
  food: 'tools-kitchen-2',
  nightlife: 'moon',
  wifi: 'wifi',
};

type Props = {
  selected: Tag[];
  onToggle: (tag: Tag) => void;
  hideClosed: boolean;
  onHideClosedChange: (hide: boolean) => void;
  // v2 "Trendler": venues most people checked in at in the last 24 hours
  onlyTrending: boolean;
  onOnlyTrendingChange: (on: boolean) => void;
};

/** Map filters as one small row of pills that scrolls sideways (like Snapchat's map). */
export function FilterBar({ selected, onToggle, hideClosed, onHideClosedChange, onlyTrending, onOnlyTrendingChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.strip}
      keyboardShouldPersistTaps="handled"
    >
      <Pill icon="flame" label="Trendler" active={onlyTrending} onPress={() => onOnlyTrendingChange(!onlyTrending)} />
      <Pill icon="door" label="Kapalıları gizle" active={hideClosed} onPress={() => onHideClosedChange(!hideClosed)} />
      {TAG_OPTIONS.map(({ tag, label }) => (
        <Pill key={tag} icon={TAG_ICONS[tag]} label={label} active={selected.includes(tag)} onPress={() => onToggle(tag)} />
      ))}
    </ScrollView>
  );
}

function Pill({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
    >
      <Text style={[styles.icon, active && styles.labelActive]}><InlineIcon name={icon} /></Text>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  strip: { flexGrow: 0 },
  // Room at both ends so the first and last pill's shadows are not cut off
  row: { gap: 6, paddingVertical: 4, paddingLeft: 12, paddingRight: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  pillActive: { backgroundColor: colors.primary },
  icon: { fontSize: 14, color: colors.text },
  label: { fontSize: 12, fontWeight: '600', color: colors.text },
  labelActive: { color: colors.onPrimary },
}));
