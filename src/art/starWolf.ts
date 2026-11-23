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
// 一個步伐的關鍵姿勢 [t, 第一段, 第二段, 第三段]，中間用平滑曲線補。t = 0：前腳往前伸到底、後腳往後蹬到底（身體拉最長）
const FRONT_K = [[0, .2, 1.0, .9], [.14, .05, .55, .5], [.28, -.3, 0, .1], [.4, -.7, -.55, -.7], [.52, -.75, -.3, -1.9], [.7, -.3, .5, -1.0], [.88, .1, 1.05, .4]];
const HIND_K = [[0, -.3, -1.2, -.6], [.13, .2, -1.15, -1.0], [.3, .7, -.5, -.7], [.44, .9, .1, .25], [.55, .7, -.2, .2], [.7, .35, -.55, .05], [.85, -.05, -1.0, -.4]];
function gaitAt(K: number[][], t: number): A3 {                         // 週期性 Catmull-Rom：關鍵姿勢之間圓滑地過去
  t = ((t % 1) + 1) % 1; let i = K.length - 1; while (K[i][0] > t) i--;
  const P = (k: number) => K[((k % K.length) + K.length) % K.length], t0 = K[i][0], t1 = i + 1 < K.length ? K[i + 1][0] : 1, u = (t - t0) / (t1 - t0);
  const cr = (j: number) => { const a = P(i - 1)[j], b = P(i)[j], c = P(i + 1)[j], d = P(i + 2)[j];
    return .5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u); };
  return [cr(1), cr(2), cr(3)];
}
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

/* 身體貼上去：pitch = 前半身抬高幾格（負 = 壓低），dy = 整隻往下幾格，sway = 尾巴擺幾格 */
const shearAt = (x: number, pitch: number) => -Math.round(pitch * (x - WOLF_CX) / WOLF_CX);
/* stretch = 身體拉長幾格：前半身往前、後半身往後各挪 stretch 格，中間的縫用中間那一欄補（負 = 縮短，前後半身疊在一起） */
const MID = 30;                                                          // 從這一欄分成前後半身（肋骨中間，騎的人坐的位置附近）
const halfShift = (x: number, stretch: number) => x >= MID ? stretch : -stretch;
function pasteBody(out: string[][], body: string[][], pitch: number, dy: number, sway: number, stretch = 0) {
  const col = (x: number, tx: number) => { const t = x < 13 ? Math.round(sway * Math.pow((13 - x) / 13, 1.4)) : 0, off = dy + shearAt(x, pitch) + t;
    for (let y = 0; y < BH; y++) { const c = body[y][x], Y = y + PT + off; if (c !== '.' && Y >= 0 && Y < H && tx >= 0 && tx < W) out[Y][tx] = c; } };
  for (let x = 0; x < MID; x++) col(x, x + PX - stretch);                // 後半身
  for (let g = -stretch; g < stretch; g++) col(MID, MID + PX + g);       // 拉長時中間的縫
  for (let x = MID; x < BW; x++) col(x, x + PX + stretch);               // 前半身（縮短時蓋在後半身上面）
}

const FAR_LAG = .2;                                                      // 遠側的腿慢 1/5 個步伐：四條腿各動各的，看得出四條都在跑
type Pose = { f: A3; ff: A3; h: A3; hf: A3; pitch: number; dy: number; sway: number; stretch: number };
function pose(t: number | 'stand' | 'leap'): Pose {
  if (t === 'stand') return { f: FRONT.stand, ff: [-.45, -.12, .05], h: HIND.stand, hf: [.25, -.65, .2], pitch: 0, dy: 0, sway: 0, stretch: 0 };
  if (t === 'leap') return { f: [.5, 1.35, 1.2], ff: [.35, 1.1, .8], h: [-.55, -1.35, -.9], hf: [-.35, -1.2, -1.4], pitch: 1, dy: -4, sway: -3, stretch: 2 };   // 衝刺：前腳往前伸到底、後腳往後蹬到底
  const P: Pose = { f: gaitAt(FRONT_K, t), ff: gaitAt(FRONT_K, t - FAR_LAG), h: gaitAt(HIND_K, t), hf: gaitAt(HIND_K, t - FAR_LAG),
    pitch: 2.2 * Math.cos(2 * Math.PI * (t - .45)), dy: 0, sway: Math.round(-2 + 2 * Math.sin(2 * Math.PI * t)),
    stretch: Math.round(2 * Math.cos(2 * Math.PI * t)) };   // 前後腳張開（t = 0）時身體拉長，收到肚子下面（t = 0.5）時縮短
  // 腳比較長（快要伸直往下）的那一下把身體撐高，四條腳都收起來時就騰空
  const reach = (D: LegDef, a: A3) => reachOf(D, a) - (BH - 1);
  const low = Math.max(reach(FRONT, P.f), reach(HIND, P.h), reach(FRONT, P.ff) - 1, reach(HIND, P.hf) - 1);
  P.dy = -Math.max(0, Math.round(low)) - Math.round(1.6 * Math.max(0, Math.cos(4 * Math.PI * (t - .47))));
  return P;
}

let BODY: string[][] | null = null;
type Frame = ReturnType<typeof makeSprite> & { seat: number };
function compose(t: number | 'stand' | 'leap', sway?: number): Frame {
  const body = BODY || (BODY = bodyGrid()), P = pose(t), out = Array.from({ length: H }, () => Array(W).fill('.'));
  const at = (D: LegDef) => P.dy + shearAt(D.ax, P.pitch), sx = (D: LegDef) => halfShift(D.ax, P.stretch);   // 腿跟著那半邊身體前後挪
  leg(out, HIND, P.hf, 5 + sx(HIND), at(HIND) - 1, true);               // 遠側後腿（在身體後面）
  leg(out, FRONT, P.ff, 5 + sx(FRONT), at(FRONT) - 1, true);            // 遠側前腿
  pasteBody(out, body, P.pitch, P.dy, sway ?? P.sway, P.stretch);
  leg(out, HIND, P.h, sx(HIND), at(HIND), false);                       // 近側後腿（畫在身體上面：看得到大腿繞著髖關節轉）
  leg(out, FRONT, P.f, sx(FRONT), at(FRONT), false);                    // 近側前腿
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
