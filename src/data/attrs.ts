/* ================= 能力值 =================
   六種能力值，每種一開始都是 5。升一級 = 選一種 +1。
   每一點的效果會越來越少（20 點以前最有感、40 點以後很少），數值才不會無限膨脹。

   武器用「加成」決定吃哪種能力值：例如戰鎚吃力量、法杖吃智識、太刀吃敏捷。
   裝備有「需求」：能力值不夠就不能裝上。 */
import { LV_K } from './levels';
import type { Item, Player } from '../types';

export type AttrKey = 'vit' | 'end' | 'str' | 'dex' | 'int' | 'luk';
export const ATTR_BASE = 5;
export const ATTRS: { k: AttrKey; n: string; d: string }[] = [
  { k: 'vit', n: '體魄', d: '生命上限' },
  { k: 'end', n: '耐力', d: '體力上限、少量防禦' },
  { k: 'str', n: '力量', d: '重武器的傷害（斧、鎚、劍）' },
  { k: 'dex', n: '敏捷', d: '快武器的傷害（短刀、太刀、長槍）、攻擊速度' },
  { k: 'int', n: '智識', d: '魔法武器的傷害（法杖、鐮刀）、技能冷卻' },
  { k: 'luk', n: '幸運', d: '暴擊率、怪物比較常掉素材' },
];
export const ATTR_NAME: Record<AttrKey, string> = Object.fromEntries(ATTRS.map(a => [a.k, a.n])) as any;

/* 遞減曲線：從 5 點開始算（先 ÷ LV_K），每點的價值 → 前 37 點 1、再 50 點 0.6、之後 0.2（以 LV_K = 2.5 算） */
// ÷ LV_K：等級尺度放大 2.5 倍（data/levels.ts），每一點的效果跟著變小
export function soft(v: number) { const x = Math.max(0, v - ATTR_BASE) / LV_K; return Math.min(x, 15) + .6 * Math.max(0, Math.min(x - 15, 20)) + .2 * Math.max(0, x - 35); }

/* 武器加成：每種能力值的係數（加起來大約 1）。字母只是給玩家看的：S ≥ 1、A ≥ .75、B ≥ .5、C ≥ .3、D > 0 */
export const WSCALE: Record<string, Partial<Record<AttrKey, number>>> = {
  sword: { str: .55, dex: .45 }, dagger: { dex: 1 }, axe: { str: 1.05 }, hammer: { str: 1.2 }, spear: { str: .35, dex: .7 },
  katana: { dex: .85, str: .25 }, scythe: { dex: .5, int: .55 }, staff: { int: 1.15 }, wolfblade: { dex: .75, str: .35 },
  bow: { dex: .95 }, greatsword: { str: 1.1, end: .1 }, rapier: { dex: 1.05 },
  crescent: { dex: .6, str: .45 }, twinblade: { dex: .8, str: .3 }, darkmoon: { str: .55, int: .6 },
  elfbow: { dex: .8, int: .3 }, elfrapier: { dex: .9, int: .25 }, elfblades: { dex: 1 },
};
export const grade = (c: number) => c >= 1 ? 'S' : c >= .75 ? 'A' : c >= .5 ? 'B' : c >= .3 ? 'C' : c > 0 ? 'D' : '-';

/* 武器需求：每種武器固定（不會因為在哪裡撿到而改變，強化也不會提高需求）。
   起始的長劍是 5/5，剛開始就能拿 */
