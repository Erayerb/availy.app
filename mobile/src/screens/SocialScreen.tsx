import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ContactsFinder } from '../components/ContactsFinder';
import { HeaderButtons } from '../components/HeaderButtons';
import { useLocation } from '../context/LocationContext';
import { formatDistance } from '../lib/geo';
import { socialApi, type Suggestions } from '../lib/social';
import { QrScanner } from '../components/QrScanner';
import type { User } from '../lib/auth';
import { sentence, timeAgo } from '../lib/crowd';
import { friendQrPayload, friendsApi, inviteMessage, parseFriendCode, type FriendLists, type Person, type Relation } from '../lib/friends';
import { author, groupByPerson, MAX_REVIEW, reviewsApi, type FeedItem } from '../lib/reviews';
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
};

export type SocialTab = 'feed' | 'friends' | 'ranking';

const EMPTY: FriendLists = { friends: [], incoming: [], outgoing: [] };

/** v2 "Sosyal" tab. Akış: friends' latest check-ins and points. Arkadaşlar: requests, add a friend, my QR code / invite link, friends. */
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
}: Props) {
  const token = user?.token;
  const [lists, setLists] = useState<FriendLists>(EMPTY);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Person & { relation: Relation })[]>([]);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<SocialTab>(initialTab);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  // Shown while Akış is empty: "Önerilen kişiler" and "Yakında yeni keşfedilen mekanlar"
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const { point } = useLocation();

  const reload = useCallback(() => {
    if (!token) return;
    friendsApi.list(token).then(setLists).catch(() => {});
    reviewsApi.feed(token).then(setFeed).catch(() => {});
  }, [token]);
  useEffect(reload, [reload]);

  useEffect(() => {
    if (!token || feed.length > 0) return;
    socialApi.suggestions(token, point).then(setSuggestions).catch(() => {});
  }, [token, feed.length, point?.lat, point?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <Text style={styles.title}>Sosyal</Text>
        <HeaderButtons onOpenProfile={onOpenProfile} onOpenNotifications={onOpenNotifications} />
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: 'feed', label: 'Akış' },
            {
              id: 'friends',
              label: `Arkadaşlar${lists.incoming.length ? ` · ${lists.incoming.length}` : ''}`,
            },
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
      </View>

      {tab === 'feed' && (
        <>
          {feed.length === 0 && (
            <>
              <Text style={styles.muted}>
                {lists.friends.length === 0
                  ? "Arkadaş ekleyince check-in'leri ve yorumları burada görünür. Başlamak için:"
                  : "Arkadaşlarının son 7 günde check-in'i ya da yorumu yok. Bu arada:"}
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
          {/* One block per person; their items in a row stay together */}
          {groupByPerson(feed).map((group) => (
            <View key={`${group.username}-${group.items[0].at}`} style={styles.card}>
              <Pressable
                onPress={() => group.username && onOpenUser(group.username)}
                style={styles.groupHead}
                accessibilityLabel={`${author(group.username)} profili`}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(group.username ?? '?').slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
                </View>
                <Text style={[styles.bold, styles.flex]}>{author(group.username)}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              {group.items.map((item) => (
                <View key={`${item.kind}-${item.at}`} style={styles.feedItem}>
                  <Pressable onPress={() => onOpenVenue({ id: item.venue_id })} style={styles.feedRow}>
                    <View style={styles.flex}>
                      <FeedText item={item} me={user?.username} />
                      {item.body ? (
                        <Text style={styles.quote} numberOfLines={3}>
                          {item.kind === 'review' && item.rating ? `${stars(item.rating)} ` : ''}
                          {item.body}
                        </Text>
                      ) : item.kind === 'review' && item.rating ? (
                        <Text style={styles.quote}>{stars(item.rating)}</Text>
                      ) : null}
                      <Text style={styles.muted}>
                        {sentence(timeAgo(item.at, new Date()))}
                        {item.points > 0 && <Text style={styles.points}> · +{item.points} puan</Text>}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                  {/* Answer a friend's review (or join the conversation under it) right here */}
                  {item.review_id !== null && item.allow_replies && (
                    <FeedReply
                      token={token}
                      reviewId={item.review_id}
                      to={item.kind === 'reply' ? item.review_author : item.username}
                      onSent={reload}
                    />
                  )}
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.muted}>
            Yalnızca check-in yapılan mekan görünür; canlı konum paylaşılmaz. Gizli check-in'ler görünmez.
          </Text>
        </>
      )}

      {tab === 'ranking' && <Leaderboard token={token} onOpenUser={onOpenUser} />}

      {tab === 'friends' && (
        <>
          {note && <Text style={note.ok ? styles.success : styles.error}>{note.text}</Text>}

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

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Arkadaşların · {lists.friends.length}</Text>
            {lists.friends.length === 0 && <Text style={styles.muted}>Henüz arkadaşın yok. QR'ını göster ya da kullanıcı adıyla ara.</Text>}
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
            {lists.outgoing.length > 0 && <Text style={styles.label}>Gönderdiğin istekler</Text>}
            {lists.outgoing.map((p) => (
              <PersonRow key={p.id} person={p} onOpen={onOpenUser}>
                <Action label="İptal" quiet onPress={() => remove(p)} />
              </PersonRow>
            ))}
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
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{person.username.slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
        </View>
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
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  feedItem: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  replyLink: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  replyForm: { gap: 8 },
  bold: { fontWeight: '700', color: colors.text },
  points: { color: colors.primary, fontWeight: '700' },
  discovered: { color: colors.discovery },
  quote: { fontSize: 14, color: colors.text, fontWeight: '400', marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.cream },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabTextActive: { color: colors.onPrimary },
  chevron: { fontSize: 22, color: colors.textMuted },
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
  qr: { alignItems: 'center', paddingVertical: 6 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  smallButton: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primary },
  smallButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  startIcon: { fontSize: 26 },
  pressed: { opacity: 0.7 },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: colors.primary },
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

/** Under the person's name: "Keşfetti: ✨ Mado", "📍 Mado", "Yorum yaptı: Mado", "Yanıt verdi: Mado" */
function FeedText({ item, me }: { item: FeedItem; me: string | null | undefined }) {
  if (item.kind === 'checkin' && item.is_first) {
    return (
      <Text style={styles.text}>
        Keşfetti: <Text style={styles.discovered}>✨ {item.venue_name}</Text>
      </Text>
    );
  }
  if (item.kind === 'checkin') return <Text style={styles.text}>📍 {item.venue_name}</Text>;
  if (item.kind === 'review') return <Text style={styles.text}>Yorum yaptı: {item.venue_name}</Text>;
  return (
    <Text style={styles.text}>
      Yanıt verdi: {item.venue_name}
    </Text>
  );
}

/** "Yanıtla" under a review in the feed: a reply without leaving the feed. */
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
