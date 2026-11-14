import { useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useEngagement } from '../context/EngagementContext';
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
};

/** The venue's cover photo (uploaded by the business), or a coloured card by type: a gradient with the type's icon. */
export function VenuePhoto({ venueId, category, photoAt = null, size, height, radius = 16, centered = false }: Props) {
  // Photos picked before they were kept on the server stay on that phone
  const local = useEngagement().photos[venueId];
  const fade = useRef(new Animated.Value(0)).current;
  const uri = photoAt ? photoUrl(venueId, photoAt) : local;
  const { icon, gradient } = categoryVisual(category);
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
        {!centered && <GradientFill colors={gradient} scrim />}
      </View>
    );
  }
  return (
    <View style={[box, styles.placeholder]}>
      <GradientFill colors={gradient} />
      <View style={centered ? styles.middle : [styles.icon, { right: height * 0.08, bottom: height * 0.07 }]}>
        <Icon name={icon} size={height * (centered ? 0.48 : 0.3)} color="rgba(255,255,255,0.9)" />
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  image: { overflow: 'hidden' },
  placeholder: { overflow: 'hidden' },
  icon: { position: 'absolute' },
  middle: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
}));