const REQW: Record<string, Partial<Record<AttrKey, number>>> = {
  sword: { str: 5, dex: 5 }, dagger: { dex: 8 }, axe: { str: 11 }, spear: { str: 7, dex: 9 }, staff: { int: 9 },
  katana: { dex: 11, str: 6 }, hammer: { str: 15, end: 8 }, scythe: { dex: 9, int: 9 }, wolfblade: { dex: 12, str: 9 },
  bow: { dex: 10 }, greatsword: { str: 16, end: 9 }, rapier: { dex: 12 },
  crescent: { dex: 12, str: 10 }, twinblade: { dex: 13, str: 8 }, darkmoon: { str: 16, int: 16 },
  elfbow: { dex: 14, int: 9 }, elfrapier: { dex: 15, int: 8 }, elfblades: { dex: 16 },
};
/** 獨特武器可以有自己的需求 / 加成（data/uniques.ts 會填進來） */
export const UQ_REQ: Record<string, Partial<Record<AttrKey, number>>> = {}, UQ_SCALE: Record<string, Partial<Record<AttrKey, number>>> = {};
export const scaleOf = (it: Item) => (it.uq && UQ_SCALE[it.uq]) || WSCALE[it.type] || {};
/* 防具需求：看類型（重甲要力量和耐力、中甲要一點耐力、輕甲誰都能穿），獨特的再高一點 */
const REQ: Record<string, Partial<Record<AttrKey, number>>> = { mail: { str: 10, end: 8 }, leather: { end: 7 }, robe: {} };
const scaleReq = (r: Partial<Record<AttrKey, number>>) => { const o: Partial<Record<AttrKey, number>> = {}; for (const k in r) o[k] = ATTR_BASE + Math.round((r[k] - ATTR_BASE) * LV_K); return o; };   // 需求也照等級尺度放大
export function reqOf(it: Item): Partial<Record<AttrKey, number>> {
  if (it.uq && UQ_REQ[it.uq]) return scaleReq(UQ_REQ[it.uq]);
  if (REQW[it.type]) return scaleReq(REQW[it.type]);
  const R = REQ[it.type], out: Partial<Record<AttrKey, number>> = {}; if (!R) return out;
  for (const k in R) out[k] = R[k] + (it.ug ? 3 : 0);
  return scaleReq(out);
}
export function unmet(pl: Player, it: Item | null): AttrKey[] { if (!it) return []; const r = reqOf(it); return (Object.keys(r) as AttrKey[]).filter(k => (pl[k] ?? ATTR_BASE) < r[k]); }
export const meets = (pl: Player, it: Item | null) => unmet(pl, it).length === 0;

/* 武器的實際攻擊力：基礎攻擊 ×（1 + Σ 係數 × 6% × 遞減點數）。需求不夠的話只剩 60%（正常玩不會發生：不夠就不能裝備） */
const scaleBonus = (pl: Player, w: Item) => { const S = scaleOf(w); let b = 0; for (const k in S) b += S[k] * .06 * soft(pl[k] ?? ATTR_BASE); return b; };
export function weaponAtk(pl: Player, w: Item) { return Math.round(w.atk * (1 + scaleBonus(pl, w)) * (meets(pl, w) ? 1 : .6)); }
/* 給卡片看的「基礎 + 加成」（像法環的 128 + 34）：base = 武器本身（含強化），bonus = 你的能力值多給的。
   例：法杖 base 10、智識 S，智識 5 點 → 10 + 0；智識 20 點 → 10 + 10 */
export function atkSplit(pl: Player, w: Item, base = w.atk) { const total = Math.round(base * (1 + scaleBonus(pl, w))); return { base, bonus: total - base, total }; }
/* 舊存檔（只有體魄 / 力量 / 耐力，從 1 開始）→ 新的六種能力值（從 5 開始），等級不變 */
export function migrateAttrs(d) {
  const a = d.v >= 5 ? { vit: d.vit, end: d.end, str: d.str, dex: d.dex, int: d.int, luk: d.luk }
    : { vit: (d.vit || 1) + 4, end: (d.end || 1) + 4, str: (d.str || 1) + 4, dex: ATTR_BASE, int: ATTR_BASE, luk: ATTR_BASE };
  if (!(d.v >= 9)) for (const k in a) a[k] = ATTR_BASE + Math.round((a[k] - ATTR_BASE) * LV_K);   // v9：等級尺度 ×2.5 → 舊角色的能力值也 ×2.5，強度不變
  return a;
}
