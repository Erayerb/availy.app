import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import type { Venue } from '../lib/api';
import type { User } from '../lib/auth';
import { useCampaigns } from '../context/CampaignsContext';
import { checkinBody, checkinMessage, followUpQuestion, sendCheckin, type CheckinResult } from '../lib/checkinApi';
import { checkinSocialApi } from '../lib/reviews';
import { checkinShareMessage } from '../lib/share';
import { shareText } from '../lib/shareVenue';
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
  // The user's last check-in here (ISO), if any: a new one is possible 90 minutes later
  lastCheckinAt?: string | null;
};

// Same as the server: one check-in per venue every 90 minutes
const COOLDOWN_MS = 90 * 60_000;

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
  // What was just reported, for the celebration and "Arkadaşlarına paylaş"
  const [shared, setShared] = useState<{
    id: number;
    label: string;
    first: boolean;
    note: string | null;
    coupons: NonNullable<CheckinResult['coupons']>;
  } | null>(null);
  // "Fikrini yazmak ister misin?": a few words with the check-in, seen by friends and shared with it
  const [words, setWords] = useState('');
  const [savedWords, setSavedWords] = useState<string | null>(null);
  const { reload: reloadCoupons } = useCampaigns();
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

  // Closed: no check-in (the server refuses it too)
  if (!venue.open_now) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>🔒 Şu an kapalı</Text>
        <View style={[styles.primary, styles.disabled]}>
          <Text style={styles.primaryText}>Kapalı · {venue.opens_at}'de açılır</Text>
        </View>
        <Text style={styles.muted}>Kapalı mekana check-in yapılamaz; açılınca doluluğu bildirebilirsin.</Text>
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
      setShared({ id: done.id, label: look(level).label, first: done.is_first, note: null, coupons: done.coupons ?? [] });
      setWords('');
      setSavedWords(null);
      if (done.coupons?.length) reloadCoupons(); // shows up in Kuponlarım
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

  // Checked in here less than 90 minutes ago: the button stays, closed, with the time it opens above it
  if (coolingDown) {
    return (
      <View style={styles.card}>
        {result?.ok && shared ? (
          // A short celebration right after the check-in
          <View style={styles.party}>
            <Text style={styles.partyIcon}>{shared.first ? '✨' : '🎉'}</Text>
            <Text style={styles.partyTitle}>{shared.first ? 'Burayı sen keşfettin!' : 'Check-in yapıldı!'}</Text>
            <Text style={styles.success}>{result.text}</Text>
            {shared.coupons.map((c) => (
              <View key={c.code} style={styles.coupon}>
                <Text style={styles.couponTitle}>🎟 Kupon kazandın: {c.code}</Text>
                <Text style={styles.muted}>{c.message} · Kasada göster (Kampanyalar → Kuponlarım)</Text>
              </View>
            ))}
            {savedWords === null ? (
              <View style={styles.words}>
                <Text style={styles.text}>💬 Fikrini yazmak ister misin?</Text>
                <TextInput
                  value={words}
                  onChangeText={setWords}
                  placeholder="Burası nasıl? Arkadaşların check-in'inin altında görür"
                  placeholderTextColor={colors.placeholder}
                  maxLength={280}
                  multiline
                  style={styles.input}
                />
                {words.trim().length > 0 && (
                  <Pressable
                    style={styles.saveWords}
                    onPress={async () => {
                      if (!user?.token) return;
                      const saved = await checkinSocialApi.note(user.token, shared.id, words).catch(() => null);
                      setSavedWords(saved?.note ?? null);
                    }}
                  >
                    <Text style={styles.saveWordsText}>Paylaş</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text style={styles.quote}>“{savedWords}”</Text>
            )}
            <Pressable
              style={styles.share}
              onPress={async () => {
                const note = await shareText(checkinShareMessage(venue.name, shared.label, shared.first, savedWords ?? words));
                setShared({ ...shared, note });
              }}
            >
              <Text style={styles.shareText}>📣 Arkadaşlarına paylaş</Text>
            </Pressable>
            {shared.note && <Text style={styles.muted}>{shared.note}</Text>}
          </View>
        ) : (
          <>
            <Text style={styles.title}>✓ Check-in yapıldı</Text>
            <Text style={styles.muted}>Son check-in'in {clock(last)}.</Text>
          </>
        )}
        <Text style={styles.text}>Tekrar check-in: {clock(nextAt)}</Text>
        <View style={[styles.primary, styles.disabled]}>
          <Text style={styles.primaryText}>📍 Check-in yap</Text>
        </View>
        <Text style={styles.muted}>Aynı mekana 90 dakikada bir check-in yapılabilir.</Text>
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
  party: { alignItems: 'center', gap: 6, paddingVertical: 6 },
  words: { alignSelf: 'stretch', gap: 6 },
  input: {
    minHeight: 54,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.cream,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  saveWords: { alignSelf: 'flex-end', paddingVertical: 7, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary },
  saveWordsText: { color: colors.primary, fontWeight: '700' },
  quote: { fontSize: 14, fontStyle: 'italic', color: colors.text, textAlign: 'center' },
  coupon: { alignSelf: 'stretch', padding: 10, borderRadius: 12, backgroundColor: colors.cream, gap: 2, alignItems: 'center' },
  couponTitle: { fontSize: 15, fontWeight: '800', color: colors.primary },
  partyIcon: { fontSize: 44 },
  partyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  share: { marginTop: 4, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 12, backgroundColor: colors.primary },
  shareText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  privateText: { flex: 1, gap: 2 },
}));
