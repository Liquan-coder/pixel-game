import { tier } from '../data/levels';
import { G } from '../core/state';
import { $ } from '../core/util';
import { WT, armorStats, effOf, makeWeapon } from '../data/items';
import { ACLS, A_WEIGHT, W_WEIGHT, loadCap, loadTier } from '../data/gear';
import { ATTRS, ATTR_BASE, CRIT_BASE, perks, soft, weaponAtk } from '../data/attrs';
import type { Player } from '../types';

/* ================= STATE ================= */
/* P（現在是 G.players / G.me）, enemies, projs, drops, fx, parts, nums, motes, ghosts, B, lost → 已移到 G（core/state.js） */
/* lastCamp, paused, started, time, shakeT, shakeMag, hitStop → 已移到 G（core/state.js） */
/* region, sub, potMax → 已移到 G（core/state.js） */
export const light = { amb:.06, t:[10, 12, 30] };
export const cam = { x: 0, y: 0 };
export const keys: Record<string, boolean> = {}, pressed: Record<string, boolean> = {}, held: Record<string, boolean> = {};
export const joy = { active:false, id:null, bx:0, by:0, dx:0, dy:0 };
export const input = { mx:0, my:0 };

// 建立一個新玩家（還沒放進 G.players）
export function newPlayer(id = 'local'): Player {
  const pl = { id, x:0, y:0, r:5, face:0, flip:false, hp:100, maxHp:100, st:80, maxSt:80, stDelay:0, vit:5, str:5, end:5, dex:5, int:5, luk:5, souls:0, mats:{},
    inv:[], weapon: makeWeapon('sword'), armor:null, trinkets:[null, null, null, null], gold:0, tears:0, freePts:0, def:0, defRed:0, pot:3, atkCd:0, skillCd:0, iframe:0, hurt:0, dodge:0, dvx:0, dvy:0, drink:0,
    skillLock:0, aimLock:0, swing:null, dash:null, timers:[], kx:0, ky:0, moving:false, dead:false, deathT:0,
    crit:5, ls:0, aspd:1, cdr:0, spin:0, thrust:0, slam:0, anim:0 };
  pl.weapon.name = '鏽鐵長劍';
  G.potMax = 3;
  recalc(pl); pl.hp = pl.maxHp; pl.st = pl.maxSt;
  return pl;
}
// 單機：重設成只有「我」一個玩家
export function resetPlayers() {
  G.me = newPlayer('local');
  G.players = [G.me];
}
// 敵人選目標：離 (x, y) 最近、還活著的玩家；全部都倒了就回傳最近的那個（讓敵人知道要回家）
export function nearestPlayer(x, y) {
  let best = null, bd = Infinity;
  for (const pl of G.players) {
    const d = Math.hypot(pl.x - x, pl.y - y) + (pl.dead ? 1e6 : 0);
    if (d < bd) { bd = d; best = pl; }
  }
  return best;
}
export const level = (pl: Player) => pl.vit + pl.end + pl.str + pl.dex + pl.int + pl.luk - 29 + (pl.freePts || 0);   // 六種都是 5 的時候是 1 級；用重生水滴洗掉、還沒分配的點數也算
/* 升一級要多少魂晶：1 級 25，每升一級多 10%（下一級 = 這一級 × 1.1）；過了 30 級改成每級只多 3.5%，後期才不會變成天文數字
   例：1 級 25、10 級 59、20 級 153、30 級 397、50 級 790、80 級 2215（打同等級的怪：前期 2～3 隻升一級，後期 15 隻左右） */
export const LV_SOFT = 30;
export const lvCost = (pl: Player) => { const L = Math.max(1, level(pl)); return Math.round(25 * Math.pow(1.1, Math.min(L, LV_SOFT) - 1) * Math.pow(1.035, Math.max(0, L - LV_SOFT))); };
export const curEq = (pl: Player) => ({ weapon:pl.weapon, armor:pl.armor, trinkets:pl.trinkets });
export const DR_CAP = .4;                                               // 防禦減傷最多 40%（穿再重也不會變成打不痛）
/* 依照裝備算出所有屬性（換裝預覽也用這個）
   生命主要靠「體魄」；防具只加一點生命和防禦；飾品 / 防具效果（tfx）各管一件事；獨特武器還有固定詞綴（a） */
