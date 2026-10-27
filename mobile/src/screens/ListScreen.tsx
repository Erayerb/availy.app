import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '../components/BackButton';
import { Pressable } from '../components/Pressable';
import { VenueRow } from '../components/VenueRow';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { searchVenues, type Venue } from '../lib/api';
import { confirmAction } from '../lib/confirm';
import { liveLevel } from '../lib/crowd';
import { listsApi, listShareMessage, MAX_LIST_NAME, VISIBILITY_OPTIONS, type VenueList, type Visibility } from '../lib/lists';
import { shareText } from '../lib/shareVenue';
import { colors, themed } from '../theme';

type Props = {
  token: string;
  // Opened from Listelerim / a profile (id), or from a shared link (code)
  target: { id: number } | { code: string };
  onBack: () => void;
  onOpenVenue: (venue: Venue) => void;
  onOpenList: (id: number) => void; // a saved copy
};

/** One venue list: its venues with their crowd now; the owner names, shares or deletes it, others save a copy. */
export function ListScreen({ token, target, onBack, onOpenVenue, onOpenList }: Props) {
  const [list, setList] = useState<VenueList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const code = 'code' in target ? target.code : null;
  // "＋ Mekan ekle": search and add right here
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Venue[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (!adding || q.length < 2) return setFound([]);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchVenues(q, null, [], controller.signal)
        .then((list) => setFound(list.slice(0, 8)))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, adding]);

  const load = useCallback(() => {
    ('code' in target ? listsApi.byCode(token, target.code) : listsApi.get(token, target.id))
      .then((l) => {
        setList(l);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Liste açılamadı.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, 'code' in target ? target.code : target.id]);
  useEffect(load, [load]);

  const { venues, loading, refresh } = useVenuesByIds(list?.venue_ids ?? []);
  const shown = list ? [...venues].sort((a, b) => list.venue_ids.indexOf(a.id) - list.venue_ids.indexOf(b.id)) : [];
  // "şu an 3'ü sakin": the reason to keep a list in availy
  const quiet = shown.filter((v) => liveLevel(v) === 'low').length;

  const setVenue = async (venueId: number, present: boolean) => {
    if (!list) return;
    try {
      setList(await listsApi.setVenue(token, list.id, venueId, present));
      refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Olmadı, tekrar dene.');
    }
  };

  const change = async (patch: { name?: string; visibility?: Visibility }) => {
    if (!list) return;
    try {
      setList(await listsApi.update(token, list.id, patch));
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Kaydedilemedi.');
    }
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={[styles.title, styles.flex]} numberOfLines={2}>
          {list?.name ?? 'Liste'}
        </Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {list && (
        <>
          <Text style={styles.muted}>
            {list.mine ? 'Listen' : `@${list.owner} listesi`} · {list.venue_ids.length} mekan
            {quiet > 0 ? ` · şu an ${quiet} tanesi sakin` : ''}
          </Text>

          {list.mine ? (
            <View style={styles.card}>
              <Text style={styles.label}>Kimler görsün?</Text>
              <View style={styles.chips}>
                {VISIBILITY_OPTIONS.map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => change({ visibility: o.id })}
                    style={[styles.chip, list.visibility === o.id && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, list.visibility === o.id && styles.chipTextOn]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.muted}>{VISIBILITY_OPTIONS.find((o) => o.id === list.visibility)?.hint}</Text>
              {list.visibility === 'link' && list.share_code && (
                <Pressable
                  style={styles.primary}
                  onPress={async () => setNote(await shareText(listShareMessage(list.name, list.share_code!)))}
                >
                  <Text style={styles.primaryText}>🔗 Bağlantıyı paylaş</Text>
                </Pressable>
              )}

              {renaming === null ? (
                <View style={styles.row}>
                  <Pressable onPress={() => setRenaming(list.name)} hitSlop={8}>
                    <Text style={styles.link}>Adını değiştir</Text>
                  </Pressable>
                  <View style={styles.flex} />
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      confirmAction(`"${list.name}" silinsin mi?`, 'Liste ve içindeki mekan seçimin silinir; mekanlar silinmez.', 'Sil', () =>
                        listsApi.remove(token, list.id).then(onBack).catch(() => {}),
                      )
                    }
                  >
                    <Text style={styles.delete}>Listeyi sil</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.row}>
                  <TextInput
                    value={renaming}
                    onChangeText={setRenaming}
                    maxLength={MAX_LIST_NAME}
                    autoFocus
                    style={[styles.input, styles.flex]}
                  />
                  <Pressable
                    style={styles.small}
                    onPress={async () => {
                      await change({ name: renaming });
                      setRenaming(null);
                    }}
                  >
                    <Text style={styles.smallText}>Kaydet</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              style={styles.primary}
              onPress={async () => {
                try {
                  const copy = await listsApi.saveCopy(token, list.id, code);
                  onOpenList(copy.id);
                } catch (e) {
                  setNote(e instanceof Error ? e.message : 'Kaydedilemedi.');
                }
              }}
            >
              <Text style={styles.primaryText}>Listeyi kaydet</Text>
            </Pressable>
          )}
          {list.mine && (
            <View style={styles.card}>
              {!adding ? (
                <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
                  <Text style={styles.addButtonText}>＋ Mekan ekle</Text>
                </Pressable>
              ) : (
                <>
                  <View style={styles.row}>
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Mekan adı ya da semt"
                      placeholderTextColor={colors.placeholder}
                      autoFocus
                      style={[styles.input, styles.flex]}
                    />
                    <Pressable
                      onPress={() => {
                        setAdding(false);
                        setQuery('');
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.link}>Bitti</Text>
                    </Pressable>
                  </View>
                  {query.trim().length >= 2 && found.length === 0 && <Text style={styles.muted}>Bu adla mekan bulunamadı.</Text>}
                  {found.map((v) => {
                    const inList = list.venue_ids.includes(v.id);
                    return (
                      <VenueRow
                        key={v.id}
                        venue={v}
                        onPress={() => setVenue(v.id, !inList)}
                        action={<Text style={inList ? styles.inList : styles.link}>{inList ? '✓ Listede' : '＋ Ekle'}</Text>}
                      />
                    );
                  })}
                </>
              )}
              <Text style={styles.muted}>Mekan sayfasındaki liste simgesinden de ekleyebilirsin.</Text>
            </View>
          )}
          {list.venue_ids.length > 0 && <Text style={styles.label}>Mekanlar</Text>}
          {note && <Text style={styles.muted}>{note}</Text>}
        </>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={shown}
      keyExtractor={(v) => String(v.id)}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.empty}>{!list || loading ? 'Yükleniyor…' : 'Bu listede henüz mekan yok.'}</Text>}
      keyboardShouldPersistTaps="handled"
      onRefresh={() => {
        load();
        refresh();
      }}
      refreshing={false}
      renderItem={({ item }) => (
        <VenueRow
          venue={item}
          onPress={() => onOpenVenue(item)}
          action={
            list?.mine ? (
              <Pressable
                hitSlop={10}
                onPress={() =>
                  confirmAction(`${item.name} listeden çıkarılsın mı?`, 'Mekan silinmez, yalnızca bu listeden çıkar.', 'Çıkar', () =>
                    setVenue(item.id, false),
                  )
                }
              >
                <Text style={styles.remove}>Çıkar</Text>
              </Pressable>
            ) : undefined
          }
        />
      )}
    />
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 8 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 16 },
  header: { gap: 10, marginBottom: 4 },
  addButton: { paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  addButtonText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  inList: { color: colors.success, fontWeight: '700', fontSize: 14 },
  remove: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  flex: { flex: 1 },
  muted: { fontSize: 13, color: colors.textMuted },
  error: { color: colors.danger },
  card: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.cream },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextOn: { color: colors.onPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  delete: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  input: { padding: 10, borderRadius: 10, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  small: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary },
  smallText: { color: colors.onPrimary, fontWeight: '700' },
  primary: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
}));
