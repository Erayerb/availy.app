import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Text, TextInput } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { BackButton } from '../components/BackButton';
import { accountApi } from '../lib/accountApi';
import { MIN_PASSWORD_LENGTH } from '../lib/auth';
import { colors, themed } from '../theme';

type Props = {
  initialEmail: string;
  onBack: () => void;
  onDone: (email: string) => void; // back to "Giriş Yap" with the e-mail filled in
};

const asMessage = (e: unknown) => (e instanceof Error ? e.message : 'Bir sorun oldu, tekrar dene.');

/** "Şifremi unuttum": e-mail -> 6-digit code by e-mail -> new password. */
export function ForgotPasswordScreen({ initialEmail, onBack, onDone }: Props) {
  // A user name typed on the login form is not an e-mail
  const [email, setEmail] = useState(initialEmail.includes('@') ? initialEmail : '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (!email.includes('@')) return setNote({ ok: false, text: 'Hesabının e-posta adresini yaz.' });
    setBusy(true);
    try {
      await accountApi.forgot(email.trim());
      setSent(true);
      setNote({ ok: true, text: `Bu adresle bir hesap varsa ${email.trim()} adresine 6 haneli bir kod gönderdik.` });
    } catch (e) {
      setNote({ ok: false, text: asMessage(e) });
    }
    setBusy(false);
  };

  const reset = async () => {
    if (code.length !== 6) return setNote({ ok: false, text: 'E-postadaki 6 haneli kodu yaz.' });
    if (password.length < MIN_PASSWORD_LENGTH) return setNote({ ok: false, text: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` });
    setBusy(true);
    try {
      await accountApi.reset(email.trim(), code, password);
      onDone(email.trim());
    } catch (e) {
      setNote({ ok: false, text: asMessage(e) });
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BackButton onPress={onBack} />
        <Text style={styles.title}>Şifremi unuttum</Text>
        <Text style={styles.muted}>Hesabının e-posta adresine bir kod göndereceğiz; kodla yeni şifreni belirlersin.</Text>
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
          editable={!sent}
        />
        {sent && (
          <>
            <TextInput
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 haneli kod"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Yeni şifre"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              secureTextEntry
              textContentType="newPassword"
              onSubmitEditing={reset}
            />
          </>
        )}
        {note && <Text style={note.ok ? styles.success : styles.error}>{note.text}</Text>}
        <Pressable
          onPress={sent ? reset : sendCode}
          disabled={busy}
          style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}
        >
          <Text style={styles.primaryText}>{sent ? 'Şifreyi değiştir' : 'Kod gönder'}</Text>
        </Pressable>
        {sent && (
          <Pressable onPress={sendCode} hitSlop={8} disabled={busy}>
            <Text style={styles.link}>Kod gelmedi mi? Tekrar gönder</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40, gap: 14 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 8 },
  muted: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.cream,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 14 },
  success: { color: colors.success, fontSize: 14, fontWeight: '600' },
  primary: { paddingVertical: 15, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  link: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
}));
