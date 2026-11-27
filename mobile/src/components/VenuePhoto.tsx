import { useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { photoUrl } from '../lib/venueApi';
import { categoryVisual } from '../lib/visuals';
import { GradientFill } from './GradientFill';
import { Icon } from './Icon';
import { themed } from '../theme';

type Props = {
  venueId: number;
  category: string;
  photoAt?: string | null; // the business's cover photo on the server
  size: number | '100%';
  height: number;
  radius?: number;
  // Small thumbnails: the icon in the middle instead of the corner
  centered?: boolean;
  // The caller lays its own fade over it (a tile with the name on it)
  noScrim?: boolean;
};

/** The venue's cover photo (uploaded by the business), or a card by type: a deep tone with the type's big line
 * drawing running off the bottom right corner (small thumbnails: the icon in the middle). */
export function VenuePhoto({ venueId, category, photoAt = null, size, height, radius = 16, centered = false, noScrim = false }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  // Only the verified business's cover photo (users do not set venue photos)
  const uri = photoAt ? photoUrl(venueId, photoAt) : null;
  const { icon, gradient, tile, accent } = categoryVisual(category);
  const box = { width: size, height, borderRadius: radius };
  if (uri) {
    // Under the photo the type's gradient (shown while it loads); over it a soft veil, so photo and
    // no-photo cards sit well side by side and the labels on them stay readable
    return (
      <View style={[box, styles.placeholder]}>
        <GradientFill colors={gradient} />
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: fade }]}
          resizeMode="cover"
          onLoad={() => Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start()}
        />
        {!centered && !noScrim && <GradientFill colors={gradient} scrim />}
      </View>
    );
  }
  if (centered) {
    return (
      <View style={[box, styles.placeholder, { backgroundColor: tile }]}>
        <View style={styles.middle}>
          <Icon name={icon} size={height * 0.5} color={accent} />
        </View>
      </View>
    );
  }
  // The drawing is as big as the card and cropped by it; a thinner line, so it reads as a drawing, not a symbol
  const drawing = Math.round(height * 1.05);
  return (
    <View style={[box, styles.placeholder, { backgroundColor: tile }]}>
      <View style={[styles.icon, { right: -height * 0.2, bottom: -height * 0.22, opacity: 0.5 }]} pointerEvents="none">
        <Icon name={icon} size={drawing} color={accent} strokeWidth={1.3} />
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  placeholder: { overflow: 'hidden' },
  icon: { position: 'absolute' },
  middle: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
}));
