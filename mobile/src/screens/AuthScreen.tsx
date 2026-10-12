import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BackButton } from '../components/BackButton';
import { Logo } from '../components/Logo';
import { validateLogin, validateRegister } from '../lib/auth';
import { colors } from '../theme';

type Mode = 'login' | 'register';

type Props = {
  mode: Mode;
  onBack: () => void;
  onSwitchMode: (mode: Mode) => void;
  // Resolve to an error message, or null on success
  onLogin: (email: string, password: string) => Promise<string | null>;
  onRegister: (name: string, email: string, password: string) => Promise<string | null>;
};

/** Sign in / sign up form. Prototype: accounts live only on this phone. */
export function AuthScreen({ mode, onBack, onSwitchMode, onLogin, onRegister }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  const submit = async () => {
    const problem = isRegister ? validateRegister(name, email, password) : validateLogin(email, password);
    setError(problem);
    if (problem || busy) return;
    setBusy(true);
    const failure = isRegister ? await onRegister(name, email, password) : await onLogin(email, password);
    // On success the app switches screens; only update state if we are still here
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BackButton onPress={onBack} />

        <View style={styles.brand}>
          <Logo size={64} />
          <Text style={styles.title}>{isRegister ? 'Kayıt Ol' : 'Giriş Yap'}</Text>
        </View>

        {isRegister && (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ad"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            autoCapitalize="words"
            textContentType="name"
          />
        )}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          secureTextEntry
          textContentType={isRegister ? 'newPassword' : 'password'}
          onSubmitEditing={submit}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}
        >
          <Text style={styles.primaryText}>{isRegister ? 'Kayıt Ol' : 'Giriş Yap'}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setError(null);
            onSwitchMode(isRegister ? 'login' : 'register');
          }}
          hitSlop={10}
          style={styles.switch}
        >
          <Text style={styles.switchText}>
            {isRegister ? 'Hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
          </Text>
        </Pressable>

        <Text style={styles.note}>Prototip: hesap sadece bu telefonda tutulur, sunucuya gönderilmez.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40, gap: 14 },
  brand: { alignItems: 'center', gap: 12, marginVertical: 16 },
  title: { fontSize: 26, fontWeight: '700' },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.cream,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 14 },
  primary: { marginTop: 6, paddingVertical: 15, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  switch: { alignItems: 'center', paddingVertical: 6 },
  switchText: { color: colors.primary, fontSize: 15 },
  note: { textAlign: 'center', color: colors.placeholder, fontSize: 12, marginTop: 8 },
});
