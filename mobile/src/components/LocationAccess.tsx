import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, themed } from '../theme';

type Access = 'unknown' | 'none' | 'ask' | 'inUse' | 'always';

const ACCESS: Record<Access, { title: string; hint: string }> = {
  unknown: { title: 'Bilinmiyor', hint: 'İzin durumu okunamadı' },
  none: { title: 'Kapalı', hint: 'Check-in yapılamaz' },
  ask: { title: 'Henüz sorulmadı', hint: 'Check-in için gerekli' },
  inUse: { title: 'Uygulamayı kullanırken', hint: 'availy için yeterli' },
  always: { title: 'Daima', hint: 'Tüm özellikler açık' },
};

// What each feature needs: "inUse" works with "Uygulamayı kullanırken", "always" needs "Daima"
const FEATURES: { icon: string; title: string; text: string; needs: 'inUse' | 'always'; soon?: boolean }[] = [
  { icon: '📍', title: 'Check-in yap', text: 'Check-in yaparken mekanda olduğunu bir kez doğrular', needs: 'inUse' },
  { icon: '🗺️', title: 'Harita ve yakındakiler', text: 'Haritada mavi nokta, yakındaki mekanlar ve mesafeler', needs: 'inUse' },
  { icon: '👋', title: 'Check-in önerisi', text: 'Uygulama açıkken bir mekanın yanında birkaç dakika kalınca sorar', needs: 'inUse' },
  {
    icon: '🔔',
    title: 'Kapalıyken check-in önerisi',
    text: 'Uygulama kapalıyken de bir mekanın yanına gelince haber verir',
    needs: 'always',
    soon: true,
  },
];

const enough = (access: Access, needs: 'inUse' | 'always') =>
  access === 'always' || (needs === 'inUse' && access === 'inUse');

/** Inside "Konum" in Konum ve izinler: the current location permission, "Düzenle", and which features it covers. */
export function LocationAccess({ onChange }: { onChange?: () => void }) {
  const [access, setAccess] = useState<Access>('unknown');
  const [webHint, setWebHint] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status !== 'granted') return setAccess(foreground.status === 'undetermined' ? 'ask' : 'none');
      // "Daima" is not asked for yet; reading it may fail where it is not set up (web, Expo Go)
      const background = await Location.getBackgroundPermissionsAsync().catch(() => null);
      setAccess(background?.status === 'granted' ? 'always' : 'inUse');
    } catch {
      setAccess('unknown');
    }
    onChange?.();
  }, [onChange]);

  useEffect(() => {
    refresh();
    // Back from the phone's Settings: show the new state
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => subscription.remove();
  }, [refresh]);

  const edit = async () => {
    if (access === 'ask') {
      await Location.requestForegroundPermissionsAsync().catch(() => null);
      return refresh();
    }
    if (Platform.OS === 'web') return setWebHint(true);
    Linking.openSettings();
  };

  const level = access === 'always' ? 'Daima' : 'Uygulamayı kullanırken';

  return (
    <View style={styles.content}>
      <Text style={styles.intro}>
        availy için konum erişiminin <Text style={styles.bold}>Uygulamayı kullanırken</Text> olması yeterli. Konumun yalnızca
        check-in anında kontrol edilir ve saklanmaz.
      </Text>

      <View style={styles.status}>
        <View style={styles.flex}>
          <Text style={styles.statusTitle}>{ACCESS[access].title}</Text>
          <Text style={[styles.muted, (access === 'none' || access === 'ask') && styles.warn]}>{ACCESS[access].hint}</Text>
        </View>
        <Pressable style={styles.edit} onPress={edit}>
          <Text style={styles.editText}>{access === 'ask' ? 'İzin ver' : 'Düzenle'}</Text>
        </Pressable>
      </View>
      {webHint && (
        <Text style={styles.muted}>Tarayıcıda konum iznini adres çubuğundaki ⓘ / kilit simgesinden değiştirebilirsin.</Text>
      )}

      <Text style={styles.listTitle}>
        Konum erişimi <Text style={styles.bold}>{level}</Text> olarak ayarlandığında desteklenen özellikler:
      </Text>
      <View style={styles.list}>
        {FEATURES.map((f, i) => {
          const ok = !f.soon && enough(access === 'always' || access === 'inUse' ? access : 'none', f.needs);
          return (
            <View key={f.title} style={[styles.row, i > 0 && styles.divider]}>
              <View style={styles.icon}>
                <Text style={styles.iconText}>{f.icon}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.muted}>
                  {f.text}
                  {f.soon ? ' · yakında, "Daima" ister' : ''}
                </Text>
              </View>
              <Text style={[styles.mark, ok ? styles.ok : styles.notOk]}>{ok ? '✓' : '!'}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { gap: 12 },
  intro: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
  bold: { fontWeight: '800', color: colors.text },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  flex: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  warn: { color: colors.danger },
  edit: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.cream },
  editText: { fontSize: 15, fontWeight: '700', color: colors.text },
  listTitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  list: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  mark: { fontSize: 18, fontWeight: '800', width: 22, textAlign: 'center' },
  ok: { color: colors.success },
  notOk: { color: colors.textMuted },
}));
