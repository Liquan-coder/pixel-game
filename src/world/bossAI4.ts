/* ================= 地城 Boss 的招式庫・第二批（場地型 / 互動型 / 位移型） =================
   跟 world/bossAI3.ts 的招一樣用：在 world/dungeonBoss.ts 的 moves / p2 寫 [招式, 權重, 參數]，參數裡的 k = 傷害倍率。
   每一招打出去會記 e.act（給 render/bossAnim.ts 的動作用）。

   場地型（逼你抓閃避時機 → 完美閃避的用武之地）
     wave      震波：砸地 → 一圈（二階段兩圈）往外擴的環，只能抓時機閃過去           { spd, W 環寬, n 幾圈 }（掃過整個場地） act: pound
     beam      掃射光束：細線鎖定起點 → 粗光束從一邊轉到另一邊                         { L, W, arc 掃多大, dur 掃幾秒 }         act: lash
     grid      網格：整個場地一排排光束（井字），二階段轉 45° 再一次                    { W, gap 線的間距, n 每邊幾條 }          act: plant
     meteor    追身落雷：在你腳下一個接一個落（每 gap 秒一個），要一直走                { n, gap, r, fall 落下要幾秒 }           act: plant
   互動型（給你反制的機會）
     counter   架招：擺出架式 dur 秒；這段時間打牠 → 牠格擋並馬上反擊（then 那一招）；不打就沒事   { dur, then: [招, 參數] }   act: guard
     grab      抓取：短直線撲過來；抓到 = 定住你連打幾下再丟出去；沒抓到 = 牠大硬直（破綻）   { L, W, k 總傷害, hits, hold, miss }   act: thrust → throw
     orb       彈反球：慢慢追你的球，被打到就會反彈回去打 Boss（傷害照你的攻擊力 + 讓牠暈眩）   { n, spd, turn, mult, stun }   act: toss
     boomerang 迴力鏢：丟出去 → 停一下 → 飛回 Boss 身上，去程回程都會打到你             { L, spd, pause, n }                     act: toss
     orbit     護身環繞：幾顆東西繞著 Boss 轉 dur 秒，貼身狂砍會被打到                    { n, r, dur, spd }                       act: plant
   位移型
     blink     瞬移背刺：消失 → 出現在你背後 → 馬上出 then 那一招（預警只有一半）          { d 距離, then: [招, 參數] }             act: blink
     mirage    分身：在你周圍變出 n 個半透明的分身，跟真身一起出 m 那一招（只有真身有影子、不透明）  { n, m, mo }         act: 真身那一招的
   ※ 都是共用招，用之前先想「這隻的身體做得到嗎」（docs/Boss製作指南.md 的邏輯卡）。 */
import { G } from '../core/state';
import { TAU, clamp, pick, rr } from '../core/util';
import { ctx } from '../core/canvas';
import { DG } from '../data/items';
import { SPR } from '../art/monsters';
import { drawSprite } from '../art/sprite';
import { rigOf } from '../art/bossRig';
import { sfx } from '../core/audio';
import { damageEnemy, hurtPlayer } from '../game/combat';
import { hitSpark, quakeFx, shake } from '../game/worldUpdate';
import { moveEnt } from '../game/collision';
import { artLine, artPath, drawOrb, drawStar, fillSpans, shEll } from '../render/fx';
import { teleLane } from '../render/enemy';
import { sx as statusOf } from '../game/status';
import { keepIn, rbWind } from './regionBoss';
import { burst, trail } from './bossThemes';
import { TH, colsOf, dmgOf, done, laneTele, startMove } from './bossAI3';

