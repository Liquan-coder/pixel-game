import { G } from '../core/state';
import { HK, ctx, snapF } from '../core/canvas';
import { makeSprite } from './sprite';
import { WOLF_PAL, WOLF_ROWS, WOLF_RUN } from './starWolfArt';

/* ================= 星狼 =================
   · 跑步：四格都是照使用者給的「星狼奔跑」參考圖描的（art/starWolfArt.ts 的 WOLF_RUN），腳的姿勢跟參考圖一模一樣
   · 站著：描下來的身體 + 用程式畫的四條腿（每條三段：大腿 / 上臂、小腿 / 前臂、掌骨 + 腳掌），尾巴慢慢擺
   · 第一次用到才畫，之後都用同一組圖 */

const BW = Math.max(...WOLF_ROWS.map(r => r.length)), BH = WOLF_ROWS.length;   // 描下來的身體：70 × 61 美術像素（3 格 = 1 個世界像素）
const PX = 8, PT = 5;                                                    // 畫布四周多留的空間（腳往前後伸時不會被切掉）
const W = BW + PX * 2, H = BH + PT, GROUND = PT + BH - 1;                // GROUND = 腳底那一列
export const WOLF_CX = 35;                                               // 狼的中心欄（玩家的 x 對到這裡）
export const SEAT_X = 34, SEAT_Y = 18;                                   // 騎的人坐在背上的這一格（身體圖的座標）
const IDLE_N = 4;

/* ---- 身體：把描圖裡的腿切掉（後腿從大腿下緣、前腿從胸口下緣），切口補上外框；腿接上去的地方不補（腿會從那裡長出來） ---- */
const CUT: [number, number, number][] = [[12, 26, 46], [36, 58, 42]];  // [x 從, x 到, 從第幾列開始切掉]
const ATTACH_X: [number, number][] = [[11, 24], [36, 49]];             // 近側兩條腿接身體的欄（切口不補外框）
function bodyGrid() {
  const g = WOLF_ROWS.map(r => [...r.padEnd(BW, '.')]);
  for (const [x0, x1, cy] of CUT) for (let x = x0; x < x1; x++) {
    for (let y = cy; y < BH; y++) g[y][x] = '.';
    const c = g[cy - 1][x]; if (c !== '.' && c !== 'o' && !ATTACH_X.some(([a, b]) => x >= a && x <= b)) g[cy][x] = 'o';
  }
  return g;
}

/* ---- 腿：每條三段，關節一折一折地彎 ----
   後腿：髖關節 → 大腿 → 膝蓋 → 小腿 → 腳踝（往後凸的那個關節）→ 腳掌骨 → 腳掌
   前腿：肩關節 → 上臂 → 手肘 → 前臂 → 腕 → 掌骨 → 腳掌
   近側兩條腿畫在身體「上面」（看得到大腿、上臂繞著髖 / 肩轉），根部不描外框，跟身體的毛融在一起 */
type Seg = { L: number; w0: number; w1: number };
type A3 = [number, number, number];
type LegDef = { ax: number; ay: number; segs: Seg[]; stand: A3 };
// 角度：0 = 往正下方，正 = 往前（狼頭那邊）。ay 會自動調整成「站著時腳剛好踩到地」
const FRONT: LegDef = { ax: 44, ay: 30, segs: [{ L: 9, w0: 8.5, w1: 6 }, { L: 11, w0: 5.6, w1: 4.4 }, { L: 5, w0: 4.3, w1: 4 }], stand: [-.35, .02, .15] };
const HIND: LegDef = { ax: 20, ay: 36, segs: [{ L: 10, w0: 11, w1: 7 }, { L: 8, w0: 6.2, w1: 4.2 }, { L: 7, w0: 4.2, w1: 3.8 }], stand: [.35, -.55, .1] };
const reachOf = (D: LegDef, a: number[]) => D.segs.reduce((y, g, i) => y + g.L * Math.cos(a[i]), D.ay) + 2;   // 腳底在第幾列
for (const D of [FRONT, HIND]) D.ay += BH - 1 - reachOf(D, D.stand);
// 顏色（照參考圖：前緣一條亮邊、中間灰紫、後緣暗；腳掌比腿亮、腳趾縫是深色）：亮邊 / 亮 / 中 / 暗 / 腳掌 / 腳趾縫。近側跟身體一樣的灰紫；遠側暗很多
const NEAR = ['#c4c2e2', '#9a9abe', '#74769a', '#4e4e72', '#c8c6e4', '#3a3a58'], FAR = ['#6e6c8e', '#5a5a7a', '#48486a', '#34344e', '#6e6c8c', '#26263a'];
const PAL: Record<string, string> = { ...WOLF_PAL };
const LC = Array.from({ length: 12 }, (_, i) => String.fromCharCode(0x300 + i));   // 腿用的調色盤字元（不跟描圖的字母撞）
[...NEAR, ...FAR].forEach((c, i) => { PAL[LC[i]] = c; });

