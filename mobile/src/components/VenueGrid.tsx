import type { ReactElement } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { useLocation } from '../context/LocationContext';
import type { Venue } from '../lib/api';
import { distanceKm, formatDistance } from '../lib/geo';
import { VenueTile } from './VenueTile';
import { colors, themed } from '../theme';

const PADDING = 16;
const GAP = 12;

type Props = {
  venues: Venue[];
  header: ReactElement;
  emptyText: string;
  error?: string | null;
  onOpenVenue: (venue: Venue) => void;
  // Pull-to-refresh
  refreshing?: boolean;
  onRefresh?: () => void;
};

/** Two-column grid of square venue tiles with a scrolling header above it. */
export function VenueGrid({ venues, header, emptyText, error, onOpenVenue, refreshing = false, onRefresh }: Props) {
  const { width } = useWindowDimensions();
  const tileSize = (width - PADDING * 2 - GAP) / 2;
  const { point } = useLocation();

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
      renderItem={({ item }) => (
        <VenueTile
          venue={item}
          size={tileSize}
          distance={point ? formatDistance(distanceKm(point, item)) : null}
          onPress={() => onOpenVenue(item)}
        />
      )}
      refreshControl={
        // Pull-to-refresh is a touch gesture; on the web it only adds a wrapper that doubles the top margin
        onRefresh && Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = themed(() => StyleSheet.create({
  // Space for the status bar sits outside the list, so the pull-to-refresh spinner is not hidden behind it
  container: { flex: 1, marginTop: 50, backgroundColor: colors.background },
  content: { paddingHorizontal: PADDING, paddingTop: 10, paddingBottom: 40, gap: 16 },
  columns: { gap: GAP },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 24 },
  error: { textAlign: 'center', color: colors.danger, marginTop: 24 },
}));
