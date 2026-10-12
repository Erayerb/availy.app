import type { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions } from 'react-native';

import type { Venue } from '../lib/api';
import { VenueTile } from './VenueTile';
import { colors } from '../theme';

const PADDING = 16;
const GAP = 12;

type Props = {
  venues: Venue[];
  header: ReactElement;
  emptyText: string;
  error?: string | null;
  onOpenVenue: (venue: Venue) => void;
};

/** Two-column grid of square venue tiles with a scrolling header above it. */
export function VenueGrid({ venues, header, emptyText, error, onOpenVenue }: Props) {
  const { width } = useWindowDimensions();
  const tileSize = (width - PADDING * 2 - GAP) / 2;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={venues}
      keyExtractor={(v) => String(v.id)}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={error ? styles.error : styles.empty}>{error ?? emptyText}</Text>}
      renderItem={({ item }) => <VenueTile venue={item} size={tileSize} onPress={() => onOpenVenue(item)} />}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: PADDING, paddingTop: 60, paddingBottom: 40, gap: 16 },
  columns: { gap: GAP },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 24 },
  error: { textAlign: 'center', color: colors.danger, marginTop: 24 },
});
