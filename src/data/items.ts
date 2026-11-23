import { G } from '../core/state';
import { $, pick, ri, rr } from '../core/util';
import { makeSprite, rotGrid } from '../art/sprite';
import { HERO_FULL, HERO_PAL, HERO_W, WEAP } from '../art/hero';
import { SH, sculpt } from '../art/monsters';
import { gridCanvas } from '../art/weapon';
import type { Item } from '../types';
import { meets, soft } from './attrs';
import { UG, UQ, UQ_BY_NAME } from './uniques';
import { tier } from './levels';
import { ACLS, ACLS_OF, ARMORS, ARMOR_BASIC, ARMOR_BUILD, ARMOR_REGION, SEAL_NAME, TRINKETS, TRINKET_KEYS, aUpMult } from './gear';
import { FX_KEYS, WFXD } from '../game/weaponFx';

/* ================= DATA ================= */
export const WT = {
  sword:{name:'長劍',base:13,cd:.42,range:26,arc:120,stam:12,skill:'spin',sn:'迴旋斬',scd:6,trait:'第三下放出劍氣',sd:'連轉兩圈劍氣，打中身邊所有敵人（每圈 260%，第二圈範圍更大）'},
  dagger:{name:'短刀',base:8,cd:.26,range:20,arc:100,stam:7,skill:'dash',sn:'疾風突刺',scd:5,trait:'出手很快',sd:'向前突進，穿過路上所有敵人（300%），停下來再對最近的敵人連砍三刀（每刀 130%）；突進時無敵'},
  axe:{name:'戰斧',base:21,cd:.72,range:28,arc:140,stam:20,skill:'slam',sn:'裂地重擊',scd:8,trait:'左右橫掃，越砍越快',sd:'蓄力砸地，前方大範圍傷害（350%）並暈眩敵人'},
  spear:{name:'長槍',base:12,cd:.44,range:42,arc:44,stam:13,skill:'triple',sn:'三連刺',scd:5.5,trait:'刺穿一排，槍尖更痛',sd:'快速刺出三槍（每下 200%）'},
  staff:{name:'法杖',base:10,cd:.5,range:150,arc:0,stam:10,ranged:true,skill:'fireball',sn:'火球術',scd:6,trait:'遠程魔法彈',sd:'發射火球，爆炸傷害一整片（450%）'},
  katana:{name:'太刀',base:13,cd:.34,range:27,arc:110,stam:10,skill:'iai',sn:'居合一閃',scd:6,trait:'出手快、容易暴擊',sd:'瞬間穿過前方一整排敵人（400%），一定會暴擊'},
  hammer:{name:'戰鎚',base:24,cd:.8,range:27,arc:150,stam:22,skill:'quake',sn:'三重震波',scd:9,trait:'每一下都往下砸',sd:'連砸三下，震波一圈比一圈大（每圈 200%）並暈眩敵人'},
  scythe:{name:'鐮刀',base:14,cd:.5,range:33,arc:200,stam:13,skill:'reap',sn:'死神收割',scd:8,trait:'掃一大圈、打中會回血',sd:'把周圍的敵人拉過來一起砍（360%），每打中一隻回 4% 生命'},
  wolfblade:{name:'狼牙雙刃',base:14,cd:.38,range:24,arc:130,stam:9,skill:'wolfrush',sn:'狼影連襲',scd:7,trait:'狼王的獠牙',sd:'化為狼影，連續撲向三個敵人（每下 180%），期間無敵'},
  bow:{name:'長弓',base:13,cd:.5,range:200,arc:0,stam:10,ranged:true,skill:'arrowrain',sn:'箭雨',scd:7,trait:'蓄力弓：要按住拉弓才射得出去（太早放開不會射），拉滿射出穿透箭（第二段一次三支），箭飛越遠越痛',sd:'往前方射上天，落下一大片箭雨（16 支，每支 110%）'},
  greatsword:{name:'大劍',base:26,cd:.86,range:34,arc:160,stam:22,skill:'cleave',sn:'破山斬',scd:8,trait:'揮劍時不會被打退、受傷減少',sd:'把劍舉過頭往前劈，地面裂出一條直線（380%）並暈眩敵人'},
  rapier:{name:'細劍',base:10,cd:.3,range:36,arc:0,stam:8,skill:'flurry',sn:'百花刺',scd:6,trait:'一直刺同一隻，越刺越容易暴擊',sd:'往前連刺八下（每下 70%），最後一下一定暴擊'},
  // 下面三種只有獨特武器（data/uniques.ts）才有：不會隨機掉、商人不賣
  crescent:{name:'月牙刀',base:14,cd:.44,range:30,arc:150,stam:12,skill:'moonring',sn:'月輪迴旋',scd:7,trait:'第三下把刀氣丟出去，還會飛回來',sd:'丟出三道月牙，飛出去再飛回手上，來回都會砍到（每道 150%）'},
  twinblade:{name:'雙頭刀',base:15,cd:.34,range:30,arc:130,stam:10,skill:'bladewheel',sn:'旋刃風車',scd:8,trait:'前後兩頭一起砍，四連擊',sd:'雙頭刀在身邊轉 1.5 秒，可以邊轉邊走（每 0.15 秒砍一下，每下 60%）'},
  darkmoon:{name:'暗月大劍',base:20,cd:.78,range:34,arc:150,stam:20,skill:'moonbeam',sn:'暗月光波',scd:7,trait:'打中會存月光，第三下全部放出去',sd:'舉劍吸收月光，往前放出一道巨大的月光劍浪（400%），一路穿透'},
  // 精靈武器（精靈王國）：也只有獨特版
  elfbow:{name:'精靈連發弓',base:14,cd:.42,range:220,arc:0,stam:9,ranged:true,skill:'leafvolley',sn:'千葉齊射',scd:7,trait:'連發弓：按住就一直射（不能蓄力），箭更快更遠，第三下一次三支',sd:'往前方扇形連射十二支葉箭，每支都會穿透（每支 80%）'},
  elfrapier:{name:'精靈細劍',base:11,cd:.28,range:38,arc:0,stam:8,skill:'moonstep',sn:'月步',scd:6,trait:'第三下刺出一道葉刃',sd:'化成月光往前閃三次，每次穿過路上的敵人（每次 220%），期間無敵'},
  elfblades:{name:'精靈雙刀',base:12,cd:.3,range:28,arc:140,stam:8,skill:'windwaltz',sn:'風之輪舞',scd:7,trait:'左右交替的四連斬，第四下轉一圈',sd:'旋轉著往前衝，路上的敵人一直被砍（6 下，每下 100%），衝完再轉一圈（160%）'},
};
/* 顏色（沒有品階了，只用來分辨是哪一種東西）：0 一般、2 地區防具 / 飾品、3 刻印（或裝了刻印的武器）、4 獨特。m 只給舊存檔換算用 */
export const RAR = [
  {n:'一般',c:'#d9d4ca',m:1},{n:'一般',c:'#6fd36f',m:1.12},{n:'特殊',c:'#55a8ff',m:1.25},
  {n:'刻印',c:'#c475ff',m:1.4},{n:'獨特',c:'#ff9f3a',m:1.6}];
