/* ================= 鍛造：武器強化 +1 ～ +10 =================
   去城鎮的鐵匠那裡，用「礦石 + 金幣」強化武器。
   礦石分四級，越後面的地區 / 越強的怪才掉得到高級礦石 → 想強化到 +7 以上就得去危險的地方。

   強化等級   需要的礦石
   +1 ～ +3   粗鐵礦（怪物等級 1–9）
   +4 ～ +6   暗銀礦（怪物等級 10–19）
   +7 ～ +9   霜晶石（怪物等級 20 以上）
   +10        隕星鐵（只有 Boss 和地城會掉） */
import { SH, sculpt } from '../art/monsters';
import { RAR, UP_MAX, WT, refreshWeapon, upMult, wBase } from './items';
import type { Item, Player } from '../types';

export type MatKey = 'ore1' | 'ore2' | 'ore3' | 'ore4';
export const MATS: Record<MatKey, { n: string; c: string; d: string; ramp: string[] }> = {
  ore1: { n: '粗鐵礦', c: '#d8c8b0', d: '強化 +1 ～ +3', ramp: ['#3a2e24', '#6a5a48', '#9a8a70', '#d8c8b0'] },
  ore2: { n: '暗銀礦', c: '#a8bce8', d: '強化 +4 ～ +6', ramp: ['#1e2236', '#3a4466', '#6a7cb0', '#c0d0f8'] },
  ore3: { n: '霜晶石', c: '#9ae8ff', d: '強化 +7 ～ +9', ramp: ['#0e3a4e', '#2a7a9a', '#6ac8e8', '#e0faff'] },
  ore4: { n: '隕星鐵', c: '#ffb040', d: '強化 +10（Boss、地城）', ramp: ['#4a1e0a', '#a04a14', '#f09a30', '#fff0b0'] },
};
export const MAT_KEYS = Object.keys(MATS) as MatKey[];

/** 從 +up 升到 +(up+1) 要什麼。每一段的第 1、2、3 級分別要 2、3、4 顆 */
export function upCost(up: number): { mat: MatKey; n: number; gold: number } | null {
  if (up >= UP_MAX) return null;
  const mat: MatKey = up < 3 ? 'ore1' : up < 6 ? 'ore2' : up < 9 ? 'ore3' : 'ore4';
  return { mat, n: up === 9 ? 1 : 2 + up % 3, gold: [60, 90, 130, 200, 280, 380, 520, 700, 900, 1500][up] };
}
export const canUpgrade = (pl: Player, it: Item) => { const c = upCost(it.up || 0); return !!c && (pl.mats[c.mat] || 0) >= c.n && pl.gold >= c.gold; };
export function doUpgrade(pl: Player, it: Item) {
  const c = upCost(it.up || 0); if (!c || !canUpgrade(pl, it)) return false;
  pl.mats[c.mat] -= c.n; pl.gold -= c.gold; it.up = (it.up || 0) + 1; refreshWeapon(it); return true;
}
/** 強化後攻擊力的預覽（不含能力值加成） */
export const atkAt = (it: Item, up: number) => Math.round(wBase(it) * upMult(up));

/** 怪物等級 → 掉哪一級礦石（快到下一級時有一點機會掉下一級的） */
export function oreForLevel(lv: number): MatKey {
  const t = lv < 10 ? 1 : lv < 20 ? 2 : 3, next = lv % 10 >= 7 && t < 3 && Math.random() < .2;
  return ('ore' + (next ? t + 1 : t)) as MatKey;
}

/* 掉在地上的礦石：小石頭 + 亮色結晶（跟魂晶一樣會自己飛過來） */
export const ORE_SP = Object.fromEntries(MAT_KEYS.map(k => [k, sculpt(12, 12, [
  { sh: SH.ell(6, 8, 5, 3.6), ramp: ['#1e1a22', '#3a3440', '#5a5260'], grp: 1 },
  { sh: SH.poly([[4, 8], [6, 1], [8, 8]]), ramp: MATS[k].ramp, grp: 2 },
  { sh: SH.poly([[7, 9], [9.5, 4], [11, 9]]), ramp: MATS[k].ramp, grp: 3 },
], a => { a.set(6, 3, '#ffffff'); })])) as Record<MatKey, HTMLCanvasElement>;
export const ORE_URL = Object.fromEntries(MAT_KEYS.map(k => { const c = ORE_SP[k], q = document.createElement('canvas'); q.width = q.height = 32; const g = q.getContext('2d');
  g.imageSmoothingEnabled = false; g.drawImage(c, 4, 4, 24, 24); try { return [k, q.toDataURL()]; } catch (e) { return [k, '']; } })) as Record<MatKey, string>;

/* ---- 舊存檔：武器以前有物品等級，攻擊 = 基礎 ×（1 + 0.13 ×（等級 − 1））× 稀有度倍率。
   換算成「攻擊力最接近的強化等級」，所以讀檔後武器差不多一樣強（最多 +10） ---- */
export function migrateWeapon(it: Item) {
  if (!WT[it.type] || it.up !== undefined) return it;
  const old = (1 + .13 * ((it.ilvl || 1) - 1)) * (RAR[it.rarity]?.m || 1);
  it.up = Math.max(0, Math.min(UP_MAX, Math.round((old - 1) / .32))); it.ilvl = 0; it.slot = 'weapon';
  return refreshWeapon(it);
}
