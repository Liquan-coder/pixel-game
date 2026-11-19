import { G } from '../core/state';
import { $ } from '../core/util';
import { WT, makeWeapon } from '../data/items';
import { soft, weaponAtk } from '../data/attrs';
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
    inv:[], weapon: makeWeapon('sword'), armor:null, trinket:null, gold:0, def:0, defRed:0, pot:3, atkCd:0, skillCd:0, iframe:0, hurt:0, dodge:0, dvx:0, dvy:0, drink:0,
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
export const level = (pl: Player) => pl.vit + pl.end + pl.str + pl.dex + pl.int + pl.luk - 29;   // 六種都是 5 的時候是 1 級
export const lvCost = (pl: Player) => { const L = level(pl); return Math.floor(16 * Math.pow(1.16, L - 1) + 6 * L); };
export const curEq = (pl: Player) => ({ weapon:pl.weapon, armor:pl.armor, trinket:pl.trinket });
export function calcStats(pl: Player, eq) {                                               // 依照裝備算出所有屬性（換裝預覽也用這個）
  const a: Record<string, number> = {}; for (const it of [eq.weapon, eq.armor, eq.trinket]) if (it) for (const k in it.aff) a[k] = (a[k] || 0) + it.aff[k];
  const def = (eq.armor ? eq.armor.def || 0 : 0) + (a.def || 0) + Math.round(.5 * soft(pl.end));
  return { maxHp: Math.round(100 + 22 * soft(pl.vit)) + (a.hp || 0) + (eq.armor ? eq.armor.hp || 0 : 0), maxSt: Math.round(80 + 8 * soft(pl.end)) + (a.st || 0),
    crit: Math.round(5 + (a.crit || 0) + Math.min(12, .4 * soft(pl.luk))), ls: (a.lifesteal || 0) / 100,
    aspd: 1 + (a.speed || 0) / 100 + Math.min(.15, .006 * soft(pl.dex)), cdr: Math.min(.5, (a.cdr || 0) / 100 + Math.min(.15, .006 * soft(pl.int))),
    def, defRed: def / (def + 60), atk: weaponAtk(pl, eq.weapon) };
}
export function recalc(pl: Player) {
  const st = calcStats(pl, curEq(pl));
  pl.maxHp = st.maxHp; pl.maxSt = st.maxSt; pl.crit = st.crit; pl.ls = st.ls; pl.aspd = st.aspd; pl.cdr = st.cdr; pl.def = st.def; pl.defRed = st.defRed; pl.atkPow = st.atk;
  pl.hp = Math.min(pl.hp, pl.maxHp); pl.st = Math.min(pl.st, pl.maxSt);
  if (pl === G.me) { $('skillName').textContent = WT[pl.weapon.type].sn; $('skillHudName').textContent = WT[pl.weapon.type].sn; }   // 技能按鈕只顯示「我」的
}

