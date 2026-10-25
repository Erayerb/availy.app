/** v2 groups ("Grup oluştur"): a few people with their own ranking (Sosyal > Sıralama > Gruplar). */
import { send } from './accountApi.ts';

export const MAX_GROUP_NAME = 40;

export type Group = {
  id: number;
  name: string;
  status: 'member' | 'invited';
  invited_by: string | null;
  members: number;
};

export const groupsApi = {
  mine: (token: string) => send<Group[]>('GET', '/v1/groups', undefined, token),
  create: (token: string, name: string, usernames: string[]) =>
    send<{ id: number; invited: string[] }>('POST', '/v1/groups', { name, usernames }, token),
  invite: (token: string, groupId: number, usernames: string[]) =>
    send<string[]>('POST', `/v1/groups/${groupId}/invite`, { usernames }, token),
  join: (token: string, groupId: number) => send<void>('POST', `/v1/groups/${groupId}/join`, undefined, token),
  // Leave, or turn the invitation down
  leave: (token: string, groupId: number) => send<void>('DELETE', `/v1/groups/${groupId}/membership`, undefined, token),
};

export type Candidate = { username: string; why: string };

/**
 * Who to offer when creating a group or inviting more: friends first, then people around
 * (availy's suggestions: mutual friends, the same venues); each once, without the ones left out.
 */
export function groupCandidates(
  friends: { username: string }[],
  suggested: { username: string; mutual: number; shared_venues: number }[],
  leaveOut: string[] = [],
): Candidate[] {
  const seen = new Set(leaveOut);
  const out: Candidate[] = [];
  for (const f of friends) {
    if (seen.has(f.username)) continue;
    seen.add(f.username);
    out.push({ username: f.username, why: 'Arkadaşın' });
  }
  for (const p of suggested) {
    if (seen.has(p.username)) continue;
    seen.add(p.username);
    out.push({
      username: p.username,
      why: p.shared_venues > 0 ? 'Aynı mekanlara gidiyorsunuz' : p.mutual > 0 ? `${p.mutual} ortak arkadaş` : 'Çevrende',
    });
  }
  return out;
}
