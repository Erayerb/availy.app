import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { markTipSeen, useTip, type TipId } from '../lib/tips';
import { colors } from '../theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Props = {
  id: TipId;
  text: string;
  after?: TipId; // shown only once this one was closed
  children: ReactNode; // the thing it explains: a pulsing ring goes round it
  placement?: 'above' | 'below'; // where the bubble sits
  align?: 'left' | 'center' | 'right'; // the bubble's side (a button at the right edge: 'right')
  style?: StyleProp<ViewStyle>; // the wrapper's own place (e.g. an absolute button's position)
  radius?: number; // the ring's corners, to follow the thing's shape
  shift?: number; // moves the bubble sideways (px), to keep it on screen near an edge
};

/** A one-time tip pointing at something: a pulsing ring round it and a bubble beside it; "Anladım" closes it
 * for good. Without the tip (already seen) it is just the wrapped thing. */
export function Tip({ id, text, after, children, placement = 'above', align = 'center', style, radius = 16, shift = 0 }: Props) {
  const visible = useTip(id, after);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  return (
    <View style={[style, visible && styles.raised]}>
      {children}
      {visible && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { borderRadius: radius + 6, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) },
              { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] },
            ]}
          />
          <View
            style={[
              styles.bubbleWrap,
              placement === 'above' ? styles.above : styles.below,
              align === 'left' ? styles.left : align === 'right' ? styles.right : styles.center,
              shift ? { transform: [{ translateX: shift }] } : null,
            ]}
          >
            {placement === 'below' && <View style={[styles.arrow, styles.arrowUp, ARROW[align]]} />}
            <View style={styles.bubble} accessibilityRole="alert">
              <View style={styles.row}>
                <Icon name="bulb" size={18} color="#fff" />
                <Text style={styles.text}>{text}</Text>
              </View>
              <Pressable onPress={() => markTipSeen(id)} hitSlop={10} style={styles.ok}>
                <Text style={styles.okText}>Anladım</Text>
              </Pressable>
            </View>
            {placement === 'above' && <View style={[styles.arrow, styles.arrowDown, ARROW[align]]} />}
          </View>
        </>
      )}
    </View>
  );
}

const BUBBLE_WIDTH = 280;
const ARROW = {
  left: { alignSelf: 'flex-start' as const, marginLeft: 24 },
  center: { alignSelf: 'center' as const },
  right: { alignSelf: 'flex-end' as const, marginRight: 24 },
};

const styles = StyleSheet.create({
  raised: { zIndex: 30, elevation: 30 },
  ring: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderWidth: 3, borderColor: colors.primary },
  bubbleWrap: { position: 'absolute', width: BUBBLE_WIDTH },
  above: { bottom: '100%', marginBottom: 10 },
  below: { top: '100%', marginTop: 10 },
  left: { left: -4 },
  right: { right: -4 },
  center: { left: '50%', marginLeft: -BUBBLE_WIDTH / 2 },
  bubble: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  text: { flex: 1, color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  ok: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 14 },
  okText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  arrow: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  arrowDown: { borderTopWidth: 10, borderTopColor: colors.primary },
  arrowUp: { borderBottomWidth: 10, borderBottomColor: colors.primary },
});
