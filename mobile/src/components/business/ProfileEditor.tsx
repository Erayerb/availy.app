import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Pressable } from '../Pressable';

import type { Venue } from '../../lib/api';
import { venueApi } from '../../lib/venueApi';
import { colors } from '../../theme';
import { panel } from './panelStyles';
import { AddressSection } from './AddressSection';
import { PhotoSection } from './PhotoSection';

type Props = { venue: Venue; token: string; onSaved: () => void };

/** The business edits its venue page: cover photo, Instagram and phone (saved on the server, seen by everyone). */
export function ProfileEditor({ venue, token, onSaved }: Props) {
  const [instagram, setInstagram] = useState(venue.instagram ?? '');
  const [phone, setPhone] = useState(venue.phone ?? '');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    try {
      const saved = await venueApi.saveLinks(token, venue.id, instagram, phone);
      setInstagram(saved.instagram ?? '');
      setPhone(saved.phone ?? '');
      setNote({ ok: true, text: '✓ Kaydedildi; müşterilerin mekan sayfasında görünür.' });
      onSaved();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    }
  };

  return (
    <>
      <PhotoSection venue={venue} token={token} onSaved={onSaved} />
      <AddressSection key={`${venue.lat},${venue.lon}`} venue={venue} token={token} onSaved={onSaved} />
      <View style={panel.card}>
        <Text style={panel.sectionTitle}>İletişim</Text>
        <Text style={panel.label}>Instagram</Text>
        <TextInput
          value={instagram}
          onChangeText={(text) => {
            setInstagram(text);
            setNote(null);
          }}
          placeholder="kullaniciadi"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          style={panel.input}
        />
        <Text style={panel.label}>Telefon</Text>
        <TextInput
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            setNote(null);
          }}
          placeholder="0212 123 45 67"
          placeholderTextColor={colors.placeholder}
          keyboardType="phone-pad"
          style={panel.input}
        />
        <Pressable style={panel.primary} onPress={save}>
          <Text style={panel.primaryText}>Kaydet</Text>
        </Pressable>
        {note && <Text style={note.ok ? panel.success : panel.error}>{note.text}</Text>}
      </View>
      <Text style={panel.muted}>Çalışma saatleri ve özellikler: Daha fazla → Ayarlar.</Text>
    </>
  );
}
