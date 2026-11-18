import { G } from '../core/state';
import { TAU, clamp } from '../core/util';
import { HK, LH, LW, ctx, snapF } from '../core/canvas';
import { OL } from '../art/sprite';
import { SH, sculpt } from '../art/monsters';
import { MH, MW, TS, torches } from './map';
import { AR, TA } from './gen';
import { SRAMP, bakeObjectHD, bakeTileHD } from './tileArt';
import { asn } from '../render/fx';

export const CH = 16, CPX = CH * TS, chunks = new Map(), CHUNK_MAX = 26;
export let bakedFrame = -1, bakeCount = 0;
export function bakeChunk(cx, cy) {
  const CA = CH * TA, c = document.createElement('canvas'); c.width = c.height = CA; const g = c.getContext('2d');
  const img = g.createImageData(CA, CA), buf = new Uint32Array(img.data.buffer);
  const tx0 = cx * CH, ty0 = cy * CH;
  for (let ty = ty0; ty < ty0 + CH; ty++) for (let tx = tx0; tx < tx0 + CH; tx++) bakeTileHD(buf, CA, tx, ty, (tx - tx0) * TA, (ty - ty0) * TA);
  g.putImageData(img, 0, 0);
  for (const t of torches) if (t.tx >= tx0 && t.tx < tx0 + CH && t.ty >= ty0 && t.ty < ty0 + CH) {     // 牆上的火把座
    const x = (t.x - tx0 * TS) * AR, y = (t.y - ty0 * TS) * AR;
    g.fillStyle = OL; g.fillRect(x - 5, y - 1, 10, 18); g.fillStyle = '#7a5434'; g.fillRect(x - 2, y, 4, 15); g.fillStyle = '#9a7048'; g.fillRect(x - 2, y, 1, 15);
    g.fillStyle = '#4a4858'; g.fillRect(x - 4, y + 10, 8, 3); g.fillStyle = '#7a788a'; g.fillRect(x - 4, y + 10, 8, 1); }
  for (let ty = ty0; ty < Math.min(MH, ty0 + CH + 6); ty++) for (let tx = Math.max(0, tx0 - 4); tx < Math.min(MW, tx0 + CH + 4); tx++) bakeObjectHD(g, tx, ty, (tx - tx0) * TA, (ty - ty0) * TA);
  bakedFrame = G.frameNo; bakeCount++;
  return c;
}
export function getChunk(cx, cy) {
  const k = cx + ',' + cy; let e = chunks.get(k);
  if (!e) { e = { c: bakeChunk(cx, cy), used: G.frameNo }; chunks.set(k, e);
    if (chunks.size > CHUNK_MAX) { let old = null, ou = Infinity; for (const [kk, v] of chunks) if (v.used < ou) { ou = v.used; old = kk; } if (old && old !== k) chunks.delete(old); } }
  e.used = G.frameNo; return e.c;
}
export function prefetchChunks(cx, cy) {                                       // 每幀最多先烤一塊：把周圍一圈事先準備好，走過去才不會卡
  if (bakedFrame === G.frameNo) return;
  const gx0 = Math.floor(cx / CPX) - 1, gx1 = Math.floor((cx + LW) / CPX) + 1, gy0 = Math.floor(cy / CPX) - 1, gy1 = Math.floor((cy + LH) / CPX) + 1;
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    if (gx < 0 || gy < 0 || gx * CH >= MW || gy * CH >= MH || chunks.has(gx + ',' + gy)) continue;
    const e = { c: bakeChunk(gx, gy), used: G.frameNo - 1 }; chunks.set(gx + ',' + gy, e); return; }
}
export function invalidate(tx, ty) { for (let y = ty - 6; y <= ty + 6; y += 2) for (let x = tx - 4; x <= tx + 4; x += 2) chunks.delete(Math.floor(clamp(x, 0, MW - 1) / CH) + ',' + Math.floor(clamp(y, 0, MH - 1) / CH)); }

/* ---------- 會動的場景：火焰、營火、火盆、發光蘑菇 ---------- */
export function flame(x, y, h, seed) {
  const q = HK, f = Math.sin(G.time * 14 + seed) * .5 + .5, H = Math.round((h + f * 2) / q * .9), W = Math.max(4, Math.round(H * .5)), X = asn(x), Y = asn(y);
  for (const [col, s] of [['#c8401e', 1], ['#f08a2e', .78], ['#ffd04a', .54], ['#fff6d0', .28]] as const) {
    const hh = Math.max(2, Math.round(H * (.3 + .7 * s))), ww = W * s; ctx.fillStyle = col; ctx.beginPath();
    for (let r = 0; r < hh; r++) { const u = r / hh, w = Math.max(1, Math.round(ww * Math.pow(1 - u, .65) * (u < .2 ? .7 + u * 1.5 : 1)));
      const xo = Math.round(Math.sin(G.time * 17 + seed * 3 + r * .5) * u * 1.6); ctx.rect(X + (xo - (w >> 1)) * q, Y - (r + 1) * q, w * q, q); }
    ctx.fill(); }
}
export const CAMP_SP = (() => { const st = SRAMP.rock[0], parts = [];
  parts.push({ sh: SH.cap(10, 14, 38, 20, 2.6, 2.2), ramp: SRAMP.bark, tex: .3, grp: 1 }, { sh: SH.cap(38, 14, 10, 20, 2.6, 2.2), ramp: SRAMP.bark, tex: .3, grp: 2 });
  for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + .3, x = 24 + Math.cos(a) * 19, y = 16 + Math.sin(a) * 8; parts.push({ sh: SH.ell(x, y, 4.2, 3.4), ramp: st, tex: .3, grp: 10 + k, line: st[0] }); }
  return sculpt(48, 28, parts); })();
export const BRAZ_SP = sculpt(36, 30, [{ sh: SH.box(18, 25, 4, 5, 3), ramp: SRAMP.metal, grp: 1 }, { sh: SH.ell(18, 27.5, 9, 2.4), ramp: SRAMP.metal, grp: 1 },
  { sh: SH.ell(18, 10, 17, 9, (x, y) => y > 8), ramp: ['#3a3226', '#5a4a38', '#7a6a50', '#9a8a68'], grp: 2 }], a => { a.rect(3, 9, 30, 2, '#2a2018'); a.rect(5, 12, 26, 1, '#9a8a68'); });
export const GLOW_SP = [0, 1].map(on => sculpt(14, 16, [{ sh: SH.cap(7, 15, 7, 8, 1.6, 1.4), ramp: ['#8a7a60', '#c8bca8', '#e8e0d0'], grp: 1 },
  { sh: SH.ell(7, 7, 6.5, 5, (x, y) => y < 9), ramp: on ? ['#2a8a80', '#4fd0c0', '#7ff0e0', '#d8fff8'] : ['#1e6a62', '#38a89a', '#5ad0c0', '#a8f0e8'], grp: 2 }],
  a => { a.set(4, 4, '#ffffff'); a.set(9, 5, on ? '#ffffff' : '#d8fff8'); }));
export function drawArtSprite(c, x, y) { ctx.drawImage(c, snapF(x - c.width * HK / 2), snapF(y - c.height * HK), c.width * HK, c.height * HK); }

/* minimap */
