import { RowsSkeleton } from './Skeleton';
import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';
import { Avatar } from './Avatar';
import { LevelMark } from './LevelCard';

import { confirmAction } from '../lib/confirm';
import { type GroupStreak, groupsApi, type Group } from '../lib/groups';
import { GroupForm } from './GroupForm';

import { socialApi, type Leaderboard as Board, type Scope } from '../lib/social';
import { colors, themed } from '../theme';
import { Icon, InlineIcon } from './Icon';

// Gold, silver, bronze medals for the top three
const MEDALS = ['#D4A017', '#A8A9AD', '#B87333'];

type Choice<T> = { id: T; label: string };
const SCOPES: Choice<Scope>[] = [
  { id: 'friends', label: 'Arkadaşlar' },
  { id: 'everyone', label: 'Herkes' },
  { id: 'group', label: 'Gruplar' },
];

type Props = { token: string; me: string | null; onOpenUser: (username: string) => void };

/**
 * v2 Sosyal > Sıralama: points this week (from Monday) or all time, among friends, everyone,
 * or one of my groups ("Grup oluştur", invitations to join).
 */
// The last choice, so back from a profile shows the same list
const last: { scope: Scope; groupId: number | null } = { scope: 'friends', groupId: null };

export function Leaderboard({ token, me, onOpenUser }: Props) {
  const [scope, setScope] = useState<Scope>(last.scope);
  // Both tables at once: this week on top, all time below
  const [boards, setBoards] = useState<{ week: Board | null; all: Board | null } | null>(null);
  const board = boards?.week ?? null;
  const winners = board?.last_week_winners ?? [];
  const [error, setError] = useState<string | null>(null);
  // Gruplar: mine and the invitations; the one shown; the form (new group, or inviting to the shown one)
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupId, setGroupId] = useState<number | null>(last.groupId);
  useEffect(() => {
    Object.assign(last, { scope, groupId });
  }, [scope, groupId]);
  const [form, setForm] = useState<'create' | 'invite' | null>(null);
  const [groupNote, setGroupNote] = useState<string | null>(null);

  const loadGroups = useCallback(
    () =>
      groupsApi
        .mine(token)
        .then((list) => {
          setGroups(list);
          // Keep the shown group if I am still in it, otherwise the first one
          setGroupId((id) => {
            const members = list.filter((g) => g.status === 'member');
            return members.some((g) => g.id === id) ? id : (members[0]?.id ?? null);
          });
        })
        .catch(() => setGroups([])),
    [token],
  );

  useEffect(() => {
    if (scope === 'group') loadGroups();
  }, [scope, loadGroups]);

  useEffect(() => {
    let stale = false;
    setBoards(null);
    if (scope === 'group' && !groupId) return;
    Promise.all([
      socialApi.leaderboard(token, 'week', scope, groupId ?? undefined),
      socialApi.leaderboard(token, 'all', scope, groupId ?? undefined),
    ])
      .then(([week, all]) => {
        if (stale) return;
        setBoards({ week, all });
        setError(null);
      })
      .catch(() => !stale && setError('Sıralama yüklenemedi.'));
    return () => {
      stale = true;
    };
  }, [token, scope, groupId]);

  const invites = (groups ?? []).filter((g) => g.status === 'invited');
  const memberOf = (groups ?? []).filter((g) => g.status === 'member');
  const shownGroup = memberOf.find((g) => g.id === groupId) ?? null;

  const [help, setHelp] = useState(false);
  const [groupStreak, setGroupStreak] = useState<GroupStreak | null>(null);
  useEffect(() => {
    setGroupStreak(null);
    if (scope !== 'group' || !groupId) return;
    groupsApi.streak(token, groupId).then(setGroupStreak).catch(() => {});
  }, [token, scope, groupId]);

  return (
    <View style={styles.card}>
      <Segment options={SCOPES} value={scope} onChange={setScope} />

      {scope === 'group' && (
        <View style={styles.groups}>
          {/* Invitations: join or turn down */}
          {invites.map((g) => (
            <View key={g.id} style={styles.invite}>
              <Text style={[styles.inviteText, styles.flex]}>
                <InlineIcon name="users" /> <Text style={styles.bold}>{g.name}</Text>
                {g.invited_by ? ` · @${g.invited_by} davet etti` : ''} · {g.members} kişi
              </Text>
              <Pressable
                style={styles.join}
                onPress={() =>
                  groupsApi
                    .join(token, g.id)
                    .then(() => {
                      setGroupId(g.id);
                      return loadGroups();
                    })
                    .catch(() => {})
                }
              >
                <Text style={styles.joinText}>Katıl</Text>
              </Pressable>
              <Pressable onPress={() => groupsApi.leave(token, g.id).then(loadGroups).catch(() => {})} hitSlop={8}>
                <Text style={styles.decline}>Reddet</Text>
              </Pressable>
            </View>
          ))}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChips}>
            {memberOf.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => {
                  setGroupId(g.id);
                  setForm(null);
                }}
                style={[styles.groupChip, g.id === groupId && styles.groupChipOn]}
              >
                <Text style={[styles.groupChipText, g.id === groupId && styles.groupChipTextOn]}>
                  {g.name} · {g.members}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setForm('create')} style={styles.groupChip}>
              <Text style={styles.groupChipText}>＋ Grup oluştur</Text>
            </Pressable>
          </ScrollView>
          {groupNote && <Text style={styles.success}>{groupNote}</Text>}
          {/* New group / invite: in a window over the ranking, not inside it */}
          <Modal visible={form !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setForm(null)}>
            <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>{form === 'invite' ? 'Gruba davet et' : 'Yeni grup'}</Text>
              {form && (
                <GroupForm
                  token={token}
                  me={me}
                  groupId={form === 'invite' ? (groupId ?? undefined) : undefined}
                  onCancel={() => setForm(null)}
                  onDone={(id, invited) => {
                    setForm(null);
                    setGroupId(id);
                    setGroupNote(invited.length ? `${invited.map((u) => `@${u}`).join(', ')} davet edildi.` : 'Grup hazır.');
                    loadGroups();
                  }}
                />
              )}
            </ScrollView>
          </Modal>
          {groups && memberOf.length === 0 && (
            <Text style={styles.muted}>
              Arkadaşlarınla ya da çevrendekilerle bir grup kur; grubun kendi sıralaması olur. "＋ Grup oluştur"a dokun.
            </Text>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {!boards && !error && (scope !== 'group' || groupId) && <RowsSkeleton count={4} round />}
      {boards && (
        <>
          <BoardTable title="Bu hafta" board={boards.week} empty="Bu hafta puan kazanan yok. İlk check-in'i yap, zirveye otur." onOpenUser={onOpenUser} />
          <BoardTable title="Tüm zamanlar" board={boards.all} empty="Puan kazanan yok. İlk check-in'i yap, zirveye otur." onOpenUser={onOpenUser} />
        </>
      )}

      {/* Grup serisi: everyone checked in each week; who is still missing this week */}
      {scope === 'group' && shownGroup && groupStreak && (
        <View style={styles.groupStreak}>
          <Text style={styles.groupStreakTitle}>🔥 Grup serisi · {groupStreak.weeks} hafta</Text>
          <Text style={styles.muted}>
            {groupStreak.missing.length === 0
              ? 'Bu hafta herkes check-in yaptı, seri sürüyor.'
              : `Son ${groupStreak.days_left} gün · ${groupStreak.missing.map((u) => (u === me ? 'sen' : `@${u}`)).join(', ')} kaldı`}
          </Text>
        </View>
      )}
      {scope === 'group' && shownGroup && (
        <View style={styles.row}>
          <Pressable onPress={() => setForm('invite')} hitSlop={8}>
            <Text style={styles.link}>＋ Davet et</Text>
          </Pressable>
          <View style={styles.flex} />
          <Pressable
            hitSlop={8}
            onPress={() =>
              confirmAction(`"${shownGroup.name}" grubundan çıkılsın mı?`, 'Tekrar girmek için davet gerekir.', 'Çık', () =>
                groupsApi.leave(token, shownGroup.id).then(loadGroups).catch(() => {}),
              )
            }
          >
            <Text style={styles.decline}>Gruptan çık</Text>
          </Pressable>
        </View>
      )}

      {winners.length > 0 && (
        <Text style={styles.prize}>
          <InlineIcon name="trophy" /> Geçen haftanın 1.si: {winners.map((u) => `@${u}`).join(', ')}
        </Text>
      )}
      <Pressable onPress={() => setHelp((h) => !h)} hitSlop={6}>
        <Text style={styles.muted}>ⓘ Puanlar nasıl kazanılır {help ? '▴' : '▾'}</Text>
      </Pressable>
      {help && (
        <Text style={styles.muted}>
          Check-in 10 puan, bir mekanın ilk check-in'i +50 puan. Haftanın 1.si rozet alır; sıralama her pazartesi sıfırlanır.
        </Text>
      )}
    </View>
  );
}

type Row = NonNullable<Board>['rows'][number];

/** One table: a title, the podium for the first three with points, then the rest (and my place if lower). */
function BoardTable({ title, board, empty, onOpenUser }: { title: string; board: Board | null; empty: string; onOpenUser: (username: string) => void }) {
  if (!board) return null;
  const podium = board.rows.filter((r) => r.rank <= 3 && r.points > 0);
  const meShown = board.rows.some((r) => r.me);
  return (
    <View style={styles.table}>
      <Text style={styles.tableTitle}>{title}</Text>
      {board.rows.length === 0 && <Text style={styles.muted}>{empty}</Text>}
      {podium.length > 0 && <Podium rows={podium} onOpenUser={onOpenUser} />}
      {board.rows.filter((row) => !podium.includes(row)).map((row) => (
        <Pressable
          key={`${row.rank}-${row.username}`}
          onPress={() => row.username && onOpenUser(row.username)}
          style={[styles.row, row.me && styles.meRow]}
        >
          <Text style={[styles.rank, row.me && styles.meText]}>{row.rank}.</Text>
          <View style={styles.ring}>
            <Avatar username={row.username} size={30} framed={row.level === 'ambassador'} />
          </View>
          <Text style={[styles.name, row.me && styles.meText]} numberOfLines={1}>
            {row.username ? `@${row.username}` : 'Misafir'}
            <LevelMark level={row.level} />
            {row.me ? ' (sen)' : ''}
          </Text>
          <Text style={[styles.points, row.me && styles.meText]}>{row.points} puan</Text>
        </Pressable>
      ))}
      {/* My place stays visible when I am further down than the list goes */}
      {board.me && !meShown && (
        <View style={[styles.row, styles.meRow]}>
          <Text style={[styles.rank, styles.meText]}>{board.me.rank}.</Text>
          <Text style={[styles.name, styles.meText]}>Sen</Text>
          <Text style={[styles.points, styles.meText]}>{board.me.points} puan</Text>
        </View>
      )}
    </View>
  );
}

/** Kürsü: 2nd, 1st, 3rd side by side; the first one highest, each with its medal colour. */
function Podium({ rows, onOpenUser }: { rows: Row[]; onOpenUser: (username: string) => void }) {
  const order = [rows.find((r) => r.rank === 2), rows.find((r) => r.rank === 1), rows.find((r) => r.rank === 3)];
  const heights = [44, 62, 32];
  const sizes = [44, 54, 40];
  return (
    <View style={styles.podium}>
      {order.map((row, i) =>
        row ? (
          <Pressable key={row.rank} style={styles.podiumCol} onPress={() => row.username && onOpenUser(row.username)}>
            <View style={[styles.podiumRing, { borderColor: MEDALS[row.rank - 1] }]}>
              <Avatar username={row.username} size={sizes[i]} />
            </View>
            <Text style={[styles.podiumName, row.me && styles.podiumMe]} numberOfLines={1}>
              {row.me ? 'Sen' : row.username ? `@${row.username}` : 'Misafir'}
            </Text>
            <Text style={styles.podiumPoints}>{row.points} puan</Text>
            <View style={[styles.podiumStep, { height: heights[i], backgroundColor: MEDALS[row.rank - 1] }]}>
              <Text style={styles.podiumRank}>{row.rank}</Text>
            </View>
          </Pressable>
        ) : (
          // A free place: a faint step, so the podium stays balanced and says the spot is open
          <View key={`empty${i}`} style={styles.podiumCol}>
            <View style={[styles.podiumEmpty, { width: sizes[i] + 8, height: sizes[i] + 8, borderRadius: (sizes[i] + 8) / 2 }]}>
              <Icon name="user" size={sizes[i] * 0.45} color={colors.textMuted} />
            </View>
            <Text style={styles.podiumPoints} numberOfLines={1}>Boş</Text>
            <Text style={styles.podiumPoints}> </Text>
            <View style={[styles.podiumStep, styles.podiumStepEmpty, { height: heights[i] }]}>
              <Text style={[styles.podiumRank, styles.podiumRankEmpty]}>{[2, 1, 3][i]}</Text>
            </View>
          </View>
        ),
      )}
    </View>
  );
}

function Segment<T extends string>({ options, value, onChange }: { options: Choice<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onChange(o.id)}
          style={[styles.option, value === o.id && styles.optionActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.id }}
        >
          <Text style={[styles.optionText, value === o.id && styles.optionTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  groupStreak: { padding: 12, borderRadius: 14, backgroundColor: colors.cream, gap: 3 },
  groupStreakTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetContent: { padding: 18, paddingBottom: 40, gap: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 6 },
  table: { gap: 6, marginTop: 6 },
  tableTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginTop: 8 },
  podiumCol: { flex: 1, alignItems: 'center', gap: 3 },
  podiumRing: { padding: 2, borderRadius: 40, borderWidth: 2.5 },
  podiumName: { fontSize: 13, fontWeight: '700', color: colors.text, maxWidth: '100%' },
  podiumMe: { color: colors.primary },
  podiumPoints: { fontSize: 12, color: colors.textMuted },
  podiumStep: { alignSelf: 'stretch', borderTopLeftRadius: 10, borderTopRightRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4, opacity: 0.9 },
  podiumRank: { fontSize: 18, fontWeight: '800', color: '#fff' },
  podiumEmpty: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  podiumStepEmpty: { backgroundColor: colors.cream, opacity: 1 },
  podiumRankEmpty: { color: colors.textMuted },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: colors.cream },
  option: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  optionActive: { backgroundColor: colors.surface },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  optionTextActive: { color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 },
  // My own row stands out
  meRow: { backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.primary },
  meText: { color: colors.text },
  rank: { width: 26, fontSize: 15, fontWeight: '800', color: colors.textMuted, textAlign: 'center' },
  ring: { padding: 2, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  points: { fontSize: 14, fontWeight: '700', color: colors.primary },
  prize: { fontSize: 14, fontWeight: '700', color: colors.gold, textAlign: 'center', marginTop: 6 },
  muted: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  groups: { gap: 8 },
  groupChips: { gap: 8 },
  groupChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.cream },
  groupChipOn: { backgroundColor: colors.primary },
  groupChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  groupChipTextOn: { color: colors.onPrimary },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.cream },
  inviteText: { fontSize: 13, color: colors.text },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  join: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primary },
  joinText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  decline: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  success: { color: colors.success, fontWeight: '600', fontSize: 13 },
  error: { color: colors.danger },
}));
