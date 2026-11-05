import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isOnline, onConnectionChange } from '../lib/connection';
import { colors, themed } from '../theme';
import { Text } from './Text';

/** Over the page while the server cannot be reached; it goes by itself with the next answer. */
export function OfflineBar() {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => onConnectionChange(setOnline), []);
  if (online) return null;
  return (
    <View style={styles.bar} pointerEvents="none">
      <Text style={styles.text}>İnternet yok. Bilgiler güncel olmayabilir.</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingTop: 50, paddingBottom: 8, alignItems: 'center', backgroundColor: colors.danger },
  text: { color: colors.white, fontSize: 13, fontWeight: '700' },
}));
