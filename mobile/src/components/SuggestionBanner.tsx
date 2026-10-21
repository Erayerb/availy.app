import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Suggestion } from '../hooks/useCheckinSuggestion';
import { suggestionText } from '../lib/suggestion';
import { colors } from '../theme';

type Props = { suggestion: Suggestion; onCheckin: () => void; onClose: () => void };

/** In-app check-in suggestion at the top of the screen. */
export function SuggestionBanner({ suggestion, onCheckin, onClose }: Props) {
  const { title, body } = suggestionText(suggestion.venue.name, suggestion.visits);
  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>📍</Text>
      <View style={styles.flex}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <Pressable style={styles.button} onPress={onCheckin}>
        <Text style={styles.buttonText}>Check-in</Text>
      </Pressable>
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 54,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 50,
  },
  icon: { fontSize: 22 },
  flex: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textMuted },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.primary },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  close: { fontSize: 16, color: colors.textMuted },
});
