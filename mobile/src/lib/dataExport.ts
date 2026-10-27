/** v2 "Verilerimi indir" (KVKK): everything the server keeps about me, saved as one JSON file. */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { send } from './accountApi';

export const fetchMyData = (token: string) => send<Record<string, unknown>>('GET', '/v1/me/export', undefined, token);

/** File name like "availy-verilerim-2026-10-27.json". */
export const exportFileName = (now: Date) => `availy-verilerim-${now.toISOString().slice(0, 10)}.json`;

/**
 * Downloads my data: the browser saves the file; the phone writes it and opens the share sheet
 * (save to Files, send by e-mail, …). Resolves to an error message, or null.
 */
export async function downloadMyData(token: string): Promise<string | null> {
  try {
    const data = await fetchMyData(token);
    const text = JSON.stringify(data, null, 2);
    const name = exportFileName(new Date());
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      return null;
    }
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    if (!(await Sharing.isAvailableAsync())) return 'Bu cihazda dosya paylaşılamıyor.';
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Verilerim' });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Veriler indirilemedi.';
  }
}