export const MORE = new Set(['wave', 'beam', 'grid', 'meteor', 'counter', 'grab', 'orb', 'boomerang', 'orbit', 'blink', 'mirage']);
const STATES = new Set(['waveWind', 'beamWind', 'beam', 'gridWind', 'meteorCast', 'guard', 'grabWind', 'grab', 'hold', 'stagger', 'orbWind', 'boomWind', 'orbitWind', 'blinkOut']);
const wkOf = (e) => e.phase === 2 ? .78 : 1;
const objs = (e) => e.objs || (e.objs = []);
/* 一條直線（從 x, y 往 a 方向、長 L、半寬 W）上的人受傷。cd：同一個人多久內不會再被打（持續的光束用） */
function laneFrom(e, x: number, y: number, a: number, L: number, W: number, dmg: number, cd?: Map<any, number>) {
  const c = Math.cos(a), s = Math.sin(a);
  for (const pl of G.players) { if (pl.dead || (cd && G.time < (cd.get(pl) || 0))) continue;
    const rx = pl.x - x, ry = pl.y - y, along = rx * c + ry * s, side = Math.abs(-rx * s + ry * c);
    if (along > 0 && along < L && side < W + pl.r - DG) { if (cd) cd.set(pl, G.time + .4); if (hurtPlayer(pl, dmg, x, y)) hitSpark(pl.x, pl.y - 8, true, a); } }
}
function hitNear(x: number, y: number, r: number, dmg: number, hit?: Set<any>) {   // 圓形範圍：打到誰回傳 true；hit = 已經打過的人（同一下不會打兩次）
  let any = false;
  for (const pl of G.players) { if (pl.dead || (hit && hit.has(pl))) continue;
    if (Math.hypot(pl.x - x, pl.y - 6 - y) < r + pl.r - DG) { hit?.add(pl); if (hurtPlayer(pl, dmg, x, y)) { hitSpark(pl.x, pl.y - 8, true, Math.atan2(pl.y - y, pl.x - x)); any = true; } } }
  return any;
}
const gridLines = (e, o) => {                                              // 網格：穿過整個場地的幾條平行線（兩個方向）
  const D = e.def, R = D.R, n = o.n ?? 1, gap = o.gap || 56, out = [];
  for (const A of [e.gridA, e.gridA + Math.PI / 2]) { const c = Math.cos(A), s = Math.sin(A);
    for (let j = -n; j <= n; j++) { const cx = D.x - s * j * gap, cy = D.y + c * j * gap; out.push({ x: cx - c * R, y: cy - s * R, a: A, L: R * 2 }); } }
  return out;
};
const gridTele = (e, o) => gridLines(e, o).map(l => ({ k: 'lane', x: l.x, y: l.y, a: l.a, L: l.L, W: o.W || 12 }));
/* Boss 露出破綻：站著不動、頭上轉星星，受到的傷害 ×1.5（game/combat.ts 看 e.mStun） */
function stagger(e, t: number) {
  e.state = 'stagger'; e.t = e.wt = t; e.tele = null; e.chain = null; e.mStun = t; e.hidden = e.immune = false; e.guard = false;
  G.hitStop = Math.max(G.hitStop, .12); shake(5, .3); sfx.boom(); burst(e.x, e.y - 20, 'sparks', 16);
}
/* 架招被打到：格擋（鏘）→ 馬上用 then 那一招反擊，預警很短 */
function riposte(e, pl) {
  if (!e.guard) return; e.guard = false; e.onGuard = null;
  G.fx.push({ k: 'warp', x: e.x, y: e.y - 14, r0: 6, r1: 34, th: 4, t: 0, d: .25, col: '#ffffff' }); burst(e.x, e.y - 14, 'sparks', 18);
  G.hitStop = Math.max(G.hitStop, .1); shake(4, .2); sfx.hit();
  const [m, mo] = e.mo?.then || ['sweep', { r: 60, half: 1.2, k: 1.4 }]; e.chain = null;
  startMove(e, m, mo, pl.x - e.x, pl.y - e.y); e.t = e.wt = .18;
}

