import { StyleSheet } from 'react-native';

import { colors, themed } from '../../theme';

/** Shared look for the business panel sections. */
export const panel = themed(() => StyleSheet.create({
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  error: { color: colors.danger, fontSize: 14 },
  success: { color: colors.success, fontSize: 14, fontWeight: '600' },
  primary: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  secondary: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
}));
