import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LevelDot } from '../components/LevelDot';
import { BackButton } from '../components/BackButton';
import { VenueEditSection } from '../components/business/VenueEditSection';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { useSettings } from '../context/SettingsContext';
import { LEVELS } from '../lib/occupancy';
import { colors } from '../theme';
import { ThemedSwitch } from '../components/ThemedSwitch';

type Props = {
  onBack: () => void;
  isBusiness: boolean;
  venueId: number | null; // business: its venue, edited here
  onOpenPermissions: () => void;
  onOpenPrivacy: () => void;
};

export function SettingsScreen({ onBack, isBusiness, venueId, onOpenPermissions, onOpenPrivacy }: Props) {
  const { venues } = useVenuesByIds(venueId ? [venueId] : []);
  const venue = venues[0];
  const settings = useSettings();
  const { colorBlind, watchNotifications, deadHourAlerts, autoCampaign, update, look } = settings;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>{isBusiness ? 'İşletme Ayarları' : 'Ayarlar'}</Text>
      </View>

      {isBusiness && venue && <VenueEditSection key={venue.id} venue={venue} onSaved={() => {}} />}

      <View style={styles.card}>
        <Row
          title="Renk körlüğü dostu mod"
          subtitle="Doluluk renkleri renk körlüğünde de ayırt edilebilir tonlara geçer ve noktalara simge eklenir."
          value={colorBlind}
          onChange={(v) => update({ colorBlind: v })}
        />
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
      </View>

      {isBusiness ? (
        <View style={styles.card}>
          <Row
            title="Ölü saat bildirimi"
            subtitle="Mekanın %40'ın altına düşünce haber veririz (en fazla 2 saatte bir, uygulama açıkken)."
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
          <Text style={styles.heading}>Bildirimler</Text>
          <View style={styles.card}>
            <Row
              title="Check-in önerileri"
              subtitle="Açık bir mekanın 250 m yakınında birkaç dakika kalınca check-in yapmak isteyip istemediğini sorarız."
              value={settings.checkinSuggestions}
              onChange={(v) => update({ checkinSuggestions: v })}
            />
            <Row
              title="Arkadaşlık"
              subtitle="Biri seni eklemek istediğinde ya da isteğini kabul ettiğinde."
              value={settings.friendNotifications}
              onChange={(v) => update({ friendNotifications: v })}
            />
            <Row
              title="Yorumlarıma yanıtlar"
              subtitle="Biri mekan yorumunu yanıtladığında."
              value={settings.replyNotifications}
              onChange={(v) => update({ replyNotifications: v })}
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

        </>
      )}

      {!isBusiness && (
        <Pressable style={styles.card} onPress={onOpenPrivacy}>
          <Text style={styles.sectionTitle}>Gizlilik ›</Text>
          <Text style={styles.muted}>Check-in'lerini kimin göreceği, sıralama, aranabilirlik ve engellediklerin.</Text>
        </Pressable>
      )}
      <Pressable style={styles.card} onPress={onOpenPermissions}>
        <Text style={styles.sectionTitle}>Konum ve izinler ›</Text>
        <Text style={styles.muted}>Konum, kamera ve bildirim izinleri: neye izin veriyor, neye vermiyor.</Text>
      </Pressable>

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

const styles = StyleSheet.create({
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
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  preview: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 4 },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  version: { textAlign: 'center', fontSize: 12, color: colors.placeholder },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  error: { fontSize: 13, color: colors.danger },
});
