/* ================= 地城 Boss 的圖 =================
   從參考圖描下來的格子圖，放在 art/bossArt.ts（db_ 開頭的那些）。
   SPR 的名字 = 'db_' + world/dungeonBoss.ts 的 DBOSS 編號。第一次用到才畫。 */
import { SPR, makeHD } from './monsters';
import { BOSS_ART, bossCanvas } from './bossArt';

for (const k of Object.keys(BOSS_ART)) {
  if (!k.startsWith('db_')) continue;
  Object.defineProperty(SPR, k, { configurable: true, enumerable: true, get() { const v = makeHD(bossCanvas(k)); Object.defineProperty(SPR, k, { value: v, writable: true, enumerable: true, configurable: true }); return v; } });
}
