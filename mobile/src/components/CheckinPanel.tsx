import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import type { Venue } from '../lib/api';
import type { User } from '../lib/auth';
import { checkinBody, checkinMessage, followUpQuestion, sendCheckin } from '../lib/checkinApi';
import { LEVELS, type Level } from '../lib/occupancy';
import { colors, themed } from '../theme';
import { ThemedSwitch } from './ThemedSwitch';

type Props = {
  venue: Venue;
  user: User | null;
  onLogin: () => void;
  onRegister: () => void;
  // Called after a successful check-in (e.g. to reload the venue and the user's points)
  onDone: () => void;
  // The user's last check-in here (ISO), if any: a new one is possible 2 hours later
  lastCheckinAt?: string | null;
};

// Same as the server: one check-in per venue every 2 hours
const COOLDOWN_MS = 2 * 60 * 60_000;

const clock = (ms: number) => new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

const LOCATION_ERRORS = {
  denied: 'Check-in için konum izni gerekli.',
  blocked: "Check-in için konum izni gerekli. Telefonun Ayarlar'ından availy'ye konum izni ver.",
  failed: 'Konumun alınamadı. Biraz sonra tekrar dene.',
};

/** v2 check-in: first say how busy it is (and the follow-up question), then the Check-in button opens. */
export function CheckinPanel({ venue, user, onLogin, onRegister, onDone, lastCheckinAt = null }: Props) {
  const { look, privateByDefault } = useSettings();
  const { locate } = useLocation();
  const [level, setLevel] = useState<Level | null>(null);
  const [answer, setAnswer] = useState<boolean | null>(null);
  // Gizlilik ayarları: "Check-in'lerim varsayılan olarak gizli olsun"
  const [isPrivate, setIsPrivate] = useState(privateByDefault);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; settings?: boolean } | null>(null);
  // Set right after a check-in, before the visits list has reloaded
  const [justCheckedIn, setJustCheckedIn] = useState<number | null>(null);
  const question = followUpQuestion(level);
  const last = Math.max(justCheckedIn ?? 0, lastCheckinAt ? new Date(lastCheckinAt).getTime() : 0);
  const nextAt = last ? last + COOLDOWN_MS : 0;
  const coolingDown = nextAt > Date.now();

  // Occupancy comes from customers only
  if (user?.role === 'business') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Check-in</Text>
        <Text style={styles.muted}>İşletme hesabıyla check-in yapılamaz; mekanların doluluğunu müşteriler bildirir.</Text>
      </View>
    );
  }

  if (!venue.open_now) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Check-in</Text>
        <Text style={styles.muted}>Mekan şu an kapalı; {venue.opens_at}'de açılınca check-in yapabilirsin.</Text>
      </View>
    );
  }

  const choose = (next: Level) => {
    setLevel(next);
    setAnswer(null);
    setResult(null);
  };

  const checkIn = async () => {
    if (!level) return;
    if (!user?.token) {
      setResult({ ok: false, text: 'Check-in için giriş yap ya da misafir olarak devam et.' });
      return;
    }
    setSending(true);
    setResult(null);
    const position = await locate();
    if (position.error !== null) {
      setSending(false);
      setResult({ ok: false, text: LOCATION_ERRORS[position.error], settings: position.error === 'blocked' });
      return;
    }
    try {
      const done = await sendCheckin(user.token, venue.id, checkinBody(level, answer, position.coords, isPrivate));
      setResult({ ok: true, text: checkinMessage(done) });
      setJustCheckedIn(Date.now());
      setLevel(null);
      setAnswer(null);
      onDone();
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Check-in yapılamadı.' });
    } finally {
      setSending(false);
    }
  };

  // Checked in here less than 2 hours ago: the button stays, closed, with the time it opens above it
  if (coolingDown) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>✓ Check-in yapıldı</Text>
        {result?.ok ? (
          <Text style={styles.success}>{result.text}</Text>
        ) : (
          <Text style={styles.muted}>Son check-in'in {clock(last)}.</Text>
        )}
        <Text style={styles.text}>Tekrar check-in: {clock(nextAt)}</Text>
        <View style={[styles.primary, styles.disabled]}>
          <Text style={styles.primaryText}>📍 Check-in yap</Text>
        </View>
        <Text style={styles.muted}>Aynı mekana 2 saatte bir check-in yapılabilir.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Şu an burası nasıl?</Text>
      <View style={styles.row}>
        {LEVELS.map((l) => {
          const { color, label } = look(l);
          const selected = level === l;
          return (
            <Pressable
              key={l}
              onPress={() => choose(l)}
              style={[styles.level, { borderColor: color }, selected && { backgroundColor: color }]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.levelText, { color: selected ? colors.white : color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {question && (
        <View style={styles.question}>
          <Text style={styles.text}>{question.text}</Text>
          <View style={styles.row}>
            {[true, false].map((value) => (
              <Pressable
                key={String(value)}
                onPress={() => setAnswer(answer === value ? null : value)}
                style={[styles.answer, answer === value && styles.answerOn]}
              >
                <Text style={[styles.answerText, answer === value && styles.answerTextOn]}>{value ? 'Evet' : 'Hayır'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.privateRow}>
        <View style={styles.privateText}>
          <Text style={styles.text}>🔒 Gizli check-in</Text>
          <Text style={styles.muted}>Doluluğa sayılır ama adın kimseye gösterilmez.</Text>
        </View>
        <ThemedSwitch value={isPrivate} onValueChange={setIsPrivate} />
      </View>

      <Pressable
        onPress={checkIn}
        disabled={!level || sending}
        style={[styles.primary, (!level || sending) && styles.disabled]}
      >
        <Text style={styles.primaryText}>{sending ? 'Gönderiliyor…' : '📍 Check-in yap'}</Text>
      </Pressable>
      {!level && <Text style={styles.muted}>Check-in için önce doluluğu seç.</Text>}

      {user?.isGuest && (
        <Text style={styles.muted}>
          Misafir check-in'leri daha az sayılır. Kayıt olursan tam sayılır ve puanların korunur.{' '}
          <Text style={styles.link} onPress={onRegister}>
            Kayıt ol
          </Text>
        </Text>
      )}
      {result && <Text style={result.ok ? styles.success : styles.error}>{result.text}</Text>}
      {result?.settings && (
        <Pressable onPress={() => Linking.openSettings()}>
          <Text style={styles.link}>Ayarlar'dan konum iznini aç</Text>
        </Pressable>
      )}
      {!user && (
        <Pressable onPress={onLogin}>
          <Text style={styles.link}>Giriş yap</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8 },
  level: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  levelText: { fontSize: 14, fontWeight: '700' },
  question: { gap: 6 },
  answer: { paddingVertical: 7, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.cream },
  answerOn: { backgroundColor: colors.text },
  answerText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  answerTextOn: { color: colors.white },
  primary: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  success: { color: colors.success, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '700' },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  privateText: { flex: 1, gap: 2 },
}));
