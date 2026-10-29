/** v2 levels (worked out on the server, app/levels.py): what each needs and what it brings, for the Seviyeler page. */
import type { Level } from './safety.ts';

export type LevelInfo = { id: Level['id']; name: string; needs: string; perks: string[] };

export const LEVELS: LevelInfo[] = [
  {
    id: 'newcomer',
    name: 'Yeni Gelen',
    needs: 'Kayıt olunca',
    perks: ["Check-in'lerden puan kazanırsın", 'Rozet toplamaya başlarsın'],
  },
  {
    id: 'explorer',
    name: 'Kâşif',
    needs: '100 puan ya da 1 keşif (bir mekanın ilk check-in’i)',
    perks: ['Profilinde ve sıralamada Kâşif simgesi', 'Hoş geldin kuponu (yakında)'],
  },
  {
    id: 'local',
    name: 'Mahalleli',
    needs: '500 puan ve 3 mekanda en az 3 check-in',
    perks: ['Kurucu kafelerde ikram ve indirimler (yakında)', 'Mahalleli simgesi'],
  },
  {
    id: 'ambassador',
    name: 'Semt Elçisi',
    needs: '2.000 puan ve bir semtte 10 farklı mekan',
    perks: ['Yeni özelliklere erken erişim (yakında)', 'Her ay 1 ay Premium (yakında)', 'Profil fotoğrafında çerçeve'],
  },
];
