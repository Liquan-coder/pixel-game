/* ================= Boss 骨架：把一張描好的 Boss 圖拆成「身體 / 武器 / 握武器的手」三層 =================
   art/bossArt.ts 是自動產生的整張圖（武器跟身體黏在一起），不能手改 → 在這裡用「哪些格子是武器」的規則，執行時拆開。
   拆開以後：武器繞著手轉（render/bossAnim.ts 決定每一格的角度），手畫在武器上面，看起來就是「握著」。
   新增一隻：在 RIG 加一筆，然後到 render/bossAnim.ts 寫牠的動作（流程見 docs/boss-anim-sop.md）。 */
import { BOSS_ART } from './bossArt';
import { makeHD } from './monsters';
import { rotGrid } from './sprite';
import { gridCanvas } from './weapon';
import { TAU } from '../core/util';

export interface RigSpec {
  wpn: (x: number, y: number) => boolean;    // 這一格是武器嗎（美術格座標）
  hand: (x: number, y: number) => boolean;   // 這一格是握武器的手嗎（畫在武器上面）
  fill?: { y0: number; y1: number; x: number; s: string };   // 手擋住的那段武器：用 s 補回去（不然武器推出去會缺一截）
  grip: [number, number];                    // 手握住武器的那一格
  base: number;                              // 原圖裡武器尖端指的方向（往上 = -π/2）
  mirror?: boolean;                          // 原圖武器拿在畫面左邊 → 遊戲裡翻過來，讓武器那一側朝向玩家
}
export const RIG: Record<string, RigSpec> = {
  // 霜墓騎士：長戟在最左邊 0~8 欄，戟刃（24~37 列）往右伸到第 15 欄；手握在第 57~66 列
  db_frostknight: { wpn: (x, y) => (x <= 8 && !(y >= 57 && y <= 66)) || (y >= 24 && y <= 37 && x <= 15), hand: (x, y) => y >= 57 && y <= 66 && x <= 7,
    fill: { y0: 57, y1: 66, x: 3, s: 'omwo' }, grip: [4.5, 62], base: -Math.PI / 2, mirror: true },
};
export interface Rig { spec: RigSpec; body: any; hand: any; wrows: string[]; wpal: Record<string, string>; aw: number; ah: number }
const cache: Record<string, Rig> = {};
function layer(rows: string[], pal, keep: (x: number, y: number) => boolean) {   // 只留 keep 的格子，畫成跟原圖一樣大的 canvas（大家共用同一個腳底中心點）
  const w = Math.max(...rows.map(r => r.length)), c = document.createElement('canvas'); c.width = w; c.height = rows.length; const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = pal[r[x]]; if (col && keep(x, y)) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return c;
}
export function rigOf(kind: string): Rig | null {
  if (cache[kind]) return cache[kind];
  const spec = RIG[kind], A = BOSS_ART[kind]; if (!spec || !A) return null;
  const { wpn, hand } = spec, aw = Math.max(...A.r.map(r => r.length));
  const wrows = A.r.map((r, y) => [...r.padEnd(aw, '.')].map((ch, x) => wpn(x, y) ? ch : '.').join(''));
  if (spec.fill) for (let y = spec.fill.y0; y <= spec.fill.y1; y++) wrows[y] = wrows[y].slice(0, spec.fill.x) + spec.fill.s + wrows[y].slice(spec.fill.x + spec.fill.s.length);
  const last = wrows.reduce((m, r, y) => /[^.]/.test(r) ? y : m, 0), first = wrows.findIndex(r => /[^.]/.test(r));
  return cache[kind] = { spec, aw, ah: A.r.length, wpal: A.p, wrows: wrows.slice(first, last + 1).map(r => r.replace(/\.+$/, '') || '.'),
    body: makeHD(layer(A.r, A.p, (x, y) => !wpn(x, y) && !hand(x, y))), hand: makeHD(layer(A.r, A.p, hand)), ...{ _y0: first } } as Rig;
}
/* 武器轉到某個角度的圖（64 個角度，第一次用到才算，算過就存起來）。回傳 canvas + 握把在圖上的位置 */
const NROT = 64, WCACHE = new Map<string, { c: HTMLCanvasElement; w: HTMLCanvasElement; ox: number; oy: number }>();
export function weaponFrame(kind: string, rig: Rig, ang: number, mirror: boolean) {
  const i = ((Math.round(ang / TAU * NROT) % NROT) + NROT) % NROT, key = kind + (mirror ? 'm' : 'n') + i;
  let f = WCACHE.get(key);
  if (!f) { const y0 = (rig as any)._y0, r = rotGrid(rig.wrows, [rig.spec.grip[0], rig.spec.grip[1] - y0], i / NROT * TAU, mirror, rig.spec.base), c = gridCanvas(r.rows, rig.wpal);
    const w = document.createElement('canvas'); w.width = c.width; w.height = c.height; const g = w.getContext('2d');   // 被打中閃白用
    g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    WCACHE.set(key, f = { c, w, ox: r.ox, oy: r.oy }); }
  return f;
}
