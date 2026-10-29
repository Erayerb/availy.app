import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors, themed } from '../theme';
import { Icon, type IconName } from './Icon';

const SPARKS = 10;

/** Right after a check-in: the icon pops in and small dots burst out around it once. */
export function Celebration({ icon, first }: { icon: IconName; first: boolean }) {
  const pop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [pop, burst]);

  const sparkColors = first ? [colors.discovery, colors.gold] : [colors.primary, colors.gold];
  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: SPARKS }, (_, i) => {
        const angle = (i / SPARKS) * Math.PI * 2;
        const distance = 38 + (i % 3) * 8;
        return (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              {
                backgroundColor: sparkColors[i % 2],
                opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] }) },
                  { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance] }) },
                  { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
                ],
              },
            ]}
          />
        );
      })}
      <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
        <Icon name={icon} size={48} color={first ? colors.discovery : colors.primary} />
      </Animated.View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { width: 120, height: 90, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
}));
