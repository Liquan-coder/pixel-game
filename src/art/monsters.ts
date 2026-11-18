import { HK } from '../core/canvas';
import { OL, makeSprite } from './sprite';
import { ROWS } from './hero';

export const SPR: Record<string, any> = {
  slime: makeSprite(ROWS.slime, { o:OL, g:'#5ad06a', G:'#2f8f45', w:'#d8ffd8' }),
  slimeM: makeSprite(ROWS.slime, { o:OL, g:'#e8743b', G:'#a83a1a', w:'#ffe38a' }),
  skel: makeSprite(ROWS.skel, { o:OL, b:'#e8e2d0', B:'#a8a090', e:'#ff4a4a' }),
  skelE: makeSprite(ROWS.skel, { o:OL, b:'#c8b4a0', B:'#8a6a5a', e:'#ff8a3a' }),
  wolf: makeSprite(ROWS.wolf, { o:OL, f:'#7d8296', F:'#4f5366', m:'#d6d9e2', e:'#ffd04a', t:'#f1ead8' }),
  wolfF: makeSprite(ROWS.wolf, { o:OL, f:'#56634f', F:'#36412f', m:'#b8c8a8', e:'#ffd04a', t:'#f1ead8' }),
  golem: makeSprite(ROWS.golem, { o:OL, s:'#8a85a0', S:'#56516b', m:'#5f9a4e', y:'#7fe8ff' }),
  golemL: makeSprite(ROWS.golem, { o:OL, s:'#5a4448', S:'#3a2a2e', m:'#e8743b', y:'#ffcf4a' }),
  shroom: makeSprite(ROWS.shroom, { o:OL, m:'#c0405f', M:'#7d2440', w:'#f6e9ee', t:'#ece0c4', T:'#b8aa8a', e:OL }),
  treant: makeSprite(ROWS.treant, { o:OL, f:'#3e7d3a', F:'#2a5a29', n:'#6b4a2f', N:'#4a321f', y:'#f4e04d' }),
  boss: makeSprite(["....................o..o......","...................omoomo.....","..................ommmmmmo....",".................ommffffffo...","........oooooo..ommffeffffo...","......oommmmmmoommfffffffffoo.","....oommmmmmmmmmmmffffffoottoo","...ommmMMmmmmmmmmffffffotttto.","..oMmmMMMmmmmmmmfffffffooooo..",".oFoMMMfffffffffffffffo.......","oFoooMffffffffffffffffFo......","oo..oFFfffffffffffffFFo.......","....oFFFffffffffffffFFo.......","....oFFoFFFFFFFFFFoFFFo.......","....oFFooFFo..oFFooFFo........","....oFFo.oFo..oFFo.oFo........","...oFFFo.oFFo.oFFFooFFo.......","...ooooo.oooo.ooooo.ooo......."], { o:'#0b0910', m:'#c9ccd8', M:'#8d90a3', f:'#4a4d63', F:'#2f3142', e:'#ff3b3b', t:'#f1ead8' }),
};
/* ---- monster sculptor: shapes -> lit pixel art with 1px outline ---- */
const LDIR = (() => { const l = [-.5, -.72, .55], m = Math.hypot(...l); return l.map(v => v / m); })();
export function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export const SH = {
  ell: (cx, cy, rx, ry, clip?) => (x, y) => { if (clip && !clip(x, y)) return null; const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy; return d > 1 ? null : [dx, dy, Math.sqrt(1 - d)]; },
  cap: (x0, y0, x1, y1, r0, r1) => (x, y) => { const vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy || 1; let t = ((x - x0) * vx + (y - y0) * vy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = x0 + vx * t, qy = y0 + vy * t, r = r0 + (r1 - r0) * t, dx = (x - qx) / r, dy = (y - qy) / r, d = dx * dx + dy * dy; return d > 1 ? null : [dx, dy, Math.sqrt(1 - d)]; },
  box: (cx, cy, rx, ry, p = 3, clip?) => (x, y) => { if (clip && !clip(x, y)) return null; const dx = (x - cx) / rx, dy = (y - cy) / ry, s = Math.abs(dx) ** p + Math.abs(dy) ** p; if (s > 1) return null;
    const nx = Math.sign(dx) * Math.abs(dx) ** (p * 1.6), ny = Math.sign(dy) * Math.abs(dy) ** (p * 1.6); return [nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))]; },
  spiky: (cx, cy, rx, ry, n, amp, rot = 0) => (x, y) => { const dx = (x - cx) / rx, dy = (y - cy) / ry, d = Math.hypot(dx, dy); const f = (((Math.atan2(dy, dx) + rot) / (2 * Math.PI)) * n % 1 + 1) % 1;
    const r = 1 - amp + amp * (1 - Math.abs(f * 2 - 1)); if (d > r) return null; const q = d / r; return [dx / (d || 1) * q, dy / (d || 1) * q, Math.sqrt(Math.max(0, 1 - q * q))]; },
  poly: (pts) => (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c ? [0, 0, 1] : null; },
  tri: (cx, y0, y1, hw, jag = 2) => (x, y) => { if (y < y0 || y > y1) return null; const u = (y - y0) / (y1 - y0), w = hw * u;
  const yb = y1 - Math.abs(Math.sin(x * 1.1)) * jag; if (Math.abs(x - cx) > w || y > yb) return null; const nx = (x - cx) / (w || 1); return [nx * .85, -.35 + u * .4, .5]; },   // 三角（樹、尖刺）
};
// parts: {sh, ramp (dark->light), tex, bias, rim, grp}; post(api) paints details
export function sculpt(w, h, parts, post?) {
  const N = w * h, pid = new Int16Array(N).fill(-1), kk = new Float32Array(N), col = new Array(N).fill(null);
  parts.forEach((p, i) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = p.sh(x + .5, y + .5); if (!n) continue;
    let I = n[0] * LDIR[0] + n[1] * LDIR[1] + n[2] * LDIR[2] + (p.bias || 0);
    if (p.tex) I += (hash2(x + i * 7, y) - .5) * p.tex;
    pid[y * w + x] = i; kk[y * w + x] = (I + .1) / 1.05 * (p.ramp.length - 1); } });
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? -1 : pid[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, a = pid[i]; if (a < 0) continue; const p = parts[a]; let k = kk[i];
    if (p.rim !== false) { if (at(x - 1, y) !== a && at(x, y - 1) !== a) k += 1; else if (at(x + 1, y) !== a && at(x, y + 1) !== a) k -= .6; }
    let line = false; const g = p.grp ?? a;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const b = at(x + dx, y + dy); if (b >= 0 && b < a && (parts[b].grp ?? b) !== g && !p.noline) line = true; }
    k = Math.max(0, Math.min(p.ramp.length - 1, Math.round(k)));
    col[i] = line ? (p.line || p.ramp[0]) : p.ramp[k]; }
  const api = { w, h, set: (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) col[y * w + x] = c; },
    get: (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : col[Math.round(y) * w + Math.round(x)], pid: (x, y) => at(Math.round(x), Math.round(y)), hash: hash2,
    rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) this.set(x + i, y + j, c); },
    ell(cx, cy, rx, ry, c, only) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1 && (!only || this.get(x, y))) this.set(x, y, c); } },
    line(x0, y0, x1, y1, c) { const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1; for (let i = 0; i <= n; i++) this.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); } };
  if (post) post(api);
  // outline (4-neighbour)
  const out = col.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (col[y * w + x]) continue;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && col[Y * w + X]) { out[y * w + x] = OL; break; } } }
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  for (let i = 0; i < N; i++) if (out[i]) { g.fillStyle = out[i]; g.fillRect(i % w, (i / w) | 0, 1, 1); }
  return c;
}

