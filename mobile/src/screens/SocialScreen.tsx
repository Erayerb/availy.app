import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import QRCode from 'react-native-qrcode-svg';

import { Avatar } from '../components/Avatar';
import { ContactsFinder } from '../components/ContactsFinder';
import { HeaderButtons } from '../components/HeaderButtons';
import { Icon } from '../components/Icon';
import { useLocation } from '../context/LocationContext';
import { formatDistance } from '../lib/geo';
import { socialApi, type Suggestions } from '../lib/social';
import { QrScanner } from '../components/QrScanner';
import type { User } from '../lib/auth';
import { sentence, shortDate, timeAgo } from '../lib/crowd';
import { friendQrPayload, friendsApi, inviteMessage, parseFriendCode, type FriendLists, type Person, type Relation } from '../lib/friends';
import { author, checkinSocialApi, daySections, MAX_REVIEW, reviewsApi, type FeedItem } from '../lib/reviews';
import { confirmAction } from '../lib/confirm';
import { Leaderboard } from '../components/Leaderboard';
import { stars } from '../lib/feedback';
import { shareText } from '../lib/shareVenue';
import { colors, themed } from '../theme';

type Props = {
  user: User | null;
  onRegister: () => void;
  onOpenVenue: (venue: { id: number }) => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  onOpenUser: (username: string) => void; // a friend's profile
  onOpenMap: () => void;
  onOpenCheckin: () => void;
  initialTab?: SocialTab;
  onTabChange?: (tab: SocialTab) => void; // remembered, so back from a profile or venue returns to this tab
};

// feed: Akış (my own activity), friendsFeed: Arkadaşlarım (friends' activity), friends: add / manage friends (the person-add icon)
export type SocialTab = 'feed' | 'friendsFeed' | 'ranking' | 'friends';

const EMPTY: FriendLists = { friends: [], incoming: [], outgoing: [] };

/** v2 "Sosyal" tab. Akış: my check-ins with friends' likes and comments. Arkadaşlarım: friends' check-ins and reviews.
 * The person-add icon: requests, add a friend, my QR code / invite link, friends. */
