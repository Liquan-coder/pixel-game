/* ================= Boss 骨架：把一張描好的 Boss 圖拆成幾層，各自轉 =================
   art/bossArt.ts 是自動產生的整張圖（武器跟身體黏在一起），不能手改 → 在這裡用「哪些格子是什麼」的規則，執行時拆開：
     wpn  武器：繞著手轉（render/bossAnim.ts 決定每一格的角度）
     arm  拿武器的手臂（前臂 + 手）：繞肩膀轉，武器跟著手走
     arm2 另一隻手（例：提燈的手）：繞自己的肩膀轉
     hang 吊在手上的東西（例：燈）：跟著 arm2 的手走，自己像鐘擺一樣晃
   拆掉的地方如果被身體包住（例：劍擋在腳前面），patch 會用旁邊的顏色補起來，不然武器一動腳上就破一個洞。
   新增一隻：在 RIG 加一筆，然後到 render/bossAnim.ts 寫牠的動作（流程見 docs/boss-anim-sop.md）。 */
import { BOSS_ART } from './bossArt';
import { makeHD } from './monsters';
import { rotGrid } from './sprite';
import { gridCanvas } from './weapon';
import { TAU } from '../core/util';

type Pick = (x: number, y: number, ch: string, at: (x: number, y: number) => string) => boolean;   // ch = 這一格的字母，at = 查別格
export interface Limb { pick: Pick; pivot: [number, number] }       // pivot = 轉的中心（肩膀 / 吊點）
export type Layer = 'body' | 'wpn' | 'arm' | 'hand' | 'arm2' | 'hang';
export interface RigSpec {
  wpn: Pick;                                 // 這一格是武器嗎
  hand: Pick;                                // 握武器的手（沒有 arm 的時候用：畫在武器上面）
  arm?: Pick;                                // 前臂 + 手：繞著 shoulder 轉。有 arm 的話 hand 要包含在 arm 裡
  shoulder?: [number, number];               // 肩膀（手臂轉的中心，藏在肩甲底下）
  shrug?: number;                            // 舉過頭時整隻手臂往上提幾格（前臂太短、只轉的話手只到頭盔）
  arm2?: Limb;                               // 另一隻手
  hang?: Limb;                               // 吊在 arm2 手上的東西：pivot = 吊點（跟著 arm2 轉），自己像鐘擺一樣晃
  light?: [number, number];                  // hang 上會發光的那一點（燈芯）
  fill?: { y0: number; y1: number; x: number; s: string };   // 手擋住的那段武器：用 s 補回去（不然武器推出去會缺一截）
  patch?: boolean;                           // 拆掉的格子如果被身體包住 → 用最近的身體顏色補起來
  grip: [number, number];                    // 手握住武器的那一格
  tip?: number;                              // 握的地方到武器尖端幾格（尖端發光用；沒寫 = 握的地方到圖的最上面）
  base: number;                              // 原圖裡武器尖端指的方向（往上 = -π/2）
  mirror?: boolean;                          // 原圖武器拿在畫面左邊 → 遊戲裡翻過來，讓武器那一側朝向玩家
  order?: Layer[];                           // 畫的順序（前面的先畫 = 在後面）
}
/* 近衛隊長：劍斜斜地拿在身前（劍柄尾端 (15,60) → 劍尖 (82,99)，往右下 30°），劍身擋在腳前面 → 要 patch。
   劍用「沿著劍軸的一條帶子 + 顏色」挑：劍身是偏藍的灰（k y q D v），劍柄 / 護手是橘色（s b t），f E g 跟盔甲共用 → 只在劍身那段算 */
const CAP_AX = 15, CAP_AY = 60.5, CAP_C = Math.cos(.523), CAP_S = Math.sin(.523);
const capUV = (x: number, y: number) => { const dx = x + .5 - CAP_AX, dy = y + .5 - CAP_AY; return [dx * CAP_C + dy * CAP_S, -dx * CAP_S + dy * CAP_C]; };
const capBlade = (x: number, y: number, k: string) => { const [u, v] = capUV(x, y); if (!k || k === '.') return false;
  if (u > -4 && u < 5 && Math.abs(v) < 3.5 && k !== 'o') return true;   // 劍柄尾端：附近的格子全算（有暗紅 A、n、y）
  if ('sbt'.includes(k)) return u > -5 && u < 26 && Math.abs(v) < 11;
  if ('kyqDv'.includes(k)) return u > 14 && u < 84 && Math.abs(v) < 6.5;
  if ('fEg'.includes(k)) return u > 20 && u < 84 && Math.abs(v) < 6.5;
  return false; };
