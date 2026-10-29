import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Text';
import { Pressable } from '../components/Pressable';

import { HeaderButtons } from '../components/HeaderButtons';
import { VenueGrid } from '../components/VenueGrid';
import { useFavorites } from '../context/FavoritesContext';
import { useLocation } from '../context/LocationContext';
import { sortByDistance } from '../lib/geo';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import type { Venue } from '../lib/api';
import type { Visit } from '../lib/checkinApi';
import { listsApi, MAX_LIST_NAME, VISIBILITY_OPTIONS, type VenueList } from '../lib/lists';
import { colors, themed } from '../theme';

export type FavoritesTab = 'saved' | 'lists' | 'visited';

type Props = {
  onOpenVenue: (venue: Venue) => void;
  // v2: venues the user checked in at
  visits: Visit[];
  signedIn: boolean; // favorites are for registered users only
  token: string | null;
  onLogin: () => void;
  onRegister: () => void;
  onOpenList: (id: number) => void; // Listelerim > a list
  // The tab shown, kept by the app: "back" from a list returns to Listelerim
  tab: FavoritesTab;
  onTabChange: (tab: FavoritesTab) => void;
};

export function FavoritesScreen({ onOpenVenue, visits, signedIn, token, onLogin, onRegister, onOpenList, tab, onTabChange: setTab }: Props) {
  // Listelerim (on the server)
  const [lists, setLists] = useState<VenueList[] | null>(null);
  const [newName, setNewName] = useState('');
  const [listError, setListError] = useState<string | null>(null);
  const loadLists = useCallback(() => {
    if (token) listsApi.mine(token).then(setLists).catch(() => setLists([]));
  }, [token]);
  useEffect(() => {
    if (tab === 'lists') loadLists();
  }, [tab, loadLists]);
  const { ids: savedIds } = useFavorites();
  // Most recently visited first
  const visitedIds = [...visits].sort((a, b) => b.last_at.localeCompare(a.last_at)).map((v) => v.venue_id);
  const ids = tab === 'saved' ? savedIds : visitedIds;
  const { venues, loading, error, refreshing, refresh } = useVenuesByIds(ids);
  const { point } = useLocation();
  // Hide a venue right away when it is un-favorited, without waiting for a refetch
  const listed = venues.filter((v) => ids.includes(v.id));
  const visible =
    tab === 'saved'
      ? point
        ? sortByDistance(listed, point)
        : listed
      : [...listed].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Favoriler</Text>
        <HeaderButtons />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {(
          [
            { id: 'saved', label: `Favoriler${savedIds.length ? ` (${savedIds.length})` : ''}` },
            { id: 'lists', label: `Listelerim${lists?.length ? ` (${lists.length})` : ''}` },
            { id: 'visited', label: `Ziyaret edilenler${visitedIds.length ? ` (${visitedIds.length})` : ''}` },
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
      </ScrollView>
    </View>
  );

  if (!signedIn) {
    return (
      <View style={styles.signedOut}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Favoriler</Text>
          <HeaderButtons />
        </View>
        <Text style={styles.text}>Mekanları kaydetmek ve gittiğin yerleri görmek için giriş yap ya da kayıt ol.</Text>
        <Pressable style={styles.primary} onPress={onRegister}>
          <Text style={styles.primaryText}>Kayıt ol</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onLogin}>
          <Text style={styles.secondaryText}>Giriş yap</Text>
        </Pressable>
      </View>
    );
  }

  if (tab === 'lists') {
    const create = async () => {
      if (!token || !newName.trim()) return;
      try {
        const created = await listsApi.create(token, newName, 'private');
        setNewName('');
        setListError(null);
        onOpenList(created.id);
      } catch (e) {
        setListError(e instanceof Error ? e.message : 'Olmadı, tekrar dene.');
      }
    };
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.listsPage}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadLists} />}
      >
        {header}
        <Text style={styles.label}>＋ Yeni liste oluştur</Text>
        <View style={styles.newRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Yeni liste (ör. Kadıköy'de ders çalışılacak yerler)"
            placeholderTextColor={colors.placeholder}
            maxLength={MAX_LIST_NAME}
            style={[styles.input, styles.flex]}
            onSubmitEditing={create}
          />
          <Pressable style={[styles.add, !newName.trim() && styles.disabled]} onPress={create} disabled={!newName.trim()}>
            <Text style={styles.addText}>Oluştur</Text>
          </Pressable>
        </View>
        {listError && <Text style={styles.error}>{listError}</Text>}
        {lists === null && <Text style={styles.muted}>Yükleniyor…</Text>}
        {lists?.length === 0 && (
          <Text style={styles.muted}>
            Mekanları listelere ayır, arkadaşlarınla ya da bağlantıyla paylaş. İstediğin kadar liste oluşturabilirsin;
            mekanları listenin içinden ya da mekan sayfasındaki liste simgesinden eklersin.
          </Text>
        )}
        {lists && lists.length > 0 && <Text style={styles.label}>Listelerin · {lists.length}</Text>}
        {lists?.map((l) => (
          <Pressable key={l.id} style={({ pressed }) => [styles.listCard, pressed && styles.pressed]} onPress={() => onOpenList(l.id)}>
            <View style={styles.flex}>
              <Text style={styles.listName} numberOfLines={1}>
                {l.name}
              </Text>
              <Text style={styles.muted}>
                {l.venue_ids.length} mekan · {VISIBILITY_OPTIONS.find((o) => o.id === l.visibility)?.label}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  const empty =
    tab === 'saved'
      ? 'Henüz kaydettiğin mekan yok.\nMekanlardaki ♡ ile kaydedebilirsin.'
      : "Henüz check-in yapmadın.\nCheck-in yaptığın mekanlar burada görünür.";

  return (
    <VenueGrid
      venues={visible}
      header={header}
      emptyText={loading ? 'Yükleniyor…' : empty}
      error={error}
      onOpenVenue={onOpenVenue}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = themed(() => StyleSheet.create({
  header: { gap: 12, marginBottom: 6 },
  signedOut: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 60, gap: 14 },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  primary: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  secondary: { paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.cream },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabTextActive: { color: colors.onPrimary },
  // Same top space as the other tabs (VenueGrid)
  page: { flex: 1, marginTop: 50, backgroundColor: colors.background },
  listsPage: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40, gap: 12 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  flex: { flex: 1 },
  add: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primary },
  addText: { color: colors.onPrimary, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  listName: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  chevron: { fontSize: 22, color: colors.textMuted },
}));
