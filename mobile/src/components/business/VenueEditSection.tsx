import { useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '../Text';
import { Pressable } from '../Pressable';

import { ALL_AMENITIES, type AmenityKey } from '../../lib/amenities';
import type { Venue } from '../../lib/api';
import { toggleTag, type Tag } from '../../lib/filters';
import { venueApi } from '../../lib/venueApi';
import { amenitiesFor } from '../../lib/amenities';
import { colors } from '../../theme';
import { Chip, TagChips } from '../TagChips';
import { panel } from './panelStyles';

const parseHours = (label: string): [string, string] => {
  const m = label.match(/^(\d{2}):00–(\d{2}):00$/);
  return m ? [String(Number(m[1])), String(Number(m[2]) || 24)] : ['0', '24'];
};

/** Business edits its name, opening hours, purposes and features (İşletme Profili); saved on the server, so every customer sees them. */
export function VenueEditSection({ venue, token, onSaved }: { venue: Venue; token: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(venue.name);
  const [openHour, setOpenHour] = useState(parseHours(venue.hours)[0]);
  const [closeHour, setCloseHour] = useState(parseHours(venue.hours)[1]);
  const [tags, setTags] = useState<Tag[]>(venue.tags as Tag[]);
  const currentAmenities = Object.entries(ALL_AMENITIES)
    .filter(([, a]) => amenitiesFor(venue).some((x) => x.label === a.label))
    .map(([k]) => k as AmenityKey);
  const [amenities, setAmenities] = useState<AmenityKey[]>(currentAmenities);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    const open = Number(openHour);
    const close = Number(closeHour);
    if (![open, close].every((h) => Number.isInteger(h) && h >= 0 && h <= 24) || open === close)
      return setMessage({ ok: false, text: 'Saatler 0 ile 24 arasında olmalı; açılış ve kapanış aynı olamaz.' });
    try {
      await venueApi.saveDetails(token, venue.id, {
        name: name.trim(),
        open_hour: open,
        close_hour: close,
        tags,
        amenities,
        description: venue.description ?? '', // no "Hakkımızda" in the app; an older text is kept as it is
      });
      setMessage({ ok: true, text: 'Kaydedildi. Müşteriler mekan sayfanda yeni bilgileri görür.' });
      onSaved();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    }
  };

  return (
    <View style={panel.card}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={panel.sectionTitle}>Mekan bilgilerini düzenle</Text>
        <Text style={panel.muted}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={panel.label}>İşletme adı</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="İşletmenin adı"
            placeholderTextColor={colors.placeholder}
            maxLength={60}
            style={panel.input}
          />
          <Text style={panel.label}>Çalışma saatleri (0–24; kapanış açılıştan küçükse gece yarısından sonra)</Text>
          <View style={panel.row}>
            <TextInput value={openHour} onChangeText={setOpenHour} keyboardType="number-pad" style={[panel.input, { flex: 1 }]} />
            <Text style={[panel.text, { alignSelf: 'center' }]}>–</Text>
            <TextInput value={closeHour} onChangeText={setCloseHour} keyboardType="number-pad" style={[panel.input, { flex: 1 }]} />
          </View>
          <Text style={panel.label}>Ne için uygun?</Text>
          <TagChips selected={tags} onToggle={(t) => setTags((current) => toggleTag(current, t))} />
          <Text style={panel.label}>Özellikler</Text>
          <View style={panel.wrap}>
            {(Object.keys(ALL_AMENITIES) as AmenityKey[]).map((key) => (
              <Chip
                key={key}
                label={ALL_AMENITIES[key].label}
                active={amenities.includes(key)}
                onPress={() =>
                  setAmenities((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]))
                }
              />
            ))}
          </View>
          {message && <Text style={message.ok ? panel.success : panel.error}>{message.text}</Text>}
          <Pressable style={panel.primary} onPress={save}>
            <Text style={panel.primaryText}>Kaydet</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