const RAMP = {
  slime: ['#1d5a32','#2f8f45','#4fbf5a','#7fe07a','#c8ffc0'], slimeM: ['#6a1a08','#a83a1a','#e8743b','#ffae4a','#ffe38a'],
  wolf: ['#252836','#4a4e62','#767b90','#a3a8bc','#d6d9e6'], wolfF: ['#1a2218','#334030','#52604a','#7a8a6c','#b0c4a0'],
  boss: ['#1c1d28','#383a4c','#5c5f76','#8a8ea6','#c4c8da'],
  bone: ['#5e584c','#8a8474','#b8b2a0','#e2dcc8','#fffaf0'], ash: ['#3e3028','#6a5244','#987a68','#c4a894','#e8d6c4'],
  stone: ['#262234','#46415a','#6e6986','#9c97b4','#cac6de'], basalt: ['#140e10','#2e2226','#4a3a3e','#6a5458','#8c7478'],
  cap: ['#4a1024','#7d2440','#c0405f','#e86a84','#ffb0c0'], stem: ['#7a6a4a','#a89a7a','#d8ccae','#f4ead2'],
  gill: ['#5a4a36','#8a7a5a','#b8a882'], bark: ['#24160c','#432c1a','#634528','#86643e','#a8865a'],
  leaf: ['#14301a','#245226','#367434','#549a44','#86c464'], steel: ['#3e3b63','#76739f','#a9a7d0','#dcdcf4'],
};
/* 走路：ph = 0~3 是第幾格，-1 = 站著不動。回傳兩組腳的 [往前多少, 往上多少]
   一隻腳：踩在前面 → 踩在正下方 → 蹬到後面 → 抬起來收回前面；另一隻腳剛好差半圈 */
