import { HK } from '../core/canvas';
import { OL, makeSprite } from './sprite';
import { ROWS } from './hero';
import { SKEL_H, SKEL_PAD, SKEL_POSES, SKEL_W, SKEL_WALK, paintSkel, skelSmear } from './skeleton';

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
// pad：在上、左、右多留空間（攻擊時舉起來的手會超出原本的圖）。左右一樣寬 → 圖的中心不變；只加上面 → 腳底位置不變
export function sculpt(w0, h0, parts, post?, pad: { l?: number, r?: number, t?: number } = {}) {
  const PL = pad.l || 0, PT = pad.t || 0, w = w0 + PL + (pad.r || 0), h = h0 + PT;
  const N = w * h, pid = new Int16Array(N).fill(-1), kk = new Float32Array(N), col = new Array(N).fill(null);
  parts.forEach((p, i) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = p.sh(x - PL + .5, y - PT + .5); if (!n) continue;          // 形狀都用「原本的座標」算
    let I = n[0] * LDIR[0] + n[1] * LDIR[1] + n[2] * LDIR[2] + (p.bias || 0);
    if (p.tex) I += (hash2(x - PL + i * 7, y - PT) - .5) * p.tex;      // 紋理也用原本的座標，換動作時石頭紋路不會跳
    pid[y * w + x] = i; kk[y * w + x] = (I + .1) / 1.05 * (p.ramp.length - 1); } });
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? -1 : pid[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, a = pid[i]; if (a < 0) continue; const p = parts[a]; let k = kk[i];
    if (p.rim !== false) { if (at(x - 1, y) !== a && at(x, y - 1) !== a) k += 1; else if (at(x + 1, y) !== a && at(x, y + 1) !== a) k -= .6; }
    let line = false; const g = p.grp ?? a;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const b = at(x + dx, y + dy); if (b >= 0 && b < a && (parts[b].grp ?? b) !== g && !p.noline) line = true; }
    k = Math.max(0, Math.min(p.ramp.length - 1, Math.round(k)));
    col[i] = line ? (p.line || p.ramp[0]) : p.ramp[k]; }
  const api = { w: w0, h: h0, set: (x, y, c) => { x = Math.round(x + PL); y = Math.round(y + PT); if (x >= 0 && y >= 0 && x < w && y < h) col[y * w + x] = c; },
    get: (x, y) => { x = Math.round(x + PL); y = Math.round(y + PT); return (x < 0 || y < 0 || x >= w || y >= h) ? null : col[y * w + x]; }, pid: (x, y) => at(Math.round(x + PL), Math.round(y + PT)), hash: hash2,
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
  leaf: ['#14301a','#245226','#367434','#549a44','#86c464'],
  snowwolf: ['#4a5674','#7e8cac','#b4c0d8','#dce4f0','#ffffff'], ice: ['#1a4a7a','#3a7ac0','#6ab0e8','#a8dcff','#e8f8ff'], iceStone: ['#26304a','#46567a','#7486ac','#a6b8d8','#dceaff'],
  swampBone: ['#3a4430','#5e6a4c','#8a9470','#b4bc98','#dce0c4'], capP: ['#2a1040','#4a2070','#7a40a8','#a870d0','#d8b0f0'],
  leafS: ['#141a10','#26301a','#3a4826','#526234','#6e7e48'], barkS: ['#14100a','#2a2216','#403420','#58482c','#706038'],
  steel: ['#3e3b63','#76739f','#a9a7d0','#dcdcf4'],
};
/* 走路：ph = 0~3 是第幾格，-1 = 站著不動。回傳兩組腳的 [往前多少, 往上多少]
   一隻腳：踩在前面 → 踩在正下方 → 蹬到後面 → 抬起來收回前面；另一隻腳剛好差半圈 */
function gait(ph, d, L) {
  if (ph < 0) return [[0, 0], [0, 0]];
  const G = [[d, 0], [0, 0], [-d, 0], [0, -L]];
  return [G[ph], G[(ph + 2) % 4]];
}
/* ---- 新版小怪動作（跟骷髏同一套概念）：關節、6 格平均步伐、身體少晃、攻擊分好幾格 ---- */
/* 兩段的腳：給起點、終點、兩段長度，算出關節位置。bend = 1 → 關節往「起點→終點」的左邊彎（腳朝下時 = 往後），-1 → 往前 */
function joint(sx, sy, ex, ey, a, b, bend) {
  const dx = ex - sx, dy = ey - sy, d = Math.hypot(dx, dy) || 1, dd = Math.min(d, a + b - .01);
  const along = (a * a - b * b + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, a * a - along * along)), ux = dx / d, uy = dy / d;
  return [sx + ux * along - uy * h * bend, sy + uy * along + ux * h * bend];
}
/* 一隻有關節的腳 = 兩個 cap（大腿 + 小腿），回傳兩個 part */
function legParts(s0, e, a, b, bend, r0, rm, r1, base) {
  const j = joint(s0[0], s0[1], e[0], e[1], a, b, bend);
  return [{ ...base, sh: SH.cap(s0[0], s0[1], j[0], j[1], r0, rm) }, { ...base, sh: SH.cap(j[0], j[1], e[0], e[1], rm, r1) }];
}
/* 6 格步伐：每隻腳 = 踩地往後滑 4 格 + 抬起往前 2 格；另一組腳差半圈（+3）。[往前, 往上] */
const STEP6 = (d, L) => [[d, 0], [d / 3, 0], [-d / 3, 0], [-d, 0], [-d / 3, -L], [d * .6, -L * .8]];
const BOB6 = [0, -1, 0, 0, -1, 0];                                     // 兩組腳交錯經過時身體撐高 1 格

