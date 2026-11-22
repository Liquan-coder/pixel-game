import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { OL } from '../art/sprite';
import { ANIM, HAND_R, HERO, HERO_H, HERO_W, HSY, PPX, PPY, REACH, STYLE, WLEN, WREC, heroPose, lerpA } from '../art/hero';
import { drawWeapon } from '../art/weapon';
import { ICON, WT } from '../data/items';
import { CH1, CH2, CHC, restAng, wcols } from '../game/combat';
import { fxOf } from '../game/weaponFx';
import { asn, drawArrow, drawStar, drawWarp, fillArt } from './fx';
import { camDt } from '../main';
import type { Player } from '../types';
import { bodyGone, deathFx } from './pfx';
import { SEAT_X, WOLF_CX, drawWolf, wolfLift } from '../art/starWolf';
import { DROP_T, RIDE_Y } from '../game/mount';

/* ================= RENDER ================= */
const DIG = { '0':['111','101','101','101','111'], '1':['010','110','010','010','111'], '2':['111','001','111','100','111'], '3':['111','001','111','001','111'],
  '4':['101','101','111','001','001'], '5':['111','100','111','001','111'], '6':['111','100','111','101','111'], '7':['111','001','001','001','001'],
  '8':['111','101','111','101','111'], '9':['111','101','111','001','111'], '+':['000','010','111','010','000'], '!':['010','010','010','000','010'],
  'M':['101','111','111','101','101'], 'I':['111','010','010','010','111'], 'S':['111','100','111','001','111'] };   // MISS（閃避）
export function drawNum(str, x, y, col, s = 1) {
  const w = (str.length * 4 - 1) * s; const x0 = Math.round(x - w / 2); y = Math.round(y);
  for (const pass of [0, 1]) { let cx = x0;
    ctx.fillStyle = pass ? col : OL;
    for (const ch of str) { const g = DIG[ch]; if (g) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '1') ctx.fillRect(cx + c * s + (pass ? 0 : 1), y + r * s + (pass ? 0 : 1), s, s); cx += 4 * s; }
  }
}
export function drawShadow(x, y, w) {                                     // 橢圓陰影，用細像素一列一列畫
  const q = HK, rx = w / 2, ry = Math.max(1.2, w * .17); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath();
  for (let dy = -ry; dy <= ry + .01; dy += q) { const hw = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)); if (hw >= q) ctx.rect(asn(x - hw), asn(y + dy), Math.round(hw * 2 / q) * q, q); }
  ctx.fill(); }
