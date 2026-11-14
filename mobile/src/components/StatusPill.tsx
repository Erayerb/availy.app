import { StyleSheet, View } from 'react-native';

import { useSettings } from '../context/SettingsContext';
import type { Crowd } from '../lib/crowd';
import { colors, themed } from '../theme';
import { Text } from './Text';

type Props = {
  venue: { open_now: boolean; opens_at?: string | null; crowd?: Crowd };
  // On a photo: dark glass with white text; on a card: the theme's surface colours
  onPhoto?: boolean;
  maxWidth?: number;
};

/** "● Sakin", "✨ Keşfet" (no check-ins yet) or "Kapalı · 09:00", as a small pill. */
export function StatusPill({ venue, onPhoto = false, maxWidth }: Props) {
  const { crowdLook } = useSettings();
  const status = crowdLook(venue);
  const sparkle = venue.open_now && status.glyph === '✨';
  const text = !venue.open_now
    ? venue.opens_at ? `Kapalı · ${venue.opens_at}` : 'Kapalı'
    : sparkle
      ? 'Keşfet'
      : status.label.replace(/^\d+ kişiye göre /, '');
  return (
    <View style={[styles.pill, onPhoto ? styles.onPhoto : styles.onCard, maxWidth ? { maxWidth } : null]}>
      {sparkle ? <Text style={styles.glyph}>✨</Text> : <View style={[styles.dot, { backgroundColor: status.color }]} />}
      <Text style={[styles.text, onPhoto ? styles.textOnPhoto : styles.textOnCard]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  onPhoto: { backgroundColor: 'rgba(0,0,0,0.42)' },
  onCard: { backgroundColor: colors.cream },
  dot: { width: 7, height: 7, borderRadius: 4 },
  glyph: { fontSize: 10 },
  text: { fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
  textOnPhoto: { color: '#fff' },
  textOnCard: { color: colors.text },
}));
