import { G } from '../core/state';
import { HK, ctx, snapF } from '../core/canvas';
import { makeSprite } from './sprite';
import { WOLF_PAL, WOLF_ROWS } from './starWolfArt';

/* ================= 星狼：描下來的身體 + 用程式畫的四條腿 =================
   · 身體是參考圖描的（腿從肚子下面切掉）；腿每條兩段（小腿 / 腳掌骨）+ 腳掌，關節照狼奔跑的節奏擺動
   · 奔跑一個步伐 = 前腳往前伸 → 落地往後扒 → 蹬地後腳掌往後翻 → 收回來；後腳晚半拍，四條腳收在肚子下面時整隻騰空
   · 身體跟著步伐前後起伏（前腳蹬地時前半身抬高、後腳蹬地時壓低），尾巴往後甩
   · 遠側的兩條腿顏色比較暗、往前挪一點、節奏錯開一點
   · 第一次用到才畫，之後都用同一組圖 */

const BW = Math.max(...WOLF_ROWS.map(r => r.length)), BH = WOLF_ROWS.length;   // 描下來的身體：70 × 61 美術像素（3 格 = 1 個世界像素）
const PX = 8, PT = 5;                                                    // 畫布四周多留的空間：腳往前後伸、騰空時不會被切掉
const W = BW + PX * 2, H = BH + PT, GROUND = PT + BH - 1;                // GROUND = 腳底那一列
export const WOLF_CX = 35;                                               // 狼的中心欄（玩家的 x 對到這裡）
export const SEAT_X = 34, SEAT_Y = 18;                                   // 騎的人坐在背上的這一格（身體圖的座標）
export const RUN_N = 10, IDLE_N = 4;

/* ---- 身體：把描圖裡的腿切掉（後腿從大腿下緣、前腿從胸口下緣），切口補上外框；腿接上去的地方不補（腿會從那裡長出來） ---- */
const CUT: [number, number, number][] = [[12, 26, 46], [36, 58, 42]];  // [x 從, x 到, 從第幾列開始切掉]
const ATTACH_X: [number, number][] = [[14, 21], [38, 46]];             // 近側兩條腿接身體的欄（切口不補外框）
function bodyGrid() {
  const g = WOLF_ROWS.map(r => [...r.padEnd(BW, '.')]);
  for (const [x0, x1, cy] of CUT) for (let x = x0; x < x1; x++) {
    for (let y = cy; y < BH; y++) g[y][x] = '.';
    const c = g[cy - 1][x]; if (c !== '.' && c !== 'o' && !ATTACH_X.some(([a, b]) => x >= a && x <= b)) g[cy][x] = 'o';
  }
  return g;
}

