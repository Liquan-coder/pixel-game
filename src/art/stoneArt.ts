/* ================= 鑿刻感的石頭 =================
   以前的石頭是幾顆橢圓，光影很平滑 → 看起來像灰色黏土。
   這裡改成「切面」：每顆石頭 = 一個平平的頂面 + 一圈側面，
   每個面只有一個顏色（頂面最亮、朝左上的亮、朝右下的暗），
   sculpt 會在每個面的左上邊描一條亮線 → 看起來像一刀一刀鑿出來的稜角。
   最後再加裂縫、青苔。 */
import { mulberry32 } from '../core/util';
import { SH, sculpt } from './monsters';

type Pt = [number, number];
export const SLATE = ['#1e222e', '#363d4e', '#535d70', '#7a8598', '#a8b2c2'];   // 冷色的板岩灰（平原的石頭、神像）
/* 一顆有切面的石塊：回傳 sculpt 的零件。
   外圈 n 個點 = 石頭的輪廓；內圈 = 往左上縮小的同一圈 = 平平的「頂面」（最亮）；
   內外圈之間每一段 = 一個側面（四邊形），朝哪邊就照哪邊的亮度 → 一圈深淺不同的切面。
   grp：同一顆石頭的面之間不畫黑線；ridges：把頂面的邊收集起來，之後描亮線 */
export function facetBoulder(R: () => number, cx: number, cy: number, rx: number, ry: number, n: number, ramp: string[], grp: number, ridges?: [Pt, Pt][]) {
  const out: Pt[] = [], inn: Pt[] = [], ix = cx - rx * .12, iy = cy - ry * .3, k0 = .42 + R() * .12;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (i + .5) / n * Math.PI * 2 + (R() - .5) * .4, r = .84 + R() * .18;
    let x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    const flat = cy + ry * .5; if (y > flat) y = flat + (y - flat) * .35;                  // 底部壓平：石頭是「坐」在地上的
    out.push([x, y]); const k = k0 * (.85 + R() * .3); inn.push([ix + (x - cx) * k, iy + (y - cy) * k * .8]);
  }
  const parts: any[] = [{ sh: poly(inn, norm(-.15, -.45, .9)), ramp, grp, bias: .3 }];       // 頂面
  if (ridges) for (let i = 0; i < n; i++) ridges.push([inn[i], inn[(i + 1) % n]]);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, mx = (out[i][0] + out[j][0]) / 2 - cx, my = (out[i][1] + out[j][1]) / 2 - cy, m = Math.hypot(mx, my) || 1;
    parts.push({ sh: poly([inn[i], out[i], out[j], inn[j]], norm(mx / m, my / m * .8, .45)), ramp, grp, bias: .3 + (my > 0 ? .32 : 0) + (R() - .5) * .1 }); }   // 正面（朝鏡頭）不要黑成一片，留最深的顏色給外框和裂縫
  return parts;
}
const norm = (x: number, y: number, z: number) => { const m = Math.hypot(x, y, z); return [x / m, y / m, z / m]; };
// 多邊形裡面的點都回傳同一個法線 → 平的面（凸、凹都可以）
function poly(pts: Pt[], nrm: number[]) {
  return (x: number, y: number) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c ? nrm : null; };
}