export const AFFIX = {
  crit:{n:'暴擊率',r:[3,9],u:'%'}, lifesteal:{n:'吸血',r:[2,5],u:'%'}, speed:{n:'攻擊速度',r:[6,15],u:'%'},
  cdr:{n:'技能冷卻縮短',r:[8,20],u:'%'}, hp:{n:'生命上限',r:[10,30],u:''}, def:{n:'防禦',r:[2,5],u:''}, st:{n:'體力上限',r:[6,14],u:''}};
export const DG = 3;                                                       // 判定寬容：腳要踩進紅線內 3px 才算被打到
export const BEH = {
  slime:{hp:l=>28+10*tier(l),dmg:l=>5+2*tier(l),spd:30,r:6,aggro:80,reach:16,wind:.4,cd:1.1,souls:l=>4+3*tier(l)},
  lunge:{hp:l=>40+13*tier(l),dmg:l=>8+2.5*tier(l),spd:60,r:7,aggro:100,reach:46,wind:.45,cd:1.5,souls:l=>6+4*tier(l)},
  blade:{hp:l=>40+13*tier(l),dmg:l=>8+2.5*tier(l),spd:50,r:7,aggro:100,reach:22,wind:.5,cd:1.5,souls:l=>6+4*tier(l)},   // 骷髏：跛腳走得慢，走到面前原地揮劍（不衝刺）
  heavy:{hp:l=>80+20*tier(l),dmg:l=>12+3*tier(l),spd:24,r:9,aggro:85,reach:28,wind:.7,cd:1.8,souls:l=>10+6*tier(l),heavy:true},
  ranged:{hp:l=>45+13*tier(l),dmg:l=>9+2.6*tier(l),spd:30,r:7,aggro:125,reach:150,wind:.45,cd:2,souls:l=>9+6*tier(l)},
};
export const KIND = {
  slime:{beh:'slime',name:'史萊姆',col:'#5ad06a'}, slimeM:{beh:'slime',name:'熔岩史萊姆',col:'#e8743b'},
  wolf:{beh:'lunge',name:'野狼',col:'#7d8296'}, wolfF:{beh:'lunge',name:'森狼',col:'#56634f'},
  skel:{beh:'blade',name:'骷髏兵',col:'#e8e2d0'}, skelE:{beh:'blade',name:'灰燼骷髏',col:'#c8b4a0'},
  shroom:{beh:'ranged',name:'毒菇',col:'#c0405f'}, treant:{beh:'heavy',name:'樹精',col:'#6b4a2f'},
  golem:{beh:'heavy',name:'石像魔',col:'#8a85a0'}, golemL:{beh:'heavy',name:'熔岩魔像',col:'#e8743b'},
  wolfS:{beh:'lunge',name:'雪狼',col:'#dce4f0'}, slimeI:{beh:'slime',name:'冰晶史萊姆',col:'#a8dcff'}, golemI:{beh:'heavy',name:'冰霜魔像',col:'#a6b8d8'},
  mimic:{beh:'lunge',name:'寶箱怪',col:'#a07a4c'},
  skelS:{beh:'blade',name:'沼澤骷髏',col:'#8a9470'}, shroomP:{beh:'ranged',name:'沼毒菇',col:'#a870d0'}, treantS:{beh:'heavy',name:'沼澤樹妖',col:'#3a4826'},
  // 地城專屬（art/dungeonMonsters.ts）：每座地城兩三種，野外不會出現。proj = 遠程怪射出去的東西
  spiderM:{beh:'lunge',name:'苔蛛',col:'#5a8236'}, batC:{beh:'lunge',name:'洞穴蝙蝠',col:'#765a42'},
  ghoulB:{beh:'blade',name:'古墓食屍鬼',col:'#8a9480'}, wraithB:{beh:'ranged',name:'墓穴幽魂',col:'#7a8aaa',proj:'bolt'},
  crabT:{beh:'heavy',name:'潮音蟹',col:'#4a9090'}, frogG:{beh:'slime',name:'石窟蛙',col:'#4a9670'},
  spiderF:{beh:'lunge',name:'巢蛛',col:'#62407e'}, batF:{beh:'lunge',name:'林蝠',col:'#40644a'},
  ghoulR:{beh:'blade',name:'根鬼',col:'#6a5034'}, wraithR:{beh:'ranged',name:'樹靈',col:'#4a8a52',proj:'glob'},
  beetleS:{beh:'lunge',name:'砂甲蟲',col:'#ac8c58'}, batS:{beh:'lunge',name:'岩蝠',col:'#8a7e62'},
  ghoulS:{beh:'blade',name:'沙墓乾屍',col:'#ae9a74'}, wraithS:{beh:'ranged',name:'沙靈',col:'#c8a84a',proj:'bolt'},
  spiderL:{beh:'lunge',name:'熔岩蛛',col:'#e8582a'}, impL:{beh:'ranged',name:'火小鬼',col:'#d04030',proj:'ember'},
  crabL:{beh:'heavy',name:'黑曜蟹',col:'#463c46'}, beetleL:{beh:'lunge',name:'熔甲蟲',col:'#e8582a'},
  spiderI:{beh:'lunge',name:'冰晶蛛',col:'#7aa4cc'}, batI:{beh:'lunge',name:'霜蝠',col:'#b8c8e0'},
  ghoulI:{beh:'blade',name:'霜屍鬼',col:'#98aac4'}, wraithI:{beh:'ranged',name:'雪魂',col:'#d0dcec',proj:'bolt'},
  frogP:{beh:'slime',name:'腐沼蛙',col:'#6a4488'}, beetleP:{beh:'lunge',name:'腐根甲蟲',col:'#3e5630'},
  crabP:{beh:'heavy',name:'沉沼蟹',col:'#526030'}, wraithP:{beh:'ranged',name:'水鬼',col:'#3a7868',proj:'glob'},
  ghoulK:{beh:'blade',name:'王城亡衛',col:'#706e84'}, wraithK:{beh:'ranged',name:'王魂',col:'#6a5096',proj:'bolt'}, batK:{beh:'lunge',name:'墓蝠',col:'#4a3e58'},
  impF:{beh:'ranged',name:'爐火小鬼',col:'#d07a28',proj:'ember'}, beetleF:{beh:'lunge',name:'青銅甲蟲',col:'#9a6c32'}, spiderB:{beh:'lunge',name:'熔爐蛛',col:'#7e7054'},
  frogT:{beh:'slime',name:'祭壇蛙',col:'#3a7e68'}, wraithT:{beh:'ranged',name:'看守之影',col:'#3a4a96',proj:'bolt'}, ghoulT:{beh:'blade',name:'沉沒祭司',col:'#406a50'},
  // 精靈王國（art/elfMonsters.ts）+ 地城「螢月禁林」
  elfHound:{beh:'lunge',name:'銀月獵犬',col:'#9ab8c0'}, elfArcher:{beh:'ranged',name:'精靈弓手',col:'#62904a',proj:'arrow'},
  elfBlade:{beh:'blade',name:'精靈劍舞者',col:'#40867a'}, elfTreant:{beh:'heavy',name:'古樹衛士',col:'#c8ccd6'},
  elfShade:{beh:'blade',name:'墮落的精靈',col:'#503a7a'}, wraithE:{beh:'ranged',name:'螢火之靈',col:'#c8f0a0',proj:'glob'}, mothE:{beh:'lunge',name:'月蛾',col:'#e8dcb0'},
} as Record<string, { beh: string; name: string; col: string; proj?: string }>;
/* ================= 武器 =================
   攻擊力 = 武器的基礎攻擊（每種武器固定）× 強化倍率。沒有品階、沒有隨機詞綴：
   一把 +0 長劍不管在哪裡撿到都一樣強，要變強就拿素材去鐵匠那裡強化（+1 ～ +10，見 data/forge.ts）。
   想要出血、燃燒…… 就裝「刻印」（可以拆下來換到別把）。獨特武器（data/uniques.ts）有固定的效果，不能裝刻印。 */
