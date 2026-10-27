import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from './Pressable';

import { useLocation } from '../context/LocationContext';
import { friendsApi } from '../lib/friends';
import { groupCandidates, groupsApi, MAX_GROUP_NAME, type Candidate } from '../lib/groups';
import { socialApi } from '../lib/social';
import { colors, themed } from '../theme';

type Props = {
  token: string;
  me: string | null;
  // Invite more people to this group; without it, a new group is created
  groupId?: number;
  onDone: (groupId: number, invited: string[]) => void;
  onCancel: () => void;
};

/** "Grup oluştur" (or "Davet et"): a name, then friends and people around to invite, or anyone by user name. */
export function GroupForm({ token, me, groupId, onDone, onCancel }: Props) {
  const { point } = useLocation();
  const [name, setName] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Friends, then people around (availy's suggestions)
  useEffect(() => {
    Promise.all([
      friendsApi.list(token).catch(() => null),
      socialApi.suggestions(token, point).catch(() => null),
    ]).then(([lists, suggestions]) =>
      setCandidates(groupCandidates(lists?.friends ?? [], suggestions?.people ?? [], me ? [me] : [])),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Anyone else by user name
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setFound([]);
    const timer = setTimeout(() => {
      friendsApi
        .search(token, q)
        .then((people) => setFound(people.map((p) => p.username).filter((u) => u !== me)))
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, token, me]);

  const toggle = (username: string) =>
    setPicked((list) => (list.includes(username) ? list.filter((u) => u !== username) : [...list, username]));

  const submit = async () => {
    if (!groupId && !name.trim()) return setError('Gruba bir ad ver.');
    setSending(true);
    try {
      if (groupId) {
        onDone(groupId, await groupsApi.invite(token, groupId, picked));
      } else {
        const created = await groupsApi.create(token, name, picked);
        onDone(created.id, created.invited);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Olmadı, tekrar dene.');
    } finally {
      setSending(false);
    }
  };

  // Searched people not in the list yet come first
  const extra = found.filter((u) => !candidates.some((c) => c.username === u)).map((u) => ({ username: u, why: 'Arama' }));
  const shown = [...extra, ...candidates];

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{groupId ? 'Gruba davet et' : 'Yeni grup'}</Text>
      {!groupId && (
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Grup adı (ör. Kadıköy ekibi)"
          placeholderTextColor={colors.placeholder}
          maxLength={MAX_GROUP_NAME}
          style={styles.input}
        />
      )}
      <Text style={styles.label}>Kimleri davet edelim?</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="@kullaniciadi ile ara"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      {shown.length === 0 && <Text style={styles.muted}>Önerilecek kimse yok; kullanıcı adıyla arayabilirsin.</Text>}
      {shown.slice(0, 30).map((c) => {
        const on = picked.includes(c.username);
        return (
          <Pressable key={c.username} style={styles.person} onPress={() => toggle(c.username)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            <View style={[styles.box, on && styles.boxOn]}>{on && <Text style={styles.tick}>✓</Text>}</View>
            <Text style={[styles.name, styles.flex]}>@{c.username}</Text>
            <Text style={styles.muted}>{c.why}</Text>
          </Pressable>
        );
      })}
      <Text style={styles.muted}>Davet ettiklerin "Katıl" deyince gruba girer; gruptaki herkes başkalarını da davet edebilir.</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        <Pressable style={[styles.secondary, styles.flex]} onPress={onCancel}>
          <Text style={styles.secondaryText}>Vazgeç</Text>
        </Pressable>
        <Pressable style={[styles.primary, styles.flex, sending && styles.disabled]} onPress={submit} disabled={sending}>
          <Text style={styles.primaryText}>
            {groupId ? `Davet gönder${picked.length ? ` (${picked.length})` : ''}` : `Oluştur${picked.length ? ` · ${picked.length} davet` : ''}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  form: { gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.onPrimary, fontSize: 13, fontWeight: '900' },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  flex: { flex: 1 },
  muted: { fontSize: 12, color: colors.textMuted },
  error: { color: colors.danger },
  row: { flexDirection: 'row', gap: 8 },
  primary: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
  secondary: { paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  disabled: { opacity: 0.6 },
}));