const capSword: Pick = (x, y, k, at) => { if (capBlade(x, y, k)) return true; if (k !== 'o') return false;   // 劍的黑框：離劍 2 格以內的黑色（這張圖的劍有兩層黑邊）
  const [u, v] = capUV(x, y); if (u < -5 || u > 86 || Math.abs(v) > 12) return false;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && capBlade(x + dx, y + dy, at(x + dx, y + dy))) return true;
  return false; };
export const RIG: Record<string, RigSpec> = {
  // 霜墓騎士：長戟在最左邊 0~8 欄，戟刃（24~37 列）往右伸到第 15 欄；手握在第 57~66 列；前臂在肩甲下面（53~66 列、16 欄以左）
  db_frostknight: { wpn: (x, y) => (x <= 8 && !(y >= 57 && y <= 66)) || (y >= 24 && y <= 37 && x <= 15), hand: (x, y) => y >= 57 && y <= 66 && x <= 7,
    fill: { y0: 57, y1: 66, x: 3, s: 'omwo' }, grip: [4.5, 62], base: -Math.PI / 2, mirror: true,
    arm: (x, y) => y >= 53 && y <= 66 && x <= 16, shoulder: [14, 47], shrug: 8, order: ['wpn', 'arm', 'body'] },
  // 近衛隊長：右手（畫面左邊）一長條手臂從肩甲下面垂到手套（41~68 列、19~31 欄，不含紅色披風 x j i h）；
  // 左手（畫面右邊）舉著拳頭（26~40 列、61 欄以右），燈吊在拳頭下面（41~67 列、66 欄以右），燈芯在 (75,53)
  db_captain: { wpn: capSword, hand: () => false, grip: [23, 65], tip: 66, base: .523, patch: true,
    arm: (x, y, k, at) => x >= 19 && x <= 31 && y >= 41 && y <= 68 && !'xjih'.includes(k) && !capSword(x, y, k, at), shoulder: [29, 39],
    arm2: { pick: (x, y) => x >= 61 && y >= 26 && y <= 40, pivot: [59, 36] },
    hang: { pick: (x, y) => x >= 66 && y >= 41 && y <= 67, pivot: [75, 41] }, light: [75, 53],
    order: ['body', 'arm2', 'hang', 'wpn', 'arm'] },
};
export interface Part { rows: string[]; y0: number; pivot: [number, number] }
export interface Rig { spec: RigSpec; body: any; hand: any; wrows: string[]; wy0: number; wpal: Record<string, string>; aw: number; ah: number; limbs: Partial<Record<'arm' | 'arm2' | 'hang', Part>> }
const cache: Record<string, Rig> = {};
function canvasOf(rows: string[], pal) {                                  // 格子 → canvas（一格 = 一個細像素）
  const w = Math.max(...rows.map(r => r.length)), c = document.createElement('canvas'); c.width = w; c.height = rows.length; const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = pal[r[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return c;
}
const trim = (rows: string[]) => { const y0 = rows.findIndex(r => /[^.]/.test(r)), y1 = rows.reduce((m, r, y) => /[^.]/.test(r) ? y : m, 0); return { y0, rows: rows.slice(y0, y1 + 1) }; };
export function rigOf(kind: string): Rig | null {
  if (cache[kind]) return cache[kind];
  const spec = RIG[kind], A = BOSS_ART[kind]; if (!spec || !A) return null;
  const aw = Math.max(...A.r.map(r => r.length)), G = A.r.map(r => r.padEnd(aw, '.')), at = (x: number, y: number) => (G[y] || '')[x] || '.';
  const is = (p: Pick | undefined) => p ? (x: number, y: number) => G[y][x] !== '.' && p(x, y, G[y][x], at) : () => false;
  const wpn = is(spec.wpn), arm = spec.arm ? (x, y) => is(spec.arm)(x, y) && !wpn(x, y) : null, hand = arm || is(spec.hand);
  const arm2 = is(spec.arm2?.pick), hang = (x, y) => is(spec.hang?.pick)(x, y) && !arm2(x, y);
  const grid = (keep: (x: number, y: number) => boolean) => G.map((r, y) => [...r].map((ch, x) => keep(x, y) ? ch : '.').join(''));
  const wfull = grid(wpn);
  if (spec.fill) for (let y = spec.fill.y0; y <= spec.fill.y1; y++) wfull[y] = wfull[y].slice(0, spec.fill.x) + spec.fill.s + wfull[y].slice(spec.fill.x + spec.fill.s.length);
  const W = trim(wfull);
  // 身體 = 剩下的格子；patch：被拆掉、但上下（或左右）都還有身體的格子 → 補上最近的身體顏色
  const keep = (x: number, y: number) => !wpn(x, y) && !hand(x, y) && !arm2(x, y) && !hang(x, y);
  const body = grid(keep);
  if (spec.patch) { const B = body.map(r => [...r]), kept = (x: number, y: number) => (body[y] || '')[x] && body[y][x] !== '.';
    for (let y = 0; y < G.length; y++) for (let x = 0; x < aw; x++) { if (G[y][x] === '.' || kept(x, y)) continue;
      const near: [number, string][] = [];
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) for (let k = 1; k <= 12; k++) if (kept(x + dx * k, y + dy * k)) { near.push([k, body[y + dy * k][x + dx * k]]); break; } else if (k === 12) near.push([99, '']);
      const ud = near[0][0] < 99 && near[1][0] < 99, lr = near[2][0] < 99 && near[3][0] < 99;   // 上下都有身體 → 用上下比較近的那個（腿、披風是直的，往下延伸才連得起來）
      if (ud) B[y][x] = (near[0][0] <= near[1][0] ? near[0] : near[1])[1]; else if (lr) B[y][x] = (near[2][0] <= near[3][0] ? near[2] : near[3])[1]; }
    for (let y = 0; y < G.length; y++) body[y] = B[y].join(''); }
  const limbs: Rig['limbs'] = {};
  if (arm) limbs.arm = { ...trim(grid(arm)), pivot: spec.shoulder };
  if (spec.arm2) limbs.arm2 = { ...trim(grid(arm2)), pivot: spec.arm2.pivot };
  if (spec.hang) limbs.hang = { ...trim(grid(hang)), pivot: spec.hang.pivot };
  return cache[kind] = { spec, aw, ah: A.r.length, wpal: A.p, wrows: W.rows.map(r => r.replace(/\.+$/, '') || '.'), wy0: W.y0, limbs,
    body: makeHD(canvasOf(body, A.p)), hand: makeHD(canvasOf(grid(hand), A.p)) };
}
const NROT = 64, WCACHE = new Map<string, { c: HTMLCanvasElement; w: HTMLCanvasElement; ox: number; oy: number }>();
function frame(key: string, mk: () => { rows: string[]; ox: number; oy: number }, pal) {   // 轉好的圖 + 閃白版，存起來重複用
  let f = WCACHE.get(key);
  if (!f) { const r = mk(), c = gridCanvas(r.rows, pal), w = document.createElement('canvas'); w.width = c.width; w.height = c.height; const g = w.getContext('2d');
    g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    WCACHE.set(key, f = { c, w, ox: r.ox, oy: r.oy }); }
  return f;
}
const step = (ang: number) => ((Math.round(ang / TAU * NROT) % NROT) + NROT) % NROT;
/* 手臂 / 燈轉了 th（美術格的角度，沒翻面時正 = 順時針）的圖。回傳的 ox/oy = 轉軸在圖上的位置 */
export function limbFrame(kind: string, rig: Rig, part: 'arm' | 'arm2' | 'hang', th: number, mirror: boolean) {
  const L = rig.limbs[part], i = step(mirror ? Math.PI - th : th);         // rotGrid 翻面以後角度也要翻
  return frame(kind + part + (mirror ? 'm' : 'n') + i, () => rotGrid(L.rows, [L.pivot[0], L.pivot[1] - L.y0], i / NROT * TAU, mirror, 0), rig.wpal);
}
/* 武器轉到某個角度的圖（64 個角度，第一次用到才算）。回傳 canvas + 握把在圖上的位置 */
export function weaponFrame(kind: string, rig: Rig, ang: number, mirror: boolean) {
  const i = step(ang);
  return frame(kind + (mirror ? 'm' : 'n') + i, () => rotGrid(rig.wrows, [rig.spec.grip[0], rig.spec.grip[1] - rig.wy0], i / NROT * TAU, mirror, rig.spec.base), rig.wpal);
}
