import { useState } from 'react';
import { View, Modal } from 'react-native';
import { Text, TextInput } from '../Text';
import { Pressable } from '../Pressable';

import { useLocation } from '../../context/LocationContext';
import type { Venue } from '../../lib/api';
import { geocodeAddress, reverseGeocode } from '../../lib/reverseGeocode';
import { venueApi } from '../../lib/venueApi';
import { colors } from '../../theme';
import { DistrictSearch } from '../DistrictSearch';
import { panel } from './panelStyles';
import { InlineIcon } from '../Icon';
import { LocationPicker } from '../LocationPicker';

type Props = { venue: Venue; token: string; onSaved: () => void };

/** Address, neighbourhood / district and the point "Yol tarifi" goes to (found from the address or the phone's location). */
export function AddressSection({ venue, token, onSaved }: Props) {
  const { locate } = useLocation();
  const [address, setAddress] = useState(venue.address ?? '');
  const [neighborhood, setNeighborhood] = useState(venue.neighborhood);
  const [district, setDistrict] = useState(venue.district);
  const [point, setPoint] = useState({ lat: venue.lat, lon: venue.lon });
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [picking, setPicking] = useState(false);
  // Closed by default, like "Mekan bilgilerini düzenle"
  const [open, setOpen] = useState(false);
  const moved = point.lat !== venue.lat || point.lon !== venue.lon;

  const fillFrom = async (found: { lat: number; lon: number }, text: string) => {
    setPoint(found);
    const place = await reverseGeocode(found).catch(() => null);
    if (place) {
      setDistrict(place.district);
      if (place.neighborhood) setNeighborhood(place.neighborhood);
    }
    setNote({ ok: true, text });
  };

  const findAddress = async () => {
    if (!address.trim()) return setNote({ ok: false, text: 'Önce adresi yaz.' });
    const found = await geocodeAddress(address, district);
    if (!found) return setNote({ ok: false, text: 'Bu adres bulunamadı; sokak ve numarayı kontrol et ya da konumunu kullan.' });
    fillFrom(found, 'Adres bulundu. Kaydedince yol tarifi buraya gider.');
  };

  const useMyLocation = async () => {
    const position = await locate();
    if (position.error !== null) return setNote({ ok: false, text: 'Konumun alınamadı; konum iznini kontrol et.' });
    fillFrom(position.coords, 'Konumun alındı. Mekandaysan kaydet; yol tarifi buraya gider.');
  };

  const save = async () => {
    try {
      await venueApi.saveAddress(token, venue.id, { address, neighborhood, district, ...point });
      setNote({ ok: true, text: '✓ Adres kaydedildi.' });
      onSaved();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    }
  };

  return (
    <View style={panel.card}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={panel.sectionTitle}>Adres ve konum</Text>
        <Text style={panel.muted}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={panel.muted}>Mekan sayfasında ve yol tarifinde bu bilgiler kullanılır.</Text>
          <Text style={panel.label}>Açık adres</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Sokak, numara"
            placeholderTextColor={colors.placeholder}
            style={panel.input}
          />
          <Text style={panel.label}>Semt</Text>
          <DistrictSearch value={district} onChange={setDistrict} />
          <Text style={panel.label}>Mahalle</Text>
          <TextInput
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="Mahalle"
            placeholderTextColor={colors.placeholder}
            style={panel.input}
          />
          <Text style={panel.label}>Yol tarifinin gideceği nokta</Text>
          <View style={panel.row}>
            <Pressable style={[panel.secondary, { flex: 1 }]} onPress={findAddress}>
              <Text style={panel.secondaryText}><InlineIcon name="map-pin" /> Adresten bul</Text>
            </Pressable>
            <Pressable style={[panel.secondary, { flex: 1 }]} onPress={() => setPicking(true)}>
              <Text style={panel.secondaryText}><InlineIcon name="map" /> Haritadan seç</Text>
            </Pressable>
          </View>
          <Pressable style={panel.secondary} onPress={useMyLocation}>
            <Text style={panel.secondaryText}><InlineIcon name="current-location" /> Mekandayım: konumumu kullan</Text>
          </Pressable>
          <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
            <LocationPicker
              start={point}
              onBack={() => setPicking(false)}
              onPick={(picked) => {
                setPicking(false);
                fillFrom(picked, 'Konum haritadan seçildi. Kaydedince yol tarifi buraya gider.');
              }}
            />
          </Modal>
          <Text style={panel.muted}>
            {moved ? 'Yeni nokta' : 'Şimdiki nokta'}: {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
          </Text>
          <Pressable style={panel.primary} onPress={save}>
            <Text style={panel.primaryText}>Adresi kaydet</Text>
          </Pressable>
          {note && <Text style={note.ok ? panel.success : panel.error}>{note.text}</Text>}
        </>
      )}
    </View>
  );
}
