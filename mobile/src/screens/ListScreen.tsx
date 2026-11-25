import { WEB_APP_URL } from '../lib/share';
import { NewListSheet } from '../components/NewListSheet';
import { VenueTile } from '../components/VenueTile';
import { Icon, type IconName } from '../components/Icon';
import { distanceKm, formatDistance } from '../lib/geo';
import { useLocation } from '../context/LocationContext';
import { RowsSkeleton } from '../components/Skeleton';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Text } from '../components/Text';

import { BackButton } from '../components/BackButton';
import { Pressable } from '../components/Pressable';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import type { Venue } from '../lib/api';
import { confirmAction } from '../lib/confirm';
import { liveLevel } from '../lib/crowd';
import { listLink, listsApi, listShareMessage, type VenueList } from '../lib/lists';
import { shareText } from '../lib/shareVenue';
import { colors, themed } from '../theme';
import { InlineIcon } from '../components/Icon';

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
  const code = 'code' in target ? target.code : null;
  // Düzenle: the same steps as making a list
  const [editing, setEditing] = useState(false);
  const { width } = useWindowDimensions();
  const tileSize = (width - 32 - 12) / 2;
  const { point } = useLocation();

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
  // "şu an 3'ü sakin": the reason to keep a list in availo
  const quiet = shown.filter((v) => liveLevel(v) === 'low').length;



  // Paylaş: "Herkes" lists send their link; the others send the venues' names as text (nothing to open)
  const share = async () => {
    if (!list) return;
    if (list.visibility === 'link' && list.share_code) return setNote(await shareText(listShareMessage(list.name, list.share_code)));
    const names = shown.map((v) => `• ${v.name}`).join('\n');
    setNote(await shareText(`availo'da "${list.name}" listem:\n${names || '(henüz mekan yok)'}\n${WEB_APP_URL}`));
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
              <View style={styles.row}>
                <Icon name={VISIBILITY_ICON[list.visibility]} size={16} color={colors.textMuted} />
                <Text style={[styles.muted, styles.flex]}>
                  {list.visibility === 'link' ? 'Herkes · bağlantıyla açılır' : list.visibility === 'friends' ? 'Arkadaşların görür' : 'Yalnızca sen görürsün'}
                </Text>
              </View>
              {list.visibility === 'link' && list.share_code && (
                <Text style={styles.linkBox} numberOfLines={1} selectable>
                  {listLink(list.share_code)}
                </Text>
              )}
              <View style={styles.row}>
                <Pressable style={[styles.primary, styles.flex]} onPress={share}>
                  <Text style={styles.primaryText}><InlineIcon name="share-3" /> Paylaş</Text>
                </Pressable>
                <Pressable style={[styles.secondary, styles.flex]} onPress={() => setEditing(true)}>
                  <Text style={styles.secondaryText}><InlineIcon name="pencil" /> Düzenle</Text>
                </Pressable>
              </View>
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
            <NewListSheet
              visible={editing}
              token={token}
              edit={list}
              onClose={() => setEditing(false)}
              onCreated={() => {
                setEditing(false);
                load();
                refresh();
              }}
              onDelete={() =>
                confirmAction(`"${list.name}" silinsin mi?`, 'Liste ve içindeki mekan seçimin silinir; mekanlar silinmez.', 'Sil', () =>
                  listsApi.remove(token, list.id).then(onBack).catch(() => {}),
                )
              }
            />
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
      ListEmptyComponent={!list || loading ? <RowsSkeleton count={4} /> : <Text style={styles.empty}>{'Listen boş. Mekan sayfasında "Listeye ekle"ye dokun.'}</Text>}
      keyboardShouldPersistTaps="handled"
      onRefresh={() => {
        load();
        refresh();
      }}
      refreshing={false}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      renderItem={({ item }) => (
        <VenueTile
          venue={item}
          size={tileSize}
          distance={point ? formatDistance(distanceKm(point, item)) : null}
          onPress={() => onOpenVenue(item)}
        />
      )}
    />
  );
}

const VISIBILITY_ICON: Record<VenueList['visibility'], IconName> = { private: 'lock', friends: 'users', link: 'world' };

const styles = themed(() => StyleSheet.create({
  columns: { gap: 12 },
  linkBox: { fontSize: 13, color: colors.text, padding: 10, borderRadius: 10, backgroundColor: colors.cream, overflow: 'hidden' },
  secondary: { paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: TAB_BAR_SPACE, gap: 8 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 16 },
  header: { gap: 10, marginBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  flex: { flex: 1 },
  muted: { fontSize: 13, color: colors.textMuted },
  error: { color: colors.danger },
  card: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
}));
