import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Collapsible } from '../components/Collapsible';
import { PhotoSection } from '../components/business/PhotoSection';
import { BadgeGrid } from '../components/BadgeGrid';
import { PlanSection } from '../components/business/PlanSection';
import { BackButton } from '../components/BackButton';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { useEngagement } from '../context/EngagementContext';
import { accountKey, MIN_PASSWORD_LENGTH, normalizeUsername, type User } from '../lib/auth';
import { DEFAULT_PLAN, type PlanId } from '../lib/plans';
import { availyPoints, customerCode } from '../lib/loyalty';
import { colors } from '../theme';

type Props = {
  user: User | null;
  onBack: () => void;
  onPlanChange: (plan: PlanId) => void;
  onLogin: () => void;
  onRegister: () => void;
  onChangeUsername: (username: string) => Promise<string | null>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<string | null>;
  onDeleteAccount: () => Promise<void>;
  onLogout: () => void;
  onOpenMyProfile: () => void;
};

export function ProfileScreen({
  user,
  onBack,
  onPlanChange,
  onLogin,
  onRegister,
  onChangeUsername,
  onChangePassword,
  onDeleteAccount,
  onLogout,
  onOpenMyProfile,
}: Props) {
  const business = user?.role === 'business';
  // Business: its venue, edited from here
  const { venues } = useVenuesByIds(business && user?.venueId ? [user.venueId] : []);
  const venue = venues[0];
  const { coupons, cards, programs } = useEngagement();
  const [username, setUsername] = useState(user?.username ?? '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Shown right under the user name field, where the change is made
  const [usernameMessage, setUsernameMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!user || user.isGuest) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <BackButton onPress={onBack} />
          <Text style={styles.title}>Profil</Text>
        </View>
        <View style={styles.guest}>
          {user && <Text style={styles.name}>{user.name}</Text>}
          <Text style={styles.muted}>
            Misafir olarak geziyorsun. Misafir check-in'leri daha az sayılır. Kayıt olursan tam sayılır ve
            puanların korunur.
          </Text>
          <Pressable style={styles.primary} onPress={onRegister}>
            <Text style={styles.primaryText}>Kayıt ol</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onLogin}>
            <Text style={styles.secondaryText}>Hesabım var, giriş yap</Text>
          </Pressable>
          {user && (
            <Text style={styles.muted}>
              Başka bir hesapla giriş yaparsan bu misafir hesabının puanları o hesaba geçmez.
            </Text>
          )}
          {user && (
            <Text style={styles.text}>
              Misafir puanın: {user.points ?? 0} (misafirler her şeyden yarım puan alır)
            </Text>
          )}
          {user?.badges && <BadgeGrid badges={user.badges} />}
        </View>
      </ScrollView>
    );
  }

  const myCards = cards.filter((c) => c.userKey === accountKey(user));
  const stamps = myCards.reduce(
    (sum, c) =>
      sum +
      c.stamps +
      c.rewardsAvailable * (programs.find((p) => p.venueId === c.venueId)?.stampsRequired ?? 0),
    0,
  );
  const myCoupons = coupons.filter((c) => c.userKey === accountKey(user));
  const used = myCoupons.filter((c) => c.redeemedAt).length;

  const savePassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage({ ok: false, text: `Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` });
      return;
    }
    const error = await onChangePassword(oldPassword, newPassword);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: 'Şifre değiştirildi.' });
    if (!error) {
      setOldPassword('');
      setNewPassword('');
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>{business ? 'İşletme Profili' : 'Profil ayarları'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.name}>{user.username ? `@${user.username}` : user.name}</Text>
        <Text style={styles.muted}>
          {user.email} · {user.role === 'business' ? 'İşletme hesabı' : 'Bireysel hesap'}
        </Text>
        {!business && (
          <Text style={styles.text}>
            Müşteri kodun: <Text style={styles.code}>{customerCode(accountKey(user))}</Text>
          </Text>
        )}
      </View>

      {business ? (
        <View style={styles.section}>
          {venue && <PhotoSection venue={venue} />}
          <PlanSection plan={user.plan ?? DEFAULT_PLAN} onPlanChange={onPlanChange} />
        </View>
      ) : (
        // Points, badges and visited venues are on the profile behind the top-right icon
        <Pressable style={styles.secondary} onPress={onOpenMyProfile}>
          <Text style={styles.secondaryText}>
            Profilimi gör · {(user.points ?? 0) + availyPoints(stamps, used)} puan, rozetler, mekanlar
          </Text>
        </Pressable>
      )}

      <Collapsible title="Kullanıcı adını değiştir" summary={user.username ? `Şu an @${user.username}` : undefined}>
        <TextInput
          value={username}
          onChangeText={(text) => {
            setUsername(normalizeUsername(text));
            setUsernameMessage(null);
          }}
          placeholder="kullaniciadi"
          style={styles.input}
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.muted}>Arkadaşların seni bununla bulur; eski adın başkası tarafından alınabilir.</Text>
        <Pressable
          style={styles.secondary}
          onPress={async () => {
            if (normalizeUsername(username) === user.username) {
              setUsernameMessage({ ok: false, text: 'Bu zaten senin kullanıcı adın.' });
              return;
            }
            const error = await onChangeUsername(username);
            setUsernameMessage(
              error ? { ok: false, text: error } : { ok: true, text: `✓ Kullanıcı adın @${normalizeUsername(username)} olarak değişti.` },
            );
          }}
        >
          <Text style={styles.secondaryText}>Kaydet</Text>
        </Pressable>
        {usernameMessage && (
          <Text style={usernameMessage.ok ? styles.success : styles.error}>{usernameMessage.text}</Text>
        )}
      </Collapsible>

      <Collapsible title="Şifreni değiştir" summary="Mevcut şifren ve yeni şifren">
        <TextInput
          value={oldPassword}
          onChangeText={setOldPassword}
          placeholder="Mevcut şifre"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          style={styles.input}
        />
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Yeni şifre"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          style={styles.input}
        />
        <Pressable style={styles.secondary} onPress={savePassword}>
          <Text style={styles.secondaryText}>Şifreyi değiştir</Text>
        </Pressable>
        {message && <Text style={message.ok ? styles.success : styles.error}>{message.text}</Text>}
      </Collapsible>

      <Pressable style={styles.secondary} onPress={onLogout}>
        <Text style={styles.secondaryText}>Çıkış yap</Text>
      </Pressable>

      <Collapsible title="Hesabı sil" summary="Hesabın ve yorumların kalıcı olarak silinir">
        <Text style={styles.muted}>
          Hesabın, yorumların, arkadaşlıkların ve puanların silinir; check-in'lerin yalnızca adsız doluluk bilgisi olarak
          kalır. Bu geri alınamaz.
        </Text>
        {confirmDelete ? (
          <View style={styles.row}>
            <Pressable style={[styles.danger, styles.flex]} onPress={onDeleteAccount}>
              <Text style={styles.primaryText}>Evet, sil</Text>
            </Pressable>
            <Pressable style={[styles.secondary, styles.flex]} onPress={() => setConfirmDelete(false)}>
              <Text style={styles.secondaryText}>Vazgeç</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmDelete(true)}>
            <Text style={styles.deleteLink}>Hesabımı sil</Text>
          </Pressable>
        )}
      </Collapsible>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  guest: { paddingHorizontal: 8, gap: 16 },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  code: { fontWeight: '800', letterSpacing: 1 },
  section: { gap: 14 },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  primary: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
  secondary: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  danger: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center' },
  deleteLink: { color: colors.danger, fontWeight: '600' },
  success: { color: colors.success, fontWeight: '600' },
  error: { color: colors.danger },
});
