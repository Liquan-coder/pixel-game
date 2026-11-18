import { G } from '../core/state.js';
import { TAU, angDiff, pick, rr } from '../core/util.js';
import { ANIM, HAND_R, HSY, REACH, STYLE, WLEN } from '../art/hero.js';
import { BEH, RAR, WT } from '../data/items.js';
import { rbs, regionBossDie } from '../world/regionBoss.js';
import { input } from './player.js';
import { collides, moveEnt } from './collision.js';
import { sfx } from '../core/audio.js';
import { killEnemy } from './enemies.js';
import { bossDie } from './boss.js';
import { burst, hitSpark, quakeFx, shake } from './worldUpdate.js';
import { STARC } from '../render/fx.js';
import { showBanner, toast } from '../ui/hud.js';

/* ================= PLAYER COMBAT ================= */
export function targets() { const t = []; for (const e of G.enemies) if (Math.abs(e.x - G.P.x) < 300 && Math.abs(e.y - G.P.y) < 300) t.push(e); if (G.B && !G.bossDead && G.B.state !== 'sleep' && !(G.B.z > 8)) t.push(G.B);
  for (const e of rbs) if (!e.dead && e.state !== 'sleep' && e.state !== 'intro' && !(e.z > 8)) t.push(e); return t; }
function nearestTarget(maxD) { let best = null, bd = maxD; for (const e of targets()) { const d = Math.hypot(e.x - G.P.x, e.y - G.P.y) - e.r; if (d < bd) { bd = d; best = e; } } return best; }
function autoFace(maxD) { const t = nearestTarget(maxD); if (t) G.P.face = Math.atan2(t.y - G.P.y, t.x - G.P.x); G.P.aimLock = .3; updFlip(); }
export function updFlip() { const c = Math.cos(G.P.face); if (c < -.1) G.P.flip = true; else if (c > .1) G.P.flip = false; }
function spendSt(v) { G.P.st = Math.max(0, G.P.st - v); G.P.stDelay = .55; }
function calcDmg(mult) {
  let v = G.P.weapon.atk * (1 + 0.1 * (G.P.str - 1)) * mult * rr(.9, 1.1);
  const crit = Math.random() * 100 < G.P.crit; if (crit) v *= 1.8;
  return { v: Math.max(1, Math.round(v)), crit };
}
export function damageEnemy(e, mult, sx, sy, opts = {}) {
  if (e.hp <= 0) return;
  const { v, crit } = calcDmg(mult);
  e.hp -= v; e.flash = .1; e.hitT = .32; e.hitDir = Math.sign(e.x - sx) || 1;
  G.nums.push({ x:e.x + rr(-3, 3), y:e.y - (e.boss ? 26 : 16), txt:String(v), col: crit ? '#ffd84a' : '#ffffff', t:0, d:.7, big:crit });
  const a = Math.atan2(e.y - sy, e.x - sx);
  if (!e.boss && !e.elite && !BEH[e.beh].heavy) { e.kx = Math.cos(a) * 110; e.ky = Math.sin(a) * 110; }
  if (opts.stun && !e.boss) e.stun = e.elite ? opts.stun * .4 : opts.stun;
  if (!e.boss && (e.state === 'idle' || e.state === 'return')) e.state = 'chase';
  if (G.P.ls > 0) G.P.hp = Math.min(G.P.maxHp, G.P.hp + v * G.P.ls);
  hitSpark(e.x, e.y - 7, crit, a);
  if (opts.heavy) { G.hitStop = Math.max(G.hitStop, .055); shake(3, .1); }
  crit ? sfx.crit() : sfx.hit();
  if (crit) shake(2, .1);
  if (e.hp <= 0) { if (e.rb) regionBossDie(e); else if (e.boss) bossDie(); else killEnemy(e); }
}
function meleeHit(range, arcDeg, mult, opts) {
  const half = arcDeg / 2 * Math.PI / 180;
  for (const e of targets()) {
    const d = Math.hypot(e.x - G.P.x, e.y - G.P.y) - e.r;
    if (d > range) continue;
    if (arcDeg < 360 && d > 4 && angDiff(Math.atan2(e.y - G.P.y, e.x - G.P.x), G.P.face) > half) continue;
    damageEnemy(e, mult, G.P.x, G.P.y, opts);
  }
}
function lineHit(x, y, a, len, w, mult, opts) {                     // 直線範圍：長槍突刺用
  const c = Math.cos(a), s = Math.sin(a);
  for (const e of targets()) { const dx = e.x - x, dy = e.y - y, al = dx * c + dy * s;
    if (al < -e.r || al > len + e.r || Math.abs(dy * c - dx * s) > w + e.r) continue; damageEnemy(e, mult, x, y, opts); }
}
export function aoeHit(cx, cy, rad, mult, opts) {
  for (const e of targets()) if (Math.hypot(e.x - cx, e.y - cy) - e.r <= rad) damageEnemy(e, mult, cx, cy, opts);
}
export const busy = () => G.P.dodge > 0 || G.P.drink > 0 || G.P.skillLock > 0 || G.P.dash || G.P.dead;
/* ---- 普通攻擊：三段連擊，每一下留下新月刀光 ---- */
export const WFX = {                                                         // 外層光 / 中層 / 白芯
  sword: ['#4a6ae0', '#a8c0ff', '#ffffff'], dagger: ['#7a4ae0', '#d0b8ff', '#ffffff'], axe: ['#c8401e', '#ffb040', '#fff6d0'],
  spear: ['#2a8a9a', '#9af0ff', '#ffffff'], staff: ['#6a4ad0', '#b49cff', '#ffffff'], wolfblade: ['#3a2470', '#9a6cff', '#f0e0ff'] };
