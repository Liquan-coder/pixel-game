/* ================= 開發用：測試版（地圖全開 + 全部武器） =================
   打開 http://localhost:5173/?test 就直接進一個新遊戲：
   · 地圖全開：大地圖 / 小地圖整張都畫出來、所有地名都算發現過、所有營火都點亮（可以直接傳送到任何地方）
   · 背包裡放好每一種武器（每一種一般武器 + 全部獨特武器），打開背包就能換
   · 六種能力值都拉到 99（每一把武器都拿得動）
   · 星狼、4 格飾品欄直接開（G.lab = true 時 game/mount.ts 的 hasWolf、ui/menus.ts 的 tSlots 都算全開）
   · 主角跟正常一樣會受傷、會死（要打不死、要叫怪 → 用 ?lab）
   · **不會存檔**（G.lab = true 時 save / clearSave 什麼都不做），你的存檔格完全不動
   只有開發模式（npm run dev）才會載入這個檔案，上線的版本裡沒有它。 */
import { G } from '../core/state';
import { WT, makeUnique, makeWeapon } from '../data/items';
import { UQ } from '../data/uniques';
import { CAMPS, SUBS, discovered, explored } from '../world/map';
import { DUNGEONS } from '../world/dungeons';
import { redrawMini } from '../world/minimap';
import { toast } from '../ui/hud';
import { recalc } from '../game/player';

export function startTest(startGame: (cont: boolean) => void) {
  G.lab = true;                                                         // 先關掉存檔
  startGame(false);
  openAll();
  setTimeout(() => toast('測試版：地圖全開、能力拉滿、背包有全部武器（不會存檔）', '#c8a8ff'), 300);
}

/* 全開：地圖、地名、營火、全部武器、能力值拉滿（星狼、飾品欄在 G.lab 時本來就全開）。?test 和 ?lab 都用這個
   能力值沒有上限，但每一點越來越弱：大約 92 點以後幾乎沒差 → 拉到 99 就算滿 */
const ATTR_FULL = 99;
export function openAll() {
  explored.fill(1); redrawMini();                                      // 每一格都算看過
  for (const s of SUBS) discovered.add(s.name);                        // 大地圖上的地名全部顯示
  for (const d of DUNGEONS) discovered.add(d.name);
  for (const c of CAMPS) c.lit = true;                                 // 營火全亮 → 大地圖點了就能傳送
  const pl = G.me, have = pl.weapon.type;
  for (const t of Object.keys(WT)) if (t !== have) pl.inv.push(makeWeapon(t));
  for (const k of Object.keys(UQ)) pl.inv.push(makeUnique(k));
  for (const k of ['vit', 'end', 'str', 'dex', 'int', 'luk']) pl[k] = ATTR_FULL;   // 每一把武器的需求都夠
  recalc(pl); pl.hp = pl.maxHp; pl.st = pl.maxSt;
}
