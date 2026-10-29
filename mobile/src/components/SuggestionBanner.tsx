import { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';

import type { Suggestion } from '../hooks/useCheckinSuggestion';
import { suggestionText } from '../lib/suggestion';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';

type Props = { suggestion: Suggestion; onCheckin: () => void; onClose: () => void };

// Pushed up this far (or flicked up), the banner goes
const DISMISS_DY = -40;

/** In-app check-in suggestion at the top of the screen; swipe it up (or ✕) to close it. */
export function SuggestionBanner({ suggestion, onCheckin, onClose }: Props) {
  const { title, body } = suggestionText(suggestion.venue.name, suggestion.visits);
  const offset = useRef(new Animated.Value(0)).current;
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => offset.setValue(Math.min(g.dy, 0)),
      onPanResponderRelease: (_, g) => {
        if (g.dy < DISMISS_DY || g.vy < -0.5) {
          Animated.timing(offset, { toValue: -200, duration: 150, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: offset }] }]} {...swipe.panHandlers}>
      <Text style={styles.icon}><InlineIcon name="map-pin" /></Text>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <Pressable style={styles.button} onPress={onCheckin}>
        <Text style={styles.buttonText}>Check-in</Text>
      </Pressable>
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
        <Text style={styles.close}>✕</Text>
      </Pressable>
      <View style={styles.handle} />
    </Animated.View>
  );
}

// The app's red, so it does not blend in with the cards under it
const styles = themed(() => StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 54,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    borderRadius: 18,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    zIndex: 50,
  },
  icon: { fontSize: 22 },
  flex: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: colors.onPrimary },
  body: { fontSize: 13, color: colors.onPrimary, opacity: 0.9 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.onPrimary },
  buttonText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  close: { fontSize: 16, color: colors.onPrimary },
  // "Swipe up" hint
  handle: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    left: '45%',
    width: '10%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.onPrimary,
    opacity: 0.5,
  },
}));
