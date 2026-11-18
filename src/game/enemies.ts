import { G } from '../core/state';
import { TAU, dist, rr } from '../core/util';
import { BEH, DG, KIND, randomLoot } from '../data/items';
import { spawns } from '../world/map';
import { moveEnt, stepToward } from './collision';
import { sfx } from '../core/audio';
import { hurtPlayer } from './combat';
import { nearestPlayer } from './player';
import { burst, dropGold, dropSouls, killFx, quakeFx, shake } from './worldUpdate';
import { toast } from '../ui/hud';
import type { Enemy } from '../types';

/* ================= ENEMIES ================= */
export function makeEnemy(kind: string, lv: number, x: number, y: number, sp?): Enemy {
  const K = KIND[kind], D = BEH[K.beh], el = sp && sp.elite;
  const hp = Math.round(D.hp(lv) * (el ? 4 : 1));
  return { kind, beh:K.beh, lv, sp, x, y, hx: x, hy: y, r: D.r + (el ? 1 : 0), hp, maxHp: hp, dmg: Math.round(D.dmg(lv) * (el ? 1.35 : 1)), spd: D.spd * (el ? 1.1 : 1),
    state:'idle', t: rr(0, 2), flip: Math.random() < .5, flash:0, kx:0, ky:0, stun:0, atkCd:0, anim: Math.random() * 10,
    wx: x, wy: y, aim:0, leash: sp ? (el ? 300 : 230) : 600, aggro: D.aggro + (el ? 30 : 0), elite: !!el, ename: sp && sp.ename, announced:false };
}
export function respawnAll() {
  G.enemies = [];
  for (const sp of spawns) { sp.alive = true; sp.timer = 0; G.enemies.push(makeEnemy(sp.kind, sp.lv, sp.x, sp.y, sp)); }
}
/* 石像魔、樹精的砸地：落點在面前一小段距離，範圍是一個圓（跟「雙手舉高往下砸」的動作一致） */
export function slamSpot(e) { const off = e.r + (e.elite ? 15 : 12), R = e.elite ? 23 : 19;
  return { x: e.x + Math.cos(e.aim) * off, y: e.y + Math.sin(e.aim) * off, R }; }
