import { useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '../Text';
import { Pressable } from '../Pressable';

import { useCampaigns } from '../../context/CampaignsContext';
import type { Venue } from '../../lib/api';
import { DISCOUNT_STEP, DURATION_OPTIONS_HOURS, RADIUS_OPTIONS_KM, scheduleSuggestion } from '../../lib/campaigns';
import { Stepper } from '../Stepper';
import type { PlanId } from '../../lib/plans';
import { validateSchedule, WEEKDAYS } from '../../lib/schedules';
import { colors } from '../../theme';
import { Chip } from '../TagChips';
import { panel } from './panelStyles';
import { ThemedSwitch } from '../ThemedSwitch';
import { InlineIcon } from '../Icon';

/** Weekly recurring campaigns (Aylık paket), in Kampanyalar: the list (on/off, Sil); the form is in a sheet
 * (ScheduleForm). The server starts them on time, the app need not be open. Without the plan: what it is and
 * the way to it. */
export function ScheduleSection({ plan, onUpgrade }: { plan: PlanId; onUpgrade: () => void }) {
  const { schedules: mine, setScheduleActive, removeSchedule, access } = useCampaigns();

  // The server's plan wins (a running 15-day trial counts as the Aylık paket)
  if ((access?.plan ?? plan) !== 'saas') {
    return (
      <View style={panel.card}>
        <Text style={panel.sectionTitle}>Haftalık kampanyalar <InlineIcon name="lock" /></Text>
        <Text style={panel.muted}>Örn. "her salı 13–16 arası %20". Aylık paket'e özeldir.</Text>
        <Pressable style={panel.secondary} onPress={onUpgrade}>
          <Text style={panel.secondaryText}>Aylık paket'e geç</Text>
        </Pressable>
      </View>
    );
  }
  if (mine.length === 0) return null;

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Haftalık kampanyalar</Text>
      {mine.map((s) => (
        <View
          key={s.id}
          style={{ gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <Text style={panel.text}>{s.message}</Text>
          <View style={[panel.row, { alignItems: 'center' }]}>
            <Text style={[panel.muted, { flex: 1 }]}>
              {s.days.map((d) => WEEKDAYS[d]).join(', ')} · {String(s.start_hour).padStart(2, '0')}:00 ·{' '}
              {s.duration_hours} saat · {s.radius_km} km
            </Text>
            <ThemedSwitch value={s.active} onValueChange={(active) => setScheduleActive(s.id, active)} />
          </View>
          <Pressable onPress={() => removeSchedule(s.id)}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Sil</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** "+ Haftalık kampanya" sheet: message (follows the choices until written by hand), days, start, duration,
 * discount and radius. `onDone`: saved (the sheet closes). */
export function ScheduleForm({ venue, onDone }: { venue: Venue; onDone: () => void }) {
  const { addSchedule } = useCampaigns();
  const [message, setMessage] = useState<string | null>(null); // null: follows the choices
  const [days, setDays] = useState<number[]>([1]);
  const [startHour, setStartHour] = useState('13');
  const [duration, setDuration] = useState(3);
  const [discount, setDiscount] = useState<number | null>(20);
  const [radius, setRadius] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const text = message ?? scheduleSuggestion(venue.category, days, Number(startHour), duration, discount);

  const add = async () => {
    const input = { message: text.trim(), days, start_hour: Number(startHour), duration_hours: duration, discount, radius_km: radius };
    const problem = validateSchedule(input);
    setError(problem);
    if (problem) return;
    const failure = await addSchedule(input);
    if (failure) return setError(failure);
    onDone();
  };

  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={text}
        onChangeText={setMessage}
        multiline
        style={[panel.input, { minHeight: 56 }]}
      />
      {message !== null && (
        <Pressable hitSlop={8} onPress={() => setMessage(null)}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Seçimlere göre yeniden yaz</Text>
        </Pressable>
      )}
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
        <Chip label="İndirimli" active={discount !== null} onPress={() => setDiscount(discount ?? 20)} />
      </View>
      {discount !== null && (
        <Stepper value={discount} onChange={setDiscount} min={DISCOUNT_STEP} max={90} step={DISCOUNT_STEP} format={(d) => `%${d}`} label="İndirim" />
      )}
      <View style={panel.wrap}>
        {RADIUS_OPTIONS_KM.map((r) => (
          <Chip key={r} label={`${r} km`} active={radius === r} onPress={() => setRadius(r)} />
        ))}
      </View>
      {error && <Text style={panel.error}>{error}</Text>}
      <Pressable style={panel.primary} onPress={add}>
        <Text style={panel.primaryText}>Zamanla</Text>
      </Pressable>
      <Text style={panel.muted}>Zamanı gelince kampanya kendiliğinden başlar; uygulamanın açık olması gerekmez.</Text>
    </View>
  );
}
