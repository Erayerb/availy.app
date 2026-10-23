import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { useSettings, type Appearance } from '../context/SettingsContext';
import { colors, darkColors, lightColors, themed, type Palette } from '../theme';

const OPTIONS: { id: Appearance; label: string; hint: string }[] = [
  { id: 'system', label: 'Cihaz ayarı', hint: 'Telefonun açık / koyu ayarını takip eder.' },
  { id: 'light', label: 'Açık', hint: 'Her zaman krem zemin.' },
  { id: 'dark', label: 'Koyu', hint: 'Her zaman koyu kahve zemin; gece gözü yormaz.' },
];

/** Daha fazla > Görünüm: follow the phone, or always light / dark. */
export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const { appearance, update } = useSettings();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Görünüm</Text>
      </View>

      <View style={styles.card}>
        {OPTIONS.map((o, i) => (
          <Pressable
            key={o.id}
            onPress={() => update({ appearance: o.id })}
            style={[styles.row, i > 0 && styles.divider]}
            accessibilityRole="radio"
            accessibilityState={{ selected: appearance === o.id }}
          >
            {o.id === 'system' ? (
              <View style={styles.swatches}>
                <Swatch palette={lightColors} half />
                <Swatch palette={darkColors} half />
              </View>
            ) : (
              <Swatch palette={o.id === 'dark' ? darkColors : lightColors} />
            )}
            <View style={styles.flex}>
              <Text style={styles.label}>{o.label}</Text>
              <Text style={styles.muted}>{o.hint}</Text>
            </View>
            <View style={[styles.radio, appearance === o.id && styles.radioOn]}>
              {appearance === o.id && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

/** A tiny page of the theme: background, a card and a red button. */
function Swatch({ palette, half = false }: { palette: Palette; half?: boolean }) {
  return (
    <View style={[styles.swatch, half && styles.swatchHalf, { backgroundColor: palette.background, borderColor: colors.border }]}>
      <View style={[styles.swatchCard, { backgroundColor: palette.surface }]} />
      <View style={[styles.swatchButton, { backgroundColor: palette.primary }]} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  flex: { flex: 1, gap: 2 },
  label: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  swatches: { flexDirection: 'row' },
  swatch: { width: 44, height: 56, borderRadius: 10, borderWidth: 1, padding: 6, gap: 5, justifyContent: 'flex-end' },
  swatchHalf: { width: 22, borderRadius: 6 },
  swatchCard: { height: 16, borderRadius: 4 },
  swatchButton: { height: 8, borderRadius: 4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
}));
