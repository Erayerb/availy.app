import { useEffect } from 'react';

import { useCampaigns } from '../context/CampaignsContext';
import { useEngagement } from '../context/EngagementContext';
import { useSettings } from '../context/SettingsContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { fetchVenuesByIds } from '../lib/api';
import { decideBusinessActions, type MonitorState } from '../lib/businessMonitor';
import { deadHourSuggestion } from '../lib/campaigns';
import { KEYS } from '../lib/storage';

const CHECK_MS = 60_000;

const parse = (raw: unknown): Record<string, MonitorState> =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, MonitorState>) : {};

/**
 * Runs for a signed-in business while the app is open: dead-hour reminder and,
 * if enabled in Ayarlar, an automatic ready-made campaign. Renders nothing.
 */
export function BusinessMonitor({ venueId }: { venueId: number }) {
  const { deadHourAlerts, autoCampaign } = useSettings();
  const { activeFor, create } = useCampaigns();
  const { notify } = useEngagement();
  const [states, setStates] = usePersistentState(KEYS.monitor, {} as Record<string, MonitorState>, parse);

  useEffect(() => {
    const check = async () => {
      try {
        const [venue] = await fetchVenuesByIds([venueId]);
        if (!venue) return;
        const now = new Date();
        const actions = decideBusinessActions(
          venue,
          states[venueId] ?? {},
          { deadHourAlerts, autoCampaign, hasActiveCampaign: activeFor(venueId) !== null },
          now,
        );
        if (actions.autoCampaign) {
          create({
            venueId,
            venueName: venue.name,
            lat: venue.lat,
            lon: venue.lon,
            message: deadHourSuggestion(venue.category),
            discount: 20,
            durationHours: 2,
            radiusKm: 2,
          });
          notify('Otomatik kampanya gönderildi', `${venue.name} şu an sakin görünüyor; 2 km içindekilere %20 indirim gitti.`, true);
        } else if (actions.alert) {
          notify('Ölü saat', `${venue.name} şu an sakin görünüyor. Panelden tek dokunuşla kampanya gönderebilirsin.`, true);
        }
        if (actions.alert || actions.autoCampaign) {
          const stamp = now.toISOString();
          setStates((s) => ({
            ...s,
            [venueId]: {
              ...s[venueId],
              ...(actions.alert || actions.autoCampaign ? { lastAlertAt: stamp } : {}),
              ...(actions.autoCampaign ? { lastAutoAt: stamp } : {}),
            },
          }));
        }
      } catch {
        // Try again on the next check
      }
    };
    check();
    const timer = setInterval(check, CHECK_MS);
    return () => clearInterval(timer);
  }, [venueId, deadHourAlerts, autoCampaign, states, activeFor, create, notify, setStates]);

  return null;
}