/* 野外的石頭（40×28 美術像素，跟以前一樣大）：一大一小兩塊，或三塊。moss = [暗, 亮] 青苔；glow = 熔岩區的發光裂縫 */
export function chiselRock(seed: number, Rm: string[], moss: string[] | null, glow: boolean) {
  const R = mulberry32(seed), two = R() < .55, rid: [Pt, Pt][] = [];
  const parts = [...facetBoulder(R, 18, 16, 13, 10, 7 + (R() * 2 | 0), Rm, 1, rid),
    ...facetBoulder(R, 32, 21, 6.5, 5, 5, Rm, 2)];
  if (!two) parts.unshift(...facetBoulder(R, 8, 21, 5.5, 4.5, 5, Rm, 3));
  return sculpt(40, 28, parts, a => {
    // 頂面的邊描亮：上半圈（迎光）用最亮色，下半圈不描（交給側面自己的深淺）
    for (const [p, q] of rid) { if ((p[1] + q[1]) / 2 > 14) continue; const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1])); for (let i = 0; i <= n; i++) a.set(p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n, Rm[4]); }
    // 裂縫：從大石頭的亮面往下折兩折；左邊配一格亮色 → 看起來是「刻進去」的
    const cr = (x: number, y: number, len: number) => { for (let i = 0; i < len; i++) { if (a.pid(x, y) < 0 || a.pid(x, y + 1) < 0) break; a.set(x, y, Rm[0]); if (a.pid(x - 1, y) >= 0) a.set(x - 1, y, Rm[4]); x += R() < .5 ? 1 : 0; y += 1; if (R() < .3) x -= 1; } };
    cr(12 + (R() * 6 | 0), 10 + (R() * 3 | 0), 5 + (R() * 3 | 0)); if (R() < .6) cr(21 + (R() * 4 | 0), 12, 4);
    // 青苔：上緣（上面是空的）往下長 1～3 格，亮暗交錯
    if (moss) for (let x = 0; x < 40; x++) { if (R() < .35) continue;
      for (let y = 0; y < 28; y++) if (a.pid(x, y) >= 0) { if (a.pid(x, y - 1) < 0) { const d = 1 + (R() * 2.4 | 0); for (let j = 0; j < d; j++) a.set(x, y + j, j === 0 ? moss[1] : moss[0]); } break; } }
    if (glow) { a.line(20, 10, 24, 16, '#e8743b'); a.line(24, 16, 22, 22, '#e8743b'); a.set(23, 15, '#ffd27a'); a.set(21, 12, '#ffd27a'); }
  });
}

/* ================= 星之神像（64×150 美術像素） =================
   石座三層（每層：亮的頂面 + 正面 + 暗的右側面）＋ 魔女女神：尖帽往後彎、袍子是一條一條的平面（像刻出來的褶子）、
   右手把星星舉過頭。星星本身、石座上的星形刻紋發光，是遊戲裡每幀另外畫的（world/statues.ts），這裡只刻凹槽 */
