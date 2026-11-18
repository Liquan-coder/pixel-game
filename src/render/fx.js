import { G } from '../core/state.js';
import { TAU, clamp, pick, rr } from '../core/util.js';
import { HK, ctx } from '../core/canvas.js';
import { BONEC } from '../world/bossAI.js';
import { WFX } from '../game/combat.js';
import { addLight } from './enemy.js';
import { camDt } from '../main.js';

export const STARC = ['#ffffff', '#e8dcff', '#c8b0ff', '#9a7cff', '#8fb0ff'];
export const asn = v => Math.floor(v / HK) * HK;
export function artPath() { ctx.beginPath(); }
export function artDot(x, y, s) { const q = HK, n = Math.max(1, Math.round(s)); ctx.rect(asn(x - n * q / 2), asn(y - n * q / 2), n * q, n * q); }
export function artLine(x0, y0, x1, y1, s) { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / HK)); for (let i = 0; i <= n; i++) artDot(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, s); }
export function drawStar(x, y, s, col) {                                       // 四芒星：十字 + 白色中心
  const a = Math.round(s); if (a < 0) return; const q = HK, X = asn(x), Y = asn(y);
  ctx.fillStyle = col; ctx.beginPath(); ctx.rect(X - a * q, Y, (2 * a + 1) * q, q); ctx.rect(X, Y - a * q, q, (2 * a + 1) * q);
  if (a >= 3) ctx.rect(X - q, Y - q, 3 * q, 3 * q); ctx.fill();
  if (a >= 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(X, Y, q, q); }
}
export function drawRibbon(f, k, L) {                                          // 光帶：尾細頭粗，三層（深紫 / 淡紫 / 白芯）
  const len = Math.hypot(f.x1 - f.x0, f.y1 - f.y0); if (len < 2) return;
  const ux = (f.x1 - f.x0) / len, uy = (f.y1 - f.y0) / len, n = Math.ceil(len / (HK * 1.5)), a0 = ctx.globalAlpha;
  for (const [W, col, al] of [[8, '#6a3ad0', .45], [4.6, '#b49cff', .8], [1.8, '#ffffff', 1]]) {
    ctx.globalAlpha = a0 * al; ctx.fillStyle = col; artPath();
    for (let i = 0; i <= n; i++) { const u = i / n; if (u < k) continue;
      const w = W * (.15 + .85 * u) * (1 - .4 * k) / HK; artDot(f.x0 + ux * len * u, f.y0 + uy * len * u, w); }
    ctx.fill(); }
  ctx.globalAlpha = a0;
  for (let i = 0; i < 6; i++) { const u = k + (1 - k) * ((i * .37 + G.time * 1.7) % 1); if (Math.sin(G.time * 40 + i * 9) > .2)
    drawStar(f.x0 + ux * len * u + Math.sin(i * 5) * 3, f.y0 + uy * len * u + Math.cos(i * 7) * 3, 1 + (i % 2), '#ffffff'); }
  if (k < .5) addLight(L, f.x1, f.y1, 34, 3);
}
export function drawRune(f, k, L) {                                            // 地上的魔法陣：雙圈 + 六芒星，邊轉邊擴張
  const sc = .55 + .45 * (1 - (1 - k) * (1 - k)), R = f.r * sc, rot = f.rot + k * 2.6, a0 = ctx.globalAlpha = 1 - k * k;
  const pt = (r, t) => [f.x + Math.cos(t) * r, f.y + Math.sin(t) * r * .45];
  ctx.fillStyle = '#9a7cff'; artPath();
  for (const rr2 of [R, R * .74]) { const n = Math.ceil(TAU * rr2 / HK * .8); for (let i = 0; i < n; i++) { const [x, y] = pt(rr2, i / n * TAU); artDot(x, y, 1); } }
  ctx.fill();
  ctx.globalAlpha = a0 * .75; ctx.fillStyle = '#d8c8ff'; artPath();
  for (let i = 0; i < 6; i++) { const [x0, y0] = pt(R * .74, rot + i * TAU / 6), [x1, y1] = pt(R * .74, rot + (i + 2) * TAU / 6); artLine(x0, y0, x1, y1, 1); }
  ctx.fill(); ctx.globalAlpha = a0;
  for (let i = 0; i < 6; i++) { const [x, y] = pt(R, rot + i * TAU / 6 + TAU / 12); drawStar(x, y, 1.5, '#ffffff'); }
  addLight(L, f.x, f.y - 3, 34 * (1 - k), 3);
}
export function drawCrescent(f, k) {                                           // 新月斬痕：中間粗兩端尖，外紫內白
  const kk = f.late ? Math.max(0, (f.t - f.late) / (f.d - f.late)) : k; if (f.late && f.t < f.late) return;
  const r = f.r * (.75 + .45 * kk), span = 2.3, cx = f.x - Math.cos(f.a) * r * .55, cy = f.y - Math.sin(f.a) * r * .55, a0 = ctx.globalAlpha = 1 - kk;
  const n = Math.ceil(r * span / HK);
  for (const [T, col] of [[5.5, '#9a6cff'], [2.6, '#ffffff']]) { ctx.fillStyle = col; artPath();
    for (let i = 0; i <= n; i++) { const u = i / n, th = f.a - span / 2 + span * u, t = T * Math.sin(Math.PI * u) * (1 - .5 * kk);
      for (let d = 0; d <= t; d += HK) artDot(cx + Math.cos(th) * (r - d), cy + Math.sin(th) * (r - d), 1); }
    ctx.fill(); }
  ctx.globalAlpha = a0;
}
/* ---- 刀光 / 槍芒 / 光圈：在細像素格上逐列判斷每個點屬於哪一層顏色 ---- */
export function fillArt(x0, y0, x1, y1, layerOf, cols, alphas) {
  const q = HK, ax0 = Math.floor(x0 / q), ay0 = Math.floor(y0 / q), ax1 = Math.ceil(x1 / q), ay1 = Math.ceil(y1 / q), n = cols.length, paths = [];
  for (let i = 0; i < n; i++) paths.push(new Path2D());
  for (let ay = ay0; ay < ay1; ay++) { const wy = (ay + .5) * q; let run = 0, rs = 0;
    for (let ax = ax0; ax <= ax1; ax++) { const l = ax < ax1 ? layerOf((ax + .5) * q, wy) : 0;
      if (l !== run) { if (run) paths[run - 1].rect(rs * q, ay * q, (ax - rs) * q, q); run = l; rs = ax; } } }
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < n; i++) { ctx.globalAlpha = a0 * (alphas ? alphas[i] : 1); ctx.fillStyle = cols[i]; ctx.fill(paths[i]); }
  ctx.globalAlpha = a0;
}
/* ---- 凸形狀的逐列填色：每一列直接算出左右邊界，不用逐格判斷（大範圍預警、光圈、槍芒都用這個，快很多） ---- */
// 形狀 = 橢圓（cx, cy, rx, ry，可省略）∩ 一組半平面 [nx, ny, c]（nx·x + ny·y ≤ c）
function rowSpan(y, sh) {
  let a = -1e9, b = 1e9;
  if (sh.rx !== undefined) { if (sh.rx <= 0) return null; const dy = (y - sh.cy) / sh.ry; if (dy * dy >= 1) return null; const w = sh.rx * Math.sqrt(1 - dy * dy); a = sh.cx - w; b = sh.cx + w; }
  if (sh.hp) for (const h of sh.hp) { const rhs = h[2] - h[1] * y; if (Math.abs(h[0]) < 1e-9) { if (rhs < 0) return null; } else if (h[0] > 0) b = Math.min(b, rhs / h[0]); else a = Math.max(a, rhs / h[0]); }
  return a < b ? [a, b] : null;
}
export function fillSpans(y0, y1, layers) {                                    // layers: [{ sh, sub, col, a }]：sh 減掉 sub（可省略）
  const q = HK, ay0 = Math.floor(y0 / q), ay1 = Math.ceil(y1 / q), a0 = ctx.globalAlpha;
  for (const L of layers) { const path = new Path2D(); let any = false;
    for (let ay = ay0; ay < ay1; ay++) { const wy = (ay + .5) * q, s1 = rowSpan(wy, L.sh); if (!s1) continue;
      const s2 = L.sub ? rowSpan(wy, L.sub) : null, spans = !s2 || s2[1] <= s1[0] || s2[0] >= s1[1] ? [s1] : [[s1[0], s2[0]], [s2[1], s1[1]]];
      for (const [a, b] of spans) { const xa = Math.round(a / q), xb = Math.round(b / q); if (xb > xa) { path.rect(xa * q, ay * q, (xb - xa) * q, q); any = true; } } }
    if (any) { ctx.globalAlpha = a0 * L.a; ctx.fillStyle = L.col; ctx.fill(path); } }
  ctx.globalAlpha = a0;
}
export const shEll = (cx, cy, r, sy = 1) => ({ cx, cy, rx:r, ry:r * sy });
export function shLane(x, y, a, l0, l1, W) { const c = Math.cos(a), s = Math.sin(a), u = x * c + y * s, v = -x * s + y * c;   // 旋轉的長方形
  return { hp:[[-c, -s, -(u + l0)], [c, s, u + l1], [-s, c, v + W / 2], [s, -c, -v + W / 2]] }; }
