import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, StyleSheet, useWindowDimensions, View, type HostInstance, type StyleProp, type ViewStyle } from 'react-native';

import { PageContext } from '../context/PageContext';
import { markTipSeen, useTip, useTipTurn, type TipId } from '../lib/tips';
import { colors } from '../theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Props = {
  id: TipId;
  text: string;
  after?: TipId; // shown only once this one was closed
  children: ReactNode; // the thing it explains: it stays lit, with a pulsing ring round it
  placement?: 'above' | 'below'; // where the bubble sits (it turns round when there is no room)
  style?: StyleProp<ViewStyle>; // the wrapper's own place (e.g. an absolute button's position)
  radius?: number; // the ring's corners, to follow the thing's shape
  // A button that does the thing it teaches ("Check-in yap"): closes the tip too
  action?: { label: string; onPress: () => void };
};

type Rect = { x: number; y: number; w: number; h: number };

const GAP = 14; // between the thing and the bubble
const EDGE = 12; // the bubble keeps this far from the screen's sides
const PAD = 6; // the lit area and the ring go this far round the thing
const MEASURE_MS = 600;

/** A one-time tip pointing at something. It opens over everything (its own layer): the screen dims except the
 * thing it explains, which gets a pulsing ring, and nothing else can be tapped until "Anladım" (or its action) is
 * pressed. It waits until its page is on top and the thing is on screen; one tip at a time. Without the tip
 * (already seen) it is just the wrapped thing. */
export function Tip({ id, text, after, children, placement = 'above', style, radius = 16, action }: Props) {
  const wanted = useTip(id, after);
  const { focused } = useContext(PageContext);
  const target = useRef<HostInstance>(null);
  const { width: W, height: H } = useWindowDimensions();
  const [rect, setRect] = useState<Rect | null>(null);

  // Where the thing is on screen, checked now and then (the page may scroll, slide in or change)
  useEffect(() => {
    if (!wanted || !focused) {
      setRect(null);
      return;
    }
    let stopped = false;
    const measure = () =>
      target.current?.measureInWindow((x, y, w, h) => {
        if (stopped) return;
        const onScreen = w > 0 && h > 0 && y >= 0 && y + h <= H && x >= -1 && x + w <= W + 1;
        setRect((old) => {
          if (!onScreen) return null;
          if (old && old.x === x && old.y === y && old.w === w && old.h === h) return old;
          return { x, y, w, h };
        });
      });
    measure();
    const timer = setInterval(measure, MEASURE_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [wanted, focused, W, H]);

  const shown = useTipTurn(id, wanted && focused && rect !== null);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!shown) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shown, pulse]);

  return (
    <View ref={target} style={style} collapsable={false}>
      {children}
      {shown && rect && (
        <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>
          <Overlay rect={rect} W={W} H={H} radius={radius} pulse={pulse} placement={placement}>
            <View style={styles.bubble} accessibilityRole="alert">
              <View style={styles.row}>
                <Icon name="bulb" size={18} color="#fff" />
                <Text style={styles.text}>{text}</Text>
              </View>
              <View style={styles.buttons}>
                {action && (
                  <Pressable
                    onPress={() => {
                      markTipSeen(id);
                      action.onPress();
                    }}
                    hitSlop={10}
                    style={styles.ok}
                  >
                    <Text style={styles.okText}>{action.label}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => markTipSeen(id)} hitSlop={10} style={action ? styles.later : styles.ok}>
                  <Text style={action ? styles.laterText : styles.okText}>Anladım</Text>
                </Pressable>
              </View>
            </View>
          </Overlay>
        </Modal>
      )}
    </View>
  );
}

type OverlayProps = {
  rect: Rect;
  W: number;
  H: number;
  radius: number;
  pulse: Animated.Value;
  placement: 'above' | 'below';
  children: ReactNode;
};

/** The dim layer with a lit hole round the thing, the ring, and the bubble pointing at it. Every tap lands here. */
function Overlay({ rect, W, H, radius, pulse, placement, children }: OverlayProps) {
  const hole = { left: rect.x - PAD, top: rect.y - PAD, width: rect.w + PAD * 2, height: rect.h + PAD * 2 };
  // Above or below as asked; turned round when that side has no room
  const roomAbove = rect.y;
  const roomBelow = H - (rect.y + rect.h);
  const above = placement === 'above' ? roomAbove >= 170 || roomAbove > roomBelow : roomBelow < 170 && roomAbove > roomBelow;
  const width = Math.min(300, W - EDGE * 2);
  const centre = rect.x + rect.w / 2;
  const left = Math.min(Math.max(centre - width / 2, EDGE), W - EDGE - width);
  const arrowLeft = Math.min(Math.max(centre - left - ARROW, 16), width - 16 - ARROW * 2);
  const arrow = <View style={[styles.arrow, above ? styles.arrowDown : styles.arrowUp, { marginLeft: arrowLeft }]} />;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dim all round the hole; the hole itself takes taps too (they do nothing) */}
      <View style={[styles.dim, { left: 0, right: 0, top: 0, height: Math.max(0, hole.top) }]} />
      <View style={[styles.dim, { left: 0, right: 0, top: hole.top + hole.height, bottom: 0 }]} />
      <View style={[styles.dim, { left: 0, width: Math.max(0, hole.left), top: hole.top, height: hole.height }]} />
      <View style={[styles.dim, { left: hole.left + hole.width, right: 0, top: hole.top, height: hole.height }]} />
      <View style={[styles.block, hole]} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          hole,
          { borderRadius: radius + PAD, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) },
          { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] },
        ]}
      />
      <View
        style={[
          styles.bubbleWrap,
          { left, width },
          above ? { bottom: H - hole.top + GAP - PAD } : { top: hole.top + hole.height + GAP - PAD },
        ]}
      >
        {!above && arrow}
        {children}
        {above && arrow}
      </View>
    </View>
  );
}

const ARROW = 10;

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  block: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 3, borderColor: colors.primary },
  bubbleWrap: { position: 'absolute' },
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
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 14 },
  later: { paddingVertical: 6 },
  laterText: { color: '#fff', fontWeight: '700', fontSize: 14, opacity: 0.9 },
  ok: { alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 14 },
  okText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDown: { borderTopWidth: ARROW, borderTopColor: colors.primary },
  arrowUp: { borderBottomWidth: ARROW, borderBottomColor: colors.primary },
});