function gait(ph, d, L) {
  if (ph < 0) return [[0, 0], [0, 0]];
  const G = [[d, 0], [0, 0], [-d, 0], [0, -L]];
  return [G[ph], G[(ph + 2) % 4]];
}
function hdSlime(R, eye, spot) { return sculpt(36, 30, [
  { sh: SH.ell(18, 19, 16.5, 11.6, (x, y) => y < 29.5), ramp: R, rim: false, bias: .12 }], a => {
  a.ell(10.5, 12.5, 3.5, 1.6, R[4]); a.set(7, 15, R[4]); a.set(8, 16, R[3]);
  for (const [x, y, r] of [[13, 23, 1.6], [9, 20, 1], [30, 24, 1.2], [16, 26, 1]]) a.ell(x, y, r, r, spot);
  for (const ex of [22, 28]) { a.rect(ex, 16, 2, 5, eye); a.set(ex, 16, '#ffffff'); a.set(ex + 1, 20, R[1]); }
  a.line(24, 23, 27, 23, eye); a.set(23, 22, eye); a.set(28, 22, eye);
}); }
function hdWolf(R, s, opt: Record<string, any> = {}, ph = -1) {
  const [[ax, ay], [bx, by]] = gait(ph, 3.4, 2.2);
  const S = v => v * s, W = Math.round(52 * s), H = Math.round(31 * s), belly = opt.belly || R.slice(2), tx = opt.tex ?? .22;
  const parts = [
    { sh: SH.cap(S(12), S(14), S(3), S(7.5), S(3.8), S(2.8)), ramp: R, tex: tx, grp: 1 },
    { sh: SH.ell(S(3), S(7.5), S(2.8), S(2.6)), ramp: belly, grp: 1 },
    { sh: SH.ell(S(15), S(19), S(4.6), S(5.2)), ramp: R, bias: -.35, grp: 2 },
    { sh: SH.cap(S(14), S(22), S(16 + bx), S(29.5 + by), S(2), S(1.6)), ramp: R, bias: -.35, grp: 2 },
    { sh: SH.cap(S(33), S(19), S(32 + ax), S(29.5 + ay), S(2.2), S(1.7)), ramp: R, bias: -.35, grp: 3 },
    { sh: SH.ell(S(24), S(16.5), S(13.5), S(7)), ramp: R, tex: tx, grp: 4 },
    { sh: SH.ell(S(24.5), S(20.5), S(10), S(2.4)), ramp: belly, grp: 4, rim: false },
    { sh: SH.ell(S(35.5), S(16), S(6.6), S(7.6)), ramp: R, tex: tx, grp: 4 },
  ];
  if (opt.mane) parts.push({ sh: SH.spiky(S(37), S(13.5), S(10), S(10.5), 11, .32, .3), ramp: opt.mane, tex: .3, grp: 5 });
  parts.push(
    { sh: SH.ell(S(18), S(19.5), S(5), S(5.6)), ramp: R, tex: tx, grp: 6 },
    { sh: SH.cap(S(17), S(23), S(19.5 + ax), S(30 + ay), S(2.3), S(1.8)), ramp: R, grp: 6 },
    { sh: SH.cap(S(37), S(20), S(36.5 + bx), S(30 + by), S(2.5), S(2)), ramp: R, grp: 7 },
    { sh: SH.poly([[S(36.5), S(8)], [S(38.5), S(0)], [S(41.5), S(6)]]), ramp: R, grp: 8 },
    { sh: SH.ell(S(41.5), S(10), S(6.6), S(5.6)), ramp: R, tex: tx * .7, grp: 8 },
    { sh: SH.cap(S(44), S(11.5), S(50), S(13), S(3.3), S(2.1)), ramp: R, grp: 8 },
    { sh: SH.poly([[S(41.5), S(6)], [S(44.5), S(0.5)], [S(45.5), S(7)]]), ramp: R, grp: 8 });
  return sculpt(W, H, parts, a => {
    const eye = opt.eye || '#ffd04a';
    a.rect(S(43.5), S(8.5), Math.max(2, S(2)), Math.max(1, S(1.2)), eye); a.set(S(45), S(8.5), '#1a1210');
    a.line(S(42), S(7.3), S(45.5), S(7.7), R[0]);
    a.ell(S(50.3), S(12.2), Math.max(1, S(1)), Math.max(1, S(1)), '#141018');
    a.line(S(45), S(15), S(50), S(14.5), R[0]);
    for (const t of [46, 48.5]) a.set(S(t), S(15.8), '#f4eee0');
    for (const [lx, dx, dy] of [[16, bx, by], [19.5, ax, ay], [32, ax, ay], [36.5, bx, by]]) a.rect(S(lx + dx) - Math.max(1, S(1.2)), S(29.3 + dy), Math.max(3, S(2.6)), Math.max(1, S(.8)), R[lx === 16 || lx === 32 ? 2 : 3]);   // 腳掌
    for (let i = 0; i < 6; i++) { const x = S(14 + i * 3.4), y = S(10.5 + Math.abs(i - 2.5) * .4); a.line(x, y, x + S(1.4), y + S(1.6), R[1]); }
    if (opt.scar) { a.line(S(40), S(5.8), S(43.3), S(11.5), '#c03440'); a.line(S(40.6), S(5.8), S(43.9), S(11.5), '#801a24'); }
  });
}
function hdSkel(R, eyeC, ph = -1) { const [[ax, ay], [bx, by]] = gait(ph, 3, 2.2); return sculpt(36, 51, [
  { sh: SH.cap(12, 22, 8 - bx * .7, 33, 1.7, 1.5), ramp: R, bias: -.3, grp: 1 },
  { sh: SH.cap(15, 38, 13 + bx, 50 + by, 2, 1.7), ramp: R, bias: -.25, grp: 2 },
  { sh: SH.cap(18, 19, 18, 36, 1.6, 1.6), ramp: R, grp: 3 },
  { sh: SH.ell(18.5, 26, 7.5, 6.2), ramp: R, grp: 3 },
  { sh: SH.ell(18.5, 36.5, 6.5, 3), ramp: R, grp: 4 },
  { sh: SH.cap(22, 38, 23.5 + ax, 50 + ay, 2.1, 1.8), ramp: R, grp: 5 },
  { sh: SH.cap(31, 33, 34, 13, 1.3, 1), ramp: RAMP.steel, grp: 9 },
  { sh: SH.cap(26, 22, 30, 32, 1.8, 1.6), ramp: R, grp: 6 },
  { sh: SH.box(20, 18.2, 5.6, 2.4, 4), ramp: R, grp: 7 },
  { sh: SH.ell(18.5, 11, 8.6, 8.2), ramp: R, grp: 7 },
], a => {
  for (const ry of [23.5, 26.5, 29.5]) for (let x = 13; x <= 24; x++) if (a.pid(x, ry) === 3 && x !== 18) a.set(x, ry, R[0]);
  for (const ex of [16, 22.5]) { a.ell(ex, 11.5, 2.2, 2.4, '#14100c'); a.set(ex, 11.5, eyeC); a.set(ex - .5, 10.5, eyeC); }
  a.set(19.5, 15, '#14100c'); a.set(20, 14.5, '#14100c');
  for (let x = 16; x <= 24; x += 2) a.set(x, 18, R[0]); a.line(15.5, 17.2, 25, 17.2, R[0]);
  a.rect(28, 31, 6, 1, '#c0862c'); a.rect(30, 32, 2, 2, '#7a4a1a');
  for (const [x, y] of [[18, 37], [23 + ax / 2, 44 + ay / 2], [14 + bx / 2, 44 + by / 2], [10, 28], [28, 27]]) a.set(x, y, R[1]);
}); }
function hdGolem(R, opt, ph = -1) { const [[ax, ay], [bx, by]] = gait(ph, 1.6, 3); return sculpt(48, 43, [
  { sh: SH.ell(9, 22 + ax * .5, 6.5, 9), ramp: R, bias: -.25, tex: .4, grp: 1 },
  { sh: SH.ell(8.5, 32 + ax, 5.2, 4.2), ramp: R, bias: -.25, tex: .4, grp: 1 },
  { sh: SH.box(17 - bx * .5, 37 + by, 5.2, 5.8, 3), ramp: R, tex: .4, grp: 2 },
  { sh: SH.box(31 + ax * .5, 37 + ay, 5.2, 5.8, 3), ramp: R, tex: .4, grp: 3 },
  { sh: SH.box(24, 22, 14.5, 12, 2.6), ramp: R, tex: .45, grp: 4 },
  { sh: SH.box(25, 8.5, 7.2, 5.6, 3), ramp: R, tex: .4, grp: 5 },
  { sh: SH.ell(40, 22 + bx * .5, 6.8, 9.2), ramp: R, tex: .4, grp: 6 },
  { sh: SH.ell(41, 32.5 + bx, 5.8, 4.6), ramp: R, tex: .4, grp: 6 },
], a => {
  for (const [x0, y0, x1, y1] of [[14, 15, 18, 22], [18, 22, 16, 27], [30, 26, 34, 30], [42, 18, 39, 23], [21, 6, 22, 10]]) a.line(x0, y0, x1, y1, opt.crack);
  if (opt.glowCrack) for (const [x0, y0, x1, y1] of [[14, 15, 18, 22], [30, 26, 34, 30], [42, 18, 39, 23]]) a.line(x0 + 1, y0, x1 + 1, y1, opt.glowCrack);
  for (const ex of [23, 28]) { a.rect(ex, 8, 3, 2, opt.eye); a.set(ex + 1, 8, '#ffffff'); }
  a.line(24, 18, 27, 21, opt.eye); a.line(27, 21, 24, 24, opt.eye); a.line(24, 24, 21, 21, opt.eye); a.line(21, 21, 24, 18, opt.eye); a.set(24, 21, '#ffffff');
  if (opt.moss) for (let y = 0; y < 43; y++) for (let x = 0; x < 48; x++) { const p = a.pid(x, y); if (p < 0 || a.pid(x, y - 1) === p) continue;
    if (a.hash(x, y) < .8) { a.set(x, y, opt.moss[2]); a.set(x, y + 1, opt.moss[1]); if (a.hash(y, x) < .4) a.set(x, y + 2, opt.moss[0]); } }
}); }
function hdShroom(ph = -1) { const [[ax, ay], [bx, by]] = gait(ph, 1.5, 1.6); return sculpt(36, 34, [
  { sh: SH.ell(13 + bx, 32 + by, 4, 2), ramp: RAMP.stem, grp: 1 }, { sh: SH.ell(23 + ax, 32 + ay, 4, 2), ramp: RAMP.stem, grp: 1 },
  { sh: SH.box(18, 25, 7, 7.5, 2.5), ramp: RAMP.stem, grp: 2 },
  { sh: SH.ell(18, 15.5, 15, 3.4), ramp: RAMP.gill, grp: 3, rim: false },
  { sh: SH.ell(18, 13.5, 17, 11.8, (x, y) => y < 15.8), ramp: RAMP.cap, grp: 4 },
], a => {
  for (const [x, y, rx, ry] of [[8, 9, 3, 2], [17, 5, 3.2, 2], [26.5, 9, 3.4, 2.2], [12, 13, 2, 1.3], [30, 13.5, 1.8, 1]]) { a.ell(x, y, rx, ry, '#fff4f6'); a.ell(x + .6, y + ry * .6, rx * .7, .8, '#e6c2cc'); }
  for (const ex of [20, 25]) { a.rect(ex, 22, 1, 3, '#1a1012'); }
  a.line(19, 21, 21, 21.5, '#5a3a2a'); a.line(24, 21.5, 26, 21, '#5a3a2a');
  a.line(21, 27, 24, 27, '#5a2a2a'); a.set(20, 26, '#5a2a2a');
}); }
function hdTreant(ph = -1) { const [[ax, ay], [bx, by]] = gait(ph, 2, 2.6); return sculpt(45, 48, [
  { sh: SH.cap(14, 25, 4, 33 + ax, 2.6, 1.8), ramp: RAMP.bark, bias: -.2, tex: .3, grp: 1 },
  { sh: SH.ell(3.5, 33.5 + ax, 3.6, 3.2), ramp: RAMP.leaf, tex: .5, grp: 1 },
  { sh: SH.cap(16, 40, 9 - bx * .5, 47 + by, 3, 2), ramp: RAMP.bark, tex: .3, grp: 2 },
  { sh: SH.cap(28, 40, 35 + ax * .5, 47 + ay, 3, 2), ramp: RAMP.bark, tex: .3, grp: 2 },
  { sh: SH.cap(22, 41, 22, 47, 3.2, 2.6), ramp: RAMP.bark, tex: .3, grp: 2 },
  { sh: SH.box(22, 31, 10, 13, 2.4), ramp: RAMP.bark, tex: .35, grp: 3 },
  { sh: SH.ell(22, 18, 13, 6.5), ramp: RAMP.leaf, tex: .5, grp: 4 },
  { sh: SH.ell(13, 13, 10, 8.5), ramp: RAMP.leaf, tex: .5, grp: 4 },
  { sh: SH.ell(31, 12.5, 11, 9), ramp: RAMP.leaf, tex: .5, grp: 4 },
  { sh: SH.ell(22, 7, 10, 7), ramp: RAMP.leaf, tex: .5, grp: 4 },
  { sh: SH.cap(31, 25, 40, 33 + bx, 2.8, 2), ramp: RAMP.bark, tex: .3, grp: 5 },
  { sh: SH.ell(41.5, 34 + bx, 3.6, 3.2), ramp: RAMP.leaf, tex: .5, grp: 5 },
], a => {
  for (const [x, y0] of [[15, 24], [19, 30], [28, 26], [25, 36]]) for (let y = y0; y < y0 + 7; y++) a.set(x + Math.round(Math.sin(y * .9)), y, RAMP.bark[0]);
  for (const ex of [19, 26]) { a.ell(ex, 28, 2.2, 1.8, '#120a06'); a.set(ex, 28, '#f4e04d'); a.set(ex + 1, 28, '#fff8a0'); }
  a.ell(22.5, 34, 3, 1.4, '#120a06');
  for (const [x, y] of [[9, 9], [30, 7], [36, 14], [17, 4], [24, 15]]) { a.set(x, y, '#f2a4c8'); a.set(x + 1, y, '#ffd8ea'); }
}); }
function makeHD(c, extra?) {
  const mk = (flip, solid?) => { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const g = o.getContext('2d');
    if (flip) { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(c, 0, 0);
    if (solid) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = solid; g.fillRect(0, 0, c.width, c.height); } return o; };
  const sp = { hd: true, aw: c.width, ah: c.height, n: mk(false), f: mk(true), wn: mk(false, '#ffffff'), wf: mk(true, '#ffffff'), gn: mk(false, '#f2c14e'), gf: mk(true, '#f2c14e'), rn: mk(false, '#ff4a4a'), rf: mk(true, '#ff4a4a'), ...extra };
  Object.defineProperty(sp, 'w', { get() { return this.aw * HK; } }); Object.defineProperty(sp, 'h', { get() { return this.ah * HK; } });
  return sp;
}
function hdQueen() { const G = RAMP.slime;                            // 史萊姆女王：大史萊姆 + 金色王冠
  return sculpt(96, 82, [
    { sh: SH.ell(48, 54, 46, 27, (x, y) => y < 81), ramp: G, rim: false, bias: .1, grp: 1 },
    { sh: SH.poly([[28, 31], [31, 10], [39, 22], [48, 4], [57, 22], [65, 10], [68, 31]]), ramp: ['#7a4a1a', '#c0862c', '#f2c14e', '#fff0a8'], grp: 2 },
  ], a => {
    a.ell(26, 40, 9, 3.5, G[4]); a.ell(20, 46, 2, 2, G[4]);
    for (const [x, y, r] of [[34, 66, 3.5], [22, 60, 2], [70, 67, 2.6], [58, 73, 2], [80, 58, 1.6]]) a.ell(x, y, r, r, '#a8f0a0');
    for (const ex of [40, 58]) { a.ell(ex, 51, 4.5, 6.5, '#0e2a18'); a.ell(ex - 1.5, 48, 1.6, 2, '#ffffff'); }
    a.line(34, 42, 44, 45, '#0e2a18'); a.line(64, 42, 54, 45, '#0e2a18');
    a.ell(49, 65, 6, 2.5, '#0e2a18'); a.rect(46, 64, 2, 1, '#ffffff'); a.rect(51, 64, 2, 1, '#ffffff');
    for (const [x, y, c] of [[31, 14, '#ff4a6a'], [48, 9, '#5a8cff'], [65, 14, '#ff4a6a']] as const) { a.ell(x, y, 2.2, 2.2, c); a.set(x - 1, y - 1, '#ffffff'); }
    a.rect(30, 27, 37, 2, '#7a4a1a');
  }); }
