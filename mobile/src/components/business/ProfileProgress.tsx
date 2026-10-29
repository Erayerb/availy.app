import { StyleSheet, View } from 'react-native';

import type { Venue } from '../../lib/api';
import { profileSteps } from '../../lib/business';
import { colors, themed } from '../../theme';
import { InlineIcon } from '../Icon';
import { Pressable } from '../Pressable';
import { Text } from '../Text';
import { VenuePhoto } from '../VenuePhoto';
import { panel } from './panelStyles';
import { useCoverUpload } from './useCoverUpload';

type Props = { venue: Venue; token: string; onSaved: () => void; onEditProfile: () => void };

/**
 * Top of the business panel until the profile is complete: without a cover photo a card to upload one
 * right here ("Fotoğraflı mekanlar daha çok tıklanır"), and "Profilin %60 dolu" with what is missing.
 */
export function ProfileProgress({ venue, token, onSaved, onEditProfile }: Props) {
  const { pick, busy, note } = useCoverUpload(venue, token, onSaved);
  const steps = profileSteps(venue);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const percent = Math.round((done / steps.length) * 100);

  return (
    <View style={[panel.card, styles.card]}>
      {!venue.photo_at && (
        <View style={styles.photoRow}>
          <VenuePhoto venueId={venue.id} category={venue.category} photoAt={null} size={72} height={56} radius={10} />
          <View style={styles.flex}>
            <Text style={panel.sectionTitle}>Mekanının fotoğrafı yok</Text>
            <Text style={panel.muted}>Fotoğraflı mekanlar daha çok tıklanır; ana sayfada ve haritada öne çıkar.</Text>
          </View>
        </View>
      )}
      {!venue.photo_at && (
        <Pressable style={panel.primary} onPress={pick} disabled={busy}>
          <Text style={panel.primaryText}>
            <InlineIcon name="camera" /> {busy ? 'Yükleniyor…' : 'Fotoğraf yükle'}
          </Text>
        </Pressable>
      )}
      {note && <Text style={note.ok ? panel.success : panel.error}>{note.text}</Text>}

      <View style={styles.progressHead}>
        <Text style={panel.text}>Profilin %{percent} dolu</Text>
        <Text style={panel.muted}>
          {done}/{steps.length}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <View style={styles.chips}>
        {steps
          .filter((s) => !s.done)
          .map((s) => (
            <Pressable key={s.label} onPress={s.key === 'photo' ? pick : onEditProfile} style={styles.chip}>
              <Text style={styles.chipText}>
                <InlineIcon name="plus" /> {s.label}
              </Text>
            </Pressable>
          ))}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { gap: 10 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cream, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 14, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
}));
