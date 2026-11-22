import { G } from '../core/state';
import { HK, ctx, snapF } from '../core/canvas';
import { makeSprite } from './sprite';
import { WOLF_PAL, WOLF_ROWS } from './starWolfArt';

/* ================= 星狼：把一張站姿圖拆成「身體 + 四條腿」，轉動腿做出奔跑動畫 =================
   · 每條腿分成兩段：大腿（繞著接身體的地方轉）+ 小腿（繞著膝蓋 / 腳踝轉，往後折）
   · 遠側的兩條腿 = 近側的腿調暗、往旁邊挪一點，跑步節奏稍微錯開
   · 畫的順序：遠側腿 → 近側腿 → 身體（腿的上緣藏在身體下面，轉動時接縫不會露出來）
   · 第一次用到才拆、才畫，之後都用同一組圖 */

export const WOLF_W = 102, WOLF_H = 88;                                  // 美術像素（1 個世界像素 = 3 格）
export const WOLF_CX = 51;                                               // 狼的中心（玩家的 x 對到這一欄）
export const SEAT_X = 50, SEAT_Y = 30;                                   // 騎的人坐在哪：背上這一格
export const RUN_N = 8, IDLE_N = 4;                                      // 奔跑 8 格、站著 4 格（尾巴慢慢擺）

type Px = { x: number; y: number; c: string };
type Piece = { px: Map<number, string> };
type Leg = { up: Piece; lo: Piece; hip: [number, number]; knee: [number, number] };

const key = (x: number, y: number) => y * 1000 + x;
const grid = () => WOLF_ROWS.map(r => [...r.padEnd(WOLF_W, '.')]);

/* 從 (sx, sy) 開始，往下（y >= cut）找連在一起的有色格子 = 一條腿；腿旁邊的外框也算進來 */
function cutLeg(g: string[][], sx: number, sy: number, cut: number, knee: number, hip: [number, number], kneeP: [number, number]): Leg {
  const seen = new Set<number>(), q: [number, number][] = [[sx, sy]], col: Px[] = [];
  seen.add(key(sx, sy));
  while (q.length) { const [x, y] = q.pop()!; col.push({ x, y, c: g[y][x] });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy;
      if (ny < cut || ny >= WOLF_H || nx < 0 || nx >= WOLF_W || seen.has(key(nx, ny))) continue;
      const c = g[ny][nx]; if (c === '.' || c === 'o') continue; seen.add(key(nx, ny)); q.push([nx, ny]); } }
  const all = new Map<number, string>();
  for (const p of col) all.set(key(p.x, p.y), p.c);
  for (const p of col) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {   // 腿旁邊的外框
    const nx = p.x + dx, ny = p.y + dy; if (ny < cut || ny >= WOLF_H || nx < 0 || nx >= WOLF_W) continue;
    if (g[ny][nx] === 'o') all.set(key(nx, ny), 'o'); }
  // 從身體拿掉：有色格子全拿；外框只拿「旁邊只有這條腿」的（跟尾巴共用的外框留給尾巴）
  for (const [k] of all) { const x = k % 1000, y = (k / 1000) | 0;
    if (g[y][x] !== 'o') { g[y][x] = '.'; continue; }
    let other = false;
    for (let dy = -1; dy <= 1 && !other; dy++) for (let dx = -1; dx <= 1; dx++) { const c = (g[y + dy] || [])[x + dx];
      if (c && c !== '.' && c !== 'o' && !all.has(key(x + dx, y + dy))) { other = true; break; } }
    if (!other) g[y][x] = '.'; }
  // 腿的上面再多帶 3 列身體（畫在身體下面，轉動時把接縫補起來）
  const xs = col.filter(p => p.y === cut).map(p => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
  for (let y = cut - 3; y < cut; y++) for (let x = x0; x <= x1; x++) { const c = g[y][x]; if (c !== '.') all.set(key(x, y), c); }
  const up = new Map<number, string>(), lo = new Map<number, string>();
  for (const [k, c] of all) { const y = (k / 1000) | 0; if (y <= knee + 1) up.set(k, c); if (y >= knee - 1) lo.set(k, c); }   // 膝蓋上下各重疊一列
  return { up: { px: up }, lo: { px: lo }, hip, knee: kneeP };
}

