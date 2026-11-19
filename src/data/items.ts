import { G } from '../core/state';
import { $, pick, ri, rr } from '../core/util';
import { makeSprite, rotGrid } from '../art/sprite';
import { HERO_FULL, HERO_PAL, HERO_W, WEAP } from '../art/hero';
import { SH, sculpt } from '../art/monsters';
import { gridCanvas } from '../art/weapon';
import type { Item } from '../types';
import { meets, soft } from './attrs';
import { UQ, UQ_BY_NAME } from './uniques';
import { FX_KEYS, WFXD } from '../game/weaponFx';

/* ================= DATA ================= */
export const WT = {
  sword:{name:'長劍',base:12,cd:.42,range:26,arc:120,stam:12,skill:'spin',sn:'迴旋斬',scd:6,trait:'攻守平均',sd:'揮出一圈劍氣，打中身邊所有敵人（220%）'},
  dagger:{name:'短刀',base:8,cd:.26,range:20,arc:100,stam:7,skill:'dash',sn:'疾風突刺',scd:5,trait:'出手很快',sd:'向前突進，穿過路上所有敵人（250%），突進時無敵'},
  axe:{name:'戰斧',base:21,cd:.72,range:28,arc:140,stam:20,skill:'slam',sn:'裂地重擊',scd:8,trait:'很慢但很痛',sd:'蓄力砸地，前方大範圍傷害（350%）並暈眩敵人'},
  spear:{name:'長槍',base:12,cd:.5,range:42,arc:44,stam:13,skill:'triple',sn:'三連刺',scd:5.5,trait:'攻擊距離長',sd:'快速刺出三槍（每下 140%）'},
  staff:{name:'法杖',base:10,cd:.5,range:150,arc:0,stam:10,ranged:true,skill:'fireball',sn:'火球術',scd:6,trait:'遠程魔法彈',sd:'發射火球，爆炸傷害一整片（300%）'},
  katana:{name:'太刀',base:13,cd:.34,range:27,arc:110,stam:10,skill:'iai',sn:'居合一閃',scd:6,trait:'出手快、容易暴擊',sd:'瞬間穿過前方一整排敵人（300%），一定會暴擊'},
  hammer:{name:'戰鎚',base:24,cd:.8,range:27,arc:150,stam:22,skill:'quake',sn:'三重震波',scd:9,trait:'最重的一擊',sd:'連砸三下，震波一圈比一圈大（每圈 200%）並暈眩敵人'},
  scythe:{name:'鐮刀',base:14,cd:.5,range:33,arc:200,stam:13,skill:'reap',sn:'死神收割',scd:8,trait:'掃一大圈、打中會回血',sd:'把周圍的敵人拉過來一起砍（260%），每打中一隻回 4% 生命'},
  wolfblade:{name:'狼牙雙刃',base:15,cd:.3,range:24,arc:130,stam:9,skill:'wolfrush',sn:'狼影連襲',scd:7,trait:'狼王的獠牙',sd:'化為狼影，連續撲向三個敵人（每下 180%），期間無敵'},
};
export const RAR = [
  {n:'普通',c:'#d9d4ca',m:1,a:0},{n:'優秀',c:'#6fd36f',m:1.12,a:1},{n:'稀有',c:'#55a8ff',m:1.25,a:2},
  {n:'史詩',c:'#c475ff',m:1.4,a:3},{n:'傳說',c:'#ff9f3a',m:1.6,a:3}];
/* m（倍率）現在只用在防具 / 飾品。武器的稀有度：普通 0 詞綴、優秀 1、稀有 2、史詩 2 + 刻印效果、傳說 = 獨特武器（data/uniques.ts） */
const WAFN = [0, 1, 2, 2, 3];
export const AFFIX = {
  crit:{n:'暴擊率',r:[3,9],u:'%'}, lifesteal:{n:'吸血',r:[2,5],u:'%'}, speed:{n:'攻擊速度',r:[6,15],u:'%'},
  cdr:{n:'技能冷卻縮短',r:[8,20],u:'%'}, hp:{n:'生命上限',r:[10,30],u:''}, def:{n:'防禦',r:[2,5],u:''}, st:{n:'體力上限',r:[6,14],u:''}};
