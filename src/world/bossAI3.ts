/* ---- 地城 Boss 的通用 AI：一套招式庫，每隻 Boss 用 world/dungeonBoss.ts 的 moves 挑自己的招式 ----
   每一招都是「預警（紅色範圍，越來越滿）→ 出招 → 收招」三段，預警時間二階段會變短。
   招式：
   charge 衝撞（直線預警 → 往前衝，撞到就受傷；trail = 身後留下一灘）  combo 連續三次衝撞
   slam   砸地（自己周圍一圈）        leap  跳到你頭上砸下來（落點一圈；pool = 落地留一灘）
   sweep  橫掃（面前扇形）            lash  鞭打 / 吐舌 / 光束（面前一條長直線，瞬間打中；trail = 線上留一排火）
   fan    扇射（往你的方向射一排彈）  nova  環射（往四面八方射一圈）
   rain   落雷 / 落石（你附近好幾個圓，倒數後落下）   pools 毒池（地上留下會持續扣血的一灘）
   summon 召喚這座地城的小怪 */
import { G } from '../core/state';
import { TAU, angDiff, clamp, pick, rr } from '../core/util';
import { DG } from '../data/items';
import { AI } from './bossAI';
import { addPool, fan, jumpStates, summon, tickPools } from './bossAI2';
import { keepIn, rbWind } from './regionBoss';
import { moveEnt, stepToward } from '../game/collision';
import { sfx } from '../core/audio';
import { hurtPlayer } from '../game/combat';
import { hitSpark, quakeFx, shake } from '../game/worldUpdate';
import type { Move } from './dungeonBoss';

const base = (e) => 10 + 3 * e.lv;
const dmgOf = (e, o) => Math.round(base(e) * (o.k || 1));
function shoot(e, a, spd, dmg) { const B = e.def.boss;
  G.projs.push({ x: e.x + Math.cos(a) * 16, y: e.y - 12 + Math.sin(a) * 12, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 5, life: 1.7, dmg, owner: 'e', kind: B.proj, R: 12, th: 5, cols: B.cols }); }
