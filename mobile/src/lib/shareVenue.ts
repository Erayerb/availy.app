import { Platform, Share } from 'react-native';

import type { Venue } from './api';
import { shareMessage } from './share';

/** System share sheet; on browsers without it, copy the text instead. Returns a note for the user. */
export async function shareVenue(venue: Venue): Promise<string | null> {
  const message = shareMessage(venue);
  try {
    const browser = typeof navigator !== 'undefined' ? (navigator as Navigator) : null;
    if (Platform.OS === 'web' && browser && typeof browser.share !== 'function') {
      await browser.clipboard.writeText(message);
      return 'Bağlantı kopyalandı.';
    }
    await Share.share({ message });
    return null;
  } catch {
    return 'Paylaşılamadı.';
  }
}
