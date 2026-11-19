/* ================= 地城 Boss 的圖 =================
   一隻 Boss 一個 hdXxx()，彼此不共用零件 → 之後拿到參考圖，直接把那一個函式換掉就好。
   SPR 的名字 = 'db_' + world/dungeonBoss.ts 的 DBOSS 編號。第一次用到才畫。 */
import { SPR, SH, sculpt, makeHD } from './monsters';

const P = (sh, ramp, extra = {}) => ({ sh, ramp, ...extra });
const STEEL = ['#1e1e2a', '#3a3a4e', '#5e5e78', '#8a8aa6', '#c4c4dc'], GOLDR = ['#5a3a10', '#a0782a', '#e0c060', '#fff0a8'], BONE = ['#4e483c', '#7a7464', '#a8a290', '#d2ccb8', '#f4f0e0'];
const FIRE = ['#7a1a08', '#c8401e', '#f07a32', '#ffb040', '#fff0a0'];

/* 苔蝸王・綠殼：巨大的螺旋殼長滿青苔，軟軟的身體、兩根眼柄 */
function hdSnail() { const BODY = ['#2a3a1a', '#4a5e2a', '#6e8a3e', '#94b058', '#c0d888'], SHELL = ['#3a2a1a', '#5e4428', '#86643a', '#ac8a54', '#d0b07a'];
  return sculpt(92, 64, [
    P(SH.cap(10, 56, 80, 54, 7, 9), BODY, { tex: .2, grp: 1 }),
    P(SH.cap(70, 50, 82, 28, 6, 5), BODY, { tex: .2, grp: 2 }),
    P(SH.cap(78, 30, 74, 10, 1.6, 1.2), BODY, { grp: 2 }), P(SH.cap(84, 30, 88, 12, 1.6, 1.2), BODY, { grp: 2 }),
    P(SH.ell(74, 9, 3, 3), BODY, { grp: 2 }), P(SH.ell(88, 11, 3, 3), BODY, { grp: 2 }),
    P(SH.ell(38, 32, 28, 26), SHELL, { tex: .3, grp: 3 }),
  ], a => {
    for (let t = 0; t < 22; t += .05) { const r = 24 - t, x = 38 + Math.cos(t * .9) * r, y = 32 + Math.sin(t * .9) * r * .92; if (r > 2) a.set(x, y, SHELL[0]); }   // 螺旋紋
    for (let k = 0; k < 60; k++) { const x = 14 + (k * 37) % 50, y = 8 + (k * 23) % 28; if (a.get(x, y) && a.hash(x, y) < .6) { a.set(x, y, '#5a8a36'); a.set(x + 1, y, '#86ac50'); } }   // 青苔
    a.set(74, 9, '#1a1010'); a.set(88, 11, '#1a1010'); a.line(80, 44, 86, 42, BODY[0]);
    for (let x = 14; x < 78; x += 6) a.set(x, 62, BODY[4]);                // 黏液反光
  }); }

/* 無名守墓人：連帽長袍的高大劍士，左手提燈、右手大劍 */
function hdWarden() { const ROBE = ['#1a1a20', '#2e2e38', '#46465a', '#62627c', '#8a8aa4'];
  return sculpt(72, 92, [
    P(SH.cap(14, 40, 10, 62, 3, 2.6), ROBE, { grp: 1 }),
    P(SH.ell(10, 68, 5, 6), GOLDR, { grp: 1 }),
    P(SH.poly([[24, 30], [48, 30], [56, 90], [16, 90]]), ROBE, { tex: .2, grp: 2 }),
    P(SH.ell(36, 22, 11, 12), ROBE, { grp: 3 }),
    P(SH.cap(48, 36, 56, 52, 3.4, 3), ROBE, { grp: 4 }),
    P(SH.cap(57, 52, 66, 4, 2.4, 1.4), STEEL, { grp: 5 }), P(SH.box(57, 54, 6, 1.6, 2), GOLDR, { grp: 5 }),
  ], a => {
    a.ell(38, 24, 6, 7, '#06040a'); a.rect(35, 22, 2, 2, '#ffd27a'); a.rect(40, 22, 2, 2, '#ffd27a');
    a.ell(10, 68, 2.6, 3.2, '#fff6d0'); a.set(10, 66, '#ffffff');           // 燈火
    for (let y = 36; y < 88; y += 7) a.line(26 + (y - 30) * .1, y, 46 + (y - 30) * .15, y + 1, ROBE[1]);
    a.line(60, 48, 66, 8, STEEL[4]);
  }); }

