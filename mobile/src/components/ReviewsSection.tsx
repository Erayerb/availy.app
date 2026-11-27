import { InlineStars } from './Stars';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text';
import { Pressable } from './Pressable';

import { isRegistered, type User } from '../lib/auth';
import { confirmAction } from '../lib/confirm';
import { sentence, timeAgo } from '../lib/crowd';
import { author, MAX_REPLIES_PER_PERSON, MAX_REVIEW, reviewsApi, type Review, type Reviews } from '../lib/reviews';
import { REPORT_REASONS, safetyApi, type ReportReason } from '../lib/safety';
import { colors, themed } from '../theme';
import { Icon } from './Icon';

// Reviews shown before "Tümünü göster"
const FIRST_REVIEWS = 5;

type Props = {
  venueId: number;
  user: User | null;
  reviews: Reviews;
  reload: () => void;
  onOpenUser: (username: string) => void;
};

/** v2 "Yorumlar": stars and a comment per person, replies from other users if the author allows them. */
export function ReviewsSection({ venueId, user, reviews, reload, onOpenUser }: Props) {
  const registered = isRegistered(user) && !!user?.token;
  const token = user?.token;
  // Businesses do not write reviews; on their own venue they answer them ("İşletme")
  const business = user?.role === 'business';
  const ownerBusiness = business && user?.venueId === venueId;
  const [showAll, setShowAll] = useState(false);

  // Stars without words count in the average only, mine too; only reviews with words are listed
  const written = reviews.items.filter((r) => r.body?.trim());
  const shown = showAll ? written : written.slice(0, FIRST_REVIEWS);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Yorumlar
        {reviews.count > 0 && (
          <>
            {' · '}
            <InlineStars rating={Math.round(reviews.average ?? 0)} /> {reviews.average} ({reviews.count})
          </>
        )}
      </Text>

      {/* Rating is given right after a check-in (in the check-in box); here only what people wrote */}
      {ownerBusiness && <Text style={styles.muted}>Müşterilerinin yorumlarına "Yanıtla" ile işletme olarak cevap verebilirsin.</Text>}
      {reviews.count === 0 && <Text style={styles.muted}>Yorum yok. Check-in yap, ilk yorumu sen yaz.</Text>}
      {shown.map((review) => (
        <ReviewItem
          key={review.id}
          review={review}
          token={registered && (!business || ownerBusiness) ? token : undefined}
          ownerBusiness={ownerBusiness}
          reload={reload}
          onOpenUser={onOpenUser}
        />
      ))}
      {reviews.count > 0 && written.length === 0 && <Text style={styles.muted}>Yazılı yorum yok.</Text>}
      {!showAll && written.length > FIRST_REVIEWS && (
        <Pressable onPress={() => setShowAll(true)}>
          <Text style={styles.link}>Tüm yorumları göster ({written.length})</Text>
        </Pressable>
      )}
    </View>
  );
}

