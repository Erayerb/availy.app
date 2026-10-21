import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Tag } from '../lib/filters';
import { ClearButton, TogglePill } from './ClearButton';
import { TagChips } from './TagChips';
import { colors } from '../theme';

type Props = {
  selected: Tag[];
  onToggle: (tag: Tag) => void;
  hideClosed: boolean;
  onHideClosedChange: (hide: boolean) => void;
  onClear: () => void;
};

/** Only a "Filtreler" button on the map; tapping it opens the filter card. */
export function FilterBar({ selected, onToggle, hideClosed, onHideClosedChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  // Selected purposes plus "Kapalıları gizle"
  const count = selected.length + (hideClosed ? 1 : 0);
  const hasSelection = count > 0;
  const title = (
    <Pressable onPress={() => setOpen((o) => !o)} style={styles.toggle} hitSlop={8}>
      <Text style={styles.title}>Filtreler{count > 0 ? ` (${count})` : ''}</Text>
      <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
    </Pressable>
  );

  // Folded: no card, only the "Filtreler" button and the two quick pills, each on its own
  if (!open) {
    return (
      <View style={styles.folded} pointerEvents="box-none">
        <View style={styles.button}>{title}</View>
        <View style={styles.pills} pointerEvents="box-none">
          <View style={styles.pillBack}>
            <ClearButton onPress={onClear} disabled={!hasSelection} />
          </View>
          <View style={styles.pillBack}>
            <TogglePill label="Kapalıları gizle" active={hideClosed} onPress={() => onHideClosedChange(!hideClosed)} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {title}
        <View style={styles.pills}>
          <ClearButton onPress={onClear} disabled={!hasSelection} />
          <TogglePill label="Kapalıları gizle" active={hideClosed} onPress={() => onHideClosedChange(!hideClosed)} />
        </View>
      </View>
      <TagChips selected={selected} onToggle={onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: colors.surface,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  folded: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  // Solid background so the faded "Kapalıları gizle" pill stays readable on the map
  pillBack: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pills: { alignItems: 'flex-end', gap: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 10, color: colors.textMuted },
});