function hdGeneral() {                                                 // 骸骨將軍：生鏽盔甲、角盔、破披風、巨劍
  const ARM = ['#2a2524', '#4a403c', '#6e5e54', '#927e6c', '#b8a28a'], BN = RAMP.bone, CAPE = ['#3a0a10', '#6a1420', '#9a2030', '#c03040'];
  return sculpt(96, 102, [
    { sh: SH.poly([[30, 34], [56, 34], [64, 96], [22, 96]]), ramp: CAPE, tex: .3, grp: 1 },
    { sh: SH.cap(38, 72, 35, 98, 4.5, 4), ramp: ARM, tex: .3, grp: 2 }, { sh: SH.cap(52, 72, 56, 98, 4.5, 4), ramp: ARM, tex: .3, grp: 3 },
    { sh: SH.box(45, 55, 16, 19, 3), ramp: ARM, tex: .35, grp: 4 },
    { sh: SH.ell(28, 42, 8.5, 7.5), ramp: ARM, tex: .3, grp: 5 }, { sh: SH.ell(62, 42, 8.5, 7.5), ramp: ARM, tex: .3, grp: 6 },
    { sh: SH.ell(45, 26, 11, 11), ramp: BN, grp: 7 }, { sh: SH.box(47, 37, 7, 3, 4), ramp: BN, grp: 7 },
    { sh: SH.ell(45, 22, 13, 10, (x, y) => y < 23), ramp: ARM, tex: .25, grp: 8 },
    { sh: SH.poly([[33, 18], [21, 3], [36, 13]]), ramp: BN, grp: 8 }, { sh: SH.poly([[57, 18], [69, 3], [54, 13]]), ramp: BN, grp: 8 },
    { sh: SH.cap(72, 66, 92, 6, 4, 2.6), ramp: ['#3e3b63', '#76739f', '#a9a7d0', '#dcdcf4'], grp: 9 },
    { sh: SH.cap(63, 70, 79, 63, 2.6, 2.6), ramp: ['#7a4a1a', '#c0862c', '#f2c14e'], grp: 9 },
    { sh: SH.cap(62, 46, 71, 64, 4, 3.5), ramp: ARM, tex: .3, grp: 10 },
  ], a => {
    for (const ex of [40, 51]) { a.ell(ex, 27, 2.6, 2.8, '#140c08'); a.set(ex, 27, '#ff9a3a'); a.set(ex, 26, '#ffd27a'); }
    a.set(45, 31, '#140c08'); a.set(46, 32, '#140c08'); for (let x = 42; x <= 52; x += 2) a.set(x, 38, BN[0]);
    for (const y of [48, 54, 60]) for (let x = 36; x <= 54; x++) if (a.get(x, y) && x !== 45) a.set(x, y, ARM[0]);
    a.ell(45, 55, 3.5, 3.5, '#c0862c'); a.set(45, 55, '#ffd27a');
    for (let k = 0; k < 20; k++) { const x = 26 + (k * 37) % 44, y = 40 + (k * 23) % 34; if (a.get(x, y)) a.set(x, y, '#8a4a20'); }
    for (let i = 0; i < 6; i++) a.set(78 + i * 2.3, 52 - i * 7.5, '#ffffff');
  }); }
