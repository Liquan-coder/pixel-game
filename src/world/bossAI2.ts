/* ---- 第二批區域 Boss 的 AI：蘑菇王（森林）、雪原巨人（雪原）、沼澤巫妖（沼澤） ----
   共通的小工具：pools = 地上會持續扣血的一灘（孢子雲、毒沼），pend = 倒數後落下的攻擊（冰錐） */
import { G } from '../core/state';
import { TAU, angDiff, clamp, pick, rr } from '../core/util';
import { HK, ctx } from '../core/canvas';
import { DG } from '../data/items';
import { AI } from './bossAI';
import { keepIn, rbWind } from './regionBoss';
import { collides, stepToward } from '../game/collision';
import { sfx } from '../core/audio';
import { makeEnemy } from '../game/enemies';
import { hurtPlayer } from '../game/combat';
import { hitSpark, quakeFx, shake } from '../game/worldUpdate';
import type { Enemy } from '../types';

const ICEC = ['#2a4a78', '#a8dcff', '#ffffff'];
function tickPools(e: Enemy, dt) {                                     // 站在一灘裡面會一直扣血（受傷後的無敵時間決定扣血頻率）
  e.pools = (e.pools || []).filter(p => (p.t -= dt) > 0);
  for (const p of e.pools) { for (const pl of G.players) if (Math.hypot(pl.x - p.x, (pl.y - p.y) * 1.4) < p.r - DG && hurtPlayer(pl, p.dmg, p.x, p.y)) hitSpark(pl.x, pl.y - 8, false, -Math.PI / 2);
    if (Math.random() < .25) G.parts.push({ x: p.x + rr(-p.r, p.r) * .8, y: p.y + rr(-p.r, p.r) * .5, vx: rr(-4, 4), vy: -rr(8, 22), life: .7, max: .7, col: pick(p.cols), s: Math.random() < .4 ? 2 : 1, drag: 1 }); }
}
export function drawPools(e: Enemy) {                                  // 畫：半透明的一灘 + 外圈
  for (const p of e.pools || []) { const k = Math.min(1, p.t / .5, (p.T - p.t) / .3);
    ctx.globalAlpha = .38 * k; ctx.fillStyle = p.cols[0]; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * .7, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = .7 * k; ctx.strokeStyle = p.cols[1]; ctx.lineWidth = HK * 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r - HK, p.r * .7 - HK, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
}
function addPool(e, x, y, r, t, dmg, cols) { e.pools = e.pools || []; e.pools.push({ x, y, r, t, T: t, dmg, cols }); }
function summon(e, kind, n, max, lvOff = 2) {
  const D = e.def, room = Math.min(n, max - G.enemies.filter(x => x.rbAdd === D.id).length);
  for (let i = 0; i < room; i++) { const a = rr(0, TAU), x = e.x + Math.cos(a) * 40, y = e.y + Math.sin(a) * 30; if (collides(x, y, 7)) continue;
    const w = makeEnemy(kind, Math.max(1, e.lv - lvOff), x, y, null); w.state = 'chase'; w.rbAdd = D.id; G.enemies.push(w);
    G.fx.push({ k: 'warp', x, y, r0: 2, r1: 16, th: 3, t: 0, d: .4, col: D.ring[0] }); }
}
function landHit(e, r, dmg) {                                          // 落地的範圍傷害
  for (const pl of G.players) if (Math.hypot(pl.x - e.x, pl.y - e.y) < r - DG && hurtPlayer(pl, dmg, e.x, e.y)) hitSpark(pl.x, pl.y - 8, true, Math.atan2(pl.y - e.y, pl.x - e.x));
  for (const dl of [0, .08]) G.fx.push({ k: 'warp', x: e.x, y: e.y, r0: 6, r1: r + 10, th: 6, delay: dl, t: 0, d: .4 + dl, col: e.def.aura[0] });
  quakeFx(e.x, e.y, r); sfx.boom(); shake(6, .3); G.hitStop = Math.max(G.hitStop, .07);
}
function jumpStates(e, dt, R, dmg, airT, then?) {                       // 跳起來砸人（女王的跳躍，參數化）
  if (e.state === 'jumpWind') { e.t -= dt; if (e.t > .2) { const o = { x: e.tgt.x, y: e.tgt.y }; keepIn(o, e.def, 20); e.tx = o.x; e.ty = o.y; }
    e.tele = [{ k: 'circle', x: e.tx, y: e.ty, r: R, q: clamp(1 - e.t / e.wt, 0, 1) * .5 }];
    if (e.t <= 0) { e.state = 'jump'; e.t = e.lt = airT; e.sx = e.x; e.sy = e.y; sfx.dodge(); } return true; }
  if (e.state === 'jump') { e.t -= dt; const u = Math.min(1, 1 - e.t / e.lt);
    e.x = e.sx + (e.tx - e.sx) * u; e.y = e.sy + (e.ty - e.sy) * u; e.z = Math.sin(Math.PI * u) * 70; e.tele = [{ k: 'circle', x: e.tx, y: e.ty, r: R, q: .5 + .5 * u }];
    if (e.t <= 0) { e.z = 0; e.tele = null; landHit(e, R, dmg); e.state = 'idle'; e.t = .9; if (then) then(); } return true; }
  return false;
}
function fan(e, n, spread, speed, dmg, kind, extra = {}) {             // 往目標方向射出一排子彈
  for (let i = 0; i < n; i++) { const a = n === 1 ? e.aim : e.aim - spread / 2 + spread * i / (n - 1);
    G.projs.push({ x: e.x + Math.cos(a) * 16, y: e.y - 12 + Math.sin(a) * 12, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 5, life: 1.6, dmg, owner: 'e', kind, ...extra }); }
}

/* 蘑菇王・孢冠：跳壓、孢子彈、孢子雲（站在裡面會中毒）；二階段叫小毒菇、孢子雲變多 */
AI.mushking = (e, dt, d, dx, dy) => {
  const p2 = e.phase === 2, D = e.def, SP = ['#5a1a6a', '#c46ad8', '#f0c8ff'];
  tickPools(e, dt);
  if (jumpStates(e, dt, 42, 22, .7, () => { if (p2) addPool(e, e.x, e.y, 30, 3, 6, SP); })) return;
  switch (e.state) {
    case 'idle':
      e.t -= dt; e.flip = dx < 0;
      if (d > 34) { e.hop = (e.hop || 0) + dt; if (Math.sin(e.hop * 5) > 0) stepToward(e, e.tgt.x, e.tgt.y, p2 ? 44 : 34, dt); }
      if (e.t <= 0) { const r = Math.random(); e.aim = Math.atan2(dy, dx);
        if (p2 && e.splitT <= 0) { rbWind(e, 'summonWind', .7, [{ k: 'circle', r: 30 }]); e.splitT = 13; }
        else if (r < .33) { rbWind(e, 'jumpWind', p2 ? .55 : .7); e.tx = e.tgt.x; e.ty = e.tgt.y; }
        else if (r < .66) { const n = p2 ? 9 : 6; e.shots = []; for (let i = 0; i < n; i++) e.shots.push(e.aim + i / n * TAU);
          rbWind(e, 'sporeWind', .6, e.shots.map(a => ({ k: 'lane', a, L: 100, W: 12 }))); }
        else { const pts = [{ x: e.tgt.x, y: e.tgt.y }]; for (let i = 0; i < (p2 ? 4 : 2); i++) { const o = { x: e.tgt.x + rr(-60, 60), y: e.tgt.y + rr(-45, 45) }; keepIn(o, D, 26); pts.push(o); }
          e.cpts = pts; rbWind(e, 'cloudWind', .8, pts.map(o => ({ k: 'circle', x: o.x, y: o.y, r: 26 }))); } }
      break;
    case 'sporeWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null;
        for (const a of e.shots) G.projs.push({ x: e.x + Math.cos(a) * 18, y: e.y - 14 + Math.sin(a) * 12, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 4, life: 1.6, dmg: 12, owner: 'e', kind: 'spore' });
        G.fx.push({ k: 'warp', x: e.x, y: e.y - 14, r0: 10, r1: 34, th: 3, t: 0, d: .25, col: '#c46ad8' }); sfx.fire(); e.state = 'idle'; e.t = rr(.7, 1) * (p2 ? .8 : 1); }
      break;
    case 'cloudWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; for (const o of e.cpts) addPool(e, o.x, o.y, 26, p2 ? 4 : 3, 7, SP); sfx.skill(); e.state = 'idle'; e.t = rr(.6, .9); }
      break;
    case 'summonWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; summon(e, 'shroom', 2, 3); sfx.howl(); e.state = 'idle'; e.t = .8; }
      break;
  }
};

