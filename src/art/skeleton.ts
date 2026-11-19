/* 骷髏兵：照使用者給的參考圖一格一格描的（頭、肋骨、骨盆）＋ 用程式畫的手腳和劍（才能走路、揮劍）
   座標：36 × 46 格，面向右邊。這個檔案不碰 DOM，只透過 set(x, y, 顏色) 畫點，方便在 node 預覽 */

// c = 最亮、e = 亮、d = 中、j = 暗、f = 骨頭的空洞（眼窩、肋骨縫）
const BODY = [
  '.........ccccc', '.......ddeccccc', '......dddeeeeccc', '......ddddeeeeecc', '......ddddfffeecf', '......ddddffffeff',
  '......ddddffffeff', '......dddeeeeefec', '.......dddeeeffec', '.......dddeeeeee', '.........dddfefe', '.........ffdfef',
  '.........fff', '....cc.ccccccee', '...ccccefffeeeffd', '......cfcccccceef', '.......ccfffeeffd', '.......ccccccceee',
  '.......ccfffeeffd', '........cccccceee', '........cfffeeffd', '........cffcccefd', '.........cccffee', '.........ccfff',
  '..........fff', '.........jjffjj', '.......eeejjjjjcc', '.......jjeccjjccc', '........ffeecccc', '.......eccfjeeef',
  '.......ecccjjefjj',
];
export const SKEL_W = 36, SKEL_H = 46;
const CAVITY = '#16121e', BLADE = ['#fafafa', '#c8c8cc'], HILT = ['#491009', '#702706'];

type Set = (x: number, y: number, c: string) => void;
/* 兩格粗的骨頭：比較直的 → 左右兩格（左 a、右 b）；比較橫的 → 上下兩格（上 a、下 b） */
function bone(set: Set, x0: number, y0: number, x1: number, y1: number, a: string, b: string) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))) || 1, tall = Math.abs(dy) >= Math.abs(dx);
  for (let i = 0; i <= n; i++) { const x = Math.round(x0 + dx * i / n), y = Math.round(y0 + dy * i / n);
    if (tall) { set(x, y, a); set(x + 1, y, b); } else { set(x, y, a); set(x, y + 1, b); } }
}
function line(set: Set, x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
  for (let i = 0; i <= n; i++) set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
}
/* 兩段的手腳（有手肘、膝蓋）：給起點、終點和兩段的長度，算出關節的位置
   bend = 1 → 關節往「起點→終點」的左邊彎，-1 → 往右邊彎（面向右時：膝蓋往前用 -1、手肘往後用 1） */
function limb(set: Set, sx: number, sy: number, ex: number, ey: number, a: number, b: number, bend: number, ca: string, cb: string, knob?: string) {
  const dx = ex - sx, dy = ey - sy, d = Math.hypot(dx, dy) || 1, dd = Math.min(d, a + b - .01);
  const along = (a * a - b * b + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, a * a - along * along)), ux = dx / d, uy = dy / d;
  const jx = sx + ux * along - uy * h * bend, jy = sy + uy * along + ux * h * bend;
  bone(set, sx, sy, jx, jy, ca, cb); bone(set, jx, jy, ex, ey, ca, cb);
  if (knob) set(Math.round(jx), Math.round(jy), knob);                        // 關節亮一點，看得出是兩根骨頭接起來
}

/* 一拐一拐的走路（6 格）：前腳（亮）是好腳，膝蓋會彎、正常跨步；後腳（暗）是跛腳，膝蓋不彎、拖在地上
   A / B = 好腳 / 跛腳的腳掌偏移，BODY_D = 身體（含手）的偏移，HEAD_D = 頭骨再多的偏移（晚半拍、喀一下）
   0 好腳抬起往前 → 1 好腳踩下 → 2 身體撐到最高、跛腳開始拖 → 3 跛腳拖上來、身體往前倒
   → 4 跛腳踩實、身體一沉、頭骨喀一下 → 5 撐起來、好腳準備抬 */