const SHADOWBLADE = ['#1a1030', '#6a4ad0', '#e0d0ff'];
export function wcols(type) { const c = WFX[type].slice(), r = G.P.weapon.rarity; if (r >= 3) c[0] = RAR[r].c; return c; }
function smearFx(a0, a1, r, w, sw, cols, hold = .12, delay = 0, sy = HSY) { G.fx.push({ k:'smear', follow:true, a0, a1, r, w, sw, hold, delay, t:0, d:delay + sw + hold, cols, sy }); }
function lanceFx(a, len, w, cols, d, follow) {
  G.fx.push({ k:'lance', follow:!!follow, x:G.P.x + Math.cos(a) * 6, y:G.P.y - 7 + Math.sin(a) * 6, a, len, w, t:0, d, cols });
  G.parts.push({ x:G.P.x + Math.cos(a) * (len + 6), y:G.P.y - 7 + Math.sin(a) * (len + 6), vx:Math.cos(a) * 40, vy:Math.sin(a) * 40, life:.25, max:.25, col:'#ffffff', star:3, drag:6 });
}
export function restAng() {                                                   // 架式（Ready）時武器的角度
  const W = WT[G.P.weapon.type], dir = G.P.flip ? -1 : 1, cf = Math.cos(G.P.face), sf = Math.sin(G.P.face);
  return W.ranged ? -Math.PI / 2 + .35 * dir : G.P.face - dir * (.9 * Math.abs(cf) + .25 * sf);   // 法杖直立在身旁；近戰武器斜舉在身前
}
function newSwing(type, A, fin, st, extra) {                            // 建一段攻擊動作；角度都存成「相對面向」，揮的方向才不會繞錯邊
  const sd = G.P.flip ? -1 : 1, F = fin ? 1.3 : 1, S = st ? STYLE[st] : A, k = st ? (A.lift || 0) / 5 : 1;
  let r0 = S.up, rs = S.from, r1 = S.to, lift = (S.lift || 0) * (st === 'slam' ? 1 : k);
  if (fin && st && st !== 'slam') { r0 *= 1.1; r1 *= 1.15; lift += 2 * Math.sign(lift); }
  let rR = ((restAng() - G.P.face) * sd) % TAU; if (rR > Math.PI) rR -= TAU; if (rR < -Math.PI) rR += TAU;
  const wu = A.wu * F * (st === 'slam' ? 1.2 : 1), sw = A.sw * F;
  return Object.assign({ t:0, wu, sw, d:wu + sw + A.hold, back:A.back, f:G.P.face, sd, rR, r0, rs, r1, lift, sy:S.sy || HSY, st, ty:type, fin, anim:true }, extra);
}
const QDAG = Object.assign({}, ANIM.dagger, { wu:.025, sw:.05, hold:.03 });   // 影步連斬用的快速版短刀動作
const DSEQ = ['diag', 'flat', 'rise', 'flatR'];                        // 斜劈 → 橫掃 → 上撩 → 反橫掃 … 最後一刀重劈
function swingSmear(s, type, cols, fin) {                               // 跟著角色的刀光（貼在刀身上）
  const th = { sword:9, dagger:6, axe:13, wolfblade:8 }[type] || 9, R = WT[type].range + (fin ? 6 : 2), tip = HAND_R + REACH + WLEN[type];
  const Rv = Math.min(R, tip + (fin ? 9 : 6)), wv = Math.max(th, Rv - (HAND_R + REACH + WLEN[type] * .45)), flat = s.sy < .6;
  smearFx(s.f + s.rs * s.sd, s.f + s.r1 * s.sd, flat ? Rv + 3 : Rv, wv * (flat ? 1.3 : 1), s.sw * .75, cols, .08, s.wu + s.sw * .25, s.sy);
}
export function tryAttack() {
  if (G.P.atkCd > 0 || busy() || G.P.st <= 0) return false;
  const type = G.P.weapon.type, W = WT[type], cols = wcols(type), A = ANIM[type] || ANIM.sword;
  G.P.combo = G.P.comboT > 0 ? (G.P.combo + 1) % 3 : 0; G.P.comboT = .8;
  const fin = G.P.combo === 2, st = (A.C || ['diag', 'rise', 'diag'])[G.P.combo];   // 三下各用不同揮法（斜劈 → 橫掃 → 重劈）
  spendSt(W.stam * (fin ? 1.3 : 1)); G.P.atkCd = W.cd / G.P.aspd * (fin ? 1.3 : 1);
  if (W.ranged) {                                                     // 法杖：舉杖聚光 → 往前一推放出 → 杖放低收招
    autoFace(170);
    const s = G.P.swing = newSwing(type, A, false, null, { ranged:true, fin });
    G.P.timers.push({ t:s.wu, fn: () => {
      for (const da of fin ? [-.2, 0, .2] : [0]) { const a = G.P.face + da;
        G.projs.push({ x:G.P.x + Math.cos(a) * 12, y:G.P.y - 8 + Math.sin(a) * 12, vx:Math.cos(a) * 270, vy:Math.sin(a) * 270, r:3, life:.65, mult:fin ? .8 : 1, owner:'p', kind:'bolt' }); }
      G.fx.push({ k:'warp', x:G.P.x + Math.cos(G.P.face) * 14, y:G.P.y - 8 + Math.sin(G.P.face) * 14, r0:2, r1:fin ? 12 : 9, th:2, sy:1, t:0, d:.18, col:'#b49cff' });
      smearFx(s.f + s.r0 * s.sd * .6, s.f + s.r1 * s.sd, HAND_R + REACH + WLEN.staff + 2, 4, s.sw, ['#5a2aa0', '#b48cff', '#f4e0ff'], .1);   // 杖頭甩出去的弧光
      sfx.fire(); } });
    return true;
  }
  autoFace(W.range + 40);
  if (type === 'spear') {
    const L = W.range + (fin ? 14 : 4), s = G.P.swing = newSwing(type, A, fin, null, {});
    G.P.timers.push({ t:s.wu, fn: () => { G.P.thrust = .14; lanceFx(G.P.face, L, fin ? 12 : 9, cols, .22, true); lineHit(G.P.x, G.P.y, G.P.face, L, 6, fin ? 1.25 : 1); sfx.swing(); } });
    if (fin) G.P.timers.push({ t:s.wu + .14, fn: () => { G.P.thrust = .14; G.P.swing = newSwing(type, Object.assign({}, A, { wu:0 }), false, null, {}); G.P.swing.t = 0;
      lanceFx(G.P.face, L + 6, 11, cols, .2, true); lineHit(G.P.x, G.P.y, G.P.face, L + 6, 7, 1.1, { heavy:true }); sfx.swing(); } });
    return true;
  }
  const s = G.P.swing = newSwing(type, A, fin, st, {});
  const th = { sword:9, dagger:6, axe:13, wolfblade:8 }[type] || 9, R = W.range + (fin ? 6 : 2);
  const tip = HAND_R + REACH + WLEN[type], Rv = Math.min(R, tip + (fin ? 9 : 6)), wv = Math.max(th, Rv - (HAND_R + REACH + WLEN[type] * .45));
  const as = s.f + s.rs * s.sd, a1 = s.f + s.r1 * s.sd, d0 = s.wu + s.sw * .25, sw2 = s.sw * .75;   // 刀先從頭頂甩到前方（25%），刀光從那裡開始畫
  const flat = s.sy < .6, Rs = flat ? Rv + 3 : Rv;                    // 橫掃：刀光畫成扁扁的一大圈，繞過身體前方
  smearFx(as, a1, Rs, wv * (fin ? 1.1 : 1) * (flat ? 1.3 : 1), sw2, cols, A.hold + .04, d0, s.sy);
  if (type === 'wolfblade') smearFx(a1, as, Rs - 4, wv * .7, sw2, SHADOWBLADE, .12, d0 + .04, s.sy);
  if (type === 'dagger' && fin) smearFx(s.f - s.r0 * s.sd * .55, s.f + s.r1 * s.sd * -1, Rv, wv, sw2, cols, .12, d0 + .07);   // 短刀收尾：交叉第二刀
  G.P.timers.push({ t:d0 + sw2 * .3, fn: () => {
    meleeHit(R, W.arc * (fin ? 1.3 : 1), fin ? 1.35 : 1, fin ? { heavy:true } : undefined);
    const mx = G.P.x + Math.cos(G.P.face) * Rv * .9, my = G.P.y - 7 + Math.sin(G.P.face) * Rv * .9 * HSY;   // 刀光前緣迸出火花
    for (let i = 0; i < (fin ? 18 : 12); i++) { const a = G.P.face + rr(-1.1, 1.1), v = rr(40, 140);
      G.parts.push({ x:mx, y:my, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:rr(.15, .32), max:.32, col:pick(['#ffb070', '#ff7a5a', '#ffffff', cols[1]]), star:rr(.6, 1.8), drag:6 }); }
    for (let i = 0; i < (fin ? 6 : 3); i++) { const a = G.P.face + rr(-.6, .6), v = rr(90, 170);   // 白色星屑往前飛
      G.parts.push({ x:mx, y:my, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 20, life:rr(.3, .45), max:.45, col:'#ffffff', star:rr(1.6, 2.6), drag:4 }); }
    if (fin) { moveEnt(G.P, Math.cos(G.P.face) * 7, Math.sin(G.P.face) * 7);
      if (type === 'axe') { quakeFx(G.P.x + Math.cos(G.P.face) * 18, G.P.y + Math.sin(G.P.face) * 18, 30); shake(4, .15); }
    }
    sfx.swing(); } });
  return true;
}
/* ---- 蓄力：長按攻擊鍵，兩段蓄力，放開放出武器專屬招式 ---- */
export const CH1 = .45, CH2 = 1.1, CHC = ['#9a7cff', '#c8a0ff', '#ffd04a'];
export function stopCharge() { G.P.chargeArm = false; G.P.charging = false; G.P.charge = 0; G.P.chargeLv = 0; G.P.chargeHold = 0; }
export function updateCharge(dt) {
  G.P.charge += dt;
  const lv = G.P.charge >= CH2 ? 2 : G.P.charge >= CH1 ? 1 : 0;
  if (lv > G.P.chargeLv) { G.P.chargeLv = lv; sfx.charge(lv); if (lv === 2) shake(1.5, .1);
    G.fx.push({ k:'warp', x:G.P.x, y:G.P.y, r0:4, r1:lv === 2 ? 26 : 18, th:3, t:0, d:.3, col:CHC[lv] });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; G.parts.push({ x:G.P.x, y:G.P.y - 8, vx:Math.cos(a) * 80, vy:Math.sin(a) * 60, life:.35, max:.35, col:lv === 2 ? '#ffd04a' : pick(STARC), star:rr(1, 2.4), drag:6 }); } }
  if (Math.random() < .55 + lv * .3) { const a = rr(0, TAU), R = rr(18, 28);                      // 往身上聚集的星光
    G.parts.push({ x:G.P.x + Math.cos(a) * R, y:G.P.y - 8 + Math.sin(a) * R * .7, vx:-Math.cos(a) * R * 3.2, vy:-Math.sin(a) * R * 2.2, life:.3, max:.3, col:lv === 2 ? '#ffd04a' : pick(STARC), star:rr(.6, 1.6) }); }
}
export function releaseCharge(lv) {
  if (G.P.st <= 0) return;
  const type = G.P.weapon.type, cols = wcols(type), s = lv >= 2 ? 1.45 : 1;
  spendSt(lv >= 2 ? 26 : 18); G.P.atkCd = .35; G.P.combo = 0; G.P.comboT = 0; sfx.release(lv);
  switch (type) {
    case 'sword': {                                                   // 月輪斬：一圈刀光 + 往前飛的新月劍氣
      autoFace(160); const a = G.P.face; G.P.spin = .3;
      smearFx(a - Math.PI, a + Math.PI, 34, 12, .2, cols, .16); meleeHit(36, 360, 1.4 * s, { heavy:true });
      G.projs.push({ x:G.P.x + Math.cos(a) * 10, y:G.P.y - 7 + Math.sin(a) * 10, vx:Math.cos(a) * 300, vy:Math.sin(a) * 300, r:10, life:.6, mult:2.2 * s, owner:'p', kind:'wave', pierce:true, hit:new Set(), R:lv >= 2 ? 20 : 15, th:lv >= 2 ? 9 : 7, cols });
      shake(3, .12); break; }
    case 'dagger': {                                                  // 影步連斬：瞬移到敵人身邊連砍
      const t = nearestTarget(130), n = lv >= 2 ? 5 : 3;
      G.P.skillLock = .1 + n * .07; G.P.iframe = Math.max(G.P.iframe, .2 + n * .07); blinkFx(G.P.x, G.P.y, true);
      if (t) { const a = Math.atan2(G.P.y - t.y, G.P.x - t.x), nx = t.x + Math.cos(a) * (t.r + 9), ny = t.y + Math.sin(a) * (t.r + 9);
        if (!collides(nx, ny, G.P.r)) { G.P.x = nx; G.P.y = ny; } G.P.face = a + Math.PI; updFlip(); }
      else moveEnt(G.P, Math.cos(G.P.face) * 50, Math.sin(G.P.face) * 50);
      blinkFx(G.P.x, G.P.y, false);
      G.P.skillLock = .1 + n * .1;
      for (let i = 0; i < n; i++) G.P.timers.push({ t:.06 + i * .1, fn: () => {   // 角色自己連砍：每一刀換一種揮法跟姿勢
        const tt = t && t.hp > 0 ? t : null, last = i === n - 1;
        if (tt) { G.P.face = Math.atan2(tt.y - G.P.y, tt.x - G.P.x); updFlip(); }
        const sw = G.P.swing = newSwing('dagger', QDAG, last, last ? 'slam' : DSEQ[i % DSEQ.length], {});
        swingSmear(sw, 'dagger', cols, last);
        const cx = tt ? tt.x : G.P.x + Math.cos(G.P.face) * 14, cy = tt ? tt.y : G.P.y + Math.sin(G.P.face) * 14;
        aoeHit(cx, cy, 20, .9 * s, last ? { heavy:true } : undefined); if (last) shake(3, .1); sfx.swing(); } });
      break; }
    case 'axe': {                                                     // 震地重擊：跳起來劈下，震波 + 裂痕
      autoFace(80); G.P.skillLock = .5; G.P.slam = .5; G.P.iframe = Math.max(G.P.iframe, .3);
      G.P.timers.push({ t:.26, fn: () => { const cx = G.P.x + Math.cos(G.P.face) * 20, cy = G.P.y + Math.sin(G.P.face) * 20, R = lv >= 2 ? 70 : 52;
        smearFx(G.P.face - 1.7, G.P.face + .3, 30, 14, .07, cols, .14);
        aoeHit(cx, cy, R * .8, 2.6 * s, { stun:1.4, heavy:true }); quakeFx(cx, cy, R);
        sfx.boom(); shake(7, .3); G.hitStop = Math.max(G.hitStop, .07); } });
      break; }
    case 'spear': {                                                   // 流星突刺：往前衝 + 超長貫穿槍芒
      autoFace(130); const a = G.P.face, L = lv >= 2 ? 120 : 95;
      G.P.skillLock = .22; G.P.iframe = Math.max(G.P.iframe, .3); G.P.thrust = .2; G.P.lunge = { t:.14, vx:Math.cos(a) * 420, vy:Math.sin(a) * 420 };
      lanceFx(a, L, lv >= 2 ? 16 : 12, cols, .3, true);
      G.P.timers.push({ t:.05, fn: () => lineHit(G.P.x, G.P.y, a, L - 20, 10, 2.4 * s, { heavy:true }) });
      break; }
    case 'staff': {                                                   // 星爆魔彈：大魔力球，爆炸（滿蓄力還會分裂）
      autoFace(200); const a = G.P.face; G.P.swing = { t:0, d:.25, ranged:true };
      G.projs.push({ x:G.P.x + Math.cos(a) * 10, y:G.P.y - 8 + Math.sin(a) * 10, vx:Math.cos(a) * 190, vy:Math.sin(a) * 190, r:6, life:1.2, mult:2.5 * s, owner:'p', kind:'orb', rad:lv >= 2 ? 60 : 46, split:lv >= 2, big:lv >= 2 ? 8 : 6 });
      G.fx.push({ k:'rune', x:G.P.x, y:G.P.y, r:16, t:0, d:.45, rot:rr(0, TAU) });
      break; }
    case 'wolfblade': {                                               // 狼牙迴旋：雙刃轉圈
      const n = lv >= 2 ? 3 : 2; G.P.skillLock = n * .15 + .05; G.P.iframe = Math.max(G.P.iframe, n * .15);
      for (let i = 0; i < n; i++) G.P.timers.push({ t:i * .15, fn: () => { G.P.spin = .3; const a = rr(0, TAU);
        smearFx(a, a + TAU * .95, 32, 9, .14, cols, .1); smearFx(a + Math.PI, a + Math.PI - TAU * .9, 24, 7, .14, SHADOWBLADE, .1);
        aoeHit(G.P.x, G.P.y, 34, 1.3 * s, i === n - 1 ? { heavy:true } : undefined); sfx.swing(); } });
      break; }
  }
}
/* ---- 瞬移：原地留下錯位的殘影 + 內縮光圈，落點擴散光圈 + 星光，角色閃白出現 ---- */
export function blinkFx(x, y, out) {
  if (out) {
    G.ghosts.push({ x, y, flip:G.P.flip, life:.32, max:.32, col:'glitch' });
    G.fx.push({ k:'warp', x, y, r0:16, r1:2, th:3, t:0, d:.22, col:'#9a7cff' });
    for (let i = 0; i < 10; i++) { const a = rr(0, TAU), sp = rr(30, 80); G.parts.push({ x:x + Math.cos(a) * 4, y:y - 8 + Math.sin(a) * 6, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 10, life:rr(.2, .4), max:.4, col:pick(STARC), star:rr(.6, 1.8), drag:4 }); }
  } else {
    G.fx.push({ k:'warp', x, y, r0:2, r1:18, th:3, t:0, d:.3, col:'#b49cff' });
    G.fx.push({ k:'warp', x, y:y - 8, r0:1, r1:10, th:2, sy:1, t:0, d:.18, col:'#ffffff' });
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; G.parts.push({ x, y:y - 8, vx:Math.cos(a) * 70, vy:Math.sin(a) * 50, life:.35, max:.35, col:pick(STARC), star:rr(1, 2.2), drag:5 }); }
    G.P.blinkIn = .2;
  }
}
export function trySkill() {
  if (G.P.skillCd > 0 || busy()) return;
  const W = WT[G.P.weapon.type];
  G.P.skillCd = W.scd * (1 - G.P.cdr); sfx.skill();
  const col = RAR[G.P.weapon.rarity].c, wc = wcols(G.P.weapon.type);
  switch (W.skill) {
    case 'spin':
      G.P.skillLock = .3; G.P.spin = .3; meleeHit(46, 360, 2.2);
      G.fx.push({ k:'ring', x:G.P.x, y:G.P.y - 6, r0:14, r1:46, t:0, d:.25, col:'#ffffff' });
      G.fx.push({ k:'arc', x:G.P.x, y:G.P.y - 6, a:0, arc:TAU, r:40, t:0, d:.2, col });
      for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, v = rr(90, 160);   // 一圈星光往外炸開
        G.parts.push({ x:G.P.x + Math.cos(a) * 10, y:G.P.y - 6 + Math.sin(a) * 8, vx:Math.cos(a) * v, vy:Math.sin(a) * v * .7, life:rr(.25, .42), max:.42, col:pick([wc[0], wc[1], wc[2], wc[2]]), star:rr(1, 2.4), drag:5 }); }
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU;             // 腳邊的灰被捲起來轉
        G.parts.push({ x:G.P.x + Math.cos(a) * 7, y:G.P.y + Math.sin(a) * 3, vx:Math.cos(a + 1.4) * 70, vy:Math.sin(a + 1.4) * 30 - 10, life:rr(.3, .5), max:.5, col:pick(['#d8ccb0', '#b8a888', '#8a7a64']), s:1, drag:3.5 }); }
      break;
    case 'dash': {
      const m = Math.hypot(input.mx, input.my); if (m > .2 && !nearestTarget(130)) G.P.face = Math.atan2(input.my, input.mx); else autoFace(130);
      updFlip();
      // 拖尾光帶：衝刺期間持續拉長（尾細頭粗），結束後從尾巴往前收
      const streak = { k:'streak', x0:G.P.x, y0:G.P.y - 8, x1:G.P.x, y1:G.P.y - 8, t:0, d:.4 };
      G.fx.push(streak);
      G.P.dash = { t:.16, vx:Math.cos(G.P.face) * 560, vy:Math.sin(G.P.face) * 560, hit:new Set(), streak }; G.P.iframe = .24;
      // 起跑：腳下展開魔法陣 + 星光往後噴 + 輕微震動
      G.fx.push({ k:'rune', x:G.P.x, y:G.P.y, r:17, t:0, d:.55, rot:rr(0, TAU) });
      for (let i = 0; i < 14; i++) { const a = G.P.face + Math.PI + rr(-.9, .9), s = rr(50, 160);
        G.parts.push({ x:G.P.x, y:G.P.y - rr(2, 14), vx:Math.cos(a) * s, vy:Math.sin(a) * s, life:rr(.3, .6), max:.6, col:pick(STARC), star:rr(1, 3), drag:5 }); }
      shake(2, .1); break; }
    case 'slam':
      autoFace(70); G.P.skillLock = .5; G.P.slam = .5;
      G.P.timers.push({ t:.24, fn: () => { const cx = G.P.x + Math.cos(G.P.face) * 24, cy = G.P.y + Math.sin(G.P.face) * 24;
        aoeHit(cx, cy, 40, 3.5, { stun:1.2 }); G.fx.push({ k:'ring', x:cx, y:cy, r0:6, r1:44, t:0, d:.35, col:'#f2c14e' });
        burst(cx, cy, 24, '#8a8296', 90); sfx.boom(); shake(5, .25);
        for (let i = 0; i < 18; i++) { const a = rr(0, TAU), v = rr(30, 110);   // 碎石飛起來再掉下去
          G.parts.push({ x:cx + rr(-6, 6), y:cy + rr(-3, 3), vx:Math.cos(a) * v, vy:Math.sin(a) * v * .5 - rr(70, 150), life:rr(.5, .8), max:.8, col:pick(['#8a8296', '#5e5a6e', '#b8a888', '#6a5040']), s:2, g:400, drag:1 }); }
        for (let i = 0; i < 22; i++) { const a = i / 22 * TAU;            // 沿地面擴散的塵土
          G.parts.push({ x:cx, y:cy, vx:Math.cos(a) * 120, vy:Math.sin(a) * 55, life:.42, max:.42, col:pick(['#d8ccb0', '#b8a888']), s:Math.random() < .3 ? 2 : 1, drag:4 }); }
        for (let i = 0; i < 12; i++) G.parts.push({ x:cx + rr(-14, 14), y:cy + rr(-6, 6), vx:rr(-15, 15), vy:-rr(30, 70), life:rr(.5, .9), max:.9, col:pick(['#ffb040', '#ff7a2a', '#ffe08a']), star:rr(.8, 1.8), drag:1.5 });   // 火星
      } }); break;
    case 'triple':
      autoFace(80); G.P.skillLock = .42;
      for (let i = 0; i < 3; i++) G.P.timers.push({ t: i * .13, fn: () => { meleeHit(56, 34, 1.4); G.P.thrust = .1;
        G.fx.push({ k:'line', x:G.P.x, y:G.P.y - 6, a:G.P.face, len:56, t:0, d:.12, col:'#ffffff' }); sfx.swing();
        const c = Math.cos(G.P.face), sn = Math.sin(G.P.face), tx = G.P.x + c * 50, ty = G.P.y - 6 + sn * 50;
        for (let k = 0; k < 9; k++) { const a = G.P.face + rr(-.45, .45), v = rr(60, 170); G.parts.push({ x:tx, y:ty, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:rr(.15, .3), max:.3, col:pick([wc[1], wc[2], '#ffffff']), star:rr(.8, 2), drag:6 }); }   // 槍尖噴火花
        for (let k = 0; k < 10; k++) { const u = rr(.15, 1); G.parts.push({ x:G.P.x + c * 56 * u, y:G.P.y - 6 + sn * 56 * u + rr(-3, 3), vx:c * rr(80, 170), vy:sn * rr(80, 170), life:rr(.12, .22), max:.22, col:pick([wc[1], '#ffffff']), star:rr(.5, 1), drag:3 }); }   // 沿著槍的風
      } });
      break;
    case 'fireball':
      autoFace(190);
      G.projs.push({ x:G.P.x + Math.cos(G.P.face) * 8, y:G.P.y - 7 + Math.sin(G.P.face) * 8, vx:Math.cos(G.P.face) * 200, vy:Math.sin(G.P.face) * 200, r:4, life:1.1, mult:3, owner:'p', kind:'fire' });
      { const mx = G.P.x + Math.cos(G.P.face) * 12, my = G.P.y - 7 + Math.sin(G.P.face) * 12;   // 杖頭噴出火焰 + 橘色光圈
        G.fx.push({ k:'warp', x:mx, y:my, r0:3, r1:13, th:2.5, sy:1, t:0, d:.22, col:'#ff9a3a' });
        for (let i = 0; i < 16; i++) { const a = G.P.face + rr(-1.2, 1.2), v = rr(40, 140); G.parts.push({ x:mx, y:my, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 15, life:rr(.2, .4), max:.4, col:pick(['#ffe08a', '#ffb040', '#ff7a2a', '#ffffff']), star:rr(.8, 2), drag:5 }); } }
      G.P.swing = { t:0, d:.2, ranged:true, ty:'staff' }; break;
    case 'wolfrush':
      G.P.skillLock = .5; G.P.iframe = .6;
      for (let i = 0; i < 3; i++) G.P.timers.push({ t: i * .17, fn: () => {
        const t = nearestTarget(150);
        if (t) { const a = Math.atan2(t.y - G.P.y, t.x - G.P.x), nx = t.x + Math.cos(a) * (t.r + 8), ny = t.y + Math.sin(a) * (t.r + 8);
          trail(G.P.x, G.P.y, nx, ny);
          for (let k = 0; k < 16; k++) { const u = Math.random(); G.parts.push({ x:G.P.x + (nx - G.P.x) * u + rr(-3, 3), y:G.P.y - rr(2, 12) + (ny - G.P.y) * u, vx:rr(-12, 12), vy:-rr(10, 30), life:rr(.3, .55), max:.55, col:pick(['#3a2470', '#6a4ad0', '#9a6cff', '#e0d0ff']), star:rr(.6, 1.6), drag:2 }); }   // 路徑上的狼影紫霧
          for (let k = 0; k < 10; k++) { const b = a + rr(-1, 1), v = rr(60, 150); G.parts.push({ x:t.x, y:t.y - 7, vx:Math.cos(b) * v, vy:Math.sin(b) * v, life:rr(.15, .3), max:.3, col:pick(['#9a6cff', '#e0d0ff', '#ffffff']), star:rr(.8, 2), drag:6 }); }   // 撲到時的爪擊火花
          if (!collides(nx, ny, G.P.r)) { G.P.x = nx; G.P.y = ny; }
          G.P.face = a + Math.PI; updFlip(); aoeHit(t.x, t.y, 22, 1.8);
          G.fx.push({ k:'arc', x:t.x, y:t.y - 6, a:a, arc:2.2, r:22, t:0, d:.18, col:'#b49cff' }); }
        else { const nx = G.P.x + Math.cos(G.P.face) * 40, ny = G.P.y + Math.sin(G.P.face) * 40; trail(G.P.x, G.P.y, nx, ny); moveEnt(G.P, nx - G.P.x, ny - G.P.y); }
        sfx.swing(); } });
      break;
  }
}
function trail(x0, y0, x1, y1) { for (let i = 0; i <= 10; i++) { const k = i / 10; G.parts.push({ x:x0 + (x1 - x0) * k, y:y0 - 6 + (y1 - y0) * k, vx:rr(-8, 8), vy:rr(-8, 8), life:.35, max:.35, col: i % 2 ? '#b49cff' : '#e8e2ff', s:2 }); } }
export function tryDodge() {                                                // 瞬移：消失、極快地移動一小段、在落點閃現
  if (G.P.dodge > 0 || G.P.drink > 0 || G.P.dash || G.P.dead || G.P.st <= 0) return;
  stopCharge(); spendSt(20); const m = Math.hypot(input.mx, input.my);
  const a = m > .2 ? Math.atan2(input.my, input.mx) : G.P.face;
  G.P.dodge = .14; G.P.iframe = Math.max(G.P.iframe, .3); G.P.dvx = Math.cos(a) * 520; G.P.dvy = Math.sin(a) * 520; G.P.skillLock = 0; G.P.timers = []; G.P.lunge = null;
  if (G.P.swing && G.P.swing.anim && G.P.swing.t < G.P.swing.wu) { G.P.swing = null; for (let i = G.fx.length - 1; i >= 0; i--) if (G.fx[i].k === 'smear' && G.fx[i].follow && G.fx[i].t < (G.fx[i].delay || 0)) G.fx.splice(i, 1); }   // 預備中翻滾 = 取消這一刀
  blinkFx(G.P.x, G.P.y, true); sfx.blink();
}
export function tryPot() {
  if (G.P.pot <= 0 || busy()) { if (G.P.pot <= 0) toast('藥水用完了，回營火休息可以補滿', '#ff8a8a'); return; }
  G.P.pot--; G.P.drink = .55; sfx.drink();
}
export function hurtPlayer(v, sx, sy) {
  if (G.P.iframe > 0 || G.P.dead) return false;
  v = Math.max(1, Math.round(v * (1 - (G.P.defRed || 0))));            // 防禦：減少受到的傷害
  G.P.hp -= v; G.P.hurt = .3; G.P.iframe = .4;
  const a = Math.atan2(G.P.y - sy, G.P.x - sx); G.P.kx = Math.cos(a) * 120; G.P.ky = Math.sin(a) * 120;
  G.nums.push({ x:G.P.x, y:G.P.y - 28, txt:String(v), col:'#ff5a5a', t:0, d:.8 });
  shake(3, .2); sfx.hurt(); burst(G.P.x, G.P.y - 6, 8, '#d8434e', 60);
  if (G.P.hp <= 0) { G.P.hp = 0; G.P.dead = true; G.deathT = 0; stopCharge(); G.P.lunge = null; sfx.death(); showBanner('力竭倒下', G.P.souls > 0 ? '魂晶掉在原地，回去撿就能拿回來' : '', 2400); }
  return true;
}

