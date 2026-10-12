import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Venue } from '../lib/api';
import { levelStyle } from '../lib/occupancy';
import { categoryVisual } from '../lib/visuals';
import { FavoriteButton } from './FavoriteButton';
import { colors } from '../theme';

type Props = {
  venue: Venue;
  size: number;
  onPress: () => void;
};

export function VenueTile({ venue, size, onPress }: Props) {
  const { emoji, background } = categoryVisual(venue.category);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: size }, pressed && styles.pressed]}>
      <View style={[styles.image, { width: size, height: size, backgroundColor: background }]}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={[styles.badge, { backgroundColor: levelStyle(venue.occupancy.level).color }]} />
        <View style={styles.favorite}>
          <FavoriteButton venueId={venue.id} size={16} floating />
        </View>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {venue.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  image: { borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 48 },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.white,
  },
  favorite: { position: 'absolute', top: 6, left: 6 },
  name: { marginTop: 6, fontSize: 14, fontWeight: '600', color: colors.text },
});
