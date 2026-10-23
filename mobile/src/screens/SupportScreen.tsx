import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { Chip } from '../components/TagChips';
import { KEYS, loadJson, saveJson } from '../lib/storage';
import {
  addSupportMessage,
  MAX_TEXT,
  SUPPORT_TOPICS,
  validateSupport,
  type SupportKind,
  type SupportMessage,
} from '../lib/support';
import { colors, themed } from '../theme';

type Props = { email: string | null; onBack: () => void };

const PLACEHOLDER: Record<SupportKind, string> = {
  bug: 'Ne oldu? Hangi ekrandaydın, ne bekliyordun?',
  contact: 'Mesajın…',
};

/** "Hata bildir" with an "İletişime geç" tab inside. */
export function SupportScreen({ email, onBack }: Props) {
  const [kind, setKind] = useState<SupportKind>('bug');
  const [topic, setTopic] = useState(SUPPORT_TOPICS.bug[0]);
  const [text, setText] = useState('');
  const [mail, setMail] = useState(email ?? '');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const switchKind = (next: SupportKind) => {
    setKind(next);
    setTopic(SUPPORT_TOPICS[next][0]);
    setResult(null);
  };

  const send = async () => {
    const problem = validateSupport(kind, text, mail);
    if (problem) return setResult({ ok: false, text: problem });
    const message: SupportMessage = {
      id: Crypto.randomUUID(),
      kind,
      topic,
      text: text.trim(),
      email: mail.trim(),
      createdAt: new Date().toISOString(),
    };
    const list = (await loadJson<SupportMessage[]>(KEYS.support)) ?? [];
    await saveJson(KEYS.support, addSupportMessage(list, message));
    setText('');
    setResult({
      ok: true,
      text: kind === 'bug' ? 'Teşekkürler, bildirimin alındı.' : 'Mesajın alındı, en kısa sürede dönüş yapacağız.',
    });
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>{kind === 'bug' ? 'Hata bildir' : 'İletişime geç'}</Text>
      </View>

      <View style={styles.tabs}>
        <Chip label="Hata bildir" active={kind === 'bug'} onPress={() => switchKind('bug')} />
        <Chip label="İletişime geç" active={kind === 'contact'} onPress={() => switchKind('contact')} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{kind === 'bug' ? 'Ne tür bir sorun?' : 'Konu'}</Text>
        <View style={styles.wrap}>
          {SUPPORT_TOPICS[kind].map((t) => (
            <Chip key={t} label={t} active={topic === t} onPress={() => setTopic(t)} />
          ))}
        </View>

        <Text style={styles.label}>{kind === 'bug' ? 'Açıklama' : 'Mesaj'}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={PLACEHOLDER[kind]}
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={MAX_TEXT}
          style={[styles.input, styles.multiline]}
        />

        <Text style={styles.label}>E-posta{kind === 'bug' ? ' (isteğe bağlı)' : ''}</Text>
        <TextInput
          value={mail}
          onChangeText={setMail}
          placeholder="ornek@mail.com"
          placeholderTextColor={colors.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        {result && <Text style={result.ok ? styles.success : styles.error}>{result.text}</Text>}
        <Pressable style={styles.primary} onPress={send}>
          <Text style={styles.primaryText}>Gönder</Text>
        </Pressable>
        <Text style={styles.note}>Prototip: mesajlar şimdilik yalnızca bu telefonda saklanır.</Text>
      </View>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', gap: 8 },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  success: { color: colors.success, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14 },
  primary: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  note: { fontSize: 12, color: colors.placeholder, textAlign: 'center' },
}));