export function startMore(e, m: string, mo, dx: number, dy: number) {
  const wk = wkOf(e), p2 = e.phase === 2;
  switch (m) {
    case 'wave': rbWind(e, 'waveWind', (mo.wind || .75) * wk, [{ k: 'circle', r: 26 }]); break;
    case 'beam': { const sg = Math.random() < .5 ? -1 : 1, a0 = e.aim - sg * mo.arc / 2; e.bm = { a0, a1: a0 + sg * mo.arc, fxT: 0, cd: new Map() };
      rbWind(e, 'beamWind', (mo.wind || .8) * wk, [{ k: 'lane', a: a0, L: mo.L, W: 4 }]); break; }
    case 'grid': e.gridN = p2 ? 2 : 1; e.gridA = Math.random() < .5 ? 0 : Math.PI / 4; rbWind(e, 'gridWind', (mo.wind || .9) * wk, gridTele(e, mo)); break;
    case 'meteor': e.state = 'meteorCast'; e.mN = 0; e.mT = 0; e.t = e.wt = (mo.n + (p2 ? 2 : 0)) * (mo.gap || .3) + .3; e.tele = null; e.act = { k: 'plant', t0: G.time, aim: e.aim }; sfx.skill(); break;
    case 'counter': e.state = 'guard'; e.t = e.wt = mo.dur || 1.4; e.tele = null; e.guard = true; e.onGuard = (pl) => riposte(e, pl);
      e.act = { k: 'guard', t0: G.time, aim: e.aim }; G.fx.push({ k: 'warp', x: e.x, y: e.y - 14, r0: 30, r1: 10, th: 3, t: 0, d: .3, col: '#ffffff' }); sfx.skill(); break;
    case 'grab': rbWind(e, 'grabWind', (mo.wind || .6) * wk, laneTele(e, mo)); break;
    case 'orb': rbWind(e, 'orbWind', (mo.wind || .7) * wk, [{ k: 'circle', r: 24 }]); break;
    case 'boomerang': rbWind(e, 'boomWind', (mo.wind || .6) * wk, laneTele(e, { L: mo.L, W: 12 })); break;
    case 'orbit': rbWind(e, 'orbitWind', (mo.wind || .6) * wk, [{ k: 'circle', r: (mo.r || 30) + 8 }]); break;
    case 'blink': e.state = 'blinkOut'; e.t = e.wt = .4; e.tele = null; e.hidden = e.immune = true; e.act = { k: 'blink', t0: G.time, aim: e.aim };
      burst(e.x, e.y - 12, TH(e).impact, 18); G.fx.push({ k: 'warp', x: e.x, y: e.y - 12, r0: 20, r1: 4, th: 3, t: 0, d: .25, col: colsOf(e)[1] }); sfx.dodge(); break;
    case 'mirage': {                                                         // 分身：真身照常出招，分身在你周圍同一個距離、一起出同一招
      const T = e.tgt, d = clamp(Math.hypot(dx, dy), 70, 110), b = Math.atan2(e.y - T.y, e.x - T.x), n = mo.n + (p2 ? 1 : 0), m2 = mo.m || 'charge', o2 = mo.mo || {};
      startMove(e, m2, o2, dx, dy); const wind = e.t;
      for (let i = 1; i <= n; i++) { const a = b + i * TAU / (n + 1), q = { x: T.x + Math.cos(a) * d, y: T.y + Math.sin(a) * d * .85 }; keepIn(q, e.def, e.r);
        objs(e).push({ k: 'clone', x: q.x, y: q.y, m: m2, o: o2, ph: 'wind', t: wind, wt: wind, aim: Math.atan2(T.y - q.y, T.x - q.x), dmg: dmgOf(e, { k: (o2.k || 1) * .7 }), hit: new Set() });
        burst(q.x, q.y - 12, TH(e).impact, 10); }
      sfx.howl(); break; }
  }
}