export function heroSlices(sp, X, Y, flip, k, amt, white) {                  // 把角色切成橫條左右錯開：瞬移的「訊號干擾」感
  const img = white ? (flip ? sp.wf : sp.wn) : (flip ? sp.pf : sp.pn), H = sp.h, W = sp.w, st = 3;
  for (let y = 0; y < H; y += st) { const off = Math.round(Math.sin(y * 1.7 + G.time * 40) * amt) * k, hh = Math.min(st, H - y);
    ctx.drawImage(img, 0, y, W, hh, X + off, Y + y * k, W * k, hh * k); }
}
const emit = (rate, fn) => { let n = rate * camDt; while (n > 0) { if (n >= 1 || Math.random() < n) fn(); n--; } };   // 每秒 rate 顆，跟幀率無關
function attackParticles(pl: Player, m, phase, gx, gy, ang) {                       // 攻擊四段的粒子
  const type = pl.weapon.type, L = WLEN[type] || 8, c = Math.cos(ang), s = Math.sin(ang), tx = gx + c * L, ty = gy + s * L, col = wcols(pl, type);
  const along = u => [gx + c * L * u, gy + s * L * u], fx0 = pl.x, fy0 = pl.y;
  if (type === 'bow' || type === 'elfbow') {                            // 長弓 / 精靈弓：拉弓時箭搭在弦上，箭頭慢慢亮起來
    if (phase === 'C') { const k = m.t / m.wu; drawArrow(gx + Math.cos(pl.face) * 6, gy + Math.sin(pl.face) * 6, pl.face, 8 + k * 4, col, false); drawStar(gx + Math.cos(pl.face) * 6, gy + Math.sin(pl.face) * 6, 1 + k * 2, '#ffffff'); }
    return;
  }
  if (m.ranged) {                                                       // 法杖：杖頭聚光
    if (phase === 'C') { const k = m.t / m.wu; drawWarp({ x:tx, y:ty, r0:2 + k * 4, r1:2 + k * 4, th:1.8, sy:1, col:'#b48cff' }, 0); drawStar(tx, ty, 2 + k * 4, '#e8d0ff');
      emit(40, () => { const a = rr(0, TAU), r = rr(8, 14); G.parts.push({ x:tx + Math.cos(a) * r, y:ty + Math.sin(a) * r, vx:-Math.cos(a) * r * 5, vy:-Math.sin(a) * r * 5, life:.18, max:.18, col:pick(['#ffffff', '#d8b8ff', '#9a7cff']), star:rr(.6, 1.4), drag:2 }); }); }
    return;
  }
  if (phase === 'C') {
    if (!m.dust) { m.dust = true;                                       // 蓄力起手：腳邊揚起一點灰
      for (let i = 0; i < 6; i++) { const sg = i % 2 ? 1 : -1; G.parts.push({ x:fx0 + sg * rr(2, 5), y:fy0 + rr(-1, 1), vx:sg * rr(15, 40), vy:-rr(5, 18), life:rr(.25, .4), max:.4, col:pick(['#b8a888', '#8a7a64', '#d8ccb0']), s:1, g:40, drag:3 }); } }
    emit(90, () => { const [bx, by] = along(rr(.3, 1)), a = rr(0, TAU), r = rr(9, 16);   // 光點從四周被吸進刀身
      G.parts.push({ x:bx + Math.cos(a) * r, y:by + Math.sin(a) * r * .8, vx:-Math.cos(a) * r * 6, vy:-Math.sin(a) * r * 4.8, life:.16, max:.16, col:pick([col[1], col[2], col[1]]), star:rr(1, 2), drag:1 }); });
    emit(30, () => G.parts.push({ x:tx + rr(-5, 5), y:ty + rr(-5, 5), vx:rr(-12, 12), vy:rr(-25, -5), life:.35, max:.35, col:pick(['#ffe08a', '#ffe08a', '#ffffff']), star:rr(1.2, 2.6), drag:3 }));   // 刀尖金色星光
  }
  if (phase === 'S' && !m.glint) { m.glint = true;                      // 蓄力完成 → 出刀的瞬間刀尖一閃
    G.fx.push({ k:'star', x:tx, y:ty, t:0, d:.12, s:5 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; G.parts.push({ x:tx, y:ty, vx:Math.cos(a) * 70, vy:Math.sin(a) * 70, life:.18, max:.18, col:'#ffffff', star:1.2, drag:8 }); } }
  if (phase === 'S') {
    const q = Math.min(1, (m.t - m.wu) / m.sw), dirA = ang + (m.r1 > (m.rs ?? m.r0) ? 1 : -1) * m.sd * Math.PI / 2;   // 刀正在往哪個方向揮
    emit(280, () => { const u = rr(.45, 1.05), [bx, by] = along(u), v = rr(50, 130) * u;   // 刀鋒甩出的火花
      G.parts.push({ x:bx, y:by, vx:Math.cos(dirA) * v + c * rr(10, 40), vy:Math.sin(dirA) * v * .8 + s * rr(10, 40), life:rr(.2, .38), max:.38, col:pick([col[0], col[1], col[2], col[2]]), star:rr(1, 2.4), drag:5 }); });
    emit(35, () => { const [bx, by] = along(rr(.5, 1)); G.parts.push({ x:bx, y:by, vx:rr(-8, 8), vy:-rr(8, 22), life:rr(.4, .7), max:.7, col:pick([col[1], '#ffffff']), star:rr(.5, 1.1), drag:1.5 }); });   // 慢慢往上飄的餘燼
    if (m.st === 'slam' && q > .35 && !m.land) { m.land = true;          // 重劈落地：腳邊的灰往兩旁噴
      for (let i = 0; i < 14; i++) { const sg = i % 2 ? 1 : -1; G.parts.push({ x:fx0 + sg * rr(1, 6), y:fy0 + rr(-1, 2), vx:sg * rr(30, 85), vy:-rr(10, 40), life:rr(.3, .55), max:.55, col:pick(['#b8a888', '#8a7a64', '#d8ccb0', '#ffffff']), s:Math.random() < .4 ? 2 : 1, g:110, drag:2.5 }); } }
  }
  if (phase === 'H') {
    const k = Math.min(1, (m.t - m.wu - m.sw) / (m.d - m.wu - m.sw)), [gx2, gy2] = along(.15 + .9 * k);   // 一道亮光沿著刀身從護手跑到刀尖
    drawStar(gx2, gy2, 2.4 * (1 - k * .5), '#ffffff');
    emit(28, () => { const [bx, by] = along(rr(.3, 1)); G.parts.push({ x:bx, y:by, vx:-Math.cos(pl.face) * rr(10, 30), vy:rr(-20, -6), life:.32, max:.32, col:pick([col[0], col[1], '#e8dcff']), star:rr(.5, 1.3), drag:3 }); });
  }
}
/* 武器上的刻印：平常拿著就會一直冒刻印的粒子，一眼看得出這把裝了什麼
   出血 = 刀身滴血、燃燒 = 往上竄的火星、寒霜 = 往下飄的雪、雷鳴 = 一閃一閃的電花、噬魂 = 慢慢飄上去的紫色魂 */
function sealAura(pl: Player, gx, gy, ang) {
  const fx = fxOf(pl.weapon); if (!fx) return;
  const L = WLEN[pl.weapon.type] || 8, c = Math.cos(ang), s = Math.sin(ang), along = (u: number) => [gx + c * L * u, gy + s * L * u];
  if (fx === 'bleed') emit(7, () => { const [x, y] = along(rr(.4, 1)); G.parts.push({ x, y, vx:rr(-3, 3), vy:rr(0, 8), life:rr(.35, .55), max:.55, col:pick(['#c01020', '#ff3a4a']), s:1, g:160 }); });
  else if (fx === 'burn') emit(22, () => { const [x, y] = along(rr(.3, 1)); G.parts.push({ x:x + rr(-1, 1), y, vx:rr(-5, 5), vy:-rr(18, 36), life:rr(.25, .45), max:.45, col:pick(['#ffe08a', '#ffa040', '#e8402a']), star:rr(.6, 1.3), drag:1 }); });
  else if (fx === 'frost') emit(9, () => { const [x, y] = along(rr(.3, 1)); G.parts.push({ x:x + rr(-2, 2), y:y + rr(-2, 2), vx:rr(-5, 5), vy:rr(6, 14), life:rr(.5, .8), max:.8, col:pick(['#ffffff', '#d8f0ff', '#9ae0ff']), star:rr(.5, 1.1), drag:1 }); });
  else if (fx === 'shock') emit(10, () => { const [x, y] = along(rr(.3, 1)), a = rr(0, TAU); G.parts.push({ x, y, vx:Math.cos(a) * 60, vy:Math.sin(a) * 60, life:.08, max:.08, col:pick(['#ffffff', '#ffe85a', '#ffe85a']), star:rr(1, 1.8), drag:8 }); });
  else if (fx === 'soul') emit(8, () => { const [x, y] = along(rr(.3, 1)); G.parts.push({ x, y, vx:rr(-4, 4), vy:-rr(8, 16), life:rr(.6, .9), max:.9, col:pick(['#c8a8ff', '#f0e8ff', '#9a6cff']), star:rr(.6, 1.3), drag:.5 }); });
}
function skillParticles(pl: Player, gx, gy, ang) {                                   // 技能持續中的粒子
  const L = WLEN[pl.weapon.type] || 8, tx = gx + Math.cos(ang) * L, ty = gy + Math.sin(ang) * L, wc = wcols(pl, pl.weapon.type);
  if (pl.spin > 0) emit(320, () => { const v = rr(40, 110), d = ang + (pl.flip ? -1 : 1) * Math.PI / 2;   // 迴旋斬：刀尖甩出一圈火花
    G.parts.push({ x:tx + rr(-2, 2), y:ty + rr(-2, 2), vx:Math.cos(d) * v, vy:Math.sin(d) * v * .7, life:rr(.18, .32), max:.32, col:pick([wc[0], wc[1], wc[2]]), star:rr(.8, 2), drag:5 }); });
  if (pl.slam > 0 && pl.slam / .5 > .5) emit(90, () => { const a = rr(0, TAU), r = rr(10, 18);   // 裂地重擊：舉斧時橘光往斧頭聚
    G.parts.push({ x:tx + Math.cos(a) * r, y:ty + Math.sin(a) * r, vx:-Math.cos(a) * r * 6, vy:-Math.sin(a) * r * 6, life:.16, max:.16, col:pick(['#ffb040', '#ffe08a', '#ffffff']), star:rr(.8, 1.8), drag:1 }); });
  if (pl.weapon.type === 'darkmoon' && pl.moonN > 0) emit(18 * pl.moonN, () => { const u = rr(.3, 1);   // 暗月：存的月光越多，劍身冒出越多藍光
    G.parts.push({ x:gx + Math.cos(ang) * L * u, y:gy + Math.sin(ang) * L * u, vx:rr(-8, 8), vy:-rr(10, 30), life:.4, max:.4, col:pick(['#8aa0ff', '#eef4ff', '#4a5ae0']), star:rr(.6, 1.4), drag:2 }); });
  if (pl.dash) emit(170, () => { const a = pl.face + Math.PI + rr(-.5, .5), v = rr(30, 90);   // 疾風突刺：身後拖出星光
    G.parts.push({ x:pl.x + rr(-3, 3), y:pl.y - rr(2, 14), vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:rr(.2, .4), max:.4, col:pick(['#9a7cff', '#c8b0ff', '#ffffff']), star:rr(.8, 2), drag:4 }); });
  if (pl.charging && pl.charge > .1) { const lv = pl.chargeLv; emit(25 + lv * 35, () => { const a = rr(0, TAU), r = rr(14, 22);   // 蓄力：光點往身體吸，越滿越多
    G.parts.push({ x:pl.x + Math.cos(a) * r, y:pl.y - 7 + Math.sin(a) * r * .7, vx:-Math.cos(a) * r * 4.5, vy:-Math.sin(a) * r * 3.2, life:.22, max:.22, col:pick([CHC[lv], CHC[lv], '#ffffff']), star:rr(.8, 1.6 + lv * .4), drag:1 }); }); }
}
function heroAttackPose(pl: Player) {                                            // 現在該用哪張攻擊姿勢圖（沒在攻擊就回傳 null，用走路圖）
  if (pl.dash || pl.lunge) return [6, 2, 1];
  if (pl.slam > 0) { const q = pl.slam / .5; return q > .55 ? [-5, -3, 0] : q > .35 ? [7, 4, 1] : [5, 3, 1]; }   // 裂地：高舉 → 砸下 → 壓低停住
  if (pl.spin > 0) return [2, 2, 1];
  if (pl.charging) return [-3, pl.chargeLv >= 1 ? 3 : 2, 1];              // 蓄力：往後拉、壓低重心
  const s = pl.swing;
  if (s && s.anim) { const A = ANIM[s.ty] || ANIM.sword, SP = s.st && STYLE[s.st].P, PP = SP && !(s.st === 'slam' && s.ty === 'axe') ? Object.assign({}, A.P, SP) : A.P;
    const ph = s.t < s.wu ? (PP.C0 && s.t < s.wu * .5 ? 'C0' : 'C') : s.t < s.wu + s.sw ? 'S' : 'H';
    const p = PP[ph]; return s.fin && ph === 'H' ? [p[0] + 1, p[1] + 1, p[2]] : p; }
  if (s) return ANIM.staff.P.S;
  if (pl.thrust > 0) return [5, 0, 1];
  if (pl.wRec > 0) return (ANIM[pl.wTy] || ANIM.sword).P.R;
  return null;
}
/* 單邊有刃的武器（斧頭）：刃要朝「正在揮過去的方向」，不然會變成用斧背砍。
   角度往順時針轉（畫面上 y 朝下，角度變大）→ 用翻過的圖，刃在前面；逆時針 → 不翻。
   rot = +1 順時針 / -1 逆時針：平常跟面向一樣（面右往順時針揮）；反手橫掃（flat）會反過來 */
const ONE_EDGE = { axe: true, scythe: true, crescent: true };
function edgeMir(pl: Player, msw, dir) {
  if (!ONE_EDGE[pl.weapon.type]) return undefined;
  let rot = dir;
  if (msw && !msw.ranged) rot = Math.sign(msw.r1 - (msw.rs ?? msw.r0)) * msw.sd || dir;
  else if (pl.wRec > 0 && pl.wRot) rot = pl.wRot;                    // 收招時維持剛剛那一下的方向，不會突然翻面
  return rot > 0;
}
export function drawPlayer(pl: Player) {
  if (pl.dodge > 0 && !pl.dead) return;                                  // 瞬移中完全隱身
  const blink = pl.iframe > 0 && !pl.dodge && !pl.dash && pl.skillLock <= 0 && !(pl.blinkIn > 0) && Math.floor(G.time * 20) % 2 === 0;
  const fade = pl.dead ? (bodyGone(pl) ? 0 : 1) : 1;                  // 倒下：身體交給碎裂特效去畫（pixelfx disintegrate）
  ctx.globalAlpha = fade;
  const ride = !!pl.ride && !pl.dead, run = ride && pl.moving ? pl.rideRun || 0 : null;
  drawShadow(pl.x, pl.y + 1, ride ? 30 : 12);
  if (ride) drawMount(pl, run);
  // 騎著：整個人抬到狼背上（跟著步伐一起騰空）；剛跳下來：從狼背落回地上
  const rideY = ride ? RIDE_Y + (run === null ? 0 : wolfLift(run) * HK) : pl.rideDrop > 0 ? RIDE_Y * pl.rideDrop / DROP_T : 0;
  const py = pl.y - rideY, seat = ride ? (SEAT_X - WOLF_CX) * HK * (pl.flip ? -1 : 1) : 0;
  const dir = pl.flip ? -1 : 1, spinA = pl.spin > 0 ? pl.face + (1 - pl.spin / .3) * TAU * dir : 0;
  const ap = heroAttackPose(pl), vs = Math.abs(Math.cos(pl.face));   // 面向上下時前傾減半（只分兩檔，姿勢圖不會無限增加）
  const step = Math.floor(pl.anim * 8) % 4, frame = ap ? heroPose(vs < .7 ? Math.round(ap[0] / 2) : ap[0], ap[1], ap[2]) : ride ? HERO.ride : HERO.walk[pl.moving ? step : 0];
  const bob = ap || ride ? 0 : pl.moving ? step % 2 : (Math.floor(G.time * 2) % 2);
  const k = HK, flip = pl.spin > 0 ? Math.cos(spinA) < 0 : pl.flip, white = pl.hurt > .2, PX0 = ap ? PPX : 0, PY0 = ap ? PPY : 0;   // 迴旋斬時身體跟著刀轉
  const msw = pl.swing && pl.swing.anim ? pl.swing : null;
  const lean = ap ? ap[0] * .2 : 0, lx = Math.cos(pl.face) * lean;
  let hop = 0;                                                         // 重劈：舉刀時跳起來，劈下時落地（影子留在地上）
  if (msw && msw.st === 'slam' && !msw.ranged) { const t = msw.t, wu = msw.wu, sw = msw.sw;
    hop = t < wu ? 6 * Math.sin(Math.PI / 2 * t / wu) : t < wu + sw ? 6 * Math.max(0, 1 - (t - wu) / (sw * .35)) : 0; }
  const ly = Math.sin(pl.face) * lean * .5 - hop;                       // 身體跟著姿勢前後移一點
  pl.leanX = lx; pl.leanY = ly;
  const X = snapF(pl.x + seat + lx - (flip ? HERO_W - 26 + PX0 : 26 + PX0) * k), Y = snapF(py + ly + 2 - bob - (HERO_H + PY0) * k);
  deathFx(pl, flip ? frame.f : frame.n, X, Y, pl.x + lx, pl.y + ly + 2 - bob, flip);   // 倒下的第一幀：用這一格的女巫開始碎成光點
  const layer = sp => ctx.drawImage(white ? (flip ? sp.wf : sp.wn) : (flip ? sp.f : sp.n), X, Y, sp.w * k, sp.h * k);
  const hand = (cx, cy) => [X + (PX0 + (flip ? HERO_W - cx : cx)) * k, Y + (PY0 + cy) * k];
  if (pl.charging) {                                                    // 蓄力：腳下的環依進度填滿（紫 → 亮紫 → 金）
    const lv = pl.chargeLv, prog = lv >= 2 ? 1 : lv === 1 ? (pl.charge - CH1) / (CH2 - CH1) : pl.charge / CH1, R = 13, sy = .45;
    fillArt(pl.x - R - 1, pl.y - R * sy - 1, pl.x + R + 1, pl.y + R * sy + 1, (x, y) => { const dx = x - pl.x, dy = (y - pl.y) / sy, d = Math.sqrt(dx * dx + dy * dy); if (d > R || d < R - 2.4) return 0;
      let v = Math.atan2(dy, dx) + Math.PI / 2; v = (v % TAU + TAU) % TAU; return v / TAU <= prog ? 2 : 1; }, ['rgba(20,10,40,.55)', CHC[Math.min(2, lv + (lv < 2 ? 1 : 0))]]);
  }
  if (pl.charging && pl.charge > .1) { const lv = pl.chargeLv, sp = frame, img = lv >= 2 ? (flip ? sp.gf : sp.gn) : (flip ? sp.pf : sp.pn);   // 蓄力光：角色周圍一圈發光外框
    ctx.globalAlpha = fade * (lv === 0 ? .45 : .7 + .3 * Math.sin(G.time * 22)); const o = HK * (lv >= 2 ? 2 : 1);
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) ctx.drawImage(img, X + dx, Y + dy, sp.w * k, sp.h * k);
    ctx.globalAlpha = fade; }
  if (pl.healGlow > 0 && !pl.dead) { const q = pl.healGlow / .7, img = greenOf(flip ? frame.wf : frame.wn), o = HK * (q > .5 ? 2 : 1);   // 剛喝完藥水：綠光外框，一開始粗、慢慢變細淡掉
    ctx.globalAlpha = fade * Math.min(1, q * 1.4); for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) ctx.drawImage(img, X + dx, Y + dy, frame.w * k, frame.h * k);
    ctx.globalAlpha = fade; }
  const W = WT[pl.weapon.type], cf = Math.cos(pl.face), sf = Math.sin(pl.face);
  const rest = restAng(pl);
  let ang, hA = pl.face, reach = 0, lift = 0, phase = '';                                   // ang = 武器角度，hA = 手在身體哪一側
  if (pl.spin > 0) ang = hA = spinA;
  else if (pl.slam > 0) { const q = pl.slam / .5; ang = q > .55 ? pl.face - 1.6 * dir : pl.face + .3 * dir; }
  else if (pl.charging) { ang = (flip ? Math.PI + 2.3 : -2.3) + Math.sin(G.time * 34) * .04 * pl.chargeLv; hA = flip ? Math.PI : 0; }   // 蓄力時武器舉到身後
  else if (msw) { const m = msw, A = (r) => m.f + r * m.sd;
    if (m.t < m.wu) { const c = 1 - (1 - m.t / m.wu) ** 2; ang = A(m.rR + (m.r0 - m.rR) * c); lift = m.lift * c; phase = 'C'; }   // 蓄力：武器舉到頭上
    else if (m.t < m.wu + m.sw) { const q = (m.t - m.wu) / m.sw; reach = REACH; phase = 'S';
      if (m.rs === undefined) ang = A(m.r0 + (m.r1 - m.r0) * (1 - (1 - q) ** 2));
      else if (q < .25) { ang = A(m.r0 + (m.rs - m.r0) * q / .25); lift = m.lift * (1 - q / .25); }   // 從頭頂甩到前方
      else { const e = 1 - (1 - (q - .25) / .75) ** 2; ang = A(m.rs + (m.r1 - m.rs) * e); } }      // 跟刀光同一條緩動：刀尖永遠在刀光最前端
    else { ang = A(m.r1); reach = REACH; phase = 'H'; }                // 收招：停在揮到底的位置
    hA = ang; if (m.ranged) { hA = pl.face; reach = phase === 'S' || phase === 'H' ? REACH + 1 : 0; }
    else ang = Math.atan2(Math.sin(hA) * m.sy, Math.cos(hA)); }       // 刀在「揮的平面」上轉，畫到畫面上要壓扁（橫掃時刀幾乎是水平的）
  else if (pl.swing || pl.thrust > 0) ang = pl.face;
  else if (pl.wRec > 0) { const q = 1 - pl.wRec / (pl.wRecD || WREC), s = q * q * (3 - 2 * q); ang = lerpA(pl.wFrom, rest, s); hA = lerpA(pl.wFrom, pl.face, s); reach = REACH * (1 - s); }   // 揮完把刀收回來，不瞬間跳回
  else ang = rest;
  const hx = pl.x + seat + lx + Math.cos(hA) * (HAND_R + reach), hy = py - 7 + ly + .5 + Math.sin(hA) * (HAND_R + reach) * (msw && !msw.ranged ? msw.sy : HSY) - lift;
  const off = pl.thrust > 0 ? 6 : msw && phase === 'C' && msw.ty === 'spear' ? -4 : 0, showW = !blink && pl.dodge <= 0, gx = hx + Math.cos(ang) * off, gy = hy + Math.sin(ang) * off;
  const behind = Math.sin(hA) < -.45;                                 // 手舉到頭上方時，武器畫在身體後面
  const drawW = () => {
    if (!showW) return;
    if (pl.weapon.type === 'wolfblade') { const [lx2, ly2] = hand(11.5, 48.5); drawWeapon(ctx, 'wolfblade', lx2, ly2, ang + .5 * (flip ? -1 : 1)); }
    if (msw && phase === 'S' && pl.wHist) { const a0 = ctx.globalAlpha;    // 揮刀殘影：前幾格的刀，越舊越淡
      pl.wHist.forEach((h, i) => { ctx.globalAlpha = a0 * (.12 + .14 * i); drawWeapon(ctx, pl.weapon.type, h[0], h[1], h[2], HK, edgeMir(pl, msw, dir)); }); ctx.globalAlpha = a0; }
    drawWeapon(ctx, pl.weapon.type, gx, gy, ang, HK, edgeMir(pl, msw, dir));
    const hs = HERO.hand, img = white ? (flip ? hs.wf : hs.wn) : (flip ? hs.f : hs.n);   // 拳頭畫在握把上，蓋住刀柄
    ctx.drawImage(img, flip ? HERO_W - 44 : 39, 38, 5, 6, snapF(gx - 2.5 * k), snapF(gy - 2.5 * k), 5 * k, 6 * k);
  };
  if (behind) drawW();
  if (!blink) layer(frame);
  if (!blink && pl.healGlow > .45 && !pl.dead) { ctx.globalAlpha = fade * (pl.healGlow - .45) / .25 * .55; ctx.drawImage(flip ? frame.wf : frame.wn, X, Y, frame.w * k, frame.h * k); ctx.globalAlpha = fade; }   // 回血的第一下：全身亮白一閃
  if (pl.blinkIn > 0) { const q = pl.blinkIn / .2; ctx.globalAlpha = fade * q; heroSlices(frame, X, Y, flip, k, 5 * q, true); }   // 閃現：白色錯位剪影淡出
  ctx.globalAlpha = fade;
  if (!behind) drawW();
  if (showW && msw && !pl.dead) attackParticles(pl, msw, phase, gx, gy, ang);
  if (showW && !pl.dead) sealAura(pl, gx, gy, ang);
  if (!pl.dead) skillParticles(pl, gx, gy, ang);
  if (msw && phase === 'S') { (pl.wHist = pl.wHist || []).push([gx, gy, ang]); if (pl.wHist.length > 3) pl.wHist.shift(); } else pl.wHist = null;
  ctx.globalAlpha = 1;
  if (pl.drink > 0) { const q = 1 - pl.drink / .55, sp = ICON.potion, w = sp.width * HK * .8, h = sp.height * HK * .8;   // 喝藥水：頭上一瓶紅藥水，越喝越往嘴邊傾
    ctx.save(); ctx.translate(snapF(pl.x + (pl.flip ? -3 : 3)), snapF(py - 30 + Math.sin(q * Math.PI) * -2)); ctx.rotate((pl.flip ? -1 : 1) * (-.2 - q * .9));
    ctx.drawImage(sp, -w / 2, -h / 2, w, h); ctx.restore(); }
}
/* 星狼：剛騎上時從白光裡浮現（白色剪影淡出）*/
function drawMount(pl: Player, run: number | null) {
  const a0 = ctx.globalAlpha;
  drawWolf(pl.x, pl.y + 2, pl.flip, run);
  if (pl.rideIn > 0) { ctx.globalAlpha = a0 * Math.min(1, pl.rideIn / .35); drawWolf(pl.x, pl.y + 2, pl.flip, run, 'w'); ctx.globalAlpha = a0; }
}
/* 女巫剪影染成綠色（回血外框用）：第一次用到才做，之後用同一張 */
const GREEN = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function greenOf(img: HTMLCanvasElement) {
  let c = GREEN.get(img); if (c) return c;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d');
  g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#5cff7a'; g.fillRect(0, 0, c.width, c.height);
  GREEN.set(img, c); return c;
}
/* ---- 細像素特效：所有形狀都對齊主角的像素格（HK），看起來跟角色同一個畫風 ---- */
