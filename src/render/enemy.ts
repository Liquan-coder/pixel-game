import { G } from '../core/state';
import { clamp, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { OL, drawSprite } from '../art/sprite';
import { SPR } from '../art/monsters';
import { ICON, RAR } from '../data/items';
import { CAMP_SP, drawArtSprite, flame } from '../world/chunks';
import { drawNum, drawShadow } from './player';
import { bladeArc, slamSpot } from '../game/enemies';
import { buildRow } from '../game/status';
import { drawIceCrystal, iceShatter, iceTop } from '../art/iceCrystal';
import { sfx } from '../core/audio';
import { artLine, artPath, asn, enemyJuice, fillSpans, shEll, shLane, shSector } from './fx';

export function drawEnemy(e) {
  const sp = SPR[e.kind];
  const tele = e.state === 'windup' || (e.boss && /Wind$/.test(e.state));
  const white = e.flash > 0 || (tele && Math.floor(G.time * 16) % 2 === 0);
  const J = enemyJuice(e, sp), bob = !(e.boss || e.rb) ? 0 : e.beh === 'slime' ? Math.round(Math.abs(Math.sin(e.anim * 5)) * 2) : (e.state === 'chase' || e.state === 'idle') ? Math.floor(e.anim * 6) % 2 : 0;
  drawShadow(e.x, e.y + 1, sp.w * .7 * Math.max(.55, 1 - J.lift * .04));   // 跳起來時影子變小
  if (e.stun > 0) { ctx.fillStyle = '#f2c14e'; const a = G.time * 8; ctx.fillRect(Math.round(e.x + Math.cos(a) * 6), Math.round(e.y - sp.h - 3), 2, 2); ctx.fillRect(Math.round(e.x - Math.cos(a) * 6), Math.round(e.y - sp.h - 3), 2, 2); }
  ctx.save(); ctx.translate(snapF(e.x + J.shiver), snapF(e.y + 2 - bob - (e.z || 0) - J.lift));   // 以腳底為中心變形
  if (J.rot) ctx.rotate(J.rot);
  ctx.transform(J.sx, 0, -J.lean, J.sy, 0, 0);
  drawSprite(J.pose && sp.atk?.[J.pose] || (J.wf >= 0 && sp.walk ? sp.walk[J.wf] : sp), 0, 0, e.flip, white, e.elite && Math.floor(G.time * 4) % 4 !== 0);   // 跑動中 → 換成第 wf 張走路圖
  if (e.boss && G.B && G.B.phase === 2 && sp.eye) { const X = snapF(-sp.w / 2), Y = snapF(-sp.h), ex = (e.flip ? sp.aw - sp.eye[0] - 3 : sp.eye[0]) * HK;
    ctx.fillStyle = '#ff3b3b'; ctx.globalAlpha = .5 + .5 * Math.sin(G.time * 12); ctx.fillRect(X + ex - HK, Y + (sp.eye[1] - 1) * HK, HK * 5, HK * 3); ctx.globalAlpha = 1; }
  ctx.restore();
  if (e.iceT) { if (e.iceT > G.time && e.hp > 0) drawIceCrystal(e.x, e.y + 2, G.time - (e.iceT0 || 0), e.iceT - G.time);   // 寒霜刻印凍住了（art/iceCrystal.ts）
    else { e.iceT = 0; iceShatter(e.x, e.y + 2); sfx.iceBreak(); } }                                           // 時間到 / 被打死：冰晶碎掉
  const hpBar = !e.boss && (e.hp < e.maxHp || e.elite), top = e.iceT > G.time ? Math.min(e.y - sp.h, e.y + 1 - iceTop()) : e.y - sp.h;   // 被凍住：血條、圖示移到冰晶上面
  if (hpBar) {
    const w = e.elite ? 22 : 14, y = Math.round(top - 3);
    ctx.fillStyle = OL; ctx.fillRect(Math.round(e.x - w / 2 - 1), y - 1, w + 2, 3);
    ctx.fillStyle = e.elite ? '#f2c14e' : '#d8434e'; ctx.fillRect(Math.round(e.x - w / 2), y, Math.max(1, Math.round(w * e.hp / e.maxHp)), 1);
  }
  if (e.hp > 0) sealIcons(e, top - (hpBar ? 6 : 3));
}
/* 刻印累積：跟主角被打中時頭上的圖示一樣（game/status.ts 的 buildIcon）——血滴 = 出血、雪花 = 凍傷、閃電 = 雷鳴，從下往上亮，快滿會閃；
   火焰 = 燃燒還剩幾秒。4 秒沒有再累積就先不畫（累積值還在，再砍一下就會出現） */
function sealIcons(e, bottom: number) {
  const icons: [string, number, number?][] = [];
  const fresh = G.time - (e.fxT || -99) < 4;
  if (fresh && e.bleedB > 0) icons.push(['bleed', e.bleedB / 100]);
  if (fresh && e.frostB > 0) icons.push(['frost', e.frostB / 100]);
  if (fresh && e.shockB > 0) icons.push(['shock', e.shockB / 100]);
  if (e.burnT > 0) icons.push(['burn', e.burnT / 3, 2]);
  buildRow(icons, e.x, bottom);
}
const TELE = ['#ff3b3b', '#ff3b3b', '#ffd0d0'];
function teleDraw(y0, y1, sh, prog, inner, extra?) {                    // 預警：淡紅區域 + 依進度填滿的深紅 + 亮邊
  const p = .7 + .3 * Math.sin(G.time * 26);
  fillSpans(y0, y1, [{ sh, col:TELE[0], a:.22 * p }, { sh:prog, col:TELE[1], a:.3 }, { sh, sub:inner, col:TELE[2], a:.85 * p }]);
  if (extra) extra();
}
export function teleSector(x, y, R, a, half, q) { const e = HK * 2.5;
  teleDraw(y - R, y + R, shSector(x, y, R, a, half), shSector(x, y, R * q, a, half), shSector(x, y, R - e, a, half, e)); }
export function teleLane(x, y, a, L, W, q) { const e = HK * 2.5, c = Math.cos(a), s = Math.sin(a), ex = x + c * L, ey = y + s * L;
  teleDraw(Math.min(y, ey) - W, Math.max(y, ey) + W, shLane(x, y, a, 0, L, W), shLane(x, y, a, 0, L * q, W), shLane(x, y, a, e, L - e, W - 2 * e), () => {
    const p = .7 + .3 * Math.sin(G.time * 26), a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * .85 * p; ctx.fillStyle = TELE[2]; artPath();      // 往前流動的箭頭線
    for (let al = (G.time * 90) % 18; al < L - 4; al += 18) { const mx = x + c * al, my = y + s * al; artLine(mx - s * W * .28, my + c * W * .28, mx + s * W * .28, my - c * W * .28, 1); }
    ctx.fill(); ctx.globalAlpha = a0; }); }
export function teleCircle(x, y, R, q) { teleDraw(y - R, y + R, shEll(x, y, R), shEll(x, y, R * q), shEll(x, y, R - HK * 2.5)); }
export function teleRing(x, y, r0, R, q) {                                    // 甜甜圈預警：外圈紅色（從內往外填滿），裡面一圈白色虛光 = 安全區
  const p = .7 + .3 * Math.sin(G.time * 26), e = HK * 2.5, inner = shEll(x, y, r0);
  fillSpans(y - R, y + R, [{ sh:shEll(x, y, R), sub:inner, col:TELE[0], a:.22 * p }, { sh:shEll(x, y, r0 + (R - r0) * q), sub:inner, col:TELE[1], a:.3 },
    { sh:shEll(x, y, R), sub:shEll(x, y, R - e), col:TELE[2], a:.85 * p }, { sh:shEll(x, y, r0 + e), sub:inner, col:TELE[2], a:.85 * p },
    { sh:inner, col:'#ffffff', a:.1 + .06 * p }]); }
export function warnMark(x, y) {                                              // 頭上的紅色驚嘆號
  const q = HK, X = asn(x), Y = asn(y), b = Math.sin(G.time * 20) > 0 ? '#ff3b3b' : '#ffd0d0';
  ctx.fillStyle = OL; ctx.fillRect(X - 2 * q, Y - 2 * q, 5 * q, 13 * q); ctx.fillStyle = b; ctx.fillRect(X - q, Y - q, 3 * q, 7 * q); ctx.fillRect(X - q, Y + 7 * q, 3 * q, 3 * q);
}
export function drawTelegraph(e) {
  const q = e.wt ? clamp(1 - e.t / e.wt, 0, 1) : 0;
  if (e.boss) {
    const top = e.y - (SPR.boss.h || 18) - 8;
    if (/Wind$/.test(e.state)) warnMark(e.x, top);
    if (e.state === 'lungeWind') teleLane(e.x, e.y - 4, e.aim, 135, 34, q);
    else if (e.state === 'biteWind') teleSector(e.x, e.y - 6, e.r + 36, e.aim, 1, q);
    else if (e.state === 'howlWind') teleCircle(e.x, e.y - 6, 80, q);
    else if (e.state === 'clawWind') for (const da of [-.38, 0, .38]) teleLane(e.x, e.y - 8, e.aim + da, 150, 18, q);
    else if (e.state === 'leapWind' || e.state === 'leap') { const lq = e.state === 'leap' ? .5 + .5 * (1 - e.t / e.lt) : q * .5; teleCircle(e.tx, e.ty, 46, lq); }
  } else if (e.state === 'windup') {
    const wq = e.wt ? clamp(1 - e.t / e.wt, 0, 1) : .5;
    if (e.beh === 'lunge') teleLane(e.x, e.y - 3, e.aim, 75, 2 * e.r + 8, wq);
    else if (e.beh === 'blade') { const A = bladeArc(e); teleSector(e.x, e.y - 3, A.R, e.aim, A.half, wq); }   // 骷髏：面前的扇形
    else if (e.beh === 'heavy') { const S = slamSpot(e); teleCircle(S.x, S.y, S.R, wq); }   // 砸地：落點一個圓
  }
}
export function drawCamp(c) {
  const x = c.x, y = c.y;
  drawShadow(x, y + 2, 18); drawArtSprite(CAMP_SP, x, y + 5);
  if (c.lit) {
    flame(x - 2.5, y + 1, 6, 1); flame(x + 2.5, y + 1, 7, 2); flame(x, y + .5, 11, 3);
    if (Math.random() < .12) G.parts.push({ x:x + rr(-3, 3), y:y - 8, vx:rr(-6, 6), vy:-28, life:.9, max:.9, col:Math.random() < .5 ? '#ffd04a' : '#f08a2e', star:.6, drag:1 });
  } else { ctx.fillStyle = '#2a2430'; ctx.fillRect(asn(x - 3), asn(y - 1), 6, 2); ctx.fillStyle = '#4a4050'; ctx.fillRect(asn(x - 2), asn(y - 1), 2, HK); }
}
export function drawDrop(d) {
  const R = RAR[d.item.rarity], bob = d.z > 0 ? 0 : Math.round(Math.sin(d.t * 3) * 1.5);
  ctx.globalAlpha = .35 + .15 * Math.sin(d.t * 4); ctx.fillStyle = R.c;
  const bh = 14 + d.item.rarity * 8; ctx.fillRect(Math.round(d.x - 1), Math.round(d.y - bh - 4), 2, bh);
  ctx.globalAlpha = 1; drawShadow(d.x, d.y + 1, 8);
  const ic = ICON[d.item.type], iw = ic.width * HK, ih = ic.height * HK; ctx.drawImage(ic, snapF(d.x - iw / 2), snapF(d.y - ih + 2 - d.z + bob), iw, ih);
  if (d === G.pick) {                                                 // 按攻擊鍵會撿到這件：頭上一個往下指的小箭頭
    const ay = Math.round(d.y - ih - 4 + Math.abs(Math.sin(G.time * 5)) * -2), ax = Math.round(d.x);
    ctx.fillStyle = '#120d1c'; ctx.fillRect(ax - 3, ay - 1, 7, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ax - 2, ay, 5, 1); ctx.fillRect(ax - 1, ay + 1, 3, 1); ctx.fillRect(ax, ay + 2, 1, 1);
  }
}
export function addLight(L, x, y, r, warm) { L.push({ x, y, r, warm }); }
