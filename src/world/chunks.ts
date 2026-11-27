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
/* 地形烘焙分成三段：地面像素（16 列）→ 放上畫布 + 火把座 → 物件（樹、石頭、房子…，22 列）。
   預先烘焙（prefetch）每幀只做幾毫秒，下一幀接著做 → 走路時不會因為一次烤一整塊而卡一下。
   真的要畫但還沒烤好的那一塊，才會一次烤完（getChunk）。 */
type Job = { cx: number; cy: number; c: HTMLCanvasElement; g: CanvasRenderingContext2D; img: ImageData; buf: Uint32Array; step: number };
const OBJ_ROWS = CH + 6;
function beginJob(cx, cy): Job {
  const CA = CH * TA, c = document.createElement('canvas'); c.width = c.height = CA; const g = c.getContext('2d');
  const img = g.createImageData(CA, CA); return { cx, cy, c, g, img, buf: new Uint32Array(img.data.buffer), step: 0 };
}
function stepJob(j: Job) {                                                // 做一小段；做完回傳 true
  const CA = CH * TA, tx0 = j.cx * CH, ty0 = j.cy * CH, s = j.step++;
  if (s < CH) { const ty = ty0 + s; if (ty < MH) for (let tx = tx0; tx < tx0 + CH; tx++) if (tx < MW) bakeTileHD(j.buf, CA, tx, ty, (tx - tx0) * TA, (ty - ty0) * TA); return false; }
  if (s === CH) { const g = j.g; g.putImageData(j.img, 0, 0);
    for (const t of torches) if (t.tx >= tx0 && t.tx < tx0 + CH && t.ty >= ty0 && t.ty < ty0 + CH) {     // 牆上的火把座
      const x = (t.x - tx0 * TS) * AR, y = (t.y - ty0 * TS) * AR;
      g.fillStyle = OL; g.fillRect(x - 5, y - 1, 10, 18); g.fillStyle = '#7a5434'; g.fillRect(x - 2, y, 4, 15); g.fillStyle = '#9a7048'; g.fillRect(x - 2, y, 1, 15);
      g.fillStyle = '#4a4858'; g.fillRect(x - 4, y + 10, 8, 3); g.fillStyle = '#7a788a'; g.fillRect(x - 4, y + 10, 8, 1); }
    return false; }
  const ty = ty0 + (s - CH - 1);
  if (ty < MH) for (let tx = Math.max(0, tx0 - 4); tx < Math.min(MW, tx0 + CH + 4); tx++) bakeObjectHD(j.g, tx, ty, (tx - tx0) * TA, (ty - ty0) * TA);
  return s - CH >= OBJ_ROWS;
}
let job: Job | null = null;
/* 斜視角 demo（render/iso.ts）用：只有地面像素的區塊（樹、房子另外站著畫） */
const gChunks = new Map<number, HTMLCanvasElement>();
export function groundChunk(cx, cy) {
  const key = cy * 1000 + cx; let c = gChunks.get(key); if (c) return c;
  const j = beginJob(cx, cy); while (j.step <= CH) stepJob(j);
  gChunks.set(key, j.c); if (gChunks.size > 40) gChunks.delete(gChunks.keys().next().value);
  return j.c;
}
export function bakeChunk(cx, cy) {                                       // 一次烤完（如果剛好是背景正在烤的那塊，就接著烤完）
  const j = job && job.cx === cx && job.cy === cy ? job : beginJob(cx, cy); if (j === job) job = null;
  while (!stepJob(j)) {}
  bakedFrame = G.frameNo; bakeCount++;
  return j.c;
}
export function getChunk(cx, cy) {
  const k = cx + ',' + cy; let e = chunks.get(k);
  if (!e) { e = { c: bakeChunk(cx, cy), used: G.frameNo }; chunks.set(k, e); evict(k); }
  e.used = G.frameNo; return e.c;
}
function evict(keep: string) {
  if (chunks.size <= CHUNK_MAX) return;
  let old = null, ou = Infinity; for (const [kk, v] of chunks) if (v.used < ou && kk !== keep) { ou = v.used; old = kk; } if (old) chunks.delete(old);
}
const BUDGET_MS = 3;                                                      // 每幀最多花幾毫秒在背景烘焙
export function prefetchChunks(cx, cy) {
  if (bakedFrame === G.frameNo) return;                                   // 這一幀已經同步烤過一塊了，不要再加重
  const t0 = performance.now();
  while (performance.now() - t0 < BUDGET_MS) {
    if (!job) { const n = nextMissing(cx, cy); if (!n) return; job = beginJob(n[0], n[1]); }
    if (stepJob(job)) { const k = job.cx + ',' + job.cy; chunks.set(k, { c: job.c, used: G.frameNo - 1 }); evict(k); bakeCount++; job = null; }
  }
}
function nextMissing(cx, cy) {                                            // 畫面周圍一圈還沒烤的塊，離中心近的先烤
  const gx0 = Math.floor(cx / CPX) - 1, gx1 = Math.floor((cx + LW) / CPX) + 1, gy0 = Math.floor(cy / CPX) - 1, gy1 = Math.floor((cy + LH) / CPX) + 1;
  const mx = (cx + LW / 2) / CPX, my = (cy + LH / 2) / CPX; let best = null, bd = Infinity;
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    if (gx < 0 || gy < 0 || gx * CH >= MW || gy * CH >= MH || chunks.has(gx + ',' + gy)) continue;
    const d = (gx + .5 - mx) ** 2 + (gy + .5 - my) ** 2; if (d < bd) { bd = d; best = [gx, gy]; } }
  return best;
}
export function invalidate(tx, ty) { for (let y = ty - 6; y <= ty + 6; y += 2) for (let x = tx - 4; x <= tx + 4; x += 2) { const gx = Math.floor(clamp(x, 0, MW - 1) / CH), gy = Math.floor(clamp(y, 0, MH - 1) / CH);
  chunks.delete(gx + ',' + gy); if (job && job.cx === gx && job.cy === gy) job = null; } }

/* ---------- 會動的場景：火焰、營火、火盆、發光蘑菇 ---------- */
export function flame(x, y, h, seed, cols?: string[]) {                        // cols：換色（區域 Boss 的冰火之類），沒給就是一般的火
  const q = HK, f = Math.sin(G.time * 14 + seed) * .5 + .5, H = Math.round((h + f * 2) / q * .9), W = Math.max(4, Math.round(H * .5)), X = asn(x), Y = asn(y);
  for (const [col, s] of (cols ? [[cols[0], 1], [cols[1], .78], [cols[2], .54], [cols[3], .28]] : [['#c8401e', 1], ['#f08a2e', .78], ['#ffd04a', .54], ['#fff6d0', .28]]) as [string, number][]) {
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
