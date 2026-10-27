import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from './Pressable';

import { listsApi, MAX_LIST_NAME, type VenueList } from '../lib/lists';
import { colors, themed } from '../theme';

type Props = { token: string; venueId: number; venueName: string; visible: boolean; onClose: () => void };

/** The list icon on a venue page: tick the lists it is in, or start a new list with it. */
export function AddToList({ token, venueId, venueName, visible, onClose }: Props) {
  const [lists, setLists] = useState<VenueList[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    listsApi.mine(token).then(setLists).catch(() => setLists([]));
  }, [visible, token]);

  const toggle = async (list: VenueList) => {
    const present = !list.venue_ids.includes(venueId);
    try {
      const changed = await listsApi.setVenue(token, list.id, venueId, present);
      setLists((all) => (all ?? []).map((l) => (l.id === list.id ? changed : l)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Olmadı, tekrar dene.');
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    try {
      const created = await listsApi.create(token, name, 'private', [venueId]);
      setLists((all) => [...(all ?? []), created]);
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Olmadı, tekrar dene.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Listeye ekle</Text>
        <Text style={styles.muted} numberOfLines={1}>
          {venueName}
        </Text>
        <ScrollView style={styles.lists} contentContainerStyle={styles.listsContent}>
          {lists === null && <Text style={styles.muted}>Yükleniyor…</Text>}
          {lists?.length === 0 && <Text style={styles.muted}>Henüz listen yok; aşağıdan ilkini oluştur.</Text>}
          {lists?.map((l) => {
            const on = l.venue_ids.includes(venueId);
            return (
              <Pressable key={l.id} style={styles.row} onPress={() => toggle(l)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <View style={[styles.box, on && styles.boxOn]}>{on && <Text style={styles.tick}>✓</Text>}</View>
                <Text style={[styles.name, styles.flex]} numberOfLines={1}>
                  {l.name}
                </Text>
                <Text style={styles.muted}>{l.venue_ids.length} mekan</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.newRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Yeni liste (ör. Ders çalışılacak yerler)"
            placeholderTextColor={colors.placeholder}
            maxLength={MAX_LIST_NAME}
            style={[styles.input, styles.flex]}
            onSubmitEditing={create}
          />
          <Pressable style={[styles.add, !name.trim() && styles.disabled]} onPress={create} disabled={!name.trim()}>
            <Text style={styles.addText}>Oluştur</Text>
          </Pressable>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.done} onPress={onClose}>
          <Text style={styles.doneText}>Tamam</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    padding: 18,
    paddingBottom: 34,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  lists: { flexGrow: 0 },
  listsContent: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.onPrimary, fontSize: 13, fontWeight: '900' },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  flex: { flex: 1 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { padding: 11, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  add: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primary },
  addText: { color: colors.onPrimary, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger },
  done: { paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  doneText: { color: colors.primary, fontWeight: '700' },
}));