export const SKEL_WALK = 6;
const LIMP_A = [[6, -2], [4, 0], [2, 0], [0, 0], [-2, 0], [1, -2]], LIMP_B = [[-2, 0], [-3, 0], [-4, 0], [-1, 0], [2, 0], [0, 0]];
const LIMP_BODY = [[1, 0], [1, -1], [0, -1], [0, 0], [0, 1], [0, 0]], LIMP_HEAD = [[0, 0], [0, 0], [0, 0], [-1, 0], [1, 1], [0, 1]];

/* 各個動作的姿勢：hand / tip = 拿劍的手和劍尖，fh = 另一隻手，o = 身體偏移，h = 頭骨偏移，jaw = 下巴張開 */
type Pose = { hand: number[], tip: number[], fh: number[], o?: number[], h?: number[], jaw?: boolean };
const POSES: Record<string, Pose> = {
  ready:  { hand: [11, 29], tip: [-7, 22], fh: [9, 23], o: [-1, 2] },                        // 蓄力：蹲低、劍往後下方拉
  raise:  { hand: [24, 2], tip: [14, -18], fh: [6, 24], o: [0, -1], h: [-1, 0] },           // 劍舉過頭，身體撐高
  swing:  { hand: [30, 14], tip: [48, 6], fh: [0, 26], o: [1, 0], h: [0, 0], jaw: true },   // 揮動中：劍在半空中往前掃
  strike: { hand: [30, 23], tip: [51, 29], fh: [-3, 24], o: [2, 1], h: [1, 0], jaw: true }, // 劈到底：身體壓進去、下巴張開、頭骨往前甩
  recoil: { hand: [27, 26], tip: [40, 37], fh: [-1, 26], o: [1, 1], h: [0, 1] },           // 收招：劍垂下來、身體還沒站直
  hit:    { hand: [25, 19], tip: [37, 1], fh: [-2, 21], o: [-1, 0], h: [-1, -3] },          // 被打：頭骨彈起來離開脖子、手甩開
};

/* R：骨頭顏色（暗→亮 5 階）；eye：眼睛的光
   ph：0~5 跛腳走路、-1 站，或 POSES 裡的動作名稱 */