/* 雪原巨人・霜鬃：重拳（扇形）、跳躍砸地、冰錐扇射；二階段落地噴一圈冰錐、天降冰錐雨 */
AI.yeti = (e, dt, d, dx, dy) => {
  const p2 = e.phase === 2, D = e.def;
  e.pend = (e.pend || []).filter(m => { m.t -= dt; if (m.t > 0) return true;               // 冰錐落下
    for (const pl of G.players) if (Math.hypot(pl.x - m.x, pl.y - m.y) < 20 - DG && hurtPlayer(pl, 34, m.x, m.y)) hitSpark(pl.x, pl.y - 8, true, -Math.PI / 2);
    G.fx.push({ k: 'spike', x: m.x, y: m.y, r: 18, t: 0, d: .6 }); quakeFx(m.x, m.y, 20);
    for (let i = 0; i < 8; i++) G.parts.push({ x: m.x + rr(-8, 8), y: m.y, vx: rr(-40, 40), vy: -rr(40, 110), life: .6, max: .6, col: pick(ICEC), s: 2, g: 300 });
    shake(2, .1); sfx.boom(); return false; });
  if (jumpStates(e, dt, 50, 40, .8, () => { if (p2) { e.aim = 0; fan(e, 10, TAU * .9, 170, 26, 'claw', { R: 13, th: 5, cols: ICEC }); } })) return;
  switch (e.state) {
    case 'idle':
      e.t -= dt; e.flip = dx < 0;
      if (d > 44) stepToward(e, e.tgt.x, e.tgt.y, p2 ? 54 : 42, dt);
      if (e.t <= 0) { const r = Math.random(); e.aim = Math.atan2(dy, dx);
        if (p2 && e.splitT <= 0) { const pts = []; for (let i = 0; i < 9; i++) { const o = { x: e.tgt.x + rr(-90, 90), y: e.tgt.y + rr(-70, 70) }; keepIn(o, D, 20); pts.push(o); }
          e.ipts = pts; rbWind(e, 'rainWind', .6); e.splitT = 11; }
        else if (d < 64 && r < .45) rbWind(e, 'punchWind', p2 ? .45 : .58, [{ k: 'sector', r: 64, a: e.aim, half: 1 }]);
        else if (r < .7) { rbWind(e, 'jumpWind', p2 ? .6 : .75); e.tx = e.tgt.x; e.ty = e.tgt.y; }
        else rbWind(e, 'shardWind', .55, [-1, -.5, 0, .5, 1].map(k => ({ k: 'lane', a: e.aim + k * .3, L: 140, W: 14 }))); }
      break;
    case 'punchWind':
      e.t -= dt; if (e.t > .22) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = [{ k: 'sector', r: 64, a: e.aim, half: 1 }]; }
      if (e.t <= 0) { e.tele = null;
        if (d < 64 - DG && angDiff(Math.atan2(dy, dx), e.aim) < 1 - DG / Math.max(d, 20) && hurtPlayer(e.tgt, 42, e.x, e.y)) { hitSpark(e.tgt.x, e.tgt.y - 8, true, e.aim); G.hitStop = Math.max(G.hitStop, .08); }
        G.fx.push({ k: 'smear', x: e.x, y: e.y - 14, a0: e.aim - 1.2, a1: e.aim + 1.2, r: 58, w: 16, sw: .1, hold: .16, delay: 0, t: 0, d: .28, cols: ICEC, sy: .8 });
        quakeFx(e.x + Math.cos(e.aim) * 36, e.y + Math.sin(e.aim) * 36, 28); sfx.boom(); shake(5, .2); e.state = 'idle'; e.t = rr(.6, .9) * (p2 ? .8 : 1); }
      break;
    case 'shardWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; fan(e, 5, .6 * 2, 210, 28, 'claw', { R: 14, th: 6, cols: ICEC }); sfx.release(2); shake(3, .15);
        if (p2 && !e.again) { e.again = true; e.aim += .15; rbWind(e, 'shardWind', .3, [-1, -.5, 0, .5, 1].map(k => ({ k: 'lane', a: e.aim + k * .3, L: 140, W: 14 }))); }
        else { e.again = false; e.state = 'idle'; e.t = rr(.8, 1.1); } }
      break;
    case 'rainWind':
      e.t -= dt; if (e.t <= 0) { for (const o of e.ipts) e.pend.push({ x: o.x, y: o.y, t: rr(.8, 1.5), T: 1.5 }); sfx.howl(); e.state = 'idle'; e.t = rr(.7, 1); }
      break;
  }
};

