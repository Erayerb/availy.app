import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { ThemedSwitch } from '../components/ThemedSwitch';
import { useSettings } from '../context/SettingsContext';
import { safetyApi } from '../lib/safety';
import { socialApi, type Privacy } from '../lib/social';
import { colors, themed } from '../theme';

type Props = {
  token: string | null; // registered users only; privacy settings are on the server
  onBack: () => void;
  onOpenPermissions: () => void;
  onOpenLegal: () => void;
};

/** v2 "Gizlilik": who sees my check-ins, ranking, search, and the people I blocked. */
export function PrivacyScreen({ token, onBack, onOpenPermissions, onOpenLegal }: Props) {
  const { privateByDefault, update } = useSettings();
  const [privacy, setPrivacy] = useState<Privacy | null>(null);
  const [blocked, setBlocked] = useState<{ username: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    socialApi
      .privacy(token)
      .then(({ share_checkins, show_in_leaderboard, searchable }) => setPrivacy({ share_checkins, show_in_leaderboard, searchable }))
      .catch(() => setError('Gizlilik ayarları yüklenemedi.'));
    safetyApi.blocked(token).then(setBlocked).catch(() => {});
  }, [token]);
  useEffect(load, [load]);

  const change = async (patch: Partial<Privacy>) => {
    if (!token || !privacy) return;
    const before = privacy;
    setPrivacy({ ...privacy, ...patch });
    try {
      setPrivacy(await socialApi.setPrivacy(token, patch));
      setError(null);
    } catch {
      setPrivacy(before);
      setError('Kaydedilemedi, tekrar dene.');
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Gizlilik</Text>
      </View>

      <View style={styles.card}>
        <Row
          title="Check-in'lerim varsayılan olarak gizli olsun"
          subtitle="Check-in ekranında Gizli check-in açık başlar. Gizli check-in doluluğa sayılır ama adın görünmez."
          value={privateByDefault}
          onChange={(v) => update({ privateByDefault: v })}
        />
        {token && privacy && (
          <>
            <Row
              title="Arkadaşlarım check-in'lerimi görsün"
              subtitle="Kapalıysa check-in'lerin Akış'ta ve profilinde görünmez. Konumun hiçbir zaman paylaşılmaz."
              value={privacy.share_checkins}
              onChange={(v) => change({ share_checkins: v })}
            />
            <Row
              title="Herkese açık sıralamada görüneyim"
              subtitle="Kapalıysa yalnızca arkadaşlarının sıralamasında görünürsün."
              value={privacy.show_in_leaderboard}
              onChange={(v) => change({ show_in_leaderboard: v })}
            />
            <Row
              title="Kullanıcı adımla aranabileyim"
              subtitle="Kapalıysa yalnızca QR kodun ya da davet bağlantınla eklenebilirsin."
              value={privacy.searchable}
              onChange={(v) => change({ searchable: v })}
            />
          </>
        )}
        {!token && <Text style={styles.muted}>Diğer gizlilik ayarları için kayıt ol.</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {token && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Engellenenler · {blocked.length}</Text>
          <Text style={styles.muted}>
            Engellediğin kişi seni ekleyemez; yorumlarınızı birbiriniz göremezsiniz. Bir kişiyi profilinden engelleyebilirsin.
          </Text>
          {blocked.map((b) => (
            <View key={b.username} style={styles.row}>
              <Text style={[styles.text, styles.flex]}>@{b.username}</Text>
              <Pressable onPress={() => safetyApi.unblock(token, b.username).then(load)} hitSlop={6}>
                <Text style={styles.link}>Engeli kaldır</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.card} onPress={onOpenPermissions}>
        <Text style={styles.sectionTitle}>Konum ve izinler ›</Text>
        <Text style={styles.muted}>Konum, kamera ve bildirim izinleri ne için kullanılıyor.</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={onOpenLegal}>
        <Text style={styles.sectionTitle}>Kullanım koşulları ›</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ title, subtitle, value, onChange }: { title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.muted}>{subtitle}</Text>
      </View>
      <ThemedSwitch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '600' },
  error: { fontSize: 13, color: colors.danger },
}));
