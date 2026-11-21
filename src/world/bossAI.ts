import { G } from '../core/state';
import { TAU, angDiff, clamp, pick, rr } from '../core/util';
import { DG } from '../data/items';
import { keepIn, rbWind } from './regionBoss';
import { collides, moveEnt, stepToward } from '../game/collision';
import { sfx } from '../core/audio';
import { makeEnemy } from '../game/enemies';
import { hurtPlayer } from '../game/combat';
import { hitSpark, quakeFx, shake } from '../game/worldUpdate';
import type { Enemy } from '../types';

// 每種區域 Boss 的 AI：每幀呼叫一次。d/dx/dy = 到目標玩家的距離
export const AI: Record<string, (e: Enemy, dt: number, d: number, dx: number, dy: number) => void> = {};
AI.queen = (e, dt, d, dx, dy) => {                                    // 史萊姆女王：跳壓、酸液噴吐、翻滾衝撞；二階段會分裂
  const p2 = e.phase === 2, D = e.def;
  switch (e.state) {
    case 'idle':
      e.t -= dt; e.flip = dx < 0;
      if (d > 30) { e.hop = (e.hop || 0) + dt; if (Math.sin(e.hop * 6) > 0) stepToward(e, e.tgt.x, e.tgt.y, p2 ? 48 : 36, dt); }
      if (e.t <= 0) { const r = Math.random();
        if (p2 && e.splitT <= 0) { rbWind(e, 'splitWind', .7, [{ k:'circle', r:36 }]); e.splitT = 12; }
        else if (r < .36) { rbWind(e, 'jumpWind', p2 ? .55 : .7); e.tx = e.tgt.x; e.ty = e.tgt.y; }
        else if (r < .72) { e.aim = Math.atan2(dy, dx); const n = p2 ? 10 : 5, sp = 1.3; e.shots = [];
          for (let i = 0; i < n; i++) e.shots.push(p2 ? e.aim + i / n * TAU : e.aim - sp / 2 + sp * i / (n - 1));
          e.volley = p2 ? 1 : 0; rbWind(e, 'sprayWind', .55, e.shots.map(a => ({ k:'lane', a, L:110, W:14 }))); }
        else { e.aim = Math.atan2(dy, dx); rbWind(e, 'rollWind', .5, [{ k:'lane', a:e.aim, L:140, W:36 }]); } }
      break;
    case 'jumpWind':
      e.t -= dt; if (e.t > .2) { const o = { x:e.tgt.x, y:e.tgt.y }; keepIn(o, D, 20); e.tx = o.x; e.ty = o.y; }
      e.tele = [{ k:'circle', x:e.tx, y:e.ty, r:40, q:clamp(1 - e.t / e.wt, 0, 1) * .5 }];
      if (Math.random() < .5) G.parts.push({ x:e.x + rr(-14, 14), y:e.y, vx:rr(-20, 20), vy:-rr(10, 30), life:.3, max:.3, col:'#4fbf5a', s:1, g:80 });
      if (e.t <= 0) { e.state = 'jump'; e.t = e.lt = .7; e.sx = e.x; e.sy = e.y; sfx.dodge(); }
      break;
    case 'jump': {
      e.t -= dt; const u = Math.min(1, 1 - e.t / e.lt);
      e.x = e.sx + (e.tx - e.sx) * u; e.y = e.sy + (e.ty - e.sy) * u; e.z = Math.sin(Math.PI * u) * 70;
      e.tele = [{ k:'circle', x:e.tx, y:e.ty, r:40, q:.5 + .5 * u }];
      if (e.t <= 0) {
        e.z = 0; e.tele = null;
        if (Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 40 - DG && hurtPlayer(e.tgt, 22, e.x, e.y, { stun: .45 })) hitSpark(e.tgt.x, e.tgt.y - 8, true, Math.atan2(e.tgt.y - e.y, e.tgt.x - e.x));
        for (const dl of [0, .08]) G.fx.push({ k:'warp', x:e.x, y:e.y, r0:6, r1:52, th:6, delay:dl, t:0, d:.4 + dl, col:'#4fbf5a' });
        for (let i = 0; i < 22; i++) { const a = rr(0, TAU), sp = rr(60, 150); G.parts.push({ x:e.x, y:e.y - 4, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp * .6 - 40, life:rr(.4, .7), max:.7, col:pick(['#4fbf5a', '#7fe07a', '#c8ffc0']), s:2, g:240 }); }
        sfx.boom(); shake(6, .3); G.hitStop = Math.max(G.hitStop, .07); e.state = 'idle'; e.t = .9;
      }
      break; }
    case 'sprayWind':
      e.t -= dt;
      if (e.t <= 0) {
        for (const a of e.shots) G.projs.push({ x:e.x + Math.cos(a) * 18, y:e.y - 10 + Math.sin(a) * 12, vx:Math.cos(a) * 150, vy:Math.sin(a) * 150, r:5, life:1.4, dmg:12, owner:'e', kind:'glob' });
        G.fx.push({ k:'warp', x:e.x, y:e.y - 8, r0:10, r1:30, th:3, t:0, d:.25, col:'#7fe07a' }); sfx.fire(); shake(2, .1);
        if (e.volley > 0) { e.volley--; e.shots = e.shots.map(a => a + Math.PI / e.shots.length); rbWind(e, 'sprayWind', .35, e.shots.map(a => ({ k:'lane', a, L:110, W:14 }))); }
        else { e.state = 'idle'; e.tele = null; e.t = rr(.7, 1.1) * (p2 ? .75 : 1); }
      }
      break;
    case 'rollWind':
      e.t -= dt; if (e.t > .2) { e.aim = Math.atan2(dy, dx); e.tele = [{ k:'lane', a:e.aim, L:140, W:36 }]; }
      if (e.t <= 0) { e.state = 'roll'; e.tele = null; e.t = .5; e.lvx = Math.cos(e.aim) * 280; e.lvy = Math.sin(e.aim) * 280; e.hitDone = false; sfx.dodge(); }
      break;
    case 'roll':
      e.t -= dt; if (moveEnt(e, e.lvx * dt, e.lvy * dt)) e.t = Math.min(e.t, .05);
      if (Math.random() < .8) G.parts.push({ x:e.x + rr(-12, 12), y:e.y + rr(-2, 2), vx:rr(-10, 10), vy:-rr(0, 15), life:.5, max:.5, col:pick(['#2f8f45', '#4fbf5a']), s:2 });
      if (!e.hitDone && Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 18 - DG) { e.hitDone = true; if (hurtPlayer(e.tgt, 18, e.x, e.y)) hitSpark(e.tgt.x, e.tgt.y - 8, true, e.aim); }
      if (e.t <= 0) { e.state = 'idle'; e.t = .8; }
      break;
    case 'splitWind':
      e.t -= dt;
      if (e.t <= 0) { e.tele = null;
        const room = Math.min(3, 4 - G.enemies.filter(x => x.rbAdd === D.id).length);           // 場上最多 4 隻小史萊姆
        for (let i = 0; i < room; i++) { const a = i / 3 * TAU + rr(-.3, .3), x = e.x + Math.cos(a) * 30, y = e.y + Math.sin(a) * 22;
          if (collides(x, y, 6)) continue; const w = makeEnemy('slime', Math.max(1, e.lv - 5), x, y, null); w.state = 'chase'; w.rbAdd = D.id; G.enemies.push(w);
          G.fx.push({ k:'warp', x, y, r0:2, r1:14, th:2, t:0, d:.35, col:'#7fe07a' }); }
        for (let i = 0; i < 14; i++) { const a = rr(0, TAU), sp = rr(40, 110); G.parts.push({ x:e.x, y:e.y - 10, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 30, life:.5, max:.5, col:'#7fe07a', s:2, g:200 }); }
        sfx.skill(); e.state = 'idle'; e.t = .8; }
      break;
  }
};
export const BONEC = ['#5e584c', '#e2dcc8', '#fffaf0'];
function spikeAt(x, y, r, dmg) {                                       // 骨刺從地面竄出
  G.fx.push({ k:'spike', x, y, r, t:0, d:.6 });
  for (const pl of G.players) if (Math.hypot(pl.x - x, pl.y - y) < r - DG && hurtPlayer(pl, dmg, x, y)) hitSpark(pl.x, pl.y - 8, true, -Math.PI / 2);   // 踩到的人都會被刺
  for (let i = 0; i < 6; i++) G.parts.push({ x:x + rr(-r, r) * .7, y:y + rr(-3, 3), vx:rr(-30, 30), vy:-rr(40, 90), life:.5, max:.5, col:pick(['#8a7a64', '#c8b496', '#e2dcc8']), s:1, g:300 });
}
AI.general = (e, dt, d, dx, dy) => {                                  // 骸骨將軍：重劈、突進三連斬、骨刺陣；二階段加劍氣橫掃、召喚骷髏
  const p2 = e.phase === 2, D = e.def;
  switch (e.state) {
    case 'idle':
      e.t -= dt; e.flip = dx < 0;
      if (d > 40) stepToward(e, e.tgt.x, e.tgt.y, p2 ? 58 : 44, dt);
      if (e.t <= 0) { const r = Math.random(); e.aim = Math.atan2(dy, dx);
        if (p2 && e.splitT <= 0) { rbWind(e, 'summonWind', .75, [{ k:'circle', r:30 }]); e.splitT = 14; }
        else if (p2 && r < .25) rbWind(e, 'waveWind', .65, [0, 1, 2, 3, 4, 5].map(i => ({ k:'lane', a:e.aim + i / 6 * TAU, L:130, W:18 })));
        else if (d < 62 && r < .6) rbWind(e, 'cleaveWind', p2 ? .5 : .62, [{ k:'sector', r:62, a:e.aim, half:1.15 }]);
        else if (r < .78) { e.combo = 3; rbWind(e, 'dashWind', .5, [{ k:'lane', a:e.aim, L:160, W:36 }]); }
        else { const pts = [{ x:e.tgt.x, y:e.tgt.y }]; for (let i = 0; i < (p2 ? 6 : 4); i++) { const o = { x:e.tgt.x + rr(-70, 70), y:e.tgt.y + rr(-55, 55) }; keepIn(o, D, 20); pts.push(o); }
          e.spikes = pts; rbWind(e, 'spikeWind', .8, pts.map(o => ({ k:'circle', x:o.x, y:o.y, r:18 }))); } }
      break;
    case 'cleaveWind':
      e.t -= dt; if (e.t > .25) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = [{ k:'sector', r:62, a:e.aim, half:1.15 }]; }
      if (e.t <= 0) { e.tele = null;
        if (d < 62 - DG && angDiff(Math.atan2(dy, dx), e.aim) < 1.15 - DG / Math.max(d, 20) && hurtPlayer(e.tgt, 30, e.x, e.y)) { hitSpark(e.tgt.x, e.tgt.y - 8, true, e.aim); G.hitStop = Math.max(G.hitStop, .07); }
        G.fx.push({ k:'smear', x:e.x, y:e.y - 10, a0:e.aim - 1.4, a1:e.aim + 1.3, r:58, w:14, sw:.1, hold:.18, delay:0, t:0, d:.28, cols:['#7a4a1a', '#ffb040', '#fff6d0'], sy:.8 });
        quakeFx(e.x + Math.cos(e.aim) * 34, e.y + Math.sin(e.aim) * 34, 26); sfx.boom(); shake(5, .2); e.state = 'idle'; e.t = rr(.7, 1) * (p2 ? .75 : 1); }
      break;
    case 'dashWind':
      e.t -= dt; if (e.t > .18) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = [{ k:'lane', a:e.aim, L:160, W:36 }]; }
      if (e.t <= 0) { e.tele = null; e.state = 'dash'; e.t = .24; e.lvx = Math.cos(e.aim) * 640; e.lvy = Math.sin(e.aim) * 640; e.hitDone = false; sfx.dodge();
        G.fx.push({ k:'smear', x:e.x, y:e.y - 10, a0:e.aim + 1.2, a1:e.aim - 1.2, r:34, w:10, sw:.08, hold:.12, delay:0, t:0, d:.2, cols:['#7a4a1a', '#ffb040', '#fff6d0'], sy:.8 }); }
      break;
    case 'dash':
      e.t -= dt; if (moveEnt(e, e.lvx * dt, e.lvy * dt)) e.t = Math.min(e.t, .03); keepIn(e, D, e.r);
      e.gt = !e.gt; if (e.gt) G.fx.push({ k:'rghost', kind:e.kind, x:e.x, y:e.y, flip:e.flip, t:0, d:.25 });
      if (!e.hitDone && Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 18 - DG) { e.hitDone = true; if (hurtPlayer(e.tgt, 20, e.x, e.y)) hitSpark(e.tgt.x, e.tgt.y - 8, true, e.aim); }
      if (e.t <= 0) { if (--e.combo > 0) { e.aim = Math.atan2(e.tgt.y - e.y, e.tgt.x - e.x); rbWind(e, 'dashWind', p2 ? .3 : .38, [{ k:'lane', a:e.aim, L:160, W:36 }]); } else { e.state = 'idle'; e.t = 1; } }
      break;
    case 'spikeWind':
      e.t -= dt;
      if (e.t <= 0) { e.tele = null; for (const o of e.spikes) spikeAt(o.x, o.y, 18, 20); sfx.boom(); shake(4, .2); e.state = 'idle'; e.t = rr(.6, .9); }
      break;
    case 'waveWind':
      e.t -= dt;
      if (e.t <= 0) { e.tele = null;
        G.fx.push({ k:'smear', x:e.x, y:e.y - 10, a0:e.aim, a1:e.aim + TAU * .97, r:44, w:12, sw:.16, hold:.14, delay:0, t:0, d:.3, cols:['#7a4a1a', '#ffb040', '#fff6d0'], sy:.8 });
        for (let i = 0; i < 6; i++) { const a = e.aim + i / 6 * TAU; G.projs.push({ x:e.x + Math.cos(a) * 18, y:e.y - 10 + Math.sin(a) * 14, vx:Math.cos(a) * 210, vy:Math.sin(a) * 210, r:7, life:1.1, dmg:18, owner:'e', kind:'claw', R:15, th:6, cols:BONEC }); }
        sfx.release(2); shake(4, .2); e.state = 'idle'; e.t = rr(.8, 1.1); }
      break;
    case 'summonWind':
      e.t -= dt;
      if (e.t <= 0) { e.tele = null; const room = Math.min(2, 3 - G.enemies.filter(x => x.rbAdd === D.id).length);
        for (let i = 0; i < room; i++) { const a = rr(0, TAU), x = e.x + Math.cos(a) * 44, y = e.y + Math.sin(a) * 32; if (collides(x, y, 7)) continue;
          const w = makeEnemy('skel', e.lv - 5, x, y, null); w.state = 'chase'; w.rbAdd = D.id; G.enemies.push(w);
          G.fx.push({ k:'warp', x, y, r0:16, r1:3, th:4, t:0, d:.35, col:'#3a2a1a' }); G.fx.push({ k:'warp', x, y, r0:2, r1:14, th:2, delay:.2, t:0, d:.5, col:'#ffb040' }); spikeAt(x, y, 10, 0); }
        sfx.howl(); e.state = 'idle'; e.t = .8; }
      break;
  }
};
export const FIREC = ['#7a1a08', '#f07a32', '#ffe38a'];
AI.dragon = (e, dt, d, dx, dy) => {                                   // 熔岩巨龍：吐息、隕石雨、尾掃、衝刺留火；二階段飛天俯衝、掃射吐息
  const p2 = e.phase === 2, D = e.def;
  e.burns = (e.burns || []).filter(b => (b.t -= dt) > 0);              // 地上燃燒的火：站在上面會被燒
  for (const b of e.burns) for (const pl of G.players) if (Math.hypot(pl.x - b.x, pl.y - b.y) < 7 && hurtPlayer(pl, 8, b.x, b.y)) hitSpark(pl.x, pl.y - 8, false, -Math.PI / 2);
  e.pend = (e.pend || []).filter(m => {                                // 隕石：倒數到 0 就砸下來
    m.t -= dt; if (m.t > 0) { if (m.t < .45 && !m.fall) { m.fall = true; G.fx.push({ k:'meteor', x:m.x, y:m.y, t:0, d:.45 }); } return true; }
    for (const pl of G.players) if (Math.hypot(pl.x - m.x, pl.y - m.y) < 22 - DG && hurtPlayer(pl, 24, m.x, m.y)) hitSpark(pl.x, pl.y - 8, true, -Math.PI / 2);
    quakeFx(m.x, m.y, 26); G.fx.push({ k:'warp', x:m.x, y:m.y, r0:4, r1:26, th:4, t:0, d:.3, col:'#ffb040' }); shake(3, .12); sfx.boom(); return false; });
  switch (e.state) {
    case 'idle':
      e.t -= dt; e.flip = dx < 0;
      if (d > 56) stepToward(e, e.tgt.x, e.tgt.y, p2 ? 46 : 36, dt);
      if (e.t <= 0) { const r = Math.random(); e.aim = Math.atan2(dy, dx);
        if (p2 && e.splitT <= 0) { e.state = 'flyUp'; e.t = .5; e.splitT = 13; sfx.howl(); }
        else if (d < 50 && r < .45) rbWind(e, 'tailWind', .55, [{ k:'circle', r:50 }]);
        else if (r < .4) rbWind(e, 'breathWind', .7, [{ k:'sector', r:96, a:e.aim, half:p2 ? 1.25 : .55 }]);
        else if (r < .7) { const pts = [{ x:e.tgt.x, y:e.tgt.y }]; for (let i = 0; i < (p2 ? 7 : 4); i++) { const o = { x:e.tgt.x + rr(-80, 80), y:e.tgt.y + rr(-60, 60) }; keepIn(o, D, 24); pts.push(o); }
          e.mpts = pts; rbWind(e, 'meteorWind', .45); }
        else rbWind(e, 'chargeWind', .6, [{ k:'lane', a:e.aim, L:170, W:36 }]); }
      break;
    case 'tailWind':
      e.t -= dt;
      if (e.t <= 0) { e.tele = null; if (d < 50 - DG && hurtPlayer(e.tgt, 26, e.x, e.y, { stun: .45 })) hitSpark(e.tgt.x, e.tgt.y - 8, true, Math.atan2(dy, dx));
        G.fx.push({ k:'smear', x:e.x, y:e.y - 8, a0:e.aim + Math.PI, a1:e.aim + Math.PI + TAU * .95, r:48, w:12, sw:.16, hold:.14, delay:0, t:0, d:.3, cols:FIREC, sy:.75 });
        sfx.swing(); shake(4, .2); e.state = 'idle'; e.t = rr(.6, .9); }
      break;
    case 'breathWind':
      e.t -= dt; if (e.t > .25) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = [{ k:'sector', r:96, a:e.aim, half:p2 ? 1.25 : .55 }]; }
      if (e.t <= 0) { e.tele = null; e.state = 'breath'; e.t = e.bt = 1.1; e.a0 = p2 ? e.aim - 1.1 : e.aim; e.a1 = p2 ? e.aim + 1.1 : e.aim; sfx.release(2); }
      break;
    case 'breath': {                                                   // 吐息：一道火焰往前噴（二階段會左右掃）
      e.t -= dt; const u = 1 - e.t / e.bt, a = e.a0 + (e.a1 - e.a0) * u, mx = e.x + Math.cos(a) * 18, my = e.y - 14 + Math.sin(a) * 12;
      for (let i = 0; i < 14; i++) { const b = a + rr(-.34, .34), sp = rr(150, 270); G.parts.push({ x:mx + rr(-3, 3), y:my + rr(-3, 3), vx:Math.cos(b) * sp, vy:Math.sin(b) * sp, life:rr(.32, .5), max:.5, col:pick(['#c8401e', '#ff6a2a', '#ffb040', '#ffe38a', '#fff6d0']), s:i % 3 ? 2 : 3, drag:1.2 }); }
      e.glow = [mx, my, a];
      if (angDiff(Math.atan2(dy, dx + .001), a) < .34 && d < 96 - DG && hurtPlayer(e.tgt, 12, e.x, e.y)) hitSpark(e.tgt.x, e.tgt.y - 8, false, a);
      shake(1, .05); if (e.t <= 0) { e.state = 'idle'; e.t = rr(.7, 1); }
      break; }
    case 'meteorWind':
      e.t -= dt; if (e.t <= 0) { for (const o of e.mpts) e.pend.push({ x:o.x, y:o.y, t:rr(.9, 1.4), T:1.4 }); sfx.howl(); e.state = 'idle'; e.t = rr(.8, 1.1); }
      break;
    case 'chargeWind':
      e.t -= dt; if (e.t > .2) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = [{ k:'lane', a:e.aim, L:170, W:36 }]; }
      if (e.t <= 0) { e.tele = null; e.state = 'charge'; e.t = .5; e.lvx = Math.cos(e.aim) * 340; e.lvy = Math.sin(e.aim) * 340; e.hitDone = false; sfx.dodge(); }
      break;
    case 'charge':
      e.t -= dt; if (moveEnt(e, e.lvx * dt, e.lvy * dt)) e.t = Math.min(e.t, .04); keepIn(e, D, e.r);
      e.gt = (e.gt || 0) + dt; if (e.gt > .05) { e.gt = 0; e.burns.push({ x:e.x + rr(-6, 6), y:e.y + rr(-3, 3), t:2.2, ph:rr(0, 9) }); G.fx.push({ k:'rghost', kind:e.kind, x:e.x, y:e.y, flip:e.flip, t:0, d:.22 }); }
      if (!e.hitDone && Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 18 - DG) { e.hitDone = true; if (hurtPlayer(e.tgt, 26, e.x, e.y)) hitSpark(e.tgt.x, e.tgt.y - 8, true, e.aim); }
      if (e.t <= 0) { e.state = 'idle'; e.t = .9; }
      break;
    case 'flyUp':                                                      // 飛起來：空中不能被打
      e.t -= dt; e.z = (1 - e.t / .5) * 90; if (Math.random() < .5) G.fx.push({ k:'rghost', kind:e.kind, x:e.x, y:e.y - e.z, flip:e.flip, t:0, d:.2 });
      if (e.t <= 0) { e.state = 'flyHover'; e.t = e.wt = 1.3; }
      break;
    case 'flyHover': {
      e.t -= dt; if (e.t > .35) { const o = { x:e.tgt.x, y:e.tgt.y }; keepIn(o, D, 30); e.x += (o.x - e.x) * Math.min(1, dt * 4); e.y += (o.y - e.y) * Math.min(1, dt * 4); }
      e.tele = [{ k:'circle', r:54 }]; e.z = 90 + Math.sin(e.anim * 6) * 4;
      if (e.t <= 0) { e.state = 'dive'; e.t = .22; }
      break; }
    case 'dive':
      e.t -= dt; e.z = Math.max(0, e.t / .22 * 90);
      if (e.t <= 0) { e.z = 0; e.tele = null;
        if (Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 54 - DG && hurtPlayer(e.tgt, 34, e.x, e.y, { stun: .55 })) hitSpark(e.tgt.x, e.tgt.y - 8, true, Math.atan2(e.tgt.y - e.y, e.tgt.x - e.x));
        quakeFx(e.x, e.y, 60, true); for (const dl of [0, .1]) G.fx.push({ k:'warp', x:e.x, y:e.y, r0:6, r1:62, th:6, delay:dl, t:0, d:.45 + dl, col:'#ff8a3a' });
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; G.projs.push({ x:e.x + Math.cos(a) * 16, y:e.y - 8 + Math.sin(a) * 12, vx:Math.cos(a) * 170, vy:Math.sin(a) * 170, r:5, life:1.1, dmg:16, owner:'e', kind:'ember' }); }
        sfx.boom(); shake(8, .4); G.hitStop = Math.max(G.hitStop, .09); e.state = 'idle'; e.t = 1.1; }
      break;
  }
};