/* 把一條腿畫進格子：三段粗細漸變的「骨頭」+ 腳掌，前緣亮、後緣暗；每個關節後緣壓一道深色摺痕；最後補外框（根部不補） */
function leg(out: string[][], D: LegDef, a: number[], dx: number, dy: number, far: boolean) {
  const ch = far ? LC.slice(6) : LC.slice(0, 6), lay = new Map<number, string>(), root = new Set<number>(), K = (x: number, y: number) => y * 1000 + x;
  const J: [number, number][] = [[D.ax + PX + dx + .5, D.ay + PT + dy + .5]];
  D.segs.forEach((g, i) => { const [x, y] = J[i]; J.push([x + g.L * Math.sin(a[i]), y + g.L * Math.cos(a[i])]); });
  D.segs.forEach((g, i) => {
    const [ax, ay] = J[i], [bx, by] = J[i + 1], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy, nx = vy / Math.sqrt(L2), ny = -vx / Math.sqrt(L2);   // n = 前緣方向
    const R = Math.max(g.w0, g.w1) / 2 + 1;
    for (let Y = Math.floor(Math.min(ay, by) - R); Y <= Math.max(ay, by) + R; Y++) for (let X = Math.floor(Math.min(ax, bx) - R); X <= Math.max(ax, bx) + R; X++) {
      const px = X + .5 - ax, py = Y + .5 - ay, u = Math.max(0, Math.min(1, (px * vx + py * vy) / L2)), hw = (g.w0 + (g.w1 - g.w0) * u) / 2;
      const qx = px - vx * u, qy = py - vy * u; if (qx * qx + qy * qy > hw * hw) continue;
      const k = K(X, Y), sd = (qx * nx + qy * ny) / hw;
      if (i > 0 && lay.has(k) && u < .25) continue;                      // 關節：上一段的圓頭蓋在這一段上面（看得出是兩段接起來的）
      lay.set(k, i > 0 && u < .12 && sd < -.1 ? ch[3] : sd > .72 ? ch[0] : sd > 0 ? ch[1] : sd > -.55 ? ch[2] : ch[3]);
      if (i === 0 && u < .45) root.add(k); }
  });
  const [x2, y2] = J[J.length - 1], pa = a[a.length - 1] - .15, cx = x2 + 1.9 * Math.cos(pa), cy = y2 - 1.9 * Math.sin(pa);   // 腳掌：又大又圓的橢圓，跟著掌骨轉；前半有兩道腳趾縫
  for (let Y = Math.floor(cy - 4); Y <= cy + 4; Y++) for (let X = Math.floor(cx - 5); X <= cx + 5; X++) {
    const px = X + .5 - cx, py = Y + .5 - cy, u = px * Math.cos(pa) - py * Math.sin(pa), v = px * Math.sin(pa) + py * Math.cos(pa);
    if ((u / 4.3) ** 2 + (v / 2.4) ** 2 > 1) continue;
    const toe = u > .3 && v > -.6 && (Math.abs(u - 1.3) < .45 || Math.abs(u - 2.9) < .45);
    lay.set(K(X, Y), toe ? ch[5] : v > 1 ? ch[3] : v < -.8 ? ch[1] : ch[4]); }
  for (const k of [...lay.keys()]) { if (lay.get(k) === 'o' || (!far && root.has(k))) continue; const X = k % 1000, Y = (k / 1000) | 0;   // 外框（近側腿的根部不描：跟身體的毛融在一起）
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!lay.has(K(X + ox, Y + oy))) lay.set(K(X + ox, Y + oy), 'o'); }
  for (const [k, c] of lay) { const X = k % 1000, Y = (k / 1000) | 0; if (Y >= 0 && Y < H && X >= 0 && X < W) out[Y][X] = c; }   // 外框也蓋過後面那條腿：兩條腿重疊時分得出來
}

/* 身體貼上去，尾巴擺 sway 格 */
function pasteBody(out: string[][], body: string[][], sway: number) {
  for (let x = 0; x < BW; x++) { const t = x < 13 ? Math.round(sway * Math.pow((13 - x) / 13, 1.4)) : 0;
    for (let y = 0; y < BH; y++) { const c = body[y][x], Y = y + PT + t; if (c !== '.' && Y >= 0 && Y < H) out[Y][x + PX] = c; } }
}