function ReviewItem({
  review,
  token,
  ownerBusiness = false,
  reload,
  onOpenUser,
}: {
  review: Review;
  token: string | undefined;
  ownerBusiness?: boolean;
  reload: () => void;
  onOpenUser: (username: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The venue's business can always answer; others when the author allows it; at most 2 replies each
  const myReplies = review.replies.filter((r) => r.mine).length;
  const allowed = !!token && (review.allow_replies || review.mine || ownerBusiness);
  const canReply = allowed && myReplies < MAX_REPLIES_PER_PERSON;
  const now = new Date();

  const sendReply = async () => {
    if (!token || !text.trim()) return;
    try {
      await reviewsApi.reply(token, review.id, text);
      setText('');
      setReplying(false);
      setError(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gönderilemedi.');
    }
  };

  return (
    <View style={styles.review}>
      <Text style={styles.text}>
        <InlineStars rating={review.rating} /> ·{' '}
        <Text style={styles.bold} onPress={() => review.username && token && onOpenUser(review.username)}>
          {author(review.username)}
        </Text>
        <Text style={styles.muted}> · {timeAgo(review.created_at, now)}</Text>
      </Text>
      {review.body ? <Text style={styles.text}>{review.body}</Text> : null}

      {review.replies.map((reply) => (
        <View key={reply.id} style={styles.reply}>
          <Text style={styles.text}>
            <Text style={styles.bold} onPress={() => reply.username && token && onOpenUser(reply.username)}>
              {author(reply.username)}
            </Text>
            {reply.is_business && (
              <>
                {' '}
                <Text style={styles.businessTag}> İşletme </Text>
              </>
            )}{' '}
            {reply.body}
          </Text>
          <View style={styles.row}>
            <Text style={styles.muted}>{sentence(timeAgo(reply.created_at, now))}</Text>
            {reply.mine && token && (
              <Pressable
                onPress={() =>
                  confirmAction('Yanıtın silinsin mi?', 'Bu yanıt herkesten kaldırılır.', 'Sil', () =>
                    reviewsApi.removeReply(token, reply.id).then(reload),
                  )
                }
                hitSlop={12}
                style={styles.deleteButton}
              >
                <Text style={styles.delete}>Sil</Text>
              </Pressable>
            )}
            {!reply.mine && token && (
              <ReportButton onReport={(reason) => safetyApi.reportReply(token, reply.id, reason)} onDone={reload} />
            )}
          </View>
        </View>
      ))}

      <View style={styles.row}>
        {canReply && !replying && (
          <Pressable onPress={() => setReplying(true)} hitSlop={6}>
            <Text style={styles.action}>Yanıtla</Text>
          </Pressable>
        )}
        {!review.allow_replies && !review.mine && !ownerBusiness && <Text style={styles.muted}>Yanıtlar kapalı</Text>}
        {allowed && !canReply && <Text style={styles.muted}>Bu yoruma {MAX_REPLIES_PER_PERSON} yanıt yazdın</Text>}
        {review.mine && token && (
          <Pressable
            onPress={() =>
              confirmAction('Yorumun silinsin mi?', 'Yorumun ve altındaki yanıtlar kaldırılır.', 'Sil', () =>
                reviewsApi.remove(token, review.id).then(reload),
              )
            }
            hitSlop={12}
            style={styles.deleteButton}
          >
            <Text style={styles.delete}>Yorumumu sil</Text>
          </Pressable>
        )}
        {!review.mine && token && (
          <ReportButton onReport={(reason) => safetyApi.reportReview(token, review.id, reason)} onDone={reload} />
        )}
      </View>

      {replying && (
        <View style={styles.replyForm}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={`${author(review.username)} kişisine yanıt yaz`}
            placeholderTextColor={colors.placeholder}
            maxLength={MAX_REVIEW}
            multiline
            autoFocus
            style={styles.input}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.row}>
            <Pressable style={[styles.secondary, styles.flex]} onPress={() => setReplying(false)}>
              <Text style={styles.secondaryText}>Vazgeç</Text>
            </Pressable>
            <Pressable style={[styles.primary, styles.flex]} onPress={sendReply}>
              <Text style={styles.primaryText}>Yanıtla</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

/** "⋯" at the end of a review / reply: "Şikâyet et" in it, then a reason; it is hidden for me right away. */
function ReportButton({ onReport, onDone }: { onReport: (reason: ReportReason) => Promise<void>; onDone: () => void }) {
  const [step, setStep] = useState<'closed' | 'menu' | 'reasons'>('closed');
  const [error, setError] = useState<string | null>(null);

  if (step === 'closed') {
    return (
      <Pressable onPress={() => setStep('menu')} hitSlop={10} style={styles.more} accessibilityRole="button" accessibilityLabel="Diğer seçenekler">
        <Icon name="dots" size={16} color={colors.textMuted} />
      </Pressable>
    );
  }
  if (step === 'menu') {
    return (
      <View style={styles.menu}>
        <Pressable onPress={() => setStep('reasons')} style={styles.menuItem} accessibilityRole="button">
          <Icon name="flag" size={14} color={colors.danger} />
          <Text style={styles.menuDanger}>Şikâyet et</Text>
        </Pressable>
        <Pressable onPress={() => setStep('closed')} style={styles.menuItem} accessibilityRole="button">
          <Text style={styles.muted}>Vazgeç</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.reportBox}>
      <Text style={styles.muted}>Neden şikâyet ediyorsun?</Text>
      <View style={styles.reasons}>
        {REPORT_REASONS.map(({ reason, label }) => (
          <Pressable
            key={reason}
            style={styles.reason}
            onPress={async () => {
              try {
                await onReport(reason);
                onDone();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Gönderilemedi.');
              }
            }}
          >
            <Text style={styles.reasonText}>{label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setStep('closed')} style={styles.reason}>
          <Text style={styles.muted}>Vazgeç</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.muted}>Şikâyet ettiğin içerik sana artık gösterilmez; çok şikâyet alırsa herkesten gizlenir.</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  section: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text, minHeight: 44 },
  flex: { flex: 1 },
  text: { fontSize: 14, color: colors.text },
  bold: { fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '600' },
  review: { gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  reply: { marginLeft: 14, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.border, gap: 2 },
  replyForm: { gap: 8, marginLeft: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  action: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  delete: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  deleteButton: { paddingVertical: 4, paddingHorizontal: 8, marginHorizontal: -8 },
  more: { marginLeft: 'auto', paddingHorizontal: 4 },
  menu: { marginLeft: 'auto', flexDirection: 'row', gap: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.cream },
  menuDanger: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  businessTag: { color: colors.onPrimary, backgroundColor: colors.primary, fontSize: 11, fontWeight: '700', borderRadius: 6, overflow: 'hidden' },
  reportBox: { gap: 6, padding: 10, borderRadius: 12, backgroundColor: colors.cream, width: '100%' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reason: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.surface },
  reasonText: { fontSize: 13, fontWeight: '600', color: colors.danger },
  error: { color: colors.danger },
  primary: { paddingVertical: 11, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
  secondary: {
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700' },
}));
