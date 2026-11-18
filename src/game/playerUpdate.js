import { G } from '../core/state.js';
import { TAU, dist, pick, rr } from '../core/util.js';
import { LH, LW } from '../core/canvas.js';
import { CAMPS, MW, REGIONS, ROAD, SUBS, TS, discovered, map } from '../world/map.js';
import { resetRegionBosses } from '../world/regionBoss.js';
import { cam, held, input, keys, pressed } from './player.js';
import { collides, moveEnt, regAt } from './collision.js';
import { sfx } from '../core/audio.js';
import { respawnAll } from './enemies.js';
import { resetBoss } from './boss.js';
import { blinkFx, busy, damageEnemy, releaseCharge, stopCharge, targets, tryAttack, tryDodge, tryPot, trySkill, updFlip, updateCharge } from './combat.js';
import { burst, shake } from './worldUpdate.js';
import { STARC } from '../render/fx.js';
import { hideBanner, showArea, toast } from '../ui/hud.js';
import { save } from './save.js';

/* ================= PLAYER UPDATE ================= */
export function updatePlayer(dt) {
  if (G.P.dead) { G.deathT += dt; if (G.deathT > 2.6) respawn(); return; }
  for (const k of ['atkCd','skillCd','iframe','hurt','aimLock','spin','thrust','slam','comboT','blinkIn']) if (G.P[k] > 0) G.P[k] -= dt;
  if (G.P.lunge) { G.P.lunge.t -= dt; moveEnt(G.P, G.P.lunge.vx * dt, G.P.lunge.vy * dt); G.ghosts.push({ x:G.P.x, y:G.P.y, flip:G.P.flip, life:.2, max:.2 }); if (G.P.lunge.t <= 0) G.P.lunge = null; }
  if (G.P.skillLock > 0) G.P.skillLock -= dt;
  for (let i = G.P.timers.length - 1; i >= 0; i--) { const tm = G.P.timers[i]; tm.t -= dt; if (tm.t <= 0) { G.P.timers.splice(i, 1); tm.fn(); } }
  if (G.P.stDelay > 0) G.P.stDelay -= dt; else G.P.st = Math.min(G.P.maxSt, G.P.st + (G.P.drink > 0 ? 15 : 48) * dt);
  if (G.P.swing) { const s = G.P.swing; s.t += dt; if (s.t >= s.d) { if (s.anim) { const g = s.f + s.r1 * s.sd; G.P.wFrom = s.ranged ? g : Math.atan2(Math.sin(g) * s.sy, Math.cos(g)); G.P.wRec = G.P.wRecD = s.back; G.P.wTy = s.ty; } G.P.swing = null; } }
  if (G.P.wRec > 0) G.P.wRec -= dt;
  if (Math.abs(G.P.kx) + Math.abs(G.P.ky) > 2) { moveEnt(G.P, G.P.kx * dt, G.P.ky * dt); const k = Math.pow(0.001, dt); G.P.kx *= k; G.P.ky *= k; } else G.P.kx = G.P.ky = 0;
  if (G.P.drink > 0) { G.P.drink -= dt; if (G.P.drink <= 0) { const h = Math.round(G.P.maxHp * .5); G.P.hp = Math.min(G.P.maxHp, G.P.hp + h);
    G.nums.push({ x:G.P.x, y:G.P.y - 28, txt:'+' + h, col:'#7dff8a', t:0, d:.8 }); burst(G.P.x, G.P.y - 6, 12, '#7dff8a', 40); } }
  const m = Math.hypot(input.mx, input.my);
  if (G.P.dash) {
    G.P.dash.t -= dt; moveEnt(G.P, G.P.dash.vx * dt, G.P.dash.vy * dt);
    const D = G.P.dash, back = G.P.face + Math.PI;
    D.streak.x1 = G.P.x; D.streak.y1 = G.P.y - 8; D.streak.t = 0;             // 光帶跟著人走，衝完才淡出
    G.ghosts.push({ x:G.P.x, y:G.P.y, flip:G.P.flip, life:.28, max:.28 });       // 每幀留一個殘影
    G.fx.push({ k:'aline', x:G.P.x + rr(-6, 6), y:G.P.y - 8 + rr(-9, 9), a:back, len:rr(12, 26), t:0, d:.14, col:'#ffffff' }); // 細速度線
    for (let i = 0; i < 2; i++) { const a = back + rr(-.6, .6), s = rr(20, 70);                                       // 一路灑下的星屑
      G.parts.push({ x:G.P.x + rr(-5, 5), y:G.P.y - rr(2, 16), vx:Math.cos(a) * s, vy:Math.sin(a) * s + 10, life:rr(.3, .55), max:.55, col:pick(STARC), star:rr(.8, 2.4), drag:3 }); }
    for (const e of targets()) if (!D.hit.has(e) && Math.hypot(e.x - G.P.x, e.y - G.P.y) < e.r + G.P.r + 8) { D.hit.add(e); damageEnemy(e, 2.5, G.P.x, G.P.y);
      // 命中：兩道交叉的新月斬痕 + 炸開的星光 + 一下重震
      G.fx.push({ k:'cres', x:e.x, y:e.y - 7, a:G.P.face - Math.PI / 2 + .55, r:15, t:0, d:.24 });
      G.fx.push({ k:'cres', x:e.x, y:e.y - 7, a:G.P.face + Math.PI / 2 - .55, r:15, t:0, d:.24, late:.04 });
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + rr(-.2, .2), s = rr(70, 140);
        G.parts.push({ x:e.x, y:e.y - 7, vx:Math.cos(a) * s, vy:Math.sin(a) * s, life:rr(.25, .45), max:.45, col:pick(STARC), star:rr(1.5, 3.2), drag:6 }); }
      shake(3, .12); }
    if (D.t <= 0) {
      G.P.dash = null;
      G.fx.push({ k:'rune', x:G.P.x, y:G.P.y, r:11, t:0, d:.35, rot:rr(0, TAU) });   // 落地：小魔法陣 + 一圈星光
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, s = rr(40, 70);
        G.parts.push({ x:G.P.x, y:G.P.y - 4, vx:Math.cos(a) * s, vy:Math.sin(a) * s * .5, life:.35, max:.35, col:pick(STARC), star:rr(1, 2), drag:5 }); }
    }
  } else if (G.P.dodge > 0) {
    G.P.dodge -= dt; const ox = G.P.x, oy = G.P.y; moveEnt(G.P, G.P.dvx * dt, G.P.dvy * dt);   // 隱身移動，只留下一道細光和星屑
    G.fx.push({ k:'aline', x:ox, y:oy - 8 + rr(-5, 5), a:Math.atan2(G.P.y - oy, G.P.x - ox), len:Math.hypot(G.P.x - ox, G.P.y - oy) + 4, t:0, d:.16, col:'#d8c8ff' });
    if (Math.random() < .7) G.parts.push({ x:G.P.x + rr(-4, 4), y:G.P.y - rr(2, 16), vx:rr(-15, 15), vy:rr(-20, 0), life:rr(.25, .45), max:.45, col:pick(STARC), star:rr(.6, 1.8), drag:3 });
    if (G.P.dodge <= 0) { blinkFx(G.P.x, G.P.y, false); sfx.blinkIn(); }
  } else if (m > .05) {
    const spd = 84 * (G.P.drink > 0 ? .45 : 1) * (G.P.skillLock > 0 ? .25 : 1) * (G.P.swing ? .6 : 1) * (G.P.charging ? .45 : 1) * (map[(G.P.y / TS | 0) * MW + (G.P.x / TS | 0)] === ROAD ? 1.12 : 1);
    moveEnt(G.P, input.mx * spd * dt, input.my * spd * dt);
    if (G.P.aimLock <= 0) { G.P.face = Math.atan2(input.my, input.mx); updFlip(); }
  }
  G.P.moving = m > .05 && !G.P.dodge;
  if (G.P.moving) G.P.anim += dt;

  const atkDown = held.atk || keys.atk;                               // 點一下 = 普通攻擊；按住 = 蓄力，放開放招
  if (G.P.atkBuf > 0) { G.P.atkBuf -= dt; if (tryAttack()) G.P.atkBuf = 0; }      // 連點太快時先記住，冷卻一好就出手
  if (pressed.atk) { if (!tryAttack()) G.P.atkBuf = .25; G.P.chargeArm = true; G.P.chargeHold = 0; G.P.charging = false; G.P.charge = 0; G.P.chargeLv = 0; }
  if (G.P.chargeArm) {
    if (!atkDown || G.P.dead) { if (G.P.charging && G.P.chargeLv > 0) releaseCharge(G.P.chargeLv); stopCharge(); }
    else if (G.P.charging) { if (G.P.dodge > 0 || G.P.drink > 0 || G.P.dash) stopCharge(); else updateCharge(dt); }
    else { G.P.chargeHold += dt; if (G.P.chargeHold > .22 && !busy() && G.P.st > 0) { G.P.charging = true; G.P.charge = 0; G.P.chargeLv = 0; } }
  }
  if (pressed.dodge) tryDodge();
  if (pressed.skill) trySkill();
  if (pressed.pot) tryPot();

  if (G.lost && Math.hypot(G.lost.x - G.P.x, G.lost.y - G.P.y) < 14) {
    G.P.souls += G.lost.amount; toast('取回了 ' + G.lost.amount + ' 魂晶', '#b49cff'); burst(G.lost.x, G.lost.y - 4, 20, '#b49cff', 60); sfx.pick(); G.lost = null;
  }
  for (const c of CAMPS) if (!c.lit && Math.abs(c.x - G.P.x) < 48 && Math.hypot(c.x - G.P.x, c.y - G.P.y) < 48) {
    c.lit = true; toast('點燃了「' + c.name + '」，可以在這裡休息和傳送', '#f2c14e'); burst(c.x, c.y - 4, 20, '#f2c14e', 60); sfx.level(); save();
  }
  const rg = REGIONS[regAt(G.P.x, G.P.y)].key;
  const tx = G.P.x / TS, ty = G.P.y / TS; let sb = '';
  for (const s of SUBS) if (Math.abs(s.x - tx) < s.r && Math.hypot(s.x - tx, s.y - ty) < s.r) { sb = s.name; break; }
  if (rg !== G.region) { G.region = rg; G.sub = sb; showArea(REGIONS.find(r => r.key === rg).name, REGIONS.find(r => r.key === rg).sub); }
  else if (sb !== G.sub) { G.sub = sb; if (sb) { const first = !discovered.has(sb); discovered.add(sb); showArea(sb, first ? '發現新地點' : REGIONS.find(r => r.key === rg).name); if (first) sfx.discover(); } }
}
export function nearCamp() {
  if (G.P.dead) return null;
  for (const c of CAMPS) if (c.lit && Math.abs(c.x - G.P.x) < 30 && Math.hypot(c.x - G.P.x, c.y - G.P.y) < 30) {
    if (G.enemies.some(e => e.state !== 'idle' && e.state !== 'return' && Math.abs(e.x - G.P.x) < 140 && dist(e, G.P) < 140)) return null;
    return c;
  }
  return null;
}
export function restoreWorld() {
  G.P.hp = G.P.maxHp; G.P.st = G.P.maxSt; G.P.pot = G.potMax; G.P.timers = []; G.P.dash = null; G.P.dodge = 0;
  G.projs = []; G.drops = G.drops.filter(d => d.item.rarity >= 2); respawnAll(); resetBoss(); resetRegionBosses();
}
export function placeAtCamp(id) {
  const c = CAMPS.find(c => c.id === id) || CAMPS[0];
  G.P.x = c.x; G.P.y = c.y + 16;
  if (collides(G.P.x, G.P.y, G.P.r)) G.P.y = c.y - 16;
  cam.x = G.P.x - LW / 2; cam.y = G.P.y - LH / 2;
}
function respawn() {
  G.lost = G.P.souls > 0 ? { x:G.P.x, y:G.P.y, amount:G.P.souls } : null;
  G.P.souls = 0; G.P.dead = false; G.P.kx = G.P.ky = 0;
  placeAtCamp(G.lastCamp); restoreWorld(); save();
  G.region = ''; hideBanner();
}