/* ---- 腿 ---- */
type Seg = { L: number; w0: number; w1: number };
type LegDef = { ax: number; ay: number; segs: [Seg, Seg]; stand: [number, number] };
// 角度：0 = 往正下方，正 = 腳往前（狼頭那邊）。ay 會自動調整成「站著時腳剛好踩到地」
const FRONT: LegDef = { ax: 42, ay: 40, segs: [{ L: 11, w0: 4.4, w1: 3.2 }, { L: 6, w0: 3.1, w1: 2.8 }], stand: [.04, .1] };
const HIND: LegDef = { ax: 17, ay: 45, segs: [{ L: 7.5, w0: 5.2, w1: 3.4 }, { L: 6.5, w0: 3.2, w1: 2.8 }], stand: [-.48, .2] };
for (const D of [FRONT, HIND]) { const [a1, a2] = D.stand; D.ay = BH - 1 - 1.4 - D.segs[0].L * Math.cos(a1) - D.segs[1].L * Math.cos(a2); }
// 一個步伐的關鍵姿勢 [t, 小腿角度, 腳掌骨角度]，中間用平滑曲線補
const FRONT_K = [[0, .95, .8], [.14, .5, .42], [.28, 0, -.05], [.4, -.62, -.78], [.52, -.5, -1.95], [.72, .3, -1.35], [.88, 1.0, .35]];
const HIND_K = [[0, -1.0, -.5], [.13, -.55, -1.65], [.3, .25, -.75], [.44, .6, .3], [.55, .35, .18], [.7, -.25, 0], [.85, -.78, -.42]];
function gaitAt(K: number[][], t: number): [number, number] {           // 週期性 Catmull-Rom：關鍵姿勢之間圓滑地過去
  t = ((t % 1) + 1) % 1; let i = K.length - 1; while (K[i][0] > t) i--;
  const P = (k: number) => K[((k % K.length) + K.length) % K.length], t0 = K[i][0], t1 = i + 1 < K.length ? K[i + 1][0] : 1, u = (t - t0) / (t1 - t0);
  const cr = (j: number) => { const a = P(i - 1)[j], b = P(i)[j], c = P(i + 1)[j], d = P(i + 2)[j];
    return .5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u); };
  return [cr(1), cr(2)];
}
// 顏色：亮 / 中 / 暗 / 腳掌（近側跟身體一樣的灰紫；遠側暗很多）
const NEAR = ['#9a98c0', '#6e7092', '#4a4a6a', '#b8b6d8'], FAR = ['#5a5878', '#44445e', '#30304a', '#6a6888'];
const PAL: Record<string, string> = { ...WOLF_PAL };
const LC = ['̀', '́', '̂', '̃', '̄', '̅', '̆', '̇'];   // 腿用的調色盤字元（不跟描圖的字母撞）
[...NEAR, ...FAR].forEach((c, i) => { PAL[LC[i]] = c; });

/* 把一條腿畫進格子：兩段粗細漸變的「骨頭」+ 關節 + 腳掌，前緣亮、後緣暗，最後補一圈外框 */
function leg(out: string[][], D: LegDef, a: [number, number], dx: number, dy: number, far: boolean) {
  const ch = far ? LC.slice(4) : LC.slice(0, 4), lay = new Map<number, string>(), K = (x: number, y: number) => y * 1000 + x;
  const [s1, s2] = D.segs, x0 = D.ax + PX + dx + .5, y0 = D.ay + PT + dy + .5;
  const x1 = x0 + s1.L * Math.sin(a[0]), y1 = y0 + s1.L * Math.cos(a[0]), x2 = x1 + s2.L * Math.sin(a[1]), y2 = y1 + s2.L * Math.cos(a[1]);
  const bone = (ax: number, ay: number, bx: number, by: number, w0: number, w1: number) => {
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy, nx = vy / Math.sqrt(L2), ny = -vx / Math.sqrt(L2);   // n = 前緣方向
    for (let Y = Math.floor(Math.min(ay, by) - 3); Y <= Math.max(ay, by) + 3; Y++) for (let X = Math.floor(Math.min(ax, bx) - 3); X <= Math.max(ax, bx) + 3; X++) {
      const px = X + .5 - ax, py = Y + .5 - ay, u = Math.max(0, Math.min(1, (px * vx + py * vy) / L2)), hw = (w0 + (w1 - w0) * u) / 2;
      const qx = px - vx * u, qy = py - vy * u; if (qx * qx + qy * qy > hw * hw) continue;
      const s = (qx * nx + qy * ny) / hw; lay.set(K(X, Y), s > .3 ? ch[0] : s < -.4 ? ch[2] : ch[1]); }
  };
  bone(x0, y0, x1, y1, s1.w0, s1.w1); bone(x1, y1, x2, y2, s2.w0, s2.w1);
  const pa = a[1] - .15, cx = x2 + 1.1 * Math.cos(pa), cy = y2 - 1.1 * Math.sin(pa) + .3;   // 腳掌：橢圓，跟著腳掌骨轉
  for (let Y = Math.floor(cy - 3); Y <= cy + 3; Y++) for (let X = Math.floor(cx - 4); X <= cx + 4; X++) {
    const px = X + .5 - cx, py = Y + .5 - cy, u = px * Math.cos(pa) - py * Math.sin(pa), v = px * Math.sin(pa) + py * Math.cos(pa);
    if ((u / 2.9) ** 2 + (v / 1.5) ** 2 <= 1) lay.set(K(X, Y), v > .5 ? ch[2] : ch[3]); }
  for (const k of [...lay.keys()]) { const X = k % 1000, Y = (k / 1000) | 0;   // 外框
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!lay.has(K(X + ox, Y + oy))) lay.set(K(X + ox, Y + oy), 'o'); }
  for (const [k, c] of lay) { const X = k % 1000, Y = (k / 1000) | 0; if (Y >= 0 && Y < H && X >= 0 && X < W) out[Y][X] = c; }   // 外框也蓋過後面那條腿：兩條腿重疊時分得出來
  return y2;
}