/* 潮音巨蟹・鳴螯：殼上長滿藤壺，一大一小兩隻螯 */
function hdTideCrab() { const SH1 = ['#0e2a2e', '#1e4a4e', '#2e6a6a', '#4a9090', '#7ac0b8'], CLAW = ['#6a2a10', '#a8481c', '#d8783a', '#f0a868', '#ffd8b0'];
  const legs: any[] = []; for (let k = 0; k < 3; k++) for (const s of [-1, 1]) legs.push(P(SH.cap(48 + s * (12 + k * 6), 44, 48 + s * (26 + k * 8), 50 + k * 2, 2.6, 1.6), SH1, { grp: 1, bias: -.2 }), P(SH.cap(48 + s * (26 + k * 8), 50 + k * 2, 48 + s * (30 + k * 9), 62, 1.6, 1), SH1, { grp: 1, bias: -.2 }));
  return sculpt(96, 64, [
    ...legs,
    P(SH.cap(42, 20, 40, 8, 1.6, 1.4), SH1, { grp: 2 }), P(SH.cap(54, 20, 56, 8, 1.6, 1.4), SH1, { grp: 2 }),
    P(SH.ell(48, 36, 30, 16, (x, y) => y < 47), SH1, { tex: .25, grp: 3 }),
    P(SH.cap(22, 36, 10, 22, 4, 3.4), CLAW, { grp: 4 }), P(SH.ell(9, 16, 10, 8), CLAW, { grp: 4, tex: .15 }), P(SH.ell(16, 6, 5, 4), CLAW, { grp: 4 }),
    P(SH.cap(74, 36, 84, 28, 3, 2.6), CLAW, { grp: 5 }), P(SH.ell(86, 24, 7, 5.5), CLAW, { grp: 5 }), P(SH.ell(90, 17, 3.6, 2.8), CLAW, { grp: 5 }),
  ], a => {
    a.ell(40, 7, 2.2, 2.2, '#ffe38a'); a.ell(56, 7, 2.2, 2.2, '#ffe38a'); a.set(40, 7, '#000'); a.set(56, 7, '#000');
    for (const [x, y] of [[34, 28], [42, 24], [52, 26], [60, 30], [46, 32], [30, 34], [64, 36]]) { a.ell(x, y, 2.2, 1.8, '#d8d0c0'); a.set(x, y, '#5a5048'); }   // 藤壺
    a.line(6, 12, 18, 16, CLAW[0]); a.line(38, 46, 58, 46, SH1[0]);
  }); }

/* 巢母・八目：巨大的蜘蛛，背上紅色沙漏花紋，一排八隻眼睛 */
function hdBrood() { const R = ['#140c1c', '#2a1a3a', '#44285a', '#62407e', '#8a64a8'];
  const leg = (rx, ry, kx, ky, fx, fy, far) => [P(SH.cap(rx, ry, kx, ky, 3, 2.4), R, { grp: far ? 1 : 5, bias: far ? -.7 : 0 }), P(SH.cap(kx, ky, fx, fy, 2.4, 1.2), R, { grp: far ? 1 : 5, bias: far ? -.7 : 0 })];
  const L = (far: boolean) => { const o = far ? 3 : 0; return [...leg(52, 40 - o, 30, 12 - o, 8 + o, 62 - o, far), ...leg(56, 40 - o, 40, 8 - o, 22 + o, 63 - o, far), ...leg(62, 40 - o, 74, 6 - o, 84 - o, 63 - o, far), ...leg(66, 40 - o, 90, 12 - o, 100 - o, 62 - o, far)]; };
  return sculpt(104, 64, [
    ...L(true),
    P(SH.ell(34, 34, 22, 17), R, { tex: .25, grp: 2 }),
    P(SH.ell(62, 40, 12, 10), R, { tex: .2, grp: 3 }),
    P(SH.ell(78, 42, 9, 8), R, { grp: 4 }),
    ...L(false),
  ], a => {
    a.ell(32, 30, 5, 3.4, '#b03040'); a.ell(32, 38, 4, 3, '#b03040'); a.rect(31, 32, 2, 4, '#b03040'); a.set(30, 29, '#e86a6a');   // 沙漏
    for (const [x, y] of [[80, 38], [83, 39], [85, 41], [81, 41], [78, 40], [84, 37], [86, 44], [82, 44]]) { a.set(x, y, '#ff4a6a'); }
    a.set(83, 37, '#ffffff'); a.line(84, 48, 86, 54, '#e8e0d0'); a.line(80, 49, 80, 55, '#d8d0c0');   // 毒牙
  }); }

