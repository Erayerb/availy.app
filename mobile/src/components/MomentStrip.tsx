import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, PanResponder, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

import { useSettings } from '../context/SettingsContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { confirmAction } from '../lib/confirm';
import { timeAgo } from '../lib/crowd';
import { momentImage, momentsApi, REPORT_REASONS, timeLeft, type Moment } from '../lib/moments';
import { KEYS } from '../lib/storage';
import { onVenuesChanged } from '../lib/venueEvents';
import { colors, themed } from '../theme';
import { Icon, InlineIcon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

const CARD_W = 92;
const CARD_H = 124;
// Dragging the photo down this far closes it
const CLOSE_DRAG = 120;

const parseSeen = (raw: unknown) => (Array.isArray(raw) ? raw.filter((x): x is number => typeof x === 'number').slice(-300) : []);

type Props = {
  venueId: number;
  token: string | null;
  onOpenUser: (username: string) => void;
  reloadKey?: unknown;
};

/**
 * Venue page: "Şu an burada", the last 24 hours' photos from check-ins; hidden when there are none.
 * Small blurred cards; each photo opens once (like a story), then shows "Görüldü". One's own stay open.
 */
export function MomentStrip({ venueId, token, onOpenUser, reloadKey }: Props) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [open, setOpen] = useState<Moment | null>(null);
  const [seen, setSeen] = usePersistentState<number[]>(KEYS.seenMoments, [], parseSeen);
  const load = useCallback(() => {
    momentsApi.list(venueId, token).then(setMoments).catch(() => {});
  }, [venueId, token]);
  useEffect(load, [load, reloadKey]);
  useEffect(() => onVenuesChanged(load), [load]);
  const { look } = useSettings();

  if (moments.length === 0) return null;
  const now = new Date();
  const fresh = moments.filter((m) => m.mine || !seen.includes(m.id)).length;

  const show = (m: Moment) => {
    setOpen(m);
    if (!m.mine) setSeen((list) => (list.includes(m.id) ? list : [...list, m.id]));
  };

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.live} />
        <Text style={styles.title}>Şu an burada</Text>
        <Text style={styles.muted}>
          · {fresh > 0 ? `${fresh} yeni fotoğraf` : 'hepsini gördün'}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {moments.map((m) => {
          const used = !m.mine && seen.includes(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => show(m)}
              disabled={used}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              accessibilityLabel={used ? 'Görüldü' : 'Fotoğrafı aç'}
            >
              {/* Blurred until opened: a hint of the room, the photo itself once */}
              <Image source={momentImage(m.id, token)} style={styles.cardImage} resizeMode="cover" blurRadius={18} />
              <View style={[styles.shade, used && styles.shadeUsed]} />
              {used ? (
                <View style={styles.center}>
                  <Icon name="eye" size={18} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.usedText}>Görüldü</Text>
                </View>
              ) : (
                <View style={styles.center}>
                  <View style={styles.openRing}>
                    <Icon name="camera" size={18} color="#fff" />
                  </View>
                </View>
              )}
              {m.level && (
                <View style={styles.levelPill}>
                  <View style={[styles.dot, { backgroundColor: look(m.level).color }]} />
                  <Text style={styles.levelText}>{timeAgo(m.created_at, now)}</Text>
                </View>
              )}
              {m.audience === 'friends' && (
                <View style={styles.friendsBadge}>
                  <Icon name="users" size={11} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {open && (
        <Viewer
          moment={open}
          token={token}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            load();
          }}
          onOpenUser={(u) => {
            setOpen(null);
            onOpenUser(u);
          }}
        />
      )}
    </View>
  );
}

/**
 * The venue cover's corner: the live photos as a small fanned stack (blurred) with how many there are.
 * A tap opens the next one not yet seen (each is seen once); one's own always open.
 */
export function MomentStack({ venueId, token, onOpenUser, reloadKey }: Props) {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [open, setOpen] = useState<Moment | null>(null);
  const [seen, setSeen] = usePersistentState<number[]>(KEYS.seenMoments, [], parseSeen);
  const load = useCallback(() => {
    momentsApi.list(venueId, token).then(setMoments).catch(() => {});
  }, [venueId, token]);
  useEffect(load, [load, reloadKey]);
  useEffect(() => onVenuesChanged(load), [load]);

  if (moments.length === 0) return null;
  const next = moments.find((m) => !m.mine && !seen.includes(m.id)) ?? moments.find((m) => m.mine) ?? null;
  const fresh = moments.filter((m) => !m.mine && !seen.includes(m.id)).length;
  const cards = moments.slice(0, 3).reverse();
  const tilt = ['9deg', '-7deg', '0deg'].slice(3 - cards.length);

  return (
    <>
      <Pressable
        onPress={() => {
          if (!next) return;
          setOpen(next);
          if (!next.mine) setSeen((list) => (list.includes(next.id) ? list : [...list, next.id]));
        }}
        disabled={!next}
        style={styles.stack}
        accessibilityLabel={next ? `${moments.length} canlı fotoğraf, aç` : 'Fotoğrafların hepsini gördün'}
      >
        {cards.map((m, i) => (
          <View key={m.id} style={[styles.stackCard, { transform: [{ rotate: tilt[i] }] }]}>
            <Image source={momentImage(m.id, token)} style={styles.stackImage} resizeMode="cover" blurRadius={14} />
          </View>
        ))}
        <View style={styles.stackBadge} pointerEvents="none">
          <Icon name={next ? 'camera' : 'eye'} size={12} color="#fff" />
          <Text style={styles.stackBadgeText}>{next ? fresh || moments.length : 'Görüldü'}</Text>
        </View>
      </Pressable>
      {open && (
        <Viewer
          moment={open}
          token={token}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            load();
          }}
          onOpenUser={(u) => {
            setOpen(null);
            onOpenUser(u);
          }}
        />
      )}
    </>
  );
}

