import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';

import { colors, themed } from '../theme';

/** A softly pulsing grey block where content is still loading (instead of "Yükleniyor…"). */
export function Skeleton({ width = '100%', height, radius = 10, style }: { width?: DimensionValue; height: number; radius?: number; style?: ViewStyle }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.block, { width, height, borderRadius: radius, opacity: pulse }, style]} />;
}

/** Placeholder venue tiles for the home grid: photo square and a name line. */
export function TileSkeleton({ size }: { size: number }) {
  return (
    <View style={{ width: size, gap: 8 }}>
      <Skeleton width={size} height={Math.round(size * 0.78)} radius={16} />
      <Skeleton width={size * 0.7} height={14} />
    </View>
  );
}

/** Placeholder feed post: round icon and two text lines. */
export function PostSkeleton() {
  return (
    <View style={styles.post}>
      <Skeleton width={30} height={30} radius={15} />
      <View style={styles.lines}>
        <Skeleton width="45%" height={12} />
        <Skeleton width="70%" height={16} />
        <Skeleton width="90%" height={12} />
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  block: { backgroundColor: colors.cream },
  post: { flexDirection: 'row', gap: 12, paddingBottom: 20 },
  lines: { flex: 1, gap: 8 },
}));