export const UP_MAX = 10;
export const upMult = (up: number) => 1 + .32 * (up || 0);               // +10 ≈ 4.2 倍
export const wBase = (it: Item) => it.uq && UQ[it.uq] ? UQ[it.uq].base : WT[it.type].base;
export const wAtk = (it: Item) => Math.round(wBase(it) * upMult(it.up));
export const refreshWeapon = (it: Item) => { it.atk = wAtk(it); return it; };
const wName = (type: string, fx?: string) => (fx ? WFXD[fx].pre : '') + WT[type].name;
export function makeWeapon(type: string, up = 0, fx?: string): Item {
  const it: Item = { id: G.uid++, slot:'weapon', type, ilvl: 0, rarity: fx ? 3 : 0, up: Math.max(0, Math.min(UP_MAX, up)), aff: {}, name: wName(type, fx) };
  if (fx) it.fx = fx;
  return refreshWeapon(it);
}
export function makeUnique(key: string, up = 0): Item {
  const U = UQ[key];
  return refreshWeapon({ id: G.uid++, slot:'weapon', type: U.type, ilvl: 0, rarity: 4, up, aff: { ...U.aff }, name: U.name, uq: key });
}
/** 讀檔時補齊：舊的獨特武器對回編號；一般武器拿掉隨機詞綴（刻印保留，之後可以拆下來） */
export function fixWeapon(it: Item) {
  if (!WT[it.type]) return it;
  const k = it.uq || UQ_BY_NAME[it.name];
  if (k && UQ[k]) { it.uq = k; it.rarity = 4; it.type = UQ[k].type; delete it.fx; it.name = UQ[k].name; it.aff = { ...UQ[k].aff }; }
  else { it.aff = {}; if (it.fx && !WFXD[it.fx]) delete it.fx; it.rarity = it.fx ? 3 : 0; it.name = wName(it.type, it.fx); }
  return refreshWeapon(it);
}
/** 把刻印裝到一般武器上（原本的刻印變回道具，回傳它；沒有就回傳 null） */
export function attachSeal(w: Item, seal: Item): Item | null {
  if (w.uq || seal.slot !== 'seal') return null;
  const old = w.fx ? makeSeal(w.fx) : null;
  w.fx = seal.fx; w.rarity = 3; w.name = wName(w.type, w.fx); return old;
}
export function detachSeal(w: Item): Item | null {
  if (w.uq || !w.fx) return null;
  const s = makeSeal(w.fx); delete w.fx; w.rarity = 0; w.name = wName(w.type); return s;
}
/** 舊名稱相容：makeItem(type, 強化等級, 稀有度) → 稀有度不再有意義 */
export const makeItem = (type: string, up: number, _rarity?: number) => makeWeapon(type, up);
/** 顯示用名稱：+3 血棘長劍、+2 獵人皮甲 */
export const itemName = (it: Item) => ((it.slot === 'weapon' || it.slot === 'armor') && it.up ? '+' + it.up + ' ' : '') + it.name;
/** 商店價格、分解魂晶的基準 */
export const gearValue = (it: Item) => {
  const sl = slotOf(it), u = it.uq || it.ug ? 4 : 1;
  if (sl === 'weapon') return Math.round(12 * (1 + .6 * (it.up || 0)) * u * (it.fx ? 2 : 1));
  if (sl === 'armor') return Math.round(25 * (1 + .5 * (it.up || 0)) * u * (it.rarity >= 2 ? 1.6 : 1));
  if (sl === 'seal') return 60;
  return Math.round(45 * u);
};
/* ---- 防具、飾品、刻印（定義在 data/gear.ts） ---- */
export const AT = { robe:{ name:'法袍', d:'輕甲' }, leather:{ name:'皮甲', d:'中甲' }, mail:{ name:'鎖甲', d:'重甲' } };
export const TT = { ring:{ name:'戒指', d:'飾品' }, amulet:{ name:'項鍊', d:'飾品' } };
export const SLOTN = { weapon:'武器', armor:'防具', trinket:'飾品', seal:'刻印' };
export const slotOf = it => it.slot || (AT[it.type] ? 'armor' : TT[it.type] ? 'trinket' : it.type === 'seal' ? 'seal' : 'weapon');
export function makeArmor(ak: string, up = 0): Item {
  const A = ARMORS[ak] || ARMORS.cloth;
  return { id: G.uid++, slot:'armor', type: A.type, ilvl: 0, rarity: A.eff ? 2 : 0, up, aff: {}, name: A.name, ak: ARMORS[ak] ? ak : 'cloth' };
}
export function makeTrinket(tk: string): Item {
  const T = TRINKETS[tk] || TRINKETS.life;
  return { id: G.uid++, slot:'trinket', type: T.type, ilvl: 0, rarity: 2, aff: {}, name: T.name, tk: TRINKETS[tk] ? tk : 'life' };
}
export function makeSeal(fx: string): Item {
  return { id: G.uid++, slot:'seal', type:'seal', ilvl: 0, rarity: 3, aff: {}, name: SEAL_NAME(WFXD[fx].n), fx };
}
/** 獨特防具 / 飾品（data/uniques.ts 的 UG）：固定名字、效果、背景故事 */
export function makeUniqueGear(key: string): Item {
  const U = UG[key], isA = !!AT[U.type];
  return { id: G.uid++, slot: isA ? 'armor' : 'trinket', type: U.type, ilvl: 0, rarity: 4, up: 0, aff: {}, name: U.name, ug: key };
}
/** 防具的類型、防禦、生命（含強化） */
export function armorStats(it: Item | null) {
  if (!it) return null;
  const cls = ACLS_OF[it.type] || 'light', C = ACLS[cls], m = aUpMult(it.up), u = it.ug ? 1.1 : 1;
  return { cls, def: Math.round(C.def * m * u), hp: Math.round(C.hp * m * u) };
}
/** 一件防具 / 飾品帶的效果 */
export function effOf(it: Item | null): Record<string, number> {
  if (!it) return {};
  if (it.ug && UG[it.ug]) return UG[it.ug].eff;
  if (it.tk && TRINKETS[it.tk]) return TRINKETS[it.tk].eff;
  if (it.ak && ARMORS[it.ak]) return ARMORS[it.ak].eff || {};
  return {};
}
/** 舊名稱相容：makeGear(type, 物品等級, 稀有度) → 依類型做一件新制的裝備 */
export function makeGear(type: string, _ilvl?: number, _rarity?: number): Item {
  if (WT[type]) return makeWeapon(type);
  if (AT[type]) return makeArmor({ robe: 'cloth', leather: 'hunter', mail: 'chain' }[type]);
  if (TT[type]) return makeTrinket(pick(TRINKET_KEYS.filter(k => TRINKETS[k].type === type)));
  return makeSeal(pick(FX_KEYS));
}
/** 讀檔：舊的防具 / 飾品（物品等級 + 隨機詞綴）→ 新制 */
export function fixGear(it: Item): Item | null {
  if (!it) return null;
  if (it.ug && UG[it.ug]) { it.rarity = 4; it.name = UG[it.ug].name; it.slot = AT[UG[it.ug].type] ? 'armor' : 'trinket'; it.aff = {}; it.up = it.up || 0; return it; }
  if (it.slot === 'seal' || it.type === 'seal') return it.fx && WFXD[it.fx] ? it : null;
  if (AT[it.type]) { if (!it.ak || !ARMORS[it.ak]) { const n = makeArmor({ robe: 'cloth', leather: 'hunter', mail: 'chain' }[it.type]); n.id = it.id; return n; } it.aff = {}; it.up = it.up || 0; return it; }
  if (TT[it.type]) { if (!it.tk || !TRINKETS[it.tk]) { const n = makeTrinket(it.type === 'ring' ? 'hawk' : 'life'); n.id = it.id; return n; } it.aff = {}; return it; }
  return null;
}
export const DROP_WEAPONS = ['sword', 'dagger', 'axe', 'spear', 'staff', 'katana', 'hammer', 'bow', 'greatsword', 'rapier'];   // 會從怪物身上掉、商人會賣的武器（鐮刀打中會回血，只有 Boss 的獨特武器腐沼之鐮；狼牙雙刃、月牙刀、雙頭刀、暗月大劍只有獨特的）
function pickWeaponType() {                                              // 你能裝備的武器類型比較容易掉（權重 3：1）
  const pl = G.me; if (!pl) return pick(DROP_WEAPONS);
  const w = DROP_WEAPONS.map(t => meets(pl, { type: t, ilvl: 0, slot: 'weapon' } as Item) ? 3 : 1), sum = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum; for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return DROP_WEAPONS[i]; return DROP_WEAPONS[0];
}
const regionOfLv = (lv: number) => { const t = tier(lv); return t <= 5 ? 'plains' : t <= 10 ? 'forest' : t <= 15 ? 'wastes' : t <= 20 ? 'lava' : t <= 25 ? 'snow' : 'swamp'; };
/** 隨機裝備。kind：'weapon' = 武器、'gear' = 防具 / 飾品 / 刻印、不給 = 寶箱那種混著來。
    rarity 是舊參數：越高越容易出飾品和刻印（而不是一般防具）
    cap = 最高到哪個顏色（RAR 的編號）：野外寶箱是 2（藍色）→ 不會開出刻印，武器也不會帶刻印 */