function hdDragon() {                                                  // 熔岩巨龍：黑紅鱗片、發光的腹部、翅膀、角
  const SC = ['#1a0c0e', '#34161a', '#552220', '#7a3424', '#a04a2c'], BL = ['#9a3a14', '#d8582a', '#f8a840', '#ffe38a'], WG = ['#1e0808', '#3e1010', '#6a1c14', '#8e2c1a'];
  return sculpt(132, 104, [
    { sh: SH.poly([[56, 40], [14, 6], [22, 30], [6, 30], [26, 52], [16, 58], [48, 62]]), ramp: WG, tex: .25, grp: 1 },
    { sh: SH.cap(40, 74, 6, 88, 7, 2), ramp: SC, tex: .3, grp: 2 }, { sh: SH.poly([[2, 84], [10, 92], [0, 96]]), ramp: SC, grp: 2 },
    { sh: SH.cap(52, 82, 50, 101, 6, 5), ramp: SC, tex: .3, grp: 3 }, { sh: SH.cap(80, 82, 84, 101, 6, 5), ramp: SC, tex: .3, grp: 4 },
    { sh: SH.ell(66, 66, 30, 20), ramp: SC, tex: .35, grp: 5 },
    { sh: SH.ell(70, 74, 20, 8), ramp: BL, grp: 5, rim: false },
    { sh: SH.cap(84, 58, 104, 30, 9, 7), ramp: SC, tex: .3, grp: 6 },
    { sh: SH.ell(110, 26, 13, 10), ramp: SC, tex: .25, grp: 7 }, { sh: SH.cap(112, 30, 128, 34, 6, 4.5), ramp: SC, grp: 7 },
    { sh: SH.poly([[104, 18], [92, 2], [110, 14]]), ramp: ['#5a5054', '#8a8084', '#c8c0c4'], grp: 7 }, { sh: SH.poly([[112, 16], [106, 0], [118, 14]]), ramp: ['#5a5054', '#8a8084', '#c8c0c4'], grp: 7 },
    { sh: SH.poly([[76, 44], [100, 2], [108, 26], [126, 22], [104, 54], [92, 60]]), ramp: WG, tex: .25, grp: 8 },
    { sh: SH.cap(90, 80, 92, 101, 6, 5), ramp: SC, tex: .3, grp: 9 },
  ], a => {
    a.rect(112, 23, 3, 2, '#ffe38a'); a.set(113, 23, '#ffffff');
    for (let x = 114; x < 128; x += 3) a.set(x, 37, '#fff0d0');
    a.line(118, 35, 127, 36, '#3a0a08'); a.set(128, 33, '#ffb040');
    for (const [x0, y0, x1, y1] of [[100, 4, 96, 58], [100, 4, 112, 42], [14, 6, 40, 52], [14, 6, 24, 54]]) a.line(x0, y0, x1, y1, '#140606');
    for (let k = 0; k < 6; k++) { const x = 46 + k * 7, y = 56 + (k % 2) * 3; a.set(x, y, '#ff8a3a'); a.set(x + 1, y, '#ffb040'); }
    for (const [x, y] of [[60, 50], [72, 48], [84, 52], [96, 42]]) { a.set(x, y, '#c8c0c4'); a.set(x, y - 1, '#8a8084'); }
  }); }
