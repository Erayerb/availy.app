import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';

import { colors, themed } from '../theme';

type Props = {
  title: string;
  // Shown under the title while closed: what is inside
  summary?: string;
  // Small text at the right of the title (e.g. "İzin verildi")
  badge?: ReactNode;
  initiallyOpen?: boolean;
  // A coloured icon square at the left, like the settings rows
  icon?: IconName;
  tint?: string;
  children: ReactNode;
};

/** A card that opens when its title is tapped. */
export function Collapsible({ title, summary, badge, initiallyOpen = false, icon, tint, children }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        {icon && (
          <View style={[styles.iconBox, { backgroundColor: tint ?? '#6B7280' }]}>
            <Icon name={icon} size={16} color="#fff" />
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          {!open && summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        {badge}
        <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  summary: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 22, lineHeight: 24, color: colors.placeholder },
  body: { gap: 8, marginTop: 12 },
}));