/* 沼澤巫妖・腐沼：飄來飄去會瞬移、毒彈、在你腳下開毒沼；二階段叫沼澤骷髏、一圈毒彈 */
AI.lich = (e, dt, d, dx, dy) => {
  const p2 = e.phase === 2, D = e.def, PC = ['#1a4a10', '#6ae04a', '#d0ffb0'];
  tickPools(e, dt);
  e.z = 4 + Math.sin(e.anim * 2.5) * 3; keepIn(e, D, e.r);             // 一直飄著（離地不到 8 才打得到）；飄著時外面不會幫忙關在結界裡，這裡自己關
  switch (e.state) {
    case 'idle':
      e.t -= dt; e.flip = dx < 0;
      if (d < 50) stepToward(e, e.x - dx, e.y - dy, 30, dt); else if (d > 110) stepToward(e, e.tgt.x, e.tgt.y, 30, dt);   // 保持距離
      if (e.t <= 0) { const r = Math.random(); e.aim = Math.atan2(dy, dx);
        if (p2 && e.splitT <= 0) { rbWind(e, 'summonWind', .8, [{ k: 'circle', r: 30 }]); e.splitT = 14; }
        else if (r < .22 || d < 40) { e.state = 'blinkOut'; e.t = .35; G.fx.push({ k: 'warp', x: e.x, y: e.y - 8, r0: 24, r1: 2, th: 4, t: 0, d: .35, col: '#6ae04a' }); sfx.blink(); }
        else if (r < .55) { e.vol = p2 ? 2 : 1; rbWind(e, 'boltWind', .5, [-1, 0, 1].map(k => ({ k: 'lane', a: e.aim + k * .28, L: 150, W: 12 }))); }
        else if (r < .85) { const pts = [{ x: e.tgt.x, y: e.tgt.y }]; for (let i = 0; i < (p2 ? 3 : 1); i++) { const o = { x: e.tgt.x + rr(-55, 55), y: e.tgt.y + rr(-40, 40) }; keepIn(o, D, 26); pts.push(o); }
          e.cpts = pts; rbWind(e, 'swampWind', .75, pts.map(o => ({ k: 'circle', x: o.x, y: o.y, r: 28 }))); }
        else { const n = p2 ? 16 : 10; e.shots = []; for (let i = 0; i < n; i++) e.shots.push(i / n * TAU + rr(0, .3));
          rbWind(e, 'ringWind', .7, e.shots.map(a => ({ k: 'lane', a, L: 110, W: 10 }))); } }
      break;
    case 'blinkOut':                                                   // 消失 → 出現在玩家附近的另一邊
      e.t -= dt; if (e.t <= 0) { const a = rr(0, TAU), o = { x: e.tgt.x + Math.cos(a) * 80, y: e.tgt.y + Math.sin(a) * 60 }; keepIn(o, D, 24);
        if (!collides(o.x, o.y, e.r)) { e.x = o.x; e.y = o.y; }
        G.fx.push({ k: 'warp', x: e.x, y: e.y - 8, r0: 2, r1: 26, th: 4, t: 0, d: .35, col: '#9aff6a' }); e.state = 'idle'; e.t = .5; }
      break;
    case 'boltWind':
      e.t -= dt; if (e.t > .15) { e.aim = Math.atan2(dy, dx); e.tele = [-1, 0, 1].map(k => ({ k: 'lane', a: e.aim + k * .28, L: 150, W: 12 })); }
      if (e.t <= 0) { e.tele = null; fan(e, 3, .56, 190, 30, 'glob'); sfx.fire();
        if (--e.vol > 0) rbWind(e, 'boltWind', .35); else { e.state = 'idle'; e.t = rr(.6, .9); } }
      break;
    case 'swampWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; for (const o of e.cpts) addPool(e, o.x, o.y, 28, p2 ? 5 : 4, 12, PC); sfx.skill(); shake(2, .1); e.state = 'idle'; e.t = rr(.6, .9); }
      break;
    case 'ringWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null;
        for (const a of e.shots) G.projs.push({ x: e.x + Math.cos(a) * 14, y: e.y - 14 + Math.sin(a) * 10, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 5, life: 1.5, dmg: 26, owner: 'e', kind: 'glob' });
        sfx.release(2); shake(3, .15); e.state = 'idle'; e.t = rr(.8, 1.1); }
      break;
    case 'summonWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; summon(e, 'skelS', 2, 3, 3); sfx.howl(); e.state = 'idle'; e.t = .8; }
      break;
  }
};
