import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
    View,
  type LayoutChangeEvent,
} from 'react-native';

import type { Venue } from '../lib/api';
import type { Campaign } from '../lib/campaigns';
import { formatDistance } from '../lib/geo';
import { CrowdDot } from './CrowdDot';
import { useSettings } from '../context/SettingsContext';
import { crowdRatioText } from '../lib/crowd';
import { colors, themed } from '../theme';

// Every row has the same height so exactly 4 fit; more alternatives scroll
const ROW_HEIGHT = 50;
const ROW_GAP = 6;
const VISIBLE_ROWS = 4;
const LIST_HEIGHT = VISIBLE_ROWS * ROW_HEIGHT + (VISIBLE_ROWS - 1) * ROW_GAP;

type Props = {
  venue: Venue;
  alternatives: { venue: Venue; distanceKm: number; hasCampaign: boolean }[];
  campaignFor: (venueId: number) => Campaign | null;
  onChoose: (venue: Venue) => void;
  onClose: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** Shown for a crowded venue: quieter similar places nearby (the "Mert" scenario). */
export function AlternativesPopup({
  venue,
  alternatives,
  campaignFor,
  onChoose,
  onClose,
  onLayout,
}: Props) {
  const { crowdLook } = useSettings();

  return (
    <View style={styles.popup} onLayout={onLayout}>
      <View style={styles.header}>
        <Text style={styles.title}>Burası şu an kalabalık{crowdRatioText(venue.crowd) ? ` (${crowdRatioText(venue.crowd)})` : ''}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        {alternatives.length > 0
          ? 'Yakında yer olan benzer mekanlar:'
          : 'Şu an 2 km içinde daha boş benzer mekan yok.'}
      </Text>
      <ScrollView
        style={{ maxHeight: LIST_HEIGHT }}
        contentContainerStyle={styles.list}
        nestedScrollEnabled
      >
        {alternatives.map(({ venue: alt, distanceKm, hasCampaign }) => {
          const campaign = hasCampaign ? campaignFor(alt.id) : null;
          return (
            <Pressable
              key={alt.id}
              onPress={() => onChoose(alt)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <CrowdDot venue={alt} />
              <View style={styles.nameBox}>
                <Text style={styles.name} numberOfLines={1}>
                  {alt.name}
                </Text>
                {campaign && (
                  <Text style={styles.campaign} numberOfLines={1}>
                    🏷️ {campaign.discount !== null ? `%${campaign.discount} indirim` : 'Kampanya'}
                  </Text>
                )}
              </View>
              <Text style={styles.meta}>{formatDistance(distanceKm)}</Text>
              <Text style={styles.percent}>{crowdRatioText(alt.crowd) ?? crowdLook(alt).label}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  popup: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 28,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    gap: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.primary },
  close: { fontSize: 16, color: colors.textMuted },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 2 },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.cream,
  },
  pressed: { opacity: 0.7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  list: { gap: ROW_GAP },
  nameBox: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  campaign: { fontSize: 12, fontWeight: '600', color: colors.primary },
  meta: { fontSize: 12, color: colors.textMuted },
  percent: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    width: 40,
    textAlign: 'right',
  },
  chevron: { fontSize: 18, color: colors.textMuted },
}));
