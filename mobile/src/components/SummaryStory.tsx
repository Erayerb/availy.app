import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';

import { GradientFill } from './GradientFill';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useHoldTips } from '../lib/tips';

export type StoryPage = {
  key: string;
  icon: IconName;
  colors: [string, string];
  kicker: string; // small line on top ("Kasım 2026")
  big: string; // the number or the headline
  title: string;
  lines?: string[];
  onPress?: () => void; // e.g. open the venue: a button on the page
  actionLabel?: string; // that button's words ("Mekanı aç")
};

// Pulled down this far (or flung down), the pages close
const CLOSE_DRAG = 120;

/** "Aylık özet" as full-screen coloured pages in order (like a story), with dots and ✕: a tap on the right half
 * goes on (past the last one it closes), on the left half back; swiping sideways works too; pulled down, it
 * closes. */
export function SummaryStory({ visible, pages, onClose }: { visible: boolean; pages: StoryPage[]; onClose: () => void }) {
  useHoldTips(visible);
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const drag = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!visible) return;
    drag.setValue(0);
    setPage(0);
  }, [visible, drag]);
  const goTo = (next: number) => {
    if (next >= pages.length) return onClose();
    const to = Math.max(0, next);
    scroll.current?.scrollTo({ x: to * width, animated: true });
    setPage(to);
  };
  const pan = useRef(
    PanResponder.create({
      // Only a mostly downward drag: sideways swipes still turn the pages
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && g.dy > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_DRAG || g.vy > 1.2) {
          Animated.timing(drag, { toValue: height, duration: 180, useNativeDriver: true }).start(() => close.current());
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View
        style={[
          styles.root,
          { transform: [{ translateY: drag }], opacity: drag.interpolate({ inputRange: [0, height], outputRange: [1, 0.3] }) },
        ]}
        {...pan.panHandlers}
      >
        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={64}
        >
          {pages.map((p) => (
            <Pressable
              key={p.key}
              style={[styles.page, { width, height }]}
              onPress={(e) => goTo(e.nativeEvent.pageX < width / 2 ? page - 1 : page + 1)}
              accessibilityHint="Sağa dokun: ileri, sola dokun: geri"
            >
              <GradientFill colors={p.colors} />
              <View style={styles.badge}>
                <Icon name={p.icon} size={44} color="#fff" />
              </View>
              <Text style={styles.kicker}>{p.kicker}</Text>
              <Text style={styles.big} adjustsFontSizeToFit numberOfLines={2}>
                {p.big}
              </Text>
              <Text style={styles.title}>{p.title}</Text>
              {p.lines?.map((line) => (
                <Text key={line} style={styles.line}>
                  {line}
                </Text>
              ))}
              {p.onPress && (
                <Pressable style={styles.action} onPress={p.onPress} hitSlop={8}>
                  <Text style={styles.actionText}>{p.actionLabel ?? 'Aç'} ›</Text>
                </Pressable>
              )}
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.dots} pointerEvents="none">
          {pages.map((p, i) => (
            <View key={p.key} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <Pressable style={styles.close} onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
          <Icon name="x" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.hint} pointerEvents="none">
          {page < pages.length - 1 ? 'İleri için sağa, geri için sola dokun · aşağı çek: kapat' : 'Sağa dokun ya da aşağı çek: kapat'}
        </Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', borderRadius: 18, overflow: 'hidden' },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, overflow: 'hidden' },
  badge: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kicker: { fontSize: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' },
  big: { fontSize: 64, fontWeight: '900', color: '#fff', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  line: { fontSize: 16, color: 'rgba(255,255,255,0.92)', textAlign: 'center', lineHeight: 23 },
  dots: { position: 'absolute', top: 56, left: 16, right: 16, flexDirection: 'row', gap: 4 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { backgroundColor: '#fff' },
  close: { position: 'absolute', top: 72, right: 18 },
  action: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)' },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hint: { position: 'absolute', bottom: 48, alignSelf: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
});
