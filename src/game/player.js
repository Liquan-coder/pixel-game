import { G } from '../core/state.js';
import { $ } from '../core/util.js';
import { WT, makeItem } from '../data/items.js';

/* ================= STATE ================= */
/* P, enemies, projs, drops, fx, parts, nums, motes, ghosts, B, lost → 已移到 G（core/state.js） */
/* lastCamp, paused, started, time, deathT, shakeT, shakeMag, hitStop → 已移到 G（core/state.js） */
/* region, sub, potMax → 已移到 G（core/state.js） */
export const light = { amb:.06, t:[10, 12, 30] };
export const cam = { x: 0, y: 0 };
export const keys = {}, pressed = {}, held = {};
export const joy = { active:false, id:null, bx:0, by:0, dx:0, dy:0 };
export const input = { mx:0, my:0 };

export function newPlayer() {
  G.P = { x:0, y:0, r:5, face:0, flip:false, hp:100, maxHp:100, st:80, maxSt:80, stDelay:0, vit:1, str:1, end:1, souls:0,
    inv:[], weapon: makeItem('sword', 1, 0), armor:null, trinket:null, gold:0, def:0, defRed:0, pot:3, atkCd:0, skillCd:0, iframe:0, hurt:0, dodge:0, dvx:0, dvy:0, drink:0,
    skillLock:0, aimLock:0, swing:null, dash:null, timers:[], kx:0, ky:0, moving:false, dead:false,
    crit:5, ls:0, aspd:1, cdr:0, spin:0, thrust:0, slam:0, anim:0 };
  G.P.weapon.name = '鏽鐵長劍'; G.P.weapon.atk = 12;
  G.potMax = 3;
  recalc(); G.P.hp = G.P.maxHp; G.P.st = G.P.maxSt;
}
export const level = () => G.P.vit + G.P.str + G.P.end - 2;
export const lvCost = () => { const L = level(); return Math.floor(16 * Math.pow(1.16, L - 1) + 6 * L); };
export const curEq = () => ({ weapon:G.P.weapon, armor:G.P.armor, trinket:G.P.trinket });
export function calcStats(eq) {                                               // 依照裝備算出所有屬性（換裝預覽也用這個）
  const a = {}; for (const it of [eq.weapon, eq.armor, eq.trinket]) if (it) for (const k in it.aff) a[k] = (a[k] || 0) + it.aff[k];
  const def = (eq.armor ? eq.armor.def || 0 : 0) + (a.def || 0);
  return { maxHp: 80 + 20 * G.P.vit + (a.hp || 0) + (eq.armor ? eq.armor.hp || 0 : 0), maxSt: 70 + 10 * G.P.end + (a.st || 0),
    crit: 5 + (a.crit || 0), ls: (a.lifesteal || 0) / 100, aspd: 1 + (a.speed || 0) / 100, cdr: Math.min(.5, (a.cdr || 0) / 100),
    def, defRed: def / (def + 60), atk: Math.round(eq.weapon.atk * (1 + .1 * (G.P.str - 1))) };
}
export function recalc() {
  const st = calcStats(curEq());
  G.P.maxHp = st.maxHp; G.P.maxSt = st.maxSt; G.P.crit = st.crit; G.P.ls = st.ls; G.P.aspd = st.aspd; G.P.cdr = st.cdr; G.P.def = st.def; G.P.defRed = st.defRed;
  G.P.hp = Math.min(G.P.hp, G.P.maxHp); G.P.st = Math.min(G.P.st, G.P.maxSt);
  $('skillName').textContent = WT[G.P.weapon.type].sn; $('skillHudName').textContent = WT[G.P.weapon.type].sn;
}

