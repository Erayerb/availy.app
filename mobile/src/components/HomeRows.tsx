import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLocation } from '../context/LocationContext';
import type { Venue } from '../lib/api';
import { liveLevel } from '../lib/crowd';
import { TAG_OPTIONS, type Tag } from '../lib/filters';
import { distanceKm, formatDistance, sortByDistance } from '../lib/geo';
import { colors, themed } from '../theme';
import { Chip } from './TagChips';
import { Text } from './Text';
import { VenueTile } from './VenueTile';

const TILE = 150;
const PER_ROW = 12;
// "Keşfedilmeyi bekleyenler": only nearby ones, a few (no rush across the city)
const DISCOVER_KM = 2;
const DISCOVER_MAX = 6;
// "Ne arıyorsun?": in this order (the first is chosen at the start); no Wi-Fi chip here
const ROW_TAGS: Tag[] = ['quiet', 'socializing', 'food', 'nightlife', 'coworking', 'entertainment'];

/** Sponsored venues first in a row they fit (option A: "Sponsorlu" on the card), the rest as given. */
export function withSponsoredFirst(list: Venue[]): Venue[] {
  return [...list.filter((v) => v.sponsored), ...list.filter((v) => !v.sponsored)];
}

/** The rows of the home page under "Arkadaşların nerede?": what is quiet nearby, what you are after (one tag at a
 * time), what is trending and what waits to be discovered. Each scrolls sideways; an empty row is not shown. */
export function HomeRows({ venues, onOpenVenue }: { venues: Venue[]; onOpenVenue: (venue: Venue) => void }) {
  const { point } = useLocation();
  const [tag, setTag] = useState<Tag>('quiet');
  const near = useMemo(() => (point ? sortByDistance(venues, point) : venues), [venues, point]);

  const quiet = useMemo(
    () => withSponsoredFirst(near.filter((v) => v.open_now && liveLevel(v) === 'low')).slice(0, PER_ROW),
    [near],
  );
  const tagged = useMemo(() => {
    const open = near.filter((v) => v.open_now && v.tags.includes(tag));
    // Quiet ones first, then the rest (each nearest first)
    const order = (v: Venue) => (liveLevel(v) === 'low' ? 0 : liveLevel(v) === 'medium' ? 1 : 2);
    return withSponsoredFirst([...open].sort((a, b) => order(a) - order(b))).slice(0, PER_ROW);
  }, [near, tag]);
  const trending = useMemo(
    () =>
      withSponsoredFirst([...venues].filter((v) => (v.trend ?? 0) > 0).sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))).slice(0, PER_ROW),
    [venues],
  );
  const discover = useMemo(
    // Only with the user's location: nearby ones, not a list of the whole city
    () =>
      point
        ? near.filter((v) => v.open_now && v.crowd?.state === 'unexplored' && distanceKm(point, v) <= DISCOVER_KM).slice(0, DISCOVER_MAX)
        : [],
    [near, point],
  );

  const distance = (v: Venue) => (point ? formatDistance(distanceKm(point, v)) : null);
  const tiles = (list: Venue[]) =>
    list.map((v) => (
      <View key={v.id} style={{ width: TILE }}>
        <VenueTile venue={v} size={TILE} distance={distance(v)} onPress={() => onOpenVenue(v)} />
      </View>
    ));

  return (
    <View style={styles.rows}>
      {quiet.length > 0 && <Row title={point ? 'Şu an sakin, yakınında' : 'Şu an sakin'}>{tiles(quiet)}</Row>}

      {/* One tag at a time: the chips pick what the cards under them show */}
      <View style={styles.section}>
        <Text style={styles.title}>Ne arıyorsun?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {ROW_TAGS.map((t) => (
            <Chip key={t} label={TAG_OPTIONS.find((o) => o.tag === t)?.label ?? t} active={tag === t} onPress={() => setTag(t)} />
          ))}
        </ScrollView>
        {tagged.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {tiles(tagged)}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>Şu an buna uyan açık mekan yok.</Text>
        )}
      </View>

      {trending.length > 0 && <Row title="Trend olanlar">{tiles(trending)}</Row>}
      {discover.length > 0 && (
        <Row title="Keşfedilmeyi bekleyenler" subtitle="Henüz kimse gitmedi: ilk sen git, keşfeden sen ol">
          {tiles(discover)}
        </Row>
      )}
    </View>
  );
}

function Row({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  rows: { gap: 18, marginTop: 6 },
  section: { gap: 10 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: -6 },
  row: { gap: 12, paddingRight: 16 },
  chips: { gap: 8, paddingRight: 16 },
  empty: { fontSize: 13, color: colors.textMuted },
}));
