import { useMemo, useState, type ReactNode } from 'react';
import { Tip } from './Tip';
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
// "Şu an sakin, yakınında": the nearest quiet one is this close
const NEAR_KM = 2;
// "Ne arıyorsun?": in this order (the first is chosen at the start); no Wi-Fi chip here
const ROW_TAGS: Tag[] = ['quiet', 'socializing', 'food', 'nightlife', 'coworking', 'entertainment'];

/** Sponsored venues first in a row they fit (option A: "Sponsorlu" on the card), the rest as given. */
export function withSponsoredFirst(list: Venue[]): Venue[] {
  return [...list.filter((v) => v.sponsored), ...list.filter((v) => !v.sponsored)];
}

/** The rows of the home page under "Arkadaşların nerede?": what is quiet nearby, what you are after (one tag at a
 * time), what is trending and what waits to be discovered. Each scrolls sideways; an empty row is not shown. */
export function HomeRows({ venues, onOpenVenue, placeChosen = false, aside = null }: {
  venues: Venue[];
  onOpenVenue: (venue: Venue) => void;
  placeChosen?: boolean; // Konum: districts chosen (venues are only theirs); undiscovered ones there, from any distance
  aside?: ReactNode; // the page's Konum + search, on the first row's title line when the page has no title of its own
}) {
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
    // Nearby ones (with the user's location), not a list of the whole city; with districts chosen in Konum the
    // ones there, nearest first. A sponsored venue nobody has checked in at yet comes first, from any distance
    () => {
      const unexplored = near.filter((v) => v.open_now && v.crowd?.state === 'unexplored');
      const sponsored = unexplored.filter((v) => v.sponsored);
      const rest = unexplored.filter((v) => !v.sponsored);
      const nearby = placeChosen ? rest : point ? rest.filter((v) => distanceKm(point, v) <= DISCOVER_KM) : [];
      return [...sponsored, ...nearby].slice(0, DISCOVER_MAX);
    },
    [near, point, placeChosen],
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
      {/* Nearest quiet ones first; when none is near, the far ones still show (then without "yakınında") */}
      {quiet.length > 0 && (
        <Row title={point && distanceKm(point, quiet.find((v) => !v.sponsored) ?? quiet[0]) <= NEAR_KM ? 'Şu an sakin, yakınında' : 'Şu an sakin'} aside={aside}>
          {tiles(quiet)}
        </Row>
      )}

      {/* One tag at a time: the chips pick what the cards under them show */}
      <View style={styles.section}>
        <TitleLine title="Ne arıyorsun?" aside={quiet.length > 0 ? null : aside} />
        <Tip
          id="homeRows"
          after="homeSearch"
          placement="above"
          radius={18}
          text="Satırları sağa kaydır. Ne arıyorsun? Bir etikete dokun, uyan mekanlar hemen altında, sakin olanlar önde sıralansın."
        >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {ROW_TAGS.map((t) => (
            <Chip key={t} label={TAG_OPTIONS.find((o) => o.tag === t)?.label ?? t} active={tag === t} onPress={() => setTag(t)} />
          ))}
        </ScrollView>
        </Tip>
        {tagged.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {tiles(tagged)}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>Şu an buna uyan açık mekan yok. Başka bir çip seç.</Text>
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

function TitleLine({ title, aside }: { title: string; aside?: ReactNode }) {
  if (!aside) return <Text style={styles.title}>{title}</Text>;
  return (
    <View style={styles.titleLine}>
      <Text style={[styles.title, styles.flex]} numberOfLines={1}>{title}</Text>
      {aside}
    </View>
  );
}

function Row({ title, subtitle, aside, children }: { title: string; subtitle?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <TitleLine title={title} aside={aside} />
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  rows: { gap: 18, marginTop: 6 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 15, elevation: 15 },
  flex: { flex: 1 },
  section: { gap: 10 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: -6 },
  row: { gap: 12, paddingRight: 16 },
  chips: { gap: 8, paddingRight: 16 },
  empty: { fontSize: 13, color: colors.textMuted },
}));
