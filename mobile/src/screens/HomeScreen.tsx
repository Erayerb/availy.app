import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { ClearButton } from '../components/ClearButton';
import { MenuButton } from '../components/MenuButton';
import { Chip, TagChips } from '../components/TagChips';
import { VenueTile } from '../components/VenueTile';
import { useDistricts } from '../hooks/useDistricts';
import { useSearch } from '../hooks/useSearch';
import type { Venue } from '../lib/api';
import { toggleSingle, toggleTag, type Tag } from '../lib/filters';
import { stableShuffle } from '../lib/shuffle';

const PADDING = 16;
const GAP = 12;
// New mixed order each app start, stable while the app is open
const SESSION_SEED = String(Date.now());

type Props = {
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  onMenu: () => void;
  onOpenVenue: (venue: Venue) => void;
};

export function HomeScreen({ tags, onTagsChange, onMenu, onOpenVenue }: Props) {
  const { width } = useWindowDimensions();
  const tileSize = (width - PADDING * 2 - GAP) / 2;
  const districts = useDistricts();
  const [district, setDistrict] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { venues, loading, error } = useSearch(query, district, tags);
  const searching = query.trim().length > 0;
  const hasFilters = district !== null || tags.length > 0;

  const items = useMemo(
    () => (searching ? venues : stableShuffle(venues, SESSION_SEED)),
    [venues, searching],
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <MenuButton onPress={onMenu} />
        <Text style={styles.brand}>Availy</Text>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Semt</Text>
        <ClearButton
          onPress={() => {
            setDistrict(null);
            onTagsChange([]);
          }}
          disabled={!hasFilters}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label="Tümü" active={district === null} onPress={() => setDistrict(null)} />
        {districts.map((d) => (
          <Chip key={d} label={d} active={district === d} onPress={() => setDistrict((c) => toggleSingle(c, d))} />
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Ne arıyorsun?</Text>
      <TagChips selected={tags} onToggle={(tag) => onTagsChange(toggleTag(tags, tag))} />

      <View style={styles.search}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Mekan ara"
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionTitle}>{searching ? 'Arama sonuçları' : 'Öneriler'}</Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(v) => String(v.id)}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text style={error ? styles.error : styles.empty}>
          {error ?? (loading ? 'Yükleniyor…' : 'Sonuç bulunamadı')}
        </Text>
      }
      renderItem={({ item }) => (
        <VenueTile venue={item} size={tileSize} onPress={() => onOpenVenue(item)} />
      )}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: PADDING, paddingTop: 60, paddingBottom: 40, gap: 16 },
  header: { gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  brand: { fontSize: 26, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  row: { gap: 8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 16, color: '#111827', padding: 0 },
  searchClear: { fontSize: 15, color: '#6b7280' },
  columns: { gap: GAP },
  empty: { textAlign: 'center', color: '#6b7280', marginTop: 24 },
  error: { textAlign: 'center', color: '#d64545', marginTop: 24 },
});
