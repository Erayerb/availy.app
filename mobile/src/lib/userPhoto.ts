/** v2 profile photos (instead of the user name's first letter). */
import { send } from './accountApi.ts';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/** A person's photo; `version` (their photo_at, when known) makes a changed photo load again. */
export const userPhotoUrl = (username: string, version?: string | null) =>
  `${API_URL}/v1/users/${encodeURIComponent(username)}/photo${version ? `?v=${encodeURIComponent(version)}` : ''}`;

export const userPhotoApi = {
  save: (token: string, dataUri: string) => send<{ photo_at: string }>('PUT', '/v1/me/photo', { photo: dataUri }, token),
  remove: (token: string) => send<void>('DELETE', '/v1/me/photo', undefined, token),
};
