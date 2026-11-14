import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Text } from '../components/Text';

import { BackButton } from '../components/BackButton';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { useSettings } from '../context/SettingsContext';
import { automationApi, type Automation } from '../lib/schedules';
import { colors, themed } from '../theme';
import { SettingsSection, SettingsSwitch, TINT } from '../components/Settings';
import { AccountSettings } from './ProfileScreen';
import { InlineIcon } from '../components/Icon';

type Props = {
  onBack: () => void;
  isBusiness: boolean;
  guest: boolean; // no friends or reviews to be notified about
  venueId: number | null; // business: its venue (for the automation settings)
  // Business: user name, e-mail, password, freeze and delete are here (customers: Profil ayarları)
  account: Parameters<typeof AccountSettings>[0] | null;
};

/** Customers: Bildirim ayarları. Businesses: Ayarlar (account, dead-hour alerts; the venue is edited in İşletme profili). */
export function SettingsScreen({ onBack, isBusiness, guest, venueId, account }: Props) {
  const { venues } = useVenuesByIds(venueId ? [venueId] : []);
  const venue = venues[0];
  const settings = useSettings();
  const { watchNotifications, update } = settings;
  // Business: ölü saat bildirimi and otomatik kampanya, kept (and run) on the server
  const token = isBusiness ? (account?.user.token ?? null) : null;
  const [automation, setAutomation] = useState<Automation | null>(null);
  useEffect(() => {
    if (token) automationApi.settings(token).then(setAutomation).catch(() => {});
  }, [token]);
  const changeAutomation = (patch: Partial<Automation>) => {
    if (!token || !automation) return;
    const next = { ...automation, ...patch };
    setAutomation(next);
    automationApi.saveSettings(token, next).catch(() => setAutomation(automation));
  };
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>{isBusiness ? 'Ayarlar' : 'Bildirim ayarları'}</Text>
      </View>

      {isBusiness && account && (
        <>
          <Text style={styles.sectionLabel}>Hesap</Text>
          <AccountSettings {...account} />
          <Text style={styles.sectionLabel}>Mekan ve bildirimler</Text>
        </>
      )}


      {isBusiness ? (
        <SettingsSection footer="Uygulaman kapalı olsa da çalışır.">
          <SettingsSwitch
            icon="moon"
            tint={TINT.purple}
            title="Ölü saat bildirimi"
            subtitle="Açıkken en az 2 müşteri Sakin bildirince haber düşer (en fazla 2 saatte bir)."
            value={automation?.dead_hour_alerts ?? true}
            onChange={(v) => changeAutomation({ dead_hour_alerts: v })}
            disabled={!automation}
          />
          <SettingsSwitch
            icon="speakerphone"
            tint={TINT.orange}
            title="Otomatik kampanya"
            subtitle="Ölü saatte hazır kampanyayı (2 saat, %20, 2 km) gönderir. En fazla 3 saatte bir; aktif kampanya varken göndermez."
            value={automation?.auto_campaign ?? false}
            onChange={(v) => changeAutomation({ auto_campaign: v })}
            disabled={!automation}
          />
        </SettingsSection>
      ) : (
        <>
          <Text style={styles.muted}>Hangi durumlarda telefonuna bildirim gelsin? Kapattıkların yine de <InlineIcon name="bell" /> listesinde görünür.</Text>
          <SettingsSection
            title="Mekanlar"
            footer="Şimdilik bildirimler uygulama açıkken gelir; kapalıyken gelmesi yayın sürümüyle eklenecek."
          >
            <SettingsSwitch
              icon="map-pin"
              tint={TINT.red}
              title="Check-in önerileri"
              subtitle="Açık bir mekanın yanındayken sorarız; check-in'den sonra 1 saat sormayız."
              value={settings.checkinSuggestions}
              onChange={(v) => update({ checkinSuggestions: v })}
            />
            <SettingsSwitch
              icon="bell-ringing"
              tint={TINT.green}
              title="Sakin olunca haber ver"
              subtitle={
                Platform.OS === 'web'
                  ? 'Tarayıcıda bildirim yerine uygulama içinde uyarı gösterilir.'
                  : 'Zil simgesiyle takip ettiğin mekan sakinleşince.'
              }
              value={watchNotifications}
              onChange={(v) => update({ watchNotifications: v })}
            />
            <SettingsSwitch icon="tag" tint={TINT.orange} title="Kampanya bildirimleri" subtitle="Yakında" value={false} disabled />
          </SettingsSection>
          {!guest && (
            <SettingsSection title="Sosyal">
              <SettingsSwitch
                icon="users"
                tint={TINT.blue}
                title="Arkadaşlar ve gruplar"
                subtitle="İstekler, kabuller ve 'Buradayım, gel'."
                value={settings.friendNotifications}
                onChange={(v) => update({ friendNotifications: v, friendAcceptedNotifications: v })}
              />
              <SettingsSwitch
                icon="message-circle"
                tint={TINT.purple}
                title="Check-in yorumları"
                value={settings.checkinCommentNotifications}
                onChange={(v) => update({ checkinCommentNotifications: v })}
              />
              <SettingsSwitch
                icon="heart"
                tint={TINT.red}
                title="Check-in beğenileri"
                value={settings.checkinLikeNotifications}
                onChange={(v) => update({ checkinLikeNotifications: v })}
              />
              <SettingsSwitch
                icon="message-dots"
                tint={TINT.purple}
                title="Yorumlarıma yanıtlar"
                value={settings.replyNotifications}
                onChange={(v) => update({ replyNotifications: v })}
              />
            </SettingsSection>
          )}
        </>
      )}
      <Text style={styles.version}>availo</Text>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginTop: 4 },
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE, gap: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  disabled: { color: colors.textMuted },
  muted: { fontSize: 13, color: colors.textMuted },
  version: { textAlign: 'center', fontSize: 12, color: colors.placeholder },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  error: { fontSize: 13, color: colors.danger },
}));
