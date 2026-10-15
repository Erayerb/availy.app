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

/** Filter card that folds into a single row so it doesn't cover the map. */
export function FilterBar({ selected, onToggle, hideClosed, onHideClosedChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const count = selected.length;
  const hasSelection = count > 0 || hideClosed;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable onPress={() => setOpen((o) => !o)} style={styles.toggle} hitSlop={8}>
          <Text style={styles.title}>
            Filtreler{count > 0 ? ` (${count})` : ''}
          </Text>
          <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
        </Pressable>
        <View style={styles.pills}>
          <ClearButton onPress={onClear} disabled={!hasSelection} />
          <TogglePill label="Kapalıları gizle" active={hideClosed} onPress={() => onHideClosedChange(!hideClosed)} />
        </View>
      </View>
      {open && <TagChips selected={selected} onToggle={onToggle} />}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pills: { alignItems: 'flex-end', gap: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingVertical: 4 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 10, color: colors.textMuted },
});
