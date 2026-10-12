import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Availy</Text>
      <Text style={styles.text}>
        Kafe, bar ve co-working gibi mekanların anlık doluluğunu harita üzerinde gösterir.
      </Text>
      <Text style={styles.note}>
        Prototip sürüm: mekanlar ve doluluk oranları örnek (sahte) verilerdir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 130, paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  text: { fontSize: 16, color: colors.text, lineHeight: 22 },
  note: { fontSize: 14, color: colors.textMuted },
});