function withWalk(build: (ph: number) => HTMLCanvasElement, extra?) {   // 站立圖 + 4 張走路圖
  const sp = makeHD(build(-1), extra); sp.walk = [0, 1, 2, 3].map(ph => makeHD(build(ph), extra)); return sp;
}
function buildMonsters() { return {
  dragon: makeHD(hdDragon()),
  general: makeHD(hdGeneral()),
  queen: makeHD(hdQueen()),
  slime: makeHD(hdSlime(RAMP.slime, '#0e2a18', '#a8f0a0')),
  slimeM: makeHD(hdSlime(RAMP.slimeM, '#2a0a04', '#fff0a0')),
  wolf: withWalk(ph => hdWolf(RAMP.wolf, 1, {}, ph)),
  wolfF: withWalk(ph => hdWolf(RAMP.wolfF, 1, {}, ph)),
  skel: withWalk(ph => hdSkel(RAMP.bone, '#ff4a4a', ph)),
  skelE: withWalk(ph => hdSkel(RAMP.ash, '#ff9a3a', ph)),
  golem: withWalk(ph => hdGolem(RAMP.stone, { eye: '#7fe8ff', crack: '#262234', moss: ['#2f5a26', '#4f8a3e', '#7ab85a'] }, ph)),
  golemL: withWalk(ph => hdGolem(RAMP.basalt, { eye: '#ffcf4a', crack: '#ff6a2a', glowCrack: '#ffcf4a' }, ph)),
  shroom: withWalk(hdShroom),
  treant: withWalk(hdTreant),
  boss: withWalk(ph => hdWolf(RAMP.boss, 1.8, { eye: '#ff3b3b', mane: ['#5c5f76','#8a8ea6','#b4b8cc','#dcdeea','#ffffff'], scar: true, belly: ['#8a8ea6','#c4c8da','#eef0f8'] }, ph), { eye: [Math.round(44 * 1.8), Math.round(9 * 1.8)] }),
}; }
Object.assign(SPR, buildMonsters());