export function paintSkel(set: Set, R: string[], eye: string, ph: number | string = -1) {
  const C: Record<string, string> = { c: R[4], e: R[3], d: R[2], j: R[1], f: CAVITY };
  const P = typeof ph === 'string' ? POSES[ph] : null, w = !P && +ph >= 0 ? +ph : -1;
  const [ax, ay] = w >= 0 ? LIMP_A[w] : [0, 0], [bx, by] = w >= 0 ? LIMP_B[w] : [0, 0];
  const [ox, oy] = P ? P.o || [0, 0] : w >= 0 ? LIMP_BODY[w] : [0, 0], [hx, hy] = P ? P.h || [0, 0] : w >= 0 ? LIMP_HEAD[w] : [0, 0];
  // 走路時兩隻手跟著好腳反方向擺
  const fh = P ? P.fh : [1 - ax * .7 + ox, 28 + oy], hand = P ? P.hand : [24 + ax * .35 + ox, 25 + oy], tip = P ? P.tip : [34.5 + ax * .35 + ox, 4.5 + oy];

  const S: Set = (x, y, c) => set(x + ox, y + oy, c);                          // 畫在「身體」上（跟著身體偏移）
  // 後腳（暗，跛腳）：膝蓋不彎，一根直的拖著
  bone(set, 15 + ox, 31 + oy, 17.5 + bx, 44 + by, C.j, C.d);
  for (let i = 0; i < 4; i++) set(Math.round(17 + bx) + i, Math.round(45 + by), C.j);
  // 不拿劍的手：手肘往後彎
  limb(set, 3.5 + ox, 15 + oy, fh[0], fh[1], 7, 7, 1, C.e, C.c, C.c);
  set(Math.round(fh[0]) + 2, Math.round(fh[1]), C.c); set(Math.round(fh[0]), Math.round(fh[1]) + 1, C.e);
  // 身體（照參考圖描的）：第 0~12 行是頭骨，多一個頭的偏移；下巴張開 → 第 10 行以下再往下一格
  BODY.forEach((row, y) => { const dx = y < 13 ? hx : 0, dy = y < 13 ? hy + (P?.jaw && y >= 10 ? 1 : 0) : 0;
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') S(x + dx, y + dy, C[row[x]]); });
  if (P?.jaw) for (let x = 10; x <= 15; x++) S(x + hx, 10 + hy, CAVITY);       // 張開的嘴
  for (const [x, y] of [[12, 5], [16, 5]]) S(x + hx, y + hy, eye);             // 眼窩裡的光
  // 前腳（亮，好腳）：膝蓋往前彎
  limb(set, 8 + ox, 31 + oy, 4.5 + ax, 44 + ay, 7.2, 7.2, -1, C.e, C.c, C.c);
  for (let i = 0; i < 4; i++) set(Math.round(4 + ax) + i, Math.round(45 + ay), i < 2 ? C.e : C.c);
  // 拿劍的手臂：手肘往後彎
  limb(set, 17.5 + ox, 13.5 + oy, hand[0] - 1.5, hand[1] - 1, 6.4, 6.4, 1, C.d, C.e, C.e);
  // 劍：劍身兩格（亮 + 灰）、護手跟劍身垂直、握柄往後
  const L = Math.hypot(tip[0] - hand[0], tip[1] - hand[1]), ux = (tip[0] - hand[0]) / L, uy = (tip[1] - hand[1]) / L, px = -uy, py = ux;
  const g = [hand[0] + ux * 1.5, hand[1] + uy * 1.5];
  line(set, hand[0], hand[1], hand[0] - ux * 3.5, hand[1] - uy * 3.5, HILT[0]); set(Math.round(hand[0] - ux * 4), Math.round(hand[1] - uy * 4), HILT[1]);
  bone(set, g[0] + ux * 1.5, g[1] + uy * 1.5, tip[0], tip[1], BLADE[0], BLADE[1]);
  line(set, g[0] - px * 3, g[1] - py * 3, g[0], g[1], HILT[0]); line(set, g[0], g[1], g[0] + px * 3, g[1] + py * 3, HILT[1]);
  line(set, g[0] - px * 3 - ux, g[1] - py * 3 - uy, g[0] - ux, g[1] - uy, HILT[0]);
  // 握劍的手骨
  set(Math.round(hand[0]), Math.round(hand[1]), C.e); set(Math.round(hand[0] + px), Math.round(hand[1] + py), C.e);
}
/* 劍的殘影：揮動中、劈到底兩格，在劍掃過的弧線上畫半透明的點（[x, y, 透明度]，不加外框） */
export function skelSmear(ph: number | string): number[][] {
  const arc = ph === 'swing' ? [-1.69, -.3, 17, 31] : ph === 'strike' ? [-.3, .42, 19, 35] : null;
  if (!arc) return [];
  const [a0, a1, r0, r1] = arc, cx = 18 + (POSES[ph as string].o?.[0] || 0), cy = 14 + (POSES[ph as string].o?.[1] || 0), seen = new Map<string, number[]>();
  for (let a = a0; a <= a1; a += .015) { const k = (a - a0) / (a1 - a0);       // 越接近劍現在的位置越亮
    for (let r = r1 - 1.5 - 5 * k; r <= r1; r += .5) { const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r), key = x + ',' + y, al = .12 + .72 * k * k * (1 - .45 * (r1 - r) / 7);   // 月牙：靠劍尖最亮、越往內越淡
      if (!seen.has(key) || seen.get(key)[2] < al) seen.set(key, [x, y, al]); } }
  return [...seen.values()];
}
/* 各動作圖要多留的空間（左右一樣寬 → 中心不變；只加上面 → 腳底不變） */
export const SKEL_PAD: Record<string, { l?: number, r?: number, t?: number }> = {
  ready: { l: 9, r: 9 }, raise: { t: 20 }, swing: { l: 16, r: 16, t: 18 }, strike: { l: 18, r: 18 }, recoil: { l: 6, r: 6 }, hit: { l: 4, r: 4, t: 4 } };
export const SKEL_POSES = Object.keys(POSES);
