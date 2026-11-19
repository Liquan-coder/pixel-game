import { G } from '../core/state';
import { $, TAU, angDiff, clamp, dist, pick, rr } from '../core/util';
import { DG, bossWeapon } from '../data/items';
import { ARENA, DOOR, MW, RFLOOR, TS, explored, map } from '../world/map';
import { invalidate } from '../world/chunks';
import { miniPix } from '../world/minimap';
import { collides, inArena, moveEnt, stepToward } from './collision';
import { sfx } from '../core/audio';
import { dropItem, makeEnemy } from './enemies';
import { hurtPlayer } from './combat';
import { nearestPlayer } from './player';
import { burst, dropGold, dropSouls, hitSpark, quakeFx, shake } from './worldUpdate';
import { showBanner, toast } from '../ui/hud';
import { save } from './save';

/* ================= BOSS ================= */
const BOSS_HOME = { x: DOOR[1] * TS + 8, y: (ARENA.y0 + 7) * TS };
function makeBoss() {
  return { boss:true, kind:'boss', x:BOSS_HOME.x, y:BOSS_HOME.y, r:13, hp:1500, maxHp:1500, state:'sleep', t:0, phase:1,
    flash:0, kx:0, ky:0, stun:0, flip:false, howlT:0, combo:0, anim:0, aim:0, lvx:0, lvy:0, hitDone:false };
}
export function resetBoss() {
  if (G.bossDead) { G.B = null; return; }
  G.B = makeBoss(); G.fogLocked = false; $('bossBar').hidden = true;
  G.enemies = G.enemies.filter(e => e.sp);
}
function startBossFight() {
  G.fogLocked = true; G.B.state = 'intro'; G.B.t = 1.4; $('bossBar').hidden = false; $('bossBar').querySelector('.bname').textContent = '狼王・灰鬃';
  showBanner('狼王・灰鬃', '巢穴的主人醒了', 2200); sfx.howl(); shake(5, .6);
}
const BOSSC = ['#8a1020', '#ff5a5a', '#fff0f0'];
function bossWind(state, t) { G.B.state = state; G.B.t = G.B.wt = t; }
function chooseBossAttack() {
  const d = dist(G.B, G.B.tgt), p2 = G.B.phase === 2, r = Math.random();
  G.B.aim = Math.atan2(G.B.tgt.y - G.B.y, G.B.tgt.x - G.B.x);
  if (p2 && G.B.howlT <= 0) { bossWind('howlWind', .9); return; }
  if (p2 && (G.B.leapT || 0) <= 0 && (d > 40 ? r < .7 : r < .3)) { bossWind('leapWind', .65); G.B.tx = G.B.tgt.x; G.B.ty = G.B.tgt.y; G.B.leapT = 6; return; }
  if (p2 && r > .72) { bossWind('clawWind', .55); return; }
  if (d < 46 && Math.random() < .7) bossWind('biteWind', p2 ? .38 : .48);
  else { bossWind('lungeWind', p2 ? .45 : .62); G.B.combo = p2 ? 2 : 0; }
}
function bossGhost() { G.fx.push({ k:'bghost', x:G.B.x, y:G.B.y - (G.B.z || 0), flip:G.B.flip, t:0, d:.22 }); }
export function updateBoss(dt) {
  if (!G.B || G.bossDead) return;
  G.B.anim += dt; if (G.B.flash > 0) G.B.flash -= dt;
  if (G.B.state === 'sleep') { if (G.players.some(pl => !pl.dead && inArena(pl.x, pl.y))) startBossFight(); return; }   // 任何人走進競技場就醒來
  if (G.B.state === 'intro') { G.B.t -= dt; if (G.B.t <= 0) { G.B.state = 'idle'; G.B.t = .6; } return; }
  G.B.tgt = nearestPlayer(G.B.x, G.B.y);                              // 每幀瞄準最近的活著的玩家
  if (G.B.tgt.dead) return;
  const dx = G.B.tgt.x - G.B.x, dy = G.B.tgt.y - G.B.y, d = Math.hypot(dx, dy), p2 = G.B.phase === 2;
  if (G.B.phase === 1 && G.B.hp < G.B.maxHp * .5) {                         // 進入第二階段：停頓 + 紅光 + 震波
    G.B.phase = 2; G.B.z = 0; bossWind('howlWind', .9); toast('狼王發怒了！', '#ff6a5a');
    G.hitStop = Math.max(G.hitStop, .3); shake(6, .5); G.fx.push({ k:'flash', col:'#ff2a2a', a:.35, t:0, d:.5 });
    for (const dl of [0, .1, .2]) G.fx.push({ k:'warp', x:G.B.x, y:G.B.y, r0:8, r1:70, th:5, delay:dl, t:0, d:.5 + dl, col:'#ff3b3b' });
    return;
  }
  G.B.howlT -= dt; G.B.leapT = (G.B.leapT || 0) - dt;
  if (p2 && Math.random() < .5) G.parts.push({ x:G.B.x + rr(-14, 14), y:G.B.y - rr(4, 24), vx:rr(-5, 5), vy:-rr(20, 45), life:.6, max:.6, col:pick(['#ff5a5a', '#ff9a6a', '#ffd0c0']), star:rr(.5, 1.4), drag:1 });
  switch (G.B.state) {
    case 'idle':
      G.B.t -= dt; G.B.flip = dx < 0;
      if (d > 34) stepToward(G.B, G.B.tgt.x, G.B.tgt.y, p2 ? 72 : 52, dt);
      if (G.B.t <= 0) chooseBossAttack();
      break;
    case 'biteWind':                                                  // 咬：兩道紅色新月從上下合起來
      G.B.t -= dt;
      if (G.B.t <= 0) {
        const hit = d < G.B.r + 36 - DG && angDiff(Math.atan2(dy, dx), G.B.aim) < 1.0 - DG / Math.max(d, 20);
        for (const sg of [-1, 1]) G.fx.push({ k:'smear', x:G.B.x, y:G.B.y - 8, a0:G.B.aim + sg * 1.25, a1:G.B.aim + sg * .05, r:42, w:10, sw:.08, hold:.16, delay:0, t:0, d:.24, cols:BOSSC, sy:.8 });
        if (hit && hurtPlayer(G.B.tgt, 24, G.B.x, G.B.y)) { hitSpark(G.B.tgt.x, G.B.tgt.y - 8, true, G.B.aim); G.hitStop = Math.max(G.hitStop, .06); }
        G.B.state = 'idle'; G.B.t = rr(.5, .9) * (p2 ? .7 : 1); shake(2, .12); sfx.swing();
      }
      break;
    case 'lungeWind':
      G.B.t -= dt; if (G.B.t > .25) { G.B.aim = Math.atan2(dy, dx); G.B.flip = dx < 0; }
      if (G.B.t <= 0) { G.B.state = 'lunge'; G.B.t = .42; G.B.lvx = Math.cos(G.B.aim) * 310; G.B.lvy = Math.sin(G.B.aim) * 310; G.B.hitDone = false; sfx.dodge(); }
      break;
    case 'lunge':                                                     // 撲擊：紅色殘影 + 速度線 + 揚塵
      G.B.t -= dt;
      if (moveEnt(G.B, G.B.lvx * dt, G.B.lvy * dt)) G.B.t = Math.min(G.B.t, .05);
      G.B.gt = !G.B.gt; if (G.B.gt) bossGhost();
      G.fx.push({ k:'aline', x:G.B.x + rr(-10, 10), y:G.B.y - 10 + rr(-8, 8), a:G.B.aim + Math.PI, len:rr(14, 30), t:0, d:.14, col:'#ffd0d0' });
      if (Math.random() < .6) G.parts.push({ x:G.B.x + rr(-8, 8), y:G.B.y, vx:rr(-20, 20), vy:-rr(10, 30), life:.4, max:.4, col:pick(['#5a5468', '#7a7488']), s:1, g:60 });
      if (!G.B.hitDone && Math.hypot(G.B.tgt.x - G.B.x, G.B.tgt.y - G.B.y) < 17 - DG) { G.B.hitDone = true; if (hurtPlayer(G.B.tgt, 28, G.B.x, G.B.y)) { hitSpark(G.B.tgt.x, G.B.tgt.y - 8, true, G.B.aim); G.hitStop = Math.max(G.hitStop, .07); } }
      if (G.B.t <= 0) {
        if (G.B.combo > 0) { G.B.combo--; bossWind('lungeWind', .4); G.B.aim = Math.atan2(G.B.tgt.y - G.B.y, G.B.tgt.x - G.B.x); }
        else { G.B.state = 'idle'; G.B.t = rr(.6, 1) * (p2 ? .75 : 1); }
      }
      break;
    case 'leapWind':                                                  // 天降狼擊：蹲低，紅圈跟著玩家，最後 0.2 秒鎖定
      G.B.t -= dt; G.B.flip = G.B.tgt.x < G.B.x;
      if (G.B.t > .2) { G.B.tx = clamp(G.B.tgt.x, (ARENA.x0 + 1.5) * TS, (ARENA.x1 - .5) * TS); G.B.ty = clamp(G.B.tgt.y, (ARENA.y0 + 1.5) * TS, (ARENA.y1 - .5) * TS); }
      if (Math.random() < .5) G.parts.push({ x:G.B.x + rr(-12, 12), y:G.B.y, vx:rr(-30, 30), vy:-rr(10, 30), life:.35, max:.35, col:'#7a7488', s:1, g:80 });
      if (G.B.t <= 0) { G.B.state = 'leap'; G.B.t = G.B.lt = .62; G.B.sx = G.B.x; G.B.sy = G.B.y; if (collides(G.B.tx, G.B.ty, G.B.r)) { G.B.tx = G.B.x; G.B.ty = G.B.y; } sfx.dodge(); shake(2, .1); }
      break;
    case 'leap': {
      G.B.t -= dt; const u = Math.min(1, 1 - G.B.t / G.B.lt);
      G.B.x = G.B.sx + (G.B.tx - G.B.sx) * u; G.B.y = G.B.sy + (G.B.ty - G.B.sy) * u; G.B.z = Math.sin(Math.PI * u) * 58;
      if (Math.random() < .5) bossGhost();
      if (G.B.t <= 0) {
        G.B.z = 0; G.B.x = G.B.tx; G.B.y = G.B.ty;
        if (Math.hypot(G.B.tgt.x - G.B.x, G.B.tgt.y - G.B.y) < 46 - DG && hurtPlayer(G.B.tgt, 32, G.B.x, G.B.y)) hitSpark(G.B.tgt.x, G.B.tgt.y - 8, true, Math.atan2(G.B.tgt.y - G.B.y, G.B.tgt.x - G.B.x));
        quakeFx(G.B.x, G.B.y, 54, true); G.fx.push({ k:'warp', x:G.B.x, y:G.B.y, r0:6, r1:56, th:6, t:0, d:.4, col:'#ff3b3b' });
        sfx.boom(); shake(7, .35); G.hitStop = Math.max(G.hitStop, .08);
        G.B.state = 'idle'; G.B.t = 1.0;                                      // 落地後有一段破綻
      }
      break; }
    case 'clawWind':                                                  // 月牙狼爪：扇形三道紅色爪擊飛出去
      G.B.t -= dt; if (G.B.t > .2) { G.B.aim = Math.atan2(dy, dx); G.B.flip = dx < 0; }
      if (G.B.t <= 0) {
        for (const da of [-.38, 0, .38]) { const a = G.B.aim + da;
          G.projs.push({ x:G.B.x + Math.cos(a) * 16, y:G.B.y - 8 + Math.sin(a) * 16, vx:Math.cos(a) * 230, vy:Math.sin(a) * 230, r:7, life:1.1, dmg:18, owner:'e', kind:'claw', R:15, th:6, cols:BOSSC }); }
        G.fx.push({ k:'smear', x:G.B.x, y:G.B.y - 8, a0:G.B.aim - 1.3, a1:G.B.aim + 1.3, r:30, w:10, sw:.08, hold:.14, delay:0, t:0, d:.22, cols:BOSSC, sy:.8 });
        sfx.swing(); shake(2, .1); G.B.state = 'idle'; G.B.t = rr(.6, .9);
      }
      break;
    case 'howlWind':                                                  // 嚎叫：三圈紅色震波 + 紅色閃光 + 從暗影傳送門叫出小狼
      G.B.t -= dt;
      if (G.B.t <= 0) {
        sfx.howl(); shake(6, .5); G.fx.push({ k:'flash', col:'#ff2a2a', a:.22, t:0, d:.35 });
        for (const dl of [0, .08, .16]) G.fx.push({ k:'warp', x:G.B.x, y:G.B.y - 4, r0:10, r1:84, th:6, sy:.7, delay:dl, t:0, d:.45 + dl, col:'#ff6a5a' });
        for (let i = 0; i < 16; i++) { const a = rr(0, TAU), sp = rr(60, 130); G.parts.push({ x:G.B.x + Math.cos(a) * 10, y:G.B.y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp * .5 - 30, life:rr(.4, .7), max:.7, col:pick(['#5a5468', '#7a7488', '#a8a2b8']), s:1, g:200 }); }
        if (d < 80 - DG && hurtPlayer(G.B.tgt, 16, G.B.x, G.B.y)) hitSpark(G.B.tgt.x, G.B.tgt.y - 8, false, Math.atan2(dy, dx));
        const adds = G.enemies.filter(e => !e.sp).length;
        for (let i = 0; i < Math.min(2, 4 - adds); i++) {
          const a = rr(0, TAU), x = BOSS_HOME.x + Math.cos(a) * 60, y = BOSS_HOME.y + 30 + Math.sin(a) * 30;
          const w = makeEnemy('wolf', 5, x, y, null); w.state = 'chase'; w.hx = BOSS_HOME.x; w.hy = BOSS_HOME.y + 20;
          if (!collides(x, y, w.r)) { G.enemies.push(w);
            G.fx.push({ k:'warp', x, y, r0:16, r1:3, th:4, t:0, d:.35, col:'#3a2a5a' }); G.fx.push({ k:'warp', x, y, r0:2, r1:14, th:2, delay:.2, t:0, d:.5, col:'#9a7cff' });
            for (let k = 0; k < 10; k++) G.parts.push({ x:x + rr(-8, 8), y:y - rr(0, 6), vx:rr(-10, 10), vy:-rr(15, 40), life:rr(.4, .8), max:.8, col:pick(['#2a1e3a', '#3a2a5a', '#5a4a7a']), s:2, drag:1 }); }
        }
        G.B.howlT = 16; G.B.state = 'idle'; G.B.t = .8;
      }
      break;
  }
}
export function openDoor() {
  for (const x of DOOR) { map[ARENA.y1 * MW + x] = RFLOOR; const i = ARENA.y1 * MW + x; if (explored[i]) miniPix(i); }
  invalidate(DOOR[1], ARENA.y1);
}
export function bossDie(by) {                                          // by = 打死狼王的玩家
  G.bossDead = true; G.fogLocked = false; $('bossBar').hidden = true;
  openDoor();
  G.enemies = G.enemies.filter(e => e.sp);
  burst(G.B.x, G.B.y - 10, 40, '#4a4d63', 110);                           // 死亡：停頓 + 白光 + 魂光柱 + 擴散光圈
  G.hitStop = Math.max(G.hitStop, .4); G.fx.push({ k:'flash', col:'#ffffff', a:.7, t:0, d:.6 });
  for (const dl of [0, .12, .24]) G.fx.push({ k:'warp', x:G.B.x, y:G.B.y, r0:6, r1:90, th:5, delay:dl, t:0, d:.6 + dl, col:dl ? '#f2c14e' : '#b49cff' });
  for (let i = 0; i < 40; i++) G.parts.push({ x:G.B.x + rr(-10, 10), y:G.B.y - rr(0, 20), vx:rr(-15, 15), vy:-rr(40, 140), life:rr(.7, 1.4), max:1.4, col:pick(['#b49cff', '#e8dcff', '#f2c14e', '#ffffff']), star:rr(1, 3), drag:1 });
  dropSouls(G.B.x, G.B.y, 600, by);
  dropItem(bossWeapon(), G.B.x, G.B.y); dropGold(G.B.x, G.B.y, 400);
  G.potMax += 1; by.pot = G.potMax;
  sfx.win(); shake(8, .8);
  showBanner('強敵已擊敗', '掉落：狼牙雙刃 · 藥水上限 +1', 3200);
  G.B = null; save();
}