function startWindup(e, t) { e.state = 'windup'; e.t = e.wt = t; e.aim = Math.atan2(e.tgt.y - e.y, e.tgt.x - e.x); }
function doEnemyAttack(e) {
  const D = BEH[e.beh];
  if (e.beh === 'slime' || e.beh === 'lunge') {
    const sp = e.beh === 'slime' ? 140 : 250; e.state = 'lunge'; e.t = e.beh === 'slime' ? .2 : .3;
    e.lvx = Math.cos(e.aim) * sp; e.lvy = Math.sin(e.aim) * sp; e.hitDone = false;
  } else if (e.beh === 'heavy') {
    const S = slamSpot(e);
    for (const pl of G.players) if (!pl.dead && dist(S, pl) <= S.R + pl.r - DG) hurtPlayer(pl, e.dmg, S.x, S.y);   // 圓裡的玩家都會被砸到
    quakeFx(S.x, S.y, S.R + 4); burst(S.x, S.y - 2, 14, KIND[e.kind].col, 70);
    e.state = 'recover'; e.t = .9; shake(3.5, .2);
  } else if (e.beh === 'ranged') {
    const n = e.elite ? 3 : 1;
    for (let k = 0; k < n; k++) { const a = e.aim + (k - (n - 1) / 2) * .25; G.projs.push({ x:e.x, y:e.y - 6, vx:Math.cos(a) * 95, vy:Math.sin(a) * 95, r:3, life:2.2, dmg:e.dmg, owner:'e', kind:'spore' }); }
    e.state = 'recover'; e.t = .4;
  }
  e.atkCd = D.cd * (e.elite ? .8 : 1);
}
export function updateEnemy(e, dt) {
  e.anim += dt; if (e.flash > 0) e.flash -= dt;
  if (Math.abs(e.kx) + Math.abs(e.ky) > 2) { moveEnt(e, e.kx * dt, e.ky * dt); const k = Math.pow(0.002, dt); e.kx *= k; e.ky *= k; } else { e.kx = e.ky = 0; }
  if (e.stun > 0) { e.stun -= dt; return; }
  e.tgt = nearestPlayer(e.x, e.y);                                   // 每幀選最近的玩家當目標
  const D = BEH[e.beh], dx = e.tgt.x - e.x, dy = e.tgt.y - e.y, d = Math.hypot(dx, dy), homeD = Math.hypot(e.x - e.hx, e.y - e.hy);
  e.atkCd -= dt;
  switch (e.state) {
    case 'idle':
      e.t -= dt;
      if (e.t <= 0) { e.t = rr(1.5, 3.5); const a = rr(0, TAU), r = rr(8, 40); e.wx = e.hx + Math.cos(a) * r; e.wy = e.hy + Math.sin(a) * r; }
      stepToward(e, e.wx, e.wy, e.spd * .35, dt);
      if (!e.tgt.dead && d < e.aggro) { e.state = 'chase'; G.nums.push({ x:e.x, y:e.y - 20, txt:'!', col:'#ffd04a', t:0, d:.6 });
        if (e.elite && !e.announced) { e.announced = true; toast('精英敵人：' + e.ename + '（Lv ' + e.lv + '）', '#f2c14e'); } }
      break;
    case 'chase':
      if (e.tgt.dead || homeD > e.leash) { e.state = 'return'; e.t = 0; break; }
      if (e.beh === 'ranged') {
        if (d < 55) { stepToward(e, e.x - dx, e.y - dy, e.spd, dt); e.flip = dx < 0; }
        else if (d > 115) stepToward(e, e.tgt.x, e.tgt.y, e.spd, dt);
        if (e.atkCd <= 0 && d < 150) startWindup(e, D.wind);
      } else {
        if (d > D.reach * .8) stepToward(e, e.tgt.x, e.tgt.y, e.spd, dt);
        e.flip = dx < 0;
        if (d <= D.reach + (e.elite ? 4 : 0) && e.atkCd <= 0) startWindup(e, D.wind * (e.elite ? .85 : 1));
      }
      break;
    case 'windup':
      e.t -= dt; if (e.t <= 0) doEnemyAttack(e); break;
    case 'lunge':
      e.t -= dt; moveEnt(e, e.lvx * dt, e.lvy * dt);
      if (!e.hitDone && d < e.r + 4 - DG) { e.hitDone = true; hurtPlayer(e.tgt, e.dmg, e.x, e.y); }
      if (e.t <= 0) { e.state = 'recover'; e.t = rr(.5, .9); }
      break;
    case 'recover':
      e.t -= dt; if (e.t <= 0) e.state = 'chase'; break;
    case 'return':
      e.t += dt; stepToward(e, e.hx, e.hy, e.spd * 1.3, dt); e.hp = Math.min(e.maxHp, e.hp + e.maxHp * dt);
      if (homeD < 6 || e.t > 6) { if (e.t > 6) { e.x = e.hx; e.y = e.hy; } e.state = 'idle'; e.hp = e.maxHp; e.t = 1; }
      break;
  }
}
export function killEnemy(e, by) {                                     // by = 打死它的玩家
  const i = G.enemies.indexOf(e); if (i >= 0) G.enemies.splice(i, 1);
  if (e.sp) { e.sp.alive = false; e.sp.timer = e.elite ? Infinity : 45; }
  const D = BEH[e.beh], s = Math.round(D.souls(e.lv) * (e.sp ? 1 : .3) * (e.elite ? 5 : 1));
  dropSouls(e.x, e.y, s, by);
  burst(e.x, e.y - 5, e.elite ? 30 : 14, KIND[e.kind].col, 70); killFx(e);
  sfx.kill();
  dropGold(e.x, e.y, Math.round((3 + e.lv * 1.6) * rr(.7, 1.3) * (e.elite ? 8 : 1) * (e.sp ? 1 : .3)));
  if (e.elite) { toast('擊敗了 ' + e.ename, '#f2c14e'); const q = Math.random(); dropItem(randomLoot(e.lv, q < .35 ? 3 : 2), e.x, e.y); }
  else if (e.sp && Math.random() < D.drop) {
    const r = Math.random(); const rarity = r < .03 ? 3 : r < .13 ? 2 : r < .4 ? 1 : 0;
    dropItem(randomLoot(e.lv, rarity), e.x, e.y);
  }
}
export function dropItem(item, x, y) {
  G.drops.push({ x, y, z:2, vz:80, vx:rr(-25, 25), vy:rr(-25, 25), item, t:0, warned:false });
  if (item.rarity >= 3) sfx.epic();
}

