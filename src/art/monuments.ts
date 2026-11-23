/* ================= 地城的守護王像（岩丘頂上那一尊，120×200 美術像素） =================
   每座地城都是同一尊：戴王冠、披著斗篷的騎士王，雙手按在插進石座的大劍上。
   刻意不雕 Boss 的樣子 → 玩家不會先知道裡面住著什麼，只知道「這裡是某個古老王國守著的地方」。
   每個東西都是平的切面（跟守門雕像、星之神像同一套，art/stoneArt.ts），光從左上來：左邊亮、右邊暗、朝上的面最亮。
   石頭顏色跟著地區（雪原積雪、熔岩區發光裂縫、平原 / 森林 / 沼澤長青苔）。
   MON_TOP = 紫色光柱冒出來的地方（王冠正上方，world/dungeonArt.ts 的 beacon），美術像素座標。 */
import { mulberry32 } from '../core/util';
import { sculpt } from './monsters';
import { type Pt, norm, poly, slab } from './stoneArt';

export const MON_W = 120, MON_H = 200;
export const MON_TOP: Pt = [60, 20];
const W = MON_W;
const LIT = norm(-.75, -.15, .65), MID = norm(-.15, .1, .98), DRK = norm(.8, .05, .6), UPF = norm(-.1, -.85, .5);

type Part = { sh: any; ramp?: string[]; grp: number; bias?: number };
const P = (pts: Pt[], n: number[], g: number, bias = .05): Part => ({ sh: poly(pts, n), grp: g, bias });
const mx = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [W - x, y] as Pt);           // 左右鏡像（以中線 x = 60 為軸）
const flip = (n: number[]) => norm(-n[0], n[1], n[2]);                           // 鏡像那一半的法線：朝右 → 比較暗
/* 對稱的一對面：左邊照 n 打光，右邊鏡像、多加一點 bias（暗面不要黑成一片，最深的顏色留給外框和刻痕） */
const pair = (pts: Pt[], n: number[], g: number, bias = .05): Part[] => [P(pts, n, g, bias), P(mx(pts), flip(n), g, bias + .2)];
/* 一根有粗細的「棍子」：沿著中線切成兩半，一半朝左上（亮）、一半朝右下（暗）→ 看起來是有稜角的 */
function bar(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, g: number): Part[] {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, px = -(y1 - y0) / L, py = (x1 - x0) / L;
  const side = (s: number) => P([[x0, y0], [x0 + px * w0 * s, y0 + py * w0 * s], [x1 + px * w1 * s, y1 + py * w1 * s], [x1, y1]], norm(px * s, py * s * .8, .7), g, .1);
  return [side(1), side(-1)];
}
/* 一顆有切面的圓塊：中間一個平的頂面（往左上偏）+ 一圈側面，每個面朝哪裡就照哪裡的亮度 */
function gem(R: () => number, cx: number, cy: number, rx: number, ry: number, n: number, g: number): Part[] {
  const out: Pt[] = [], inn: Pt[] = [], ix = cx - rx * .12, iy = cy - ry * .25, k = .45;
  for (let i = 0; i < n; i++) { const a = -Math.PI + (i + .5) / n * Math.PI * 2, r = .9 + R() * .12, x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    out.push([x, y]); inn.push([ix + (x - cx) * k, iy + (y - cy) * k]); }
  const parts = [P(inn, norm(-.15, -.45, .9), g, .25)];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, ux = (out[i][0] + out[j][0]) / 2 - cx, uy = (out[i][1] + out[j][1]) / 2 - cy, m = Math.hypot(ux, uy) || 1;
    parts.push(P([inn[i], out[i], out[j], inn[j]], norm(ux / m, uy / m * .8, .45), g, .25 + (uy > 0 ? .2 : 0))); }
  return parts;
}

