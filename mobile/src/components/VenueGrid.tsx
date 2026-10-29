import type { ReactElement } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from './Text';

import { useLocation } from '../context/LocationContext';
import type { Venue } from '../lib/api';
import { distanceKm, formatDistance } from '../lib/geo';
import { TileSkeleton } from './Skeleton';
import { VenueTile } from './VenueTile';
import { colors, themed } from '../theme';

const PADDING = 16;
const GAP = 12;

type Props = {
  venues: Venue[];
  header: ReactElement;
  emptyText: string;
  loading?: boolean; // first load: placeholder tiles instead of the empty text
  error?: string | null;
  onOpenVenue: (venue: Venue) => void;
  // Pull-to-refresh
  refreshing?: boolean;
  onRefresh?: () => void;
};

/** Two-column grid of square venue tiles with a scrolling header above it. */
export function VenueGrid({ venues, header, emptyText, loading = false, error, onOpenVenue, refreshing = false, onRefresh }: Props) {
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
      ListEmptyComponent={
        loading && !error ? (
          <View style={styles.skeletons}>
            {Array.from({ length: 6 }, (_, i) => (
              <TileSkeleton key={i} size={tileSize} />
            ))}
          </View>
        ) : (
          <Text style={error ? styles.error : styles.empty}>{error ?? emptyText}</Text>
        )
      }
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
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, rowGap: 16 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 24 },
  error: { textAlign: 'center', color: colors.danger, marginTop: 24 },
}));
