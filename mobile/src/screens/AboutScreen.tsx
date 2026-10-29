import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';

import { BackButton } from '../components/BackButton';
import { LevelDot } from '../components/LevelDot';
import { Wordmark } from '../components/Wordmark';
import { useSettings } from '../context/SettingsContext';
import type { Role } from '../lib/auth';
import { BUSINESS_SLIDES, CUSTOMER_SLIDES } from '../lib/intro';
import { LEVELS } from '../lib/occupancy';
import { colors, themed } from '../theme';
import { InlineIcon } from '../components/Icon';
import { Pressable } from '../components/Pressable';

// The Tanıtım sayfası (mobile/public/tanitim), published with the web version
export const SITE_URL = 'https://erayerb.github.io/availy.app/v2/tanitim/';

/** What availy is and how to use it (for now the intro lives here). */
export function AboutScreen({ role, onBack }: { role: Role; onBack: () => void }) {
  const { look } = useSettings();
  const sections = role === 'business' ? BUSINESS_SLIDES : CUSTOMER_SLIDES;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Hakkında</Text>
      </View>

      <Wordmark size={44} />
      <Text style={styles.text}>
        Kafe, bar ve ortak çalışma alanı gibi mekanların anlık doluluğunu harita üzerinde gösterir.
      </Text>
      <Pressable style={styles.site} onPress={() => Linking.openURL(SITE_URL).catch(() => {})} accessibilityRole="link">
        <Text style={styles.siteText}>
          <InlineIcon name="world" /> Web sitemiz
        </Text>
        <Text style={styles.siteHint}>Tanıtım, bekleme listesi ve işletmeler için</Text>
      </Pressable>

      <Text style={styles.heading}>Nasıl kullanılır?</Text>
      {sections.map((section) => (
        <View key={section.title} style={styles.card}>
          <Text style={styles.cardTitle}>
            <InlineIcon name={section.icon} color={colors.primary} /> {section.title}
          </Text>
          {section.lines.map((line) => (
            <Text key={line} style={styles.text}>
              {line}
            </Text>
          ))}
          {section.legend && (
            <View style={styles.legend}>
              {LEVELS.map((level) => (
                <View key={level} style={styles.legendItem}>
                  <LevelDot level={level} size={14} />
                  <Text style={styles.legendText}>{look(level).label}</Text>
                </View>
              ))}
              <View style={styles.legendItem}>
                <LevelDot level="low" open={false} size={14} />
                <Text style={styles.legendText}>Kapalı</Text>
              </View>
            </View>
          )}
        </View>
      ))}

      <Text style={styles.note}>
        Mekan bilgileri © OpenStreetMap katkıcıları (ODbL lisansı). Doluluk, kullanıcıların check-in'lerinden
        hesaplanır. Prototip sürüm.
      </Text>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  site: { padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary, gap: 2 },
  siteText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  siteHint: { fontSize: 13, color: colors.textMuted },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 6 },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 13, color: colors.text },
  note: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
}));
