import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '../context/SettingsContext';
import { colors, themed } from '../theme';

type Access = 'unknown' | 'none' | 'ask' | 'inUse' | 'always';

const ACCESS: Record<Access, { title: string; hint: string }> = {
  unknown: { title: 'Bilinmiyor', hint: 'İzin durumu okunamadı' },
  none: { title: 'Kapalı', hint: 'Check-in yapılamaz' },
  ask: { title: 'Henüz sorulmadı', hint: 'Check-in için gerekli' },
  inUse: { title: 'Uygulamayı kullanırken', hint: 'availy için yeterli' },
  always: { title: 'Daima', hint: 'Tüm özellikler açık' },
};

// What each feature needs: "inUse" works with "Uygulamayı kullanırken", "always" needs "Daima".
// `setting`: the user can turn it off here; check-in always needs the location
type Feature = {
  icon: string;
  title: string;
  text: string;
  needs: 'inUse' | 'always';
  setting?: 'showMyLocation' | 'checkinSuggestions';
  soon?: boolean;
};
const FEATURES: Feature[] = [
  { icon: '📍', title: 'Check-in yap', text: 'Mekanda olduğunu bir kez doğrular (gerekli)', needs: 'inUse' },
  { icon: '🗺️', title: 'Haritada konumum', text: 'Haritada mavi nokta', needs: 'inUse', setting: 'showMyLocation' },
  {
    icon: '👋',
    title: 'Check-in önerisi',
    text: 'Uygulama açıkken bir mekanın yanında kalınca sorar',
    needs: 'inUse',
    setting: 'checkinSuggestions',
  },
  { icon: '🔔', title: 'Kapalıyken check-in önerisi', text: 'Yakında; "Daima" izni ister', needs: 'always', soon: true },
];

const enough = (access: Access, needs: 'inUse' | 'always') =>
  access === 'always' || (needs === 'inUse' && access === 'inUse');

/**
 * Inside "Konum" in Konum ve izinler: the current location permission, "Düzenle", and which
 * features it covers; the optional ones have a tick to turn them on or off.
 */
export function LocationAccess({ onChange }: { onChange?: () => void }) {
  const settings = useSettings();
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
          const allowed = !f.soon && enough(access === 'always' || access === 'inUse' ? access : 'none', f.needs);
          const on = f.setting ? settings[f.setting] : allowed;
          return (
            <Pressable
              key={f.title}
              style={[styles.row, i > 0 && styles.divider]}
              disabled={!allowed || !f.setting}
              onPress={() => f.setting && settings.update({ [f.setting]: !settings[f.setting] })}
              accessibilityRole={f.setting ? 'checkbox' : undefined}
              accessibilityState={f.setting ? { checked: on, disabled: !allowed } : undefined}
            >
              <View style={styles.icon}>
                <Text style={styles.iconText}>{f.icon}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.small}>{f.text}</Text>
              </View>
              {!allowed ? (
                <Text style={[styles.mark, styles.notOk]}>!</Text>
              ) : (
                <View style={[styles.box, on && styles.boxOn, !f.setting && styles.boxLocked]}>
                  {on && <Text style={styles.tick}>✓</Text>}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { gap: 10 },
  intro: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  bold: { fontWeight: '800', color: colors.text },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  flex: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  warn: { color: colors.danger },
  edit: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.cream },
  editText: { fontSize: 14, fontWeight: '700', color: colors.text },
  listTitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  list: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 16 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  small: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  // A tick box; check-in's is always on (needed), the others can be turned off
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.success, borderColor: colors.success },
  boxLocked: { opacity: 0.5 },
  tick: { color: colors.white, fontSize: 14, fontWeight: '900' },
  mark: { fontSize: 18, fontWeight: '800', width: 22, textAlign: 'center' },
  ok: { color: colors.success },
  notOk: { color: colors.textMuted },
}));
