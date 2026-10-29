import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';

import { useLocation } from '../context/LocationContext';
import { fetchVenues, type Venue } from '../lib/api';
import { bboxAround, nearestOpenVenue } from '../lib/nearby';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';

type Props = {
  // The venue the user is at was found: open its page (with the check-in panel) behind this sheet
  onFound: (venue: Venue) => void;
  // "Devam": close; without a venue nearby, the app opens the map
  onDone: (venue: Venue | null) => void;
};

/** "İlk check-in'in" sheet right after sign-up (like Swarm): find where the user is and invite a check-in. */
export function FirstCheckinSheet({ onFound, onDone }: Props) {
  const { locate } = useLocation();
  const [state, setState] = useState<{ status: 'looking' } | { status: 'found'; venue: Venue } | { status: 'none' }>({
    status: 'looking',
  });

  useEffect(() => {
    let stale = false;
    (async () => {
      const position = await locate();
      if (position.error !== null) return !stale && setState({ status: 'none' });
      try {
        const venues = await fetchVenues(bboxAround(position.coords), []);
        const venue = nearestOpenVenue(venues, position.coords);
        if (stale) return;
        if (venue) {
          setState({ status: 'found', venue });
          onFound(venue);
        } else setState({ status: 'none' });
      } catch {
        if (!stale) setState({ status: 'none' });
      }
    })();
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const venue = state.status === 'found' ? state.venue : null;

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Pressable onPress={() => onDone(venue)} hitSlop={12} style={styles.close} accessibilityLabel="Kapat">
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <Text style={styles.title}>İlk check-in'in</Text>
        <Text style={styles.art}><InlineIcon name="map-pin" /><InlineIcon name="sparkles" /></Text>
        <Text style={styles.text}>
          {state.status === 'looking'
            ? 'Yakınındaki mekanlara bakıyoruz…'
            : venue
              ? `Şu an ${venue.name} yakınındasın. Doluluğu işaretle (Sakin, Orta, Kalabalık), check-in yap ve ilk puanını kazan.`
              : 'Yakınında check-in yapılabilecek bir mekan bulamadık. Bir mekana gidince haritadan seçip check-in yap.'}
        </Text>
        <Text style={styles.muted}><InlineIcon name="sparkles" /> simgeli mekanların ilk check-in'ini yapan orayı keşfeder ve +50 puan alır.</Text>
        <Pressable style={styles.primary} onPress={() => onDone(venue)} disabled={state.status === 'looking'}>
          <Text style={styles.primaryText}>{state.status === 'looking' ? 'Bekle…' : 'Devam'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 44,
    gap: 14,
    alignItems: 'center',
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
  close: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, color: colors.text },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 14 },
  art: { fontSize: 56 },
  text: { fontSize: 16, lineHeight: 23, color: colors.text, textAlign: 'center' },
  muted: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  primary: { alignSelf: 'stretch', paddingVertical: 15, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
}));
