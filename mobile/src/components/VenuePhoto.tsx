import { Image, StyleSheet, Text, View } from 'react-native';

import { useEngagement } from '../context/EngagementContext';
import { categoryVisual } from '../lib/visuals';

type Props = { venueId: number; category: string; size: number | '100%'; height: number; radius?: number };

/** The venue's one photo (uploaded by the business), or a coloured placeholder by type. */
export function VenuePhoto({ venueId, category, size, height, radius = 16 }: Props) {
  const photo = useEngagement().photos[venueId];
  const { emoji, background } = categoryVisual(category);
  const box = { width: size, height, borderRadius: radius };
  if (photo) return <Image source={{ uri: photo }} style={[box, styles.image]} resizeMode="cover" />;
  return (
    <View style={[box, styles.placeholder, { backgroundColor: background }]}>
      <Text style={{ fontSize: height * 0.32 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
