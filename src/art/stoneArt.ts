/* ================= 鑿刻感的石像、石碑 =================
   每個東西都拆成幾個「平的面」，每個面只有一個顏色（頂面最亮、朝左上的亮、朝右下的暗），
   sculpt 會在每個面的左上邊描一條亮線 → 看起來像一刀一刀鑿出來的稜角。最後再加裂縫、青苔。
   （野外的普通石頭還是用 world/tileArt.ts 圓圓的舊畫法） */
import { mulberry32 } from '../core/util';
import { SH, sculpt } from './monsters';

type Pt = [number, number];
const norm = (x: number, y: number, z: number) => { const m = Math.hypot(x, y, z); return [x / m, y / m, z / m]; };
// 多邊形裡面的點都回傳同一個法線 → 平的面（凸、凹都可以）
function poly(pts: Pt[], nrm: number[]) {
  return (x: number, y: number) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c ? nrm : null; };
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

/* ================= 符文石（24×48 美術像素） =================
   一塊直立的板岩：缺角的頂、亮的正面、暗的右側面，腳邊長青苔。正面直直刻三個符文。
   回傳兩張圖：stone = 石頭（符文是刻進去的深色凹槽）；glow = 只有符文本身 + 一圈淡淡的光暈，遊戲裡疊上去、一亮一暗地呼吸 */
// 符文：每個是幾條線段，在 7×7 的格子裡
const GLYPHS: [number, number, number, number][][] = [
  [[3, 0, 3, 6], [3, 1, 6, 3], [3, 3, 6, 5]],             // ᚠ 的樣子
  [[0, 0, 0, 6], [6, 0, 6, 6], [0, 0, 6, 6]],             // 兩直一斜
  [[3, 0, 3, 6], [0, 2, 3, 0], [6, 2, 3, 0], [0, 6, 3, 4], [6, 6, 3, 4]],   // 箭頭 + 底
  [[0, 3, 3, 0], [3, 0, 6, 3], [6, 3, 3, 6], [3, 6, 0, 3]],   // 菱形
  [[3, 0, 3, 6], [0, 3, 6, 3], [1, 1, 5, 5]],             // 十字 + 斜
  [[0, 0, 3, 3], [6, 0, 3, 3], [3, 3, 3, 6]],             // Y 字
  [[0, 6, 3, 0], [3, 0, 6, 6], [1, 4, 5, 4]],             // 人字 + 橫
  [[0, 0, 6, 0], [3, 0, 3, 6], [0, 6, 6, 6]],             // 工字
];
export const RUNE_W = 24, RUNE_H = 48;
export const RUNE_SLATE = ['#101219', '#1b202b', '#29303e', '#3c4556', '#566176'];   // 比一般石頭更深的板岩，符文的光才跳得出來
export function runeStone(seed: number, ramp: string[], glowCol: [string, string]) {
  const R = mulberry32(seed), S = ramp;
  const L0 = 3 + (R() * 2 | 0), L1 = 17 + (R() * 2 | 0), bot = 44, flip = R() < .5;
  const hi = 2 + (R() * 3 | 0), lo = 8 + (R() * 4 | 0), TL = flip ? lo : hi, TR = flip ? hi : lo, mid = 9 + (R() * 4 | 0);   // 斜斜切掉的頂：一邊高一邊低，中間缺一角
  const FRONT = norm(-.3, .15, .94), SIDE = norm(.92, .05, .38), TOP = norm(-.1, -.85, .5);
  const parts: any[] = [
    { sh: poly([[L0 - 1, bot], [L0, TL + 4], [L0 + 1, TL + 1], [mid, (TL + TR) / 2 + 2], [L1 - 1, TR + 1], [L1, bot]], FRONT), ramp: S, grp: 1, bias: .15 },   // 正面（下面寬、上面窄一點）
    { sh: poly([[L1, bot], [L1 - 1, TR + 1], [L1 + 3, TR + 3], [L1 + 4, bot - 2]], SIDE), ramp: S, grp: 1, bias: .05 },                                     // 右側面
    { sh: poly([[L0 + 1, TL + 1], [L0 + 2, TL - 1], [mid, (TL + TR) / 2], [L1, TR - 1], [L1 + 3, TR + 3], [L1 - 1, TR + 2], [mid, (TL + TR) / 2 + 3], [L0 + 1, TL + 3]], TOP), ramp: S, grp: 1, bias: .2 },   // 頂上的切面
  ];
  const carved: [number, number][] = [];                              // 刻痕的每一格（石頭上是凹槽，發光層上是光）
  const stone = sculpt(RUNE_W, RUNE_H, parts, a => {
    const cx = Math.round((L0 + L1) / 2) - 3;
    for (let k = 0; k < 3; k++) { const g = GLYPHS[(R() * GLYPHS.length) | 0], oy = 12 + k * 10;
      for (const [x0, y0, x1, y1] of g) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
        for (let i = 0; i <= n; i++) { const x = Math.round(cx + x0 + (x1 - x0) * i / n), y = Math.round(oy + y0 + (y1 - y0) * i / n);
          if (a.pid(x, y) >= 0 && !carved.some(([p, q]) => p === x && q === y)) carved.push([x, y]); } } }
    for (const [x, y] of carved) { a.set(x, y, S[0]); if (a.pid(x + 1, y + 1) >= 0 && !carved.some(([p, q]) => p === x + 1 && q === y + 1)) a.set(x + 1, y + 1, S[3]); }   // 凹槽右下配一格亮色
    for (let k = 0; k < 2; k++) { let x = L0 + 1 + (R() * 10 | 0), y = 8 + (R() * 30 | 0); for (let i = 0; i < 4; i++) { if (a.pid(x, y) < 0) break; a.set(x, y, S[1]); x += R() < .5 ? 1 : 0; y++; } }   // 細裂縫
    for (let x = 0; x < RUNE_W; x++) { if (a.pid(x, bot - 1) < 0) continue; const h = 2 + (R() * 5 | 0); for (let j = 0; j < h; j++) a.set(x, bot - 1 - j, j === h - 1 ? '#5a9a52' : j % 2 ? '#2e5a34' : '#3e7a40'); }   // 腳邊的青苔
    for (const x of [L0 - 2, L0 + 3, L1 + 2, L1 + 5]) { a.set(x, bot, '#3e7a40'); a.set(x, bot - 1, '#5a9a52'); }   // 幾根草
  });
  const glow = document.createElement('canvas'); glow.width = RUNE_W; glow.height = RUNE_H; const g = glow.getContext('2d');
  g.fillStyle = glowCol[0]; g.globalAlpha = .22;
  for (const [x, y] of carved) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.fillRect(x + dx, y + dy, 1, 1);   // 光暈
  g.globalAlpha = 1; for (const [x, y] of carved) g.fillRect(x, y, 1, 1);
  g.fillStyle = glowCol[1]; for (let i = 0; i < carved.length; i += 3) g.fillRect(carved[i][0], carved[i][1], 1, 1);   // 最亮的芯
  return { stone, glow };
}

