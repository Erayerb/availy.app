import { StyleSheet, View } from 'react-native';

import { PASSWORD_RULES } from '../lib/auth';
import { colors, themed } from '../theme';
import { InlineIcon } from './Icon';
import { Text } from './Text';

/** Under a new password: what it needs, each ticked as it is met. */
export function PasswordRules({ password }: { password: string }) {
  return (
    <View style={styles.row} accessibilityLabel="Şifre kuralları">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.ok(password);
        return (
          <Text key={rule.label} style={[styles.rule, ok && styles.ok]}>
            <InlineIcon name={ok ? 'circle-check' : 'circle'} /> {rule.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -2 },
  rule: { fontSize: 12.5, color: colors.textMuted, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.cream, overflow: 'hidden' },
  ok: { color: colors.success, fontWeight: '700' },
}));
