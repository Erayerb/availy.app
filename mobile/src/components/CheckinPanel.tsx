import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text';
import { Pressable } from './Pressable';

import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import type { Venue } from '../lib/api';
import type { User } from '../lib/auth';
import { useCampaigns } from '../context/CampaignsContext';
import { checkinBody, checkinMessage, followUpQuestion, sendCheckin, type CheckinResult, firstOfDayOpen } from '../lib/checkinApi';
import { isRegistered } from '../lib/auth';
import { confirmAction } from '../lib/confirm';
import { stars } from '../lib/feedback';
import { MAX_REVIEW, newestMine, reviewsApi, type Reviews } from '../lib/reviews';
import { checkinShareMessage } from '../lib/share';
import { shareText } from '../lib/shareVenue';
import { LEVELS, type Level } from '../lib/occupancy';
import { Celebration } from './Celebration';
import { haptics } from '../lib/haptics';
import { celebrateBadges } from '../lib/badgeEvents';
import { colors, themed } from '../theme';
import { ThemedSwitch } from './ThemedSwitch';
import { InlineIcon } from './Icon';

type Props = {
  venue: Venue;
  user: User | null;
  onLogin: () => void;
  onRegister: () => void;
  // Called after a successful check-in (e.g. to reload the venue and the user's points)
  onDone: () => void;
  // The user's last check-in here (ISO), if any: a new one is possible 90 minutes later
  lastCheckinAt?: string | null;
  // "Burası nasıl?" wrote, changed or deleted a review: the venue's list (or null: reload it)
  onReviewsChange?: (reviews: Reviews | null) => void;
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
export function CheckinPanel({ venue, user, onLogin, onRegister, onDone, lastCheckinAt = null, onReviewsChange }: Props) {
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
    streak: number;
    note: string | null;
    coupons: NonNullable<CheckinResult['coupons']>;
  } | null>(null);
  // "Burası nasıl?": stars and a few words right after the check-in. It is the venue review,
  // and friends see it with the check-in in Akış
  const [rating, setRating] = useState(0);
  const [words, setWords] = useState('');
  const [review, setReview] = useState<{ id: number; rating: number; body: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
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
        <Text style={styles.title}><InlineIcon name="lock" /> Şu an kapalı</Text>
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
      haptics.success();
      // Badges this check-in earned: their pop-up a moment after the check-in's own celebration
      if (done.new_badges?.length) setTimeout(() => celebrateBadges(done.new_badges), 1400);
      setResult({ ok: true, text: checkinMessage(done) });
      setShared({ id: done.id, label: look(level).label, first: done.is_first, streak: done.weekly_streak ?? 0, note: null, coupons: done.coupons ?? [] });
      setRating(0);
      setWords('');
      setReview(null);
      setEditing(false);
      setReviewError(null);
      if (done.coupons?.length) reloadCoupons(); // shows up in Kuponlarım
      setJustCheckedIn(Date.now());
      setLevel(null);
      setAnswer(null);
      onDone();
    } catch (e) {
      haptics.warning();
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Check-in yapılamadı.' });
    } finally {
      setSending(false);
    }
  };

  const saveReview = async () => {
    if (!user?.token || !shared || rating < 1) return;
    try {
      const list = review
        ? await reviewsApi.edit(user.token, review.id, rating, words)
        : await reviewsApi.write(user.token, venue.id, rating, words, true, shared.id);
      const mine = review ? list.items.find((r) => r.id === review.id) : newestMine(list);
      if (mine) setReview({ id: mine.id, rating: mine.rating, body: mine.body });
      setEditing(false);
      setReviewError(null);
      onReviewsChange?.(list);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Paylaşılamadı.');
    }
  };

  const removeReview = () => {
    if (!user?.token || !review) return;
    const token = user.token;
    confirmAction('Yorumun silinsin mi?', 'Mekan sayfasından ve arkadaşlarının akışından kaldırılır.', 'Sil', async () => {
      await reviewsApi.remove(token, review.id).catch(() => {});
      setReview(null);
      setRating(0);
      setWords('');
      onReviewsChange?.(null);
    });
  };

  // Checked in here less than 90 minutes ago: the button stays, closed, with the time it opens above it
  if (coolingDown) {
    return (
      <View style={styles.card}>
        {result?.ok && shared ? (
          // A short celebration right after the check-in
          <View style={styles.party}>
            <Celebration icon={shared.first ? 'sparkles' : 'confetti'} first={shared.first} />
            <Text style={styles.partyTitle}>{shared.first ? 'Burayı sen keşfettin!' : 'Check-in yapıldı!'}</Text>
            <Text style={styles.success}>{result.text}</Text>
            {shared.streak >= 2 && <Text style={styles.streak}><InlineIcon name="flame" /> {shared.streak}. hafta üst üste check-in!</Text>}
            {shared.coupons.map((c) => (
              <View key={c.code} style={styles.coupon}>
                <Text style={styles.couponTitle}><InlineIcon name="ticket" /> Kupon kazandın: {c.code}</Text>
                <Text style={styles.muted}>{c.message} · Kasada göster (Kampanyalar → Kuponlarım)</Text>
              </View>
            ))}
            {!isRegistered(user) ? (
              <Text style={styles.muted}>
                Burası hakkında yorum yazmak için{' '}
                <Text style={styles.link} onPress={onRegister}>
                  kayıt ol
                </Text>
                .
              </Text>
            ) : review && !editing ? (
              <View style={styles.words}>
                <Text style={styles.quote}>
                  <Text style={styles.stars}>{stars(review.rating)}</Text>
                  {review.body ? `  “${review.body}”` : ''}
                </Text>
                <View style={styles.reviewActions}>
                  <Pressable
                    hitSlop={10}
                    onPress={() => {
                      setRating(review.rating);
                      setWords(review.body);
                      setEditing(true);
                    }}
                  >
                    <Text style={styles.link}>Düzenle</Text>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={removeReview}>
                    <Text style={styles.deleteText}>Sil</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.words}>
                <Text style={styles.text}><InlineIcon name="message-circle" /> Burası nasıl?</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityLabel={`${n} yıldız`}>
                      <Text style={[styles.star, n <= rating && styles.starOn]}>{n <= rating ? '★' : '☆'}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={words}
                  onChangeText={setWords}
                  placeholder="Birkaç kelime (isteğe bağlı)"
                  placeholderTextColor={colors.placeholder}
                  maxLength={MAX_REVIEW}
                  multiline
                  style={styles.input}
                />
                {reviewError && <Text style={styles.error}>{reviewError}</Text>}
                <View style={styles.reviewActions}>
                  {editing && (
                    <Pressable style={styles.saveWords} onPress={() => setEditing(false)}>
                      <Text style={styles.saveWordsText}>Vazgeç</Text>
                    </Pressable>
                  )}
                  <Pressable style={[styles.saveWords, rating < 1 && styles.disabled]} onPress={saveReview} disabled={rating < 1}>
                    <Text style={styles.saveWordsText}>{editing ? 'Kaydet' : 'Paylaş'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
            <Pressable
              style={styles.share}
              onPress={async () => {
                const note = await shareText(checkinShareMessage(venue.name, shared.label, shared.first, review?.body ?? words));
                setShared({ ...shared, note });
              }}
            >
              <Text style={styles.shareText}><InlineIcon name="speakerphone" /> Arkadaşlarına paylaş</Text>
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
          <Text style={styles.primaryText}><InlineIcon name="map-pin" /> Check-in yap</Text>
        </View>
        <Text style={styles.muted}>Aynı mekana 90 dakikada bir check-in yapılabilir.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Şu an burası nasıl?</Text>
      {firstOfDayOpen(venue) && <Text style={styles.firstToday}>Bugünün ilk bilgisini sen ver: 2 kat puan</Text>}
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
          <Text style={styles.text}><InlineIcon name="lock" /> Gizli check-in</Text>
          <Text style={styles.muted}>Doluluğa sayılır ama adın kimseye gösterilmez.</Text>
        </View>
        <ThemedSwitch value={isPrivate} onValueChange={setIsPrivate} />
      </View>

      <Pressable
        onPress={checkIn}
        disabled={!level || sending}
        style={[styles.primary, (!level || sending) && styles.disabled]}
      >
        <Text style={styles.primaryText}>{sending ? 'Gönderiliyor…' : <><InlineIcon name="map-pin" /> Check-in yap</>}</Text>
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
  firstToday: { fontSize: 13, fontWeight: '700', color: colors.gold },
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
  stars: { color: '#E0A800', fontStyle: 'normal' },
  streak: { fontSize: 15, fontWeight: '800', color: colors.text },
  starsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  star: { fontSize: 28, color: colors.textMuted },
  starOn: { color: '#E0A800' },
  reviewActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  deleteText: { color: colors.danger, fontWeight: '700' },
  coupon: { alignSelf: 'stretch', padding: 10, borderRadius: 12, backgroundColor: colors.cream, gap: 2, alignItems: 'center' },
  couponTitle: { fontSize: 15, fontWeight: '800', color: colors.primary },
  partyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  share: { marginTop: 4, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 12, backgroundColor: colors.primary },
  shareText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  privateText: { flex: 1, gap: 2 },
}));
