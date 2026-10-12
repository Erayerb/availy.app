/**
 * Venue ownership check (prototype). In the real app the code goes by SMS to
 * the venue's registered phone or a document is reviewed; here the demo code
 * is shown on screen.
 */
export const VERIFICATION_METHODS = [
  { id: 'sms', label: 'Mekan telefonuna SMS' },
  { id: 'document', label: 'Vergi levhası / işletme belgesi' },
] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number]['id'];

export function verificationCode(random: () => number = Math.random): string {
  return String(Math.floor(100000 + random() * 900000));
}

export const codeMatches = (expected: string, typed: string) => typed.replace(/\D/g, '') === expected;
