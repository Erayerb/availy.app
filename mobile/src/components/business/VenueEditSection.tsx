import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { ALL_AMENITIES, type AmenityKey } from '../../lib/amenities';
import type { Venue } from '../../lib/api';
import { toggleTag, type Tag } from '../../lib/filters';
import { saveOverride, getOverride } from '../../lib/overrideStore';
import { validateOverride } from '../../lib/overrides';
import { amenitiesFor } from '../../lib/amenities';
import { colors } from '../../theme';
import { Chip, TagChips } from '../TagChips';
import { panel } from './panelStyles';

const parseHours = (label: string): [string, string] => {
  const m = label.match(/^(\d{2}):00–(\d{2}):00$/);
  return m ? [String(Number(m[1])), String(Number(m[2]) || 24)] : ['0', '24'];
};

/** Business edits its name, opening hours, purposes and features. */
export function VenueEditSection({ venue, onSaved }: { venue: Venue; onSaved: () => void }) {
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
    const override = {
      ...getOverride(venue.id),
      name: name.trim(),
      hours: [Number(openHour), Number(closeHour)] as [number, number],
      tags,
      amenities,
    };
    const problem = validateOverride(override);
    if (problem) return setMessage({ ok: false, text: problem });
    await saveOverride(venue.id, override);
    setMessage({ ok: true, text: 'Kaydedildi. Haritada ve listelerde güncel bilgi görünür.' });
    onSaved();
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
                label={`${ALL_AMENITIES[key].icon} ${ALL_AMENITIES[key].label}`}
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
          <Text style={panel.muted}>Prototip: değişiklikler bu telefonda saklanır.</Text>
        </>
      )}
    </View>
  );
}
