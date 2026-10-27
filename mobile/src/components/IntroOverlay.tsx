import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { useSettings } from '../context/SettingsContext';
import type { Role } from '../lib/auth';
import { BUSINESS_SLIDES, CUSTOMER_SLIDES } from '../lib/intro';
import { LEVELS } from '../lib/occupancy';
import { colors, themed } from '../theme';
import { LevelDot } from './LevelDot';

const SWIPE = 50;

/** Skippable how-to slides, shown right after an account is created (same text as the Hakkında page). */
export function IntroOverlay({ role, onDone }: { role: Role; onDone: () => void }) {
  const slides = role === 'business' ? BUSINESS_SLIDES : CUSTOMER_SLIDES;
  const [index, setIndex] = useState(0);
  const { look } = useSettings();
  const slide = slides[index];
  const last = index === slides.length - 1;

  // Swipe left: next slide, swipe right: back (the buttons still work)
  const count = useRef(slides.length);
  count.current = slides.length;
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          if (g.dx < -SWIPE) setIndex((i) => Math.min(i + 1, count.current - 1));
          else if (g.dx > SWIPE) setIndex((i) => Math.max(i - 1, 0));
        },
      }),
    [],
  );

  return (
    <View style={styles.overlay}>
      <Pressable onPress={onDone} hitSlop={12} style={styles.skip}>
        <Text style={styles.skipText}>Atla</Text>
      </Pressable>

      <View style={styles.body} {...swipe.panHandlers}>
        <Text style={styles.icon}>{slide.icon}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        {slide.lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
        {slide.legend && (
          <View style={styles.legend}>
            {LEVELS.map((level) => (
              <View key={level} style={styles.legendItem}>
                <LevelDot level={level} size={16} />
                <Text style={styles.legendText}>{look(level).label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.buttons}>
          {index > 0 && (
            <Pressable style={[styles.secondary, styles.flex]} onPress={() => setIndex(index - 1)}>
              <Text style={styles.secondaryText}>Geri</Text>
            </Pressable>
          )}
          <Pressable style={[styles.primary, styles.flex]} onPress={() => (last ? onDone() : setIndex(index + 1))}>
            <Text style={styles.primaryText}>{last ? 'Başla' : 'İleri'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 44,
  },
  skip: { alignSelf: 'flex-end' },
  skipText: { fontSize: 15, color: colors.textMuted },
  body: { flex: 1, justifyContent: 'center', gap: 14 },
  icon: { fontSize: 56, textAlign: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  line: { fontSize: 16, lineHeight: 23, color: colors.text, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 14, color: colors.text },
  footer: { gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 22, backgroundColor: colors.primary },
  buttons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primary: { paddingVertical: 15, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  secondary: { paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
}));
