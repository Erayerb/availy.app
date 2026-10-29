import { StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

import { useFavorites } from '../context/FavoritesContext';
import { haptics } from '../lib/haptics';
import { colors, themed } from '../theme';

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
      onPress={() => {
        haptics.tap();
        toggle(venueId);
      }}
      hitSlop={10}
      accessibilityLabel={active ? 'Favorilerden çıkar' : 'Favorilere ekle'}
      style={floating && [styles.floating, { width: size + 16, height: size + 16, borderRadius: (size + 16) / 2 }]}
    >
      <Icon name="heart"
        filled={active} size={size} color={active ? colors.primary : colors.textMuted} />
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  floating: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
}));
