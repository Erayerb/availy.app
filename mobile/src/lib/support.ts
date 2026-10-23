/** Bug reports and contact messages sent from the app to the server (support_messages). */
import { send } from './accountApi.ts';

export type SupportKind = 'bug' | 'contact';

export const SUPPORT_TOPICS: Record<SupportKind, string[]> = {
  bug: ['Uygulama hatası', 'Yanlış mekan bilgisi', 'Doluluk yanlış görünüyor', 'Öneri'],
  contact: ['Genel', 'İşletme / iş birliği', 'Hesap', 'Gizlilik (KVKK)'],
};

export type SupportMessage = {
  kind: SupportKind;
  topic: string;
  text: string;
  email: string; // where we can reply; empty for anonymous bug reports
};

export const MIN_TEXT = 10;
export const MAX_TEXT = 1000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSupport(kind: SupportKind, text: string, email: string): string | null {
  const body = text.trim();
  if (body.length < MIN_TEXT) return `En az ${MIN_TEXT} karakter yaz.`;
  if (body.length > MAX_TEXT) return `En fazla ${MAX_TEXT} karakter yazabilirsin.`;
  const mail = email.trim();
  if (kind === 'contact' && !mail) return 'Sana dönebilmemiz için e-posta adresini yaz.';
  if (mail && !EMAIL.test(mail)) return 'Geçerli bir e-posta adresi yaz.';
  return null;
}

export const supportApi = {
  send: (m: Pick<SupportMessage, 'kind' | 'topic' | 'text' | 'email'>, appInfo: string, token?: string) =>
    send<{ id: number }>('POST', '/v1/support', { kind: m.kind, topic: m.topic, body: m.text, email: m.email, app_info: appInfo }, token),
};
