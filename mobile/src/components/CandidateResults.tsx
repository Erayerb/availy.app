import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLocation } from '../context/LocationContext';
import { candidatesApi, type Candidate } from '../lib/candidates';
import { categoryLabel } from '../lib/filters';
import { formatDistance } from '../lib/geo';
import { notifyVenuesChanged } from '../lib/venueEvents';
import { colors, themed } from '../theme';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { VenuePhoto } from './VenuePhoto';

type Props = {
  query: string;
  token: string | null; // signed-in customers can add
  onAdded: (venue: { id: number }) => void; // opens the venue page (to check in)
  onSignIn?: () => void;
};

/** Under search results: places from open data that match and are not on the map yet, with "Ekle ve check-in yap". */
export function CandidateResults({ query, token, onAdded, onSignIn }: Props) {
  const { point } = useLocation();
  const [found, setFound] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return setFound([]);
    let stale = false;
    const timer = setTimeout(() => {
      candidatesApi
        .search(q, point)
        .then((list) => !stale && setFound(list))
        .catch(() => {});
    }, 350);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, point?.lat, point?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  if (found.length === 0) return null;

  const add = async (c: Candidate) => {
    if (!token) return onSignIn?.();
    setBusy(c.id);
    try {
      const venue = await candidatesApi.add(token, c.id);
      notifyVenuesChanged();
      onAdded({ id: venue.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eklenemedi.');
    }
    setBusy(null);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Haritada yok mu?</Text>
      <Text style={styles.muted}>Bu yerler henüz availo'da görünmüyor. Ekle, check-in yapan ilk kişi sen ol.</Text>
      {found.map((c) => (
        <View key={c.id} style={styles.row}>
          <VenuePhoto venueId={0} category={c.category} size={44} height={44} radius={12} centered />
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
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  section: { gap: 8, marginTop: 14 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  add: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primary },
  busy: { opacity: 0.6 },
  addText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
  error: { fontSize: 13, color: colors.danger },
}));