export function SocialScreen({
  user,
  onRegister,
  onOpenVenue,
  onOpenProfile,
  onOpenNotifications,
  onOpenUser,
  onOpenMap,
  onOpenCheckin,
  initialTab = 'feed',
  onTabChange,
}: Props) {
  const token = user?.token;
  const [lists, setLists] = useState<FriendLists>(EMPTY);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Person & { relation: Relation })[]>([]);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTabState] = useState<SocialTab>(initialTab);
  const mine = tab === 'feed';

  const [feed, setFeed] = useState<FeedItem[]>([]);
  // Mine: the last 7 days ("Daha eski" up to 30); friends: 3 (up to 7)
  const recentDays = (t: SocialTab) => (t === 'feed' ? 7 : 3);
  const [days, setDays] = useState(recentDays(initialTab));
  const setTab = (next: SocialTab) => {
    if (next === tab) return;
    setTabState(next);
    onTabChange?.(next);
    setFeed([]);
    setDays(recentDays(next));
  };
  // Shown while Akış is empty: "Önerilen kişiler" and "Yakında yeni keşfedilen mekanlar"
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const { point } = useLocation();

  const reload = useCallback(() => {
    if (!token) return;
    friendsApi.list(token).then(setLists).catch(() => {});
    if (tab === 'feed' || tab === 'friendsFeed') reviewsApi.feed(token, days, mine ? 'me' : 'friends').then(setFeed).catch(() => {});
  }, [token, days, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(reload, [reload]);

  useEffect(() => {
    if (!token || feed.length > 0 || tab !== 'friendsFeed') return;
    socialApi.suggestions(token, point).then(setSuggestions).catch(() => {});
  }, [token, feed.length, tab, point?.lat, point?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search as the user types (user names start with the text)
  useEffect(() => {
    if (!token || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      friendsApi.search(token, query).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [token, query]);

  if (!user || user.isGuest || !user.username || !token) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Sosyal</Text>
          <HeaderButtons onOpenProfile={onOpenProfile} onOpenNotifications={onOpenNotifications} />
        </View>
        <Text style={styles.muted}>Arkadaşlarının nerede check-in yaptığını görmek, arkadaş eklemek ve seni bulmalarını sağlamak için kayıt ol (kullanıcı adı seçersin).</Text>
        <Pressable style={styles.primary} onPress={onRegister}>
          <Text style={styles.primaryText}>Kayıt ol</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Invite link to WhatsApp / Instagram…; a friend who signs up with it is added automatically
  const shareInvite = async () => {
    const result = await shareText(inviteMessage(user.username!));
    return result ? { ok: true, text: result } : null;
  };

  const add = async (username: string) => {
    try {
      const result = await friendsApi.add(token, username);
      setNote({
        ok: true,
        text: result.relation === 'friend' ? `@${result.username} artık arkadaşın.` : `@${result.username} kişisine istek gönderildi.`,
      });
      reload();
      setResults((list) => list.map((p) => (p.id === result.id ? { ...p, relation: result.relation } : p)));
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Eklenemedi.' });
    }
  };

  const remove = async (person: Person) => {
    await friendsApi.remove(token, person.id).catch(() => {});
    reload();
    setResults((list) => list.map((p) => (p.id === person.id ? { ...p, relation: 'none' } : p)));
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, styles.fill]} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Text style={styles.title}>Sosyal</Text>
        <HeaderButtons onOpenProfile={onOpenProfile} onOpenNotifications={onOpenNotifications} />
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: 'feed', label: 'Akış' },
            { id: 'friendsFeed', label: 'Arkadaşlarım' },
            { id: 'ranking', label: 'Sıralama' },
          ] as const
        ).map(({ id, label }) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
        <View style={styles.flex} />
        {/* Add a friend, requests, QR; the count of incoming requests */}
        <Pressable
          onPress={() => setTab(tab === 'friends' ? 'friendsFeed' : 'friends')}
          style={[styles.addFriend, tab === 'friends' && styles.tabActive]}
          hitSlop={6}
          accessibilityLabel={`Arkadaş ekle${lists.incoming.length ? `, ${lists.incoming.length} istek` : ''}`}
        >
          <Icon name="person-add" size={19} color={tab === 'friends' ? colors.onPrimary : colors.text} />
          {lists.incoming.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{lists.incoming.length > 9 ? '9+' : lists.incoming.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {mine && feed.length === 0 && (
        <>
          <Text style={styles.muted}>Son günlerde check-in'in ya da yorumun yok. Yaptıkların, arkadaşlarının beğeni ve yorumlarıyla burada görünür.</Text>
          {[
            { icon: '📍', title: 'Check-in yap', text: 'Bulunduğun mekanın doluluğunu bildir, puan kazan.', onPress: onOpenCheckin },
            { icon: '🧭', title: 'Mekan keşfet', text: 'Haritada yakınındaki mekanlara bak; bir mekana ilk check-in yapan ✨ keşfeder.', onPress: onOpenMap },
          ].map((c) => (
            <Pressable key={c.title} onPress={c.onPress} style={({ pressed }) => [styles.card, styles.startRow, pressed && styles.pressed]}>
              <Text style={styles.startIcon}>{c.icon}</Text>
              <View style={styles.flex}>
                <Text style={styles.bold}>{c.title}</Text>
                <Text style={styles.muted}>{c.text}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </>
      )}

      {(tab === 'feed' || tab === 'friendsFeed') && (
        <>
          {!mine && feed.length === 0 && (
            <>
              <Text style={styles.muted}>
                {lists.friends.length === 0
                  ? "Arkadaş ekleyince check-in'leri ve yorumları burada görünür. Başlamak için:"
                  : "Arkadaşlarının son günlerde check-in'i ya da yorumu yok. Bu arada:"}
              </Text>
              {[
                // No friends yet: inviting is the quickest way (both become friends when they sign up)
                ...(lists.friends.length === 0
                  ? [
                      {
                        icon: '📨',
                        title: 'Arkadaşlarını davet et',
                        text: 'Bağlantınla kayıt olan arkadaşın otomatik eklenir, sen 50 puan kazanırsın.',
                        onPress: async () => setNote(await shareInvite()),
                      },
                    ]
                  : []),
                {
                  icon: '👋',
                  title: 'Arkadaş ekle',
                  text: 'Kullanıcı adıyla ara, QR kodunu okut ya da davet bağlantısı gönder.',
                  onPress: () => setTab('friends'),
                },
                {
                  icon: '🧭',
                  title: 'Mekan keşfet',
                  text: 'Haritada yakınındaki mekanlara bak; bir mekana ilk check-in yapan ✨ keşfeder.',
                  onPress: onOpenMap,
                },
                {
                  icon: '📍',
                  title: "Check-in yap",
                  text: 'Bulunduğun mekanın doluluğunu bildir, puan kazan.',
                  onPress: onOpenCheckin,
                },
              ].map((c) => (
                <Pressable
                  key={c.title}
                  onPress={c.onPress}
                  style={({ pressed }) => [styles.card, styles.startRow, pressed && styles.pressed]}
                >
                  <Text style={styles.startIcon}>{c.icon}</Text>
                  <View style={styles.flex}>
                    <Text style={styles.bold}>{c.title}</Text>
                    <Text style={styles.muted}>{c.text}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
              {!!suggestions?.people.length && (
                <View style={styles.card}>
                  <Text style={styles.bold}>Önerilen kişiler</Text>
                  {suggestions.people.map((p) => (
                    <View key={p.username} style={styles.suggestRow}>
                      <Pressable style={styles.flex} onPress={() => onOpenUser(p.username)}>
                        <Text style={styles.bold}>@{p.username}</Text>
                        <Text style={styles.muted}>
                          {p.mutual > 0
                            ? `${p.mutual} ortak arkadaş`
                            : p.shared_venues > 0
                              ? `Aynı mekanlara gidiyorsunuz (${p.shared_venues})`
                              : `Bu hafta ${p.week_points} puan`}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.smallButton}
                        onPress={async () => {
                          await add(p.username);
                          setSuggestions((s) => s && { ...s, people: s.people.filter((x) => x.username !== p.username) });
                        }}
                      >
                        <Text style={styles.smallButtonText}>Ekle</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              {!!suggestions?.venues.length && (
                <View style={styles.card}>
                  <Text style={styles.bold}>✨ Yakında yeni keşfedilen mekanlar</Text>
                  {suggestions.venues.map((v) => (
                    <Pressable key={v.id} style={styles.suggestRow} onPress={() => onOpenVenue({ id: v.id })}>
                      <View style={styles.flex}>
                        <Text style={styles.bold}>{v.name}</Text>
                        <Text style={styles.muted}>
                          {v.username ? `@${v.username} keşfetti` : 'Gizli bir kullanıcı keşfetti'} ·{' '}
                          {sentence(timeAgo(v.discovered_at, new Date()))}
                          {v.distance_m !== null ? ` · ${formatDistance(v.distance_m / 1000)}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
          {/* A heading per date, posts on a timeline; older than 7 days (friends: 3) under "Daha eski" */}
          {daySections(feed, new Date(), recentDays(tab)).map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.title}</Text>
              <View>
                {section.items.map((item, i) => {
                  const next = section.items[i + 1];
                  return (
                    <Post
                      key={`${item.kind}-${item.at}-${item.username}`}
                      item={item}
                      token={token}
                      mine={mine}
                      // The line joins posts of the same day only
                      last={!next || new Date(next.at).toDateString() !== new Date(item.at).toDateString()}
                      timeOnly={section.title !== 'Daha eski'}
                      onOpenVenue={onOpenVenue}
                      onOpenUser={onOpenUser}
                      onChanged={reload}
                    />
                  );
                })}
              </View>
            </View>
          ))}
          {/* Older posts on request (friends' bare check-ins leave after 2 days anyway) */}
          {days === recentDays(tab) && feed.length > 0 && (
            <Pressable onPress={() => setDays(mine ? 30 : 7)} style={styles.older}>
              <Text style={styles.olderText}>Daha eski gönderileri göster</Text>
            </Pressable>
          )}
          {days > recentDays(tab) && (
            <Pressable onPress={() => setDays(recentDays(tab))} style={styles.older}>
              <Text style={styles.olderText}>Eski gönderileri gizle</Text>
            </Pressable>
          )}
          {/* Pushes the note to the bottom of the screen when the feed is short */}
          <View style={styles.grow} />
          <Text style={[styles.muted, styles.centered]}>
            {mine
              ? "Gizli check-in'lerini yalnızca sen görürsün; arkadaşların diğerlerini Arkadaşlarım'da görür."
              : "Yalnızca check-in yapılan mekan görünür; canlı konum paylaşılmaz. Gizli check-in'ler görünmez."}
          </Text>
        </>
      )}

      {tab === 'ranking' && <Leaderboard token={token} me={user?.username ?? null} onOpenUser={onOpenUser} />}

      {tab === 'friends' && (
        <>
          {note && <Text style={note.ok ? styles.success : styles.error}>{note.text}</Text>}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Arkadaşların · {lists.friends.length}</Text>
            {lists.friends.length === 0 && <Text style={styles.muted}>Henüz arkadaşın yok. QR'ını göster ya da kullanıcı adıyla ara.</Text>}
            {/* Four rows show; more scroll inside the card */}
            <ScrollView
              style={lists.friends.length > 4 && styles.friendList}
              contentContainerStyle={styles.friendRows}
              nestedScrollEnabled
              scrollEnabled={lists.friends.length > 4}
            >
              {lists.friends.map((p) => (
                <PersonRow key={p.id} person={p} onOpen={onOpenUser}>
                  <Action
                    label="Çıkar"
                    quiet
                    onPress={() =>
                      confirmAction(
                        'Arkadaşlıktan çıkarılsın mı?',
                        `@${p.username} artık check-in'lerini göremez; tekrar arkadaş olmak için yeniden istek göndermen gerekir.`,
                        'Çıkar',
                        () => remove(p),
                      )
                    }
                  />
                </PersonRow>
              ))}
            </ScrollView>
            {lists.outgoing.length > 0 && <Text style={styles.label}>Gönderdiğin istekler</Text>}
            {lists.outgoing.map((p) => (
              <PersonRow key={p.id} person={p} onOpen={onOpenUser}>
                <Action label="İptal" quiet onPress={() => remove(p)} />
              </PersonRow>
            ))}
          </View>
          {lists.incoming.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Gelen istekler</Text>
              {lists.incoming.map((p) => (
                <PersonRow key={p.id} person={p} onOpen={onOpenUser}>
                  <Action label="Kabul et" onPress={() => add(p.username)} />
                  <Action label="Reddet" quiet onPress={() => remove(p)} />
                </PersonRow>
              ))}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Arkadaş ekle</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="@kullaniciadi"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            {results.map((p) => (
              <PersonRow key={p.id} person={p} onOpen={onOpenUser}>
                {p.relation === 'none' && <Action label="Ekle" onPress={() => add(p.username)} />}
                {p.relation === 'incoming' && <Action label="Kabul et" onPress={() => add(p.username)} />}
                {p.relation === 'outgoing' && <Text style={styles.muted}>İstek gönderildi</Text>}
                {p.relation === 'friend' && <Text style={styles.muted}>Arkadaşın</Text>}
              </PersonRow>
            ))}
            {query.trim().length >= 2 && results.length === 0 && <Text style={styles.muted}>Bu adla kimse bulunamadı.</Text>}
          </View>

          <ContactsFinder token={token} me={user.username!} onAdd={add} onOpenUser={onOpenUser} />

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Beni ekle</Text>
            <View style={styles.qr}>
              <QRCode value={friendQrPayload(user.username)} size={160} backgroundColor={colors.surface} color={colors.text} />
            </View>
            <Text style={[styles.username, styles.centered]}>@{user.username}</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.secondary, styles.flex]}
                onPress={async () => {
                  const result = await shareText(inviteMessage(user.username!));
                  if (result) setNote({ ok: true, text: result });
                }}
              >
                <Text style={styles.secondaryText}>Davet bağlantısını paylaş</Text>
              </Pressable>
              <Pressable style={[styles.primary, styles.flex]} onPress={() => setScanning(true)}>
                <Text style={styles.primaryText}>📷 QR okut</Text>
              </Pressable>
            </View>
            <Text style={styles.muted}>Bağlantıyı WhatsApp'tan ya da Instagram hikayesinden paylaşabilirsin.</Text>
          </View>

        </>
      )}

      <QrScanner
        visible={scanning}
        title="Arkadaşının QR'ını okut"
        onClose={() => setScanning(false)}
        onScanned={(data) => {
          setScanning(false);
          const username = parseFriendCode(data);
          if (username) add(username);
          else setNote({ ok: false, text: 'Bu bir availy arkadaş QR kodu değil.' });
        }}
      />
    </ScrollView>
  );
}

function PersonRow({ person, children, onOpen }: { person: Person; children: React.ReactNode; onOpen: (username: string) => void }) {
  return (
    <View style={styles.person}>
      {/* Name and picture open the profile */}
      <Pressable onPress={() => onOpen(person.username)} style={[styles.person, styles.flex]} accessibilityLabel={`@${person.username} profili`}>
        <Avatar username={person.username} />
        <Text style={[styles.text, styles.flex]}>@{person.username}</Text>
      </Pressable>
      {children}
    </View>
  );
}

function Action({ label, onPress, quiet = false }: { label: string; onPress: () => void; quiet?: boolean }) {
  return (
    <Pressable onPress={onPress} style={quiet ? styles.actionQuiet : styles.action} hitSlop={6}>
      <Text style={quiet ? styles.actionQuietText : styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  replyLink: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  replyForm: { gap: 8 },
  bold: { fontWeight: '700', color: colors.text },
  points: { color: colors.primary, fontWeight: '700' },
  discovered: { color: colors.discovery },
  quote: { fontSize: 14, color: colors.text, fontWeight: '400', marginTop: 2 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addFriend: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.cream },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabTextActive: { color: colors.onPrimary },
  chevron: { fontSize: 22, color: colors.textMuted },
  section: { gap: 10 },
  // My Akış: a timeline
  post: { flexDirection: 'row', gap: 12 },
  rail: { width: 30, alignItems: 'center' },
  railDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  railDotFirst: { borderWidth: 1.5, borderColor: colors.discovery },
  railLine: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1, backgroundColor: colors.border },
  postBody: { gap: 4, paddingBottom: 20 },
  postVenue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postVenueText: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  postText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  chevronSmall: { fontSize: 18, color: colors.textMuted },
  thread: { gap: 8, marginTop: 6, marginLeft: 10 },
  threadMore: { marginLeft: 24 },
  threadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  threadText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  small: { fontSize: 12, color: colors.textMuted },
  sectionHeading: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  older: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.cream },
  olderText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 4 },
  text: { fontSize: 15, color: colors.text, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.textMuted },
  username: { fontSize: 18, fontWeight: '800', color: colors.text },
  centered: { textAlign: 'center' },
  fill: { flexGrow: 1 },
  grow: { flex: 1 },
  qr: { alignItems: 'center', paddingVertical: 6 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkinActions: { gap: 6 },
  likedText: { color: colors.primary },
  deleteText: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  smallButton: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primary },
  smallButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  startIcon: { fontSize: 26 },
  pressed: { opacity: 0.7 },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  // Four person rows (38 + 8) with the gaps between them
  friendList: { maxHeight: 4 * 46 + 3 * 10 },
  friendRows: { gap: 10 },
  action: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.primary },
  actionText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  actionQuiet: { paddingVertical: 7, paddingHorizontal: 10 },
  actionQuietText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  primary: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700', textAlign: 'center' },
  secondary: { paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  success: { color: colors.success, fontWeight: '600' },
  error: { color: colors.danger },
}));


/** "Yanıtla" under a review in the feed: a reply without leaving the feed. */
/** Under a friend's check-in: ♡ like, comments and "Yorum yap". */
/** Akış: one post on a timeline (mine: an icon, friends: their photo; a line down to the same day's next post),
 * what came under it hanging off it. */
function Post({
  item,
  token,
  mine,
  last,
  timeOnly,
  onOpenVenue,
  onOpenUser,
  onChanged,
}: {
  item: FeedItem;
  token: string;
  mine: boolean;
  last: boolean;
  timeOnly: boolean; // under a date heading
  onOpenVenue: (venue: { id: number }) => void;
  onOpenUser: (username: string) => void;
  onChanged: () => void;
}) {
  const icon = item.kind === 'review' ? 'star' : item.kind === 'reply' ? 'chatbubble' : item.is_first ? 'sparkles' : 'location';
  const what =
    item.kind === 'review'
      ? mine ? 'Yorum yaptın' : 'yorum yaptı'
      : item.kind === 'reply'
        ? `${author(item.review_author)} yorumuna yanıt ${mine ? 'verdin' : 'verdi'}`
        : item.is_first
          ? mine ? 'Keşfettin' : 'keşfetti'
          : mine ? 'Check-in yaptın' : 'check-in yaptı';
  const time = timeOnly ? new Date(item.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : shortDate(item.at, new Date());
  return (
    <View style={styles.post}>
      <View style={styles.rail}>
        {mine ? (
          <View style={[styles.railDot, item.is_first && styles.railDotFirst]}>
            <Icon name={icon} size={15} color={item.is_first ? colors.discovery : colors.primary} />
          </View>
        ) : (
          <Pressable onPress={() => item.username && onOpenUser(item.username)} hitSlop={6} accessibilityLabel={`${author(item.username)} profili`}>
            <Avatar username={item.username} size={30} />
          </Pressable>
        )}
        {!last && <View style={styles.railLine} />}
      </View>
      <View style={[styles.flex, styles.postBody]}>
        <Text style={styles.muted}>
          {!mine && (
            <Text style={styles.bold} onPress={() => item.username && onOpenUser(item.username)}>
              {author(item.username)}{' '}
            </Text>
          )}
          {what} · {time}
          {item.points > 0 && <Text style={styles.points}> · +{item.points} puan</Text>}
        </Text>
        <Pressable onPress={() => onOpenVenue({ id: item.venue_id })} style={styles.postVenue}>
          <Text style={[styles.postVenueText, item.is_first && styles.discovered]} numberOfLines={1}>
            {item.venue_name}
          </Text>
          <Text style={styles.chevronSmall}>›</Text>
        </Pressable>
        {item.rating ? <Text style={styles.quote}>{stars(item.rating)}</Text> : null}
        {item.body ? <Text style={styles.postText}>{item.body}</Text> : null}
        <Thread token={token} item={item} owner={mine} onOpenUser={onOpenUser} onChanged={onChanged} />
        {item.kind === 'checkin' && item.checkin_id ? (
          <CheckinActions token={token} item={item} onChanged={onChanged} own={mine} />
        ) : null}
        {/* Answer the review (or join the conversation under it) right here */}
        {item.kind !== 'checkin' && item.review_id !== null && item.allow_replies && !(mine && item.kind === 'reply') && (
          <FeedReply token={token} reviewId={item.review_id} to={item.kind === 'reply' ? item.review_author : item.username} onSent={onChanged} />
        )}
      </View>
    </View>
  );
}

/** Under a post, each hanging off it with ↳: who liked it, comments on the check-in, replies to the review
 * (the last 3, then "Önceki yanıtları gör"). owner: my post, so friends' comments on it can be deleted. */
function Thread({
  token,
  item,
  owner,
  onOpenUser,
  onChanged,
}: {
  token: string;
  item: FeedItem;
  owner: boolean;
  onOpenUser: (username: string) => void;
  onChanged: () => void;
}) {
  const [all, setAll] = useState(false);
  const likes = item.likes ?? 0;
  const likers = item.likers ?? [];
  const notes = [
    ...(item.comments ?? []).map((c) => ({ ...c, remove: owner || c.mine ? () => checkinSocialApi.removeComment(token, c.id) : null })),
    ...(item.replies ?? []).map((c) => ({ ...c, remove: c.mine ? () => reviewsApi.removeReply(token, c.id) : null })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  if (likes === 0 && notes.length === 0) return null;
  const shown = all ? notes : notes.slice(-3);
  return (
    <View style={styles.thread}>
      {notes.length > shown.length && (
        <Pressable onPress={() => setAll(true)} hitSlop={6} style={styles.threadMore}>
          <Text style={styles.replyLink}>Önceki {notes.length - shown.length} yanıtı gör</Text>
        </Pressable>
      )}
      {shown.map((c) => (
        <View key={`${c.id}-${c.at}`} style={styles.threadRow}>
          <Icon name="return-down-forward" size={16} color={colors.textMuted} />
          <Avatar username={c.username} size={22} />
          <View style={styles.flex}>
            <Text style={styles.threadText}>
              <Text style={styles.bold} onPress={() => c.username && onOpenUser(c.username)}>
                {author(c.username)}
              </Text>{' '}
              {c.body}
            </Text>
            <View style={styles.row}>
              <Text style={styles.small}>{shortDate(c.at, new Date())}</Text>
              {/* My own, and friends' comments on my check-in, can be deleted */}
              {c.remove && (
                <Pressable onPress={() => c.remove!().then(onChanged).catch(() => {})} hitSlop={6}>
                  <Text style={styles.deleteText}>Sil</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      ))}
      {likes > 0 && (
        <View style={styles.threadRow}>
          <Icon name="return-down-forward" size={16} color={colors.textMuted} />
          <Text style={[styles.threadText, styles.flex]}>
            <Text style={styles.likedText}>♥ </Text>
            {likers.length ? likers.map((u) => `@${u}`).join(', ') : `${likes} kişi`}
            {likes > likers.length && likers.length ? ` ve ${likes - likers.length} kişi` : ''} beğendi
          </Text>
        </View>
      )}
    </View>
  );
}

/** Under a check-in: ♡ Beğen (not on mine) and 💬 Yorum yap; the comments show in <Thread> above. */
function CheckinActions({
  token,
  item,
  onChanged,
  own = false,
}: {
  token: string;
  item: FeedItem;
  onChanged: () => void;
  own?: boolean; // my own check-in: only "Yorum yap"
}) {
  const [liked, setLiked] = useState(!!item.liked);
  const [likes, setLikes] = useState(item.likes ?? 0);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = item.checkin_id!;

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    await checkinSocialApi.like(token, id, next).catch(() => {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    });
  };

  const send = async () => {
    if (!text.trim()) return;
    try {
      await checkinSocialApi.comment(token, id, text);
      setText('');
      setOpen(false);
      setError(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gönderilemedi.');
    }
  };

  return (
    <View style={styles.checkinActions}>
      <View style={styles.replyBar}>
        {!own && (
          <Pressable onPress={toggleLike} hitSlop={6} accessibilityLabel={liked ? 'Beğeniyi geri al' : 'Beğen'}>
            <Text style={[styles.replyLink, liked && styles.likedText]}>
              {liked ? '♥' : '♡'} {likes > 0 ? likes : 'Beğen'}
            </Text>
          </Pressable>
        )}
        {!open && (
          <Pressable onPress={() => setOpen(true)} hitSlop={6}>
            <Text style={styles.replyLink}>💬 Yorum yap</Text>
          </Pressable>
        )}
      </View>
      {open && (
        <View style={styles.replyForm}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={`${author(item.username)} kişisinin check-in'ine yorum yaz`}
            placeholderTextColor={colors.placeholder}
            maxLength={MAX_REVIEW}
            multiline
            autoFocus
            style={styles.input}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.row}>
            <Pressable style={[styles.secondary, styles.flex]} onPress={() => setOpen(false)}>
              <Text style={styles.secondaryText}>Vazgeç</Text>
            </Pressable>
            <Pressable style={[styles.primary, styles.flex]} onPress={send}>
              <Text style={styles.primaryText}>Gönder</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function FeedReply({ token, reviewId, to, onSent }: { token: string; reviewId: number; to: string | null; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    if (!text.trim()) return;
    try {
      await reviewsApi.reply(token, reviewId, text);
      setText('');
      setOpen(false);
      setNote({ ok: true, text: '✓ Yanıtın gönderildi.' });
      onSent();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Gönderilemedi.' });
    }
  };

  if (!open) {
    return (
      <View style={styles.replyBar}>
        <Pressable onPress={() => setOpen(true)} hitSlop={6}>
          <Text style={styles.replyLink}>💬 Yanıtla</Text>
        </Pressable>
        {note && <Text style={note.ok ? styles.success : styles.error}>{note.text}</Text>}
      </View>
    );
  }
  return (
    <View style={styles.replyForm}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={`${author(to)} kişisine yanıt yaz`}
        placeholderTextColor={colors.placeholder}
        maxLength={MAX_REVIEW}
        multiline
        autoFocus
        style={styles.input}
      />
      {note && !note.ok && <Text style={styles.error}>{note.text}</Text>}
      <View style={styles.row}>
        <Pressable style={[styles.secondary, styles.flex]} onPress={() => setOpen(false)}>
          <Text style={styles.secondaryText}>Vazgeç</Text>
        </Pressable>
        <Pressable style={[styles.primary, styles.flex]} onPress={send}>
          <Text style={styles.primaryText}>Yanıtla</Text>
        </Pressable>
      </View>
    </View>
  );
}
