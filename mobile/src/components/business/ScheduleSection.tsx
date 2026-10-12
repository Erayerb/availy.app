import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useCampaigns } from '../../context/CampaignsContext';
import type { Venue } from '../../lib/api';
import { DISCOUNT_OPTIONS, DURATION_OPTIONS_HOURS, RADIUS_OPTIONS_KM } from '../../lib/campaigns';
import { WEEKDAYS } from '../../lib/history';
import type { PlanId } from '../../lib/plans';
import { validateSchedule } from '../../lib/schedules';
import { colors } from '../../theme';
import { Chip } from '../TagChips';
import { panel } from './panelStyles';
import { ThemedSwitch } from '../ThemedSwitch';

/** Weekly recurring campaigns; available on the SaaS plan. */
export function ScheduleSection({
  venue,
  plan,
  onUpgrade,
}: {
  venue: Venue;
  plan: PlanId;
  onUpgrade: () => void;
}) {
  const { schedules, saveSchedule, removeSchedule } = useCampaigns();
  const mine = schedules.filter((s) => s.venueId === venue.id);
  const [message, setMessage] = useState('Her salı öğleden sonra tüm kahvelerde %20 indirim!');
  const [days, setDays] = useState<number[]>([1]);
  const [startHour, setStartHour] = useState('13');
  const [duration, setDuration] = useState(3);
  const [discount, setDiscount] = useState<number | null>(20);
  const [radius, setRadius] = useState(2);
  const [error, setError] = useState<string | null>(null);

  if (plan !== 'saas') {
    return (
      <View style={panel.card}>
        <Text style={panel.sectionTitle}>Zamanlanmış kampanyalar 🔒</Text>
        <Text style={panel.muted}>Örn. "her salı 13–16 arası %20". SaaS Panel paketine özeldir.</Text>
        <Pressable style={panel.secondary} onPress={onUpgrade}>
          <Text style={panel.secondaryText}>SaaS paketine geç (demo)</Text>
        </Pressable>
      </View>
    );
  }

  const add = () => {
    const input = { message, days, startHour: Number(startHour), durationHours: duration };
    const problem = validateSchedule(input);
    setError(problem);
    if (problem) return;
    saveSchedule({
      id: Crypto.randomUUID(),
      venueId: venue.id,
      venueName: venue.name,
      lat: venue.lat,
      lon: venue.lon,
      discount,
      radiusKm: radius,
      active: true,
      ...input,
      message: message.trim(),
    });
  };

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Zamanlanmış kampanyalar</Text>
      {mine.map((s) => (
        <View
          key={s.id}
          style={{ gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <Text style={panel.text}>{s.message}</Text>
          <View style={[panel.row, { alignItems: 'center' }]}>
            <Text style={[panel.muted, { flex: 1 }]}>
              {s.days.map((d) => WEEKDAYS[d]).join(', ')} · {String(s.startHour).padStart(2, '0')}:00 ·{' '}
              {s.durationHours} saat · {s.radiusKm} km
            </Text>
            <ThemedSwitch value={s.active} onValueChange={(active) => saveSchedule({ ...s, active })} />
          </View>
          <Pressable onPress={() => removeSchedule(s.id)}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Sil</Text>
          </Pressable>
        </View>
      ))}
      <Text style={panel.label}>Yeni tekrarlayan kampanya</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        multiline
        style={[panel.input, { minHeight: 56 }]}
      />
      <Text style={panel.label}>Günler</Text>
      <View style={panel.wrap}>
        {WEEKDAYS.map((label, i) => (
          <Chip
            key={label}
            label={label}
            active={days.includes(i)}
            onPress={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()))}
          />
        ))}
      </View>
      <Text style={panel.label}>Başlangıç saati</Text>
      <TextInput
        value={startHour}
        onChangeText={setStartHour}
        keyboardType="number-pad"
        style={panel.input}
      />
      <Text style={panel.label}>Süre / indirim / mesafe</Text>
      <View style={panel.wrap}>
        {DURATION_OPTIONS_HOURS.map((h) => (
          <Chip key={h} label={`${h} saat`} active={duration === h} onPress={() => setDuration(h)} />
        ))}
      </View>
      <View style={panel.wrap}>
        <Chip label="İndirimsiz" active={discount === null} onPress={() => setDiscount(null)} />
        {DISCOUNT_OPTIONS.map((d) => (
          <Chip key={d} label={`%${d}`} active={discount === d} onPress={() => setDiscount(d)} />
        ))}
      </View>
      <View style={panel.wrap}>
        {RADIUS_OPTIONS_KM.map((r) => (
          <Chip key={r} label={`${r} km`} active={radius === r} onPress={() => setRadius(r)} />
        ))}
      </View>
      {error && <Text style={panel.error}>{error}</Text>}
      <Pressable style={panel.primary} onPress={add}>
        <Text style={panel.primaryText}>Zamanla</Text>
      </Pressable>
      <Text style={panel.muted}>Prototip: zamanı gelince uygulama açıkken kampanya başlar.</Text>
    </View>
  );
}
