import { useCameraPermissions } from 'expo-camera';
import * as Contacts from 'expo-contacts/legacy';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Collapsible } from '../components/Collapsible';
import { BackButton } from '../components/BackButton';
import { LocationAccess } from '../components/LocationAccess';
import { colors, themed } from '../theme';

type Status = 'granted' | 'denied' | 'undetermined' | 'unknown' | 'inApp';

type Permission = {
  icon: string;
  title: string;
  summary: string; // shown while the section is closed
  to: string; // "Konuma", "Kameraya": for "… izin vermezsen"
  status: Status;
  // What availy uses it for
  uses: string[];
  withoutIt: string;
  onAsk?: () => void; // no button when the permission can't be asked here
  // Web: where to turn it on once the browser has blocked it
  blockedHint?: string;
};

const STATUS_TEXT: Record<Status, string> = {
  granted: 'İzin verildi',
  denied: 'İzin verilmedi',
  undetermined: 'Henüz sorulmadı',
  unknown: 'Bilinmiyor',
  inApp: 'Uygulama içi', // web: only the 🔔 list
};

const asStatus = (s: string | undefined): Status =>
  s === 'granted' || s === 'denied' || s === 'undetermined' ? s : 'unknown';

const isWeb = Platform.OS === 'web';

// The browser's own prompt. expo-location answers "denied" without asking once the site is
// blocked, but some browsers (Safari) do ask again, so always try.
const askWebLocation = () =>
  new Promise<{ status: string }>((resolve) => {
    if (!navigator.geolocation) return resolve({ status: 'unknown' });
    navigator.geolocation.getCurrentPosition(
      () => resolve({ status: 'granted' }),
      (e) => resolve({ status: e.code === e.PERMISSION_DENIED ? 'denied' : 'granted' }),
    );
  });

const BROWSER_HINT =
  "Tarayıcın bu izni engellemiş. Adres çubuğundaki ⓘ / kilit simgesinden izin ver; iPhone'da Ayarlar > Safari > Konum > Sor.";

/**
 * "Konum ve izinler": what each phone permission is for, what happens without it, and its state.
 * Business accounts do not check in, so they only see the camera and notifications ("İzinler").
 */
