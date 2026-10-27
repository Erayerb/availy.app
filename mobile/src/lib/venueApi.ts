/** v2: the business profile of a venue (cover photo, Instagram, phone) and "Mekan ekle". */
import { send } from './accountApi.ts';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const VENUE_CATEGORIES = [
  { id: 'cafe', label: 'Kafe' },
  { id: 'restaurant', label: 'Restoran' },
  { id: 'bar', label: 'Bar' },
  { id: 'coworking', label: 'Ortak çalışma' },
  { id: 'library', label: 'Kütüphane' },
] as const;

export type NewVenue = {
  name: string;
  category: string;
  lat: number; // the venue's point (from the map or the phone)
  lon: number;
  neighborhood: string;
  district: string;
  address: string; // street and number
  // Where the user is: a customer must be near the venue (a business may add its own from anywhere)
  user_lat?: number;
  user_lon?: number;
  confirm_near?: boolean; // "Yine de ekle": another venue is right at that spot
};

export type BusinessRequest = { has_business: boolean; count: number; mine: boolean };

/** The cover photo; `photoAt` changes with every upload, so an old picture is never shown. */
export const photoUrl = (venueId: number, photoAt: string) =>
  `${API_URL}/v1/venues/${venueId}/photo?v=${encodeURIComponent(photoAt)}`;

/** "instagram.com/kafe" for a handle. */
export const instagramUrl = (handle: string) => `https://instagram.com/${handle}`;

/** "tel:" link without spaces. */
export const phoneUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export type VenueDetails = {
  name: string;
  open_hour: number;
  close_hour: number; // <= open_hour: closes after midnight
  tags: string[];
  amenities: string[];
  description: string;
};

export const venueApi = {
  // "Mekan bilgilerini düzenle" (the venue's business)
  saveDetails: (token: string, venueId: number, details: VenueDetails) =>
    send<void>('PUT', `/v1/venues/${venueId}/details`, details, token),
  saveLinks: (token: string, venueId: number, instagram: string, phone: string) =>
    send<{ instagram: string | null; phone: string | null }>('PUT', `/v1/venues/${venueId}/profile`, { instagram, phone }, token),
  // Address line, neighbourhood / district and the map point ("Yol tarifi" goes there)
  saveAddress: (
    token: string,
    venueId: number,
    place: { address: string; neighborhood: string; district: string; lat: number; lon: number },
  ) =>
    send<{ address: string | null; neighborhood: string; district: string; lat: number; lon: number }>(
      'PUT',
      `/v1/venues/${venueId}/address`,
      place,
      token,
    ),
  savePhoto: (token: string, venueId: number, photo: string) =>
    send<{ photo_at: string }>('PUT', `/v1/venues/${venueId}/photo`, { photo }, token),
  // "İşletmeye haber ver": venues without a business account
  businessRequest: (venueId: number, token?: string) =>
    send<BusinessRequest>('GET', `/v1/venues/${venueId}/business-request`, undefined, token),
  askBusiness: (token: string, venueId: number) =>
    send<BusinessRequest>('POST', `/v1/venues/${venueId}/business-request`, undefined, token),
  add: (token: string, venue: NewVenue) => send<{ id: number; name: string }>('POST', '/v1/venues', venue, token),
};
