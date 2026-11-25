/** v2 levels (worked out on the server, app/levels.py): what each needs and what it brings, for the Seviyeler page. */
import type { Level } from './safety.ts';

export type LevelInfo = { id: Level['id']; name: string; needs: string; perks: string[] };

export const LEVELS: LevelInfo[] = [
  {
    id: 'newcomer',
    name: 'Yeni gelen',
    needs: 'Kayıt olunca',
    perks: ["Check-in'lerden puan kazanırsın", 'Rozet toplamaya başlarsın'],
  },
  {
    id: 'explorer',
    name: 'Kâşif',
    needs: '100 puan ya da 1 keşif (bir mekanın ilk check-in’i)',
    perks: ['Profilinde ve sıralamada Kâşif simgesi', 'Hoş geldin hediyesi: bir mekan ödülünü puansız al', '+30 puan'],
  },
  {
    id: 'local',
    name: 'Mahalleli',
    needs: '500 puan ve 3 mekanda en az 3 check-in',
    perks: ['1 hafta ücretsiz availo+', 'Mahalleli simgesi', '+30 puan'],
  },
  {
    id: 'ambassador',
    name: 'Semt elçisi',
    needs: '2.000 puan, bir semtte 10 farklı mekan ve bütün rozetler (ilk adım görevleri dahil)',
    perks: ['1 ay ücretsiz availo+', 'Profil fotoğrafında altın çerçeve', '+30 puan', 'Yeni özelliklere erken erişim (yakında)'],
  },
];
