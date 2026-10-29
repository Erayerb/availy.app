import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';

import { BackButton } from '../components/BackButton';
import { VerificationSection } from '../components/business/VerificationSection';
import { colors, themed } from '../theme';

/** Ownership verification: designed, but switched off for the prototype (see CONTEXT.md). */
export function VerificationScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>İşletme doğrulama</Text>
      </View>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Yakında</Text>
        <Text style={styles.text}>
          Doğrulama henüz etkin değil. Şimdilik tüm işletme özellikleri doğrulama olmadan kullanılabilir.
        </Text>
      </View>
      {/* Shown for a preview only; inputs do not respond */}
      <View pointerEvents="none" style={styles.disabled} accessibilityState={{ disabled: true }}>
        <VerificationSection onVerified={() => {}} />
      </View>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  notice: { padding: 14, borderRadius: 14, backgroundColor: colors.cream, gap: 4 },
  noticeTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  disabled: { opacity: 0.45 },
}));
