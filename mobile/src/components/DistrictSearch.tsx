import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from './Pressable';

import { useDistricts } from '../hooks/useDistricts';
import { foldTr } from '../lib/filters';
import { colors, themed } from '../theme';

const MAX_SHOWN = 6;

type Props = { value: string; onChange: (district: string) => void };

/** Semt: type a few letters, pick it from the list that opens below. */
export function DistrictSearch({ value, onChange }: Props) {
  const districts = useDistricts();
  const [open, setOpen] = useState(false);
  const typed = foldTr(value.trim());
  const matches = typed
    ? districts.filter((d) => foldTr(d).includes(typed) && foldTr(d) !== typed).slice(0, MAX_SHOWN)
    : [];

  return (
    <View style={styles.box}>
      <TextInput
        value={value}
        onChangeText={(text) => {
          onChange(text);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="🔍 Semt ara (ör. Kadıköy)"
        placeholderTextColor={colors.placeholder}
        autoCorrect={false}
        style={styles.input}
      />
      {open && matches.length > 0 && (
        <View style={styles.list}>
          {matches.map((d, i) => (
            <Pressable
              key={d}
              onPress={() => {
                onChange(d);
                setOpen(false);
              }}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
            >
              <Text style={styles.text}>{d}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { gap: 4 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.cream,
    fontSize: 16,
    color: colors.text,
  },
  list: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  row: { paddingVertical: 12, paddingHorizontal: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.cream },
  text: { fontSize: 15, color: colors.text },
}));