export function shSector(x, y, R, a, half, inset = 0) { const n1 = [-Math.sin(a + half), Math.cos(a + half)], n2 = [Math.sin(a - half), -Math.cos(a - half)];
  return { cx:x, cy:y, rx:R, ry:R, hp:[[n1[0], n1[1], n1[0] * x + n1[1] * y - inset], [n2[0], n2[1], n2[0] * x + n2[1] * y - inset]] }; }
function shPoly(pts) {                                                  // 凸多邊形（順時針或逆時針都可以）
  let area = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; area += x0 * y1 - x1 * y0; }
  const sg = area > 0 ? 1 : -1, hp = [];
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], nx = (y1 - y0) * sg, ny = -(x1 - x0) * sg; hp.push([nx, ny, nx * x0 + ny * y0]); }
  return { hp }; }
export const fxCols = c => [(!c || c === '#ffffff') ? '#8fb0ff' : c, '#e8e2ff', '#ffffff'];
export function drawSmear(f) {                                                // 新月刀光：刀頭粗、刀尾細，揮完從尾巴往前收
  const T = f.t - (f.delay || 0); if (T < 0) return;
  // f.follow = 這道刀光要跟著哪個玩家（null = 停在原地）
  const P = f.follow, cx = P ? P.x + (P.leanX || 0) : f.x, cy = P ? P.y - 7 + (P.leanY || 0) : f.y, sgn = Math.sign(f.a1 - f.a0) || 1, full = Math.abs(f.a1 - f.a0);
  const ph = Math.min(1, T / f.sw), head = 1 - (1 - ph) * (1 - ph), pt = Math.min(1, Math.max(0, (T - f.sw * .3) / (f.sw * .7 + f.hold))), tail = pt * pt * (3 - 2 * pt);
  const hA = full * head, tA = full * tail, span = hA - tA; if (span < .03) return;
  const fade = T > f.sw ? Math.max(0, 1 - (T - f.sw) / f.hold) : 1, r = f.r, w = f.w * (.55 + .45 * fade), sy = f.sy || .8, rin = Math.max(0, r - w - 1);
  if (T < f.sw && Math.random() < .7) { const a = f.a0 + sgn * hA; G.parts.push({ x:cx + Math.cos(a) * r, y:cy + Math.sin(a) * r * sy, vx:rr(-20, 20), vy:rr(-20, 20), life:.2, max:.2, col:f.cols[2], star:rr(.6, 1.6), drag:5 }); }
  const a0 = ctx.globalAlpha; ctx.globalAlpha = Math.min(1, .2 + fade);
  fillArt(cx - r - 1, cy - r * sy - 1, cx + r + 1, cy + r * sy + 1, (x, y) => {
    const dx = x - cx, dy = (y - cy) / sy, d2 = dx * dx + dy * dy; if (d2 > r * r || d2 < rin * rin) return 0;
    let v = ((Math.atan2(dy, dx) - f.a0) * sgn) % TAU; if (v < 0) v += TAU; v -= tA; if (v < 0 || v > span) return 0;
    const u = v / span, th = w * (.12 + .88 * Math.pow(u, .6)), rel = (r - Math.sqrt(d2)) / th; if (rel > 1) return 0;
    return rel < .2 ? 3 : rel < .5 ? 2 : 1; }, f.cols, [.85, 1, 1]);
  ctx.globalAlpha = a0;
}
export function drawLance(f) {                                                // 槍芒：細長、尖端收尖，從手邊往前射出
  const T = f.t - (f.delay || 0); if (T < 0) return;
  const g = Math.min(1, T / (f.d * .3)), len = f.len * (1 - (1 - g) * (1 - g)), fade = 1 - Math.max(0, (T - f.d * .3) / (f.d * .7));
  const c = Math.cos(f.a), s = Math.sin(f.a), x0 = f.follow ? f.follow.x + c * 6 : f.x, y0 = f.follow ? f.follow.y - 7 + s * 6 : f.y, W = f.w * (.4 + .6 * fade), tail = len * (1 - fade) * .7;
  const pt = (al, w) => [x0 + c * al - s * w, y0 + s * al + c * w];
  const poly = m => { const hw0 = W / 2 * (.3 + .7 * tail / len / .78) * m, hwm = W / 2 * m; return shPoly([pt(tail, -hw0), pt(len * .78, -hwm), pt(len, 0), pt(len * .78, hwm), pt(tail, hw0)]); };
  const ys = [y0 + s * tail - W, y0 + s * tail + W, y0 + s * len - W, y0 + s * len + W];
  if (len - tail < 1) return;
  fillSpans(Math.min(...ys), Math.max(...ys), [{ sh:poly(1), col:f.cols[0], a:.85 }, { sh:poly(.65), col:f.cols[1], a:1 }, { sh:poly(.3), col:f.cols[2], a:1 }]);
}
export function drawWarp(f, k) {                                              // 光圈：用細像素畫的橢圓環（可以往外擴或往內縮）
  if (f.delay) { if (f.t < f.delay) return; k = (f.t - f.delay) / (f.d - f.delay); }
  const e = 1 - (1 - k) * (1 - k), r = f.r0 + (f.r1 - f.r0) * e, sy = f.sy || .55, th = Math.max(HK * 1.5, (f.th || 3) * (1 - k * .6));
  const ro = r + th / 2, ri = Math.max(0, r - th / 2), a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * (1 - k * k);
  fillSpans(f.y - ro * sy - 1, f.y + ro * sy + 1, [{ sh:shEll(f.x, f.y, ro, sy), sub:shEll(f.x, f.y, ri, sy), col:f.col || '#9a7cff', a:1 },
    { sh:shEll(f.x, f.y, r + th * .22, sy), sub:shEll(f.x, f.y, r - th * .22, sy), col:'#ffffff', a:1 }]);
  ctx.globalAlpha = a0;
}
export function drawQuake(f, k) {
  drawWarp({ x:f.x, y:f.y, r0:f.r * .2, r1:f.r, th:7, sy:.55, col:f.red ? '#c8203a' : '#e8743b' }, Math.min(1, k * 1.3));
  ctx.globalAlpha = 1 - k; ctx.fillStyle = '#1a0e0a'; artPath();
  for (const ry of f.rays) artLine(f.x, f.y, f.x + Math.cos(ry.a) * ry.len, f.y + Math.sin(ry.a) * ry.len * .55, 2); ctx.fill();
  ctx.fillStyle = f.red ? '#ff8a8a' : '#ffb040'; artPath();
  for (const ry of f.rays) artLine(f.x, f.y, f.x + Math.cos(ry.a) * ry.len * (1 - k), f.y + Math.sin(ry.a) * ry.len * .55 * (1 - k), 1); ctx.fill();
  ctx.globalAlpha = 1;
}
export function drawSpikes(f, k) {                                            // 骨刺：幾根尖刺快速竄出再縮回去
  const up = k < .2 ? k / .2 : k > .7 ? (1 - k) / .3 : 1, R = f.r;
  for (let i = 0; i < 5; i++) { const ox = f.x + (i - 2) * R * .38, oy = f.y + ((i * 7) % 3 - 1) * 3, H = R * (1.1 + ((i * 13) % 5) * .15) * up, W = R * .22;
    if (H < .5) continue;
    fillArt(ox - W, oy - H, ox + W, oy + 1, (x, y) => { const v = (oy - y) / H; if (v < 0 || v > 1) return 0; const hw = W * (1 - v); const dx = x - ox; if (Math.abs(dx) > hw) return 0; return dx < -hw * .3 ? 3 : dx < hw * .3 ? 2 : 1; }, BONEC); }
}
export function drawOrb(x, y, r, cols) { fillArt(x - r, y - r, x + r, y + r, (px, py) => { const d = Math.hypot(px - x, py - y) / r; return d > 1 ? 0 : d > .68 ? 1 : d > .36 ? 2 : 3; }, cols); }
export function drawWaveP(p) {                                                // 飛行的新月劍氣
  const a = Math.atan2(p.vy, p.vx), R = p.R || 16, T = p.th || 7, cx = p.x - Math.cos(a) * R * .75, cy = p.y - Math.sin(a) * R * .75, half = 1.2;
  fillArt(cx - R - 1, cy - R - 1, cx + R + 1, cy + R + 1, (x, y) => { const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy); if (d > R || d < R - T) return 0;
    let v = Math.atan2(dy, dx) - a; v = ((v + Math.PI) % TAU + TAU) % TAU - Math.PI; if (Math.abs(v) > half) return 0;
    const th = T * Math.cos(v / half * Math.PI / 2), rel = (R - d) / (th || 1); if (rel > 1) return 0; return rel < .25 ? 3 : rel < .55 ? 2 : 1; }, p.cols || WFX.sword, [.85, 1, 1]);
}
/* 怪物動態：用「壓扁 / 拉長 / 傾斜 / 跳起」讓同一張圖動起來，每種怪個性不同 */
function dustPuff(x, y, n, sp) { for (let i = 0; i < n; i++) { const sg = i % 2 ? 1 : -1; G.parts.push({ x:x + sg * rr(1, 4), y:y + rr(-1, 1), vx:sg * rr(sp * .4, sp), vy:-rr(4, 16), life:rr(.22, .4), max:.4, col:pick(['#b8a888', '#8a7a64', '#d8ccb0']), s:1, g:40, drag:3 }); } }
export function enemyJuice(e, sp) {
  const dt = Math.max(1e-3, camDt);
  if (e._lx !== undefined) { const v = Math.hypot(e.x - e._lx, e.y - e._ly) / dt; e._v = (e._v || 0) + (Math.min(400, v) - (e._v || 0)) * Math.min(1, dt * 12); }
  e._lx = e.x; e._ly = e.y;
  if (e.hitT > 0) e.hitT -= dt;
  const v = e._v || 0, rel = Math.min(1.4, v / Math.max(20, e.spd || 40)), fl = e.flip ? -1 : 1, A = e.anim || 0, st = e.state;
  const wk = st === 'windup' ? clamp(1 - e.t / (e.wt || .5), 0, 1) : 0;
  let sx = 1, sy = 1, lean = 0, rot = 0, lift = 0, shiver = st === 'windup' ? Math.sin(G.time * 70) * .6 * wk : 0;
  const moving = rel > .15 && (st === 'chase' || st === 'idle' || st === 'return');
  switch (e.boss || e.rb ? '' : e.beh) {
    case 'slime': {                                                     // 史萊姆：一跳一跳，落地壓扁、空中拉長
      if (st === 'windup') { sx = 1 + .38 * wk; sy = 1 - .32 * wk; }
      else if (st === 'lunge') { const q = clamp(1 - e.t / .2, 0, 1); lift = Math.sin(q * Math.PI) * 10; sx = .78; sy = 1.28; e._air = true; }
      else if (moving) { const h = Math.abs(Math.sin(A * 5)), c = 1 - h; lift = h * 5 * Math.min(1, rel);
        sy = 1 - .26 * c * c * c + .14 * h; sx = 1 / sy;
        if (h > .6) e._air = true; else if (h < .12 && e._air) { e._air = false; dustPuff(e.x, e.y, 3, 18); } }
      else if (st === 'recover') { const k = Math.min(1, e.t * 2); sy = 1 + .18 * Math.sin(e.t * 32) * k; sx = 1 / sy;
        if (e._air) { e._air = false; dustPuff(e.x, e.y, 5, 26); } }
      else { sy = 1 + .05 * Math.sin(A * 3); sx = 1 / sy; }            // 待機：呼吸
      break; }
    case 'lunge': {                                                     // 狼、骷髏：跑起來往前傾、一顛一顛
      if (st === 'windup') { lean = -.3 * wk * fl; sy = 1 - .2 * wk; sx = 1 + .12 * wk; }
      else if (st === 'lunge') { lean = .4 * fl; sx = 1.26; sy = .82; if (Math.random() < .6) dustPuff(e.x - fl * 4, e.y, 1, 20); }
      else if (st === 'recover') { const k = clamp(e.t / .9, 0, 1); lean = .12 * fl * k; sy = 1 - .06 * k; }
      else if (moving) { const ph = A * 11; lean = .14 * rel * fl; lift = Math.abs(Math.sin(ph)) * 1.6 * rel; rot = Math.sin(ph) * .05 * rel; }
      else { sy = 1 + .03 * Math.sin(A * 2.5); }
      break; }
    case 'heavy': {                                                     // 石像魔、樹精：一步一步重重地踩
      if (st === 'windup') { lean = -.2 * wk * fl; sy = 1 + .13 * wk; sx = 1 - .05 * wk; lift = 2 * wk; }
      else if (st === 'recover') { const k = clamp((e.t - .55) / .35, 0, 1); sy = 1 - .2 * k; sx = 1 + .14 * k; lean = .14 * fl * k; }
      else if (moving) { const ph = A * 3.4, stp = Math.floor(ph); rot = Math.sin(ph * Math.PI) * .1 * Math.min(1, rel); sy = 1 - .07 * Math.abs(Math.cos(ph * Math.PI));
        if (e._step !== undefined && stp !== e._step) dustPuff(e.x + (stp % 2 ? 4 : -4), e.y, 3, 22); e._step = stp; }
      else { sy = 1 + .025 * Math.sin(A * 1.8); }
      break; }
    case 'ranged': {                                                    // 毒菇：左右晃，噴之前先鼓起來
      if (st === 'windup') { sx = 1 + .22 * wk; sy = 1 - .1 * wk + Math.sin(G.time * 40) * .03 * wk; }
      else if (st === 'recover') { const k = clamp(e.t / .4, 0, 1); sy = 1 + .22 * k; sx = 1 - .1 * k; }
      else { rot = Math.sin(A * 3) * .1; if (moving) lift = Math.abs(Math.sin(A * 9)) * 1.8 * rel; }
      break; }
    default:                                                            // boss：跑動時前傾就好，招式動作交給 boss 自己
      if (rel > .3 && !e.z) lean = .1 * Math.min(1, rel) * fl;
  }
  if (e.hitT > 0) { const k = e.hitT / .32, w = Math.sin((1 - k) * 22) * k;   // 被打：往後仰 + 果凍般晃一下
    lean += e.hitDir * .22 * k * k; sx *= 1 + .16 * w; sy *= 1 - .16 * w; }
  if (e.stun > 0) rot += Math.sin(G.time * 9) * .1;                       // 暈眩：搖搖晃晃
  return { sx, sy, lean, rot, lift, shiver };
}
