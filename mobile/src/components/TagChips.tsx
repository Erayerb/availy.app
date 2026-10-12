import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TAG_OPTIONS, type Tag } from '../lib/filters';

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
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#1f2937', borderColor: '#1f2937' },
  chipText: { fontSize: 13, color: '#1f2937', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
});