/* 身體貼上去：pitch = 前半身抬高幾格（負 = 壓低），dy = 整隻往下幾格，sway = 尾巴擺幾格 */
const shearAt = (x: number, pitch: number) => -Math.round(pitch * (x - WOLF_CX) / WOLF_CX);
function pasteBody(out: string[][], body: string[][], pitch: number, dy: number, sway: number) {
  for (let x = 0; x < BW; x++) { const t = x < 13 ? Math.round(sway * Math.pow((13 - x) / 13, 1.4)) : 0, off = dy + shearAt(x, pitch) + t;
    for (let y = 0; y < BH; y++) { const c = body[y][x], Y = y + PT + off; if (c !== '.' && Y >= 0 && Y < H) out[Y][x + PX] = c; } }
}

type Pose = { f: [number, number]; ff: [number, number]; h: [number, number]; hf: [number, number]; pitch: number; dy: number; sway: number };
function pose(t: number | 'stand' | 'leap'): Pose {
  if (t === 'stand') return { f: FRONT.stand, ff: [-.12, 0], h: HIND.stand, hf: [-.22, .16], pitch: 0, dy: 0, sway: 0 };
  if (t === 'leap') return { f: [1.25, 1.1], ff: [1.05, .7], h: [-1.25, -.75], hf: [-1.05, -1.2], pitch: 1, dy: -4, sway: -3 };   // 衝刺：前腳往前伸到底、後腳往後蹬到底
  const P: Pose = { f: gaitAt(FRONT_K, t), ff: gaitAt(FRONT_K, t - .08), h: gaitAt(HIND_K, t), hf: gaitAt(HIND_K, t - .08),
    pitch: 2.2 * Math.cos(2 * Math.PI * (t - .45)), dy: 0, sway: Math.round(-2 + 2 * Math.sin(2 * Math.PI * t)) };
  // 腳比較長（快要伸直往下）的那一下把身體撐高，四條腳都收起來時就騰空
  const reach = (D: LegDef, a: [number, number]) => D.ay + D.segs[0].L * Math.cos(a[0]) + D.segs[1].L * Math.cos(a[1]) + 1.4 - (BH - 1);
  const low = Math.max(reach(FRONT, P.f), reach(HIND, P.h), reach(FRONT, P.ff) - 1, reach(HIND, P.hf) - 1);
  P.dy = -Math.max(0, Math.round(low)) - Math.round(1.6 * Math.max(0, Math.cos(4 * Math.PI * (t - .47))));
  return P;
}

let BODY: string[][] | null = null;
type Frame = ReturnType<typeof makeSprite> & { seat: number };
function compose(t: number | 'stand' | 'leap', sway?: number): Frame {
  const body = BODY || (BODY = bodyGrid()), P = pose(t), out = Array.from({ length: H }, () => Array(W).fill('.'));
  const at = (D: LegDef) => P.dy + shearAt(D.ax, P.pitch);
  leg(out, HIND, P.hf, 4, at(HIND) - 1, true);                          // 遠側後腿
  leg(out, FRONT, P.ff, 4, at(FRONT) - 1, true);                        // 遠側前腿
  leg(out, HIND, P.h, 0, at(HIND), false);                              // 近側後腿
  leg(out, FRONT, P.f, 0, at(FRONT), false);                            // 近側前腿
  pasteBody(out, body, P.pitch, P.dy, sway ?? P.sway);
  const sp = makeSprite(out.map(r => r.join('')), PAL) as Frame; sp.seat = P.dy + shearAt(SEAT_X, P.pitch);   // seat = 背上那一格這一幀往下移了幾格（騎的人跟著動）
  return sp;
}