/* 小狼（新版）：小跑步（對角的兩隻腳一起動）、腳有關節、尾巴跟著擺、撲咬時張嘴
   ph：0~5 走路、-1 站、'crouch' 壓低蓄力、'strike' 撲出去（張嘴、四肢拉直）、'land' 落地（前腳彎下去吸收） */
const WOLF_POSES = ['crouch', 'strike', 'land'];
function hdWolf2(R, opt: Record<string, any> = {}, ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', w = !pose && +ph >= 0 ? +ph : -1, ST = STEP6(3, 2.2);
  let FA = [0, 0], FB = [0, 0], BA = [0, 0], BB = [0, 0], bd = [0, 0], hd = [0, 0], tl = [0, 0], jaw = false;
  if (w >= 0) { FA = BA = ST[w]; FB = BB = ST[(w + 3) % 6]; bd = [0, BOB6[w]]; hd = [0, BOB6[w] + [0, 0, 1, 0, 0, 1][w]]; tl = [0, [0, -1, -1, 0, 1, 1][w]]; }
  if (pose === 'crouch') { FA = [1.5, 0]; FB = [1, 0]; BA = [-1, 0]; BB = [-1.5, 0]; bd = [-1, 2]; hd = [0, 4]; tl = [0, 3]; }          // 壓低：身體往後坐、頭壓低、尾巴垂下
  if (pose === 'strike') { FA = [9, -5]; FB = [7.5, -3.5]; BA = [-8, -1]; BB = [-6.5, 0]; bd = [1, -1]; hd = [2, -1]; tl = [-2, 4]; jaw = true; }   // 撲出去：前腳往前伸、後腳蹬直、張嘴
  if (pose === 'land') { FA = [3, 0]; FB = [2.5, 0]; BA = [-5, -1]; BB = [-4, 0]; bd = [1, 1]; hd = [1, 3]; tl = [-1, 1]; }            // 落地：前腳彎、胸口往下沉
  const B = (x: number, y: number): [number, number] => [x + bd[0], y + bd[1]], Hd = (x: number, y: number): [number, number] => [x + hd[0], y + hd[1]];
  const belly = opt.belly || R.slice(2), tx = opt.tex ?? .22;
  const P = (sh, extra = {}) => ({ sh, ramp: R, ...extra });
  const tb = B(12, 14), tt = [3 + bd[0] + tl[0], 7.5 + bd[1] + tl[1]];
  const parts: any[] = [
    P(SH.cap(tb[0], tb[1], tt[0], tt[1], 3.8, 2.8), { tex: tx, grp: 1 }),
    { sh: SH.ell(tt[0], tt[1], 2.8, 2.6), ramp: belly, grp: 1 },
    P(SH.ell(...B(15, 19), 4.6, 5.2), { bias: -.35, grp: 2 }),
    ...legParts(B(14, 22), [16 + BB[0], 29.5 + BB[1]], 4.6, 3.6, 1, 1.9, 1.3, 1.1, { ramp: R, bias: -.75, grp: 2 }),    // 遠側後腳（暗一點）：腳踝往後彎
    ...legParts(B(33, 20), [32 + FA[0], 29.5 + FA[1]], 4.8, 4.8, -1, 1.9, 1.4, 1.1, { ramp: R, bias: -.75, grp: 3 }),   // 遠側前腳：站著打直，抬腳時腕關節才往前折
    P(SH.ell(...B(24, 16.5), 13.5, 7), { tex: tx, grp: 4 }),
    { sh: SH.ell(...B(24.5, 20.5), 10, 2.4), ramp: belly, grp: 4, rim: false },
    P(SH.ell(...B(35.5, 16), 6.6, 7.6), { tex: tx, grp: 4 }),
    P(SH.ell(...B(18, 19.5), 5, 5.6), { tex: tx, grp: 6 }),
    ...legParts(B(17, 23), [19.5 + BA[0], 30 + BA[1]], 4.6, 3.6, 1, 2.2, 1.5, 1.3, { ramp: R, grp: 6 }),
    ...legParts(B(37, 21), [36.5 + FB[0], 30 + FB[1]], 4.6, 4.6, -1, 2.2, 1.6, 1.3, { ramp: R, grp: 7 }),
    P(SH.poly([Hd(36.5, 8), Hd(38.5, 0), Hd(41.5, 6)]), { grp: 8 }),
    P(SH.ell(...Hd(41.5, 10), 6.6, 5.6), { tex: tx * .7, grp: 8 }),
  ];
  if (jaw) parts.push({ sh: SH.ell(...Hd(46.5, 14), 3.6, 2.2), ramp: ['#3a0a10', '#5a1420', '#7a2030'], grp: 8, rim: false, noline: true },   // 張開的嘴巴裡面
    P(SH.cap(...Hd(44, 10.6), ...Hd(50.5, 11.2), 3, 1.9), { grp: 8 }),                                  // 上顎
    P(SH.cap(...Hd(43.5, 14.5), ...Hd(48.5, 17.8), 1.9, 1.2), { grp: 8 }));                           // 下顎往下張
  else parts.push(P(SH.cap(...Hd(44, 11.5), ...Hd(50, 13), 3.3, 2.1), { grp: 8 }));
  parts.push(P(SH.poly([Hd(41.5, 6), Hd(44.5, .5), Hd(45.5, 7)]), { grp: 8 }));
  return sculpt(52, 31, parts, a => {
    const eye = opt.eye || '#ffd04a', h = Hd;
    a.rect(...h(43.5, 8.5), 2, 1, eye); a.set(...h(45, 8.5), '#1a1210');
    a.line(...h(42, 7.3), ...h(45.5, 7.7), R[0]);
    a.ell(...h(jaw ? 50.8 : 50.3, jaw ? 10.8 : 12.2), 1, 1, '#141018');
    if (jaw) { for (const t of [46.5, 49]) a.set(...h(t, 12.8), '#f4eee0'); for (const t of [45.5, 47.5]) a.set(...h(t, 15.6 + (t - 45) * .5), '#f4eee0'); }   // 上下兩排尖牙
    else { a.line(...h(45, 15), ...h(50, 14.5), R[0]); for (const t of [46, 48.5]) a.set(...h(t, 15.8), '#f4eee0'); }
    if (pose === 'crouch') a.line(...h(41, 6.8), ...h(45.5, 8.2), R[0]);   // 壓低時皺眉
    for (const [lx, ly, dx, dy, c] of [[16, 29.3, ...BB, 1], [19.5, 29.8, ...BA, 3], [32, 29.3, ...FA, 1], [36.5, 29.8, ...FB, 3]]) a.rect(lx + dx - 1, ly + dy, 2.5, 1, R[c]);   // 腳掌（遠側暗、近側亮）
    for (let i = 0; i < 6; i++) { const x = 14 + i * 3.4 + bd[0], y = 10.5 + Math.abs(i - 2.5) * .4 + bd[1]; a.line(x, y, x + 1.4, y + 1.6, R[1]); }   // 背上的毛
  }, { l: 2, r: 2, t: 2 });
}
function hdSlime(R, eye, spot) { return sculpt(36, 30, [
  { sh: SH.ell(18, 19, 16.5, 11.6, (x, y) => y < 29.5), ramp: R, rim: false, bias: .12 }], a => {
  a.ell(10.5, 12.5, 3.5, 1.6, R[4]); a.set(7, 15, R[4]); a.set(8, 16, R[3]);
  for (const [x, y, r] of [[13, 23, 1.6], [9, 20, 1], [30, 24, 1.2], [16, 26, 1]]) a.ell(x, y, r, r, spot);
  for (const ex of [22, 28]) { a.rect(ex, 16, 2, 5, eye); a.set(ex, 16, '#ffffff'); a.set(ex + 1, 20, R[1]); }
  a.line(24, 23, 27, 23, eye); a.set(23, 22, eye); a.set(28, 22, eye);
}); }
function hdWolf(R, s, opt: Record<string, any> = {}, ph: number | string = -1) {
  let [[ax, ay], [bx, by]] = gait(typeof ph === 'string' ? -1 : ph, 3.4, 2.2);
  let FA = [ax, ay], FB = [bx, by], BA = [ax, ay], BB = [bx, by];       // 前腳 A/B、後腳 A/B 的偏移
  if (ph === 'strike') { FA = [9, -5]; FB = [7.5, -3.5]; BA = [-8, -1]; BB = [-6.5, 0]; }   // 撲出去：前腳伸直、後腳蹬直
  const S = v => v * s, W = Math.round(52 * s), H = Math.round(31 * s), belly = opt.belly || R.slice(2), tx = opt.tex ?? .22;
  const parts = [
    { sh: SH.cap(S(12), S(14), S(3), S(7.5), S(3.8), S(2.8)), ramp: R, tex: tx, grp: 1 },
    { sh: SH.ell(S(3), S(7.5), S(2.8), S(2.6)), ramp: belly, grp: 1 },
    { sh: SH.ell(S(15), S(19), S(4.6), S(5.2)), ramp: R, bias: -.35, grp: 2 },
    { sh: SH.cap(S(14), S(22), S(16 + BB[0]), S(29.5 + BB[1]), S(2), S(1.6)), ramp: R, bias: -.35, grp: 2 },
    { sh: SH.cap(S(33), S(19), S(32 + FA[0]), S(29.5 + FA[1]), S(2.2), S(1.7)), ramp: R, bias: -.35, grp: 3 },
    { sh: SH.ell(S(24), S(16.5), S(13.5), S(7)), ramp: R, tex: tx, grp: 4 },
    { sh: SH.ell(S(24.5), S(20.5), S(10), S(2.4)), ramp: belly, grp: 4, rim: false },
    { sh: SH.ell(S(35.5), S(16), S(6.6), S(7.6)), ramp: R, tex: tx, grp: 4 },
  ];
  if (opt.mane) parts.push({ sh: SH.spiky(S(37), S(13.5), S(10), S(10.5), 11, .32, .3), ramp: opt.mane, tex: .3, grp: 5 });
  parts.push(
    { sh: SH.ell(S(18), S(19.5), S(5), S(5.6)), ramp: R, tex: tx, grp: 6 },
    { sh: SH.cap(S(17), S(23), S(19.5 + BA[0]), S(30 + BA[1]), S(2.3), S(1.8)), ramp: R, grp: 6 },
    { sh: SH.cap(S(37), S(20), S(36.5 + FB[0]), S(30 + FB[1]), S(2.5), S(2)), ramp: R, grp: 7 },
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
    for (const [lx, dx, dy] of [[16, ...BB], [19.5, ...BA], [32, ...FA], [36.5, ...FB]]) a.rect(S(lx + dx) - Math.max(1, S(1.2)), S(29.3 + dy), Math.max(3, S(2.6)), Math.max(1, S(.8)), R[lx === 16 || lx === 32 ? 2 : 3]);   // 腳掌
    for (let i = 0; i < 6; i++) { const x = S(14 + i * 3.4), y = S(10.5 + Math.abs(i - 2.5) * .4); a.line(x, y, x + S(1.4), y + S(1.6), R[1]); }
    if (opt.scar) { a.line(S(40), S(5.8), S(43.3), S(11.5), '#c03440'); a.line(S(40.6), S(5.8), S(43.9), S(11.5), '#801a24'); }
  });
}
/* 骷髏兵：照參考圖描的（src/art/skeleton.ts）。ph：0~3 走路、-1 站、'raise' 舉劍、'strike' 往前劈 */
function hdSkel(R, eyeC, ph: number | string = -1) {
  const pad = typeof ph === 'string' ? SKEL_PAD[ph] || {} : {}, c = sculpt(SKEL_W, SKEL_H, [], a => paintSkel(a.set, R, eyeC, ph), pad);
  const sm = skelSmear(ph); if (!sm.length) return c;
  const g = c.getContext('2d'), img = g.getImageData(0, 0, c.width, c.height), d = img.data;   // 劍的殘影：半透明、只畫在空白的地方、不加外框
  for (const [x, y, al] of sm) { const X = x + (pad.l || 0), Y = y + (pad.t || 0); if (X < 0 || Y < 0 || X >= c.width || Y >= c.height) continue;
    const i = (Y * c.width + X) * 4; if (d[i + 3]) continue; d[i] = 255; d[i + 1] = 250; d[i + 2] = 240; d[i + 3] = Math.round(al * 255); }
  g.putImageData(img, 0, 0); return c;
}
/* ph：0~3 走路、-1 站、'raise' = 雙拳舉過頭、'strike' = 雙拳砸到地上 */
function hdGolem(R, opt, ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', [[ax, ay], [bx, by]] = gait(pose ? -1 : +ph, 1.6, 3);
  let LA = [9 - ax * .3, 22 + ax * .8], LF = [8.5 - ax * .6, 32 + ax * 1.8], RA = [40 + bx * .3, 22 + bx * .8], RF = [41 + bx * .6, 32.5 + bx * 1.8];
  let dy = 0;                                                             // 身體（軀幹 + 頭）往下沉多少
  if (pose === 'ready') { LA = [10, 25]; LF = [12, 34]; RA = [38, 25]; RF = [36, 34]; dy = 2; }      // 蓄力：蹲低、拳頭收在腰邊
  if (pose === 'raise') { LA = [11, 11]; LF = [16, -1]; RA = [38, 11]; RF = [33, -1]; dy = -1; }
  if (pose === 'mid') { LA = [12, 19]; LF = [18, 16]; RA = [36, 19]; RF = [30, 16]; }                // 揮到一半：拳頭在胸前往下砸
  if (pose === 'strike') { LA = [13, 29]; LF = [17, 39.5]; RA = [35, 29]; RF = [31, 39.5]; dy = 2; }
  if (pose === 'recoil') { LA = [11, 25]; LF = [14, 33]; RA = [37, 25]; RF = [34, 33]; dy = 1; }    // 收招：拳頭從地上抬起來
  const L = [{ sh: SH.ell(LA[0], LA[1], 6.5, 9), ramp: R, bias: -.25, tex: .4, grp: 1 }, { sh: SH.ell(LF[0], LF[1], 5.2, 4.2), ramp: R, bias: -.25, tex: .4, grp: 1 }];
  const Rr = [{ sh: SH.ell(RA[0], RA[1], 6.8, 9.2), ramp: R, tex: .4, grp: 6 }, { sh: SH.ell(RF[0], RF[1], 5.8, 4.6), ramp: R, tex: .4, grp: 6 }];
  const body = [
    { sh: SH.box(17 - bx * .5, 37 + by, 5.2, 5.8, 3), ramp: R, tex: .4, grp: 2 },
    { sh: SH.box(31 + ax * .5, 37 + ay, 5.2, 5.8, 3), ramp: R, tex: .4, grp: 3 },
    { sh: SH.box(24, 22 + dy, 14.5, 12, 2.6), ramp: R, tex: .45, grp: 4 },
    { sh: SH.box(25, 8.5 + dy, 7.2, 5.6, 3), ramp: R, tex: .4, grp: 5 }];
  const front = pose === 'strike' || pose === 'mid';
  const parts = front ? [...body, ...L, ...Rr] : [...L, ...body, ...Rr];   // 往下砸時兩隻手在身體前面
  const rdx = RA[0] - 40, rdy = RA[1] - 22;                                         // 右手臂上的裂痕跟著手臂移動
  return sculpt(48, 43, parts, a => {
  const cr = [[14, 15 + dy, 18, 22 + dy], [18, 22 + dy, 16, 27 + dy], [30, 26 + dy, 34, 30 + dy], [42 + rdx, 18 + rdy, 39 + rdx, 23 + rdy], [21, 6 + dy, 22, 10 + dy]];
  for (const [x0, y0, x1, y1] of cr) a.line(x0, y0, x1, y1, opt.crack);
  if (opt.glowCrack) for (const [x0, y0, x1, y1] of [cr[0], cr[2], cr[3]]) a.line(x0 + 1, y0, x1 + 1, y1, opt.glowCrack);
  for (const ex of [23, 28]) { a.rect(ex, 8 + dy, 3, 2, opt.eye); a.set(ex + 1, 8 + dy, '#ffffff'); }
  const gy = 21 + dy; a.line(24, gy - 3, 27, gy, opt.eye); a.line(27, gy, 24, gy + 3, opt.eye); a.line(24, gy + 3, 21, gy, opt.eye); a.line(21, gy, 24, gy - 3, opt.eye); a.set(24, gy, '#ffffff');
  if (opt.moss) for (let y = -12; y < 43; y++) for (let x = 0; x < 48; x++) { const p = a.pid(x, y); if (p < 0 || a.pid(x, y - 1) === p) continue;
    if (a.hash(x, y) < .8) { a.set(x, y, opt.moss[2]); a.set(x, y + 1, opt.moss[1]); if (a.hash(y, x) < .4) a.set(x, y + 2, opt.moss[0]); } }
}, pose === 'raise' ? { t: 8 } : {}); }
const HEAVY_POSES = ['ready', 'raise', 'mid', 'strike', 'recoil'];
/* 毒菇：ph 0~3 小跳步（落地時菇傘往下壓、跳起來時拉高）、-1 站
   'squat' 壓扁蓄力、'puff' 菇傘鼓起來、'spit' 菇傘往下一壓、嘴巴張開噴出孢子 */