/* 每幀都要跑（不管 Boss 在做什麼）：震波、光球、迴力鏢、分身、環繞物 */
export function tickMore(e, dt: number) {
  if (!e.objs?.length) return;
  const T = TH(e), C = colsOf(e);
  e.objs = e.objs.filter(o => {
    switch (o.k) {
      case 'wave': {                                                       // 一圈往外擴的環：環經過你腳下的那一刻才打得到
        if ((o.delay -= dt) > 0) return true;
        o.r += o.spd * dt; if (o.r > o.R) return false;
        for (const pl of G.players) { if (pl.dead || o.hit.has(pl)) continue; const d = Math.hypot(pl.x - o.x, pl.y - o.y);
          if (Math.abs(d - o.r) < o.W / 2 + pl.r - DG) { o.hit.add(pl); if (hurtPlayer(pl, o.dmg, o.x, o.y, { stun: .3 })) hitSpark(pl.x, pl.y - 8, true, Math.atan2(pl.y - o.y, pl.x - o.x)); } }
        if (Math.random() < .7) { const a = rr(0, TAU), bx = o.x + Math.cos(a) * o.r, by = o.y + Math.sin(a) * o.r; if (Math.hypot(bx - o.cx, by - o.cy) < o.cR) burst(bx, by, T.impact, 1); }   // 火星只冒在場地裡
        return true; }
      case 'orbit': {                                                      // 繞著 Boss 轉的幾顆東西
        o.t -= dt; o.a += o.spd * dt; if (o.t <= 0) { for (const p of orbitPts(e, o)) burst(p[0], p[1], T.impact, 4); return false; }
        for (const [x, y] of orbitPts(e, o)) for (const pl of G.players) { if (pl.dead || G.time < (o.cd.get(pl) || 0)) continue;
          if (Math.hypot(pl.x - x, pl.y - 6 - y) < 6 + pl.r - DG) { o.cd.set(pl, G.time + .7); if (hurtPlayer(pl, o.dmg, x, y)) hitSpark(pl.x, pl.y - 8, true, Math.atan2(pl.y - y, pl.x - x)); } }
        return true; }
      case 'boom': {                                                       // 迴力鏢：去 → 停 → 回到 Boss 身上（去、回各打一次）
        o.spin += dt * 18;
        if (o.ph === 'out') { o.d += o.spd * dt; o.x = o.ox + Math.cos(o.a) * o.d; o.y = o.oy + Math.sin(o.a) * o.d;
          if (o.d >= o.L || Math.hypot(o.x - e.def.x, o.y - e.def.y) > e.def.R - 6) { o.ph = 'hang'; o.t = o.pause; } }
        else if (o.ph === 'hang') { if ((o.t -= dt) <= 0) { o.ph = 'back'; o.hit = new Set(); } }
        else { const tx = e.x, ty = e.y - 10, d = Math.hypot(tx - o.x, ty - o.y); if (d < 10) { burst(o.x, o.y, T.impact, 6); return false; }
          const v = Math.min(d, o.spd * 1.15 * dt); o.x += (tx - o.x) / d * v; o.y += (ty - o.y) / d * v; }
        hitNear(o.x, o.y, 8, o.dmg, o.hit); if (Math.random() < .5) trail(o.x, o.y + 6, T.trail);
        return true; }
      case 'orb': {                                                        // 彈反球：慢慢追你；被打到就反彈回去打 Boss
        if (o.dead) return false;
        if (!o.back) { o.life -= dt; if (o.life <= 0) { o.dead = true; burst(o.x, o.y, T.impact, 8); return false; }
          const tg = e.tgt; if (tg && !tg.dead) { const want = Math.atan2(tg.y - 8 - o.y, tg.x - o.x); let dA = want - o.a; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); o.a += clamp(dA, -o.turn * dt, o.turn * dt); }
          o.x += Math.cos(o.a) * o.spd * dt; o.y += Math.sin(o.a) * o.spd * dt;
          if (hitNear(o.x, o.y + 6, 7, o.dmg)) { o.dead = true; burst(o.x, o.y, T.impact, 10); return false; } }
        else { const tx = e.x, ty = e.y - 14, d = Math.hypot(tx - o.x, ty - o.y);
          if (d < e.r + 4) { o.dead = true; burst(o.x, o.y, 'sparks', 20); G.fx.push({ k: 'warp', x: e.x, y: e.y - 14, r0: 6, r1: 40, th: 5, t: 0, d: .35, col: '#ffffff' });
            if (!e.hidden && !e.immune) { damageEnemy(o.by, e, o.mult, o.x, o.y, { heavy: true }); if (!(e.z > 0) && e.hp > 0) stagger(e, o.stun); }
            return false; }
          const v = Math.min(d, 280 * dt); o.x += (tx - o.x) / d * v; o.y += (ty - o.y) / d * v; }
        return true; }
      case 'clone': {                                                      // 分身：跟真身同時蓄力、同時出手，打完就散掉
        o.t -= dt; const tg = e.tgt;
        if (o.ph === 'wind') { if (o.t > .2 && tg) o.aim = Math.atan2(tg.y - o.y, tg.x - o.x);
          if (o.t <= 0) { if (o.m === 'charge') { o.ph = 'dash'; o.t = o.o.L / o.o.spd; } else { laneFrom(e, o.x, o.y, o.aim, o.o.L, o.o.W, o.dmg);
              G.fx.push({ k: 'lash', style: T.lash, x: o.x, y: o.y - 8, a: o.aim, L: o.o.L, W: o.o.W, cols: C, t: 0, d: .35 }); o.ph = 'fade'; o.t = .3; } } }
        else if (o.ph === 'dash') { o.x += Math.cos(o.aim) * o.o.spd * dt; o.y += Math.sin(o.aim) * o.o.spd * dt; keepIn(o, e.def, e.r);
          if (!o.hit.size) hitNear(o.x, o.y, e.r + 4, o.dmg, o.hit); if (o.t <= 0) { o.ph = 'fade'; o.t = .3; } }
        else if (o.t <= 0) { burst(o.x, o.y - 12, T.impact, 12); return false; }
        return true; }
    }
    return false;
  });
}
const orbitPts = (e, o) => Array.from({ length: o.n }, (_, i) => { const a = o.a + i * TAU / o.n; return [e.x + Math.cos(a) * o.r, e.y - 12 + Math.sin(a) * o.r * .8]; });

