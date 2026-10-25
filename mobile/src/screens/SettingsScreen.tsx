import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { VenueEditSection } from '../components/business/VenueEditSection';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { useSettings } from '../context/SettingsContext';
import { colors, themed } from '../theme';
import { ThemedSwitch } from '../components/ThemedSwitch';
import { AccountSettings } from './ProfileScreen';

type Props = {
  onBack: () => void;
  isBusiness: boolean;
  venueId: number | null; // business: its venue, edited here
  // Business: user name, e-mail, password, freeze and delete are here (customers: Profil ayarları)
  account: Parameters<typeof AccountSettings>[0] | null;
};

/** Customers: Bildirim ayarları. Businesses: Ayarlar (account, venue, dead-hour alerts). */
export function SettingsScreen({ onBack, isBusiness, venueId, account }: Props) {
  const { venues } = useVenuesByIds(venueId ? [venueId] : []);
  const venue = venues[0];
  const settings = useSettings();
  const { watchNotifications, deadHourAlerts, autoCampaign, update } = settings;
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

      {isBusiness && venue && <VenueEditSection key={venue.id} venue={venue} onSaved={() => {}} />}

      {isBusiness ? (
        <View style={styles.card}>
          <Row
            title="Ölü saat bildirimi"
            subtitle="Müşteriler mekanını açıkken Sakin bildirdiğinde haber veririz (en fazla 2 saatte bir, uygulama açıkken)."
            value={deadHourAlerts}
            onChange={(v) => update({ deadHourAlerts: v })}
          />
          <Row
            title="Otomatik kampanya"
            subtitle="Ölü saatte hazır kampanyayı (2 saat, %20, 2 km) otomatik gönderir. En fazla 3 saatte bir; aktif kampanya varken göndermez."
            value={autoCampaign}
            onChange={(v) => update({ autoCampaign: v })}
          />
        </View>
      ) : (
        <>
          <Text style={styles.muted}>Hangi durumlarda telefonuna bildirim gelsin? Kapattıkların yine de 🔔 listesinde görünür.</Text>
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
                  : '🔕 ile takip ettiğin mekan sakinleşince telefonuna bildirim gelir.'
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

      <Text style={styles.version}>availy · prototip sürüm</Text>
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