const SHROOM_POSES = ['squat', 'puff', 'spit'];
function hdShroom(ph: number | string = -1, CAP = RAMP.cap) {
  const pose = typeof ph === 'string' ? ph : '', w = !pose && +ph >= 0 ? +ph : -1, [[ax, ay], [bx, by]] = gait(w, 1.5, 1.6);
  let cd = w >= 0 ? [1, -1, 1, -1][w] : 0, cs = 0;                      // cd = 菇傘往下壓多少，cs = 菇傘變大多少
  if (pose === 'squat') cd = 3;
  if (pose === 'puff') { cd = -2; cs = 2; }
  if (pose === 'spit') { cd = 2; cs = -1; }
  return sculpt(36, 34, [
  { sh: SH.ell(13 + bx, 32 + by, 4, 2), ramp: RAMP.stem, grp: 1 }, { sh: SH.ell(23 + ax, 32 + ay, 4, 2), ramp: RAMP.stem, grp: 1 },
  { sh: SH.box(18, 25 + cd * .5, 7, 7.5 - cd * .5, 2.5), ramp: RAMP.stem, grp: 2 },
  { sh: SH.ell(18, 15.5 + cd, 15 + cs, 3.4), ramp: RAMP.gill, grp: 3, rim: false },
  { sh: SH.ell(18, 13.5 + cd - cs * .5, 17 + cs, 11.8 + cs, (x, y) => y < 15.8 + cd), ramp: CAP, grp: 4 },
], a => {
  const k = (17 + cs) / 17;
  for (const [x, y, rx, ry] of [[8, 9, 3, 2], [17, 5, 3.2, 2], [26.5, 9, 3.4, 2.2], [12, 13, 2, 1.3], [30, 13.5, 1.8, 1]]) {
    const X = 18 + (x - 18) * k, Y = 13.5 + cd - cs * .5 + (y - 13.5) * k; a.ell(X, Y, rx, ry, '#fff4f6'); a.ell(X + .6, Y + ry * .6, rx * .7, .8, '#e6c2cc'); }
  const fy = cd * .5;
  for (const ex of [20, 25]) { a.rect(ex, 22 + fy, 1, pose === 'squat' ? 1 : 3, '#1a1012'); }        // 壓扁時瞇眼
  a.line(19, 21 + fy, 21, 21.5 + fy, '#5a3a2a'); a.line(24, 21.5 + fy, 26, 21 + fy, '#5a3a2a');
  if (pose === 'spit' || pose === 'puff') a.ell(22.5, 27 + fy * .5, pose === 'spit' ? 1.8 : 1, pose === 'spit' ? 1.6 : 1, '#3a1018');   // 嘴巴：鼓氣 → 張開
  else { a.line(21, 27, 24, 27, '#5a2a2a'); a.set(20, 26, '#5a2a2a'); }
  if (pose === 'spit') for (const [x, y, r] of [[30, 26, 1.6], [33, 23.5, 1.2], [33.5, 28, 1], [27.5, 23, .8]]) a.ell(x, y, r, r, CAP[3]);   // 噴出來的孢子
}, pose === 'puff' ? { t: 4, l: 2, r: 2 } : {}); }
/* ph：0~3 走路、-1 站、'raise' = 樹枝手高舉、'strike' = 樹枝手往下砸 */
function hdTreant(ph: number | string = -1, LEAF = RAMP.leaf, BARK = RAMP.bark, EYE = '#f4e04d') {
  const pose = typeof ph === 'string' ? ph : '', [[ax, ay], [bx, by]] = gait(pose ? -1 : +ph, 2, 2.6);
  let LH = [4 + ax * .5, 33 + ax * 1.8], LL = [3.5 + ax * .5, 33.5 + ax * 1.8], RH = [40 - bx * .5, 33 + bx * 1.8], RL = [41.5 - bx * .5, 34 + bx * 1.8];
  if (pose === 'ready') { LH = [6, 38]; LL = [5, 39.5]; RH = [39, 38]; RL = [40, 39.5]; }            // 蓄力：樹枝手往後下方甩
  if (pose === 'raise') { LH = [1, 13]; LL = [0, 11]; RH = [44, 13]; RL = [45, 11]; }
  if (pose === 'mid') { LH = [12, 15]; LL = [12, 13]; RH = [33, 15]; RL = [33, 13]; }              // 揮到一半：在身體前面往下甩
  if (pose === 'strike') { LH = [10, 43]; LL = [9.5, 44.5]; RH = [35, 43]; RL = [35.5, 44.5]; }
  if (pose === 'recoil') { LH = [7, 40]; LL = [6, 41.5]; RH = [38, 40]; RL = [39, 41.5]; }           // 收招：樹枝從地上抬起來
  const arms = [
    { sh: SH.cap(14, 25, LH[0], LH[1], 2.6, 1.8), ramp: BARK, bias: -.2, tex: .3, grp: 1 },
    { sh: SH.ell(LL[0], LL[1], 3.6, 3.2), ramp: LEAF, tex: .5, grp: 1 },
    { sh: SH.cap(31, 25, RH[0], RH[1], 2.8, 2), ramp: BARK, tex: .3, grp: 5 },
    { sh: SH.ell(RL[0], RL[1], 3.6, 3.2), ramp: LEAF, tex: .5, grp: 5 }];
  return sculpt(45, 48, [
  ...(pose === 'strike' || pose === 'mid' ? [] : arms.slice(0, 2)),
  { sh: SH.cap(16, 40, 9 - bx * .5, 47 + by, 3, 2), ramp: BARK, tex: .3, grp: 2 },
  { sh: SH.cap(28, 40, 35 + ax * .5, 47 + ay, 3, 2), ramp: BARK, tex: .3, grp: 2 },
  { sh: SH.cap(22, 41, 22, 47, 3.2, 2.6), ramp: BARK, tex: .3, grp: 2 },
  { sh: SH.box(22, 31, 10, 13, 2.4), ramp: BARK, tex: .35, grp: 3 },
  { sh: SH.ell(22, 18, 13, 6.5), ramp: LEAF, tex: .5, grp: 4 },
  { sh: SH.ell(13, 13, 10, 8.5), ramp: LEAF, tex: .5, grp: 4 },
  { sh: SH.ell(31, 12.5, 11, 9), ramp: LEAF, tex: .5, grp: 4 },
  { sh: SH.ell(22, 7, 10, 7), ramp: LEAF, tex: .5, grp: 4 },
  ...(pose === 'strike' || pose === 'mid' ? arms : arms.slice(2)),      // 往下砸時兩隻手都在樹幹前面
], a => {
  for (const [x, y0] of [[15, 24], [19, 30], [28, 26], [25, 36]]) for (let y = y0; y < y0 + 7; y++) a.set(x + Math.round(Math.sin(y * .9)), y, BARK[0]);
  for (const ex of [19, 26]) { a.ell(ex, 28, 2.2, 1.8, '#120a06'); a.set(ex, 28, EYE); a.set(ex + 1, 28, '#fff8a0'); }
  a.ell(22.5, 34, 3, 1.4, '#120a06');
  for (const [x, y] of [[9, 9], [30, 7], [36, 14], [17, 4], [24, 15]]) { a.set(x, y, '#f2a4c8'); a.set(x + 1, y, '#ffd8ea'); }
}, pose === 'raise' ? { l: 4, r: 4 } : {}); }
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
function hdMimic(ph: number | string = -1) {                          // 寶箱怪：蓋子張開變成嘴，上下兩排牙，蓋子上有一對發光的眼睛
  // 走路：整個箱子一跳一跳，蓋子跟著一開一合；'crouch' 蓋子咬緊、壓低發抖，'strike' 張到最大撲過去，'land' 喀一聲咬下去
  const pose = typeof ph === 'string' ? ph : '', w = typeof ph === 'number' && ph >= 0 ? ph : -1;
  const hop = w >= 0 ? [0, 2, 3, 1][w] : pose === 'crouch' || pose === 'land' ? -1 : 0;
  const gape = pose === 'strike' ? 9 : pose === 'crouch' ? 1 : pose === 'land' ? 0 : w >= 0 ? [3, 6, 7, 4][w] : 5;
  const W = ['#2e1c0e', '#4a3018', '#6a4626', '#86603a', '#a07a4c'], B = ['#2a2834', '#4a4858', '#6e6c86', '#9a98b0'];
  const by = 30 - hop, ly = by - 13 - gape;
  return sculpt(40, 40, [
    { sh: SH.box(20, ly, 15, 5, 7), ramp: W, tex: .2, grp: 1 },
    { sh: SH.ell(20, by - 7.5, 12, gape * .5 + 2.5), ramp: ['#2a0608', '#4a0c12', '#6a1420'], grp: 2, rim: false },
    { sh: SH.box(20, by, 15, 7.5, 7), ramp: W, tex: .2, grp: 3 },
  ], a => {
    for (let x = 7; x <= 33; x += 4) { a.line(x, by - 8, x + 1.5, by - 11, '#fff6e0'); a.line(x + 3, by - 8, x + 1.5, by - 11, '#d8d0c0'); a.line(x, ly + 5, x + 1.5, ly + 8, '#fff6e0'); }   // 牙齒
    a.ell(22, by - 7.5, 5, 1.6, '#e0485a'); a.set(20, by - 8, '#ff9aa8');                 // 舌頭
    for (const bx of [8, 32]) for (let y = by - 7; y < by + 7; y++) if (a.get(bx, y)) a.set(bx, y, B[2]);
    for (const ex of [14, 26]) { a.ell(ex, ly - 1, 2.6, 2, '#140808'); a.set(ex, ly - 1, '#ffd04a'); a.set(ex + 1, ly - 1, '#fff6a0'); }
  }, { t: 4 }); }
