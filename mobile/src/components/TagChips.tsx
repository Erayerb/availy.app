import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TAG_OPTIONS, type Tag } from '../lib/filters';
import { colors, themed } from '../theme';

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

type ChipProps = { label: string; active: boolean; onPress: () => void; disabled?: boolean };

export function Chip({ label, active, onPress, disabled = false }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled, selected: active }}
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
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
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  chipTextActive: { color: colors.onPrimary },
}));
