import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, PanResponder, Platform, StyleSheet, View } from 'react-native';

import { PageContext } from '../context/PageContext';
import { haptics } from '../lib/haptics';

const EDGE = 28; // the swipe starts this close to the left edge
const SHARE_TO_GO_BACK = 0.3; // of the screen's width
const SPEED_TO_GO_BACK = 0.6;
const ENTER_FROM = 36; // a newly opened page slides in from this far
const ENTER_MS = 170;
const NATIVE = Platform.OS !== 'web';
const OFF_SCREEN = { transform: [{ translateX: 100_000 }], opacity: 0 };

export type Page = { key: string; element: ReactNode };

type Props = {
  pages: Page[];
  activeKey: string;
  backKey: string | null; // the page a swipe goes back to
  swipeEnabled: boolean;
  depth: number; // how many pages are behind: growing means a page was opened
  topTick: number; // grows when the tab of the open page is tapped again
  onBack: () => void;
};

/**
 * All open pages, one on top: the others stay mounted, off the screen, with their scroll position and
 * data. Swiping from the left edge goes back with the real page showing underneath.
 */
export function ScreenStack({ pages, activeKey, backKey, swipeEnabled, depth, topTick, onBack }: Props) {
  const x = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ swipeEnabled, onBack });
  latest.current = { swipeEnabled, onBack };

  const lastDepth = useRef(depth);
  const slideIn = depth > lastDepth.current && swipeEnabled;
  useLayoutEffect(() => {
    lastDepth.current = depth;
    // The page behind took over during this commit: nothing moves any more
    x.setValue(0);
    setDragging(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const responder = useRef(
    PanResponder.create({
      // Before the page's own scrolling: only a sideways move that began at the edge
      onMoveShouldSetPanResponderCapture: (_, g) =>
        latest.current.swipeEnabled && g.x0 <= EDGE && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        const width = Dimensions.get('window').width;
        if (g.dx > width * SHARE_TO_GO_BACK || g.vx > SPEED_TO_GO_BACK) {
          Animated.timing(x, { toValue: width, duration: 140, useNativeDriver: false }).start(() => {
            haptics.tap();
            latest.current.onBack();
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(() => setDragging(false));
        }
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(() => setDragging(false)),
    }),
  ).current;

  return (
    <View style={styles.stack} {...responder.panHandlers}>
      {pages.map(({ key, element }) => {
        const active = key === activeKey;
        const under = dragging && key === backKey;
        return (
          <PageView key={key} active={active} under={under} x={x} slideIn={active && slideIn} topTick={topTick}>
            {element}
          </PageView>
        );
      })}
    </View>
  );
}

type PageProps = { active: boolean; under: boolean; x: Animated.Value; slideIn: boolean; topTick: number; children: ReactNode };

/** A page that is not on top does not render again with the app; it keeps its own state and timers. */
const PageView = memo(
  function PageView({ active, under, x, slideIn, topTick, children }: PageProps) {
    const enterX = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(1)).current;
    const seenTick = useRef(topTick);
    const wasActive = useRef(active);
    const ownTop = useRef(0);
    // A tap on the tab counts for the page on top only
    if (active && topTick !== seenTick.current) ownTop.current += 1;
    seenTick.current = topTick;

    useLayoutEffect(() => {
      if (active && !wasActive.current && slideIn) {
        enterX.setValue(ENTER_FROM);
        fade.setValue(0.5);
        // On the native side: the page may be being built on the JS side at the same moment
        Animated.parallel([
          Animated.timing(enterX, { toValue: 0, duration: ENTER_MS, useNativeDriver: NATIVE }),
          Animated.timing(fade, { toValue: 1, duration: ENTER_MS, useNativeDriver: NATIVE }),
        ]).start();
      }
      wasActive.current = active;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    const focus = useMemo(() => ({ focused: active, topTick: ownTop.current }), [active, ownTop.current]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
      <Animated.View
        pointerEvents={active ? 'auto' : 'none'}
        accessibilityElementsHidden={!active}
        importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        style={[StyleSheet.absoluteFill, active ? { zIndex: 2, transform: [{ translateX: x }] } : under ? { zIndex: 1 } : OFF_SCREEN]}
      >
        <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateX: enterX }] }}>
          <PageContext.Provider value={focus}>{children}</PageContext.Provider>
        </Animated.View>
      </Animated.View>
    );
  },
  (a, b) => !a.active && !b.active && a.under === b.under,
);

const styles = StyleSheet.create({ stack: { flex: 1 } });
