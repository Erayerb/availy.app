import { Image, StyleSheet, Text, View } from 'react-native';

import { useEngagement } from '../context/EngagementContext';
import { photoUrl } from '../lib/venueApi';
import { categoryVisual } from '../lib/visuals';
import { themed } from '../theme';

type Props = {
  venueId: number;
  category: string;
  photoAt?: string | null; // the business's cover photo on the server
  size: number | '100%';
  height: number;
  radius?: number;
};

/** The venue's cover photo (uploaded by the business), or a coloured placeholder by type. */
export function VenuePhoto({ venueId, category, photoAt = null, size, height, radius = 16 }: Props) {
  // Photos picked before they were kept on the server stay on that phone
  const local = useEngagement().photos[venueId];
  const uri = photoAt ? photoUrl(venueId, photoAt) : local;
  const { emoji, background } = categoryVisual(category);
  const box = { width: size, height, borderRadius: radius };
  if (uri) return <Image source={{ uri }} style={[box, styles.image]} resizeMode="cover" />;
  return (
    <View style={[box, styles.placeholder, { backgroundColor: background }]}>
      <Text style={{ fontSize: height * 0.32 }}>{emoji}</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  image: { overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
}));
