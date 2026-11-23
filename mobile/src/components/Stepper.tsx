import { StyleSheet, View } from 'react-native';

import { colors, themed } from '../theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Props = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  // Uneven steps instead (10, 20 … 100, 150, 200 …): − and + go to the neighbouring value
  steps?: readonly number[];
  format?: (value: number) => string; // "%20", "200 puan"
  label?: string; // for screen readers
};

/** − value + : picks a number in steps (a campaign's discount, a coupon's points). */
export function Stepper({ value, onChange, min, max, step, steps, format = String, label }: Props) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  const down = () => (steps ? set([...steps].reverse().find((s) => s < value) ?? min) : set(value - step));
  const up = () => (steps ? set(steps.find((s) => s > value) ?? max) : set(value + step));
  return (
    <View style={styles.row} accessibilityLabel={label}>
      <Pressable
        style={[styles.button, value <= min && styles.off]}
        onPress={down}
        disabled={value <= min}
        hitSlop={6}
        accessibilityLabel={`${label ?? ''} azalt`}
      >
        <Icon name="minus" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.value}>{format(value)}</Text>
      <Pressable
        style={[styles.button, value >= max && styles.off]}
        onPress={up}
        disabled={value >= max}
        hitSlop={6}
        accessibilityLabel={`${label ?? ''} artır`}
      >
        <Icon name="plus" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  value: { minWidth: 92, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
}));