function hdMushKing() {                                              // 蘑菇王：巨大的紅色菇傘 + 白點 + 金冠，菇柄上一張生氣的臉，兩隻短手
  const CAP = ['#4a0a14', '#7a1424', '#b02a38', '#d84a52', '#f08a84'], ST = ['#7a6a4a', '#a89a7a', '#d8ccae', '#f4ead2'], GD = ['#7a4a1a', '#c0862c', '#f2c14e', '#fff0a8'];
  return sculpt(92, 86, [
    { sh: SH.ell(30, 82, 9, 4), ramp: ST, grp: 1 }, { sh: SH.ell(62, 82, 9, 4), ramp: ST, grp: 1 },
    { sh: SH.box(46, 64, 19, 18, 2.6), ramp: ST, tex: .12, grp: 2 },
    { sh: SH.cap(28, 58, 16, 70, 5, 4), ramp: ST, grp: 3 }, { sh: SH.cap(64, 58, 76, 70, 5, 4), ramp: ST, grp: 4 },
    { sh: SH.ell(46, 42, 44, 7), ramp: ['#5a4a36', '#8a7a5a', '#b8a882'], grp: 5, rim: false },
    { sh: SH.ell(46, 36, 45, 28, (x, y) => y < 41), ramp: CAP, tex: .1, grp: 6 },
    { sh: SH.poly([[30, 12], [33, 0], [39, 8], [46, -2], [53, 8], [59, 0], [62, 12]]), ramp: GD, grp: 7 },
  ], a => {
    for (const [x, y, rx, ry] of [[20, 24, 6, 4], [42, 14, 7, 4], [66, 22, 7, 4.5], [30, 34, 4, 2.5], [56, 33, 5, 3], [80, 32, 3.5, 2.5], [10, 34, 3, 2]]) { a.ell(x, y, rx, ry, '#fff4f6'); a.ell(x + 1, y + ry * .6, rx * .7, 1, '#e6c2cc'); }
    for (const ex of [38, 54]) { a.ell(ex, 60, 3.2, 4, '#1a1012'); a.set(ex - 1, 58, '#ffffff'); a.line(ex - 5, 53 + (ex < 46 ? 0 : 2), ex + 4, 55 - (ex < 46 ? 0 : 2), '#3a2a1a'); }
    a.ell(46, 71, 6, 2.5, '#3a1a1a'); a.rect(43, 70, 2, 1, '#ffffff'); a.rect(48, 70, 2, 1, '#ffffff');
    for (const [x, y, c] of [[33, 6, '#ff4a6a'], [46, 2, '#5a8cff'], [59, 6, '#ff4a6a']] as const) { a.ell(x, y, 2, 2, c); a.set(x - 1, y - 1, '#ffffff'); }
  }, { t: 4 }); }