const SCALE_AFF = new Set(['hp', 'def', 'st']);
const rollAff = (k, ilvl) => { let v = ri(AFFIX[k].r[0], AFFIX[k].r[1]); if (SCALE_AFF.has(k)) v = Math.round(v * (1 + (k === 'hp' ? .15 : .1) * (ilvl - 1))); return v; };
export const DG = 3;                                                       // 判定寬容：腳要踩進紅線內 3px 才算被打到
export const BEH = {
  slime:{hp:l=>28+10*l,dmg:l=>5+2*l,spd:30,r:6,aggro:80,reach:16,wind:.4,cd:1.1,souls:l=>4+3*l},
  lunge:{hp:l=>40+13*l,dmg:l=>8+2.5*l,spd:60,r:7,aggro:100,reach:46,wind:.45,cd:1.5,souls:l=>6+4*l},
  heavy:{hp:l=>80+20*l,dmg:l=>12+3*l,spd:24,r:9,aggro:85,reach:28,wind:.7,cd:1.8,souls:l=>10+6*l,heavy:true},
  ranged:{hp:l=>45+13*l,dmg:l=>9+2.6*l,spd:30,r:7,aggro:125,reach:150,wind:.45,cd:2,souls:l=>9+6*l},
};
export const KIND = {
  slime:{beh:'slime',name:'史萊姆',col:'#5ad06a'}, slimeM:{beh:'slime',name:'熔岩史萊姆',col:'#e8743b'},
  wolf:{beh:'lunge',name:'野狼',col:'#7d8296'}, wolfF:{beh:'lunge',name:'森狼',col:'#56634f'},
  skel:{beh:'lunge',name:'骷髏兵',col:'#e8e2d0'}, skelE:{beh:'lunge',name:'灰燼骷髏',col:'#c8b4a0'},
  shroom:{beh:'ranged',name:'毒菇',col:'#c0405f'}, treant:{beh:'heavy',name:'樹精',col:'#6b4a2f'},
  golem:{beh:'heavy',name:'石像魔',col:'#8a85a0'}, golemL:{beh:'heavy',name:'熔岩魔像',col:'#e8743b'},
  wolfS:{beh:'lunge',name:'雪狼',col:'#dce4f0'}, slimeI:{beh:'slime',name:'冰晶史萊姆',col:'#a8dcff'}, golemI:{beh:'heavy',name:'冰霜魔像',col:'#a6b8d8'},
  mimic:{beh:'lunge',name:'寶箱怪',col:'#a07a4c'},
  skelS:{beh:'lunge',name:'沼澤骷髏',col:'#8a9470'}, shroomP:{beh:'ranged',name:'沼毒菇',col:'#a870d0'}, treantS:{beh:'heavy',name:'沼澤樹妖',col:'#3a4826'},
};
/* ================= 武器 =================
   攻擊力 = 武器的基礎攻擊（每種武器固定）× 強化倍率。沒有「物品等級」了：
   一把 +0 長劍不管在哪裡撿到都一樣強，要變強就拿礦石去鐵匠那裡強化（+1 ～ +10，見 data/forge.ts）。
   稀有度不再加攻擊，而是多詞綴 / 刻印效果（見 rollWeapon）。 */
