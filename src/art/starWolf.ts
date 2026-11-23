import { G } from '../core/state';
import { HK, ctx, snapF } from '../core/canvas';
import { makeSprite } from './sprite';
import { WOLF_PAL, WOLF_RUN, WOLF_STAND, type WolfArt } from './starWolfArt';

/* ================= 星狼 =================
   · 站著：照參考圖描的站姿，尾巴慢慢擺（4 格）
   · 跑步：照參考圖描的 4 格奔跑
   · 圖上的四芒星輪流閃、眼睛有一圈藍紫色的光暈
   · 第一次用到才畫，之後都用同一組圖 */

/* 一格圖 + 對位資料：ax = 狼的中心欄、foot = 腳底那一列、seat = 背上騎的人坐的那一列、tw = 會閃的星星、eye = 眼睛 */
type Frame = ReturnType<typeof makeSprite> & { ax: number; foot: number; seat: number; tw: [number, number][]; eye: [number, number] };
function frame(A: WolfArt, rows = A.r): Frame {
  const sp = makeSprite(rows, WOLF_PAL) as Frame; sp.ax = A.cx; sp.foot = A.foot; sp.seat = A.seat; sp.tw = []; sp.eye = [0, 0];
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { if (r[x] === '2' && r[x - 1] === '3') sp.tw.push([x, y]); else if (r[x] === '1') sp.eye = [x, y]; } });   // 2 = 四芒星中心、1 = 眼睛（art/starWolfArt.ts）
  return sp;
}
/* 尾巴擺 sway 格：最左邊 14 欄上下錯開，越往尾尖錯越多 */
function swayTail(rows: string[], sway: number) {
  if (!sway) return rows;
  const g = rows.map(r => [...r]), out = rows.map(r => [...r]);
  for (let x = 0; x < 14; x++) { const d = Math.round(sway * Math.pow((14 - x) / 14, 1.4)); if (!d) continue;
    for (let y = 0; y < g.length; y++) if (x < out[y].length) out[y][x] = '.';
    for (let y = 0; y < g.length; y++) { const c = g[y][x], Y = y + d; if (c && c !== '.' && Y >= 0 && Y < g.length) { while (out[Y].length <= x) out[Y].push('.'); out[Y][x] = c; } } }
  return out.map(r => r.join(''));
}

const IDLE_N = 4;
let RUN: Frame[] | null = null, IDLE: Frame[] = [];
export function wolfFrames() {
  if (!RUN) {
    RUN = WOLF_RUN.map(A => frame(A));
    for (let i = 0; i < IDLE_N; i++) IDLE.push(frame(WOLF_STAND, swayTail(WOLF_STAND.r, Math.round(Math.sin(2 * Math.PI * i / IDLE_N)))));
  }
  return { RUN, IDLE };
}
export type WolfAnim = number | null;                                  // 步伐進度 0～1（null = 站著）
function frameOf(run: WolfAnim) { const F = wolfFrames(); return run === null ? F.IDLE[Math.floor(G.time * 2.5) % IDLE_N] : F.RUN[Math.floor(run * F.RUN.length) % F.RUN.length]; }
/** 騎著時人要抬高幾個世界像素：女巫腰部（第 50 列）對到狼背，女巫的腳底本來在第 66 列 */
export const wolfRideY = (run: WolfAnim) => { const f = frameOf(run); return (f.foot - f.seat - (66 - 50)) * HK; };
export const RIDE_Y = (WOLF_STAND.foot - WOLF_STAND.seat - (66 - 50)) / 3;   // 站著時（跳下來的動畫用；直接除 3：HK 在模組載入時可能還沒準備好）

/* 畫星狼：(x, y) = 腳底中心（世界座標）。mode：'n' 一般、'w' 全白、'p' 紫色剪影 */
export function drawWolf(x: number, y: number, flip: boolean, run: WolfAnim, mode: 'n' | 'w' | 'p' = 'n') {
  const sp = frameOf(run);
  const X = snapF(x - (flip ? sp.w - 1 - sp.ax : sp.ax) * HK), Y = snapF(y - (sp.foot + 1) * HK);
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
