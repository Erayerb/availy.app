import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pressable } from './Pressable';

import { colors, themed } from '../theme';

type Props = {
  title: string;
  // Shown under the title while closed: what is inside
  summary?: string;
  // Small text at the right of the title (e.g. "İzin verildi")
  badge?: ReactNode;
  initiallyOpen?: boolean;
  children: ReactNode;
};

/** A card that opens when its title is tapped. */
export function Collapsible({ title, summary, badge, initiallyOpen = false, children }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          {!open && summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        {badge}
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  summary: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 11, color: colors.textMuted },
  body: { gap: 8, marginTop: 12 },
}));
