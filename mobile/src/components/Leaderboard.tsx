import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { confirmAction } from '../lib/confirm';
import { groupsApi, type Group } from '../lib/groups';
import { GroupForm } from './GroupForm';

import { socialApi, type Leaderboard as Board, type Period, type Scope } from '../lib/social';
import { colors, themed } from '../theme';

const MEDALS = ['🥇', '🥈', '🥉'];

type Choice<T> = { id: T; label: string };
const PERIODS: Choice<Period>[] = [
  { id: 'week', label: 'Bu hafta' },
  { id: 'all', label: 'Tüm zamanlar' },
];
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
const last: { period: Period; scope: Scope; groupId: number | null } = { period: 'week', scope: 'friends', groupId: null };

export function Leaderboard({ token, me, onOpenUser }: Props) {
  const [period, setPeriod] = useState<Period>(last.period);
  const [scope, setScope] = useState<Scope>(last.scope);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Gruplar: mine and the invitations; the one shown; the form (new group, or inviting to the shown one)
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupId, setGroupId] = useState<number | null>(last.groupId);
  useEffect(() => {
    Object.assign(last, { period, scope, groupId });
  }, [period, scope, groupId]);
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
    setBoard(null);
    if (scope === 'group' && !groupId) return;
    socialApi
      .leaderboard(token, period, scope, groupId ?? undefined)
      .then((data) => {
        if (stale) return;
        setBoard(data);
        setError(null);
      })
      .catch(() => !stale && setError('Sıralama yüklenemedi.'));
    return () => {
      stale = true;
    };
  }, [token, period, scope, groupId]);

  const invites = (groups ?? []).filter((g) => g.status === 'invited');
  const memberOf = (groups ?? []).filter((g) => g.status === 'member');
  const shownGroup = memberOf.find((g) => g.id === groupId) ?? null;

  const meShown = board?.rows.some((r) => r.me);

  return (
    <View style={styles.card}>
      <Segment options={PERIODS} value={period} onChange={setPeriod} />
      <Segment options={SCOPES} value={scope} onChange={setScope} />

      {scope === 'group' && (
        <View style={styles.groups}>
          {/* Invitations: join or turn down */}
          {invites.map((g) => (
            <View key={g.id} style={styles.invite}>
              <Text style={[styles.inviteText, styles.flex]}>
                👥 <Text style={styles.bold}>{g.name}</Text>
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
          {form && (
            <GroupForm
              token={token}
              me={me}
              groupId={form === 'invite' ? (groupId ?? undefined) : undefined}
              onCancel={() => setForm(null)}
              onDone={(id, invited) => {
                setForm(null);
                setGroupId(id);
                setGroupNote(invited.length ? `✓ ${invited.map((u) => `@${u}`).join(', ')} davet edildi.` : '✓ Hazır.');
                loadGroups();
              }}
            />
          )}
          {groups && memberOf.length === 0 && !form && (
            <Text style={styles.muted}>
              Arkadaşlarınla ya da çevrendekilerle bir grup kur; grubun kendi sıralaması olur. "＋ Grup oluştur"a dokun.
            </Text>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {!board && !error && (scope !== 'group' || groupId) && <Text style={styles.muted}>Yükleniyor…</Text>}
      {board && board.rows.length === 0 && (
        <Text style={styles.muted}>
          {period === 'week' ? 'Bu hafta henüz kimse puan kazanmadı.' : 'Henüz kimse puan kazanmadı.'}
        </Text>
      )}
      {board?.rows.map((row) => (
        <Pressable
          key={`${row.rank}-${row.username}`}
          onPress={() => row.username && onOpenUser(row.username)}
          style={[styles.row, row.me && styles.meRow]}
        >
          <Text style={[styles.rank, row.me && styles.meText]}>{row.rank <= 3 && row.points > 0 ? MEDALS[row.rank - 1] : `${row.rank}.`}</Text>
          <Text style={[styles.name, row.me && styles.meText]} numberOfLines={1}>
            {row.username ? `@${row.username}` : 'Misafir'}
            {row.me ? ' (sen)' : ''}
          </Text>
          <Text style={[styles.points, row.me && styles.meText]}>{row.points} puan</Text>
        </Pressable>
      ))}
      {/* My place stays visible when I am further down than the list goes */}
      {board?.me && !meShown && (
        <View style={[styles.row, styles.meRow]}>
          <Text style={[styles.rank, styles.meText]}>{board.me.rank}.</Text>
          <Text style={[styles.name, styles.meText]}>Sen</Text>
          <Text style={[styles.points, styles.meText]}>{board.me.points} puan</Text>
        </View>
      )}

      {scope === 'group' && shownGroup && !form && (
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

      <Text style={styles.prize}>🏆 Haftalık ödüller kazanabilirsin! Her pazartesi haftalık sıralama sıfırlanır.</Text>
      <Text style={styles.muted}>Check-in 10 puan, bir mekanın ilk check-in'i +50 puan.</Text>
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
  meRow: { backgroundColor: colors.primary },
  meText: { color: colors.onPrimary },
  rank: { width: 30, fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' },
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