export function calcStats(pl: Player, eq) {
  const a: Record<string, number> = { ...(eq.weapon && eq.weapon.aff) };
  const T: Record<string, number> = {}, add = (e: Record<string, number>) => { for (const k in e) T[k] = (T[k] || 0) + e[k]; };
  add(effOf(eq.armor)); for (const t of eq.trinkets || []) add(effOf(t));
  const P = perks(pl); add({ heal: P.heal, retal: P.retal, charge: P.charge, chargeDmg: P.chargeDmg, dodgeSave: P.dodgeSave, fxBuild: P.fxBuild });   // 能力值的流派副效果（data/attrs.ts 的 PERK）
  if (T.lifesteal) a.lifesteal = (a.lifesteal || 0) + T.lifesteal;
  const A = armorStats(eq.armor), C = A ? ACLS[A.cls] : null;
  const def = (A ? A.def : 0) + Math.round(.5 * soft(pl.end));
  return { maxHp: Math.round((100 + 22 * soft(pl.vit) + (a.hp || 0) + (A ? A.hp : 0)) * (1 + (T.hpPct || 0) / 100)), maxSt: Math.round(80 + 8 * soft(pl.end)) + (T.stam || 0),
    crit: Math.round(5 + (a.crit || 0) + (T.crit || 0) + P.crit), critMul: Math.round((CRIT_BASE + P.critDmg) * 100) / 100, ls: (a.lifesteal || 0) / 100,
    aspd: 1 + ((a.speed || 0) + (T.aspd || 0)) / 100 + Math.min(.15, .006 * soft(pl.dex)),
    cdr: Math.min(.5, ((a.cdr || 0) + (T.cdr || 0) + (C ? C.cdr : 0)) / 100 + Math.min(.15, .006 * soft(pl.int))),
    def, defRed: Math.min(DR_CAP, def / (def + 60)), atk: Math.round(weaponAtk(pl, eq.weapon) * (1 + (T.atkPct || 0) / 100)), tfx: T, acls: A ? A.cls : '',
    ...loadOf(pl, eq) };
}
/* 負重（data/gear.ts）：武器 + 防具的重量、上限、第幾段（0 輕盈 / 1 普通 / 2 沉重 / 3 超重） */
export function loadOf(pl: Player, eq) {
  const A = armorStats(eq.armor), load = (eq.weapon ? W_WEIGHT[eq.weapon.type] || 4 : 0) + (A ? A_WEIGHT[A.cls] || 0 : 0), cap = loadCap(pl.end);
  return { load, loadCap: cap, loadTier: loadTier(load, cap) };
}
export function recalc(pl: Player) {
  const st = calcStats(pl, curEq(pl));
  pl.maxHp = st.maxHp; pl.maxSt = st.maxSt; pl.crit = st.crit; pl.critMul = st.critMul; pl.ls = st.ls; pl.aspd = st.aspd; pl.cdr = st.cdr; pl.def = st.def; pl.defRed = st.defRed; pl.atkPow = st.atk; pl.tfx = st.tfx; pl.acls = st.acls; pl.load = st.load; pl.loadCap = st.loadCap; pl.loadTier = st.loadTier;
  pl.hp = Math.min(pl.hp, pl.maxHp); pl.st = Math.min(pl.st, pl.maxSt);
  if (pl === G.me) { $('skillName').textContent = WT[pl.weapon.type].sn; $('skillHudName').textContent = WT[pl.weapon.type].sn; }   // 技能按鈕只顯示「我」的
}


/** 重生水滴（城鎮的修女 / 祭司那裡用，world/towns.ts）：六種能力值洗回 5，洗掉的點數變成免費點數，到營火的升級畫面重新分配。等級不變 */
export function respec(pl: Player) {
  if (!(pl.tears > 0)) return 0;
  pl.tears--; pl.freePts = level(pl) - 1; for (const a of ATTRS) pl[a.k] = ATTR_BASE;
  recalc(pl); pl.hp = pl.maxHp; pl.st = pl.maxSt; return pl.freePts;
}
