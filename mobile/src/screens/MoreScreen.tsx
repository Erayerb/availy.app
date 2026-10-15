import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Screen } from '../components/TabBar';
import { Wordmark } from '../components/Wordmark';
import { isBusiness, type User } from '../lib/auth';
import { colors } from '../theme';

type Item = { screen: Screen; label: string; hint?: string; badge?: string };

const CUSTOMER_ITEMS: Item[] = [
  { screen: 'profile', label: 'Profil', hint: 'Ad, şifre ve hesap' },
  { screen: 'subscription', label: 'Abonelik', hint: 'Ücretsiz ya da Premium (₺79/ay)' },
  { screen: 'settings', label: 'Ayarlar', hint: 'Renk körlüğü modu, bildirimler, konum' },
];

const BUSINESS_ITEMS: Item[] = [
  { screen: 'profile', label: 'İşletme Profili', hint: 'Fotoğraf, paket ve hesap' },
  { screen: 'settings', label: 'İşletme Ayarları', hint: 'Mekan bilgileri, ölü saat bildirimi, otomatik kampanya' },
  { screen: 'verification', label: 'İşletme doğrulama', hint: 'Mekan sahipliğini kanıtla', badge: 'Yakında' },
];

const COMMON_ITEMS: Item[] = [
  { screen: 'support', label: 'Hata bildir ve iletişim', hint: 'Sorun bildir ya da bize yaz' },
  { screen: 'about', label: 'Hakkında', hint: 'Nasıl kullanılır: renkler, bildirimler, kampanyalar' },
];

type Props = {
  user: User | null;
  onSelect: (screen: Screen) => void;
  onLogin: () => void;
  onLogout: () => void;
};

/** Last bottom tab ("☰"): everything that is not a tab of its own. */
export function MoreScreen({ user, onSelect, onLogin, onLogout }: Props) {
  const items = [...(isBusiness(user) ? BUSINESS_ITEMS : CUSTOMER_ITEMS), ...COMMON_ITEMS];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Wordmark size={34} />
      <Text style={styles.greeting}>
        {user ? `Merhaba, ${user.name}${isBusiness(user) ? ' (İşletme)' : ''}` : 'Misafir olarak geziyorsun'}
      </Text>

      <View style={styles.card}>
        {items.map((item, i) => (
          <Pressable
            key={item.screen}
            onPress={() => onSelect(item.screen)}
            style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
          >
            <View style={styles.rowText}>
              <Text style={styles.label}>{item.label}</Text>
              {item.hint && <Text style={styles.hint}>{item.hint}</Text>}
            </View>
            {item.badge && <Text style={styles.badge}>{item.badge}</Text>}
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      {user ? (
        <Pressable onPress={onLogout} style={styles.logout}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onLogin} style={styles.login}>
          <Text style={styles.loginText}>Giriş Yap / Kayıt Ol</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 32, gap: 14 },
  greeting: { fontSize: 14, color: colors.textMuted, marginTop: -6 },
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
});
