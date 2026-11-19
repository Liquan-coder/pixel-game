/* ================= 刻印效果 =================
   史詩武器隨機帶一種、傳說（獨特）武器固定帶一種。稀有度不加攻擊力，改成給這些效果。
   掛在 combat.ts 的 damageEnemy（每次命中）和擊殺時；燃燒每幀在 tickWeaponFx 結算。 */
import { G } from '../core/state';
import { pick, rr } from '../core/util';
import { sfx } from '../core/audio';
import type { Enemy, Item, Player } from '../types';
import { UQ } from '../data/uniques';

export const WFXD: Record<string, { n: string; c: string; d: string; pre: string }> = {
  bleed: { n: '出血', c: '#ff5a64', pre: '血棘', d: '連續命中會累積出血，滿了爆發「最大生命 15%」的傷害（Boss 5%）' },
  burn:  { n: '燃燒', c: '#ff9a3a', pre: '烈焰', d: '命中有 30% 機率點燃敵人：3 秒內每 0.5 秒受到攻擊力 20% 的傷害' },
  frost: { n: '寒霜', c: '#9ae0ff', pre: '霜語', d: '連續命中會累積凍傷，滿了造成攻擊力 150% 的傷害並凍住敵人 1 秒（Boss 不會被凍住）' },
  shock: { n: '雷鳴', c: '#ffe85a', pre: '雷鳴', d: '命中有 20% 機率放出閃電，打中附近最多 2 個敵人（傷害 60%）' },
  soul:  { n: '噬魂', c: '#c8a8ff', pre: '噬魂', d: '打倒敵人時回復 4% 生命，拿到的魂晶 +25%' },
};
export const FX_KEYS = Object.keys(WFXD);
export const fxOf = (it: Item | null) => it ? (it.uq && UQ[it.uq] ? UQ[it.uq].fx : it.fx) || null : null;

type RawHit = (pl: Player, e: Enemy, v: number, col: string) => void;
type Targets = (pl: Player) => Enemy[];
let rawHit: RawHit, targetsOf: Targets;
export function bindFx(r: RawHit, t: Targets) { rawHit = r; targetsOf = t; }   // combat.ts 開機時接上（避免互相 import）

const num = (e: Enemy, txt: string, col: string) => G.nums.push({ x: e.x + rr(-4, 4), y: e.y - (e.boss ? 34 : 22), txt, col, t: 0, d: .8, big: true });
function sparks(e: Enemy, col: string, n: number) { for (let i = 0; i < n; i++) G.parts.push({ x: e.x + rr(-5, 5), y: e.y - rr(2, 14), vx: rr(-40, 40), vy: -rr(20, 70), life: rr(.3, .6), max: .6, col, star: rr(.8, 1.8), drag: 2 }); }

/** 每次命中（proc = 由效果本身造成的傷害，不再觸發，避免連鎖無限） */
export function onHit(pl: Player, e: Enemy, v: number, crit: boolean) {
  const fx = fxOf(pl.weapon); if (!fx || e.hp <= 0) return;
  const pow = pl.atkPow || pl.weapon.atk || 10;
  if (fx === 'bleed') { e.bleedB = (e.bleedB || 0) + 22 + (crit ? 15 : 0);
    if (e.bleedB >= 100) { e.bleedB = 0; const d = Math.round(Math.max(pow * .6, e.maxHp * (e.boss ? .05 : .15)));
      num(e, '出血 ' + d, WFXD.bleed.c); sparks(e, '#e0303a', 16); sfx.crit(); rawHit(pl, e, d, WFXD.bleed.c); } }
  else if (fx === 'frost') { e.frostB = (e.frostB || 0) + 25;
    if (e.frostB >= 100) { e.frostB = 0; const d = Math.round(pow * 1.5); if (!e.boss) e.stun = Math.max(e.stun || 0, e.elite ? .4 : 1);
      num(e, '凍傷 ' + d, WFXD.frost.c); sparks(e, '#c8f0ff', 14); G.fx.push({ k: 'ring', x: e.x, y: e.y, r0: 4, r1: 22, t: 0, d: .3, col: '#9ae0ff' }); rawHit(pl, e, d, WFXD.frost.c); } }
  else if (fx === 'burn') { if (Math.random() < .3) { if (!(e.burnT > 0)) sparks(e, '#ff9a3a', 8); e.burnT = 3; e.burnD = Math.max(1, Math.round(pow * .2)); e.burnBy = pl; } }
  else if (fx === 'shock') { if (Math.random() < .2) {
    const near = targetsOf(pl).filter(o => o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 64).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 2);
    for (const o of near) { bolt(e.x, e.y - 8, o.x, o.y - 8); rawHit(pl, o, Math.max(1, Math.round(v * .6)), WFXD.shock.c); }
    if (near.length) sfx.crit(); } }
}
/** 擊殺（回傳魂晶倍率） */
export function onKill(pl: Player, e: Enemy) {
  if (fxOf(pl.weapon) !== 'soul' || !pl) return 1;
  const h = Math.round(pl.maxHp * .04); pl.hp = Math.min(pl.maxHp, pl.hp + h);
  G.nums.push({ x: pl.x, y: pl.y - 28, txt: '+' + h, col: '#c8a8ff', t: 0, d: .7 }); sparks(e, '#c8a8ff', 10);
  return 1.25;
}
/** 燃燒：每 0.5 秒扣一次 */
export function tickWeaponFx(dt: number, list: Enemy[]) {
  for (const e of list) { if (!(e.burnT > 0) || e.hp <= 0) continue;
    e.burnT -= dt; e.burnAcc = (e.burnAcc || 0) + dt;
    if (Math.random() < dt * 14) G.parts.push({ x: e.x + rr(-4, 4), y: e.y - rr(2, 10), vx: rr(-6, 6), vy: -rr(20, 40), life: .4, max: .4, col: pick(['#ff9a3a', '#ffd27a', '#e8402a']), star: 1, drag: 1 });
    if (e.burnAcc >= .5) { e.burnAcc -= .5; G.nums.push({ x: e.x + rr(-4, 4), y: e.y - 18, txt: String(e.burnD), col: WFXD.burn.c, t: 0, d: .5 }); rawHit(e.burnBy || G.me, e, e.burnD, WFXD.burn.c); } }
}
function bolt(x0: number, y0: number, x1: number, y1: number) {                // 鋸齒狀閃電：三段斜線
  let px = x0, py = y0;
  for (let i = 1; i <= 3; i++) { const t = i / 3, nx = x0 + (x1 - x0) * t + (i < 3 ? rr(-6, 6) : 0), ny = y0 + (y1 - y0) * t + (i < 3 ? rr(-6, 6) : 0);
    G.fx.push({ k: 'aline', x: px, y: py, a: Math.atan2(ny - py, nx - px), len: Math.hypot(nx - px, ny - py), t: 0, d: .18, col: i === 2 ? '#ffffff' : '#ffe85a' }); px = nx; py = ny; }
}
