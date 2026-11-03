import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import type { Screen } from '../components/TabBar';
import { HeaderButtons } from '../components/HeaderButtons';
import { Wordmark } from '../components/Wordmark';
import { ProfileCompletion } from '../components/ProfileCompletion';
import { isBusiness, type User } from '../lib/auth';
import { SUPPORT_SITE_URL } from '../lib/share';
import { colors, themed } from '../theme';

// `url`: opens a web page instead of a screen (the screen is the fallback until the page exists)
type Item = { screen: Screen; label: string; hint?: string; badge?: string; url?: string | null; disabled?: boolean };

const CUSTOMER_ITEMS: Item[] = [
  { screen: 'profile', label: 'Profil ayarları', hint: 'Kullanıcı adı, e-posta, şifre, hesabı dondurma ve silme' },
  { screen: 'campaigns', label: 'Kampanyalar', hint: 'Yakındaki kampanyalar, kuponların ve sadakat kartların' },
  { screen: 'subscription', label: 'Abonelik', hint: 'Ücretsiz ya da Premium (₺79/ay)' },
  { screen: 'settings', label: 'Bildirim ayarları', hint: 'Check-in önerileri, sakinleşince haber ver, arkadaşlık, yorum ve beğeniler' },
  { screen: 'appearance', label: 'Görünüm', hint: 'Açık ya da koyu tema, renk körlüğü dostu mod' },
  { screen: 'privacy', label: 'Gizlilik ayarları', hint: "Check-in'lerimi kim görür, sıralama, aranabilirlik, engellenenler" },
  { screen: 'permissions', label: 'Konum ve izinler', hint: 'Konum, kamera ve bildirim izinleri ne için kullanılıyor' },
];

// A guest has no account to set up, nothing to subscribe to and no friends to hide from: signing up is the card on top
const GUEST_ITEMS: Item[] = [
  { screen: 'profile', label: 'Puanın', hint: 'Misafir olarak topladıkların' },
  { screen: 'campaigns', label: 'Kampanyalar', hint: 'Yakındaki kampanyalar ve kuponlar' },
  { screen: 'settings', label: 'Bildirim ayarları', hint: 'Check-in önerileri, sakinleşince haber ver' },
  { screen: 'appearance', label: 'Görünüm', hint: 'Açık ya da koyu tema, renk körlüğü dostu mod' },
  { screen: 'permissions', label: 'Konum ve izinler', hint: 'Konum, kamera ve bildirim izinleri ne için kullanılıyor' },
];

const BUSINESS_ITEMS: Item[] = [
  { screen: 'profile', label: 'İşletme profili', hint: 'Kapak fotoğrafı, ad, saatler, özellikler, adres ve konum, iletişim' },
  { screen: 'verification', label: 'İşletme doğrulama', hint: 'Mekan sahipliğini kanıtla', badge: 'Yakında' },
  { screen: 'subscription', label: 'Abonelik', hint: 'Kampanya başı ödeme ya da aylık paket' },
  { screen: 'settings', label: 'Ayarlar', hint: 'Hesap, ölü saat bildirimi, otomatik kampanya' },
  { screen: 'appearance', label: 'Görünüm', hint: 'Açık ya da koyu tema, renk körlüğü dostu mod' },
  { screen: 'permissions', label: 'İzinler', hint: 'Kamera ve bildirim izinleri ne için kullanılıyor' },
];

const COMMON_ITEMS: Item[] = [
  {
    screen: 'support',
    label: 'Destek',
    hint: 'Sık sorulan sorular ve yardım',
    url: SUPPORT_SITE_URL,
    // Until the introduction website is up it cannot be opened ("Hata bildir ve iletişim" is below)
    badge: SUPPORT_SITE_URL ? undefined : 'Yakında',
    disabled: !SUPPORT_SITE_URL,
  },
  { screen: 'support', label: 'Hata bildir ve iletişim', hint: 'Sorun bildir ya da bize yaz' },
  { screen: 'about', label: 'Hakkında', hint: 'Nasıl kullanılır, web sitemiz' },
  { screen: 'legal', label: 'Kullanım koşulları', hint: 'Kullanım koşulları ve gizlilik politikası (KVKK)' },
];

type Props = {
  user: User | null;
  onSelect: (screen: Screen) => void;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => void;
};

/** Last bottom tab ("☰"): everything that is not a tab of its own. */
export function MoreScreen({ user, onSelect, onLogin, onRegister, onLogout }: Props) {
  const guest = !user || user.isGuest;
  const items = [
    ...(guest ? GUEST_ITEMS : isBusiness(user) ? BUSINESS_ITEMS : CUSTOMER_ITEMS),
    // A guest sees no row that cannot be opened yet
    ...COMMON_ITEMS.filter((item) => !(guest && item.disabled)),
    ...(user?.isAdmin ? [{ screen: 'admin' as Screen, label: 'Yönetici', hint: 'Şikâyet edilen yorum ve yanıtlar' }] : []),
  ];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Wordmark size={34} />
        <HeaderButtons />
      </View>
      {guest ? (
        <View style={styles.guestCard}>
          <Text style={styles.label}>Misafir olarak geziyorsun</Text>
          <Text style={styles.hint}>Check-in'lerin daha az sayılır, puanın yarım gelir. Kayıt olursan tam sayılır ve puanların korunur.</Text>
          <Pressable onPress={onRegister} style={styles.login}>
            <Text style={styles.loginText}>Kayıt ol</Text>
          </Pressable>
          <Pressable onPress={onLogin} hitSlop={8} style={styles.guestLogin}>
            <Text style={styles.guestLoginText}>Hesabım var, giriş yap</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.greeting}>
          Merhaba, {user.username ? `@${user.username}` : user.name}
          {isBusiness(user) ? ' (İşletme)' : ''}
        </Text>
      )}

      {/* Personal accounts: until the profile is complete (Tam profil badge) */}
      {user && !user.isGuest && !isBusiness(user) && user.profile && <ProfileCompletion steps={user.profile} onOpen={onSelect} />}

      <View style={styles.card}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            onPress={() => (item.url ? Linking.openURL(item.url).catch(() => onSelect(item.screen)) : onSelect(item.screen))}
            disabled={item.disabled}
            style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed, item.disabled && styles.disabled]}
          >
            <View style={styles.rowText}>
              <Text style={styles.label}>{item.label}</Text>
              {item.hint && <Text style={styles.hint}>{item.hint}</Text>}
            </View>
            {item.badge && <Text style={styles.badge}>{item.badge}</Text>}
            {!item.disabled && <Text style={styles.chevron}>›</Text>}
          </Pressable>
        ))}
      </View>

      {!guest && (
        <Pressable onPress={onLogout} style={styles.logout}>
          <Text style={styles.logoutText}>Çıkış yap</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 32, gap: 14 },
  greeting: { fontSize: 14, color: colors.textMuted, marginTop: -6 },
  guestCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  guestLogin: { alignSelf: 'center', paddingVertical: 2 },
  guestLoginText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  card: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.cream },
  disabled: { opacity: 0.55 },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 16, color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.cream,
  },
  chevron: { fontSize: 22, color: colors.placeholder },
  login: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  loginText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  logout: { paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  logoutText: { fontSize: 16, color: colors.danger, fontWeight: '600' },
}));
