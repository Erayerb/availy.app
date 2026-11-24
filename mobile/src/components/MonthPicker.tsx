import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { colors, themed } from '../theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useHoldTips } from '../lib/tips';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** "Kasım 2026 ▾": a chip that opens the last months to choose from (0 = this month, 1 = last month...). */
export function MonthPicker({ value, onChange, count = 12, light = false }: { value: number; onChange: (monthsBack: number) => void; count?: number; light?: boolean }) {
  const [open, setOpen] = useState(false);
  useHoldTips(open);
  const now = new Date();
  const label = (back: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  return (
    <>
      <Pressable style={[styles.chip, light && styles.chipLight]} onPress={() => setOpen(true)} hitSlop={6} accessibilityLabel="Ay seç">
        <Text style={[styles.chipText, light && styles.chipTextLight]}>{label(value)}</Text>
        <Icon name="chevron-down" size={15} color={light ? '#fff' : colors.text} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Ay seç</Text>
          <ScrollView style={styles.list}>
            {Array.from({ length: count }, (_, back) => (
              <Pressable
                key={back}
                style={[styles.row, back === value && styles.rowOn]}
                onPress={() => {
                  onChange(back);
                  setOpen(false);
                }}
              >
                <Text style={[styles.rowText, back === value && styles.rowTextOn]}>
                  {label(back)}
                  {back === 0 ? ' (bu ay)' : ''}
                </Text>
                {back === value && <Icon name="check" size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.cream },
  chipLight: { backgroundColor: 'rgba(255,255,255,0.22)' },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipTextLight: { color: '#fff' },
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '60%', padding: 18, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.surface, gap: 8 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 6, borderRadius: 10 },
  rowOn: { backgroundColor: colors.cream },
  rowText: { fontSize: 16, color: colors.text },
  rowTextOn: { fontWeight: '800', color: colors.primary },
}));
