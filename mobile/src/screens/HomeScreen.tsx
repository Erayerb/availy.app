import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ClearButton } from '../components/ClearButton';
import { MenuButton } from '../components/MenuButton';
import { Chip, TagChips } from '../components/TagChips';
import { VenueGrid } from '../components/VenueGrid';
import { useDistricts } from '../hooks/useDistricts';
import { useSearch } from '../hooks/useSearch';
import type { Venue } from '../lib/api';
import { toggleSingle, toggleTag, type Tag } from '../lib/filters';
import { stableShuffle } from '../lib/shuffle';
import { colors } from '../theme';

// New mixed order each app start, stable while the app is open
const SESSION_SEED = String(Date.now());

type Props = {
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  onMenu: () => void;
  onOpenVenue: (venue: Venue) => void;
};

export function HomeScreen({ tags, onTagsChange, onMenu, onOpenVenue }: Props) {
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
          placeholderTextColor={colors.placeholder}
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
    <VenueGrid
      venues={items}
      header={header}
      emptyText={loading ? 'Yükleniyor…' : 'Sonuç bulunamadı'}
      error={error}
      onOpenVenue={onOpenVenue}
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  brand: { fontSize: 26, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
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
    backgroundColor: colors.cream,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, padding: 0 },
  searchClear: { fontSize: 15, color: colors.textMuted },
});