/* 根縛樹心：一截巨大的老樹墩，中間一顆發光的心，四周伸出根 */
function hdRootHeart() { const BK = ['#1a1008', '#33220f', '#4f3820', '#6e5232', '#8e6e48'], LF = ['#14301a', '#245226', '#367434', '#549a44', '#86c464'];
  const roots: any[] = []; for (const [x0, y0, x1, y1] of [[24, 70, 2, 82], [30, 74, 14, 86], [66, 74, 82, 86], [72, 70, 94, 80], [48, 76, 48, 87]]) roots.push(P(SH.cap(x0, y0, x1, y1, 5, 2), BK, { tex: .3, grp: 1 }));
  return sculpt(96, 88, [
    ...roots,
    P(SH.box(48, 52, 26, 26, 2.4), BK, { tex: .35, grp: 2 }),
    P(SH.ell(30, 24, 16, 12), LF, { tex: .5, grp: 3 }), P(SH.ell(64, 22, 18, 13), LF, { tex: .5, grp: 3 }), P(SH.ell(48, 14, 16, 12), LF, { tex: .5, grp: 3 }),
    P(SH.cap(26, 40, 6, 28, 3.6, 2), BK, { grp: 4 }), P(SH.cap(70, 40, 92, 30, 3.6, 2), BK, { grp: 4 }),
  ], a => {
    a.ell(48, 54, 9, 11, '#0e0806'); a.ell(48, 54, 6, 8, '#3a8a2a'); a.ell(48, 53, 4, 5, '#9aff6a'); a.ell(47, 51, 1.6, 2, '#eaffd0');   // 發光的樹心
    for (const [x, y0] of [[28, 40], [36, 46], [62, 44], [68, 38]]) for (let y = y0; y < y0 + 14; y++) a.set(x + Math.round(Math.sin(y * .8)), y, BK[0]);
    for (const [ex, ey] of [[38, 40], [58, 40]]) { a.ell(ex, ey, 2.4, 1.6, '#0e0806'); a.set(ex, ey, '#c8ff8a'); }
  }); }

/* 風蝕巨蠍：八隻腳、兩隻大螯，尾巴高高拱起，尾針發亮 */
function hdScorpion() { const R = ['#3a2a14', '#5e4626', '#86683c', '#ac8c58', '#d0b480'];
  const parts: any[] = [];
  for (let k = 0; k < 4; k++) { const x = 40 + k * 9; parts.push(P(SH.cap(x, 52, x - 10, 58, 2.2, 1.6), R, { grp: 1, bias: -.6 }), P(SH.cap(x - 10, 58, x - 14, 68, 1.6, 1), R, { grp: 1, bias: -.6 })); }
  const seg = [[24, 46], [16, 36], [12, 24], [16, 13], [26, 7], [36, 8]];
  seg.forEach(([x, y], i) => parts.push(P(SH.ell(x, y, 7 - i * .6, 6 - i * .5), R, { tex: .2, grp: 2 })));
  parts.push(P(SH.poly([[38, 4], [46, 12], [40, 14]]), ['#5a1a08', '#c8401e', '#ffb040'], { grp: 2 }));
  parts.push(P(SH.ell(52, 48, 22, 9), R, { tex: .25, grp: 3 }), P(SH.ell(76, 48, 9, 7), R, { grp: 3 }));
  parts.push(P(SH.cap(80, 46, 92, 36, 3, 2.6), R, { grp: 4 }), P(SH.ell(96, 30, 6, 5), R, { grp: 4 }), P(SH.ell(100, 24, 3, 2.4), R, { grp: 4 }));
  for (let k = 0; k < 4; k++) { const x = 44 + k * 9; parts.push(P(SH.cap(x, 54, x + 8, 60, 2.4, 1.8), R, { grp: 5 }), P(SH.cap(x + 8, 60, x + 10, 69, 1.8, 1.1), R, { grp: 5 })); }
  return sculpt(106, 70, parts, a => {
    for (let x = 34; x < 72; x += 6) a.line(x, 40, x + 1, 56, R[1]);
    a.set(80, 44, '#ff8a3a'); a.set(82, 44, '#ff8a3a'); a.set(81, 43, '#ff8a3a'); a.set(43, 9, '#ffe38a');
  }); }

