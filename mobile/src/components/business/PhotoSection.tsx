import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEngagement } from '../../context/EngagementContext';
import type { Venue } from '../../lib/api';
import { colors } from '../../theme';
import { VenuePhoto } from '../VenuePhoto';
import { panel } from './panelStyles';

/** One photo per venue, shown on the home tiles and the detail page. */
export function PhotoSection({ venue }: { venue: Venue }) {
  const { photos, setPhoto } = useEngagement();
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    // Stored as a data URI so it survives app restarts (prototype: on this phone only)
    if (asset.base64) setPhoto(venue.id, `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
    else if (asset.uri) setPhoto(venue.id, asset.uri);
    else setError('Fotoğraf okunamadı.');
  };

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Mekan fotoğrafı</Text>
      <Text style={panel.muted}>Ana sayfadaki kartta ve detay sayfasında görünür. Tek fotoğraf.</Text>
      <View style={styles.row}>
        <VenuePhoto venueId={venue.id} category={venue.category} size={96} height={96} radius={12} />
        <Pressable style={[panel.secondary, styles.button]} onPress={pick}>
          <Text style={panel.secondaryText}>{photos[venue.id] ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}</Text>
        </Pressable>
      </View>
      {error && <Text style={panel.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  button: { flex: 1 },
});
