/* ---- 倒下時掉的那包魂晶 / 金幣（G.lost）：要遠遠就看得到 ----
   1. 一道往天上衝的紫色光柱（畫在光影上面，暗的地城裡也亮；底部在畫面外，光柱還是會從畫面邊緣露出來）
   2. 地上一圈一圈往外擴的光環
   3. 一顆大的、會轉、上下浮動的魂晶，旁邊繞著三顆小星星 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, LH, LW, ctx } from '../core/canvas';
import { SOUL_SP } from '../data/items';
import { asn, drawStar, drawWarp } from './fx';
import { addLight } from './enemy';

const BEAM_H = 170;                                   // 光柱多高（遊戲像素）
const COLS = ['#b49cff', '#e8dcff', '#9a7cff'];

/* 世界座標，跟其他東西一起畫（在光影前面：光影會照亮它） */
export function drawLost(L, vis) {
  const d = G.lost; if (!d || !vis(d.x, d.y, 60)) return;
  const t = G.time, x = d.x, y = d.y, a0 = ctx.globalAlpha;
  ctx.globalAlpha = .35; ctx.fillStyle = '#5a3ab8'; ctx.beginPath(); ctx.ellipse(x, y, 11, 4.5, 0, 0, TAU); ctx.fill();   // 地上一攤紫光
  for (let i = 0; i < 3; i++) { ctx.globalAlpha = .9; drawWarp({ x, y, r0: 4, r1: 30, th: 2.5, sy: .45, col: '#9a7cff' }, (t * .6 + i / 3) % 1); }   // 光環一圈一圈擴出去
  const bob = Math.sin(t * 3) * 2, sp = SOUL_SP[Math.floor(t * 6) % 4], w = sp.width * HK * 2, h = sp.height * HK * 2, cy = y - 16 + bob;
  ctx.globalAlpha = 1; ctx.drawImage(sp, asn(x - w / 2), asn(cy - h / 2), w, h);                               // 大顆魂晶（兩倍大）
  for (let i = 0; i < 3; i++) { const a = t * 2.4 + i * TAU / 3; drawStar(x + Math.cos(a) * 10, cy + Math.sin(a) * 4, 1 + (Math.sin(t * 8 + i) > 0 ? 1 : 0), '#e8dcff'); }
  if (d.gold) { const gs = Math.sin(t * 5) > 0 ? 1 : 0; drawStar(x + 7, cy + 7, 1 + gs, '#f2c14e'); }           // 也有金幣：多一顆金星
  if (Math.random() < .5) G.parts.push({ x: x + rr(-6, 6), y: y - rr(0, 4), vx: 0, vy: -rr(20, 40), life: rr(.6, 1), max: 1, col: pick(COLS), s: 1 });
  ctx.globalAlpha = a0;
  addLight(L, x, y - 10, 64 + Math.sin(t * 4) * 5, 3);
}

/* 螢幕座標，畫在光影和黑幕上面（cx / cy = 鏡頭左上角）。用「相加」混色，看起來是發光的 */
export function drawLostBeam(cx: number, cy: number) {
  const d = G.lost; if (!d) return;
  const x = d.x - cx, y = d.y - cy - 4;
  if (x < -12 || x > LW + 12 || y < -12 || y - BEAM_H > LH) return;
  const t = G.time, p = .75 + .25 * Math.sin(t * 3), STEP = 3;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let hh = 0; hh < BEAM_H; hh += STEP) {           // 一段一段往上畫，越高越淡（一格格的，跟像素畫風一致）
    const f = 1 - hh / BEAM_H, fa = Math.sqrt(f) * p, base = hh < 12 ? (12 - hh) / 12 : 0;   // 底部稍微張開
    for (const [ww, col, a] of [[9 + base * 6, '#4a2a9a', .3], [4.4 + base * 3, '#9a7cff', .38], [1.4, '#f0e8ff', .6]] as const) {
      ctx.globalAlpha = a * fa; ctx.fillStyle = col; ctx.fillRect(Math.round((x - ww / 2) * 3) / 3, y - hh - STEP, Math.round(ww * 3) / 3, STEP); }
  }
  for (let i = 0; i < 6; i++) {                          // 光柱裡往上飄的亮點
    const hh = (t * 34 + i * BEAM_H / 6) % BEAM_H, f = 1 - hh / BEAM_H;
    ctx.globalAlpha = f * .9; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round((x + Math.sin(i * 2.7 + t * 2) * 2.5) * 3) / 3, y - hh, 2 * HK, 2 * HK); }
  ctx.restore();
}