export const UP_MAX = 10;
export const upMult = (up: number) => 1 + .32 * (up || 0);               // +10 ≈ 4.2 倍（舊系統物品等級 30 大約 4.8 倍）
export const wBase = (it: Item) => it.uq && UQ[it.uq] ? UQ[it.uq].base : WT[it.type].base;
export const wAtk = (it: Item) => Math.round(wBase(it) * upMult(it.up));
export const refreshWeapon = (it: Item) => { it.atk = wAtk(it); return it; };
const WPRE = ['鐵', '精鋼', '秘銀', '星隕'];                               // 名稱前綴只看稀有度
const WAFF = ['crit', 'lifesteal', 'speed', 'cdr'];                       // 武器只出百分比詞綴（不會隨地區膨脹）
export function makeWeapon(type: string, rarity = 0, up = 0): Item {
  const nAff = WAFN[rarity] ?? 0; if (rarity > 3) rarity = 3;          // 隨機掉落最高史詩；傳說只有獨特武器（「傳說」骰到 → 史詩 + 3 條詞綴）
  const aff: Record<string, number> = {};
  for (const k of WAFF.slice().sort(() => Math.random() - .5).slice(0, nAff)) aff[k] = ri(AFFIX[k].r[0], AFFIX[k].r[1]);
  const fx = rarity >= 3 ? pick(FX_KEYS) : undefined;
  const name = (fx ? WFXD[fx].pre : WPRE[rarity]) + WT[type].name;
  const it: Item = { id: G.uid++, slot:'weapon', type, ilvl: 0, rarity, up: Math.max(0, Math.min(UP_MAX, up)), aff, name };
  if (fx) it.fx = fx;
  return refreshWeapon(it);
}
export function makeUnique(key: string, up = 0): Item {
  const U = UQ[key];
  return refreshWeapon({ id: G.uid++, slot:'weapon', type: U.type, ilvl: 0, rarity: 4, up, aff: { ...U.aff }, name: U.name, uq: key });
}
/** 讀檔時補齊：舊的獨特武器對回編號、史詩沒有刻印就補一個、隨機傳說降成史詩（保留詞綴） */
export function fixWeapon(it: Item) {
  if (!WT[it.type]) return it;
  const k = it.uq || UQ_BY_NAME[it.name];
  if (k && UQ[k]) { it.uq = k; it.rarity = 4; it.type = UQ[k].type; delete it.fx; it.name = UQ[k].name; }
  else { if (it.rarity > 3) it.rarity = 3; if (it.rarity === 3 && !it.fx) it.fx = pick(FX_KEYS); }
  return refreshWeapon(it);
}
/** 舊名稱相容：makeItem(type, 強化等級, 稀有度) */
export const makeItem = (type: string, up: number, rarity: number) => makeWeapon(type, rarity, up);
/** 顯示用名稱：+3 精鋼長劍 */
export const itemName = (it: Item) => (it.slot === 'weapon' && it.up ? '+' + it.up + ' ' : '') + it.name;
/** 商店價格、分解魂晶的基準。武器看稀有度和強化，防具飾品還是看物品等級 */
export const gearValue = (it: Item) => it.slot === 'weapon' || WT[it.type] ? Math.round(12 * Math.pow(it.rarity + 1, 1.6) * (1 + .6 * (it.up || 0))) : it.ilvl * (it.rarity + 1);
/* ---- 防具與飾品 ---- */
export const AT = { robe:{ name:'法袍', def:3, hp:12, d:'輕盈，附帶較多生命' }, leather:{ name:'皮甲', def:5, hp:6, d:'防禦和生命平均' }, mail:{ name:'鎖甲', def:8, hp:0, d:'防禦最高' } };
export const TT = { ring:{ name:'戒指', main:'crit', d:'一定有暴擊詞綴' }, amulet:{ name:'項鍊', main:'hp', d:'一定有生命詞綴' } };
export const SLOTN = { weapon:'武器', armor:'防具', trinket:'飾品' };
export const slotOf = it => it.slot || (AT[it.type] ? 'armor' : TT[it.type] ? 'trinket' : 'weapon');
export function makeGear(type: string, ilvl: number, rarity: number): Item {
  if (WT[type]) return makeWeapon(type, rarity);                         // 武器沒有物品等級：一律 +0
  const R = RAR[rarity], isA = !!AT[type], base = isA ? AT[type] : TT[type];
  const keys = Object.keys(AFFIX).filter(k => !(isA && k === 'def')).sort(() => Math.random() - .5).slice(0, R.a + (isA ? 0 : 1));
  if (!isA && !keys.includes(base.main)) keys[0] = base.main;
  const aff: Record<string, number> = {}; for (const k of keys) aff[k] = rollAff(k, ilvl);
  const tier = ilvl <= 3 ? 0 : ilvl <= 7 ? 1 : ilvl <= 11 ? 2 : ilvl <= 15 ? 3 : 4;
  const name = rarity >= 3 ? pick(['霜語','烈陽','暮光','裂風','血月','星火']) + base.name : (isA ? ['粗布','精製','秘銀','星隕','龍鱗'] : ['銅','銀','金','星辰','龍心'])[tier] + base.name;
  const it: Item = { id: G.uid++, slot: isA ? 'armor' : 'trinket', type, ilvl, rarity, aff, name };
  if (isA) { it.def = Math.round(base.def * (1 + .12 * (ilvl - 1)) * R.m * rr(.92, 1.08)); it.hp = Math.round(base.hp * (1 + .1 * (ilvl - 1)) * R.m); }
  return it;
}
export const DROP_WEAPONS = ['sword', 'dagger', 'axe', 'spear', 'staff', 'katana', 'hammer', 'scythe'];   // 會從怪物身上掉、商人會賣的武器（狼牙雙刃只有狼王會掉）
function pickWeaponType(lv) {                                            // 你能裝備的武器類型比較容易掉（權重 3：1）
  const pl = G.me; if (!pl) return pick(DROP_WEAPONS);
  const w = DROP_WEAPONS.map(t => meets(pl, { type: t, ilvl: 0, slot: 'weapon' } as Item) ? 3 : 1), sum = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum; for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return DROP_WEAPONS[i]; return DROP_WEAPONS[0];
}
/** kind：'weapon' = 一定是武器，'gear' = 防具或飾品，不給 = 寶箱那種混著來 */
export function randomLoot(lv, rarity, kind?: 'weapon' | 'gear') {
  if (G.me && rarity < 4 && Math.random() < .012 * soft(G.me.luk)) rarity++;   // 幸運：有機會升一級稀有度
  const q = kind === 'weapon' ? 0 : kind === 'gear' ? .6 + Math.random() * .4 : Math.random();
  const type = q < .6 ? pickWeaponType(lv) : q < .85 ? pick(Object.keys(AT)) : pick(Object.keys(TT));
  return makeGear(type, lv, rarity);
}
export const bossWeapon = () => makeUnique('wolfblade');
export const ICON: Record<string, HTMLCanvasElement> = {}, ICON_URL: Record<string, string> = {};
for (const type of Object.keys(WT)) {
  const W = WEAP[type], r = rotGrid(W.rows, W.grip, -Math.PI / 4, false, W.base), c = gridCanvas(r.rows, W.pal); ICON[type] = c;
  const n = Math.max(c.width, c.height) + 4, sq = document.createElement('canvas'); sq.width = sq.height = n * 2;
  const g3 = sq.getContext('2d'); g3.imageSmoothingEnabled = false; g3.drawImage(c, (n - c.width) & ~1, (n - c.height) & ~1, c.width * 2, c.height * 2);
  try { ICON_URL[type] = sq.toDataURL(); } catch (e) { ICON_URL[type] = ''; }
}
{                                                                       // 防具、飾品、藥水的圖示：跟怪物一樣用雕塑器做
  const PUR = ['#241c40', '#3b2e66', '#57479a', '#7a66c4', '#a894e8'], BRN = ['#3a2414', '#5a3c26', '#7a5434', '#9a7048', '#b48a5a'], STL = ['#2a2834', '#4a4858', '#6e6c86', '#9a98b0', '#c8c6dc'];
  const GLD = ['#7a4a1a', '#c0862c', '#f2c14e', '#fff0a8'];
  const art = {
    robe: sculpt(32, 34, [{ sh: SH.cap(9, 11, 3, 24, 3, 2.4), ramp: PUR, grp: 1 }, { sh: SH.cap(23, 11, 29, 24, 3, 2.4), ramp: PUR, grp: 2 },
      { sh: SH.poly([[10, 8], [22, 8], [28, 33], [4, 33]]), ramp: PUR, grp: 3 }, { sh: SH.ell(16, 7, 7, 6), ramp: PUR, grp: 4 }],
      a => { a.ell(16, 8, 4, 3.5, '#120d1c'); a.line(16, 12, 16, 32, '#f2c14e'); a.line(5, 32, 27, 32, '#c0862c'); a.set(16, 16, '#fff0a8'); a.set(15, 16, '#f2c14e'); a.set(17, 16, '#f2c14e'); a.set(16, 15, '#f2c14e'); a.set(16, 17, '#f2c14e'); }),
    leather: sculpt(32, 30, [{ sh: SH.ell(7, 9, 5, 4.5), ramp: BRN, grp: 1 }, { sh: SH.ell(25, 9, 5, 4.5), ramp: BRN, grp: 2 }, { sh: SH.box(16, 17, 10, 12, 3), ramp: BRN, grp: 3 }],
      a => { a.line(16, 6, 16, 28, BRN[0]); for (let y = 8; y < 28; y += 3) { a.set(14, y, BRN[4]); a.set(18, y, BRN[4]); } a.rect(7, 21, 18, 2, '#2a1a0e'); a.rect(14, 20, 4, 4, '#f2c14e'); a.set(15, 21, '#7a4a1a'); }),
    mail: sculpt(32, 30, [{ sh: SH.ell(7, 9, 5.5, 5), ramp: STL, grp: 1 }, { sh: SH.ell(25, 9, 5.5, 5), ramp: STL, grp: 2 }, { sh: SH.box(16, 17, 10, 12, 3.5), ramp: STL, grp: 3 }],
      a => { for (let y = 6; y < 29; y++) for (let x = 3; x < 30; x++) if (a.get(x, y) && (x + y * 2) % 4 === 0) a.set(x, y, STL[1]); a.rect(8, 20, 16, 2, '#7a4a1a'); a.set(16, 20, '#f2c14e'); }),
    ring: sculpt(24, 24, [{ sh: SH.ell(12, 15, 9, 7.5, (x, y) => ((x - 12) / 5.2) ** 2 + ((y - 15.5) / 4) ** 2 > 1), ramp: GLD, grp: 1 }, { sh: SH.ell(12, 7, 4.5, 4), ramp: ['#1a3a9a', '#3a6ae0', '#8fb0ff', '#e0ecff'], grp: 2 }]),
    amulet: sculpt(24, 28, [{ sh: SH.ell(12, 19, 7.5, 8), ramp: GLD, grp: 1 }, { sh: SH.ell(12, 19, 5, 5.5), ramp: ['#3a0a4a', '#7a2ab0', '#c070ff', '#f0d0ff'], grp: 2 }],
      a => { a.line(3, 1, 10, 11, '#c0862c'); a.line(21, 1, 14, 11, '#c0862c'); }),
    potion: sculpt(22, 26, [{ sh: SH.box(11, 4, 3, 3, 3), ramp: ['#5a3c26', '#7a5434', '#9a7048'], grp: 1 }, { sh: SH.ell(11, 16, 8.5, 9), ramp: ['#5a1018', '#a8202e', '#e04a5a', '#ff9aa8'], grp: 2 }], a => { a.set(7, 12, '#ffffff'); a.set(8, 11, '#ffffff'); }),
    potUp: sculpt(26, 28, [{ sh: SH.box(13, 5, 3, 3, 3), ramp: ['#5a3c26', '#7a5434', '#9a7048'], grp: 1 }, { sh: SH.ell(13, 17, 10, 10), ramp: GLD, grp: 2 }, { sh: SH.ell(13, 17, 7.5, 7.5), ramp: ['#5a1018', '#a8202e', '#e04a5a', '#ff9aa8'], grp: 3 }],
      a => { a.rect(12, 13, 3, 9, '#ffffff'); a.rect(9, 16, 9, 3, '#ffffff'); }),
  };
  for (const k in art) { const c = art[k]; ICON[k] = c; const n = Math.max(c.width, c.height) + 4, sq = document.createElement('canvas'); sq.width = sq.height = n * 2;
    const g3 = sq.getContext('2d'); g3.imageSmoothingEnabled = false; g3.drawImage(c, (n - c.width) & ~1, (n - c.height) & ~1, c.width * 2, c.height * 2); try { ICON_URL[k] = sq.toDataURL(); } catch (e) { ICON_URL[k] = ''; } }
}
export const MERCH_SP = sculpt(46, 54, [                                      // 流浪商人：綠色斗篷、大背包、提著燈
  { sh: SH.box(31, 24, 10, 13, 3), ramp: ['#3a2414', '#5a3c26', '#7a5434', '#9a7048'], tex: .2, grp: 1 },
  { sh: SH.cap(30, 9, 30, 14, 5, 5), ramp: ['#4a3a6a', '#6a5a9a', '#8a7ac4'], grp: 1 },
  { sh: SH.cap(9, 52, 13, 14, 1.4, 1.2), ramp: ['#3a2414', '#6a4a2a', '#8a6a42'], grp: 2 },
  { sh: SH.poly([[14, 20], [28, 20], [32, 52], [10, 52]]), ramp: ['#123a2e', '#1e5a44', '#2e7a5c', '#4a9a76'], tex: .15, grp: 3 },
  { sh: SH.ell(21, 16, 8.5, 8), ramp: ['#123a2e', '#1e5a44', '#2e7a5c', '#4a9a76'], grp: 4 },
  { sh: SH.ell(22, 18, 5, 4.5), ramp: ['#8a6a5a', '#c8a088', '#ecc8b0'], grp: 5 },
  { sh: SH.cap(12, 28, 16, 38, 2, 1.8), ramp: ['#123a2e', '#1e5a44', '#2e7a5c'], grp: 6 },
], a => { a.set(20, 18, '#1a0e0a'); a.set(24, 18, '#1a0e0a'); a.rect(19, 21, 6, 1, '#6a4a3a'); a.rect(6, 38, 5, 6, '#f2c14e'); a.rect(7, 39, 3, 4, '#fff6c0');
  a.line(14, 50, 30, 50, '#0e2a20'); for (let y = 26; y < 34; y++) a.set(31, y, '#3a2414'); a.rect(26, 30, 10, 2, '#c0862c'); });
