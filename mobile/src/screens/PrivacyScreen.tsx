import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { BackButton } from '../components/BackButton';
import { SettingsBlock, SettingsLink, SettingsSection, SettingsSwitch, TINT } from '../components/Settings';
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
      .then(({ share_checkins, show_in_leaderboard, searchable, suggest_by_venues, regular_public, stats_visibility, moment_audience }) =>
        setPrivacy({
          share_checkins,
          show_in_leaderboard,
          searchable,
          suggest_by_venues: suggest_by_venues ?? true,
          regular_public: regular_public ?? false,
          stats_visibility: stats_visibility === 'me' ? 'me' : 'friends',
          moment_audience: moment_audience === 'friends' ? 'friends' : 'everyone',
        }),
      )
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
        <Text style={styles.title}>Gizlilik ayarları</Text>
      </View>

      <SettingsSection title="Check-in'ler" footer="Konumun hiçbir zaman paylaşılmaz. Gizli check-in doluluğa sayılır ama adın görünmez.">
        <SettingsSwitch
          icon="lock"
          tint={TINT.dark}
          title="Varsayılan olarak gizli"
          subtitle="Check-in ekranında Gizli check-in açık başlar."
          value={privateByDefault}
          onChange={(v) => update({ privateByDefault: v })}
        />
        {token && privacy ? (
          <SettingsSwitch
            icon="users"
            tint={TINT.blue}
            title="Arkadaşlarım görsün"
            subtitle="Kapalıysa check-in'lerin Akış'ta ve profilinde görünmez."
            value={privacy.share_checkins}
            onChange={(v) => change({ share_checkins: v })}
          />
        ) : null}
      </SettingsSection>

      {token && privacy && (
        <>
          <SettingsSection title="Profil ve bulunabilirlik">
            <SettingsSwitch
              icon="trophy"
              tint={TINT.gold}
              title="Herkese açık sıralama"
              subtitle="Kapalıysa yalnızca arkadaşlarının sıralamasında görünürsün."
              value={privacy.show_in_leaderboard}
              onChange={(v) => change({ show_in_leaderboard: v })}
            />
            <SettingsSwitch
              icon="search"
              tint={TINT.blue}
              title="Kullanıcı adımla aranabileyim"
              subtitle="Kapalıysa yalnızca QR kodun ya da davet bağlantınla eklenebilirsin."
              value={privacy.searchable}
              onChange={(v) => change({ searchable: v })}
            />
            <SettingsSwitch
              icon="user-plus"
              tint={TINT.green}
              title="Arkadaş önerilerinde görün"
              subtitle="Aynı mekanlara gittiğin kişilere önerilirsin (gizli check-in'ler sayılmaz)."
              value={privacy.suggest_by_venues}
              onChange={(v) => change({ suggest_by_venues: v })}
            />
            <SettingsSwitch
              icon="crown"
              tint={TINT.gold}
              title="Müdavimliğim herkese açık"
              subtitle="Mekan sayfasında “Buranın müdavimi @sen” yazar. Kapalıysa yalnızca arkadaşların görür."
              value={privacy.regular_public}
              onChange={(v) => change({ regular_public: v })}
            />
          </SettingsSection>

          <SettingsSection title="İstatistiklerimi kimler görsün?" footer="Puanların, check-in ve keşif sayın, haftalık serin ve rozetlerin.">
            <SettingsLink
              icon="users"
              tint={TINT.blue}
              title="Arkadaşlarım"
              selected={privacy.stats_visibility === 'friends'}
              onPress={() => change({ stats_visibility: 'friends' })}
            />
            <SettingsLink
              icon="lock"
              tint={TINT.dark}
              title="Sadece ben"
              selected={privacy.stats_visibility === 'me'}
              onPress={() => change({ stats_visibility: 'me' })}
            />
          </SettingsSection>

          <SettingsSection
            title="“Şu an burada” fotoğraflarım"
            footer="Check-in'de çektiğin fotoğraflar mekan kapanana kadar sayfasında görünür, kapanıştan 1 saat sonra silinir. Paylaşırken her seferinde değiştirebilirsin."
          >
            <SettingsLink
              icon="world"
              tint={TINT.green}
              title="Herkes görsün"
              selected={privacy.moment_audience !== 'friends'}
              onPress={() => change({ moment_audience: 'everyone' })}
            />
            <SettingsLink
              icon="users"
              tint={TINT.blue}
              title="Sadece arkadaşlarım"
              selected={privacy.moment_audience === 'friends'}
              onPress={() => change({ moment_audience: 'friends' })}
            />
          </SettingsSection>

          <SettingsSection
            title={`Engellenenler · ${blocked.length}`}
            footer="Engellediğin kişi seni ekleyemez; yorumlarınızı birbiriniz göremezsiniz. Bir kişiyi profilinden engelleyebilirsin."
          >
            {blocked.length === 0 ? (
              <SettingsBlock>
                <Text style={styles.muted}>Kimseyi engellemedin.</Text>
              </SettingsBlock>
            ) : (
              blocked.map((b) => (
                <SettingsBlock key={b.username}>
                  <View style={styles.row}>
                    <Text style={[styles.text, styles.flex]}>@{b.username}</Text>
                    <Pressable onPress={() => safetyApi.unblock(token, b.username).then(load)} hitSlop={6}>
                      <Text style={styles.link}>Engeli kaldır</Text>
                    </Pressable>
                  </View>
                </SettingsBlock>
              ))
            )}
          </SettingsSection>
        </>
      )}
      {!token && <Text style={styles.muted}>Diğer gizlilik ayarları için kayıt ol.</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <SettingsSection>
        <SettingsLink icon="location" tint={TINT.green} title="Konum ve izinler" onPress={onOpenPermissions} />
        <SettingsLink icon="bookmarks" tint={TINT.grey} title="Kullanım koşulları" onPress={onOpenLegal} />
      </SettingsSection>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE, gap: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  choice: { gap: 6 },
  choiceRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  choiceChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.cream },
  choiceChipOn: { backgroundColor: colors.primary },
  choiceText: { fontSize: 14, fontWeight: '600', color: colors.text },
  choiceTextOn: { color: colors.onPrimary },
  flex: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '600' },
  error: { fontSize: 13, color: colors.danger },
}));
