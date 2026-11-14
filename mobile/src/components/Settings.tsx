import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, themed } from '../theme';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { ThemedSwitch } from './ThemedSwitch';

// Row icon colours, the same family as the venue cards and the Daha fazla menu
export const TINT = {
  blue: '#2F6AA3',
  red: '#C8102E',
  orange: '#D9480F',
  gold: '#C9962B',
  green: '#2E9E4F',
  purple: '#7B5EA7',
  grey: '#6B7280',
  dark: '#3A3F47',
} as const;

/** A titled group of rows on one card, iOS settings style; `footer` explains it under the card. */
export function SettingsSection({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.card}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 && <View style={styles.divider} />}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

type RowBase = { icon?: IconName; tint?: string; title: string; subtitle?: ReactNode; disabled?: boolean };

function RowIcon({ icon, tint }: { icon?: IconName; tint?: string }) {
  if (!icon) return null;
  return (
    <View style={[styles.iconBox, { backgroundColor: tint ?? TINT.grey }]}>
      <Icon name={icon} size={16} color="#fff" />
    </View>
  );
}

/** A setting turned on or off. */
export function SettingsSwitch({ icon, tint, title, subtitle, disabled, value, onChange }: RowBase & { value: boolean; onChange?: (value: boolean) => void }) {
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <RowIcon icon={icon} tint={tint} />
      <View style={styles.text}>
        <Text style={styles.label}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <ThemedSwitch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

/** A row that opens something or picks an option: the current value and › (or ✓ when `selected`). */
export function SettingsLink({
  icon,
  tint,
  title,
  subtitle,
  disabled,
  value,
  selected,
  danger,
  onPress,
}: RowBase & { value?: string; selected?: boolean; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityState={selected !== undefined ? { selected } : undefined}
    >
      <RowIcon icon={icon} tint={tint} />
      <View style={styles.text}>
        <Text style={[styles.label, danger && styles.danger]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {selected !== undefined ? (
        selected ? <Icon name="check" size={18} color={colors.primary} /> : null
      ) : (
        !danger && <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

/** Free content inside a section card (a form, a note), padded like a row. */
export function SettingsBlock({ children }: { children: ReactNode }) {
  return <View style={styles.block}>{children}</View>;
}

const styles = themed(() => StyleSheet.create({
  section: { gap: 7 },
  title: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginLeft: 14 },
  card: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 56 },
  footer: { fontSize: 12.5, lineHeight: 17, color: colors.textMuted, marginHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 52 },
  pressed: { backgroundColor: colors.cream },
  disabled: { opacity: 0.5 },
  iconBox: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 16, fontWeight: '500', color: colors.text },
  subtitle: { fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  value: { fontSize: 14, color: colors.textMuted, maxWidth: 140 },
  chevron: { fontSize: 22, color: colors.placeholder },
  danger: { color: colors.danger, fontWeight: '600' },
  block: { padding: 14, gap: 10 },
}));
