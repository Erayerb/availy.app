import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LevelDot } from '../components/LevelDot';
import { MenuButton } from '../components/MenuButton';
import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import { LEVELS } from '../lib/occupancy';
import { colors } from '../theme';
import { ThemedSwitch } from '../components/ThemedSwitch';

export function SettingsScreen({ onMenu, isBusiness }: { onMenu: () => void; isBusiness: boolean }) {
  const { colorBlind, watchNotifications, deadHourAlerts, autoCampaign, update, look } = useSettings();
  const { point, loading } = useLocation();

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <MenuButton onPress={onMenu} />
        <Text style={styles.title}>Ayarlar</Text>
      </View>

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
        <View style={styles.card}>
          <Row
            title="Boşalınca haber ver bildirimleri"
            subtitle={
              Platform.OS === 'web'
                ? 'Tarayıcıda bildirim yerine uygulama içinde uyarı gösterilir.'
                : 'Takip ettiğin mekan %70 altına düşünce telefonuna bildirim gelir (uygulama açıkken).'
            }
            value={watchNotifications}
            onChange={(v) => update({ watchNotifications: v })}
          />
          <Row
            title="Kampanya bildirimleri"
            subtitle="Yakında: yakındaki kampanyalar bildirim olarak gelecek."
            value={false}
            disabled
          />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Konum</Text>
        <Text style={styles.muted}>
          {loading
            ? 'Konum kontrol ediliyor…'
            : point
              ? 'Konumun kullanılıyor: en yakın sıralama, mesafeler ve haritada mavi nokta.'
              : 'Konum kapalı ya da İstanbul dışındasın. İzni telefonun ayarlarından açabilirsin.'}
        </Text>
      </View>

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
});