export const COIN_SP = [1, .7, .35, .7].map(w => sculpt(12, 12, [{ sh: SH.ell(6, 6, Math.max(1.2, 5 * w), 5), ramp: ['#7a4a1a', '#c0862c', '#f2c14e', '#fff0a8'], grp: 1 }],
  a => { if (w > .6) { a.set(6, 4, '#7a4a1a'); a.set(6, 5, '#7a4a1a'); a.set(6, 6, '#7a4a1a'); a.set(6, 7, '#7a4a1a'); } }));
// 魂晶：紫色菱形水晶，跟金幣一樣用「變窄」做出旋轉的感覺
export const SOUL_SP = [1, .7, .35, .7].map(w => { const hw = Math.max(1, 4.5 * w);
  return sculpt(12, 16, [{ sh: SH.poly([[6, 1], [6 + hw, 6], [6, 15], [6 - hw, 6]]), ramp: ['#3a2470', '#6a4ad0', '#b49cff', '#f0e8ff'], grp: 1 }],
    a => { if (w > .6) { a.set(5, 4, '#ffffff'); a.set(5, 5, '#f0e8ff'); } }); });
(() => { try {
  const sp = makeSprite(HERO_FULL.map(r => r.padEnd(HERO_W, '.')), HERO_PAL);
  const big = document.createElement('canvas'); big.width = sp.w * 3; big.height = sp.h * 3; const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false; bg.drawImage(sp.n, 0, 0, big.width, big.height); $<HTMLImageElement>('tArt').src = big.toDataURL();
} catch (e) {} })();

