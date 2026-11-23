import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useOnPageFocus } from '../context/PageContext';
import { send } from '../lib/accountApi';
import { colors, themed } from '../theme';
import { Icon, InlineIcon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import type { Screen } from './TabBar';
import { Text } from './Text';

type Task = { key: 'checkin' | 'list' | 'friend' | 'photo'; title: string; hint: string; done: boolean };
type Starter = { tasks: Task[]; done: number; points_each: number; new_points: number };

// Where each task is done
const OPENS: Record<Task['key'], { screen: Screen; icon: IconName }> = {
  checkin: { screen: 'checkin', icon: 'map-pin' },
  list: { screen: 'favorites', icon: 'bookmarks' },
  friend: { screen: 'friends', icon: 'user-plus' },
  photo: { screen: 'profile', icon: 'photo' },
};

/** Home and Daha fazla: "İlk adımlar" — check-in, a list, a friend, a photo; each +10 puan, all four the
 * Hızlı başlangıç badge. Teaches the app by using it; gone once everything is done. */
export function StarterTasks({ token, onOpen }: { token: string | null; onOpen?: (screen: Screen) => void }) {
  const [starter, setStarter] = useState<Starter | null>(null);
  const load = useCallback(() => {
    if (!token) return;
    send<Starter>('GET', '/v1/me/starter-tasks', undefined, token).then(setStarter).catch(() => {});
  }, [token]);
  useEffect(load, [load]);
  useOnPageFocus(load);

  if (!starter || !starter.tasks.length || starter.done === starter.tasks.length) return null;
  const percent = Math.round((starter.done / starter.tasks.length) * 100);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>İlk adımlar · {starter.done}/{starter.tasks.length}</Text>
        {starter.new_points > 0 && <Text style={styles.earned}>+{starter.new_points} puan</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      {starter.tasks.map((t) => (
        <Pressable key={t.key} style={styles.row} onPress={() => onOpen?.(OPENS[t.key].screen)} disabled={t.done || !onOpen}>
          <View style={[styles.check, t.done && styles.checkDone]}>
            <Icon name={t.done ? 'check' : OPENS[t.key].icon} size={14} color={t.done ? colors.onPrimary : colors.textMuted} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.task, t.done && styles.taskDone]}>{t.title}</Text>
            {!t.done && <Text style={styles.muted}>{t.hint}</Text>}
          </View>
          {!t.done && <Text style={styles.points}>+{starter.points_each}</Text>}
        </Pressable>
      ))}
      <Text style={styles.muted}>
        <InlineIcon name="award" color={colors.gold} /> Hepsini bitirince "Hızlı başlangıç" rozeti ve +20 puan
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  earned: { fontSize: 13, fontWeight: '800', color: colors.success },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.cream, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  flex: { flex: 1 },
  task: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  taskDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  muted: { fontSize: 12.5, color: colors.textMuted },
  points: { fontSize: 13, fontWeight: '800', color: colors.gold },
}));