function hdYeti() {                                                   // 雪原巨人：白色長毛、藍色的臉、彎角、巨大的拳頭
  const FUR = ['#5e6a88', '#8e9ab8', '#c4cedf', '#e8eef8', '#ffffff'], FACE = ['#1a3050', '#2a4a78', '#4a70a8', '#7aa0d0'], HORN = ['#5a5054', '#8a8084', '#c8c0c4', '#eee8ea'];
  return sculpt(100, 104, [
    { sh: SH.cap(34, 80, 30, 100, 9, 8), ramp: FUR, tex: .3, grp: 1 }, { sh: SH.cap(64, 80, 68, 100, 9, 8), ramp: FUR, tex: .3, grp: 2 },
    { sh: SH.ell(49, 60, 30, 28), ramp: FUR, tex: .35, grp: 3 },
    { sh: SH.cap(22, 48, 10, 84, 9, 11), ramp: FUR, tex: .3, grp: 4 }, { sh: SH.cap(76, 48, 88, 84, 9, 11), ramp: FUR, tex: .3, grp: 5 },
    { sh: SH.ell(49, 30, 19, 17), ramp: FUR, tex: .3, grp: 6 },
    { sh: SH.ell(49, 34, 11, 9), ramp: FACE, grp: 7 },
    { sh: SH.cap(34, 20, 22, 6, 4, 2), ramp: HORN, grp: 8 }, { sh: SH.cap(64, 20, 76, 6, 4, 2), ramp: HORN, grp: 8 },
  ], a => {
    for (const ex of [44, 54]) { a.rect(ex, 31, 3, 2, '#bff4ff'); a.set(ex + 1, 31, '#ffffff'); }
    a.rect(44, 38, 11, 2, '#0e1a2e'); for (const x of [45, 52]) { a.set(x, 37, '#ffffff'); a.set(x, 36, '#ffffff'); }
    for (let k = 0; k < 40; k++) { const x = 20 + (k * 37) % 62, y = 40 + (k * 23) % 50; if (a.get(x, y)) a.set(x, y, FUR[1]); }
    for (const [x, y] of [[10, 86], [88, 86]]) { a.ell(x, y, 7, 5, FACE[1]); a.ell(x, y - 1, 5, 3, FACE[2]); }
  }, { t: 2 }); }
