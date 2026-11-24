import { tier } from '../data/levels';
import { G } from '../core/state';
import { TAU, dist, rr } from '../core/util';
import { BEH, DG, KIND, randomLoot } from '../data/items';
import { spawns } from '../world/map';
import { canSee, moveEnt, stepToward } from './collision';
import { sfx } from '../core/audio';
import { hurtPlayer } from './combat';
import { nearestPlayer } from './player';
import { burst, dropGold, dropMat, dropPot, dropSouls, killFx, quakeFx, shake } from './worldUpdate';
import { oreForLevel } from '../data/forge';
import { mobFx } from '../data/ailments';
import { soft } from '../data/attrs';
import { showBanner, toast } from '../ui/hud';
import { flags } from './quest';
import { save } from './save';
import type { Enemy } from '../types';
import { mimicDown, resetMimics } from '../world/chests';

/* ================= ENEMIES ================= */
export function makeEnemy(kind: string, lv: number, x: number, y: number, sp?): Enemy {
  const K = KIND[kind], D = BEH[K.beh], el = sp && sp.elite;
  const hp = Math.round(D.hp(lv) * (el ? 4 : 1));
  const e: Enemy = { kind, beh:K.beh, lv, sp, x, y, hx: x, hy: y, r: D.r + (el ? 1 : 0), hp, maxHp: hp, dmg: Math.round(D.dmg(lv) * (el ? 1.35 : 1)), spd: D.spd * (el ? 1.1 : 1),
    state:'idle', t: rr(0, 2), flip: Math.random() < .5, flash:0, kx:0, ky:0, stun:0, atkCd:0, anim: Math.random() * 10,
    wx: x, wy: y, aim:0, leash: sp ? (el ? 300 : 230) : 600, aggro: D.aggro + (el ? 30 : 0), see: D.see + (el ? 15 : 0), elite: !!el, ename: sp && sp.ename, announced:false,
    hc: { lv, fx: mobFx(kind, !!el), src: null } };                    // 打中你時：異常狀態（data/ailments.ts）；src = 自己（反傷用）
  e.hc.src = e; return e;
}
export function respawnAll() {
  G.enemies = []; resetMimics();
  for (const sp of spawns) { sp.ent = null; if (sp.once && flags.has(sp.once)) { sp.alive = false; sp.timer = Infinity; continue; }   // 地城守護者：打倒過就不再出現
    sp.alive = true; sp.timer = 0; sp.hp = 0; }                     // sp.hp = 0：血量清掉，下次出現是滿血（只有坐營火 / 死掉才會這樣）
  streamSpawns();
}
/* 只在玩家附近生成怪物：世界上有兩千多個生成點，全部都放出來太浪費。
   活著的生成點（sp.alive）走進玩家周圍一圈才真的變成怪物（sp.ent），離得很遠就收起來（下次走近會在原位重新出現，血也是滿的）。
   被打倒的還是照舊：sp.alive = false，等計時器到了、而且玩家不在旁邊才復活。 */
const ACT_X = 600, ACT_Y = 440, OFF_X = 900, OFF_Y = 680;
export function streamSpawns() {
  let drop = false;
  for (const sp of spawns) {
    if (!sp.alive || (sp.once && flags.has(sp.once))) continue;         // 打倒過的精英怪 / 守護者：讀檔後也不會再出現
    let nearX = Infinity, nearY = Infinity; for (const pl of G.players) { const dx = Math.abs(sp.x - pl.x), dy = Math.abs(sp.y - pl.y); if (dx + dy < nearX + nearY) { nearX = dx; nearY = dy; } }
    if (!sp.ent) { if (nearX < ACT_X && nearY < ACT_Y) { sp.ent = makeEnemy(sp.kind, sp.lv, sp.x, sp.y, sp); if (sp.hp) sp.ent.hp = Math.min(sp.hp, sp.ent.maxHp); G.enemies.push(sp.ent); } }   // 被打過的怪重新出現時，血還是剩那樣
    else if (sp.ent.dead) sp.ent = null;
    else if (nearX > OFF_X || nearY > OFF_Y) { sp.hp = sp.ent.hp < sp.ent.maxHp ? sp.ent.hp : 0; sp.ent.gone = true; sp.ent = null; drop = true; }   // 收起來前記住剩多少血
  }
  if (drop) G.enemies = G.enemies.filter(e => !e.gone);
}
/* 石像魔、樹精的砸地：落點在面前一小段距離，範圍是一個圓（跟「雙手舉高往下砸」的動作一致） */
/* 骷髏的揮劍：面前一個扇形（跟劍劈出去的長度一致） */
export function bladeArc(e) { return { R: e.r + (e.elite ? 17 : 14), half: 1.05 }; }
export function slamSpot(e) { const off = e.r + (e.elite ? 15 : 12), R = e.elite ? 23 : 19;
  return { x: e.x + Math.cos(e.aim) * off, y: e.y + Math.sin(e.aim) * off, R }; }
