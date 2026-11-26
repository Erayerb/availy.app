import type { ReactNode } from 'react';
import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { Text } from '../Text';
import { Pressable } from '../Pressable';
import { Icon } from '../Icon';
import { colors, isDarkScheme, themed } from '../../theme';

type Props = {
  title: ReactNode; // the panel's title row, shown sharp above the blur
  children: ReactNode; // sample content (never the venue's real numbers), shown blurred
  onUpgrade: () => void;
};

/** A panel that is in the Aylık paket, on the free plan: the panel is there, its content blurred under a lock. */
export function LockedPreview({ title, children, onUpgrade }: Props) {
  const target = useRef<ComponentRef<typeof View>>(null);
  return (
    <View style={styles.card}>
      {title}
      <View style={styles.body}>
        <BlurTargetView ref={target} style={styles.sample} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          {children}
        </BlurTargetView>
        <BlurView
          intensity={28}
          tint={isDarkScheme() ? 'dark' : 'light'}
          blurTarget={target}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={styles.overlay} onPress={onUpgrade} accessibilityRole="button" accessibilityLabel="Aylık pakete dahil. Aylık paket'e geç">
          <View style={styles.badge}>
            <Icon name="lock" size={14} color={colors.onPrimary} />
            <Text style={styles.badgeText}>Aylık pakete dahil</Text>
          </View>
          <Text style={styles.link}>Aylık paket'e geç ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
    body: { borderRadius: 12, overflow: 'hidden' },
    sample: { gap: 10, padding: 2 },
    overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 8 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    badgeText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
    link: { color: colors.text, fontSize: 13, fontWeight: '600' },
  }),
);
