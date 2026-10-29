import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';

import { BackButton } from '../components/BackButton';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { useSettings } from '../context/SettingsContext';
import { automationApi, type Automation } from '../lib/schedules';
import { colors, themed } from '../theme';
import { ThemedSwitch } from '../components/ThemedSwitch';
import { AccountSettings } from './ProfileScreen';
import { InlineIcon } from '../components/Icon';

type Props = {
  onBack: () => void;
  isBusiness: boolean;
  venueId: number | null; // business: its venue (for the automation settings)
  // Business: user name, e-mail, password, freeze and delete are here (customers: Profil ayarları)
  account: Parameters<typeof AccountSettings>[0] | null;
};

/** Customers: Bildirim ayarları. Businesses: Ayarlar (account, dead-hour alerts; the venue is edited in İşletme Profili). */
export function SettingsScreen({ onBack, isBusiness, venueId, account }: Props) {
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
        <View style={styles.card}>
          <Row
            title="Ölü saat bildirimi"
            subtitle="Mekanın açıkken en az 2 müşteri Sakin bildirince bildirim listene haber düşer (en fazla 2 saatte bir). Uygulaman kapalı olsa da çalışır."
            value={automation?.dead_hour_alerts ?? true}
            onChange={(v) => changeAutomation({ dead_hour_alerts: v })}
            disabled={!automation}
          />
          <Row
            title="Otomatik kampanya"
            subtitle="Ölü saatte hazır kampanyayı (2 saat, %20, 2 km) kendiliğinden gönderir. En fazla 3 saatte bir; aktif kampanya varken göndermez."
            value={automation?.auto_campaign ?? false}
            onChange={(v) => changeAutomation({ auto_campaign: v })}
            disabled={!automation}
          />
        </View>
      ) : (
        <>
          <Text style={styles.muted}>Hangi durumlarda telefonuna bildirim gelsin? Kapattıkların yine de <InlineIcon name="bell" /> listesinde görünür.</Text>
          <Text style={styles.heading}>Mekanlar</Text>
          <View style={styles.card}>
            <Row
              title="Check-in önerileri"
              subtitle="Açık bir mekanın 250 m yakınında birkaç dakika kalınca check-in yapmak isteyip istemediğini sorarız."
              value={settings.checkinSuggestions}
              onChange={(v) => update({ checkinSuggestions: v })}
            />
            <Row
              title="Sakin olunca haber ver"
              subtitle={
                Platform.OS === 'web'
                  ? 'Tarayıcıda bildirim yerine uygulama içinde uyarı gösterilir.'
                  : 'Zil simgesiyle takip ettiğin mekan sakinleşince telefonuna bildirim gelir.'
              }
              value={watchNotifications}
              onChange={(v) => update({ watchNotifications: v })}
            />
            <Row title="Kampanya bildirimleri" subtitle="Yakında: yakındaki kampanyalar." value={false} disabled />
            <Text style={styles.muted}>
              Şimdilik bildirimler uygulama açıkken gelir; kapalıyken gelmesi yayın sürümüyle eklenecek.
            </Text>
          </View>

          <Text style={styles.heading}>Sosyal</Text>
          <View style={styles.card}>
            <Row
              title="Arkadaşlık ve grup davetleri"
              subtitle="Biri seni arkadaş olarak eklemek ya da bir gruba almak istediğinde, gönderdiğin istek kabul edildiğinde."
              value={settings.friendNotifications}
              onChange={(v) => update({ friendNotifications: v, friendAcceptedNotifications: v })}
            />
            <Row
              title="Check-in yorumları"
              subtitle="Arkadaşın check-in'ine yorum yaptığında."
              value={settings.checkinCommentNotifications}
              onChange={(v) => update({ checkinCommentNotifications: v })}
            />
            <Row
              title="Check-in beğenileri"
              subtitle="Arkadaşın check-in'ini beğendiğinde."
              value={settings.checkinLikeNotifications}
              onChange={(v) => update({ checkinLikeNotifications: v })}
            />
            <Row
              title="Yorumlarıma yanıtlar"
              subtitle="Biri mekan yorumunu yanıtladığında."
              value={settings.replyNotifications}
              onChange={(v) => update({ replyNotifications: v })}
            />
          </View>

        </>
      )}

      <Text style={styles.version}>availy</Text>
    </ScrollView>
  );
}

type RowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
};

function Row({ title, subtitle, value, onChange, disabled }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.sectionTitle, disabled && styles.disabled]}>{title}</Text>
        <Text style={styles.muted}>{subtitle}</Text>
      </View>
      <ThemedSwitch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginTop: 4 },
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
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
