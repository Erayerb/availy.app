import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PhotoSection } from '../components/business/PhotoSection';
import { PlanSection } from '../components/business/PlanSection';
import { BackButton } from '../components/BackButton';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { useEngagement } from '../context/EngagementContext';
import { useFavorites } from '../context/FavoritesContext';
import { MIN_PASSWORD_LENGTH, type User } from '../lib/auth';
import { DEFAULT_PLAN, type PlanId } from '../lib/plans';
import { availyPoints, customerCode } from '../lib/loyalty';
import { colors } from '../theme';

type Props = {
  user: User | null;
  onBack: () => void;
  onPlanChange: (plan: PlanId) => void;
  onLogin: () => void;
  onRename: (name: string) => Promise<void>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<string | null>;
  onDeleteAccount: () => Promise<void>;
  onLogout: () => void;
};

export function ProfileScreen({
  user,
  onBack,
  onPlanChange,
  onLogin,
  onRename,
  onChangePassword,
  onDeleteAccount,
  onLogout,
}: Props) {
  const business = user?.role === 'business';
  // Business: its venue, edited from here
  const { venues } = useVenuesByIds(business && user?.venueId ? [user.venueId] : []);
  const venue = venues[0];
  const { ids: favorites } = useFavorites();
  const { coupons, cards, programs, watches } = useEngagement();
  const [name, setName] = useState(user?.name ?? '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!user) {
    return (
      <View style={styles.page}>
        <View style={[styles.content, styles.topRow]}>
          <BackButton onPress={onBack} />
          <Text style={styles.title}>Profil</Text>
        </View>
        <View style={styles.guest}>
          <Text style={styles.muted}>
            Misafir olarak geziyorsun. Profil, puan ve sadakat kartları için giriş yap.
          </Text>
          <Pressable style={styles.primary} onPress={onLogin}>
            <Text style={styles.primaryText}>Giriş yap / Kayıt ol</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const myCards = cards.filter((c) => c.userKey === user.email);
  const stamps = myCards.reduce(
    (sum, c) =>
      sum +
      c.stamps +
      c.rewardsAvailable * (programs.find((p) => p.venueId === c.venueId)?.stampsRequired ?? 0),
    0,
  );
  const myCoupons = coupons.filter((c) => c.userKey === user.email);
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
        <Text style={styles.title}>{business ? 'İşletme Profili' : 'Profil'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.muted}>
          {user.email} · {user.role === 'business' ? 'İşletme hesabı' : 'Bireysel hesap'}
        </Text>
        {!business && (
          <Text style={styles.text}>
            Müşteri kodun: <Text style={styles.code}>{customerCode(user.email)}</Text>
          </Text>
        )}
      </View>

      {business ? (
        <View style={styles.section}>
          {venue && <PhotoSection venue={venue} />}
          <PlanSection plan={user.plan ?? DEFAULT_PLAN} onPlanChange={onPlanChange} />
        </View>
      ) : (
        <View style={styles.stats}>
          <Stat value={availyPoints(stamps, used)} label="availy puanı" />
          <Stat value={favorites.length} label="favori" />
          <Stat value={myCoupons.length} label="kupon" />
          <Stat value={watches.length} label="takip" />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Adını değiştir</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholderTextColor={colors.placeholder}
        />
        <Pressable
          style={styles.secondary}
          onPress={async () => {
            await onRename(name);
            setMessage({ ok: true, text: 'Adın güncellendi.' });
          }}
        >
          <Text style={styles.secondaryText}>Kaydet</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Şifreni değiştir</Text>
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
      </View>

      {message && <Text style={message.ok ? styles.success : styles.error}>{message.text}</Text>}

      <Pressable style={styles.secondary} onPress={onLogout}>
        <Text style={styles.secondaryText}>Çıkış yap</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Hesabı sil</Text>
        <Text style={styles.muted}>
          Hesabın bu telefondan silinir. Favoriler ve kuponlar telefonda kalır.
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
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  guest: { padding: 24, gap: 16 },
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
  stats: { flexDirection: 'row', gap: 8 },
  section: { gap: 14 },
  stat: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textMuted },
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