/* 沙王・未完：全身裹布的王，金冠、權杖、破披風 */
function hdSandKing() { const WRAP = ['#3a2a18', '#5e4a30', '#86704e', '#ae9a74', '#d6c6a0'], CAPE = ['#2a0e14', '#4a1a24', '#6a2a34', '#8a3a44'];
  return sculpt(66, 94, [
    P(SH.poly([[18, 26], [48, 26], [58, 92], [8, 92]]), CAPE, { tex: .2, grp: 1 }),
    P(SH.cap(26, 70, 24, 92, 4, 3.4), WRAP, { grp: 2 }), P(SH.cap(40, 70, 42, 92, 4, 3.4), WRAP, { grp: 2 }),
    P(SH.box(33, 50, 12, 22, 2.2), WRAP, { tex: .3, grp: 3 }),
    P(SH.ell(33, 20, 9, 10), WRAP, { tex: .2, grp: 4 }),
    P(SH.poly([[23, 13], [25, 2], [29, 9], [33, 0], [37, 9], [41, 2], [43, 13]]), GOLDR, { grp: 5 }),
    P(SH.cap(20, 36, 10, 52, 3, 2.6), WRAP, { grp: 6 }),
    P(SH.cap(46, 36, 54, 48, 3, 2.6), WRAP, { grp: 6 }), P(SH.cap(56, 92, 56, 20, 1.6, 1.6), GOLDR, { grp: 6 }), P(SH.ell(56, 18, 4, 4), ['#3a1a6a', '#9a6ae8', '#e8d8ff'], { grp: 6 }),
  ], a => {
    for (let y = 34; y < 92; y += 4) a.line(22, y, 44, y + 2, WRAP[1]);                     // 裹布的一圈一圈
    for (let y = 14; y < 30; y += 3) a.line(25, y, 41, y + 1, WRAP[1]);
    a.rect(28, 19, 3, 2, '#ffb03a'); a.rect(35, 19, 3, 2, '#ffb03a'); a.set(33, 4, '#ff4a4a');
  }); }

/* 熔岩巨蜥・燎：又長又低的蜥蜴，背上一條發光的熔岩紋，尾巴很長 */
function hdSalamander() { const R = ['#1a0a0a', '#3a1410', '#5a2218', '#7e3424', '#a04a34'];
  return sculpt(116, 52, [
    P(SH.cap(8, 30, 40, 34, 2, 7), R, { tex: .2, grp: 1 }),
    P(SH.cap(36, 38, 30, 50, 3.4, 2.6), R, { grp: 1, bias: -.5 }), P(SH.cap(76, 38, 82, 50, 3.4, 2.6), R, { grp: 1, bias: -.5 }),
    P(SH.ell(60, 32, 26, 11), R, { tex: .25, grp: 2 }),
    P(SH.ell(94, 28, 13, 9), R, { tex: .2, grp: 3 }), P(SH.cap(100, 32, 112, 32, 6, 3.6), R, { grp: 3 }),
    P(SH.cap(46, 40, 42, 51, 3.6, 2.8), R, { grp: 4 }), P(SH.cap(70, 40, 76, 51, 3.6, 2.8), R, { grp: 4 }),
  ], a => {
    for (let x = 14; x < 100; x++) { const y = Math.round(24 + Math.sin(x * .07) * 1.5 + (x < 40 ? (40 - x) * .15 : 0) - (x > 80 ? (x - 80) * .1 : 0)); if (a.get(x, y)) { a.set(x, y, FIRE[3]); a.set(x, y + 1, FIRE[2]); } }   // 背上的熔岩紋
    for (const [x, y] of [[50, 36], [62, 38], [72, 35], [56, 30]]) a.ell(x, y, 1.6, 1, FIRE[2]);
    a.rect(98, 24, 3, 2, '#ffe38a'); a.set(100, 24, '#ffffff'); a.line(103, 34, 112, 33, '#1a0606');
  }); }