/* 這一批招的狀態。回傳 true = 這一幀處理過了 */
export function moreStates(e, dt: number, dx: number, dy: number): boolean {
  if (!STATES.has(e.state)) return false;
  const o = e.mo || {}, D = e.def, wk = wkOf(e), p2 = e.phase === 2, T = TH(e), C = colsOf(e);
  e.t -= dt;
  switch (e.state) {
    case 'waveWind':                                                       // 震波：砸下去 → 一圈一圈往外擴
      if (e.t <= 0) { e.tele = null; const n = (o.n || 1) + (p2 ? 1 : 0);
        for (let i = 0; i < n; i++) objs(e).push({ k: 'wave', x: e.x, y: e.y, r: 6, R: D.R + Math.hypot(e.x - D.x, e.y - D.y), cx: D.x, cy: D.y, cR: D.R, spd: o.spd || 120, W: o.W || 10, delay: i * .5, dmg: dmgOf(e, o), hit: new Set() });
        hitNear(e.x, e.y, 24, dmgOf(e, o));                                 // 砸下去的那一點也會痛
        quakeFx(e.x, e.y, 40); burst(e.x, e.y, T.impact, 24); sfx.boom(); shake(6, .3); e.act = { k: 'pound', t0: G.time, aim: e.aim }; done(e, rr(.8, 1) * wk, dx, dy); }
      break;
    case 'beamWind':
      if (e.t <= 0) { e.tele = null; e.state = 'beam'; e.t = e.wt = o.dur || 1.2; e.act = { k: 'lash', t0: G.time, aim: e.bm.a0 }; sfx.skill(); }
      break;
    case 'beam': {                                                         // 光束從 a0 轉到 a1：碰到就痛（每個人 0.4 秒最多一次）
      const B = e.bm, u = clamp(1 - e.t / e.wt, 0, 1), a = B.a0 + (B.a1 - B.a0) * u; e.aim = a; e.flip = Math.cos(a) < 0;
      laneFrom(e, e.x, e.y - 6, a, o.L, o.W, dmgOf(e, o), B.cd);
      if ((B.fxT -= dt) <= 0) { B.fxT = .045; G.fx.push({ k: 'lash', style: T.lash, x: e.x, y: e.y - 8, a, L: o.L, W: o.W, cols: C, t: 0, d: .1 }); }
      burst(e.x + Math.cos(a) * o.L, e.y - 6 + Math.sin(a) * o.L, T.impact, 1);
      if (e.t <= 0) done(e, rr(.7, 1) * wk, dx, dy);
      break; }
    case 'gridWind':                                                       // 網格：所有線同時打下去；二階段轉 45° 再一次
      if (e.t <= 0) { e.tele = null;
        for (const l of gridLines(e, o)) { laneFrom(e, l.x, l.y, l.a, l.L, o.W || 12, dmgOf(e, o)); G.fx.push({ k: 'lash', style: T.lash, x: l.x, y: l.y - 2, a: l.a, L: l.L, W: o.W || 12, cols: C, t: 0, d: .35 }); }
        sfx.skill(); shake(4, .2);
        if (--e.gridN > 0) { e.gridA += Math.PI / 4; rbWind(e, 'gridWind', .6 * wk, gridTele(e, o)); }
        else { e.act = { k: 'plant', t0: G.time, aim: e.aim }; done(e, rr(.8, 1.1) * wk, dx, dy); } }
      break;
    case 'meteorCast': {                                                   // 追身落雷：每 gap 秒在你現在的位置落一個
      const n = o.n + (p2 ? 2 : 0); e.mT -= dt;
      if (e.mT <= 0 && e.mN < n && e.tgt) { e.mT = o.gap || .3; e.mN++; const q = { x: e.tgt.x, y: e.tgt.y }; keepIn(q, D, 16);
        e.pend.push({ x: q.x, y: q.y, r: o.r || 20, t: o.fall || .7, T: o.fall || .7, dmg: dmgOf(e, o), fall: T.rain, impact: T.impact, cols: T.rainCols || C, warm: 2 }); }
      if (e.t <= 0) done(e, rr(.6, .9) * wk, dx, dy);
      break; }
    case 'guard':                                                          // 架招：面向你、身上閃著白光。時間到沒被打 → 收架
      e.flip = dx < 0; e.aim = Math.atan2(dy, dx);
      if (Math.random() < .5) G.parts.push({ x: e.x + rr(-10, 10), y: e.y - rr(10, 34), vx: 0, vy: -10, life: .3, max: .3, col: '#ffffff', star: rr(.6, 1.2), drag: 1 });
      if (e.t <= 0) { e.guard = false; e.onGuard = null; done(e, rr(.4, .6), dx, dy); }
      break;
    case 'grabWind':
      if (e.t > .2) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = laneTele(e, o); }
      if (e.t <= 0) { e.tele = null; e.state = 'grab'; e.t = .16; const v = (o.L || 64) * .45 / .16; e.lvx = Math.cos(e.aim) * v; e.lvy = Math.sin(e.aim) * v; e.hitDone = false; e.held = null;
        e.act = { k: 'thrust', t0: G.time, aim: e.aim }; sfx.swing(); }
      break;
    case 'grab': {                                                         // 撲過去：前面那一小段碰到你 → 抓住（瞬移中 = 沒抓到）
      moveEnt(e, e.lvx * dt, e.lvy * dt); keepIn(e, D, e.r);
      if (!e.hitDone) { const c = Math.cos(e.aim), s = Math.sin(e.aim);
        for (const pl of G.players) { if (pl.dead) continue; const rx = pl.x - e.x, ry = pl.y - e.y, al = rx * c + ry * s, sd = Math.abs(-rx * s + ry * c);
          if (al > -4 && al < e.r + (o.reach || 22) && sd < (o.W || 16)) { e.hitDone = true; if (hurtPlayer(pl, dmgOf(e, { k: o.k * .2 }), e.x, e.y)) { e.held = pl; e.hn = o.hits || 3; e.hT = 0; } break; } } }
      if (e.t <= 0) { if (e.held) { e.state = 'hold'; e.t = e.wt = o.hold || 1.1; sfx.howl(); } else stagger(e, o.miss || 1.5); }   // 沒抓到：大硬直
      break; }
    case 'hold': {                                                         // 抓住：你被定在牠前面，連打幾下，最後丟出去
      const pl = e.held; if (!pl || pl.dead) { e.held = null; done(e, .6, dx, dy); break; }
      const c = Math.cos(e.aim), s = Math.sin(e.aim); pl.x = e.x + c * (e.r + 6); pl.y = e.y + s * 6 + 1; pl.kx = pl.ky = 0;
      const S = statusOf(pl); S.stun = Math.max(S.stun, .2);
      if ((e.hT -= dt) <= 0 && e.hn > 0) { e.hT = (o.hold || 1.1) / ((o.hits || 3) + 1); e.hn--; pl.iframe = 0; hurtPlayer(pl, dmgOf(e, { k: o.k * .15 }), e.x, e.y); shake(3, .12); burst(pl.x, pl.y - 8, T.impact, 6); }
      if (e.t <= 0) { pl.iframe = 0; S.stun = 0; if (hurtPlayer(pl, dmgOf(e, { k: o.k * .35 }), e.x - c * 20, e.y - s * 20)) { pl.kx *= 3; pl.ky *= 3; }
        e.held = null; e.act = { k: 'throw', t0: G.time, aim: e.aim }; sfx.boom(); shake(6, .3); done(e, rr(.8, 1), dx, dy); }
      break; }
    case 'stagger':                                                        // 破綻：站著不動（受傷 ×1.5），頭上轉星星
      e.mStun = Math.max(0, e.t); if (e.t <= 0) { e.mStun = 0; e.state = 'idle'; e.t = .3; }
      break;
    case 'orbWind':
      if (e.t <= 0) { e.tele = null; const n = (o.n || 1) + (p2 ? 1 : 0);
        for (let i = 0; i < n; i++) { const a = e.aim + (i - (n - 1) / 2) * .7;
          objs(e).push({ k: 'orb', x: e.x + Math.cos(a) * 14, y: e.y - 14 + Math.sin(a) * 10, a, spd: o.spd || 55, turn: o.turn || 1.6, life: o.life || 7, dmg: dmgOf(e, o),
            mult: o.mult || 3, stun: o.stun || 2.2, r: 6, hp: 1, maxHp: 1, lv: e.lv, boss: true, hittable: true, onHit: null }); }   // hittable：玩家打得到（game/combat.ts 的 targets）
        for (const b of e.objs) if (b.k === 'orb' && !b.onHit) b.onHit = (pl) => { if (b.back) return; b.back = true; b.hittable = false; b.by = pl; burst(b.x, b.y, 'sparks', 14); G.hitStop = Math.max(G.hitStop, .06); sfx.hit();
          G.fx.push({ k: 'warp', x: b.x, y: b.y, r0: 4, r1: 18, th: 3, t: 0, d: .2, col: '#ffffff' }); };
        e.act = { k: 'toss', t0: G.time, aim: e.aim }; sfx.skill(); done(e, rr(.6, .9) * wk, dx, dy); }
      break;
    case 'boomWind':
      if (e.t > .2) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = laneTele(e, { L: o.L, W: 12 }); }
      if (e.t <= 0) { e.tele = null; const n = (o.n || 1) + (p2 ? 1 : 0);
        for (let i = 0; i < n; i++) { const a = e.aim + (i - (n - 1) / 2) * .45;
          objs(e).push({ k: 'boom', ox: e.x, oy: e.y - 10, x: e.x, y: e.y - 10, a, d: 0, L: o.L || 150, spd: o.spd || 240, pause: o.pause || .4, ph: 'out', spin: 0, dmg: dmgOf(e, o), hit: new Set() }); }
        e.act = { k: 'toss', t0: G.time, aim: e.aim }; sfx.swing(); done(e, rr(.6, .9) * wk, dx, dy); }
      break;
    case 'orbitWind':
      if (e.t <= 0) { e.tele = null; objs(e).push({ k: 'orbit', n: (o.n || 4) + (p2 ? 1 : 0), r: o.r || 30, t: o.dur || 8, a: 0, spd: o.spd || 2.6, dmg: dmgOf(e, o), cd: new Map() });
        e.act = { k: 'plant', t0: G.time, aim: e.aim }; sfx.skill(); done(e, .5, dx, dy); }
      break;
    case 'blinkOut':                                                       // 瞬移：消失 0.4 秒 → 出現在你背後 → 馬上出招（預警只有一半）
      if (e.t <= 0) { const tg = e.tgt, f = tg.face ?? Math.atan2(tg.y - e.y, tg.x - e.x), d = o.d || 30, q = { x: tg.x - Math.cos(f) * d, y: tg.y - Math.sin(f) * d * .8 };
        keepIn(q, D, e.r); e.x = q.x; e.y = q.y; e.hidden = e.immune = false; e.flip = tg.x < e.x;
        burst(e.x, e.y - 12, T.impact, 18); G.fx.push({ k: 'warp', x: e.x, y: e.y - 12, r0: 4, r1: 26, th: 3, t: 0, d: .25, col: C[1] }); sfx.dodge();
        const [m, mo] = o.then || ['sweep', { r: 56, half: 1.1, k: 1.2 }]; e.chain = null; startMove(e, m, mo, tg.x - e.x, tg.y - e.y); e.t *= .55; e.wt = e.t; }
      break;
  }
  return true;
}

