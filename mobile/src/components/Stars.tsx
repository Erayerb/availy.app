import { View } from 'react-native';

import { colors } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** A 1–5 rating as the icon set's stars (filled up to the rating), instead of ★★★☆☆ text. */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${rating} yıldız`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" size={size} filled={n <= rating} color={n <= rating ? colors.gold : colors.border} />
      ))}
    </View>
  );
}

/** The same inside a line of text: filled stars up to the rating (a small row placed in the line). */
export function InlineStars({ rating }: { rating: number }) {
  return (
    <Text accessibilityLabel={`${rating} yıldız`}>
      <View style={{ flexDirection: 'row', gap: 1, transform: [{ translateY: 2 }] }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon key={n} name="star" size={13} filled={n <= rating} color={n <= rating ? colors.gold : colors.border} />
        ))}
      </View>
    </Text>
  );
}
