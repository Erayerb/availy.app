import { useRef, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

import { haptics } from '../lib/haptics';
import { colors, themed } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

const DELETE_AT = 90; // dragged this far left: deleted

/** A row that is deleted by dragging it to the left (a red "Sil" shows behind it). A vertical drag scrolls the
 * list as usual; screen readers get a "Sil" action. */
export function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const x = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      // Only a sideways drag to the left; up and down is the list's
      onMoveShouldSetPanResponder: (_, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -DELETE_AT || g.vx < -0.8) {
          haptics.tap();
          Animated.timing(x, { toValue: -600, duration: 180, useNativeDriver: true }).start(onDelete);
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.behind}>
        <Icon name="trash" size={18} color="#fff" />
        <Text style={styles.behindText}>Sil</Text>
      </View>
      <Animated.View
        {...pan.panHandlers}
        style={[styles.front, { transform: [{ translateX: x }] }]}
        accessible
        accessibilityActions={[{ name: 'delete', label: 'Sil' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete()}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { overflow: 'hidden' },
  behind: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingRight: 18,
  },
  behindText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  front: { backgroundColor: colors.surface },
}));