function strike(x, y, r, dmg, cols) {                                   // 落下的一擊：圓裡的人受傷 + 碎片 + 震動
  for (const pl of G.players) if (Math.hypot(pl.x - x, pl.y - y) < r - DG && hurtPlayer(pl, dmg, x, y)) hitSpark(pl.x, pl.y - 8, true, -Math.PI / 2);
  G.fx.push({ k: 'spike', x, y, r: r - 2, t: 0, d: .5 }); quakeFx(x, y, r);
  for (let i = 0; i < 7; i++) G.parts.push({ x: x + rr(-8, 8), y, vx: rr(-40, 40), vy: -rr(40, 110), life: .55, max: .55, col: pick(cols), s: 2, g: 300 });
}
function pickMove(e, d): Move {
  const B = e.def.boss, list: Move[] = e.phase === 2 ? B.moves.concat(B.p2) : B.moves;
  const ok = list.filter(([m]) => !(m === 'summon' && (e.sumT || 0) > 0) && !((m === 'sweep' || m === 'slam') && d > 90) && !(m === 'charge' && d < 40));
  let r = Math.random() * ok.reduce((s, m) => s + m[1], 0); for (const m of ok) if ((r -= m[1]) < 0) return m; return ok[0] || list[0];
}
const laneTele = (e, o) => [{ k: 'lane', a: e.aim, L: o.L, W: o.W }];
AI.dgn = (e, dt, d, dx, dy) => {
  const B = e.def.boss, D = e.def, p2 = e.phase === 2, wk = p2 ? .78 : 1;
  tickPools(e, dt); if (e.sumT > 0) e.sumT -= dt;
  e.pend = (e.pend || []).filter(m => { m.t -= dt; if (m.t > 0) return true; strike(m.x, m.y, m.r, m.dmg, m.cols); shake(2, .1); sfx.boom(); return false; });
  if (jumpStates(e, dt, e.mo?.r || 48, dmgOf(e, e.mo || {}), e.mo?.air || .7, () => { if (e.mo?.pool) addPool(e, e.x, e.y, 34, 3.5, Math.round(base(e) * .35), e.mo.pool); })) return;
  const o = e.mo || {};
  switch (e.state) {
    case 'idle': {
      e.t -= dt; e.flip = dx < 0;
      if (d > 40) stepToward(e, e.tgt.x, e.tgt.y, B.spd * (p2 ? 1.2 : 1), dt);
      if (e.t > 0) break;
      const [m, , mo = {}] = pickMove(e, d); e.mo = mo; e.aim = Math.atan2(dy, dx);
      if (m === 'charge' || m === 'combo') { e.combo = m === 'combo' ? 3 : 1; rbWind(e, 'chargeWind', .6 * wk, laneTele(e, mo)); }
      else if (m === 'slam') rbWind(e, 'slamWind', .75 * wk, [{ k: 'circle', r: mo.r }]);
      else if (m === 'leap') { rbWind(e, 'jumpWind', .7 * wk); e.tx = e.tgt.x; e.ty = e.tgt.y; }
      else if (m === 'sweep') rbWind(e, 'sweepWind', .55 * wk, [{ k: 'sector', r: mo.r, a: e.aim, half: mo.half }]);
      else if (m === 'lash') rbWind(e, 'lashWind', .6 * wk, laneTele(e, mo));
      else if (m === 'fan') { const n = mo.n + (p2 ? 2 : 0); e.shots = []; for (let i = 0; i < n; i++) e.shots.push(n === 1 ? e.aim : e.aim - mo.spread / 2 + mo.spread * i / (n - 1));
        rbWind(e, 'fanWind', .55 * wk, e.shots.map(a => ({ k: 'lane', a, L: 110, W: 12 }))); }
      else if (m === 'nova') { e.shots = []; const n = mo.n, a0 = rr(0, TAU); for (let i = 0; i < n; i++) e.shots.push(a0 + i / n * TAU);
        rbWind(e, 'novaWind', .7 * wk, [{ k: 'circle', r: 36 }]); }
      else if (m === 'rain') { const pts = []; for (let i = 0; i < mo.n + (p2 ? 2 : 0); i++) { const q = i === 0 ? { x: e.tgt.x, y: e.tgt.y } : { x: e.tgt.x + rr(-80, 80), y: e.tgt.y + rr(-60, 60) }; keepIn(q, D, 18); pts.push(q); }
        for (const [i, q] of pts.entries()) e.pend.push({ x: q.x, y: q.y, r: mo.r, t: .9 * wk + i * .08, T: .9 * wk + i * .08, dmg: dmgOf(e, mo), cols: mo.cols || B.cols });
        rbWind(e, 'castWind', .5); }
      else if (m === 'pools') { const pts = [{ x: e.tgt.x, y: e.tgt.y }]; for (let i = 1; i < mo.n + (p2 ? 1 : 0); i++) { const q = { x: e.tgt.x + rr(-70, 70), y: e.tgt.y + rr(-50, 50) }; keepIn(q, D, 24); pts.push(q); }
        e.cpts = pts; rbWind(e, 'poolWind', .8 * wk, pts.map(q => ({ k: 'circle', x: q.x, y: q.y, r: mo.r }))); }
      else if (m === 'summon') { e.sumT = 14; rbWind(e, 'summonWind', .7, [{ k: 'circle', r: 30 }]); }
      break; }
    case 'chargeWind':
      e.t -= dt; if (e.t > .2) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = laneTele(e, o); }
      if (e.t <= 0) { e.tele = null; e.state = 'dash'; e.t = o.L / o.spd; e.lvx = Math.cos(e.aim) * o.spd; e.lvy = Math.sin(e.aim) * o.spd; e.hitDone = false; sfx.dodge(); }
      break;
    case 'dash':
      e.t -= dt; if (moveEnt(e, e.lvx * dt, e.lvy * dt)) e.t = Math.min(e.t, .03); keepIn(e, D, e.r);
      if (Math.random() < .6) G.fx.push({ k: 'rghost', kind: e.kind, x: e.x, y: e.y, flip: e.flip, t: 0, d: .22 });
      if (o.trail && (e.trT = (e.trT || 0) + dt) > .09) { e.trT = 0; addPool(e, e.x, e.y, 16, 2.5, Math.round(base(e) * .3), o.trail); }
      if (!e.hitDone) for (const pl of G.players) if (Math.hypot(pl.x - e.x, pl.y - e.y) < e.r + pl.r + 4 && hurtPlayer(pl, dmgOf(e, o), e.x, e.y)) { e.hitDone = true; hitSpark(pl.x, pl.y - 8, true, e.aim); shake(4, .15); }
      if (e.t <= 0) { if (--e.combo > 0) { e.aim = Math.atan2(dy, dx); rbWind(e, 'chargeWind', .32 * wk, laneTele(e, o)); } else { e.state = 'idle'; e.t = rr(.6, .9) * wk; } }
      break;
    case 'slamWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null;
        for (const pl of G.players) if (Math.hypot(pl.x - e.x, pl.y - e.y) < o.r - DG && hurtPlayer(pl, dmgOf(e, o), e.x, e.y)) hitSpark(pl.x, pl.y - 8, true, Math.atan2(pl.y - e.y, pl.x - e.x));
        for (const dl of [0, .08]) G.fx.push({ k: 'warp', x: e.x, y: e.y, r0: 6, r1: o.r + 8, th: 6, delay: dl, t: 0, d: .4 + dl, col: D.aura[0] });
        quakeFx(e.x, e.y, o.r); sfx.boom(); shake(6, .3); G.hitStop = Math.max(G.hitStop, .07); e.state = 'idle'; e.t = rr(.8, 1.1) * wk; }
      break;
    case 'sweepWind':
      e.t -= dt; if (e.t > .2) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = [{ k: 'sector', r: o.r, a: e.aim, half: o.half }]; }
      if (e.t <= 0) { e.tele = null;
        for (const pl of G.players) { const pd = Math.hypot(pl.x - e.x, pl.y - e.y); if (pd < o.r - DG && angDiff(Math.atan2(pl.y - e.y, pl.x - e.x), e.aim) < o.half - DG / Math.max(pd, 20) && hurtPlayer(pl, dmgOf(e, o), e.x, e.y)) hitSpark(pl.x, pl.y - 8, true, e.aim); }
        G.fx.push({ k: 'smear', x: e.x, y: e.y - 12, a0: e.aim - o.half, a1: e.aim + o.half, r: o.r - 6, w: 14, sw: .1, hold: .14, delay: 0, t: 0, d: .26, cols: B.cols, sy: .8 });
        sfx.swing(); shake(3, .12); e.state = 'idle'; e.t = rr(.6, .9) * wk; }
      break;
    case 'lashWind':
      e.t -= dt; if (e.t > .22) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = laneTele(e, o); }
      if (e.t <= 0) { e.tele = null; const c = Math.cos(e.aim), s = Math.sin(e.aim);
        for (const pl of G.players) { const rx = pl.x - e.x, ry = pl.y - e.y, along = rx * c + ry * s, side = Math.abs(-rx * s + ry * c);
          if (along > 0 && along < o.L && side < o.W + pl.r - DG && hurtPlayer(pl, dmgOf(e, o), e.x, e.y)) hitSpark(pl.x, pl.y - 8, true, e.aim); }
        for (let k = 12; k < o.L; k += 10) G.parts.push({ x: e.x + c * k + rr(-3, 3), y: e.y - 8 + s * k + rr(-3, 3), vx: c * 40, vy: s * 40, life: .3, max: .3, col: pick(B.cols), s: 2 });
        if (o.trail) for (let k = 24; k < o.L; k += 26) addPool(e, e.x + c * k, e.y + s * k, 14, 2.5, Math.round(base(e) * .3), o.trail);
        sfx.swing(); shake(3, .12); e.state = 'idle'; e.t = rr(.6, .9) * wk; }
      break;
    case 'fanWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; for (const a of e.shots) shoot(e, a, o.spd, dmgOf(e, o));
        G.fx.push({ k: 'warp', x: e.x, y: e.y - 12, r0: 8, r1: 30, th: 3, t: 0, d: .25, col: B.cols[1] }); sfx.fire(); e.state = 'idle'; e.t = rr(.6, .9) * wk; }
      break;
    case 'novaWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; for (const a of e.shots) shoot(e, a, o.spd, dmgOf(e, o));
        for (const dl of [0, .1]) G.fx.push({ k: 'warp', x: e.x, y: e.y - 8, r0: 6, r1: 50, th: 4, delay: dl, t: 0, d: .35 + dl, col: B.cols[1] }); sfx.skill(); e.state = 'idle'; e.t = rr(.7, 1) * wk; }
      break;
    case 'castWind':
      e.t -= dt; if (e.t <= 0) { e.state = 'idle'; e.t = rr(.5, .8) * wk; }
      break;
    case 'poolWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; for (const q of e.cpts) addPool(e, q.x, q.y, o.r, o.t + (p2 ? 1 : 0), Math.round(base(e) * o.k), o.cols || B.cols); sfx.skill(); e.state = 'idle'; e.t = rr(.6, .9) * wk; }
      break;
    case 'summonWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; summon(e, pick(D.adds), o.n || 2, o.max || 3, 1); sfx.howl(); e.state = 'idle'; e.t = .8; }
      break;
  }
  void fan; void clamp;
};
