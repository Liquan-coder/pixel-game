/* ================= Boss 的強度和獎勵（平衡用） =================
   主線 / 區域 Boss（world/regionBoss.ts 的 RBDEF）的招式傷害原本是寫死的數字（例如 42），不會跟著等級變強，
   所以後期的 Boss 打人比小怪還不痛。這裡依 Boss 的等級設定傷害倍率（dmgMul），跟地城 Boss（10 + 3 × 等級）同一條曲線。
   獎勵：每隻 Boss 一件有名字的獨特裝備（data/uniques.ts 的 UG）。

   數值要調整：改 BOSS_K（scripts/balance.mjs 會印出「被 Boss 打幾下會死」）。
   為什麼寫在這裡而不是 regionBoss.ts：那個檔案管 Boss 的位置和招式，這裡只管數字，兩邊分開改不會打架。 */
import { tier } from '../data/levels';
import { RBDEF } from '../world/regionBoss';
import { makeUnique, makeUniqueGear } from '../data/items';

/* ---- Boss 血量倍率：每隻 Boss 的血量都乘上這個（區域 / 主線 / 地城 Boss 都算，world/regionBoss.ts 的 makeRB） ---- */
export const BOSS_HP = 1.6;
/* ---- Boss 給的魂晶倍率（區域 / 地城 Boss 都算，world/regionBoss.ts 的 regionBossDie）。1 = 表上寫的數字；.6 = 打王不會一次跳好幾級 ---- */
export const BOSS_SOULS = .6;

export { gapDealt, gapTaken } from '../data/levels';                 // 等級差的公式放在 data/levels.ts（刻印效果也要用，放這裡會 import 繞一圈）

export const BOSS_K = 1;                                                 // 整體倍率：1 = 跟地城 Boss 一樣痛（.85 = 穿好裝的人能扛 6 下左右，npm run balance）
export const BOSS_REF = 34;                                              // 主線 Boss 招式的「標準一擊」大約是 34
export const bossMul = (lv: number) => BOSS_K * (10 + 3 * tier(lv)) / BOSS_REF;

const REWARD: Record<string, string> = {
  queen: 'queenheart', general: 'rustplate', mushking: 'sporering',
  mossguard: 'mossvest', mistwitch: 'duskrobe', sandgiant: 'ochrering', slagmother: 'boilheart', frostwyrm: 'wyrmscale', toxqueen: 'purplering',
};
const UNIQUE_W: Record<string, string> = { dragon: 'emberstaff', yeti: 'frostmaul', lich: 'rotscythe' };   // 這三隻掉獨特武器（原本就是）
/* 等所有程式都載入完才改（這個檔案被 combat.ts 引入時，regionBoss.ts 可能還沒跑完 → RBDEF 還不能用） */
queueMicrotask(() => { for (const d of Object.values(RBDEF) as any[]) {
  if (d.dg || d.ai === 'dgn') continue;                                  // 地城 Boss（和用同一套招式的精靈王）的傷害本來就照等級算（world/bossAI3.ts），獎勵另外設定
  d.dmgMul = bossMul(d.lv);
  if (REWARD[d.id]) { const k = REWARD[d.id]; d.reward = () => makeUniqueGear(k); }
  else if (UNIQUE_W[d.id]) { const k = UNIQUE_W[d.id]; d.reward = () => makeUnique(k); }
} });
