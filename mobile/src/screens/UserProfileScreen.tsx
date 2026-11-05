import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { useOnPageFocus } from '../context/PageContext';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { PageSkeleton } from '../components/Skeleton';
import { Text } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { BackButton } from '../components/BackButton';
import { Avatar } from '../components/Avatar';
import { BadgeGrid } from '../components/BadgeGrid';
import { LevelCard } from '../components/LevelCard';
import { listsApi, type VenueList as VenueListType } from '../lib/lists';
import { shortDate, timeAgo } from '../lib/crowd';
import { categoryLabel } from '../lib/filters';
import { friendsApi } from '../lib/friends';
import { safetyApi, type Profile, type ProfileVenue, type Level } from '../lib/safety';
import { categoryVisual } from '../lib/visuals';
import { Icon, InlineIcon } from '../components/Icon';
import { confirmAction } from '../lib/confirm';
import { colors, themed } from '../theme';

// Venue lists show this many rows; the rest open on their own page
const VISIBLE_VENUES = 5;

type Props = {
  token: string;
  username: string;
  onBack: () => void;
  onOpenVenue: (venue: { id: number }) => void;
  onOpenSettings: () => void; // own profile: "Profil ayarları"
  onOpenList: (id: number) => void; // one of their lists
  onOpenLevels: (level: Level) => void; // Seviyeler page
};

