import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { BackButton } from '../components/BackButton';
import { LEGAL_DOCS, type LegalDoc } from '../lib/legal';
import { colors, themed } from '../theme';

type Props = { initial?: LegalDoc['id']; onBack: () => void };

/** Gizlilik politikası (KVKK aydınlatma metni) and kullanım koşulları. */
export function LegalScreen({ initial = 'privacy', onBack }: Props) {
  const [id, setId] = useState<LegalDoc['id']>(initial);
  const doc = LEGAL_DOCS.find((d) => d.id === id)!;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Kullanım koşulları</Text>
      </View>
      <View style={styles.tabs}>
        {LEGAL_DOCS.map((d) => (
          <Pressable key={d.id} onPress={() => setId(d.id)} style={[styles.tab, id === d.id && styles.tabActive]}>
            <Text style={[styles.tabText, id === d.id && styles.tabTextActive]}>{d.title}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.muted}>Son güncelleme: {doc.updated}</Text>
      {doc.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.paragraphs.map((p) => (
            <Text key={p} style={styles.text}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.cream },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabTextActive: { color: colors.onPrimary },
  section: { gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, lineHeight: 20, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
}));
