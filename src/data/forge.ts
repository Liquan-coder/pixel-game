/* ================= 鍛造：武器 +1 ～ +10、防具 +1 ～ +5 =================
   去城鎮的鐵匠那裡，用「素材 + 金幣」強化。素材是各地區的怪物掉的（越深的地區，素材越高級），
   最後一級（武器 +10）要「魂核」：主線 / 區域 Boss 各掉一顆。

   武器       需要的素材
   +1、+2     狼牙（翠風平原）
   +3、+4     菌絲（迷霧森林）
   +5、+6     骨片（骸骨荒地）
   +7         熔岩核（熔岩高地）
   +8         冰晶（霜寒雪原）
   +9         腐沼珠（幽影沼澤）
   +10        魂核（Boss）
   防具 +1 ～ +5 依序用狼牙、菌絲、骨片、熔岩核、冰晶 */
import { SH, sculpt } from '../art/monsters';
import { RAR, UP_MAX, WT, refreshWeapon, upMult, wBase } from './items';
import { A_UP_MAX } from './gear';
import type { Item, Player } from '../types';

export type MatKey = 'mat1' | 'mat2' | 'mat3' | 'mat4' | 'mat5' | 'mat6' | 'core';
export const MATS: Record<MatKey, { n: string; c: string; d: string; ramp: string[] }> = {
  mat1: { n: '狼牙', c: '#efe6d2', d: '翠風平原的怪物 · 武器 +1、+2', ramp: ['#4a4030', '#8a7e64', '#c8bc9e', '#fff6e0'] },
  mat2: { n: '菌絲', c: '#9ae08a', d: '迷霧森林的怪物 · 武器 +3、+4', ramp: ['#1e3a1a', '#3a6a30', '#6aaa52', '#c0f0a8'] },
  mat3: { n: '骨片', c: '#e0d0a8', d: '骸骨荒地的怪物 · 武器 +5、+6', ramp: ['#3a2e1e', '#7a6646', '#b8a47a', '#f0e4c0'] },
  mat4: { n: '熔岩核', c: '#ff9a4a', d: '熔岩高地的怪物 · 武器 +7', ramp: ['#4a1408', '#a03a14', '#f07a2a', '#ffd890'] },
  mat5: { n: '冰晶', c: '#9ae8ff', d: '霜寒雪原的怪物 · 武器 +8', ramp: ['#0e3a4e', '#2a7a9a', '#6ac8e8', '#e0faff'] },
  mat6: { n: '腐沼珠', c: '#c8a0f0', d: '幽影沼澤的怪物 · 武器 +9', ramp: ['#2a1640', '#5a3480', '#9a6ac8', '#e8d0ff'] },
  core: { n: '魂核', c: '#ffd04a', d: '主線 / 區域 Boss · 武器 +10', ramp: ['#4a2a0a', '#a06a14', '#f2c14e', '#fff6c0'] },
};
export const MAT_KEYS = Object.keys(MATS) as MatKey[];
const W_MAT: MatKey[] = ['mat1', 'mat1', 'mat2', 'mat2', 'mat3', 'mat3', 'mat4', 'mat5', 'mat6', 'core'];
const W_N = [2, 3, 2, 3, 2, 3, 3, 3, 3, 1], W_GOLD = [60, 90, 130, 200, 280, 380, 520, 700, 900, 1500];
const A_MAT: MatKey[] = ['mat1', 'mat2', 'mat3', 'mat4', 'mat5'], A_GOLD = [80, 160, 280, 450, 700];
const isWeapon = (it: Item) => it.slot === 'weapon' || !!WT[it.type];
export const maxUp = (it: Item) => isWeapon(it) ? UP_MAX : it.slot === 'armor' ? A_UP_MAX : 0;
/** 從 +up 升到 +(up+1) 要什麼（武器或防具） */
export function upCost(up: number, it?: Item): { mat: MatKey; n: number; gold: number } | null {
  if (it && !isWeapon(it)) { if (it.slot !== 'armor' || up >= A_UP_MAX) return null; return { mat: A_MAT[up], n: 2, gold: A_GOLD[up] }; }
  if (up >= UP_MAX) return null;
  return { mat: W_MAT[up], n: W_N[up], gold: W_GOLD[up] };
}
export const canUpgrade = (pl: Player, it: Item) => { const c = upCost(it.up || 0, it); return !!c && (pl.mats[c.mat] || 0) >= c.n && pl.gold >= c.gold; };
export function doUpgrade(pl: Player, it: Item) {
  const c = upCost(it.up || 0, it); if (!c || !canUpgrade(pl, it)) return false;
  pl.mats[c.mat] -= c.n; pl.gold -= c.gold; it.up = (it.up || 0) + 1; if (isWeapon(it)) refreshWeapon(it); return true;
}
/** 強化後攻擊力的預覽（不含能力值加成） */
export const atkAt = (it: Item, up: number) => Math.round(wBase(it) * upMult(up));

/** 怪物等級 → 掉哪一種素材（等級是照地區定的，所以就是「這個地區的素材」） */
export function matForLevel(lv: number): MatKey {
  return lv <= 5 ? 'mat1' : lv <= 10 ? 'mat2' : lv <= 15 ? 'mat3' : lv <= 20 ? 'mat4' : lv <= 25 ? 'mat5' : 'mat6';
}
export const oreForLevel = matForLevel;                                 // 舊名稱
/** 舊存檔的礦石 → 新素材 */
export const ORE_TO_MAT: Record<string, MatKey> = { ore1: 'mat1', ore2: 'mat3', ore3: 'mat5', ore4: 'core' };

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
