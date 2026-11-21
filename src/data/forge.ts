/* ================= 鍛造：武器 +1 ～ +10、防具 +1 ～ +5 =================
   去城鎮的鐵匠那裡，用「素材 + 金幣」強化。素材是星星碎掉後散落各地的碎片，各地區的怪物身上都帶著（越深的地區，碎片越大、越純），
   最後一級（武器 +10）要「隕星之心」：主線 / 區域 Boss 各掉一顆。

   武器       需要的素材                    要先找到的古代鍛造圖（打倒某地區任一座地城的守護者）
   +1、+2     星砂（翠風平原）×3、×6         —
   +3、+4     星屑（迷霧森林）×4、×8         星屑篇（平原的地城）
   +5、+6     星片（骸骨荒地）×5、×10        星片篇（森林的地城）
   +7         星石（熔岩高地）×8             星石篇（荒地的地城）
   +8         星晶（霜寒雪原）×10            星晶篇（熔岩的地城）
   +9         星髓（幽影沼澤）×12            星髓篇（雪原的地城）
   +10        隕星之心 ×2                    隕星篇（沼澤的地城）
   防具 +1 ～ +5 依序用星砂、星屑、星片、星石、星晶（同樣要對應的鍛造圖）
   鍛造圖不會用掉：找到之後每一件裝備都能強化到那裡。打倒某地區的地城守護者之後，鐵匠也會開始賣那個地區的素材。

   獨特武器（橘色）走另一條路：不用上面那些素材，每一級都只用「黯星石」，而且不能買。
   黯星石只有 Boss / 地城守護者各掉一顆（打過就沒了），精英怪偶爾掉一顆。全部撿完大概只夠一把獨特武器升到 +8 左右，
   所以要選一把來養；同時期的刻印武器會比較好升（中期刻印 +6、獨特 +4 左右）。鍛造圖的限制一樣（+3 要星屑篇……）。 */
import { tier } from './levels';
import { SH, sculpt } from '../art/monsters';
import { RAR, UP_MAX, WT, refreshWeapon, upMult, wBase } from './items';
import { A_UP_MAX } from './gear';
import type { Item, Player } from '../types';

export type MatKey = 'mat1' | 'mat2' | 'mat3' | 'mat4' | 'mat5' | 'mat6' | 'core' | 'umat';
export const MATS: Record<MatKey, { n: string; c: string; d: string; ramp: string[] }> = {
  mat1: { n: '星砂', c: '#efe6d2', d: '翠風平原的怪物 · 武器 +1、+2', ramp: ['#4a4030', '#8a7e64', '#c8bc9e', '#fff6e0'] },
  mat2: { n: '星屑', c: '#9ae08a', d: '迷霧森林的怪物 · 武器 +3、+4', ramp: ['#1e3a1a', '#3a6a30', '#6aaa52', '#c0f0a8'] },
  mat3: { n: '星片', c: '#e0d0a8', d: '骸骨荒地的怪物 · 武器 +5、+6', ramp: ['#3a2e1e', '#7a6646', '#b8a47a', '#f0e4c0'] },
  mat4: { n: '星石', c: '#ff9a4a', d: '熔岩高地的怪物 · 武器 +7', ramp: ['#4a1408', '#a03a14', '#f07a2a', '#ffd890'] },
  mat5: { n: '星晶', c: '#9ae8ff', d: '霜寒雪原的怪物 · 武器 +8', ramp: ['#0e3a4e', '#2a7a9a', '#6ac8e8', '#e0faff'] },
  mat6: { n: '星髓', c: '#c8a0f0', d: '幽影沼澤的怪物 · 武器 +9', ramp: ['#2a1640', '#5a3480', '#9a6ac8', '#e8d0ff'] },
  core: { n: '隕星之心', c: '#ffd04a', d: '主線 / 區域 Boss · 武器 +10', ramp: ['#4a2a0a', '#a06a14', '#f2c14e', '#fff6c0'] },
  umat: { n: '黯星石', c: '#ff9f3a', d: 'Boss、地城守護者、偶爾精英怪 · 獨特武器強化', ramp: ['#2a1a3a', '#5a3a6a', '#c0702a', '#ffd8a0'] },
};
export const MAT_KEYS = Object.keys(MATS) as MatKey[];
const W_MAT: MatKey[] = ['mat1', 'mat1', 'mat2', 'mat2', 'mat3', 'mat3', 'mat4', 'mat5', 'mat6', 'core'];
const W_N = [3, 6, 4, 8, 5, 10, 8, 10, 12, 2], W_GOLD = [100, 180, 280, 420, 600, 850, 1200, 1600, 2200, 3500];
const U_N = [2, 2, 3, 3, 4, 4, 5, 5, 6, 6];                               // 獨特武器每一級要幾顆黯星石（合計 40）
const A_MAT: MatKey[] = ['mat1', 'mat2', 'mat3', 'mat4', 'mat5'], A_N = [3, 5, 6, 8, 10], A_GOLD = [100, 250, 500, 900, 1500];
const isWeapon = (it: Item) => it.slot === 'weapon' || !!WT[it.type];
export const maxUp = (it: Item) => isWeapon(it) ? UP_MAX : it.slot === 'armor' ? A_UP_MAX : 0;