export function PermissionsScreen({
  business = false,
  onBack,
}: {
  business?: boolean;
  onBack: () => void;
}) {
  const [location, setLocation] = useState<Status>('unknown');
  const [notifications, setNotifications] = useState<Status>('unknown');
  const [contacts, setContacts] = useState<Status>('unknown');
  const [camera, requestCamera] = useCameraPermissions();
  // Web has no settings page to open: "Ayarlara git" explains where the browser keeps them
  const [webHint, setWebHint] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => setLocation(asStatus(p.status)))
      .catch(() => setLocation('unknown'));
    if (Platform.OS !== 'web') {
      Notifications.getPermissionsAsync()
        .then((p) => setNotifications(asStatus(p.status)))
        .catch(() => setNotifications('unknown'));
      Contacts.getPermissionsAsync()
        .then((p) => setContacts(asStatus(p.status)))
        .catch(() => setContacts('unknown'));
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
    if (!isWeb && result && result.status !== 'granted' && result.canAskAgain === false) Linking.openSettings();
    refresh();
  };

  const all: (Permission | false)[] = [
    !business && {
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
      onAsk: () => ask(isWeb ? askWebLocation : Location.requestForegroundPermissionsAsync),
      blockedHint: BROWSER_HINT,
    },
    // Only for "Rehberden bul" (Sosyal > Arkadaşlar), and only in the phone app
    !business &&
      !isWeb && {
        icon: '👥',
        title: 'Rehber',
        to: 'Rehbere',
        summary: 'Yalnızca "Rehberden bul" dersen; rehberin saklanmaz',
        status: contacts,
        uses: [
          "Sosyal > Arkadaşlar'da \"Rehberden bul\"a basınca rehberindeki availy kullanıcılarını bulmak",
          'Numaralar yalnızca eşleşme için bir kez gönderilir, saklanmaz',
        ],
        withoutIt: 'Arkadaşlarını kullanıcı adı, QR ya da davet bağlantısıyla eklersin.',
        onAsk: () => ask(Contacts.requestPermissionsAsync),
      },
    {
      icon: '📷',
      title: 'Kamera',
      to: 'Kameraya',
      summary: business ? 'Müşterinin kupon ve sadakat QR kodunu okutmak için' : 'Yalnızca QR okutmak için',
      status: asStatus(camera?.status),
      uses: business
        ? ['Müşterinin kupon QR kodunu okutup kullanıldı saymak', 'Sadakat kartına damga eklemek için müşteri QR kodunu okutmak']
        : ['Arkadaşının QR kodunu okutmak', 'İşletmede damga / kupon QR kodunu okutmak'],
      withoutIt: business
        ? 'Kupon ve müşteri kodlarını elle yazabilirsin.'
        : 'Arkadaşlarını kullanıcı adıyla ya da davet bağlantısıyla ekleyebilirsin.',
      onAsk: () => ask(requestCamera),
      blockedHint: "Tarayıcın bu izni engellemiş. Adres çubuğundaki ⓘ / kilit simgesinden kameraya izin ver; iPhone'da Ayarlar > Safari > Kamera > Sor.",
    },
    {
      icon: '🔔',
      title: 'Bildirimler',
      to: 'Bildirimlere',
      summary: business ? 'Ölü saat uyarısı; reklam yok' : 'Check-in önerileri, arkadaşlık ve yanıtlar; reklam yok',
      status: isWeb ? 'inApp' : notifications,
      uses: business
        ? ['Ölü saat: müşteriler mekanını Sakin bildirince haber vermek (Ayarlar)']
        : ['Check-in önerileri', 'Arkadaşlık istekleri ve yorumlarına gelen yanıtlar', '"Sakin olunca haber ver"'],
      withoutIt: business
        ? "Ölü saati yine İşletme Paneli'nde görürsün."
        : 'Bildirimler yine uygulamadaki 🔔 listesinde görünür.',
      // The web version has no phone notifications; the 🔔 list is all there is
      onAsk: isWeb ? undefined : () => ask(Notifications.requestPermissionsAsync),
    },
  ];
  const permissions = all.filter((p): p is Permission => p !== false);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>{business ? 'İzinler' : 'Konum ve izinler'}</Text>
      </View>
      <Text style={styles.muted}>
        availy yalnızca aşağıdaki izinleri ister. Rehberine yalnızca sen "Rehberden bul" dersen bakar; fotoğraflarına
        (kapak fotoğrafı seçmek dışında) ve sosyal medya hesaplarına erişmez.
      </Text>

      {permissions.map((p) => (
        <Collapsible
          key={p.title}
          title={`${p.icon} ${p.title}`}
          summary={p.summary}
          badge={<Text style={[styles.status, p.status === 'granted' ? styles.on : styles.off]}>{STATUS_TEXT[p.status]}</Text>}
        >
          {/* Konum: its state, "Düzenle" and the features it covers */}
          {p.title === 'Konum' ? (
            <LocationAccess onChange={refresh} />
          ) : (
            <>
              <Text style={styles.label}>Ne için kullanıyoruz</Text>
              {p.uses.map((u) => (
                <Text key={u} style={styles.text}>
                  ✓ {u}
                </Text>
              ))}
            </>
          )}
          <Text style={styles.without}>
            {p.to} izin vermezsen: {p.withoutIt}
          </Text>
          {p.title !== 'Konum' && p.status !== 'granted' && p.status !== 'inApp' && p.onAsk && (
            <Pressable style={styles.secondary} onPress={p.onAsk}>
              <Text style={styles.secondaryText}>{p.status === 'denied' && !isWeb ? 'Ayarlarda aç' : 'İzin ver'}</Text>
            </Pressable>
          )}
          {/* Already allowed (or not asked here): the phone's / browser's settings change it */}
          {p.title !== 'Konum' && (p.status === 'granted' || p.status === 'inApp') && (
            <Pressable style={styles.secondary} onPress={() => (isWeb ? setWebHint(p.title) : Linking.openSettings())}>
              <Text style={styles.secondaryText}>Ayarlara git</Text>
            </Pressable>
          )}
          {isWeb && webHint === p.title && (
            <Text style={styles.muted}>Tarayıcıda izinleri adres çubuğundaki ⓘ / kilit simgesinden değiştirebilirsin.</Text>
          )}
          {isWeb && p.status === 'denied' && p.blockedHint && <Text style={styles.muted}>{p.blockedHint}</Text>}
          {isWeb && !p.onAsk && (
            <Text style={styles.muted}>Web sürümünde telefon bildirimi yok; bildirimlerin 🔔 listesinde görünür.</Text>
          )}
        </Collapsible>
      ))}

      <Collapsible title="🗂️ Verilerin" summary="Sunucuda neler tutuluyor, hesabını silince ne olur">
        <Text style={styles.text}>
          {business
            ? 'Sunucuda tutulanlar: kullanıcı adın, e-postan, şifrenin özeti (şifrenin kendisi değil), mekanın ve yorumlara verdiğin yanıtlar. İstatistikler adsızdır; yalnızca mekanını keşfeden kişinin adını görürsün (gizli check-in değilse).'
            : "Sunucuda tutulanlar: kullanıcı adın, e-postan, şifrenin özeti (şifrenin kendisi değil), check-in'lerin (mekan, doluluk, saat), puanların, arkadaşlıkların ve yorumların."}
        </Text>
        <Text style={styles.muted}>
          {business
            ? "Hesabını İşletme Profili'nden silebilirsin: hesabın ve yanıtların silinir."
            : "Hesabını Profil ayarları'ndan silebilirsin: hesabın ve yorumların silinir, check-in'lerin yalnızca adsız doluluk bilgisi olarak kalır."}
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