/* 一格圖 + 對位資料：ax = 狼的中心欄、foot = 腳底那一列、seat = 背上騎的人坐的那一列、tw = 會閃的星星位置（圖上那幾顆四芒星） */
type Frame = ReturnType<typeof makeSprite> & { ax: number; foot: number; seat: number; tw: [number, number][]; eye: [number, number] };
const STAR = Object.keys(WOLF_PAL).find(k => WOLF_PAL[k] === '#fbf4ff'), EYE = Object.keys(WOLF_PAL).find(k => WOLF_PAL[k] === '#ffffff');
function frame(rows: string[], pal: Record<string, string>, ax: number, foot: number, seat: number): Frame {
  const sp = makeSprite(rows, pal) as Frame; sp.ax = ax; sp.foot = foot; sp.seat = seat; sp.tw = []; sp.eye = [0, 0];
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { if (r[x] === STAR) sp.tw.push([x, y]); else if (r[x] === EYE) sp.eye = [x, y]; } });
  return sp;
}
let BODY: string[][] | null = null;
function stand(sway: number): Frame {                                    // 站著：描的身體 + 程式畫的腿
  const body = BODY || (BODY = bodyGrid()), out = Array.from({ length: H }, () => Array(W).fill('.'));
  leg(out, HIND, [.25, -.65, .2], 5, -1, true);                         // 遠側後腿（在身體後面）
  leg(out, FRONT, [-.45, -.12, .05], 5, -1, true);                      // 遠側前腿
  pasteBody(out, body, sway);
  leg(out, HIND, HIND.stand, 0, 0, false);                              // 近側後腿（畫在身體上面）
  leg(out, FRONT, FRONT.stand, 0, 0, false);                            // 近側前腿
  return frame(out.map(r => r.join('')), PAL, PX + WOLF_CX, GROUND, PT + SEAT_Y);
}

let RUN: Frame[] | null = null, IDLE: Frame[] = [];
export function wolfFrames() {
  if (!RUN) {
    RUN = WOLF_RUN.map(f => frame(f.r, WOLF_PAL, f.cx, f.foot, f.seat));
    for (let i = 0; i < IDLE_N; i++) IDLE.push(stand(Math.round(Math.sin(2 * Math.PI * i / IDLE_N))));
  }
  return { RUN, IDLE };
}
export type WolfAnim = number | null;                                  // 步伐進度 0～1（null = 站著）
function frameOf(run: WolfAnim) { const F = wolfFrames(); return run === null ? F.IDLE[Math.floor(G.time * 2.5) % IDLE_N] : F.RUN[Math.floor(run * F.RUN.length) % F.RUN.length]; }
/** 騎著時人要抬高幾個世界像素：女巫腰部（第 50 列）對到狼背，女巫的腳底本來在第 66 列 */
export const wolfRideY = (run: WolfAnim) => { const f = frameOf(run); return (f.foot - f.seat - (66 - 50)) * HK; };
export const RIDE_Y = (BH - 1 - SEAT_Y - (66 - 50)) / 3;               // 站著時（跳下來的動畫用；直接除 3：HK 在模組載入時可能還沒準備好）

/* 畫星狼：(x, y) = 腳底中心（世界座標）。mode：'n' 一般、'w' 全白、'p' 紫色剪影 */
export function drawWolf(x: number, y: number, flip: boolean, run: WolfAnim, mode: 'n' | 'w' | 'p' = 'n') {
  const sp = frameOf(run), wa = sp.w;                                    // 美術像素寬
  const X = snapF(x - (flip ? wa - 1 - sp.ax : sp.ax) * HK), Y = snapF(y - (sp.foot + 1) * HK);
  const img = mode === 'w' ? (flip ? sp.wf : sp.wn) : mode === 'p' ? (flip ? sp.pf : sp.pn) : (flip ? sp.f : sp.n);
  ctx.drawImage(img, X, Y, sp.w * HK, sp.h * HK);
  if (mode === 'n') twinkle(sp, X, Y, flip);
}

/* 圖上的四芒星輪流閃 + 眼睛的光暈 */
function twinkle(sp: Frame, X: number, Y: number, flip: boolean) {
  const at = (ax: number, ay: number) => [X + (flip ? sp.w - 1 - ax : ax) * HK, Y + ay * HK];
  sp.tw.forEach(([tx, ty], i) => {
    const p = (G.time * .9 + i * .37) % 1; if (p > .35) return;
    const q = Math.sin(p / .35 * Math.PI), [sx, sy] = at(tx, ty), r = Math.round(1 + q * 1.5);
    ctx.globalAlpha = .55 + .45 * q; ctx.fillStyle = '#e8dcff';
    ctx.fillRect(sx - r * HK, sy, (r * 2 + 1) * HK, HK); ctx.fillRect(sx, sy - r * HK, HK, (r * 2 + 1) * HK);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, HK, HK);
  });
  const [ex, ey] = at(sp.eye[0], sp.eye[1]), g = .3 + .25 * Math.sin(G.time * 3);
  ctx.globalAlpha = g; ctx.fillStyle = '#8a9cff'; ctx.fillRect(ex - 1.5 * HK, ey - HK, 4 * HK, 3 * HK);
  ctx.globalAlpha = 1;
}
