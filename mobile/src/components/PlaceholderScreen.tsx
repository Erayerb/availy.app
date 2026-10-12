import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = { title: string; text: string };

export function PlaceholderScreen({ title, text }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      <Text style={styles.badge}>Yakında</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 130, paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  text: { fontSize: 16, color: colors.text, lineHeight: 22 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.cream,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
