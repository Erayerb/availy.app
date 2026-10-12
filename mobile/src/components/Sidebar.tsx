import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

export type Screen = 'home' | 'map' | 'explore' | 'campaigns' | 'about';

const WIDTH = 260;

const ITEMS: { screen: Screen; label: string }[] = [
  { screen: 'home', label: 'Ana Sayfa' },
  { screen: 'map', label: 'Harita' },
  { screen: 'explore', label: 'Keşfet' },
  { screen: 'campaigns', label: 'Kampanyalar' },
  { screen: 'about', label: 'Hakkında' },
];

type Props = {
  open: boolean;
  current: Screen;
  onSelect: (screen: Screen) => void;
  onClose: () => void;
};

export function Sidebar({ open, current, onSelect, onClose }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-WIDTH, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <Text style={styles.brand}>Availy</Text>
        {ITEMS.map(({ screen, label }) => (
          <Pressable
            key={screen}
            onPress={() => onSelect(screen)}
            style={[styles.item, current === screen && styles.itemActive]}
          >
            <Text style={[styles.itemText, current === screen && styles.itemTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    backgroundColor: '#fff',
    paddingTop: 70,
    paddingHorizontal: 16,
    gap: 4,
  },
  brand: { fontSize: 24, fontWeight: '700', marginBottom: 20, paddingHorizontal: 12 },
  item: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  itemActive: { backgroundColor: '#f1f3f5' },
  itemText: { fontSize: 16, color: '#333' },
  itemTextActive: { fontWeight: '600', color: '#111' },
});