/* ================= 地城前院的守門雕像（60×124 美術像素，world/dungeonArt.ts 用） =================
   跟星之神像同一套：三層石座（亮頂面 + 正面 + 暗側面），上面的像也是一塊一塊平的切面。
   garg = 蹲著的石像鬼（洞窟、石窟），hood = 雙手按著劍的兜帽騎士（古墓）。
   眼睛的位置不能動：dungeonArt 會在 (25,44)/(32,44)（石像鬼）、(28,42)/(31,42)（騎士）疊紫光 */
const LIT = norm(-.75, -.15, .65), MID = norm(-.15, .1, .98), DRK = norm(.8, .05, .6), UPF = norm(-.1, -.85, .5);
const STEELR = ['#3a3a4e', '#6a6a80', '#a8a8c0', '#e8e8f8'];
function slab(S: string[], x0: number, x1: number, y0: number, y1: number, d: number, g: number) {
  return [{ sh: poly([[x0, y0], [x0 + d, y0 - d], [x1 + d, y0 - d], [x1, y0]], UPF), ramp: S, grp: g, bias: .1 },
    { sh: poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], MID), ramp: S, grp: g, bias: .1 },
    { sh: poly([[x1, y0], [x1 + d, y0 - d], [x1 + d, y1 - d], [x1, y1]], DRK), ramp: S, grp: g, bias: .3 }];
}
export function guardStatue(kind: 'garg' | 'hood', S: string[]) {
  const R = mulberry32(kind === 'garg' ? 41 : 43), f = (pts: Pt[], n: number[], g: number, bias = .05, ramp = S) => ({ sh: poly(pts, n), ramp, grp: g, bias });
  const parts: any[] = [...slab(S, 5, 52, 112, 123, 3, 1), ...slab(S, 9, 48, 101, 112, 3, 2), ...slab(S, 6, 51, 96, 101, 3, 3)];
  if (kind === 'garg') parts.push(
    f([[21, 60], [5, 28], [2, 44], [12, 56]], LIT, 4), f([[21, 60], [12, 56], [2, 44], [3, 64], [9, 80], [20, 80]], MID, 4),                       // 左翅：上緣亮面 + 翼膜
    f([[37, 60], [53, 28], [56, 44], [46, 56]], norm(.4, -.6, .7), 4), f([[37, 60], [46, 56], [56, 44], [55, 64], [49, 80], [38, 80]], DRK, 4, .3),   // 右翅（背光）
    f([[14, 95], [13, 84], [19, 76], [27, 80], [27, 95]], LIT, 5), f([[44, 95], [45, 84], [39, 76], [31, 80], [31, 95]], DRK, 5, .3),               // 後腿
    f([[22, 58], [29, 56], [29, 92], [23, 90], [19, 74]], norm(-.45, .05, .9), 6), f([[29, 56], [36, 58], [39, 74], [35, 90], [29, 92]], norm(.5, .05, .86), 6, .2),   // 身體：左亮右暗兩個面
    f([[19, 64], [25, 66], [25, 94], [17, 95], [17, 90]], norm(-.7, .1, .7), 7), f([[39, 64], [33, 66], [33, 94], [41, 95], [41, 90]], norm(.7, .1, .7), 7, .25),   // 前腳撐在石座上
    f([[21, 37], [37, 37], [35, 41], [23, 41]], UPF, 8), f([[21, 37], [23, 41], [24, 53], [19, 46]], LIT, 8),                                     // 頭：頂面、左面
    f([[23, 41], [35, 41], [34, 53], [24, 53]], MID, 8, .1), f([[37, 37], [39, 46], [34, 53], [35, 41]], DRK, 8, .3),                            // 正面、右面
    f([[22, 38], [13, 19], [27, 35]], LIT, 9, .1), f([[36, 38], [45, 19], [31, 35]], norm(.5, -.4, .75), 9));                                  // 角
  else {
    const topX = [20, 24, 28, 32, 36, 40], hemX = [12, 19, 26, 33, 40, 47], hemY = [96, 95, 96, 95, 96, 95], tilt = [-.8, .2, -.4, .4, .75];
    for (let i = 0; i < 5; i++) parts.push(f([[topX[i], 56], [topX[i + 1], 56], [hemX[i + 1], hemY[i + 1]], [hemX[i], hemY[i]]], norm(tilt[i], .1, .7), 4));   // 袍子的褶子
    parts.push(f([[17, 57], [30, 48], [30, 61], [19, 61]], LIT, 5), f([[30, 48], [43, 57], [41, 61], [30, 61]], norm(.6, -.2, .75), 5, .15),       // 披肩
      f([[19, 48], [22, 32], [30, 22], [30, 50]], LIT, 6), f([[30, 22], [38, 32], [41, 48], [30, 50]], norm(.6, -.1, .8), 6, .15),                // 兜帽
      f([[22, 58], [38, 58], [38, 61], [22, 61]], UPF, 7, .1, STEELR),                                                                    // 護手
      f([[28, 61], [30, 61], [30, 96], [28, 94]], norm(-.6, 0, .8), 8, .1, STEELR), f([[30, 61], [32, 61], [32, 94], [30, 96]], norm(.6, 0, .8), 8, .2, STEELR),   // 劍身：兩個斜面
      { sh: SH.ell(30, 55, 4, 3), ramp: S, grp: 9, bias: .15 });                                                                         // 按在劍柄上的手
  }
  return sculpt(60, 124, parts, a => {
    const D = S[0], HI = S[S.length - 1];
    if (kind === 'garg') { a.rect(24, 43, 4, 2, '#0a0810'); a.rect(32, 43, 4, 2, '#0a0810'); a.rect(26, 50, 7, 1, '#1a1620'); for (const x of [27, 31]) a.set(x, 51, HI);   // 眼窩、嘴、獠牙
      for (const [x0, y0, x1, y1] of [[20, 60, 6, 34], [20, 60, 3, 52], [38, 60, 52, 34], [38, 60, 55, 52]]) a.line(x0, y0, x1, y1, D);   // 翅膀的骨架
      for (const x of [17, 19, 21, 23, 35, 37, 39, 41]) a.set(x, 95, HI); }                                                             // 爪子
    else { a.ell(30, 42, 6, 7, '#0a0810'); a.ell(30, 43, 4, 5, '#000000'); for (let y = 63; y < 92; y++) a.set(30, y, STEELR[3]); }       // 兜帽裡的黑、劍脊
    for (let x = 18; x < 48; x += 12) for (let y = 102; y < 112; y++) { a.set(x, y, S[1]); a.set(x - 1, y, HI); }                    // 石座的磚縫
    const crack = (x: number, y: number, n: number) => { for (let i = 0; i < n; i++) { if (a.pid(x, y) < 0) break; a.set(x, y, D); a.set(x - 1, y, HI); x += R() < .5 ? 1 : -1; y++; } };
    crack(15, 103, 6); crack(44, 113, 6); crack(26, 70, 6);
    for (let x = 5; x < 56; x++) { if (R() < .45) continue; for (const y0 of [93, 108]) for (let y = y0; y < y0 + 6; y++) if (a.pid(x, y) >= 0) { const d = 1 + (R() * 2.5 | 0); for (let j = 0; j < d; j++) a.set(x, y + j, j ? '#2e4a34' : '#4a7a4e'); break; } }   // 青苔
  });
}