function hdLich() {                                                   // 沼澤巫妖：飄在空中、破爛的斗篷、骷髏臉、綠色鬼火、手持骨杖
  const ROBE = ['#0e140c', '#1a2416', '#2a3822', '#3e4e30', '#566a40'], BN = ['#8a8474', '#b8b2a0', '#e2dcc8', '#fffaf0'], GL = ['#1a6a1a', '#3ac83a', '#9aff6a', '#eaffd0'];
  return sculpt(84, 104, [
    { sh: SH.poly([[24, 30], [60, 30], [74, 96], [64, 88], [56, 100], [46, 90], [38, 102], [28, 88], [18, 98], [10, 92]]), ramp: ROBE, tex: .25, grp: 1 },
    { sh: SH.cap(66, 18, 70, 100, 2, 2), ramp: ['#2a2018', '#4a3a28', '#6a5438'], grp: 2 },
    { sh: SH.ell(68, 14, 7, 7), ramp: GL, grp: 2 },
    { sh: SH.cap(26, 40, 12, 64, 5, 4), ramp: ROBE, grp: 3 }, { sh: SH.cap(58, 40, 66, 58, 5, 4), ramp: ROBE, grp: 4 },
    { sh: SH.ell(42, 26, 13, 13), ramp: ROBE, tex: .2, grp: 5 },
    { sh: SH.ell(42, 29, 8, 8.5), ramp: BN, grp: 6 },
  ], a => {
    for (const ex of [38, 46]) { a.ell(ex, 28, 2.4, 2.6, '#0a0e08'); a.set(ex, 28, '#9aff6a'); a.set(ex, 27, '#eaffd0'); }
    a.set(42, 32, '#0a0e08'); a.set(42, 33, '#0a0e08'); for (let x = 38; x <= 46; x += 2) a.set(x, 36, BN[0]);
    for (const [x, y] of [[12, 64], [66, 58]]) { a.ell(x, y, 3, 3, BN[2]); a.set(x - 1, y + 2, BN[1]); }
    for (let k = 0; k < 14; k++) { const x = 16 + (k * 29) % 54, y = 44 + (k * 17) % 48; if (a.get(x, y)) a.set(x, y, '#4a6a2e'); }
    a.set(66, 12, '#ffffff'); a.set(67, 11, '#ffffff');
  }); }