/* 熔渣蠕蟲：從地底拱出來的巨蟲，一節一節，頭是一圈牙齒的嘴 */
function hdWorm() { const R = ['#1a0e0a', '#3a1e14', '#5a2e20', '#7e4430', '#a05a40'];
  const parts: any[] = [P(SH.ell(36, 86, 30, 8), ['#140c0c', '#24140f', '#3a1e14', '#5a2e20'], { tex: .4, grp: 1 })];
  const pts = [[36, 80], [38, 68], [40, 56], [38, 44], [34, 33], [32, 22]];
  pts.forEach(([x, y], i) => parts.push(P(SH.ell(x, y, 15 - i * .6, 8), R, { tex: .25, grp: 2 + i })));
  parts.push(P(SH.ell(32, 14, 14, 11), R, { grp: 9 }));
  return sculpt(72, 94, parts, a => {
    a.ell(33, 12, 9, 7, '#0e0404'); a.ell(33, 12, 6, 4.5, '#7a1a08'); a.ell(33, 12, 3, 2, '#ffb040');   // 嘴
    for (let k = 0; k < 12; k++) { const t = k / 12 * Math.PI * 2; a.set(33 + Math.cos(t) * 8, 12 + Math.sin(t) * 6, '#f4eee0'); }
    pts.forEach(([x, y]) => { a.line(x - 12, y + 3, x + 12, y + 3, FIRE[2]); a.line(x - 10, y + 4, x + 10, y + 4, FIRE[1]); });   // 節之間的熔岩光
  }); }

/* 冰晶女王・霙：冰晶的長裙、尖刺的冰冠，飄在半空 */
function hdIceQueen() { const ICE = ['#1a2a44', '#2e4a6e', '#4a70a0', '#7aa4cc', '#b8dcf4'], SKIN = ['#6a7c98', '#98aac4', '#c8d8ec', '#eef4fc'];
  return sculpt(66, 98, [
    P(SH.poly([[22, 34], [44, 34], [60, 86], [46, 80], [33, 92], [20, 80], [6, 86]]), ICE, { tex: .2, grp: 1 }),
    P(SH.box(33, 38, 8, 10, 2), ICE, { grp: 2 }),
    P(SH.cap(26, 32, 12, 46, 2, 1.6), SKIN, { grp: 3 }), P(SH.cap(40, 32, 54, 24, 2, 1.6), SKIN, { grp: 3 }),
    P(SH.ell(33, 20, 7.5, 8.5), SKIN, { grp: 4 }),
    P(SH.poly([[24, 14], [22, 0], [28, 8], [33, -2], [38, 8], [44, 0], [42, 14]]), ['#4a70a0', '#a8dcff', '#dcf0ff', '#ffffff'], { grp: 5 }),
  ], a => {
    a.rect(30, 20, 2, 2, '#2a6aff'); a.rect(35, 20, 2, 2, '#2a6aff'); a.line(31, 25, 35, 25, '#7a8aa8');
    for (const [x0, y0, x1, y1] of [[14, 60, 22, 46], [50, 62, 42, 46], [33, 80, 33, 50], [24, 74, 30, 56], [42, 74, 36, 56]]) a.line(x0, y0, x1, y1, '#dcf0ff');   // 冰晶的稜線
    a.ell(55, 22, 3, 3, '#ffffff'); a.set(55, 22, '#a8dcff');
  }, { t: 4 }); }

