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
  // Semt elçisi: a gold frame around the photo
  framed?: boolean;
  // availo+: the frame colour the person chose (wins over the gold one)
  frameColor?: string | null;
};

// availo+ frame colours (the names the server keeps)
export const FRAME_COLORS: Record<string, string> = {
  gold: '#C9962B',
  red: '#C8102E',
  blue: '#2F6AA3',
  green: '#2E9E4F',
  purple: '#7B5EA7',
  pink: '#D6487E',
};

/** A person's profile photo, or the first letter of their user name when they have none. */
export function Avatar({ username, size = 38, version, framed = false, frameColor = null }: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  const chosen = frameColor ? FRAME_COLORS[frameColor] : undefined;
  const circle = [
    { width: size, height: size, borderRadius: size / 2 },
    framed && styles.frame,
    chosen && { borderWidth: 3, borderColor: chosen },
  ];
  const uri = username ? userPhotoUrl(username, version) : null;
  if (uri && failed !== uri) {
    return <Image source={{ uri }} style={[...circle, styles.image]} onError={() => setFailed(uri)} />;
  }
  return (
    <View style={[...circle, styles.letter]}>
      <Text style={[styles.letterText, { fontSize: size * 0.42 }]}>{(username ?? '?').slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  frame: { borderWidth: 2.5, borderColor: colors.gold },
  image: { backgroundColor: colors.cream },
  letter: { backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontWeight: '800', color: colors.primary },
}));
