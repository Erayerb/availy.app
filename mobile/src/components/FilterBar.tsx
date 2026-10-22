import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { TAG_OPTIONS, type Tag } from '../lib/filters';
import { colors } from '../theme';

const TAG_ICONS: Record<Tag, string> = {
  socializing: '👥',
  coworking: '💻',
  entertainment: '🎉',
  quiet: '🤫',
  food: '🍽️',
  nightlife: '🌙',
  nature: '🌳',
};

type Props = {
  selected: Tag[];
  onToggle: (tag: Tag) => void;
  hideClosed: boolean;
  onHideClosedChange: (hide: boolean) => void;
  // v2 "Ziyaret ettiklerim": only venues I checked in at
  onlyVisited: boolean;
  onOnlyVisitedChange: (on: boolean) => void;
  visitedCount: number;
  onClear: () => void;
};

/** Map filters as one row of pills that scrolls sideways (like Snapchat's map). */
export function FilterBar({
  selected,
  onToggle,
  hideClosed,
  onHideClosedChange,
  onlyVisited,
  onOnlyVisitedChange,
  visitedCount,
  onClear,
}: Props) {
  const any = selected.length > 0 || hideClosed || onlyVisited;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.strip}
      keyboardShouldPersistTaps="handled"
    >
      {any && <Pill icon="✕" label="Temizle" active={false} onPress={onClear} />}
      <Pill
        icon="📍"
        label={`Ziyaret ettiklerim${visitedCount ? ` (${visitedCount})` : ''}`}
        active={onlyVisited}
        onPress={() => onOnlyVisitedChange(!onlyVisited)}
      />
      <Pill icon="🚪" label="Kapalıları gizle" active={hideClosed} onPress={() => onHideClosedChange(!hideClosed)} />
      {TAG_OPTIONS.map(({ tag, label }) => (
        <Pill key={tag} icon={TAG_ICONS[tag]} label={label} active={selected.includes(tag)} onPress={() => onToggle(tag)} />
      ))}
    </ScrollView>
  );
}

function Pill({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0 },
  // Room at both ends so the first and last pill's shadows are not cut off
  row: { gap: 8, paddingVertical: 6, paddingRight: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pillActive: { backgroundColor: colors.primary },
  icon: { fontSize: 15 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  labelActive: { color: colors.onPrimary },
});