/* 把一塊腿繞著 (px, py) 轉 a 弧度，再放到 (tx, ty)。反推每一格來自哪裡 → 轉完不會有破洞 */
function stamp(out: string[][], P: Piece, px: number, py: number, a: number, tx: number, ty: number, recol?: (c: string) => string) {
  const co = Math.cos(a), si = Math.sin(a), R = 40;
  for (let Y = Math.floor(ty - R); Y <= ty + R; Y++) { if (Y < 0 || Y >= out.length) continue;
    for (let X = Math.floor(tx - R); X <= tx + R; X++) { if (X < 0 || X >= out[0].length) continue;
      const dx = X + .5 - tx, dy = Y + .5 - ty;
      const sx = Math.floor(dx * co + dy * si + px), sy = Math.floor(-dx * si + dy * co + py);
      const c = P.px.get(key(sx, sy)); if (c) out[Y][X] = recol ? recol(c) : c; } }
}
/* 一條腿（大腿 a1 + 小腿再折 a2）。a > 0 = 腳往後擺 */
function drawLeg(out: string[][], L: Leg, a1: number, a2: number, dx: number, dy: number, recol?: (c: string) => string) {
  const [hx, hy] = L.hip, [kx, ky] = L.knee, co = Math.cos(a1), si = Math.sin(a1);
  const kxT = hx + dx + (kx - hx) * co - (ky - hy) * si, kyT = hy + dy + (kx - hx) * si + (ky - hy) * co;   // 膝蓋跟著大腿轉到哪
  stamp(out, L.lo, kx + .5, ky + .5, a1 + a2, kxT + .5, kyT + .5, recol);
  stamp(out, L.up, hx + .5, hy + .5, a1, hx + dx + .5, hy + dy + .5, recol);
}

/* 遠側的腿：每個顏色往深藍紫色混 55% */
const DARK: Record<string, string> = {};
function darkOf(c: string) {
  if (c === 'o') return 'o'; if (DARK[c]) return DARK[c];
  const h = WOLF_PAL[c], n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, T = [30, 26, 52], t = .55;
  const k = String.fromCharCode(0x100 + c.charCodeAt(0)); WOLF_PAL2[k] ='#' + [r, g, b].map((v, i) => Math.round(v + (T[i] - v) * t).toString(16).padStart(2, '0')).join('');
  return DARK[c] = k;
}
const WOLF_PAL2: Record<string, string> = { ...WOLF_PAL };

let parts: { body: string[][]; hind: Leg; front: Leg } | null = null;
function split() {
  if (parts) return parts;
  const g = grid();
  const hind = cutLeg(g, 26, 75, 60, 71, [30, 59], [25, 71]);           // 後腿：從大腿下緣切開，腳踝在第 71 列
  const front = cutLeg(g, 62, 75, 58, 77, [62, 57], [61, 77]);           // 前腿：從胸口下緣切開，腕關節在第 77 列
  return parts = { body: g, hind, front };
}

/* 尾巴跟著擺：x < 22 的欄位上下錯開，越往尾尖錯越多 */
function tailSway(body: string[][], amt: number) {
  const out = body.map(r => r.slice());
  for (let x = 0; x < 22; x++) { const d = Math.round(amt * Math.pow((22 - x) / 22, 1.5)); if (!d) continue;
    for (let y = 0; y < WOLF_H; y++) out[y][x] = '.';
    for (let y = 0; y < WOLF_H; y++) { const ny = y + d; if (ny >= 0 && ny < WOLF_H && body[y][x] !== '.') out[ny][x] = body[y][x]; } }
  return out;
}

/* 奔跑的節奏（t = 0～1 一個步伐週期）：前腿往前伸的時候後腿往後蹬，收回來時騰空；腳在空中往前收的時候小腿往後折 */
const TAU = Math.PI * 2;
function gait(t: number) {
  const f = (p: number) => ({ a: -.55 * Math.cos(TAU * p), k: 1.1 * Math.max(0, -Math.sin(TAU * p)) });
  const h = (p: number) => ({ a: .5 * Math.cos(TAU * p), k: .9 * Math.max(0, Math.sin(TAU * p)) });
  return { f: f(t), ff: f(t + .12), h: h(t), hf: h(t + .12) };
}
/* 騰空：步伐中間（四條腿收在身體下面）身體往上 0～2 格 */
export const wolfLift = (t: number) => Math.round(2 * Math.max(0, Math.cos(TAU * (t - .5))));

