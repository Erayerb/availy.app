import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Logo } from '../components/Logo';
import { Wordmark } from '../components/Wordmark';
import type { Role } from '../lib/auth';
import { colors, themed } from '../theme';

type Props = {
  onLogin: (role: Role) => void;
  onRegister: (role: Role) => void;
  // Opens a guest account on the server; resolves to an error message, or null
  onGuest: () => Promise<string | null>;
};

const ROLE_LABELS: Record<Role, string> = { personal: 'Bireysel', business: 'İşletme' };

/** First page for signed-out users; signed-in users only see a short splash. */
export function WelcomeScreen({ onLogin, onRegister, onGuest }: Props) {
  // Guests first pick an account type, then sign in or sign up
  const [role, setRole] = useState<Role | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const continueAsGuest = async () => {
    setOpening(true);
    setGuestError(null);
    const error = await onGuest();
    setOpening(false);
    setGuestError(error);
  };

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Logo />
        <Wordmark size={56} />
        <Text style={styles.tagline}>Şu an nerede yer var?</Text>
      </View>

      <View style={styles.actions}>
        {role === null ? (
          <>
            <Text style={styles.question}>availy'yi nasıl kullanacaksın?</Text>
            <Pressable onPress={() => setRole('personal')} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>Bireysel</Text>
            </Pressable>
            <Pressable onPress={() => setRole('business')} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>İşletme</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => setRole(null)} hitSlop={10}>
              <Text style={styles.roleLine}>
                {ROLE_LABELS[role]} hesap · <Text style={styles.change}>değiştir</Text>
              </Text>
            </Pressable>
            <Pressable onPress={() => onLogin(role)} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>Giriş Yap</Text>
            </Pressable>
            <Pressable onPress={() => onRegister(role)} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Kayıt Ol</Text>
            </Pressable>
          </>
        )}
        {/* A business needs an account; only customers can look around as a guest */}
        {role !== 'business' && (
          <Pressable onPress={continueAsGuest} disabled={opening} hitSlop={10} style={styles.guest}>
            <Text style={styles.guestText}>{opening ? 'Açılıyor…' : 'Kayıt olmadan devam et'}</Text>
          </Pressable>
        )}
        {guestError && <Text style={styles.error}>{guestError}</Text>}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingBottom: 50 },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  tagline: { fontSize: 16, color: colors.textMuted },
  actions: { gap: 12 },
  question: { fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: 4 },
  roleLine: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },
  change: { color: colors.primary, textDecorationLine: 'underline' },
  primary: { paddingVertical: 15, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  secondary: {
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  guest: { alignItems: 'center', paddingVertical: 10 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  guestText: { color: colors.textMuted, fontSize: 15, textDecorationLine: 'underline' },
}));
