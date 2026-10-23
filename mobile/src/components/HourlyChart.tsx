import { StyleSheet, Text, View } from 'react-native';

import type { HourlyPoint } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { colors, themed } from '../theme';

const HEIGHT = 110;

/** 24 bars, one per hour, colored by occupancy level; the current hour is outlined. */
export function HourlyChart({ hours, currentHour }: { hours: HourlyPoint[]; currentHour: number }) {
  const { look } = useSettings();
  return (
    <View>
      <View style={styles.bars}>
        {hours.map((h) => (
          <View key={h.hour} style={styles.slot}>
            <View
              style={[
                styles.bar,
                { height: h.open ? Math.max(3, h.ratio * HEIGHT) : 3, backgroundColor: look(h.level, h.open).color },
                h.hour === currentHour && styles.current,
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {[0, 6, 12, 18, 23].map((hour) => (
          <Text key={hour} style={styles.label}>
            {String(hour).padStart(2, '0')}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  bars: { height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 3 },
  current: { borderWidth: 2, borderColor: colors.text },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  label: { fontSize: 11, color: colors.textMuted },
}));