/* 霜墓騎士：結滿霜的全身鎧甲，手持長戟 */
function hdFrostKnight() { const AR = ['#2a3448', '#46546e', '#6a7c98', '#98aac4', '#c8d8ec'];
  return sculpt(72, 94, [
    P(SH.poly([[18, 30], [46, 30], [52, 80], [12, 80]]), ['#1e2838', '#344460', '#4e6488'], { tex: .2, grp: 1 }),   // 披風
    P(SH.cap(26, 66, 24, 92, 4.6, 4), AR, { grp: 2 }), P(SH.cap(38, 66, 40, 92, 4.6, 4), AR, { grp: 2 }),
    P(SH.box(32, 48, 13, 18, 2.6), AR, { tex: .2, grp: 3 }),
    P(SH.box(32, 20, 8, 10, 2.4), AR, { grp: 4 }), P(SH.poly([[26, 12], [32, 2], [38, 12]]), AR, { grp: 4 }),
    P(SH.cap(46, 36, 56, 50, 3.6, 3), AR, { grp: 5 }),
    P(SH.cap(58, 92, 60, 4, 1.6, 1.6), ['#3a2a1a', '#5e4428', '#86643a'], { grp: 6 }),
    P(SH.poly([[60, 2], [70, 14], [60, 22], [56, 12]]), ['#46546e', '#98aac4', '#dcf0ff', '#ffffff'], { grp: 6 }),
  ], a => {
    a.rect(27, 19, 10, 2, '#06080e'); a.rect(29, 19, 2, 2, '#7af0ff'); a.rect(34, 19, 2, 2, '#7af0ff');   // 頭盔的眼縫
    for (let y = 36; y < 64; y += 6) a.line(20, y, 44, y, AR[1]);
    for (let k = 0; k < 30; k++) { const x = 18 + (k * 13) % 30, y = 12 + (k * 29) % 76; if (a.get(x, y) && a.hash(x, y) < .5) a.set(x, y, '#ffffff'); }   // 霜
  }); }

/* 腐沼蛙王：又大又胖的癩蛤蟆，頭上長著一圈蘑菇冠，嘴巴很寬 */
function hdToad() { const R = ['#1a2410', '#2e3e1a', '#4a6028', '#6a843a', '#90a858'], BL = ['#8a9a5a', '#b0c070', '#d8e8a0'];
  return sculpt(104, 74, [
    P(SH.ell(16, 62, 16, 11), R, { grp: 1, bias: -.3 }), P(SH.ell(88, 62, 16, 11), R, { grp: 1, bias: -.3 }),
    P(SH.ell(52, 46, 42, 27, (x, y) => y < 72), R, { tex: .25, grp: 2 }),
    P(SH.ell(52, 56, 28, 13, (x, y) => y < 72), BL, { grp: 2, rim: false }),
    P(SH.ell(34, 22, 10, 9), R, { grp: 3 }), P(SH.ell(70, 22, 10, 9), R, { grp: 3 }),
    P(SH.ell(30, 70, 9, 4), R, { grp: 4 }), P(SH.ell(74, 70, 9, 4), R, { grp: 4 }),
    P(SH.ell(44, 14, 6, 4, (x, y) => y < 15), ['#2a1040', '#4a2070', '#7a40a8', '#a870d0'], { grp: 5 }), P(SH.ell(58, 13, 7, 4.6, (x, y) => y < 14), ['#2a1040', '#4a2070', '#7a40a8', '#a870d0'], { grp: 5 }),
  ], a => {
    for (const ex of [34, 70]) { a.ell(ex, 21, 5.5, 5.5, '#d8ff7a'); a.rect(ex - 1, 17, 2, 8, '#0a0a0a'); a.set(ex - 3, 18, '#ffffff'); }
    a.line(18, 46, 86, 46, R[0]); a.line(16, 44, 18, 46, R[0]); a.line(88, 44, 86, 46, R[0]); a.line(20, 47, 84, 47, '#5a1a2a');
    for (let k = 0; k < 26; k++) { const x = 16 + (k * 31) % 72, y = 26 + (k * 17) % 30; if (a.get(x, y)) a.ell(x, y, 1.6, 1.2, R[1]); }   // 疙瘩
    for (const [x, y] of [[42, 11], [46, 12], [56, 10], [61, 11]]) a.set(x, y, '#ffffff');
  }); }

