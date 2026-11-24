import { type ReactNode, startTransition, useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Chip, TagChips } from './TagChips';
import { ThemedSwitch } from './ThemedSwitch';
import { TAG_OPTIONS, toggleTag, type Tag } from '../lib/filters';
import { SORT_OPTIONS, SORT_RESET_MS, type SortMode } from '../lib/sort';
import { colors, themed } from '../theme';
import { useHoldTips } from '../lib/tips';

type Props = {
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  hideClosed: boolean;
  onHideClosedChange: (hide: boolean) => void;
  count: number; // venues shown with these filters
  // First in the row, before the sort chips (Ana sayfa: the place button)
  leading?: ReactNode;
  // Ana sayfa > "Tüm mekanlar": the title on the left and "Filtreler" on the right (no sort chips)
  title?: string;
};

/**
 * Ana sayfa, under "Mekan ara": the sort chips (En sakin / En yakın), the place button, then "Filtrele"
 * (with how many filters are on), and the chosen filters as small chips below; the sheet holds
 * "Ne arıyorsun?" and "Kapalıları gizle". Changes apply at once.
 */
export function FilterBar(props: Props) {
  const { tags, onTagsChange, sortMode, onSortChange, hideClosed, onHideClosedChange } = props;
  const [open, setOpen] = useState(false);
  useHoldTips(open);
  // One of the three is on: the old one goes off in the same instant the new one comes on
  const [shownSort, setShownSort] = useState(sortMode);
  useEffect(() => setShownSort(sortMode), [sortMode]);
  // Left on, a sort switches itself off after a while
  useEffect(() => {
    if (sortMode === 'recommended') return;
    const timer = setTimeout(() => onSortChange('recommended'), SORT_RESET_MS);
    return () => clearTimeout(timer);
  }, [sortMode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Pulling the sheet down by its top closes it
  const dragY = useRef(new Animated.Value(0)).current;
  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
      onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.8) {
          setOpen(false);
          dragY.setValue(0);
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;
  const active = tags.length + (hideClosed ? 1 : 0);

  return (
    <>
      {props.title ? (
        <View style={styles.titleRow}>
          <Text style={styles.barTitle}>{props.title}</Text>
          <Pressable
            onPress={() => setOpen(true)}
            style={[styles.button, active > 0 && styles.buttonOn]}
            accessibilityLabel={active > 0 ? `Filtrele, ${active} filtre açık` : 'Filtrele'}
          >
            <Icon name="adjustments-horizontal" size={18} color={active > 0 ? colors.onPrimary : colors.text} />
            <Text style={[styles.buttonText, active > 0 && styles.buttonTextOn]}>{active > 0 ? `Filtreler (${active})` : 'Filtreler'}</Text>
          </Pressable>
        </View>
      ) : (
      <View style={styles.row}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bar}>
          {SORT_OPTIONS.map(({ mode, label }) => (
            <Chip
              key={mode}
              compact
              label={label}
              active={shownSort === mode}
              onPress={() => {
                // A second tap switches it off: back to the default order
                const next = shownSort === mode ? 'recommended' : mode;
                setShownSort(next);
                startTransition(() => onSortChange(next));
              }}
            />
          ))}
          {props.leading}
          {/* Filtrele: the icon only (the row fits one screen); how many are on as a small badge */}
          <Pressable
            onPress={() => setOpen(true)}
            style={[styles.button, active > 0 && styles.buttonOn]}
            accessibilityLabel={active > 0 ? `Filtrele, ${active} filtre açık` : 'Filtrele'}
          >
            <Icon name="adjustments-horizontal" size={20} color={active > 0 ? colors.onPrimary : colors.text} />
            {active > 0 && <Text style={[styles.buttonText, styles.buttonTextOn]}>{active}</Text>}
          </Pressable>
        </ScrollView>
      </View>
      )}
      {/* What is on, each removable with one tap */}
      {active > 0 && (
        <View style={styles.appliedRow}>
          {tags.map((tag) => (
            <Applied key={tag} label={TAG_OPTIONS.find((t) => t.tag === tag)?.label ?? tag} onRemove={() => onTagsChange(toggleTag(tags, tag))} />
          ))}
          {hideClosed && <Applied label="Açık olanlar" onRemove={() => onHideClosedChange(false)} />}
        </View>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Kapat" />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: dragY }] }]}>
          <View {...drag.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.sheetTop}>
            <Text style={styles.title}>Filtrele</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Kapat">
              <Icon name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <Text style={styles.heading}>Ne arıyorsun?</Text>
            <TagChips selected={tags} onToggle={(tag) => onTagsChange(toggleTag(tags, tag))} />

            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>Kapalıları gizle</Text>
                <Text style={styles.muted}>Yalnızca şu an açık mekanlar görünür.</Text>
              </View>
              <ThemedSwitch value={hideClosed} onValueChange={onHideClosedChange} />
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                onTagsChange([]);
                onHideClosedChange(false);
              }}
              style={styles.reset}
            >
              <Text style={styles.resetText}>Sıfırla</Text>
            </Pressable>
            <Pressable onPress={() => setOpen(false)} style={styles.show}>
              <Text style={styles.showText}>{props.count} mekanı göster</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

function Applied({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable onPress={onRemove} style={styles.applied} accessibilityLabel={`${label} filtresini kaldır`}>
      <Text style={styles.appliedText}>{label}</Text>
      <Icon name="x" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  barTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  bar: { gap: 8, alignItems: 'center' },
  appliedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.text },
  buttonTextOn: { color: colors.onPrimary },
  applied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appliedText: { fontSize: 13, fontWeight: '500', color: colors.text },
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 28,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 8 },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sheetBody: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12, gap: 10 },
  heading: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 10 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flex: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  reset: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border },
  resetText: { fontSize: 15, fontWeight: '700', color: colors.text },
  show: { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  showText: { fontSize: 15, fontWeight: '700', color: colors.onPrimary },
}));
