import { HK, ctx, snapF } from '../core/canvas';

/* ================= SPRITES ================= */
export const OL = '#0e0b14';
export function makeSprite(rows, pal, s = 1) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const mk = (flip, solid?) => {
    const c = document.createElement('canvas'); c.width = w * s; c.height = h * s;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) { const row = rows[y];
      for (let x = 0; x < row.length; x++) { const col = pal[row[x]]; if (!col) continue;
        g.fillStyle = solid || col; g.fillRect((flip ? w - 1 - x : x) * s, y * s, s, s); } }
    return c;
  };
  return { w: w * s, h: h * s, n: mk(false), f: mk(true), wn: mk(false, '#ffffff'), wf: mk(true, '#ffffff'), gn: mk(false, '#f2c14e'), gf: mk(true, '#f2c14e'), pn: mk(false, '#9a7cff'), pf: mk(true, '#9a7cff') };
}
export function drawSprite(sp, x, y, flip, white, gold) {
  if (sp.hd) {                                                          // 高解析怪物：用細像素畫，再縮放到世界大小
    const w = sp.w, h = sp.h, X = snapF(x - w / 2), Y = snapF(y - h);
    if (gold) { const gi = flip ? sp.gf : sp.gn, o = HK * 2; for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) ctx.drawImage(gi, X + dx, Y + dy, w, h); }
    ctx.drawImage(white ? (flip ? sp.wf : sp.wn) : (flip ? sp.f : sp.n), X, Y, w, h); return;
  }
  const X = Math.round(x - sp.w / 2), Y = Math.round(y - sp.h);
  if (gold) { const gi = flip ? sp.gf : sp.gn; ctx.drawImage(gi, X - 1, Y); ctx.drawImage(gi, X + 1, Y); ctx.drawImage(gi, X, Y - 1); ctx.drawImage(gi, X, Y + 1); }
  ctx.drawImage(white ? (flip ? sp.wf : sp.wn) : (flip ? sp.f : sp.n), X, Y);
}
/* ---- heroine (traced from the reference art) + weapons ---- */
function outline(rows) {
  const h = rows.length + 2, w = Math.max(...rows.map(r => r.length)) + 2;
  const g = []; for (let y = 0; y < h; y++) g.push(Array(w).fill('.'));
  rows.forEach((r, y) => [...r].forEach((ch, x) => { g[y + 1][x + 1] = ch; }));
  const out = g.map(r => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === '.')
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const c = (g[y+dy] || [])[x+dx]; if (c && c !== '.' && c !== 'o') { out[y][x] = 'o'; break; } }
  return out.map(r => r.join(''));
}
// Scale2x on a char grid (used 3x = 8x before rotating, so diagonals stay clean)
function epx(G) {
  const h = G.length, w = G[0].length, O = [];
  for (let y = 0; y < h * 2; y++) O.push(Array(w * 2));
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? '.' : G[y][x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = G[y][x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    O[y*2][x*2] = (C === A && C !== D && A !== B) ? A : P;
    O[y*2][x*2+1] = (A === B && A !== C && B !== D) ? B : P;
    O[y*2+1][x*2] = (D === C && D !== B && C !== A) ? C : P;
    O[y*2+1][x*2+1] = (B === D && B !== A && D !== C) ? D : P;
  }
  return O;
}
const EPXC = new Map();
// rotate weapon art so its tip (drawn pointing at angle `base`) points at `ang`; outline is added after rotating
export function rotGrid(rows, grip, ang, mirror, base = -Math.PI / 2) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  let cache = EPXC.get(rows); if (!cache) EPXC.set(rows, cache = []);
  let B = cache[mirror ? 1 : 0];
  if (!B) { const G = rows.map(r => { const a = [...r.padEnd(w, '.')]; return mirror ? a.reverse() : a; }); B = cache[mirror ? 1 : 0] = epx(epx(epx(G))); }
  if (mirror) base = Math.PI - base;
  const gx = (mirror ? w - 1 - grip[0] : grip[0]) + .5, gy = grip[1] + .5;
  const th = ang - base, co = Math.cos(th), si = Math.sin(th);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [cx, cy] of [[0,0],[w,0],[0,h],[w,h]]) { const dx = cx - gx, dy = cy - gy;
    const X = dx * co - dy * si, Y = dx * si + dy * co; x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); }
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
  const out = [];
  for (let Y = y0; Y < y1; Y++) { let row = '';
    for (let X = x0; X < x1; X++) { const px = X + .5, py = Y + .5;
      const sx = px * co + py * si + gx, sy = -px * si + py * co + gy;
      const bx = Math.floor(sx * 8), by = Math.floor(sy * 8);
      row += (by >= 0 && by < h * 8 && bx >= 0 && bx < w * 8) ? B[by][bx] : '.'; }
    out.push(row); }
  return { rows: outline(out), ox: -x0 + 1, oy: -y0 + 1 };
}
