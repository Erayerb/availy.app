import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { userPhotoUrl } from '../lib/userPhoto';
import { colors, themed } from '../theme';

type Props = {
  username: string | null;
  size?: number;
  // The person's photo_at when known: a new photo then shows up at once
  version?: string | null;
};

/** A person's profile photo, or the first letter of their user name when they have none. */
export function Avatar({ username, size = 38, version }: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const uri = username ? userPhotoUrl(username, version) : null;
  if (uri && failed !== uri) {
    return <Image source={{ uri }} style={[circle, styles.image]} onError={() => setFailed(uri)} />;
  }
  return (
    <View style={[circle, styles.letter]}>
      <Text style={[styles.letterText, { fontSize: size * 0.42 }]}>{(username ?? '?').slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  image: { backgroundColor: colors.cream },
  letter: { backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontWeight: '800', color: colors.primary },
}));