function compose(t: number | null, sway: number) {
  const { body, hind, front } = split();
  const out = Array.from({ length: WOLF_H }, () => Array(WOLF_W).fill('.'));
  const G0 = t === null ? null : gait(t);
  const s = (o: { a: number; k: number } | undefined) => o || { a: 0, k: 0 };
  drawLeg(out, hind, s(G0?.hf).a, s(G0?.hf).k, 7, -1, darkOf);            // 遠側後腿
  drawLeg(out, front, s(G0?.ff).a, s(G0?.ff).k, -6, -1, darkOf);         // 遠側前腿
  drawLeg(out, hind, s(G0?.h).a, s(G0?.h).k, 0, 0);                       // 近側後腿
  drawLeg(out, front, s(G0?.f).a, s(G0?.f).k, 0, 0);                      // 近側前腿
  const b = tailSway(body, sway);
  for (let y = 0; y < WOLF_H; y++) for (let x = 0; x < WOLF_W; x++) if (b[y][x] !== '.') out[y][x] = b[y][x];
  return makeSprite(out.map(r => r.join('')), WOLF_PAL2);
}

let RUN: ReturnType<typeof makeSprite>[] | null = null, IDLE: ReturnType<typeof makeSprite>[] | null = null;
export function wolfFrames() {
  if (!RUN) {
    RUN = []; for (let i = 0; i < RUN_N; i++) RUN.push(compose(i / RUN_N, Math.round(-2 + 2 * Math.sin(TAU * i / RUN_N))));   // 跑的時候尾巴往上揚、跟著步伐甩
    IDLE = []; for (let i = 0; i < IDLE_N; i++) IDLE.push(compose(null, Math.round(Math.sin(TAU * i / IDLE_N))));
  }
  return { RUN, IDLE: IDLE! };
}

/* 畫星狼：(x, y) = 腳底中心（世界座標）。run = 步伐進度 0～1（null = 站著）。mode：'n' 一般、'w' 全白、'p' 紫色剪影 */
export function drawWolf(x: number, y: number, flip: boolean, run: number | null, mode: 'n' | 'w' | 'p' = 'n') {
  const F = wolfFrames(), sp = run === null ? F.IDLE[Math.floor(G.time * 2.5) % IDLE_N] : F.RUN[Math.floor(run * RUN_N) % RUN_N];
  const lift = run === null ? 0 : wolfLift(run);
  const X = snapF(x - (flip ? WOLF_W - WOLF_CX : WOLF_CX) * HK), Y = snapF(y - (WOLF_H + lift) * HK);
  const img = mode === 'w' ? (flip ? sp.wf : sp.wn) : mode === 'p' ? (flip ? sp.pf : sp.pn) : (flip ? sp.f : sp.n);
  ctx.drawImage(img, X, Y, sp.w * HK, sp.h * HK);
  if (mode === 'n') twinkle(X, Y, flip);
}

/* 身上幾顆會閃的星星（固定在毛上的位置，輪流亮）+ 眼睛的光暈 */
const TW = [[34, 40], [52, 37], [66, 46], [24, 46], [44, 50], [9, 56], [15, 44], [60, 28], [76, 33]];
function twinkle(X: number, Y: number, flip: boolean) {
  const at = (ax: number, ay: number) => [X + (flip ? WOLF_W - 1 - ax : ax) * HK, Y + ay * HK];
  for (let i = 0; i < TW.length; i++) {
    const p = (G.time * .9 + i * .37) % 1; if (p > .35) continue;
    const q = Math.sin(p / .35 * Math.PI), [sx, sy] = at(TW[i][0], TW[i][1]), r = Math.round(1 + q * 2);
    ctx.globalAlpha = .55 + .45 * q; ctx.fillStyle = '#e8dcff';
    ctx.fillRect(sx - r * HK, sy, (r * 2 + 1) * HK, HK); ctx.fillRect(sx, sy - r * HK, HK, (r * 2 + 1) * HK);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, HK, HK);
  }
  const [ex, ey] = at(87, 21), g = .35 + .25 * Math.sin(G.time * 3);   // 眼睛的光暈
  ctx.globalAlpha = g; ctx.fillStyle = '#8a9cff'; ctx.fillRect(ex - 2 * HK, ey - HK, 5 * HK, 3 * HK);
  ctx.globalAlpha = 1;
}
