import { useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '../Text';
import { Pressable } from '../Pressable';

import { useCampaigns } from '../../context/CampaignsContext';
import type { Venue } from '../../lib/api';
import {
  CLAIM_LIMIT_OPTIONS,
  DURATION_OPTIONS_HOURS,
  RADIUS_OPTIONS_KM,
  DISCOUNT_STEP,
  MAX_POINTS,
  POINTS_STEP,
  deadHourSuggestion,
  validateCampaign,
} from '../../lib/campaigns';
import { confirmAction } from '../../lib/confirm';
import { useUpgrade } from '../../context/UpgradeContext';
import { Stepper } from '../Stepper';
import { campaignCostText } from '../../lib/business';
import type { PlanId } from '../../lib/plans';
import { colors } from '../../theme';
import { Chip } from '../TagChips';
import { panel } from './panelStyles';

/** New campaign: message (ready-made suggestion), discount, duration and radius. */
export function CampaignForm({ venue, plan }: { venue: Venue; plan: PlanId }) {
  const { create, access } = useCampaigns();
  const { promptUpgrade } = useUpgrade();
  const [message, setMessage] = useState<string | null>(null); // null: use the suggestion
  const [discount, setDiscount] = useState<number | null>(20);
  const [duration, setDuration] = useState(2);
  const [radius, setRadius] = useState(2);
  const [maxClaims, setMaxClaims] = useState<number | null>(null);
  // "Check-in yapana kupon": the coupon comes with a check-in at the venue
  const [checkinOnly, setCheckinOnly] = useState(false);
  // "Puanla açılan özel kupon": 0 = free (the usual)
  const [pointsPrice, setPointsPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const text = message ?? deadHourSuggestion(venue.category, discount, duration);

  const [sending, setSending] = useState(false);

  // Asked first: a campaign reaches people's phones and (later) costs money
  const ask = () => {
    const problem = validateCampaign(text);
    setError(problem);
    setSent(null);
    if (problem || sending) return;
    // This month's free campaigns are used: the monthly plan has no limit
    if (access?.next_campaign === 'unverified') return promptUpgrade(campaignCostText(access));
    if (access?.next_campaign === 'blocked') return promptUpgrade(`${campaignCostText(access)} Aylık paket'e geçersen sınırsız gönderirsin.`);
    const who = `${radius} km içindeki ${checkinOnly ? "check-in yapan kullanıcılara" : 'kullanıcılara'}`;
    const limit = maxClaims ? `, en fazla ${maxClaims} kişi` : '';
    confirmAction(
      'Kampanya gönderilsin mi?',
      `"${text}"\n${who} ${duration} saat boyunca gösterilir${limit}. ${campaignCostText(access)}`,
      'Gönder',
      send,
    );
  };

  const send = async () => {
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
      checkinOnly,
      pointsPrice: checkinOnly ? 0 : pointsPrice,
    });
    setSending(false);
    if (failure) return failure.includes('Aylık pakette') || failure.includes("Aylık paket'e") ? promptUpgrade(failure) : setError(failure);
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
      {/* Written by hand: it no longer follows the choices below */}
      {message !== null && (
        <Pressable hitSlop={8} onPress={() => setMessage(null)}>
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Seçimlere göre yeniden yaz</Text>
        </Pressable>
      )}
      <Text style={panel.label}>İndirim</Text>
      <View style={panel.wrap}>
        <Chip label="İndirim yok" active={discount === null} onPress={() => setDiscount(null)} />
        <Chip label="İndirimli" active={discount !== null} onPress={() => setDiscount(discount ?? 20)} />
      </View>
      {discount !== null && (
        <Stepper value={discount} onChange={setDiscount} min={DISCOUNT_STEP} max={90} step={DISCOUNT_STEP} format={(d) => `%${d}`} label="İndirim" />
      )}
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
      <Text style={panel.label}>Kupon kimlere?</Text>
      <View style={panel.wrap}>
        <Chip label="Herkes alabilir" active={!checkinOnly} onPress={() => setCheckinOnly(false)} />
        <Chip label="Yalnızca check-in yapanlar" active={checkinOnly} onPress={() => setCheckinOnly(true)} />
      </View>
      {checkinOnly && (
        <Text style={panel.muted}>Müşteri mekanında check-in yapınca kupon kendiliğinden verilir; hem gelir hem doluluğu bildirir.</Text>
      )}
      {!checkinOnly && (
        <>
          <Text style={panel.label}>Kupon nasıl alınsın?</Text>
          <View style={panel.wrap}>
            <Chip label="Ücretsiz" active={pointsPrice === 0} onPress={() => setPointsPrice(0)} />
            <Chip label="Puanla açılan özel kupon" active={pointsPrice > 0} onPress={() => setPointsPrice(pointsPrice || 100)} />
          </View>
          {pointsPrice > 0 && (
            <Stepper value={pointsPrice} onChange={setPointsPrice} min={POINTS_STEP} max={MAX_POINTS} step={POINTS_STEP} format={(p) => `${p} puan`} label="Puan" />
          )}
          {pointsPrice > 0 && (
            <Text style={panel.muted}>
              Puanla açılan özel kupon: uygulamayı çok kullananlara daha büyük bir indirim vermek için. Düzenli bir kullanıcı haftada
              ~50-70 puan kazanır.
            </Text>
          )}
        </>
      )}
      <Text style={panel.muted}>{campaignCostText(access)}</Text>
      {error && <Text style={panel.error}>{error}</Text>}
      {sent && <Text style={panel.success}>✓ {sent}</Text>}
      <Pressable style={[panel.primary, sending && { opacity: 0.6 }]} onPress={ask} disabled={sending}>
        <Text style={panel.primaryText}>{sending ? 'Gönderiliyor…' : 'Kampanyayı gönder'}</Text>
      </Pressable>
    </View>
  );
}
