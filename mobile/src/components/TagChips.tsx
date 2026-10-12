import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TAG_OPTIONS, type Tag } from '../lib/filters';
import { colors } from '../theme';

type Props = {
  selected: Tag[];
  onToggle: (tag: Tag) => void;
};

export function TagChips({ selected, onToggle }: Props) {
  return (
    <View style={styles.chips}>
      {TAG_OPTIONS.map(({ tag, label }) => (
        <Chip key={tag} label={label} active={selected.includes(tag)} onPress={() => onToggle(tag)} />
      ))}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  chipTextActive: { color: colors.onPrimary },
});