const cache = new Map<string, HTMLCanvasElement>();
/* S = 石頭顏色（跟著地區），r = 地區編號 */
export function monument(S: string[], r: number) {
  const key = S.join() + r; if (cache.has(key)) return cache.get(key);
  const R = mulberry32(4242 + r);
  const parts: Part[] = [...slab(S, 20, 96, 189, 199, 5, 1), ...slab(S, 27, 89, 176, 189, 4, 2)];   // 兩層石座
  // 斗篷：從肩膀垂到石座，一條一條的褶子（亮暗交錯），下襬一高一低
  const topX = [38, 45, 52, 60, 68, 75, 82], hemX = [24, 35, 47, 60, 73, 85, 96], tilt = [-.85, .15, -.5, .5, -.1, .8];
  for (let i = 0; i < 6; i++) parts.push(P([[topX[i], 70], [topX[i + 1], 70], [hemX[i + 1], 173 - (i % 2) * 2], [hemX[i], 173 - ((i + 1) % 2) * 2]], norm(tilt[i], .1, .7), 3, .02));
  parts.push(
    ...pair([[44, 134], [59, 134], [59, 173], [45, 173]], norm(-.4, .05, .92), 4),               // 腿（脛甲）
    ...pair([[41, 172], [59, 172], [59, 168], [44, 166]], UPF, 4, .1),                            // 鐵靴的腳背
    ...pair([[39, 112], [60, 112], [60, 138], [37, 135]], norm(-.45, .15, .88), 5),              // 腰下的裙甲
    ...pair([[40, 72], [60, 67], [60, 114], [42, 114], [37, 92]], norm(-.45, 0, .89), 6),        // 胸甲：左亮右暗，中間一道稜
    ...gem(R, 36, 75, 13, 10, 8, 7), ...gem(R, 84, 75, 13, 10, 8, 8),                           // 肩甲
    ...bar(33, 82, 37, 101, 7, 6, 9), ...bar(37, 101, 53, 105, 6, 5, 9),                  // 左手：上臂往下、前臂往內收到劍柄
    ...bar(87, 82, 83, 101, 7, 6, 10), ...bar(83, 101, 67, 105, 6, 5, 10),               // 右手
    ...pair([[56, 112], [60, 112], [60, 176], [58, 170]], norm(-.6, 0, .8), 11, .1),              // 劍身插進石座（兩個斜面）
    ...bar(40, 110, 80, 110, 2.6, 2.6, 12), ...gem(R, 40, 110, 3.2, 3.2, 5, 12), ...gem(R, 80, 110, 3.2, 3.2, 5, 12),   // 護手（兩端圓頭）
    ...bar(60, 108, 60, 94, 2.2, 2.2, 13),                                                        // 劍柄
    ...gem(R, 60, 104, 9, 5.5, 7, 14),                                                            // 疊在劍柄上的兩隻手
    ...gem(R, 60, 92, 3.6, 3.4, 6, 15),                                                           // 劍柄頭
    ...pair([[49, 64], [60, 63], [60, 73], [51, 72]], MID, 16, .05),                              // 護頸
    ...pair([[48, 40], [60, 38], [60, 66], [51, 64], [47, 52]], LIT, 17),                         // 頭盔兩側
    ...pair([[53, 44], [60, 44], [60, 60], [54, 58]], norm(-.3, 0, .95), 18, .15),                // 臉
    ...pair([[52, 57], [60, 57], [60, 75], [56, 70]], norm(-.2, .4, .9), 19, .05),                // 鬍子
    ...pair([[46, 41], [60, 41], [60, 34], [47, 34]], MID, 20, .15),                              // 王冠的環
    ...pair([[46, 34], [60, 34], [60, 19], [57, 30], [53, 23], [50, 31], [46, 25]], UPF, 20, .05),         // 王冠的尖角
  );
  for (const p of parts) p.ramp ||= S;
  return cache.set(key, sculpt(W, MON_H, parts, a => {
    const D = S[0], HI = S[S.length - 1];
    for (let x = 30; x < 92; x += 12) for (let y = 177; y < 189; y++) { a.set(x, y, S[1]); a.set(x - 1, y, HI); }                // 石座的磚縫
    for (let x = 24; x < 98; x += 15) for (let y = 190; y < 199; y++) { a.set(x + 6, y, S[1]); a.set(x + 5, y, HI); }
    for (let y = 70; y < 112; y++) if (a.pid(60, y) >= 0) a.set(60, y, HI);                                                         // 胸甲中間的稜線
    for (let x = 40; x < 81; x++) if (a.pid(x, 113) >= 0) { a.set(x, 113, D); a.set(x, 114, HI); }                                  // 腰帶
    for (let y = 116; y < 168; y++) if (a.pid(60, y) >= 0) a.set(60, y, S[S.length - 2]);                                          // 劍脊
    a.rect(53, 47, 6, 1, S[1]); a.rect(61, 47, 6, 1, S[1]);                                                                        // 眉骨的影子
    a.rect(54, 49, 4, 1, D); a.rect(62, 49, 4, 1, D); for (let y = 48; y < 54; y++) a.set(60, y, HI); a.set(61, 53, S[1]);       // 閉著的眼睛、鼻樑（亮）+ 鼻子的影子
    a.rect(57, 56, 6, 1, S[1]); for (const x of [55, 58, 62, 65]) for (let y = 60; y < 72; y += 2) if (a.pid(x, y) >= 0) a.set(x, y, S[1]);   // 嘴、鬍子的紋路
    for (const x of [49, 55, 65, 71]) a.set(x, 37, D);                                                                               // 王冠上刻的寶石凹槽
    a.set(60, 37, D); a.set(60, 36, D);
    const crack = (x: number, y: number, n: number, c = D) => { for (let i = 0; i < n; i++) { if (a.pid(x, y) < 0) break; a.set(x, y, c); if (c === D && a.pid(x - 1, y) >= 0) a.set(x - 1, y, HI); x += R() < .5 ? 1 : -1; y++; } };
    crack(44, 76, 7); crack(72, 120, 9); crack(36, 150, 8); crack(84, 140, 7); crack(50, 178, 6); crack(66, 44, 5);
    if (r === 3) { crack(70, 124, 12, '#e8743b'); crack(40, 152, 9, '#e8743b'); crack(56, 180, 6, '#e8743b'); a.set(70, 124, '#ffd27a'); }   // 熔岩高地：發光的裂縫
    const top = r === 5 ? ['#ffffff', '#dce8f4'] : r <= 1 || r === 6 || r === 8 ? ['#5a8a46', '#3e7050'] : null;                     // 雪原積雪；平原、森林、沼澤、精靈王國長青苔
    if (top) for (let x = 0; x < W; x++) { if (R() < (r === 5 ? .1 : .5)) continue; let prev = -1;
      for (let y = 0; y < MON_H; y++) { const p = a.pid(x, y); if (p >= 0 && prev < 0 && y > 40) { const d = 1 + (R() * 2 | 0); for (let j = 0; j < d; j++) a.set(x, y + j, top[j ? 1 : 0]); } prev = p; } }
    if (top && r !== 5) for (let k = 0; k < 14; k++) { const x = 24 + (R() * 72 | 0), y = 150 + (R() * 48 | 0); if (a.pid(x, y) >= 0) a.set(x, y, R() < .5 ? top[0] : top[1]); }   // 腳邊的青苔
  })).get(key);
}
