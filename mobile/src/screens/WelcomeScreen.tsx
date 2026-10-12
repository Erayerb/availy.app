import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Logo } from '../components/Logo';
import type { User } from '../lib/auth';
import { colors } from '../theme';

type Props = {
  user: User | null;
  onContinue: () => void;
  onSwitchAccount: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onGuest: () => void;
};

export function WelcomeScreen({ user, onContinue, onSwitchAccount, onLogin, onRegister, onGuest }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Logo />
        <Text style={styles.name}>Availy</Text>
        <Text style={styles.tagline}>Şu an nerede yer var?</Text>
      </View>

      {user ? (
        <View style={styles.actions}>
          <Text style={styles.greeting}>Merhaba, {user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <Pressable onPress={onContinue} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Bu hesapla devam et</Text>
          </Pressable>
          <Pressable
            onPress={onSwitchAccount}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Farklı hesapla giriş yap</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable onPress={onLogin} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Giriş Yap</Text>
          </Pressable>
          <Pressable onPress={onRegister} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>Kayıt Ol</Text>
          </Pressable>
          <Pressable onPress={onGuest} hitSlop={10} style={styles.guest}>
            <Text style={styles.guestText}>Kayıt olmadan devam et</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingBottom: 50 },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  name: { fontSize: 40, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 16, color: colors.textMuted },
  actions: { gap: 12 },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  email: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: -6, marginBottom: 8 },
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
  guestText: { color: colors.textMuted, fontSize: 15, textDecorationLine: 'underline' },
});
