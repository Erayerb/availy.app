import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text';
import { Pressable } from './Pressable';

import { useLocation } from '../context/LocationContext';
import { geocodeAddress, reverseGeocode } from '../lib/reverseGeocode';
import { VENUE_CATEGORIES, venueApi } from '../lib/venueApi';
import { colors, themed } from '../theme';
import { BackButton } from './BackButton';
import { DistrictSearch } from './DistrictSearch';
import { LocationPicker } from './LocationPicker';
import { Chip } from './TagChips';
import { InlineIcon } from './Icon';

type Point = { lat: number; lon: number };

type Props = {
  token: string;
  business: boolean; // a business adds its own venue (from anywhere); a customer has to be near it
  title: string;
  intro: string;
  onBack: () => void;
  onAdded: (venue: { id: number }) => void;
};

/**
 * New venue: name, type, location (the phone's or picked on the map; the address fills in from it),
 * district, neighbourhood and street; then "Adresi doğrula" shows everything once more before sending.
 */
export function NewVenueForm({ token, business, title, intro, onBack, onAdded }: Props) {
  const { locate } = useLocation();
  const [step, setStep] = useState<'form' | 'map' | 'confirm'>('form');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The server found another venue right at the spot: the user may still add this one
  const [nearWarning, setNearWarning] = useState(false);

  // The picked point fills in the address (it stays editable)
  const usePoint = async (next: Point) => {
    setPoint(next);
    setStep('form');
    setError(null);
    setFinding(true);
    const place = await reverseGeocode(next).catch(() => null);
    setFinding(false);
    if (!place) return setError('Bu noktanın adresi bulunamadı; semti ve adresi elle yaz.');
    // What the user typed stays; only empty fields are filled from the map point
    setDistrict((d) => d || place.district);
    setNeighborhood((n) => n || place.neighborhood);
    if (place.line) setAddress((a) => a || place.line!);
  };

  // "Adresi haritada bul": the typed address on the map, to put the pin right on the door there
  const findOnMap = async () => {
    const line = [address.trim(), neighborhood.trim()].filter(Boolean).join(', ');
    if (line.length < 4) return setError('Önce açık adresi yaz (sokak, numara).');
    setError(null);
    setFinding(true);
    const found = await geocodeAddress(line, district);
    setFinding(false);
    if (!found) return setError('Bu adres haritada bulunamadı; haritadan seçebilirsin.');
    setPoint(found);
    setStep('map');
  };

  const useMyLocation = async () => {
    const position = await locate();
    if (position.error !== null) return setError('Konumun alınamadı; konum iznini kontrol et ya da haritadan seç.');
    usePoint(position.coords);
  };

  const check = () => {
    if (name.trim().length < 2) return setError('Mekanın adını yaz.');
    if (!category) return setError('Mekan türünü seç.');
    if (!point) return setError('Mekanın konumunu seç.');
    if (!district.trim()) return setError('Semti seç.');
    setError(null);
    setStep('confirm');
  };

  const send = async (confirmNear = false) => {
    if (!point || !category) return;
    setBusy(true);
    setError(null);
    setNearWarning(false);
    let me: Point | undefined;
    if (!business) {
      // A customer adds venues where they are
      const position = await locate();
      if (position.error !== null) {
        setBusy(false);
        return setError('Mekan eklemek için konum izni gerekli: mekanın yakınında olmalısın.');
      }
      me = position.coords;
    }
    try {
      const added = await venueApi.add(token, {
        name,
        category,
        lat: point.lat,
        lon: point.lon,
        neighborhood,
        district,
        address,
        user_lat: me?.lat,
        user_lon: me?.lon,
        confirm_near: confirmNear,
      });
      onAdded(added);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Eklenemedi.';
      setError(message);
      setNearWarning(message.includes('Yine de ekle'));
      setBusy(false);
    }
  };

  if (step === 'map') return <LocationPicker start={point} onBack={() => setStep('form')} onPick={usePoint} />;

  if (step === 'confirm') {
    const kind = VENUE_CATEGORIES.find((c) => c.id === category)?.label;
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <BackButton onPress={() => setStep('form')} />
          <Text style={styles.title}>Adresi doğrula</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.name}>{name.trim()}</Text>
          <Text style={styles.muted}>{kind}</Text>
          <Text style={styles.text}><InlineIcon name="map-pin" /> {[address.trim(), neighborhood.trim(), district.trim()].filter(Boolean).join(', ')}</Text>
          <Text style={styles.muted}>
            Konum: {point!.lat.toFixed(5)}, {point!.lon.toFixed(5)} · yol tarifi buraya gider
          </Text>
        </View>
        <Text style={styles.muted}>Bilgiler doğru mu? Yanlışsa "Düzelt" ile geri dön.</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {nearWarning ? (
          <Pressable style={[styles.primary, busy && styles.busy]} onPress={() => send(true)} disabled={busy}>
            <Text style={styles.primaryText}>Aynı mekan değil, yine de ekle</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.primary, busy && styles.busy]} onPress={() => send()} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Gönderiliyor…' : 'Doğru, gönder'}</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondary} onPress={() => setStep('form')}>
          <Text style={styles.secondaryText}>Düzelt</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <BackButton onPress={onBack} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.muted}>{intro}</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Mekanın adı"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          maxLength={60}
        />
        <Text style={styles.label}>Türü</Text>
        <View style={styles.wrap}>
          {VENUE_CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.label} active={category === c.id} onPress={() => setCategory(c.id)} />
          ))}
        </View>

        <Text style={styles.label}>Konum seç</Text>
        <View style={styles.row}>
          <Pressable style={[styles.secondary, styles.flex]} onPress={useMyLocation}>
            <Text style={styles.secondaryText}><InlineIcon name="map-pin" /> Şu anki konumum</Text>
          </Pressable>
          <Pressable style={[styles.secondary, styles.flex]} onPress={() => setStep('map')}>
            <Text style={styles.secondaryText}><InlineIcon name="map" /> Haritadan seç</Text>
          </Pressable>
        </View>
        <Text style={point ? styles.text : styles.muted}>
          {finding
            ? 'Adres bulunuyor…'
            : point
              ? `Seçilen konum: ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`
              : 'Henüz konum seçilmedi. Seçince adres kendiliğinden dolar.'}
        </Text>

        <Text style={styles.label}>Semt</Text>
        <DistrictSearch value={district} onChange={setDistrict} />
        <Text style={styles.label}>Mahalle</Text>
        <TextInput
          value={neighborhood}
          onChangeText={setNeighborhood}
          placeholder="Mahalle (ör. Caferağa)"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
        />
        <Text style={styles.label}>Açık adres</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Sokak / cadde, numara"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={findOnMap}
        />
        <Pressable style={styles.secondary} onPress={findOnMap}>
          <Text style={styles.secondaryText}><InlineIcon name="map-search" /> Adresi haritada bul</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.primary} onPress={check}>
          <Text style={styles.primaryText}>Adresi doğrula</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.cream,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 14 },
  primary: { paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  secondary: { paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  busy: { opacity: 0.6 },
}));
