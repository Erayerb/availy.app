import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Collapsible } from '../components/Collapsible';
import { BackButton } from '../components/BackButton';
import { colors, themed } from '../theme';

type Status = 'granted' | 'denied' | 'undetermined' | 'unknown';

type Permission = {
  icon: string;
  title: string;
  summary: string; // shown while the section is closed
  to: string; // "Konuma", "Kameraya": for "… izin vermezsen"
  status: Status;
  // What availy uses it for
  uses: string[];
  withoutIt: string;
  onAsk: () => void;
};

const STATUS_TEXT: Record<Status, string> = {
  granted: 'İzin verildi',
  denied: 'İzin verilmedi',
  undetermined: 'Henüz sorulmadı',
  unknown: 'Bilinmiyor',
};

const asStatus = (s: string | undefined): Status =>
  s === 'granted' || s === 'denied' || s === 'undetermined' ? s : 'unknown';

/** "Konum ve izinler": what each phone permission is for, what happens without it, and its state. */
export function PermissionsScreen({ onBack }: { onBack: () => void }) {
  const [location, setLocation] = useState<Status>('unknown');
  const [notifications, setNotifications] = useState<Status>('unknown');
  const [camera, requestCamera] = useCameraPermissions();

  const refresh = useCallback(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => setLocation(asStatus(p.status)))
      .catch(() => setLocation('unknown'));
    if (Platform.OS !== 'web') {
      Notifications.getPermissionsAsync()
        .then((p) => setNotifications(asStatus(p.status)))
        .catch(() => setNotifications('unknown'));
    }
  }, []);

  useEffect(() => {
    refresh();
    // Coming back from the phone's Settings: show the new state
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => subscription.remove();
  }, [refresh]);

  const ask = async (request: () => Promise<{ status: string; canAskAgain?: boolean }>) => {
    const result = await request().catch(() => null);
    // iOS asks only once; after that only the phone's Settings can change it
    if (result && result.status !== 'granted' && result.canAskAgain === false) Linking.openSettings();
    refresh();
  };

  const permissions: Permission[] = [
    {
      icon: '📍',
      title: 'Konum',
      to: 'Konuma',
      summary: "Check-in'de mekanda olduğunu doğrulamak ve yakındaki mekanlar; kaydedilmez",
      status: location,
      uses: [
        'Check-in yaparken mekanda olduğunu doğrulamak (o an bir kez)',
        'Yakındaki mekanları ve mesafeleri göstermek, haritada mavi nokta',
        'Check-in önerisi: açık bir mekanın yakınında birkaç dakika kalınca sormak (uygulama açıkken)',
      ],
      withoutIt: 'Mekanlara bakabilir, arayabilirsin ama check-in yapamazsın.',
      onAsk: () => ask(Location.requestForegroundPermissionsAsync),
    },
    {
      icon: '📷',
      title: 'Kamera',
      to: 'Kameraya',
      summary: 'Yalnızca QR okutmak için',
      status: asStatus(camera?.status),
      uses: ['Arkadaşının QR kodunu okutmak', 'İşletmede damga / kupon QR kodunu okutmak'],
      withoutIt: 'Arkadaşlarını kullanıcı adıyla ya da davet bağlantısıyla ekleyebilirsin.',
      onAsk: () => ask(requestCamera),
    },
    {
      icon: '🔔',
      title: 'Bildirimler',
      to: 'Bildirimlere',
      summary: 'Check-in önerileri, arkadaşlık ve yanıtlar; reklam yok',
      status: Platform.OS === 'web' ? 'unknown' : notifications,
      uses: ['Check-in önerileri', 'Arkadaşlık istekleri ve yorumlarına gelen yanıtlar', '"Sakin olunca haber ver"'],
      withoutIt: 'Bildirimler yine uygulamadaki 🔔 listesinde görünür.',
      onAsk: () => ask(Notifications.requestPermissionsAsync),
    },
  ];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Konum ve izinler</Text>
      </View>
      <Text style={styles.muted}>
        availy yalnızca aşağıdaki izinleri ister. Rehberine, telefon numarana, fotoğraflarına ve sosyal medya
        hesaplarına erişmez.
      </Text>

      {permissions.map((p) => (
        <Collapsible
          key={p.title}
          title={`${p.icon} ${p.title}`}
          summary={p.summary}
          badge={<Text style={[styles.status, p.status === 'granted' ? styles.on : styles.off]}>{STATUS_TEXT[p.status]}</Text>}
        >
          <Text style={styles.label}>Ne için kullanıyoruz</Text>
          {p.uses.map((u) => (
            <Text key={u} style={styles.text}>
              ✓ {u}
            </Text>
          ))}
          <Text style={styles.without}>
            {p.to} izin vermezsen: {p.withoutIt}
          </Text>
          {p.status !== 'granted' && Platform.OS !== 'web' && (
            <Pressable style={styles.secondary} onPress={p.onAsk}>
              <Text style={styles.secondaryText}>{p.status === 'denied' ? 'Ayarlarda aç' : 'İzin ver'}</Text>
            </Pressable>
          )}
        </Collapsible>
      ))}

      <Collapsible title="🗂️ Verilerin" summary="Sunucuda neler tutuluyor, hesabını silince ne olur">
        <Text style={styles.text}>
          Sunucuda tutulanlar: kullanıcı adın, e-postan, şifrenin özeti (şifrenin kendisi değil), check-in'lerin (mekan,
          doluluk, saat), puanların, arkadaşlıkların ve yorumların.
        </Text>
        <Text style={styles.muted}>
          Hesabını Profil ayarları'ndan silebilirsin: hesabın ve yorumların silinir, check-in'lerin yalnızca adsız doluluk bilgisi
          olarak kalır.
        </Text>
      </Collapsible>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  status: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  on: { backgroundColor: colors.successBg, color: colors.success },
  off: { backgroundColor: colors.cream, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 6 },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  // "İzin vermezsen" stands out
  without: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 6 },
  secondary: {
    marginTop: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700' },
}));
