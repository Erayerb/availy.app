import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLocation } from '../context/LocationContext';
import { searchVenues, type Venue } from '../lib/api';
import { candidatesApi, type Candidate } from '../lib/candidates';
import { categoryLabel } from '../lib/filters';
import { distanceKm, formatDistance, sortByDistance } from '../lib/geo';
import { notifyVenuesChanged } from '../lib/venueEvents';
import { colors, themed } from '../theme';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { VenuePhoto } from './VenuePhoto';

type Props = { name: string; token: string; onOpenVenue: (venue: { id: number }) => void };

const NEAR_KM = 3; // a venue with that name further away is a different place

/**
 * "Mekan ekle", while typing the name: "Bu mu?" — the same place already on availo (open it), or known
 * from open data (add it with one tap), so it is not added twice by hand.
 */
export function SameVenueHint({ name, token, onOpenVenue }: Props) {
  const { point } = useLocation();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const q = name.trim();
    if (q.length < 3) {
      setVenues([]);
      setCandidates([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      searchVenues(q, null, [])
        .then((list) => {
          if (stale) return;
          const near = point ? sortByDistance(list, point).filter((v) => distanceKm(point, v) <= NEAR_KM) : list;
          setVenues(near.slice(0, 3));
        })
        .catch(() => {});
      candidatesApi
        .search(q, point)
        .then((list) => !stale && setCandidates(list.filter((c) => c.distance_m === null || c.distance_m <= NEAR_KM * 1000).slice(0, 3)))
        .catch(() => {});
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [name, point?.lat, point?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  if (venues.length === 0 && candidates.length === 0) return null;

  const add = async (c: Candidate) => {
    setBusy(c.id);
    try {
      const venue = await candidatesApi.add(token, c.id);
      notifyVenuesChanged();
      onOpenVenue({ id: venue.id });
    } catch {
      setBusy(null);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Bu mu?</Text>
      {venues.map((v) => (
        <Pressable key={`v${v.id}`} style={styles.row} onPress={() => onOpenVenue(v)}>
          <VenuePhoto venueId={v.id} category={v.category} photoAt={v.photo_at} size={40} height={40} radius={11} centered />
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>{v.name}</Text>
            <Text style={styles.muted} numberOfLines={1}>
              availo'da var · {categoryLabel(v.category)}
              {point ? ` · ${formatDistance(distanceKm(point, v))}` : ''}
            </Text>
          </View>
          <Text style={styles.link}>Aç ›</Text>
        </Pressable>
      ))}
      {candidates.map((c) => (
        <View key={`c${c.id}`} style={styles.row}>
          <VenuePhoto venueId={0} category={c.category} size={40} height={40} radius={11} centered />
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
            <Text style={styles.muted} numberOfLines={1}>
              {categoryLabel(c.category)}
              {c.distance_m !== null ? ` · ${formatDistance(c.distance_m / 1000)}` : ''}
            </Text>
          </View>
          <Pressable style={[styles.add, busy === c.id && styles.busy]} onPress={() => add(c)} disabled={busy !== null}>
            <Text style={styles.addText}>{busy === c.id ? '…' : 'Ekle'}</Text>
          </Pressable>
        </View>
      ))}
      <Text style={styles.muted}>Değilse formu doldurmaya devam et.</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.cream },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12, backgroundColor: colors.surface },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12.5, color: colors.textMuted },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  add: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 11, backgroundColor: colors.primary },
  busy: { opacity: 0.6 },
  addText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
}));