let RUN: Frame[] | null = null, IDLE: Frame[] = [], LEAP: Frame;
export function wolfFrames() {
  if (!RUN) {
    RUN = []; for (let i = 0; i < RUN_N; i++) RUN.push(compose(i / RUN_N));
    for (let i = 0; i < IDLE_N; i++) IDLE.push(compose('stand', Math.round(Math.sin(2 * Math.PI * i / IDLE_N))));
    LEAP = compose('leap');
  }
  return { RUN, IDLE, LEAP };
}
export type WolfAnim = number | 'leap' | null;                         // 步伐進度 0～1 / 衝刺 / 站著
function frameOf(run: WolfAnim) { const F = wolfFrames(); return run === null ? F.IDLE[Math.floor(G.time * 2.5) % IDLE_N] : run === 'leap' ? F.LEAP : F.RUN[Math.floor(run * RUN_N) % RUN_N]; }
/** 背上那一格這一幀往下移了幾個世界像素（負 = 往上） */
export const wolfSeatDy = (run: WolfAnim) => frameOf(run).seat * HK;
/** 騎著時人要抬高幾個世界像素：女巫腰部（第 50 列）對到狼背，女巫的腳底本來在第 66 列 */
export const RIDE_Y = (BH - 1 - SEAT_Y - (66 - 50)) / 3;               // （直接除 3：HK 在模組載入時可能還沒準備好）

/* 畫星狼：(x, y) = 腳底中心（世界座標）。mode：'n' 一般、'w' 全白、'p' 紫色剪影 */
export function drawWolf(x: number, y: number, flip: boolean, run: WolfAnim, mode: 'n' | 'w' | 'p' = 'n') {
  const sp = frameOf(run);
  const X = snapF(x - (flip ? W - PX - WOLF_CX : PX + WOLF_CX) * HK), Y = snapF(y - (GROUND + 1) * HK);
  const img = mode === 'w' ? (flip ? sp.wf : sp.wn) : mode === 'p' ? (flip ? sp.pf : sp.pn) : (flip ? sp.f : sp.n);
  ctx.drawImage(img, X, Y, sp.w * HK, sp.h * HK);
  if (mode === 'n') twinkle(X, Y + sp.seat * HK, flip);
}

/* 身上幾顆會閃的星星（固定在毛上的位置，輪流亮）+ 眼睛的光暈 */
const TW = [[22, 28], [33, 24], [44, 30], [16, 33], [29, 35], [6, 40], [48, 22], [38, 32], [55, 26]];
function twinkle(X: number, Y: number, flip: boolean) {
  const at = (ax: number, ay: number) => [X + (flip ? W - 1 - ax - PX : ax + PX) * HK, Y + (ay + PT) * HK];
  for (let i = 0; i < TW.length; i++) {
    const p = (G.time * .9 + i * .37) % 1; if (p > .35) continue;
    const q = Math.sin(p / .35 * Math.PI), [sx, sy] = at(TW[i][0], TW[i][1]), r = Math.round(1 + q * 1.5);
    ctx.globalAlpha = .55 + .45 * q; ctx.fillStyle = '#e8dcff';
    ctx.fillRect(sx - r * HK, sy, (r * 2 + 1) * HK, HK); ctx.fillRect(sx, sy - r * HK, HK, (r * 2 + 1) * HK);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, HK, HK);
  }
  const [ex, ey] = at(60, 14), g = .3 + .25 * Math.sin(G.time * 3);    // 眼睛的光暈
  ctx.globalAlpha = g; ctx.fillStyle = '#8a9cff'; ctx.fillRect(ex - 1.5 * HK, ey - HK, 4 * HK, 3 * HK);
  ctx.globalAlpha = 1;
}