/** v2: a person's profile (also mine, from the top-right icon): points, badges, venues and friend actions. */
export function UserProfileScreen({ token, username, onBack, onOpenVenue, onOpenSettings, onOpenList, onOpenLevels }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [fullList, setFullList] = useState(false);
  const [onlyDiscovered, setOnlyDiscovered] = useState(false);
  // Their lists I may see (mine: all of them)
  const [lists, setLists] = useState<VenueListType[]>([]);
  useEffect(() => {
    listsApi.ofUser(token, username).then(setLists).catch(() => setLists([]));
  }, [token, username]);

  const load = useCallback(() => {
    safetyApi
      .profile(token, username)
      .then((p) => {
        setProfile(p);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Profil yüklenemedi.'));
  }, [token, username]);
  useEffect(load, [load]);
  const pull = usePullRefresh(load);
  useOnPageFocus(load);

  const act = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      setNote(done);
      load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Olmadı, tekrar dene.');
    }
  };

  // Hard to undo by accident: ask first
  const confirmBlock = () =>
    confirmAction(
      'Engellensin mi?',
      `@${username} seni ekleyemez, yorumlarınızı birbiriniz göremezsiniz. Arkadaşlığınız biter.`,
      'Engelle',
      () => act(() => safetyApi.block(token, username), `@${username} engellendi.`).then(onBack),
    );
  const confirmUnfriend = (id: number) =>
    confirmAction(
      'Arkadaşlıktan çıkarılsın mı?',
      `@${username} artık check-in'lerini göremez; tekrar arkadaş olmak için yeniden istek göndermen gerekir.`,
      'Çıkar',
      () => act(() => friendsApi.remove(token, id), 'Arkadaşlıktan çıkarıldı.'),
    );

  if (!profile && !error) return <PageSkeleton />;
  if (!profile) {
    return (
      <View style={styles.page}>
        <View style={[styles.content, styles.topRow]}>
          <BackButton onPress={onBack} />
          <Text style={styles.title}>@{username}</Text>
        </View>
        <Text style={[styles.muted, styles.center]}>{error ?? 'Yükleniyor…'}</Text>
      </View>
    );
  }

  const me = profile.relation === 'self';
  const venues = profile.venues ?? null;
  const discovered = venues ? venues.filter((v) => v.discovered) : [];
  const shownVenues = venues ? (onlyDiscovered ? discovered : venues) : [];
  const venueChips = venues && discovered.length > 0 && (
    <View style={styles.venueChips}>
      <Chip label={`Tümü · ${venues.length}`} active={!onlyDiscovered} onPress={() => setOnlyDiscovered(false)} />
      <Chip label={`${me ? 'Keşfettiklerin' : 'Keşfettikleri'} · ${discovered.length}`} active={onlyDiscovered} onPress={() => setOnlyDiscovered(true)} />
    </View>
  );

  // "Tümü": the whole list on its own page
  if (fullList && venues) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <BackButton onPress={() => setFullList(false)} />
          <Text style={styles.title} numberOfLines={1}>
            Mekanlar
          </Text>
        </View>
        <Text style={styles.muted}>@{profile.username}</Text>
        {venueChips}
        <View style={styles.card}>
          {shownVenues.map((v) => (
            <VenueRow key={v.venue_id} venue={v} onOpenVenue={onOpenVenue} />
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl {...pull} tintColor={colors.primary} />}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title} numberOfLines={1}>
          {me ? 'Profilim' : 'Profil'}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.head}>
          <Avatar username={profile.username} size={56} version={profile.photo_at} framed={profile.level?.id === 'ambassador'} />
          <View style={styles.flex}>
            <Text style={styles.name}>@{profile.username}</Text>
            <Text style={styles.muted}>
              {me ? 'Bu senin profilin' : profile.relation === 'friend' ? 'Arkadaşın' : profile.relation === 'incoming' ? 'Seni eklemek istiyor' : profile.relation === 'outgoing' ? 'İstek gönderildi' : 'Arkadaşın değil'}
              {profile.muted ? ' · sessizde' : ''}
            </Text>
          </View>
        </View>
        {profile.weekly_winner && (
          <Text style={styles.winner}><InlineIcon name="trophy" /> Haftanın 1.si</Text>
        )}
        {profile.level && <LevelCard level={profile.level} onOpen={() => onOpenLevels(profile.level!)} />}
        {profile.stats_hidden ? (
          <Text style={styles.muted}><InlineIcon name="lock" /> @{profile.username} istatistiklerini yalnızca {profile.relation === 'friend' ? 'kendisine' : 'arkadaşlarına'} gösteriyor.</Text>
        ) : (
          <View style={styles.stats}>
            <Stat value={profile.points ?? 0} label="Puan" />
            <Stat value={profile.checkins ?? 0} label="Check-in" />
            <Stat value={profile.discoveries ?? 0} label="Keşif" />
            {/* Weeks in a row with a check-in */}
            <Stat value={profile.weekly_streak ?? 0} label="Haftalık seri" />
          </View>
        )}

        {me ? (
          <Pressable style={styles.secondary} onPress={onOpenSettings}>
            <Text style={styles.secondaryText}>Profil ayarları</Text>
          </Pressable>
        ) : (
          <View style={styles.actions}>
            {profile.relation === 'none' && (
              <Action label="Arkadaş ekle" primary onPress={() => act(() => friendsApi.add(token, username), 'İstek gönderildi.')} />
            )}
            {profile.relation === 'incoming' && (
              <Action label="Kabul et" primary onPress={() => act(() => friendsApi.add(token, username), 'Artık arkadaşsınız.')} />
            )}
            {profile.relation === 'friend' && (
              <Action
                label={profile.muted ? 'Sesi aç' : 'Sessize al'}
                onPress={() =>
                  act(
                    () => safetyApi.mute(token, username, !profile.muted),
                    profile.muted ? 'Artık akışında görünecek.' : 'Akışında görünmeyecek; arkadaşlığınız sürüyor.',
                  )
                }
              />
            )}
            {(profile.relation === 'friend' || profile.relation === 'outgoing') && (
              <Action
                label={profile.relation === 'friend' ? 'Arkadaşlıktan çıkar' : 'İsteği geri al'}
                onPress={() =>
                  profile.relation === 'friend'
                    ? confirmUnfriend(profile.id)
                    : act(() => friendsApi.remove(token, profile.id), 'İstek geri alındı.')
                }
              />
            )}
            <Action label="Engelle" danger onPress={confirmBlock} />
          </View>
        )}
        {note && <Text style={styles.note}>{note}</Text>}
      </View>

      {/* "Az önce X'te check-in yaptı": the newest venue (the list is newest first) */}
      {!me && profile.venues && profile.venues.length > 0 && (
        <Pressable style={styles.latest} onPress={() => onOpenVenue({ id: profile.venues![0].venue_id })}>
          <Text style={styles.latestText}>
            <InlineIcon name="map-pin" /> {profile.venues[0].venue_name}'de check-in yaptı · {timeAgo(profile.venues[0].last_at, new Date())} · {shortDate(profile.venues[0].last_at, new Date())}
          </Text>
          <Text style={styles.chevronSmall}>›</Text>
        </Pressable>
      )}

      {venues === null ? (
        <Text style={styles.muted}>
          {profile.relation === 'friend'
            ? `@${profile.username} check-in'lerini paylaşmıyor.`
            : `Gittiği mekanları yalnızca arkadaşları görebilir.`}
        </Text>
      ) : (
        <>
          <VenueList
            title={`${me ? 'Gittiğin' : 'Gittiği'} mekanlar · ${venues.length}`}
            chips={venueChips}
            venues={shownVenues}
            empty="Henüz check-in yok."
            onOpenVenue={onOpenVenue}
            onShowAll={() => setFullList(true)}
          />
        </>
      )}

      {lists.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}><InlineIcon name="list" /> {me ? 'Listelerin' : 'Listeleri'} · {lists.length}</Text>
          {lists.map((l) => (
            <Pressable key={l.id} onPress={() => onOpenList(l.id)} style={styles.listRow}>
              <Text style={[styles.listName, styles.flex]} numberOfLines={1}>
                {l.name}
              </Text>
              <Text style={styles.listCount}>{l.venue_ids.length} mekan ›</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!profile.stats_hidden && <BadgeGrid badges={profile.badges} />}
    </ScrollView>
  );
}

function VenueRow({ venue, onOpenVenue }: { venue: ProfileVenue; onOpenVenue: (v: { id: number }) => void }) {
  return (
    <Pressable onPress={() => onOpenVenue({ id: venue.venue_id })} style={styles.venue}>
      <Icon name={categoryVisual(venue.category).icon} size={22} color={categoryVisual(venue.category).color} />
      <View style={styles.flex}>
        <Text style={styles.text}>
          {venue.venue_name}
          {venue.discovered ? ' ✨' : ''}
        </Text>
        <Text style={styles.muted}>
          {categoryLabel(venue.category)} · {venue.visits} kez · son {timeAgo(venue.last_at, new Date())}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]} accessibilityState={{ selected: active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function VenueList({
  title,
  chips,
  venues,
  empty,
  onOpenVenue,
  onShowAll,
}: {
  title: string;
  chips: ReactNode;
  venues: ProfileVenue[];
  empty: string;
  onOpenVenue: (v: { id: number }) => void;
  onShowAll: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {chips}
      {venues.length === 0 && <Text style={styles.muted}>{empty}</Text>}
      {venues.slice(0, VISIBLE_VENUES).map((v) => (
        <VenueRow key={v.venue_id} venue={v} onOpenVenue={onOpenVenue} />
      ))}
      {venues.length > VISIBLE_VENUES && (
        <Pressable onPress={onShowAll} hitSlop={8}>
          <Text style={styles.link}>{venues.length - VISIBLE_VENUES} mekan daha ›</Text>
        </Pressable>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Action({ label, onPress, primary, danger }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.action, primary && styles.actionPrimary, danger && styles.actionDanger]}>
      <Text style={[styles.actionText, primary && styles.actionTextPrimary, danger && styles.actionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  winner: { fontSize: 14, fontWeight: '700', color: colors.gold },
  venueChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.background },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextActive: { color: colors.onPrimary },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontSize: 26, fontWeight: '700', color: colors.text },
  center: { textAlign: 'center', marginTop: 40 },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary },
  actionPrimary: { backgroundColor: colors.primary },
  actionDanger: { borderColor: colors.danger },
  actionText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  actionTextPrimary: { color: colors.onPrimary },
  actionTextDanger: { color: colors.danger },
  note: { fontSize: 13, color: colors.success, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  listName: { fontSize: 15, fontWeight: '600', color: colors.text },
  listCount: { fontSize: 13, color: colors.textMuted },
  venue: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52 },
  latest: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  latestText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  chevronSmall: { fontSize: 20, color: colors.textMuted },
  emoji: { fontSize: 22 },
  text: { fontSize: 15, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted },
  secondary: { paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '700' },
}));
