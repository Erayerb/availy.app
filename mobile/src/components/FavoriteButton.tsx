import { Pressable, StyleSheet, Text } from 'react-native';

import { useFavorites } from '../context/FavoritesContext';
import { colors } from '../theme';

type Props = {
  venueId: number;
  size?: number;
  floating?: boolean; // white round background, for use on top of images
};

export function FavoriteButton({ venueId, size = 20, floating = false }: Props) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(venueId);

  return (
    <Pressable
      onPress={() => toggle(venueId)}
      hitSlop={10}
      accessibilityLabel={active ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      style={floating && [styles.floating, { width: size + 16, height: size + 16, borderRadius: (size + 16) / 2 }]}
    >
      <Text style={[styles.heart, { fontSize: size, color: active ? colors.primary : colors.placeholder }]}>
        {active ? '♥' : '♡'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floating: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  heart: { lineHeight: undefined },
});
