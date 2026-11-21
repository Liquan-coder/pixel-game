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

/* ---- 等級差：怪比你高幾級，你就被打得比較痛、打牠比較不痛（不顯示在畫面上，玩家只會覺得「這裡好難」）----
   差距用 tier 算（每 2.5 級 = 以前的 1 級）。例：你 25 級打 50 級的 Boss → 被打 ×1.5、打牠 ×0.65；你 50 級打 25 級的怪 → 被打 ×0.8、打牠 ×1.1
   上限：被打最多 ×2、最少 ×0.6；打牠最少 ×0.4、最多 ×1.2 */
export function gapTaken(srcLv: number, plLv: number) { if (!srcLv) return 1; const g = tier(srcLv - plLv); return g > 0 ? Math.min(2, 1 + .05 * g) : Math.max(.6, 1 + .02 * g); }
export function gapDealt(plLv: number, eLv: number) { if (!eLv) return 1; const g = tier(eLv - plLv); return g > 0 ? Math.max(.4, 1 - .035 * g) : Math.min(1.2, 1 - .01 * g); }

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
  if (d.dg) continue;                                                    // 地城 Boss 的傷害本來就照等級算（world/bossAI3.ts），獎勵是地城的招牌裝備
  d.dmgMul = bossMul(d.lv);
  if (REWARD[d.id]) { const k = REWARD[d.id]; d.reward = () => makeUniqueGear(k); }
  else if (UNIQUE_W[d.id]) { const k = UNIQUE_W[d.id]; d.reward = () => makeUnique(k); }
} });
