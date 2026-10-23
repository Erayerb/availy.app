import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useCampaigns } from '../../context/CampaignsContext';
import type { Venue } from '../../lib/api';
import {
  CLAIM_LIMIT_OPTIONS,
  DISCOUNT_OPTIONS,
  DURATION_OPTIONS_HOURS,
  RADIUS_OPTIONS_KM,
  deadHourSuggestion,
  validateCampaign,
} from '../../lib/campaigns';
import { campaignCostNote, type PlanId } from '../../lib/plans';
import { colors } from '../../theme';
import { Chip } from '../TagChips';
import { panel } from './panelStyles';

/** New campaign: message (ready-made suggestion), discount, duration and radius. */
export function CampaignForm({ venue, plan }: { venue: Venue; plan: PlanId }) {
  const { create } = useCampaigns();
  const [message, setMessage] = useState<string | null>(null); // null: use the suggestion
  const [discount, setDiscount] = useState<number | null>(20);
  const [duration, setDuration] = useState(2);
  const [radius, setRadius] = useState(2);
  const [maxClaims, setMaxClaims] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const text = message ?? deadHourSuggestion(venue.category, discount ?? 20, duration);

  const [sending, setSending] = useState(false);

  const send = async () => {
    const problem = validateCampaign(text);
    setError(problem);
    setSent(null);
    if (problem || sending) return;
    setSending(true);
    const failure = await create({
      venueId: venue.id,
      venueName: venue.name,
      lat: venue.lat,
      lon: venue.lon,
      message: text,
      discount,
      durationHours: duration,
      radiusKm: radius,
      maxClaims,
    });
    setSending(false);
    if (failure) return setError(failure);
    setSent(`Kampanya ${radius} km içindeki kullanıcılara gönderildi.`);
    setMessage(null);
  };

  return (
    <View style={panel.card}>
      <Text style={panel.sectionTitle}>Yeni kampanya</Text>
      <TextInput
        value={text}
        onChangeText={setMessage}
        multiline
        style={[panel.input, { minHeight: 70, textAlignVertical: 'top' }]}
        placeholder="Kampanya mesajı"
        placeholderTextColor={colors.placeholder}
      />
      <Text style={panel.label}>İndirim</Text>
      <View style={panel.wrap}>
        <Chip label="Yok" active={discount === null} onPress={() => setDiscount(null)} />
        {DISCOUNT_OPTIONS.map((d) => (
          <Chip key={d} label={`%${d}`} active={discount === d} onPress={() => setDiscount(d)} />
        ))}
      </View>
      <Text style={panel.label}>Süre</Text>
      <View style={panel.wrap}>
        {DURATION_OPTIONS_HOURS.map((h) => (
          <Chip key={h} label={`${h} saat`} active={duration === h} onPress={() => setDuration(h)} />
        ))}
      </View>
      <Text style={panel.label}>Kimlere gönderilsin?</Text>
      <View style={panel.wrap}>
        {RADIUS_OPTIONS_KM.map((r) => (
          <Chip key={r} label={`${r} km içindekiler`} active={radius === r} onPress={() => setRadius(r)} />
        ))}
      </View>
      <Text style={panel.label}>Kişi sınırı (kaç kişi kupon alabilir?)</Text>
      <View style={panel.wrap}>
        <Chip label="Sınırsız" active={maxClaims === null} onPress={() => setMaxClaims(null)} />
        {CLAIM_LIMIT_OPTIONS.map((n) => (
          <Chip key={n} label={`${n} kişi`} active={maxClaims === n} onPress={() => setMaxClaims(n)} />
        ))}
      </View>
      <Text style={panel.muted}>{campaignCostNote(plan)}</Text>
      {error && <Text style={panel.error}>{error}</Text>}
      {sent && <Text style={panel.success}>✓ {sent}</Text>}
      <Pressable style={[panel.primary, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
        <Text style={panel.primaryText}>{sending ? 'Gönderiliyor…' : 'Kampanyayı gönder'}</Text>
      </Pressable>
    </View>
  );
}
