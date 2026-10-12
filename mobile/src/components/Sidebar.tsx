import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { isBusiness, type User } from '../lib/auth';
import { Wordmark } from './Wordmark';
import { colors } from '../theme';

export type Screen =
  | 'home'
  | 'business'
  | 'map'
  | 'favorites'
  | 'explore'
  | 'campaigns'
  | 'profile'
  | 'settings'
  | 'about'
  | 'detail';

const WIDTH = 270;

const ITEMS: { screen: Screen; label: string }[] = [
  { screen: 'home', label: 'Ana Sayfa' },
  { screen: 'map', label: 'Harita' },
  { screen: 'explore', label: 'Keşfet' },
  { screen: 'favorites', label: 'Favoriler' },
  { screen: 'campaigns', label: 'Kampanyalar ve Sadakat' },
  { screen: 'profile', label: 'Profil' },
  { screen: 'about', label: 'Hakkında' },
];

type Props = {
  open: boolean;
  current: Screen;
  user: User | null;
  onSelect: (screen: Screen) => void;
  onLogin: () => void;
  onLogout: () => void;
  onClose: () => void;
};

export function Sidebar({ open, current, user, onSelect, onLogin, onLogout, onClose }: Props) {
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
        <View style={styles.brand}>
          <Wordmark size={34} />
        </View>
        <Text style={styles.greeting}>
          {user
            ? `Merhaba, ${user.name}${isBusiness(user) ? ' (İşletme)' : ''}`
            : 'Misafir olarak geziyorsun'}
        </Text>

        <View style={styles.items}>
          {(isBusiness(user)
            ? [
                ITEMS[0],
                { screen: 'business' as Screen, label: 'İşletme Paneli' },
                { screen: 'profile' as Screen, label: 'İşletme Profili' },
                ...ITEMS.slice(1).filter((item) => item.screen !== 'profile'),
              ]
            : ITEMS
          ).map(({ screen, label }) => (
            <Pressable
              key={screen}
              onPress={() => onSelect(screen)}
              style={[styles.item, current === screen && styles.itemActive]}
            >
              <Text style={[styles.itemText, current === screen && styles.itemTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={() => onSelect('settings')}
            style={[styles.item, current === 'settings' && styles.itemActive]}
          >
            <Text style={[styles.itemText, current === 'settings' && styles.itemTextActive]}>Ayarlar</Text>
          </Pressable>
          {user ? (
            <Pressable onPress={onLogout} style={styles.item}>
              <Text style={styles.logout}>Çıkış Yap</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onLogin} style={styles.login}>
              <Text style={styles.loginText}>Giriş Yap</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.backdrop },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    backgroundColor: colors.background,
    paddingTop: 70,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  brand: { paddingHorizontal: 12 },
  greeting: { fontSize: 14, color: colors.textMuted, paddingHorizontal: 12, marginTop: 4, marginBottom: 20 },
  items: { gap: 4 },
  item: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  itemActive: { backgroundColor: colors.cream },
  itemText: { fontSize: 16, color: colors.text },
  itemTextActive: { fontWeight: '600', color: colors.text },
  footer: { marginTop: 'auto', gap: 8 },
  login: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  loginText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
  logout: { fontSize: 16, color: colors.danger },
});