export function randomLoot(lv, rarity = 1, kind?: 'weapon' | 'gear', cap = 4) {
  const q = Math.random();
  if (kind === 'weapon' || (!kind && q < .3)) return makeWeapon(pickWeaponType(), 0, cap >= 3 && rarity >= 3 && Math.random() < .35 ? pick(FX_KEYS) : undefined);
  const r = Math.random() * (1 + rarity * .15), rg = regionOfLv(lv);
  if (r < .45) return makeArmor(Math.random() < .15 ? pick(ARMOR_BUILD) : ARMOR_REGION[rg] && Math.random() < .6 ? ARMOR_REGION[rg] : pick(ARMOR_BASIC));   // 15%：流派防具（反傷、閃避）
  if (r < .9 || cap < 3) return makeTrinket(pick(TRINKET_KEYS));
  return makeSeal(pick(FX_KEYS));
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
    seal: sculpt(24, 26, [{ sh: SH.poly([[12, 1], [22, 8], [20, 24], [4, 24], [2, 8]]), ramp: ['#2a1640', '#4a2a78', '#7a52b8', '#a888e0'], tex: .25, grp: 1 }],   // 刻印：刻著發光符文的紫色石片
      a => { a.line(12, 6, 12, 19, '#f0e0ff'); a.line(8, 10, 16, 15, '#e0c8ff'); a.line(16, 10, 8, 15, '#e0c8ff'); a.set(12, 12, '#ffffff'); }),
    potion: sculpt(22, 26, [{ sh: SH.box(11, 4, 3, 3, 3), ramp: ['#5a3c26', '#7a5434', '#9a7048'], grp: 1 }, { sh: SH.ell(11, 16, 8.5, 9), ramp: ['#5a1018', '#a8202e', '#e04a5a', '#ff9aa8'], grp: 2 }], a => { a.set(7, 12, '#ffffff'); a.set(8, 11, '#ffffff'); }),
    tear: sculpt(22, 28, [{ sh: SH.ell(11, 18, 8, 8), ramp: ['#0e3a4e', '#2a7a9a', '#6ac8e8', '#e0faff'], grp: 1 }, { sh: SH.poly([[11, 1], [18, 15], [4, 15]]), ramp: ['#0e3a4e', '#2a7a9a', '#6ac8e8', '#e0faff'], grp: 1 }],   // 重生水滴
      a => { a.set(8, 14, '#ffffff'); a.set(7, 16, '#ffffff'); a.set(7, 17, '#ffffff'); }),
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

