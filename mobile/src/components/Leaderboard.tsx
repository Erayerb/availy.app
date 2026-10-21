import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { socialApi, type Leaderboard as Board, type Period, type Scope } from '../lib/social';
import { colors } from '../theme';

const MEDALS = ['🥇', '🥈', '🥉'];

type Choice<T> = { id: T; label: string };
const PERIODS: Choice<Period>[] = [
  { id: 'week', label: 'Bu hafta' },
  { id: 'all', label: 'Tüm zamanlar' },
];
const SCOPES: Choice<Scope>[] = [
  { id: 'friends', label: 'Arkadaşlar' },
  { id: 'everyone', label: 'Herkes' },
];

/** v2 Sosyal > Sıralama: points this week (from Monday) or all time, among friends or everyone. */
export function Leaderboard({ token, onOpenUser }: { token: string; onOpenUser: (username: string) => void }) {
  const [period, setPeriod] = useState<Period>('week');
  const [scope, setScope] = useState<Scope>('friends');
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setBoard(null);
    socialApi
      .leaderboard(token, period, scope)
      .then((data) => {
        if (stale) return;
        setBoard(data);
        setError(null);
      })
      .catch(() => !stale && setError('Sıralama yüklenemedi.'));
    return () => {
      stale = true;
    };
  }, [token, period, scope]);

  const meShown = board?.rows.some((r) => r.me);

  return (
    <View style={styles.card}>
      <Segment options={PERIODS} value={period} onChange={setPeriod} />
      <Segment options={SCOPES} value={scope} onChange={setScope} />

      {error && <Text style={styles.error}>{error}</Text>}
      {!board && !error && <Text style={styles.muted}>Yükleniyor…</Text>}
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

const styles = StyleSheet.create({
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
  prize: { fontSize: 14, fontWeight: '700', color: '#B7791F', textAlign: 'center', marginTop: 6 },
  muted: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  error: { color: colors.danger },
});