/* 深淵水鬼：巨大的溺死鬼魂，身上纏著鎖鏈，手裡握著一顆珍珠 */
function hdDrowned() { const R = ['#0a1c1c', '#143434', '#22544e', '#3a7868', '#6aa890'], CH = ['#2a2a30', '#4a4a56', '#7a7a8a', '#a8a8b8'];
  return sculpt(84, 98, [
    P(SH.poly([[22, 30], [62, 30], [78, 84], [64, 76], [52, 96], [42, 82], [30, 96], [20, 76], [6, 84]]), R, { tex: .25, grp: 1 }),
    P(SH.ell(42, 22, 14, 15), R, { tex: .2, grp: 2 }),
    P(SH.cap(26, 36, 8, 56, 3.4, 2.6), R, { grp: 3 }), P(SH.ell(8, 58, 4, 4), R, { grp: 3 }),
    P(SH.cap(58, 36, 70, 52, 3.4, 2.6), R, { grp: 3 }), P(SH.ell(72, 54, 5, 5), ['#c8c0d0', '#e8e4f0', '#ffffff'], { grp: 4 }),
  ], a => {
    a.ell(42, 24, 9, 10, '#04080a'); a.rect(37, 22, 3, 3, '#8cffe0'); a.rect(45, 22, 3, 3, '#8cffe0'); a.line(38, 30, 46, 30, '#8cffe0');
    for (const [x0, y0, x1, y1] of [[18, 44, 66, 64], [14, 70, 70, 50], [30, 88, 54, 40]]) { const n = Math.hypot(x1 - x0, y1 - y0); for (let t = 0; t < n; t += 3) { const x = x0 + (x1 - x0) * t / n, y = y0 + (y1 - y0) * t / n; a.ell(x, y, 1.6, 1.2, CH[(t / 3 | 0) % 2 ? 2 : 3]); } }   // 鎖鏈
    for (let k = 0; k < 8; k++) a.line(24 + k * 5, 4 + (k % 3) * 2, 22 + k * 5.5, 18, R[3]);   // 濕頭髮
  }); }

/* 近衛隊長・殘燈：羽飾頭盔、紅披風、單手劍 + 腰上一盞快熄的燈 */
function hdCaptain() { const AR = ['#1a1a24', '#32323e', '#4e4e5e', '#706e84', '#9a98ae'], CAPE = ['#3a0a10', '#5a1420', '#7a2030', '#a03040'];
  return sculpt(68, 94, [
    P(SH.poly([[20, 28], [44, 28], [54, 90], [10, 90]]), CAPE, { tex: .2, grp: 1 }),
    P(SH.cap(27, 66, 25, 92, 4.4, 3.8), AR, { grp: 2 }), P(SH.cap(39, 66, 41, 92, 4.4, 3.8), AR, { grp: 2 }),
    P(SH.box(33, 47, 12, 17, 2.6), AR, { tex: .2, grp: 3 }),
    P(SH.box(33, 20, 8, 9, 2.4), AR, { grp: 4 }), P(SH.cap(33, 12, 18, 2, 3, 1.6), ['#5a0a10', '#a01a24', '#e04a50'], { grp: 4 }),
    P(SH.cap(22, 36, 14, 52, 3.4, 3), AR, { grp: 5 }), P(SH.ell(20, 64, 3.6, 4.4), GOLDR, { grp: 5 }),
    P(SH.cap(46, 36, 54, 52, 3.4, 3), AR, { grp: 6 }), P(SH.cap(55, 54, 64, 10, 2, 1.2), STEEL, { grp: 6 }), P(SH.box(55, 55, 5, 1.4, 2), GOLDR, { grp: 6 }),
  ], a => {
    a.rect(28, 19, 10, 2, '#06060a'); a.rect(30, 19, 2, 2, '#ff5a5a'); a.rect(35, 19, 2, 2, '#ff5a5a');
    a.ell(20, 64, 1.6, 2.2, '#fff6d0');
    for (const y of [38, 46, 54]) a.line(23, y, 43, y, GOLDR[1]);
    a.line(58, 48, 63, 14, STEEL[4]);
  }); }