/* 畫：震波的環、環繞物、迴力鏢、光球、分身、破綻的星星（world/regionBoss.ts 的 drawRBTele 每幀呼叫） */
export function drawMore(e) {
  const C = colsOf(e);
  if (e.state === 'stagger' && !e.mech) for (let k = 0; k < 3; k++) { const a = G.time * 5 + k / 3 * TAU; drawStar(e.x + Math.cos(a) * 12, e.y - 38 + Math.sin(a) * 3, 2.6, '#ffe38a'); }
  if (e.state === 'hold' && e.held) { const pl = e.held, x0 = e.x + Math.cos(e.aim) * 8, y0 = e.y - 12;   // 抓住：從 Boss 連到你身上的一條（蛙王就是舌頭）
    for (const [w, col] of [[4, C[0]], [2, C[1]]] as [number, string][]) { ctx.fillStyle = col; artPath(); artLine(x0, y0, pl.x, pl.y - 8, w); ctx.fill(); } drawOrb(pl.x, pl.y - 8, 3, C); }
  if (e.state === 'waveWind') { const a0 = ctx.globalAlpha, q = 1 - e.t / (e.wt || 1);   // 震波・蓄力：地上一圈圈細細的漣漪往外跑 →「等一下會有一圈推過來」（跟砸地的實心圓不一樣）
    for (let k = 0; k < 3; k++) { const u = (G.time * 1.6 + k / 3) % 1, r = 14 + u * 70; ctx.globalAlpha = (.25 + .45 * q) * (1 - u);
      fillSpans(e.y - r - 2, e.y + r + 2, [{ sh: shEll(e.x, e.y, r + 1), sub: shEll(e.x, e.y, r - 1), col: C[2], a: 1 }]); } ctx.globalAlpha = a0; }
  if (e.state === 'guard') { const p = .6 + .4 * Math.sin(G.time * 20), a0 = ctx.globalAlpha; ctx.globalAlpha = .5 * p;   // 架招：身上一圈白光
    fillSpans(e.y - 30, e.y + 2, [{ sh: shEll(e.x, e.y - 14, 18, 1.2), sub: shEll(e.x, e.y - 14, 15, 1.2), col: '#ffffff', a: 1 }]); ctx.globalAlpha = a0; }
  for (const o of e.objs || []) {
    if (o.k === 'wave' && o.delay <= 0) { ctx.save(); ctx.beginPath(); ctx.arc(o.cx, o.cy, o.cR, 0, TAU); ctx.clip();   // 環：只畫在場地圈裡面（碰到圈邊就消失，不會跑到外面）
      ctx.globalAlpha = .9; fillSpans(o.y - o.r - o.W, o.y + o.r + o.W, [{ sh: shEll(o.x, o.y, o.r + o.W / 2), sub: shEll(o.x, o.y, Math.max(0, o.r - o.W / 2)), col: C[1], a: .75 },
        { sh: shEll(o.x, o.y, o.r + 1), sub: shEll(o.x, o.y, Math.max(0, o.r - 1)), col: C[2], a: 1 }]); ctx.restore(); }
    else if (o.k === 'orbit') for (const [x, y] of orbitPts(e, o)) drawOrb(x, y, 4.4 + .5 * Math.sin(G.time * 12), C);
    else if (o.k === 'boom') { ctx.fillStyle = C[1]; artPath(); for (let k = 0; k < 3; k++) { const a = o.spin + k * TAU / 3; artLine(o.x, o.y, o.x + Math.cos(a) * 7, o.y + Math.sin(a) * 7, 2); } ctx.fill();
      drawOrb(o.x, o.y, 2.2, C); }
    else if (o.k === 'orb') { const r = 5 + .6 * Math.sin(G.time * 10), cols = o.back ? ['#7a5a1a', '#ffe38a', '#ffffff'] : C;   // 會被打回去的球：外面多一圈轉動的虛線（跟一般子彈不一樣）
      drawOrb(o.x, o.y, r, cols); ctx.fillStyle = '#ffffff'; artPath(); for (let k = 0; k < 6; k++) { const a = G.time * 4 + k * TAU / 6; artLine(o.x + Math.cos(a) * (r + 2), o.y + Math.sin(a) * (r + 2), o.x + Math.cos(a + .35) * (r + 2), o.y + Math.sin(a + .35) * (r + 2), 1); } ctx.fill(); }
    else if (o.k === 'clone') { const sp = rigOf(e.kind)?.body || SPR[e.kind]; if (!sp) continue;   // 分身：半透明、會閃、沒有影子
      if (o.ph === 'wind') teleLane(o.x, o.y - 6, o.aim, o.m === 'charge' ? o.o.L : o.o.L, o.o.W || 20, clamp(1 - o.t / o.wt, 0, 1));
      const a0 = ctx.globalAlpha; ctx.globalAlpha = (o.ph === 'fade' ? o.t / .3 : 1) * (.42 + .12 * Math.sin(G.time * 30));
      drawSprite(sp, o.x, o.y + 2, rigOf(e.kind)?.spec.mirror ? Math.cos(o.aim) > 0 : Math.cos(o.aim) < 0, false, false); ctx.globalAlpha = a0; }
  }
  void pick;
}
