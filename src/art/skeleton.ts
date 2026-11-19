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
/* 走路：一隻腳踩前 → 正下方 → 蹬到後面 → 抬起來；另一隻差半圈（跟其他怪物一樣） */
function gait(ph: number, d: number, L: number) {
  if (ph < 0) return [[0, 0], [0, 0]];
  const G = [[d, 0], [0, 0], [-d, 0], [0, -L]];
  return [G[ph], G[(ph + 2) % 4]];
}

/* R：骨頭顏色（暗→亮 5 階）；eye：眼睛的光；ph：0~3 走路、-1 站、'raise' 舉劍、'strike' 往前劈 */
export function paintSkel(set: Set, R: string[], eye: string, ph: number | string = -1) {
  const C: Record<string, string> = { c: R[4], e: R[3], d: R[2], j: R[1], f: CAVITY };
  const pose = typeof ph === 'string' ? ph : '', [[ax, ay], [bx, by]] = gait(pose ? -1 : +ph, 3, 2.2);
  // 不拿劍的手（畫面左邊）：手掌位置；拿劍的手：手掌和劍尖
  let fh = [1 - bx * 1.1, 28 - Math.abs(bx) * .45];
  let hand = [24 - ax * .8, 25 - Math.abs(ax) * .32], tip = [34.5 - ax * .8, 4.5 - Math.abs(ax) * .32];
  if (pose === 'raise') { hand = [24, 2]; tip = [14, -18]; fh = [5, 25]; }       // 劍舉過頭往後拉，另一隻手往前平衡
  if (pose === 'strike') { hand = [30, 23]; tip = [51, 29]; fh = [-3, 24]; }     // 劍往前劈出去，另一隻手往後甩

  // 後腳（暗）
  bone(set, 15, 31, 17.5 + bx, 44 + by, C.j, C.d);
  for (let i = 0; i < 4; i++) set(Math.round(17 + bx) + i, Math.round(45 + by), C.j);
  // 不拿劍的手
  bone(set, 3.5, 15, fh[0], fh[1], C.e, C.c);
  set(Math.round(fh[0]) + 2, Math.round(fh[1]), C.c); set(Math.round(fh[0]), Math.round(fh[1]) + 1, C.e);
  // 身體（照參考圖描的）
  BODY.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') set(x, y, C[row[x]]); });
  for (const [x, y] of [[12, 5], [16, 5]]) set(x, y, eye);                     // 眼窩裡的光
  // 前腳（亮）
  bone(set, 8, 31, 4.5 + ax, 44 + ay, C.e, C.c);
  for (let i = 0; i < 4; i++) set(Math.round(4 + ax) + i, Math.round(45 + ay), i < 2 ? C.e : C.c);
  // 拿劍的手臂
  bone(set, 17.5, 13.5, hand[0] - 2, hand[1] - 1, C.d, C.e);
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
/* 舉劍、劈砍時圖要多留的空間（左右一樣寬 → 中心不變；只加上面 → 腳底不變） */
export const SKEL_PAD: Record<string, { l?: number, r?: number, t?: number }> = { raise: { t: 20 }, strike: { l: 17, r: 17 } };