function startWindup(e, t) { e.state = 'windup'; e.t = e.wt = t; e.aim = Math.atan2(e.tgt.y - e.y, e.tgt.x - e.x); }
function doEnemyAttack(e) {
  const D = BEH[e.beh];
  if (e.beh === 'slime' || e.beh === 'lunge') {
    const sp = e.beh === 'slime' ? 140 : 250; e.state = 'lunge'; e.t = e.beh === 'slime' ? .2 : .3;
    e.lvx = Math.cos(e.aim) * sp; e.lvy = Math.sin(e.aim) * sp; e.hitDone = false;
  } else if (e.beh === 'blade') {                                      // 往前踏一小步 + 揮劍（打中扇形裡的玩家）
    e.state = 'slash'; e.t = .16; e.lvx = Math.cos(e.aim) * 70; e.lvy = Math.sin(e.aim) * 70; e.hitDone = false; sfx.swing();
  } else if (e.beh === 'heavy') {
    const S = slamSpot(e);
    for (const pl of G.players) if (!pl.dead && dist(S, pl) <= S.R + pl.r - DG) hurtPlayer(pl, e.dmg, S.x, S.y);   // 圓裡的玩家都會被砸到
    quakeFx(S.x, S.y, S.R + 4); burst(S.x, S.y - 2, 14, KIND[e.kind].col, 70);
    e.state = 'recover'; e.t = .9; shake(3.5, .2);
  } else if (e.beh === 'ranged') {
    const n = e.elite ? 3 : 1;
    for (let k = 0; k < n; k++) { const a = e.aim + (k - (n - 1) / 2) * .25; G.projs.push({ x:e.x, y:e.y - 6, vx:Math.cos(a) * 95, vy:Math.sin(a) * 95, r:3, life:2.2, dmg:e.dmg, owner:'e', kind:KIND[e.kind].proj || 'spore' }); }
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
      if (e.t <= 0) { e.t = rr(1.5, 3.5); const a = rr(0, TAU), r = rr(8, 24); e.wx = e.hx + Math.cos(a) * r; e.wy = e.hy + Math.sin(a) * r; }   // 只在家附近晃，不會晃到路上
      stepToward(e, e.wx, e.wy, e.spd * .35, dt);
      if (!e.tgt.dead && d < e.see && canSee(e.x, e.y - 6, e.tgt.x, e.tgt.y - 6)) { e.state = 'chase'; e.blind = 0; G.nums.push({ x:e.x, y:e.y - 20, txt:'!', col:'#ffd04a', t:0, d:.6 });
        if (e.elite && !e.announced) { e.announced = true; toast('精英敵人：' + e.ename, ELITE_C); } }
      break;
    case 'chase':
      e.blind = canSee(e.x, e.y - 6, e.tgt.x, e.tgt.y - 6) ? 0 : (e.blind || 0) + dt;   // 被牆擋住看不到你超過 2 秒 → 放棄，走回家
      e.lost = d > e.aggro * 1.5 ? (e.lost || 0) + dt : 0;              // 你跑到察覺範圍 1.5 倍以外超過 1.2 秒 → 也放棄（史萊姆 = 120 以外；走路大約 2 秒就甩掉）
      if (e.tgt.dead || homeD > e.leash || e.blind > 2 || e.lost > 1.2) {
        if (!e.tgt.dead) G.nums.push({ x:e.x, y:e.y - 20, txt:'?', col:'#c8c0d8', t:0, d:.8 });   // 頭上冒「?」：跟發現你的「!」對應，讓你知道甩掉了
        e.state = 'return'; e.t = 0; e.lost = 0; break; }
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
    case 'slash': {
      e.t -= dt; moveEnt(e, e.lvx * dt, e.lvy * dt);
      if (!e.hitDone) { const A = bladeArc(e);
        for (const pl of G.players) { if (pl.dead) continue; const da = Math.abs(((Math.atan2(pl.y - e.y, pl.x - e.x) - e.aim) % TAU + TAU * 1.5) % TAU - Math.PI);
          if (dist(e, pl) <= A.R + pl.r - DG && da <= A.half) { hurtPlayer(pl, e.dmg, e.x, e.y); e.hitDone = true; } } }
      if (e.t <= 0) { e.state = 'recover'; e.t = rr(.55, .8); }
      break; }
    case 'recover':
      e.t -= dt; if (e.t <= 0) e.state = 'chase'; break;
    case 'return':
      e.t += dt; stepToward(e, e.hx, e.hy, e.spd * 1.3, dt);           // 走回家不回血：要等玩家坐營火（respawnAll）才會補滿
      if (homeD < 6 || e.t > 6) { if (e.t > 6) { e.x = e.hx; e.y = e.hy; } e.state = 'idle'; e.t = 1; }
      break;
  }
}
export const ELITE_C = '#ff5a5a';                                   // 精英怪的顏色（外框、血條、名字）
const MOB_PAY = .7;                                                  // 一般小怪給的金幣打 7 折（精英怪不變）
export const MOB_SOULS = .5, ELITE_SOULS = 3;                       // 魂晶：一般小怪 ×0.5、精英怪 ×3（以前 ×1 / ×5：清一半就超前 10～25 級，見 game/player.ts 的 lvCost）
export function killEnemy(e, by) {                                     // by = 打死它的玩家
  const i = G.enemies.indexOf(e); if (i >= 0) G.enemies.splice(i, 1);
  if (e.sp) { e.sp.alive = false; e.sp.ent = null; e.sp.hp = 0; e.sp.timer = e.elite ? Infinity : 45; }
  if (e.chest) mimicDown(e);
  const D = BEH[e.beh], s = Math.round(D.souls(e.lv) * (e.sp ? 1 : .3) * (e.elite ? ELITE_SOULS : MOB_SOULS) * (e.soulMul || 1));   // soulMul = 噬魂刻印
  dropSouls(e.x, e.y, s, by);
  burst(e.x, e.y - 5, e.elite ? 30 : 14, KIND[e.kind].col, 70); killFx(e);
  sfx.kill();
  dropGold(e.x, e.y, Math.round((3 + tier(e.lv) * 1.6) * rr(.7, 1.3) * (e.elite ? 8 : MOB_PAY) * (e.sp ? 1 : .3)));
  /* 掉落：小怪主要給魂晶、礦石、藥水；武器很少（主要從地城、Boss、寶箱拿） */
  if (e.sp || e.elite) { const luk = by ? soft(by.luk) : 0, n = e.elite ? 2 + (Math.random() < .5 ? 1 : 0) : Math.random() < .25 + .008 * luk ? 1 : 0;   // 強化素材：這個地區的素材（幸運越高越常掉）
    if (n) dropMat(e.x, e.y, oreForLevel(e.lv), n, by);
    if (e.elite && Math.random() < .25) dropMat(e.x, e.y, 'umat', 1, by); }   // 精英怪：25% 掉一顆黯星石（獨特武器強化）。以前 4%，但那時候坐營火就會復活、可以一直刷
  if (by && by.pot < G.potMax && Math.random() < (e.elite ? .6 : e.sp ? .07 : 0)) dropPot(e.x, e.y, by);                          // 藥水：只有喝過才會掉（補一瓶）
  if (e.sp && e.sp.once && !flags.has(e.sp.once)) { flags.add(e.sp.once);
    if (e.sp.once.startsWith('elite:')) save();                         // 野外的精英怪：記下來，以後不會再出現
    else { showBanner('守護者倒下了', e.ename + ' · 最深處的寶箱解開了封印', 2800); dropMat(e.x, e.y, oreForLevel(e.lv), 2, by); save(); } }
  if (e.elite) { toast('擊敗了 ' + e.ename, ELITE_C); const q = Math.random();   // 精英怪只打得到一次 → 一定掉一件裝備（30% 武器），三成是稀有的
    dropItem(randomLoot(e.lv, Math.random() < .3 ? 3 : 2, q < .3 ? 'weapon' : 'gear'), e.x, e.y); }
  else if (e.sp) { const q = Math.random(), r = Math.random(), rarity = r < .03 ? 3 : r < .13 ? 2 : r < .4 ? 1 : 0;
    if (q < .015) dropItem(randomLoot(e.lv, rarity, 'weapon'), e.x, e.y); else if (q < .04) dropItem(randomLoot(e.lv, rarity, 'gear'), e.x, e.y); }
}
export function dropItem(item, x, y) {
  G.drops.push({ x, y, z:2, vz:80, vx:rr(-25, 25), vy:rr(-25, 25), item, t:0, warned:false });
  if (item.rarity >= 3) sfx.epic();
}

