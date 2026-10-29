import { StyleSheet, View } from 'react-native';

import type { Venue } from '../../lib/api';
import { colors, themed } from '../../theme';
import { Icon } from '../Icon';
import { Pressable } from '../Pressable';
import { Text } from '../Text';
import { VenuePhoto } from '../VenuePhoto';
import { useCoverUpload } from './useCoverUpload';

/** İşletme Profili, next to the venue's name: its cover photo with a pencil; a tap picks a new one. */
export function CoverPhoto({ venue, token, onSaved }: { venue: Venue; token: string; onSaved: () => void }) {
  const { pick, busy, note } = useCoverUpload(venue, token, onSaved);
  return (
    <View style={styles.box}>
      <Pressable onPress={pick} disabled={busy} accessibilityLabel={venue.photo_at ? 'Kapak fotoğrafını değiştir' : 'Kapak fotoğrafı ekle'}>
        <VenuePhoto venueId={venue.id} category={venue.category} photoAt={venue.photo_at} size={72} height={72} radius={14} />
        <View style={styles.pencil}>
          <Icon name={busy ? 'hourglass' : 'pencil'} size={14} color={colors.onPrimary} />
        </View>
      </Pressable>
      {note && <Text style={[styles.note, !note.ok && styles.error]}>{note.ok ? 'Kaydedildi' : note.text}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { alignItems: 'center', gap: 4 },
  pencil: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { fontSize: 11, color: colors.success, maxWidth: 90, textAlign: 'center' },
  error: { color: colors.danger },
}));