function withWalk(build: (ph: number | string) => HTMLCanvasElement, extra?, poses: string[] = [], frames = 4) {   // 站立圖 + 走路圖（預設 4 張）+ 攻擊動作
  const sp = makeHD(build(-1), extra); sp.walk = Array.from({ length: frames }, (_, ph) => makeHD(build(ph), extra));
  sp.atk = {}; for (const p of poses) sp.atk[p] = makeHD(build(p), extra); return sp;
}
function buildMonsters() { return {
  dragon: makeHD(hdDragon()),
  mushking: makeHD(hdMushKing()),
  yeti: makeHD(hdYeti()),
  lich: makeHD(hdLich()),
  mimic: withWalk(hdMimic, undefined, ['crouch', 'strike', 'land']),
  general: makeHD(hdGeneral()),
  queen: makeHD(hdQueen()),
  slime: makeHD(hdSlime(RAMP.slime, '#0e2a18', '#a8f0a0')),
  slimeM: makeHD(hdSlime(RAMP.slimeM, '#2a0a04', '#fff0a0')),
  wolf: withWalk(ph => hdWolf2(RAMP.wolf, {}, ph), undefined, WOLF_POSES, 6),
  wolfF: withWalk(ph => hdWolf2(RAMP.wolfF, {}, ph), undefined, WOLF_POSES, 6),
  skel: withWalk(ph => hdSkel(RAMP.bone, '#ff4a4a', ph), undefined, SKEL_POSES, SKEL_WALK),
  skelE: withWalk(ph => hdSkel(RAMP.ash, '#ff9a3a', ph), undefined, SKEL_POSES, SKEL_WALK),
  golem: withWalk(ph => hdGolem(RAMP.stone, { eye: '#7fe8ff', crack: '#262234', moss: ['#2f5a26', '#4f8a3e', '#7ab85a'] }, ph), undefined, HEAVY_POSES),
  golemL: withWalk(ph => hdGolem(RAMP.basalt, { eye: '#ffcf4a', crack: '#ff6a2a', glowCrack: '#ffcf4a' }, ph), undefined, HEAVY_POSES),
  shroom: withWalk(hdShroom, undefined, SHROOM_POSES),
  wolfS: withWalk(ph => hdWolf2(RAMP.snowwolf, { eye: '#4ac8ff' }, ph), undefined, WOLF_POSES, 6),
  slimeI: makeHD(hdSlime(RAMP.ice, '#0a2040', '#ffffff')),
  golemI: withWalk(ph => hdGolem(RAMP.iceStone, { eye: '#7fe8ff', crack: '#26304a', moss: ['#a6b8d8', '#e8f0fa', '#ffffff'] }, ph), undefined, HEAVY_POSES),
  skelS: withWalk(ph => hdSkel(RAMP.swampBone, '#7aff6a', ph), undefined, SKEL_POSES, SKEL_WALK),
  shroomP: withWalk(ph => hdShroom(ph, RAMP.capP), undefined, SHROOM_POSES),
  treantS: withWalk(ph => hdTreant(ph, RAMP.leafS, RAMP.barkS, '#9aff6a'), undefined, HEAVY_POSES),
  treant: withWalk(hdTreant, undefined, HEAVY_POSES),
  boss: withWalk(ph => hdWolf(RAMP.boss, 1.8, { eye: '#ff3b3b', mane: ['#5c5f76','#8a8ea6','#b4b8cc','#dcdeea','#ffffff'], scar: true, belly: ['#8a8ea6','#c4c8da','#eef0f8'] }, ph), { eye: [Math.round(44 * 1.8), Math.round(9 * 1.8)] }),
}; }
Object.assign(SPR, buildMonsters());