export const STATUE_W = 64, STATUE_H = 150;
export const STATUE_ORB: Pt = [47, 20];                                 // 舉起的星星（美術像素）
export const STATUE_SEAL: Pt = [32, 128];                               // 石座正面的星形刻紋中心
export function starStatue() {
  const S = ['#14161f', '#262b38', '#3b4252', '#545e70', '#76819a', '#a3aec0'], R = mulberry32(77);
  const TOP = norm(-.1, -.8, .6), FRONT = norm(-.1, .25, .96), SIDE = norm(.9, .1, .4);
  const tier = (x0: number, x1: number, y0: number, y1: number, d: number, g: number) => [   // 一層石塊：(x0..x1, y0..y1) 是正面，d = 頂面 / 側面的厚度
    { sh: poly([[x0, y0], [x0 + d, y0 - d], [x1 + d, y0 - d], [x1, y0]], TOP), ramp: S, grp: g, bias: .2 },
    { sh: poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], FRONT), ramp: S, grp: g, bias: .1 },
    { sh: poly([[x1, y0], [x1 + d, y0 - d], [x1 + d, y1 - d], [x1, y1]], SIDE), ramp: S, grp: g, bias: .05 }];
  const parts: any[] = [
    ...tier(3, 57, 140, 149, 3, 1), ...tier(9, 52, 121, 137, 3, 2), ...tier(6, 55, 115, 121, 3, 3),
  ];
  // 先畫在後面的：披在背後的長髮（從帽子下面一路垂到腰）
  parts.push({ sh: poly([[22, 44], [42, 44], [47, 76], [40, 80], [32, 76], [24, 80], [17, 76]], norm(.1, .2, .95)), ramp: S, grp: 4, bias: -.05 });
  // 袍子：從肩膀到裙襬 6 條褶子，亮暗交錯（像布折起來的山和谷），裙襬一高一低
  const topX = [21, 24, 28, 32, 36, 40, 43], hemX = [11, 17, 24, 31, 38, 45, 52], hemY = [112, 113, 111, 113, 111, 113, 112], tilt = [-.8, .1, -.45, .35, -.1, .75];
  for (let i = 0; i < 6; i++) parts.push({ sh: poly([[topX[i], 58], [topX[i + 1], 58], [hemX[i + 1], hemY[i + 1]], [hemX[i], hemY[i]]], norm(tilt[i], .1, .7)), ramp: S, grp: 5, bias: .05 });
  parts.push(
    { sh: SH.ell(32, 59, 12, 5), ramp: S, grp: 6, bias: .05 },                                         // 披肩
    { sh: SH.ell(32, 49, 7.5, 7), ramp: S, grp: 7, bias: .05 },                                        // 頭髮（臉的外圈）
    { sh: poly([[28, 47], [36, 47], [37, 52], [34, 56], [30, 56], [27, 52]], norm(-.15, -.1, .98)), ramp: S, grp: 8, bias: .15 },   // 臉：平的一塊，比較亮
    { sh: poly([[20, 59], [27, 59], [33, 70], [31, 76], [22, 77], [18, 70]], norm(-.6, .2, .78)), ramp: S, grp: 9, bias: .1 },      // 左手：寬袖子垂在胸前（亮的一面）
    { sh: poly([[27, 59], [30, 61], [35, 69], [33, 70]], norm(.6, .2, .78)), ramp: S, grp: 9 }, { sh: SH.ell(33, 70, 2.5, 2), ramp: S, grp: 9, bias: .25 },   // 袖子暗面 + 手
    { sh: poly([[39, 58], [46, 56], [52, 47], [46, 42], [42, 50]], norm(.55, -.2, .8)), ramp: S, grp: 10, bias: .05 },              // 右手：寬袖子往上翻
    { sh: SH.cap(48, 45, 47, 29, 2.5, 2.2), ramp: S, grp: 10, bias: .15 }, { sh: SH.ell(47, 26, 3, 3), ramp: S, grp: 10, bias: .25 },   // 舉起的前臂 + 手
    { sh: poly([[15, 44], [49, 44], [47, 39], [17, 39]], TOP), ramp: S, grp: 11, bias: .15 },          // 帽簷
    { sh: poly([[23, 40], [31, 40], [27, 27], [19, 14], [21, 28]], norm(-.6, -.3, .75)), ramp: S, grp: 12, bias: .2 },   // 尖帽（亮的左半）
    { sh: poly([[31, 40], [41, 40], [34, 28], [19, 14], [27, 27]], norm(.55, -.1, .8)), ramp: S, grp: 12, bias: .05 });  // 尖帽（暗的右半），帽尖往左後彎
  return sculpt(STATUE_W, STATUE_H, parts, a => {
    // 石座：磚縫（交錯）、裂縫、星形刻紋的凹槽、角落的青苔
    for (const [y0, y1, x0, x1, off] of [[140, 149, 3, 57, 0], [121, 137, 9, 52, 7]] as const)
      for (let x = x0 + 9 + off; x < x1 - 2; x += 14) for (let y = y0 + 1; y < y1; y++) { a.set(x, y, S[1]); a.set(x - 1, y, S[4]); }
    for (let x = 4; x < 57; x++) a.set(x, 144, S[2]);
    const [sx, sy] = STATUE_SEAL;
    for (let k = -5; k <= 5; k++) { a.set(sx + k, sy, S[0]); a.set(sx, sy + k, S[0]); }
    for (let k = -3; k <= 3; k++) { a.set(sx + k, sy + k, S[1]); a.set(sx + k, sy - k, S[1]); }
    a.set(sx, sy, S[5]);
    const crack = (x: number, y: number, n: number) => { for (let i = 0; i < n; i++) { a.set(x, y, S[0]); a.set(x - 1, y, S[4]); x += R() < .5 ? 1 : -1; y++; } };
    crack(14, 122, 6); crack(47, 141, 5); crack(22, 88, 7); crack(41, 97, 6);
    for (let x = 3; x < 60; x++) { if (R() < .45) continue; const y0 = x < 9 || x > 52 ? 137 : 112; for (let y = y0; y < y0 + 8; y++) if (a.pid(x, y) >= 0) { const d = 1 + (R() * 2.5 | 0); for (let j = 0; j < d; j++) a.set(x, y + j, j ? '#2e4a34' : '#4a7a4e'); break; } }
    for (let k = 0; k < 7; k++) { const x = 3 + (R() * 6 | 0) + (k % 2 ? 48 : 0), y = 140 + (R() * 9 | 0); if (a.pid(x, y) >= 0) a.set(x, y, k % 3 ? '#2e4a34' : '#4a7a4e'); }
    // 袍子的腰帶、袖口；臉：閉著眼睛
    for (let x = 18; x < 47; x++) { const y = 78 + Math.round(Math.sin(x * .3)); if (a.pid(x, y) >= 0) { a.set(x, y, S[1]); a.set(x, y - 1, S[4]); } }
    a.rect(29, 51, 2, 1, S[1]); a.rect(34, 51, 2, 1, S[1]); a.set(32, 53, S[2]);   // 閉著的眼睛、嘴
    for (let x = 22; x < 43; x++) if (a.pid(x, 45) >= 0) a.set(x, 45, S[1]);       // 帽簷下的影子
  });
}
