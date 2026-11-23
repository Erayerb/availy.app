import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { GradientFill } from './GradientFill';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type StoryPage = {
  key: string;
  icon: IconName;
  colors: [string, string];
  kicker: string; // small line on top ("Kasım 2026")
  big: string; // the number or the headline
  title: string;
  lines?: string[];
  onPress?: () => void; // e.g. open the venue
};

// Pulled down this far (or flung down), the pages close
const CLOSE_DRAG = 120;

/** "Aylık özet" as full-screen coloured pages swiped in order (like a story), with dots and ✕; pulled down,
 * it closes. */
export function SummaryStory({ visible, pages, onClose }: { visible: boolean; pages: StoryPage[]; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const drag = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);
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
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={64}
        >
          {pages.map((p) => (
            <Pressable key={p.key} style={[styles.page, { width }]} onPress={p.onPress} disabled={!p.onPress}>
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
          {page < pages.length - 1 ? 'Yana kaydır → · kapatmak için aşağı çek' : 'Kapatmak için aşağı çek'}
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
  hint: { position: 'absolute', bottom: 48, alignSelf: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
});