/** Full screen; a tap or a drag down closes it. The author deletes, others report. */
function Viewer({
  moment,
  token,
  onClose,
  onChanged,
  onOpenUser,
}: {
  moment: Moment;
  token: string | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenUser: (username: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { look } = useSettings();
  const now = new Date();
  // How much of its 24 hours is left: the thin bar at the top
  // How much of its life is left (until an hour after the venue closes)
  const life = new Date(moment.expires_at).getTime() - new Date(moment.created_at).getTime();
  const left = life > 0 ? Math.max(0, (new Date(moment.expires_at).getTime() - now.getTime()) / life) : 0;

  // While a photo is open: no screenshots or screen recordings (Android; iOS 13+). A browser cannot stop them.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenCapture.preventScreenCaptureAsync('moment').catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync('moment').catch(() => {});
    };
  }, []);

  const drag = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > CLOSE_DRAG || g.vy > 1.2) {
          Animated.timing(drag, { toValue: height, duration: 180, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;
  const fade = drag.interpolate({ inputRange: [0, 300], outputRange: [1, 0.3], extrapolate: 'clamp' });

  const remove = () => {
    if (!token) return;
    confirmAction('Fotoğrafı sil', 'Bu fotoğraf mekan sayfasından kaldırılsın mı?', 'Sil', () => {
      momentsApi.remove(token, moment.id).catch(() => {}).finally(onChanged);
    });
  };

  const report = async (reason: (typeof REPORT_REASONS)[number]['id']) => {
    if (!token) return;
    try {
      await momentsApi.report(token, moment.id, reason);
      setNote('Teşekkürler, bildirimin alındı. İncelenene kadar fotoğraf gizlenebilir.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Bildirilemedi.');
    }
    setReporting(false);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.viewer, { opacity: fade }]}>
        <Animated.View style={{ flex: 1, transform: [{ translateY: drag }] }} {...pan.panHandlers}>
          {/* A tap on the photo closes it too */}
          <Pressable onPress={onClose} accessibilityLabel="Fotoğrafı kapat">
            <Image source={momentImage(moment.id, token)} style={{ width, height }} resizeMode="contain" />
          </Pressable>

          <View style={styles.top}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${left * 100}%` }]} />
            </View>
            <View style={styles.topRow}>
              <Pressable disabled={!moment.username} onPress={() => moment.username && onOpenUser(moment.username)} style={styles.flex}>
                <Text style={styles.author}>{moment.username ? `@${moment.username}` : 'Bir ziyaretçi'}</Text>
                <Text style={styles.meta}>
                  {timeLeft(moment.expires_at, now)} sonra silinir{moment.audience === 'friends' ? ' · sadece arkadaşlar' : ''}
                </Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={14} accessibilityLabel="Kapat">
                <Icon name="x" size={26} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.bottom}>
            {note && <Text style={styles.note}>{note}</Text>}
            {reporting ? (
              <View style={styles.reasons}>
                {REPORT_REASONS.map((r) => (
                  <Pressable key={r.id} onPress={() => report(r.id)} style={styles.reason}>
                    <Text style={styles.reasonText}>{r.label}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setReporting(false)} style={styles.reason}>
                  <Text style={[styles.reasonText, styles.cancel]}>Vazgeç</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.bottomRow}>
                {/* Bottom left: the crowd at that moment and how long ago */}
                {moment.level ? (
                  <View style={styles.levelBig}>
                    <View style={[styles.dot, { backgroundColor: look(moment.level).color }]} />
                    <Text style={styles.levelBigText}>
                      {look(moment.level).label} · {timeAgo(moment.created_at, now)}
                    </Text>
                  </View>
                ) : (
                  <View />
                )}
                {moment.mine ? (
                  <Pressable onPress={remove} style={styles.action}>
                    <Text style={styles.actionText}><InlineIcon name="trash" /> Sil</Text>
                  </Pressable>
                ) : token ? (
                  <Pressable onPress={() => setReporting(true)} style={styles.action}>
                    <Text style={styles.actionText}>Şikâyet et</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  stack: { width: 64, height: 84 },
  stackCard: { position: 'absolute', top: 0, left: 0, width: 64, height: 84, borderRadius: 10, borderWidth: 2, borderColor: '#fff', overflow: 'hidden', backgroundColor: '#444' },
  stackImage: { width: '100%', height: '100%' },
  stackBadge: { position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)' },
  stackBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  section: { gap: 8, marginTop: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  row: { gap: 8, paddingRight: 8 },
  card: { width: CARD_W, height: CARD_H, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.cream },
  pressed: { opacity: 0.8 },
  cardImage: { width: CARD_W, height: CARD_H },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  shadeUsed: { backgroundColor: 'rgba(0,0,0,0.55)' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 4 },
  openRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  usedText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  levelPill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  levelText: { fontSize: 10.5, fontWeight: '700', color: '#fff' },
  friendsBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 54, left: 14, right: 14, gap: 10 },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: '#fff' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  author: { fontSize: 15, fontWeight: '700', color: '#fff' },
  meta: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  bottom: { position: 'absolute', left: 14, right: 14, bottom: 40, gap: 10 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  levelBig: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  levelBigText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  note: { fontSize: 13, color: '#fff' },
  action: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)' },
  actionText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  reasons: { borderRadius: 14, backgroundColor: 'rgba(30,30,30,0.95)', overflow: 'hidden' },
  reason: { paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  reasonText: { fontSize: 15, color: '#fff' },
  cancel: { color: 'rgba(255,255,255,0.6)' },
}));
