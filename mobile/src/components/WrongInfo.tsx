import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text';

import { Pressable } from './Pressable';
import { ISSUE_KINDS, venueIssuesApi, type IssueKind } from '../lib/venueIssues';
import { colors, themed } from '../theme';

/** Next to the venue name: "Bilgi yanlış mı?" → a pop-up: what is wrong (kapanmış / saatler / konum / ad)
 * and an optional note. The same thing from 3 people puts the venue on the admin's list. */
export function WrongInfo({ venueId, venueName, token }: { venueId: number; venueName: string; token: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<IssueKind | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const close = () => {
    setOpen(false);
    setKind(null);
    setNote('');
    setResult(null);
  };

  const submit = async () => {
    if (!kind) return;
    try {
      await venueIssuesApi.report(token, venueId, kind, note);
      setSent(true);
      setResult('Teşekkürler! Aynı şeyi birkaç kişi bildirince mekanı kontrol edip düzeltiyoruz.');
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Gönderilemedi, tekrar dene.');
    }
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.linkWrap} accessibilityLabel="Bilgi yanlış mı? Bildir">
        <Text style={styles.link}>{sent ? 'Bildirildi ✓' : 'Bilgi yanlış mı?'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Kapat">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Taps inside the box do not close it */}
            <Pressable style={styles.box} onPress={() => {}}>
              <Text style={styles.title}>{venueName}: ne yanlış?</Text>
              {result ? (
                <>
                  <Text style={styles.muted}>{result}</Text>
                  <Pressable style={styles.send} onPress={close}>
                    <Text style={styles.sendText}>Tamam</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.chips}>
                    {ISSUE_KINDS.map((k) => (
                      <Pressable key={k.kind} onPress={() => setKind(k.kind)} style={[styles.chip, kind === k.kind && styles.chipOn]}>
                        <Text style={[styles.chipText, kind === k.kind && styles.chipTextOn]}>{k.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {kind && kind !== 'closed' && (
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      maxLength={200}
                      placeholder={kind === 'hours' ? 'Doğru saatler (ör. 09–23)' : kind === 'name' ? 'Doğru adı' : 'Nerede olmalı? (isteğe bağlı)'}
                      placeholderTextColor={colors.placeholder}
                      style={styles.input}
                    />
                  )}
                  <View style={styles.row}>
                    <Pressable onPress={close} hitSlop={8}>
                      <Text style={styles.muted}>Vazgeç</Text>
                    </Pressable>
                    <View style={styles.flex} />
                    <Pressable disabled={!kind} style={[styles.send, !kind && styles.disabled]} onPress={submit}>
                      <Text style={styles.sendText}>Gönder</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  linkWrap: { paddingTop: 8 },
  link: { color: colors.textMuted, fontWeight: '600', fontSize: 12, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  box: { padding: 18, borderRadius: 18, backgroundColor: colors.surface, gap: 14, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 14, backgroundColor: colors.cream },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextOn: { color: colors.onPrimary },
  input: { padding: 10, borderRadius: 10, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  muted: { fontSize: 14, color: colors.textMuted },
  send: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  sendText: { color: colors.onPrimary, fontWeight: '700' },
  disabled: { opacity: 0.4 },
}));
