import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Text';

import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Chip, TagChips } from './TagChips';
import { ThemedSwitch } from './ThemedSwitch';
import { TAG_OPTIONS, toggleTag, type Tag } from '../lib/filters';
import { SORT_OPTIONS, type SortMode } from '../lib/sort';
import { colors, themed } from '../theme';

type Props = {
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  hideClosed: boolean;
  onHideClosedChange: (hide: boolean) => void;
  count: number; // venues shown with these filters
};

/**
 * Ana sayfa, under "Mekan ara": a "Filtrele" button (with how many filters are on) next to the sort
 * chips (Önerilen / En yakın / En sakin), and the chosen filters as small chips below; the sheet holds
 * "Ne arıyorsun?" and "Kapalıları gizle". Changes apply at once.
 */
export function FilterBar(props: Props) {
  const { tags, onTagsChange, sortMode, onSortChange, hideClosed, onHideClosedChange } = props;
  const [open, setOpen] = useState(false);
  const active = tags.length + (hideClosed ? 1 : 0);

  return (
    <>
      <View style={styles.row}>
        <Pressable onPress={() => setOpen(true)} style={[styles.button, active > 0 && styles.buttonOn]} accessibilityLabel="Filtrele">
          <Icon name="adjustments-horizontal" size={17} color={active > 0 ? colors.onPrimary : colors.text} />
          <Text style={[styles.buttonText, active > 0 && styles.buttonTextOn]}>Filtrele{active > 0 ? ` · ${active}` : ''}</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bar}>
          {SORT_OPTIONS.map(({ mode, label }) => (
            <Chip key={mode} label={label} active={sortMode === mode} onPress={() => onSortChange(mode)} />
          ))}
        </ScrollView>
      </View>
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
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetTop}>
            <Text style={styles.title}>Filtrele</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Kapat">
              <Icon name="x" size={24} color={colors.text} />
            </Pressable>
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
        </View>
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
  bar: { gap: 8, alignItems: 'center' },
  appliedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