/* ---- 古代鍛造圖：第 i 張 = 打倒第 i 個地區任一座地城的守護者（flags 'dgn:編號'），教鐵匠怎麼用下一種素材 ----
   直接看 flags 算，所以舊存檔打過的地城也算數 */
export const PAGES: { n: string; mat: MatKey; dg: string[] }[] = [
  { n: '星屑篇', mat: 'mat2', dg: ['moss', 'barrow', 'grotto'] },          // 翠風平原
  { n: '星片篇', mat: 'mat3', dg: ['nest', 'roots'] },                     // 迷霧森林
  { n: '星石篇', mat: 'mat4', dg: ['windcave', 'sandtemple', 'undercroft'] },   // 骸骨荒地
  { n: '星晶篇', mat: 'mat5', dg: ['lavatube', 'obsidian', 'forgeruin'] }, // 熔岩高地
  { n: '星髓篇', mat: 'mat6', dg: ['icecave', 'frostcrypt'] },             // 霜寒雪原
  { n: '隕星篇', mat: 'core', dg: ['rotcave', 'sunkgrotto', 'temple'] },   // 幽影沼澤
];
export const forgeFlags = { has: (_f: string) => false };               // game/quest.ts 接上真正的 flags（避免 data/ 去 import game/）
export const hasPage = (i: number) => i >= 0 && PAGES[i].dg.some(id => forgeFlags.has('dgn:' + id));
/** 用這種素材強化要哪一張鍛造圖（-1 = 不用） */
export const pageFor = (mat: MatKey) => PAGES.findIndex(p => p.mat === mat);
/** 這座地城屬於哪一張鍛造圖 */
export const pageOfDungeon = (id: string) => PAGES.findIndex(p => p.dg.includes(id));
/** 地區 i 的素材（鐵匠打倒那個地區的地城守護者之後才賣） */
export const REGION_MAT: MatKey[] = ['mat1', 'mat2', 'mat3', 'mat4', 'mat5', 'mat6'];

/** 從 +up 升到 +(up+1) 要什麼（武器或防具）；page = 要先有的鍛造圖（-1 = 不用） */
export function upCost(up: number, it?: Item): { mat: MatKey; n: number; gold: number; page: number } | null {
  if (it && !isWeapon(it)) { if (it.slot !== 'armor' || up >= A_UP_MAX) return null; return { mat: A_MAT[up], n: A_N[up], gold: A_GOLD[up], page: pageFor(A_MAT[up]) }; }
  if (up >= UP_MAX) return null;
  if (it && it.uq) return { mat: 'umat', n: U_N[up], gold: Math.round(W_GOLD[up] * 1.5), page: pageFor(W_MAT[up]) };   // 獨特武器：只用黯星石，鍛造圖照一般武器的
  return { mat: W_MAT[up], n: W_N[up], gold: W_GOLD[up], page: pageFor(W_MAT[up]) };
}
export const canUpgrade = (pl: Player, it: Item) => { const c = upCost(it.up || 0, it); return !!c && (c.page < 0 || hasPage(c.page)) && (pl.mats[c.mat] || 0) >= c.n && pl.gold >= c.gold; };
export function doUpgrade(pl: Player, it: Item) {
  const c = upCost(it.up || 0, it); if (!c || !canUpgrade(pl, it)) return false;
  pl.mats[c.mat] -= c.n; pl.gold -= c.gold; it.up = (it.up || 0) + 1; if (isWeapon(it)) refreshWeapon(it); return true;
}
/** 強化後攻擊力的預覽（不含能力值加成） */
export const atkAt = (it: Item, up: number) => Math.round(wBase(it) * upMult(up));

/** 怪物等級 → 掉哪一種素材（等級是照地區定的，所以就是「這個地區的素材」） */
export function matForLevel(lv0: number): MatKey { const lv = tier(lv0);
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

/* 鍛造圖的小圖示（鐵匠強化頁用）：米色紙捲 + 金色的鎚子記號 */
export const PAGE_URL = (() => { const q = document.createElement('canvas'); q.width = q.height = 32; const g = q.getContext('2d'), P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * 2, y * 2, w * 2, h * 2); };
  P(2, 3, 12, 10, '#2a1e10'); P(3, 4, 10, 8, '#e8d8b0'); P(3, 4, 10, 1, '#fff6e0'); P(2, 3, 1, 10, '#8a6a3a'); P(13, 3, 1, 10, '#8a6a3a');
  P(6, 6, 4, 2, '#c0862c'); P(7, 6, 2, 1, '#f2c14e'); P(7, 8, 2, 3, '#7a4a1a'); P(4, 10, 2, 1, '#8a7e64'); P(10, 10, 2, 1, '#8a7e64');
  try { return q.toDataURL(); } catch (e) { return ''; } })();

/* ---- 舊存檔：武器以前有物品等級，攻擊 = 基礎 ×（1 + 0.13 ×（等級 − 1））× 稀有度倍率。
   換算成「攻擊力最接近的強化等級」，所以讀檔後武器差不多一樣強（最多 +10） ---- */
export function migrateWeapon(it: Item) {
  if (!WT[it.type] || it.up !== undefined) return it;
  const old = (1 + .13 * ((it.ilvl || 1) - 1)) * (RAR[it.rarity]?.m || 1);
  it.up = Math.max(0, Math.min(UP_MAX, Math.round((old - 1) / .32))); it.ilvl = 0; it.slot = 'weapon';
  return refreshWeapon(it);
}
