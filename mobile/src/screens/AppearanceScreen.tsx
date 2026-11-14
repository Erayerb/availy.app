import { ScrollView, StyleSheet, View } from 'react-native';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { BackButton } from '../components/BackButton';
import { LevelDot } from '../components/LevelDot';
import { SettingsBlock, SettingsSection, SettingsSwitch, TINT } from '../components/Settings';
import { useSettings, type Appearance } from '../context/SettingsContext';
import { LEVELS } from '../lib/occupancy';
import { colors, darkColors, lightColors, themed, type Palette } from '../theme';

const OPTIONS: { id: Appearance; label: string; hint: string }[] = [
  { id: 'system', label: 'Cihaz ayarı', hint: 'Telefonun açık / koyu ayarını takip eder.' },
  { id: 'light', label: 'Açık', hint: 'Her zaman krem zemin.' },
  { id: 'dark', label: 'Koyu', hint: 'Her zaman koyu kahve zemin; gece gözü yormaz.' },
];

const SWATCH: Record<Exclude<Appearance, 'system'>, Palette> = { light: lightColors, dark: darkColors };

/** Daha fazla > Görünüm: follow the phone, or always light / dark; and the color-blind friendly colors. */
export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const { appearance, colorBlind, update, look } = useSettings();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Görünüm</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tema</Text>
        <View style={styles.themes}>
          {OPTIONS.map((o) => {
            const on = appearance === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => update({ appearance: o.id })}
                style={[styles.theme, on && styles.themeOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                {o.id === 'system' ? (
                  <View style={styles.swatches}>
                    <Swatch palette={lightColors} half />
                    <Swatch palette={darkColors} half right />
                  </View>
                ) : (
                  <Swatch palette={SWATCH[o.id]} />
                )}
                <Text style={[styles.themeLabel, on && styles.themeLabelOn]}>{o.label}</Text>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.footer}>{OPTIONS.find((o) => o.id === appearance)?.hint}</Text>
      </View>

      <SettingsSection title="Renkler">
        <SettingsSwitch
          icon="eye"
          tint={TINT.blue}
          title="Renk körlüğü dostu mod"
          subtitle="Doluluk renkleri ayırt edilebilir tonlara geçer, noktalara simge eklenir."
          value={colorBlind}
          onChange={(v) => update({ colorBlind: v })}
        />
        <SettingsBlock>
          <View style={styles.preview}>
            {LEVELS.map((level) => (
              <View key={level} style={styles.previewItem}>
                <LevelDot level={level} size={18} />
                <Text style={styles.text}>{look(level).label}</Text>
              </View>
            ))}
            <View style={styles.previewItem}>
              <LevelDot level="low" open={false} size={18} />
              <Text style={styles.text}>Kapalı</Text>
            </View>
          </View>
        </SettingsBlock>
      </SettingsSection>
    </ScrollView>
  );
}

/** A tiny page of the theme: background, a card and a red button. */
function Swatch({ palette, half = false, right = false }: { palette: Palette; half?: boolean; right?: boolean }) {
  return (
    <View
      style={[
        styles.swatch,
        half && (right ? styles.swatchRight : styles.swatchLeft),
        { backgroundColor: palette.background, borderColor: colors.border },
      ]}
    >
      <View style={[styles.swatchCard, { backgroundColor: palette.surface }]} />
      <View style={[styles.swatchButton, { backgroundColor: palette.primary }]} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE, gap: 20 },
  section: { gap: 7 },
  sectionTitle: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginLeft: 14 },
  footer: { fontSize: 12.5, color: colors.textMuted, marginHorizontal: 14 },
  themes: { flexDirection: 'row', gap: 10 },
  theme: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  themeOn: { borderColor: colors.primary },
  themeLabel: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  themeLabelOn: { color: colors.text },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  flex: { flex: 1, gap: 2 },
  label: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  text: { fontSize: 14, color: colors.text },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  colorCard: { padding: 16, gap: 14 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatches: { flexDirection: 'row' },
  swatch: { width: 52, height: 70, borderRadius: 10, borderWidth: 1, padding: 6, gap: 5, justifyContent: 'flex-end' },
  swatchLeft: { width: 26, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 },
  swatchRight: { width: 26, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 },
  swatchCard: { height: 16, borderRadius: 4 },
  swatchButton: { height: 8, borderRadius: 4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
}));