/* 熔爐守護者：鐵砧一樣的身體，肚子是燒紅的爐口，一隻手是巨鎚 */
function hdForgeGuard() { const IR = ['#1a1414', '#2e2626', '#4a3e3c', '#6a5a56', '#8e7c76'];
  return sculpt(98, 96, [
    P(SH.box(34, 86, 9, 8, 2.4), IR, { grp: 1 }), P(SH.box(62, 86, 9, 8, 2.4), IR, { grp: 1 }),
    P(SH.box(48, 54, 30, 26, 2.2), IR, { tex: .3, grp: 2 }),
    P(SH.box(48, 20, 14, 11, 2.4), IR, { tex: .25, grp: 3 }),
    P(SH.cap(18, 38, 10, 66, 6, 5), IR, { grp: 4 }), P(SH.ell(10, 70, 7, 6), IR, { grp: 4 }),
    P(SH.cap(78, 38, 88, 56, 6, 5), IR, { grp: 5 }), P(SH.cap(88, 56, 90, 12, 2.4, 2.4), ['#3a2a1a', '#5e4428', '#86643a'], { grp: 5 }),
    P(SH.box(90, 10, 9, 7, 2), IR, { tex: .2, grp: 5 }),
  ], a => {
    a.rect(34, 50, 28, 18, '#0e0606'); a.rect(36, 52, 24, 14, FIRE[1]); a.rect(38, 54, 20, 10, FIRE[2]); a.rect(41, 57, 14, 5, FIRE[3]); a.rect(44, 58, 8, 3, FIRE[4]);   // 爐口
    for (let x = 36; x < 60; x += 4) a.line(x, 50, x, 67, '#2a1a14');      // 爐柵
    a.rect(40, 18, 16, 3, '#0e0606'); a.rect(42, 18, 4, 3, '#ffb040'); a.rect(50, 18, 4, 3, '#ffb040');
    for (const [x, y] of [[24, 34], [72, 34], [30, 76], [66, 76]]) { a.ell(x, y, 1.6, 1.6, IR[4]); }   // 鉚釘
  }); }

/* 星之看守者：高高的長袍身影，背後一圈星光，臉上蓋著面紗，手持星杖 */
function hdStarWarden() { const ROBE = ['#0a0e2a', '#141c4a', '#22306e', '#3a4a96', '#6070c0'], V = ['#3a1a6a', '#6a4ad0', '#b49cff', '#e8d8ff'];
  return sculpt(76, 108, [
    P(SH.ell(38, 26, 26, 26, (x, y) => Math.hypot(x - 38, y - 26) > 21), V, { grp: 1, rim: false }),      // 背後的光環
    P(SH.poly([[24, 36], [52, 36], [66, 106], [10, 106]]), ROBE, { tex: .2, grp: 2 }),
    P(SH.ell(38, 26, 10, 12), ROBE, { grp: 3 }),
    P(SH.cap(28, 44, 16, 64, 3, 2.6), ROBE, { grp: 4 }),
    P(SH.cap(50, 44, 62, 58, 3, 2.6), ROBE, { grp: 4 }), P(SH.cap(64, 106, 64, 14, 1.6, 1.6), GOLDR, { grp: 4 }),
    P(SH.poly([[64, 2], [67, 9], [74, 10], [68, 14], [70, 21], [64, 17], [58, 21], [60, 14], [54, 10], [61, 9]]), ['#7a4a1a', '#f2c14e', '#fff6d0', '#ffffff'], { grp: 5 }),
  ], a => {
    a.ell(38, 28, 7, 8, '#e8d8ff'); a.ell(38, 30, 6, 6, '#b49cff');        // 面紗
    for (let x = 32; x < 45; x += 2) a.line(x, 24, x, 36, '#9a80c4');
    for (const [x, y] of [[14, 14], [62, 30], [20, 44], [56, 10], [12, 32], [64, 44]]) { a.set(x, y, '#ffffff'); a.set(x + 1, y, '#e8d8ff'); }   // 光環上的星星
    for (const [x, y] of [[22, 70], [30, 86], [46, 80], [54, 96], [38, 64]]) { a.set(x, y, '#e8d8ff'); }   // 袍子上的星點
  }, { t: 2 }); }

const DEF: Record<string, () => HTMLCanvasElement> = { snail: hdSnail, warden: hdWarden, tidecrab: hdTideCrab, broodmother: hdBrood, rootheart: hdRootHeart, scorpion: hdScorpion,
  sandking: hdSandKing, salamander: hdSalamander, magmaworm: hdWorm, icequeen: hdIceQueen, frostknight: hdFrostKnight, toadking: hdToad, drowned: hdDrowned,
  captain: hdCaptain, forgeguard: hdForgeGuard, starwarden: hdStarWarden };
for (const k in DEF) Object.defineProperty(SPR, 'db_' + k, { configurable: true, enumerable: true, get() { const v = makeHD(DEF[k]()); Object.defineProperty(SPR, 'db_' + k, { value: v, writable: true, enumerable: true, configurable: true }); return v; } });
