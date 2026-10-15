import { useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { CampaignBox } from '../components/CampaignBox';
import { FavoriteButton } from '../components/FavoriteButton';
import { LevelDot } from '../components/LevelDot';
import { VenuePhoto } from '../components/VenuePhoto';
import { WatchButton } from '../components/WatchButton';
import { useCampaigns } from '../context/CampaignsContext';
import { useEngagement } from '../context/EngagementContext';
import { useLocation } from '../context/LocationContext';
import { useSettings } from '../context/SettingsContext';
import { useEmptyingEstimate } from '../hooks/useEmptyingEstimate';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { amenitiesFor } from '../lib/amenities';
import type { Venue } from '../lib/api';
import { categoryLabel } from '../lib/filters';
import { distanceKm, formatDistance } from '../lib/geo';
import { directionsUrl, shortLocation } from '../lib/location';
import { MAX_COMMENT, stars, validateFeedback, venueRating } from '../lib/feedback';
import { describeProgram, isProgramActive } from '../lib/loyalty';
import { areaStatus, formatRatio } from '../lib/occupancy';
import { shareVenue } from '../lib/shareVenue';
import { canWatch } from '../lib/watch';
import { colors } from '../theme';

type Props = {
  venueId: number;
  userName: string | null; // signed-in customer, needed to leave feedback
  onLogin: () => void;
  onBack: () => void;
  onShowOnMap: (venue: Venue) => void;
};

export function VenueDetailScreen({ venueId, userName, onLogin, onBack, onShowOnMap }: Props) {
  const { venues, loading, error, refreshing, refresh } = useVenuesByIds([venueId]);
  const venue = venues[0];
  const { look } = useSettings();
  const { activeFor } = useCampaigns();
  const { programs, watches, feedback, leaveFeedback, userKey } = useEngagement();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackNote, setFeedbackNote] = useState<{ ok: boolean; text: string } | null>(null);
  const { point } = useLocation();
  const [note, setNote] = useState<string | null>(null);
  const estimate = useEmptyingEstimate(venue);

  if (!venue) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error ?? (loading ? 'Yükleniyor…' : 'Mekan bulunamadı.')}</Text>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  const { label } = look(venue.occupancy.level, venue.open_now);
  const campaign = venue.open_now ? activeFor(venue.id) : null;
  const program = programs.find((p) => p.venueId === venue.id && isProgramActive(p));
  const reviews = venueRating(feedback, venue.id);
  const mine = reviews.items.find((f) => f.userKey === userKey);

  const sendFeedback = () => {
    const problem = validateFeedback(rating, comment);
    if (problem) return setFeedbackNote({ ok: false, text: problem });
    leaveFeedback({ venueId: venue.id, userName: userName ?? 'Misafir', rating, comment: comment.trim() });
    setFeedbackNote({ ok: true, text: 'Teşekkürler! Geri bildirimin işletmeye iletildi.' });
    setComment('');
  };
  const watching = watches.some((w) => w.venueId === venue.id);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        Platform.OS !== 'web' ? (
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        ) : undefined
      }
    >
      <View style={styles.top}>
        <BackButton onPress={onBack} />
        <View style={styles.actions}>
          <WatchButton venue={venue} size={22} />
          <Pressable
            onPress={async () => setNote(await shareVenue(venue))}
            hitSlop={10}
            accessibilityLabel="Paylaş"
          >
            <Text style={styles.icon}>⤴</Text>
          </Pressable>
          <FavoriteButton venueId={venue.id} size={22} />
        </View>
      </View>

      <VenuePhoto venueId={venue.id} category={venue.category} size="100%" height={200} />

      <View>
        <Text style={styles.name}>{venue.name}</Text>
        {reviews.average !== null && (
          <Text style={styles.rating}>
            {stars(Math.round(reviews.average))} {reviews.average} · {reviews.count} değerlendirme
          </Text>
        )}
        <Text style={styles.muted}>
          {categoryLabel(venue.category)} · {shortLocation(venue.neighborhood, venue.district)}
          {point ? ` · ${formatDistance(distanceKm(point, venue))}` : ''}
        </Text>
      </View>
      {note && <Text style={styles.note}>{note}</Text>}
      {venue.address ? <Text style={styles.text}>📍 {venue.address}</Text> : null}

      <View style={styles.card}>
        <View style={styles.row}>
          <LevelDot level={venue.occupancy.level} open={venue.open_now} size={14} />
          <Text style={styles.status}>{label}</Text>
          <Text style={styles.ratio}>
            {venue.open_now ? formatRatio(venue.occupancy.ratio) : `${venue.opens_at}'de açılır`}
          </Text>
        </View>
        {venue.open_now && <Text style={styles.text}>{areaStatus(venue.district_occupancy.level)}</Text>}
        {estimate && <Text style={styles.text}>⏳ {estimate}</Text>}
        <Text style={styles.text}>🕒 {venue.hours}</Text>
        {watching ? (
          <Text style={styles.watch}>🔔 %70 altına düşünce haber vereceğiz</Text>
        ) : (
          canWatch(venue) && (
            <Text style={styles.muted}>
              Kalabalık mı? 🔕 simgesine basınca %70 altına düştüğünde haber veririz.
            </Text>
          )
        )}
      </View>

      {campaign && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kampanya</Text>
          <CampaignBox campaign={campaign} />
        </View>
      )}

      {program && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sadakat programı</Text>
          <Text style={styles.text}>⭐ {describeProgram(program)}</Text>
          <Text style={styles.muted}>Ayrıntılar ve kartın: Kampanyalar → Sadakat</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Özellikler</Text>
        <View style={styles.wrap}>
          {amenitiesFor(venue).map((a) => (
            <Text key={a.label} style={styles.chip}>
              {a.icon} {a.label}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Değerlendir</Text>
        {userName === null ? (
          <Pressable onPress={onLogin}>
            <Text style={styles.link}>Puan ve yorum bırakmak için giriş yap</Text>
          </Pressable>
        ) : (
          <>
            {mine && (
              <Text style={styles.muted}>
                Önceki değerlendirmen: {stars(mine.rating)} (yenisi eskisinin yerine geçer)
              </Text>
            )}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                  <Text style={[styles.star, n <= rating && styles.starOn]}>{n <= rating ? '★' : '☆'}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Kısa bir yorum (isteğe bağlı)"
              placeholderTextColor={colors.placeholder}
              maxLength={MAX_COMMENT}
              multiline
              style={styles.input}
            />
            {feedbackNote && (
              <Text style={feedbackNote.ok ? styles.note : styles.error}>{feedbackNote.text}</Text>
            )}
            <Pressable style={styles.secondary} onPress={sendFeedback}>
              <Text style={styles.secondaryText}>Gönder</Text>
            </Pressable>
          </>
        )}
        {reviews.items.slice(0, 3).map((f) => (
          <View key={f.id} style={styles.review}>
            <Text style={styles.text}>
              {stars(f.rating)} · {f.userName}
            </Text>
            {f.comment ? <Text style={styles.muted}>{f.comment}</Text> : null}
          </View>
        ))}
      </View>

      <View style={styles.buttons}>
        <Pressable style={styles.secondary} onPress={() => onShowOnMap(venue)}>
          <Text style={styles.secondaryText}>Haritada gör</Text>
        </Pressable>
        <Pressable
          style={styles.primary}
          onPress={() => Linking.openURL(directionsUrl(Platform.OS, venue.lat, venue.lon))}
        >
          <Text style={styles.primaryText}>Yol tarifi</Text>
        </Pressable>
      </View>
      <Text style={styles.demo}>Prototip: özellikler ve doluluk örnek verilerdir.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Space for the status bar sits outside the scroll view, so the pull-to-refresh spinner stays visible
  page: { flex: 1, marginTop: 50, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 48, gap: 14 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  icon: { fontSize: 22, color: colors.textMuted },
  name: { fontSize: 24, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: '600' },
  note: { fontSize: 13, color: colors.success },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontSize: 16, fontWeight: '600', color: colors.text },
  ratio: { marginLeft: 'auto', fontSize: 16, color: colors.textMuted },
  text: { fontSize: 14, color: colors.text },
  watch: { fontSize: 13, color: colors.primary },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.cream,
    color: colors.text,
    fontSize: 13,
  },
  buttons: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
  secondary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  demo: { textAlign: 'center', fontSize: 12, color: colors.placeholder },
  rating: { fontSize: 14, color: colors.primary, marginTop: 2 },
  starsRow: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 30, color: colors.disabled },
  starOn: { color: colors.primary },
  input: {
    minHeight: 60,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.cream,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  error: { fontSize: 13, color: colors.danger },
  review: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
});
