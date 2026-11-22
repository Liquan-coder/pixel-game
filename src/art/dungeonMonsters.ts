/* ================= 地城專屬的小怪（野外不會出現） =================
   八種身體，每座地城換一套顏色、換一個名字（data/items.ts 的 KIND）：
   蜘蛛 spider（撲咬）、蝙蝠 bat（俯衝）、食屍鬼 ghoul（爪擊）、幽魂 wraith（遠程）、
   螃蟹 crab（雙螯砸地）、甲蟲 beetle（頂角衝撞）、蛙 frog（跳壓）、小惡魔 imp（丟火球）
   動作跟野外的小怪同一套規則：有關節的腳（joint / legParts）、6 格平均步伐（STEP6 / BOB6）、身體少晃、攻擊分好幾格
   （蓄力 → 舉起 → 揮到一半 → 打下去 → 收招），動作的切換在 render/fx.ts 的 enemyJuice / walkFrame。
   圖是第一次用到才畫（lazy），不會拖慢開機。 */
import { SPR, SH, sculpt, legParts, STEP6, BOB6, gait, withWalk, makeHD } from './monsters';

type Pal = { R: string[]; A: string[]; eye: string; belly?: string[] };
const P = (sh, ramp, extra = {}) => ({ sh, ramp, ...extra });
const FIRE = ['#7a1a08', '#e8582a', '#ffb040', '#fff0a0'];

/* ---- 蜘蛛：八隻有關節的腳（四隻遠側暗、四隻近側亮），三角步態（1、3 和 2、4 兩組輪流）
   ph：0~5 走路、-1 站、'crouch' 壓低、'strike' 撲出去（前腳舉高、毒牙張開）、'land' 落地 */
const LUNGE_POSES = ['crouch', 'strike', 'land'];
function hdSpider(C: Pal, ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', w = !pose && +ph >= 0 ? +ph : -1, ST = STEP6(2.6, 2.6);
  let bd = [0, 0], front = [0, 0], fang = false;
  const off = (k: number) => w < 0 ? [0, 0] : ST[(w + (k % 2 ? 3 : 0)) % 6];
  if (w >= 0) bd = [0, BOB6[w]];
  if (pose === 'crouch') { bd = [-1, 2]; front = [-1, 1]; }
  if (pose === 'strike') { bd = [4, -3]; front = [7, -11]; fang = true; }
  if (pose === 'land') { bd = [2, 1]; front = [3, 0]; }
  const B = (x: number, y: number): [number, number] => [x + bd[0], y + bd[1]];
  const roots = [[24, 16], [27, 16.5], [30, 16.5], [33, 16]], feetN = [[9, 27], [20, 27.5], [37, 27.5], [46, 27]], feetF = [[13, 26], [23, 26.5], [34, 26.5], [43, 26]];
  const leg = (k: number, far: boolean) => { const r = B(roots[k][0] + (far ? 1 : 0), roots[k][1] - (far ? 1 : 0)), f0 = far ? feetF[k] : feetN[k], o = off(k + (far ? 1 : 0)), fr = k === 3 ? front : [0, 0];
    const foot: [number, number] = [f0[0] + o[0] + fr[0] + (pose === 'strike' && k < 2 ? -3 : 0), f0[1] + o[1] + fr[1]];
    return legParts(r, foot, k < 2 ? 10 : 9, k < 2 ? 11 : 10, k < 2 ? 1 : -1, 1.6, 1.2, .8, { ramp: C.R, bias: far ? -.8 : -.1, grp: far ? 1 : 6 }); };
  const parts: any[] = [];
  for (let k = 0; k < 4; k++) parts.push(...leg(k, true));
  parts.push(P(SH.ell(...B(15, 13), 10.5, 8.5), C.R, { tex: .25, grp: 2 }), P(SH.ell(...B(28, 16), 6.5, 5.5), C.R, { tex: .2, grp: 3 }),
    P(SH.ell(...B(36, 17 + (pose === 'crouch' ? 1 : 0)), 4.8, 4.2), C.R, { grp: 4 }));
  for (let k = 0; k < 4; k++) parts.push(...leg(k, false));
  return sculpt(50, 29, parts, a => {
    const [hx, hy] = B(36, 17 + (pose === 'crouch' ? 1 : 0));
    for (const [x, y] of [[2, -2], [3.5, -1], [1, -1], [3, .5]]) { a.set(hx + x, hy + y, C.eye); }
    a.set(hx + 3.5, hy - 2, '#ffffff');
    const fl = fang ? 4 : 2; a.line(hx + 3, hy + 3, hx + 4.5, hy + 3 + fl, C.A[2]); a.line(hx + 1.5, hy + 3.5, hx + 2, hy + 3.5 + fl, C.A[1]);   // 毒牙
    const [ax, ay] = B(15, 13);                                            // 腹部的花紋
    a.ell(ax - 1, ay - 2, 2.5, 1.6, C.A[1]); a.ell(ax - 1, ay + 1.5, 2, 1.3, C.A[1]); a.set(ax - 2, ay - 3, C.A[2]); a.line(ax - 7, ay - 4, ax - 4, ay - 6, C.R[4]);
  }, { l: 2, r: 4, t: 12 });
}

/* ---- 蝙蝠：飛在半空中（圖的下半部是空的 → 影子在地上），走路 = 拍翅膀（6 格）
   'crouch' 翅膀收起來包住身體、'strike' 翅膀往後收、張嘴俯衝、'land' 翅膀張到最開 */
function hdBat(C: Pal, ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', w = !pose && +ph >= 0 ? +ph : -1;
  let tip = [0, 0], span = 1, by = 0, mouth = false;
  if (w >= 0) { tip = [0, [-7, -3, 2, 6, 3, -4][w]]; span = [1, .95, .85, .8, .9, 1][w]; by = [0, -1, -1, 0, 1, 1][w]; }
  if (pose === 'crouch') { tip = [0, 9]; span = .45; by = 2; }
  if (pose === 'strike') { tip = [0, -10]; span = .6; by = 3; mouth = true; }
  if (pose === 'land') { tip = [0, 1]; span = 1.12; by = -1; }
  const cx = 22, cy = 14 + by;
  const wing = (s: number) => { const tx = cx + s * 20 * span, ty = cy - 4 + tip[1];
    return SH.poly([[cx + s * 3, cy - 4], [tx, ty], [cx + s * 17 * span, cy + 3 + tip[1] * .4], [cx + s * 13 * span, cy + 1 + tip[1] * .2], [cx + s * 10 * span, cy + 5 + tip[1] * .3], [cx + s * 6, cy + 2], [cx + s * 3, cy + 5]]); };
  return sculpt(44, 36, [
    P(wing(-1), C.A, { grp: 1, bias: -.2 }), P(wing(1), C.A, { grp: 2, bias: -.2 }),
    P(SH.ell(cx, cy + 1, 5, 6), C.R, { tex: .3, grp: 3 }),
    P(SH.poly([[cx - 4, cy - 5], [cx - 5, cy - 12], [cx - 1, cy - 7]]), C.R, { grp: 4 }), P(SH.poly([[cx + 4, cy - 5], [cx + 5, cy - 12], [cx + 1, cy - 7]]), C.R, { grp: 4 }),
    P(SH.ell(cx, cy - 5, 4.6, 4), C.R, { grp: 4 }),
  ], a => {
    for (const s of [-1, 1]) { a.line(cx + s * 3, cy - 4, cx + s * 20 * span, cy - 4 + tip[1], C.R[1]); a.line(cx + s * 6, cy - 2, cx + s * 13 * span, cy + 1 + tip[1] * .2, C.R[1]); }   // 翅膀的骨
    for (const s of [-1, 1]) { a.set(cx + s * 2, cy - 6, C.eye); a.set(cx + s * 2, cy - 5, C.eye); }
    if (mouth) { a.rect(cx - 1.5, cy - 3, 3, 2, '#2a0a10'); a.set(cx - 1, cy - 1, '#ffffff'); a.set(cx + 1, cy - 1, '#ffffff'); }
    else { a.set(cx - 1, cy - 2, '#ffffff'); a.set(cx + 1, cy - 2, '#ffffff'); }
    a.rect(cx - 2, cy + 7, 1, 2, C.R[1]); a.rect(cx + 1, cy + 7, 1, 2, C.R[1]);
  }, { t: 4 });
}

/* ---- 食屍鬼：駝背、長手、爪子。走路 6 格（膝蓋往前彎），兩手跟腳反方向擺
   'ready' 蹲低、手往後拉 → 'raise' 爪子舉過頭 → 'swing' 揮到一半 → 'strike' 抓到底 → 'recoil' 手垂下來；'hit' 被打到頭往後甩 */
const BLADE_POSES = ['ready', 'raise', 'swing', 'strike', 'recoil', 'hit'];
function hdGhoul(C: Pal, ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', w = !pose && +ph >= 0 ? +ph : -1, ST = STEP6(3, 2.6);
  let LA = [0, 0], LB = [0, 0], bd = [0, 0], hd = [0, 0], hn: [number, number] = [31, 25], hf: [number, number] = [27, 26];   // 近側手、遠側手的位置
  if (w >= 0) { LA = ST[w]; LB = ST[(w + 3) % 6]; bd = [0, BOB6[w]]; hn = [31 - LA[0] * .9, 25 + BOB6[w]]; hf = [27 - LB[0] * .9, 26 + BOB6[w]]; }
  if (pose === 'ready') { bd = [-1, 2]; hd = [-1, 2]; hn = [16, 22]; hf = [20, 24]; }
  if (pose === 'raise') { bd = [-1, 0]; hd = [-1, -1]; hn = [22, -2]; hf = [26, 20]; }
  if (pose === 'swing') { bd = [1, 0]; hd = [1, 0]; hn = [37, 6]; hf = [26, 22]; }
  if (pose === 'strike') { bd = [3, 2]; hd = [3, 3]; hn = [40, 28]; hf = [30, 24]; LA = [3, 0]; LB = [-3, 0]; }
  if (pose === 'recoil') { bd = [1, 1]; hd = [1, 2]; hn = [35, 31]; hf = [28, 27]; }
  if (pose === 'hit') { bd = [-1, 0]; hd = [-4, -3]; hn = [14, 14]; hf = [34, 12]; }
  const B = (x: number, y: number): [number, number] => [x + bd[0], y + bd[1]], H = (x: number, y: number): [number, number] => [x + hd[0], y + hd[1]];
  const arm = (sh: [number, number], hand: [number, number], far: boolean) => [...legParts(sh, hand, 8, 9, 1, 2, 1.6, 1.4, { ramp: C.R, bias: far ? -.7 : 0, grp: far ? 1 : 7, tex: .2 }),
    P(SH.ell(hand[0], hand[1], 2.2, 2), C.R, { bias: far ? -.7 : 0, grp: far ? 1 : 7 })];
  return sculpt(40, 40, [
    ...arm(B(22, 15), hf, true),
    ...legParts(B(17, 27), [16 + LB[0], 39 + LB[1]], 7, 6.5, -1, 2.4, 1.8, 1.5, { ramp: C.R, bias: -.7, grp: 2 }),
    P(SH.cap(...B(17, 26), ...B(23, 15), 5.5, 6.5), C.R, { tex: .3, grp: 3 }),
    P(SH.box(...B(17, 28), 6, 3.5, 2), C.A, { tex: .3, grp: 3 }),                 // 破布
    ...legParts(B(18, 27), [19 + LA[0], 39.5 + LA[1]], 7, 6.5, -1, 2.6, 2, 1.6, { ramp: C.R, grp: 4 }),
    P(SH.ell(...H(28, 14), 5.2, 4.6), C.R, { tex: .2, grp: 5 }),
    P(SH.cap(...H(29, 17), ...H(33, 18), 2.6, 1.8), C.R, { grp: 5 }),          // 下巴
    ...arm(B(24, 16), hn, false),
  ], a => {
    const h = H; a.rect(...h(30, 12.5), 2, 1.4, C.eye); a.set(...h(31.5, 12.5), '#ffffff'); a.line(...h(28.5, 11.2), ...h(32, 11.6), C.R[0]);
    a.line(...h(30, 16.8), ...h(33.5, 17.2), '#1a0a0a'); for (const t of [30.5, 32]) a.set(...h(t, 17.6), '#f4eee0');
    for (const [hx, hy] of [hn]) for (const k of [-1, 0, 1]) a.line(hx + 1, hy + k, hx + 3.5, hy + k * 1.6 + 1, C.A[2] || '#e8e0d0');   // 爪子
    for (let i = 0; i < 3; i++) a.set(...B(17 + i * 2, 21 + i), C.R[1]);                       // 肋骨
  }, { l: 6, r: 6, t: 6 });
}

/* ---- 幽魂：飄在半空中的斗篷，沒有腳。走路 = 下襬左右飄
   'squat' 縮起來、雙手合在胸前 → 'puff' 升高、雙手張開、眼睛亮起來 → 'spit' 往前一推射出魂彈 */
const RANGED_POSES = ['squat', 'puff', 'spit'];
function hdWraith(C: Pal, ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', w = !pose && +ph >= 0 ? +ph : -1;
  let sw = w >= 0 ? [-1.5, 0, 1.5, 0][w] : 0, dy = w >= 0 ? [0, -1, 0, 1][w] : 0, hl: [number, number] = [8, 24], hr: [number, number] = [28, 25], lean = 0;
  if (pose === 'squat') { dy = 3; hl = [15, 22]; hr = [21, 22]; }
  if (pose === 'puff') { dy = -3; hl = [2, 12]; hr = [34, 12]; }
  if (pose === 'spit') { dy = 0; hl = [27, 18]; hr = [33, 19]; lean = 2; }
  const Y = (v: number) => v + dy, X = (v: number, k = 0) => v + lean * k;
  const tail = [[X(9), Y(16)], [X(27), Y(16)], [30 + sw, Y(32)], [25 + sw * 1.4, Y(29)], [19 + sw * 1.8, Y(35)], [13 + sw * 1.4, Y(29)], [6 + sw, Y(33)]];
  return sculpt(36, 42, [
    P(SH.poly(tail), C.R, { tex: .2, grp: 1, bias: -.1 }),
    P(SH.ell(X(18, 1), Y(11), 8.5, 8.5), C.R, { tex: .15, grp: 2 }),
    P(SH.ell(hl[0], Y(hl[1] - dy), 2.4, 2.2), C.A, { grp: 3 }), P(SH.ell(hr[0], Y(hr[1] - dy), 2.4, 2.2), C.A, { grp: 3 }),
  ], a => {
    a.ell(X(19.5, 1), Y(12.5), 4.6, 5, '#06040a');                                           // 兜帽裡面是黑的
    const eb = pose === 'puff' ? '#ffffff' : C.eye; for (const ex of [17.5, 21.5]) { a.rect(X(ex, 1), Y(11.5), 1.6, 1.6, eb); }
    for (let k = 0; k < 4; k++) a.line(X(11 + k * 4), Y(17), 9 + k * 5 + sw, Y(30), C.R[1]);   // 斗篷的皺褶
    if (pose === 'puff' || pose === 'spit') for (const [x, y] of [hl, hr]) { a.set(x, Y(y - dy) - 3, C.eye); a.set(x + 1, Y(y - dy) - 2, '#ffffff'); }
  }, { l: 4, r: 4, t: 4 });
}

/* ---- 螃蟹：大殼、眼柄、兩隻大螯、六隻有關節的腳（左右各三）。走路 4 格（兩組腳輪流抬）
   'ready' 螯收低 → 'raise' 舉過頭 → 'mid' 往下 → 'strike' 砸到地上 → 'recoil' 慢慢收回來 */
const HEAVY_POSES = ['ready', 'raise', 'mid', 'strike', 'recoil'];
function hdCrab(C: Pal, ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', [[ax, ay], [bx, by]] = gait(pose ? -1 : +ph, 1.5, 2.4);
  let cl: [number, number] = [8, 16], cr: [number, number] = [46, 16], dy = 0;
  if (pose === 'ready') { cl = [12, 21]; cr = [42, 21]; dy = 1; }
  if (pose === 'raise') { cl = [10, -4]; cr = [44, -4]; dy = -1; }
  if (pose === 'mid') { cl = [13, 6]; cr = [41, 6]; }
  if (pose === 'strike') { cl = [9, 28]; cr = [45, 28]; dy = 2; }
  if (pose === 'recoil') { cl = [9, 23]; cr = [45, 23]; dy = 1; }
  const S = (y: number) => y + dy;
  const legs = (far: boolean) => { const out: any[] = []; for (let k = 0; k < 3; k++) for (const s of [-1, 1]) { const g = (k + (s > 0 ? 1 : 0)) % 2 ? [bx, by] : [ax, ay];
    const root: [number, number] = [27 + s * (6 + k * 2.5), S(20 + (far ? -1 : 0))], foot: [number, number] = [27 + s * (14 + k * 4.5) + g[0] * s, 31.5 + g[1] - (far ? 1 : 0)];
    out.push(...legParts(root, foot, 7, 7.5, s < 0 ? 1 : -1, 1.6, 1.2, .9, { ramp: C.R, bias: far ? -.8 : -.1, grp: far ? 1 : 5 })); } return out; };
  const claw = (sx: number, c: [number, number], s: number) => [...legParts([sx, S(18)], c, 7, 6, s < 0 ? 1 : -1, 2, 1.8, 1.8, { ramp: C.R, grp: 6 }),
    P(SH.ell(c[0], c[1], 4.6, 3.8), C.A, { grp: 6, tex: .15 }), P(SH.ell(c[0] + s * 2.5, c[1] - 3, 2.6, 2), C.A, { grp: 6 })];
  return sculpt(54, 33, [
    ...legs(true),
    P(SH.cap(23, S(12), 22, S(5), 1.2, 1), C.R, { grp: 2 }), P(SH.cap(31, S(12), 32, S(5), 1.2, 1), C.R, { grp: 2 }),
    P(SH.ell(22, S(4.5), 2, 2), C.R, { grp: 2 }), P(SH.ell(32, S(4.5), 2, 2), C.R, { grp: 2 }),
    P(SH.ell(27, S(17), 15, 8, (x, y) => y < S(22)), C.R, { tex: .25, grp: 3 }),
    ...legs(false),
    ...claw(15, cl, -1), ...claw(39, cr, 1),
  ], a => {
    for (const ex of [22, 32]) { a.set(ex, S(4), C.eye); a.set(ex, S(5), '#1a1010'); }
    for (const [x, y] of [[20, 13], [27, 11], [34, 13], [24, 16], [31, 16]]) a.ell(x, S(y), 1.4, 1, C.A[2]);   // 殼上的斑點
    a.line(18, S(21), 36, S(21), C.R[1]); for (const x of [24, 27, 30]) a.set(x, S(22), '#1a1010');            // 嘴
  }, { l: 4, r: 4, t: 8 });
}

/* ---- 甲蟲：圓殼 + 頭上的角，六隻有關節的短腳（三角步態，6 格）
   'crouch' 頭壓低、角朝前 → 'strike' 往前衝撞（角伸直、腳往後蹬）→ 'land' 撞完晃一下 */
function hdBeetle(C: Pal, ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', w = !pose && +ph >= 0 ? +ph : -1, ST = STEP6(2, 2);
  let bd = [0, 0], hd = [0, 0], horn: [number, number] = [45, 6];
  if (w >= 0) bd = [0, BOB6[w]];
  if (pose === 'crouch') { bd = [-1, 1]; hd = [0, 3]; horn = [47, 13]; }
  if (pose === 'strike') { bd = [3, 0]; hd = [4, 3]; horn = [53, 16]; }
  if (pose === 'land') { bd = [1, 1]; hd = [1, 1]; horn = [46, 9]; }
  const B = (x: number, y: number): [number, number] => [x + bd[0], y + bd[1]], H = (x: number, y: number): [number, number] => [x + hd[0] + bd[0], y + hd[1] + bd[1]];
  const leg = (k: number, far: boolean) => { const o = w < 0 ? (pose === 'strike' ? [-3, 0] : [0, 0]) : ST[(w + ((k + (far ? 1 : 0)) % 2 ? 3 : 0)) % 6];
    const r = B(14 + k * 6 + (far ? 1 : 0), 19 - (far ? 1 : 0)), f: [number, number] = [9 + k * 10 + o[0] + (far ? 2 : 0), 27.5 + o[1] - (far ? 1 : 0)];
    return legParts(r, f, 5.5, 6, k === 0 ? 1 : -1, 1.4, 1.1, .8, { ramp: C.R, bias: far ? -.8 : -.1, grp: far ? 1 : 5 }); };
  return sculpt(50, 29, [
    ...leg(0, true), ...leg(1, true), ...leg(2, true),
    P(SH.ell(...H(34, 17), 5.5, 4.6), C.R, { grp: 2 }),
    P(SH.cap(...H(37, 14), horn[0] + bd[0], horn[1] + bd[1], 2.2, .9), C.A, { grp: 2 }),
    P(SH.ell(...B(20, 15), 13.5, 9, (x, y) => y < 20.5 + bd[1]), C.R, { tex: .15, grp: 3, bias: .05 }),
    ...leg(0, false), ...leg(1, false), ...leg(2, false),
  ], a => {
    const [cx, cy] = B(20, 15); a.line(cx + 1, cy - 9, cx - 1, cy + 5, C.R[0]);              // 殼的中線
    a.ell(cx - 5, cy - 4, 3, 1.4, C.R[4]); a.set(cx - 7, cy - 3, '#ffffff');                // 殼的反光
    for (const [x, y] of [[cx + 5, cy - 3], [cx + 7, cy + 1], [cx - 4, cy + 2]]) a.ell(x, y, 1.2, 1, C.A[1]);
    const [hx, hy] = H(36, 16); a.set(hx, hy, C.eye); a.set(hx + 1, hy, C.eye);
  }, { l: 2, r: 6, t: 8 });
}

/* ---- 蛙：一張圖（跳的動作用史萊姆的壓扁 / 拉長） ---- */
function hdFrog(C: Pal) {
  const BL = C.belly || C.R.slice(2);
  return sculpt(40, 30, [
    P(SH.ell(7, 24, 5, 4), C.R, { grp: 1, bias: -.3 }), P(SH.ell(33, 24, 5, 4), C.R, { grp: 1, bias: -.3 }),
    P(SH.ell(20, 19, 14, 9.5, (x, y) => y < 28.5), C.R, { tex: .2, grp: 2 }),
    P(SH.ell(20, 23, 9, 4.5, (x, y) => y < 28.5), BL, { grp: 2, rim: false }),
    P(SH.ell(13, 11, 4.2, 4), C.R, { grp: 3 }), P(SH.ell(27, 11, 4.2, 4), C.R, { grp: 3 }),
    P(SH.ell(12, 27, 3, 1.6), C.R, { grp: 4 }), P(SH.ell(28, 27, 3, 1.6), C.R, { grp: 4 }),
  ], a => {
    for (const ex of [13, 27]) { a.ell(ex, 10.5, 2.4, 2.4, C.eye); a.rect(ex - .5, 9.5, 1, 2.5, '#0a0a0a'); a.set(ex - 1.5, 9, '#ffffff'); }
    a.line(10, 19, 30, 19, C.R[0]); a.set(9, 18, C.R[0]); a.set(31, 18, C.R[0]);
    for (const [x, y] of [[8, 15], [31, 14], [16, 14], [25, 16], [6, 20]]) a.ell(x, y, 1.3, 1, C.A[1]);
  });
}

/* ---- 小惡魔：大頭、角、小翅膀、尾巴，短腳（4 格）
   'squat' 蹲低 → 'puff' 一隻手舉高、手上聚一顆火球 → 'spit' 丟出去 */
function hdImp(C: Pal, ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', w = !pose && +ph >= 0 ? +ph : -1, [[ax, ay], [bx, by]] = gait(w, 1.6, 2);
  let dy = w >= 0 ? [0, -1, 0, -1][w] : 0, hand: [number, number] = [24, 25], ball = false, wingY = w >= 0 ? [0, -2, 0, -2][w] : 0;
  if (pose === 'squat') { dy = 2; hand = [21, 27]; }
  if (pose === 'puff') { dy = -1; hand = [25, 6]; ball = true; wingY = -3; }
  if (pose === 'spit') { dy = 0; hand = [32, 17]; }
  const Y = (v: number) => v + dy;
  return sculpt(34, 38, [
    P(SH.poly([[13, Y(20)], [2, Y(10 + wingY)], [5, Y(18 + wingY)], [3, Y(22 + wingY)], [12, Y(24)]]), C.A, { grp: 1 }),
    P(SH.cap(12, Y(28), 4, Y(32), 1.2, .8), C.R, { grp: 1 }), P(SH.poly([[2, Y(30)], [5, Y(31)], [3, Y(34)]]), C.R, { grp: 1 }),   // 尾巴
    ...legParts([15, Y(28)], [14 + bx, 37 + by], 5, 4.5, -1, 1.8, 1.4, 1.2, { ramp: C.R, bias: -.6, grp: 2 }),
    P(SH.ell(17, Y(24), 5.5, 6), C.R, { tex: .2, grp: 3 }),
    ...legParts([19, Y(28)], [20 + ax, 37.5 + ay], 5, 4.5, -1, 2, 1.5, 1.3, { ramp: C.R, grp: 4 }),
    P(SH.poly([[12, Y(6)], [9, Y(-1)], [15, Y(4)]]), C.A, { grp: 5 }), P(SH.poly([[22, Y(6)], [25, Y(-1)], [19, Y(4)]]), C.A, { grp: 5 }),
    P(SH.ell(17, Y(11), 8, 7), C.R, { tex: .15, grp: 5 }),
    ...legParts([20, Y(20)], hand, 5, 5, -1, 1.8, 1.4, 1.6, { ramp: C.R, grp: 6 }),
    ...(ball ? [P(SH.ell(hand[0] + 1, hand[1] - 4, 4, 4), FIRE, { grp: 7, rim: false })] : []),
  ], a => {
    for (const ex of [18, 22]) { a.rect(ex, Y(10), 2, 2, C.eye); a.set(ex + 1, Y(10), '#ffffff'); }
    a.line(16, Y(15), 23, Y(14.5), '#1a0606'); for (const t of [17, 19, 21]) a.set(t, Y(15.6), '#ffffff');      // 咧嘴笑
    if (ball) { a.set(hand[0] + 1, hand[1] - 5, '#ffffff'); a.set(hand[0], hand[1] - 4, '#fff6d0'); }
  }, { l: 4, r: 4, t: 6 });
}

/* ---------- 各地城的配色 ---------- */
const pal = (R: string[], A: string[], eye: string, belly?: string[]): Pal => ({ R, A, eye, belly });
const LAVA_A = ['#7a1a08', '#e8582a', '#ffc04a'];
const DEF: Record<string, () => any> = {
  // 苔石洞窟
  spiderM: () => withWalk(ph => hdSpider(pal(['#14260f', '#24401a', '#3a5e26', '#5a8236', '#86ac50'], ['#5a3a14', '#8a6a2a', '#c8a050'], '#ff5a3a'), ph), undefined, LUNGE_POSES, 6),
  batC: () => withWalk(ph => hdBat(pal(['#1c1410', '#34261c', '#54402e', '#765a42', '#9a7a5a'], ['#2a1c18', '#4a3028', '#6a4638'], '#ffd04a'), ph), undefined, LUNGE_POSES, 6),
  // 無名古墓
  ghoulB: () => withWalk(ph => hdGhoul(pal(['#1e2420', '#3a443a', '#5e6a5a', '#8a9480', '#b8c0a8'], ['#2a2420', '#4a3e34', '#6a5a48'], '#ff4a4a'), ph), undefined, BLADE_POSES, 6),
  wraithB: () => withWalk(ph => hdWraith(pal(['#1a2030', '#2e3a52', '#4a5a7a', '#7a8aaa', '#b0bcd8'], ['#5a6a8a', '#9aaacc', '#d8e4f8'], '#9ad8ff'), ph), undefined, RANGED_POSES),
  // 潮音石窟
  crabT: () => withWalk(ph => hdCrab(pal(['#0e2a2e', '#1e4a4e', '#2e6a6a', '#4a9090', '#7ac0b8'], ['#6a2a10', '#b05a20', '#e8904a', '#f8c080'], '#ffe38a'), ph), undefined, HEAVY_POSES),
  frogG: () => makeHD(hdFrog(pal(['#0e2a24', '#1e4a3a', '#2e6e52', '#4a9670', '#7ac898'], ['#0e2a24', '#1e4a3a', '#2e6e52'], '#ffd04a', ['#a8c8a0', '#d0e4c0', '#f0f8e8']))),
  // 蛛巢洞窟
  spiderF: () => withWalk(ph => hdSpider(pal(['#140c1c', '#2a1a3a', '#44285a', '#62407e', '#8a64a8'], ['#6a1a2a', '#b03040', '#e86a6a'], '#ff4a6a'), ph), undefined, LUNGE_POSES, 6),
  batF: () => withWalk(ph => hdBat(pal(['#0e1810', '#1a2e1c', '#2a4630', '#40644a', '#5e8a66'], ['#14201a', '#24382a', '#38523e'], '#d8ff7a'), ph), undefined, LUNGE_POSES, 6),
  // 樹根地穴
  ghoulR: () => withWalk(ph => hdGhoul(pal(['#1a1008', '#2e2014', '#4a3622', '#6a5034', '#8a6c4a'], ['#1a3a14', '#2e5a22', '#4a8a34'], '#9aff6a'), ph), undefined, BLADE_POSES, 6),
  wraithR: () => withWalk(ph => hdWraith(pal(['#0e2214', '#1a3e24', '#2e6038', '#4a8a52', '#7ab87a'], ['#4a8a34', '#86c464', '#d0f0a0'], '#c8ff8a'), ph), undefined, RANGED_POSES),
  // 風蝕岩窟
  beetleS: () => withWalk(ph => hdBeetle(pal(['#3a2a14', '#5e4626', '#86683c', '#ac8c58', '#d0b480'], ['#2a1e10', '#4a3620', '#6a5030'], '#ff8a3a'), ph), undefined, LUNGE_POSES, 6),
  batS: () => withWalk(ph => hdBat(pal(['#2a241c', '#46402e', '#665c46', '#8a7e62', '#b0a284'], ['#3a2e20', '#5a4a34', '#7a6648'], '#ffd04a'), ph), undefined, LUNGE_POSES, 6),
  // 沙埋神殿
  ghoulS: () => withWalk(ph => hdGhoul(pal(['#3a2a18', '#5e4a30', '#86704e', '#ae9a74', '#d6c6a0'], ['#2a2014', '#4a3a24', '#6a5636'], '#ffb03a'), ph), undefined, BLADE_POSES, 6),
  wraithS: () => withWalk(ph => hdWraith(pal(['#3a2a0e', '#6a4e1a', '#9a7a2a', '#c8a84a', '#f0d888'], ['#a07a2a', '#e0c060', '#fff0a8'], '#fff0a0'), ph), undefined, RANGED_POSES),
  // 熔岩隧道
  spiderL: () => withWalk(ph => hdSpider(pal(['#140a0a', '#2a1414', '#401e1e', '#5a2a28', '#7a3a36'], LAVA_A, '#ffd04a'), ph), undefined, LUNGE_POSES, 6),
  impL: () => withWalk(ph => hdImp(pal(['#3a0a0a', '#6a1414', '#a02420', '#d04030', '#f07a50'], ['#2a1414', '#4a2020', '#6a3030'], '#ffe38a'), ph), undefined, RANGED_POSES),
  // 黑曜石窟
  crabL: () => withWalk(ph => hdCrab(pal(['#0e0a10', '#1e1820', '#302830', '#463c46', '#62566a'], ['#7a1a08', '#c8401e', '#f07a32', '#ffc04a'], '#ffb040'), ph), undefined, HEAVY_POSES),
  beetleL: () => withWalk(ph => hdBeetle(pal(['#120c0e', '#241a1e', '#3a2a2e', '#544046', '#705a60'], LAVA_A, '#ffb040'), ph), undefined, LUNGE_POSES, 6),
  // 冰晶洞窟
  spiderI: () => withWalk(ph => hdSpider(pal(['#1a2a44', '#2e4a6e', '#4a70a0', '#7aa4cc', '#b8dcf4'], ['#a8dcff', '#dcf0ff', '#ffffff'], '#2a6aff'), ph), undefined, LUNGE_POSES, 6),
  batI: () => withWalk(ph => hdBat(pal(['#3a4a64', '#5e7090', '#8a9cbc', '#b8c8e0', '#e8f0fa'], ['#4a5a78', '#6a7c9c', '#9aaccc'], '#4ac8ff'), ph), undefined, LUNGE_POSES, 6),
  // 霜墓
  ghoulI: () => withWalk(ph => hdGhoul(pal(['#2a3448', '#46546e', '#6a7c98', '#98aac4', '#c8d8ec'], ['#1e2838', '#344460', '#4e6488'], '#7af0ff'), ph), undefined, BLADE_POSES, 6),
  wraithI: () => withWalk(ph => hdWraith(pal(['#4a5a74', '#7a8aa8', '#a8b8d0', '#d0dcec', '#f4f8ff'], ['#a8dcff', '#dcf0ff', '#ffffff'], '#4ac8ff'), ph), undefined, RANGED_POSES),
  // 腐根洞窟
  frogP: () => makeHD(hdFrog(pal(['#1a0e24', '#2e1a40', '#4a2a62', '#6a4488', '#9068b0'], ['#2a3a14', '#4a6a2e', '#7a9a4a'], '#9aff6a', ['#8a9a5a', '#b0c070', '#d8e8a0']))),
  beetleP: () => withWalk(ph => hdBeetle(pal(['#0e140a', '#1a2614', '#2a3c20', '#3e5630', '#567444'], ['#3a1a4a', '#6a3a8a', '#a070c8'], '#9aff6a'), ph), undefined, LUNGE_POSES, 6),
  // 沉沒石窟
  crabP: () => withWalk(ph => hdCrab(pal(['#141a0a', '#262e14', '#3a4620', '#526030', '#6e7c44'], ['#2a3a1a', '#4a6a2e', '#7a9a4a', '#a8c870'], '#d8ff7a'), ph), undefined, HEAVY_POSES),
  wraithP: () => withWalk(ph => hdWraith(pal(['#0a1c1c', '#143434', '#22544e', '#3a7868', '#6aa890'], ['#22544e', '#4fd0c0', '#d8fff8'], '#8cffe0'), ph), undefined, RANGED_POSES),
  // 王城地下墓所
  ghoulK: () => withWalk(ph => hdGhoul(pal(['#1a1a24', '#32323e', '#4e4e5e', '#706e84', '#9a98ae'], ['#5a3a10', '#a0782a', '#e0c060'], '#ff5a5a'), ph), undefined, BLADE_POSES, 6),
  wraithK: () => withWalk(ph => hdWraith(pal(['#1a0e2a', '#30204a', '#4a3470', '#6a5096', '#9a80c4'], ['#a0782a', '#e0c060', '#fff0a8'], '#e0c8ff'), ph), undefined, RANGED_POSES),
  batK: () => withWalk(ph => hdBat(pal(['#100c14', '#201a28', '#342a40', '#4a3e58', '#665a76'], ['#1a141e', '#2e2436', '#443850'], '#ff4a6a'), ph), undefined, LUNGE_POSES, 6),
  // 熔爐地底遺跡
  impF: () => withWalk(ph => hdImp(pal(['#3a1a06', '#6a320e', '#a05418', '#d07a28', '#f0a850'], ['#2a1a0e', '#4a3018', '#6a4a28'], '#fff4c0'), ph), undefined, RANGED_POSES),
  beetleF: () => withWalk(ph => hdBeetle(pal(['#2a1a0a', '#4a3014', '#704a20', '#9a6c32', '#c8964a'], ['#3a2a14', '#6a5028', '#a07c40'], '#7affd8'), ph), undefined, LUNGE_POSES, 6),
  spiderB: () => withWalk(ph => hdSpider(pal(['#1e1a14', '#3a3226', '#5a4e3a', '#7e7054', '#a89870'], LAVA_A, '#ffb040'), ph), undefined, LUNGE_POSES, 6),
  // 沉沒神殿地底
  frogT: () => makeHD(hdFrog(pal(['#0a1e20', '#143a3a', '#22584e', '#3a7e68', '#62a888'], ['#7a5a1a', '#c0a040', '#f0e090'], '#ffd04a', ['#a08a3a', '#d0b858', '#f0e090']))),
  wraithT: () => withWalk(ph => hdWraith(pal(['#0a0e2a', '#141c4a', '#22306e', '#3a4a96', '#6070c0'], ['#6a4ad0', '#b49cff', '#ffffff'], '#c8a8ff'), ph), undefined, RANGED_POSES),
  ghoulT: () => withWalk(ph => hdGhoul(pal(['#0e1a14', '#1a3024', '#2a4a38', '#406a50', '#5e8a6a'], ['#142028', '#22384a', '#365470'], '#7affd8'), ph), undefined, BLADE_POSES, 6),
  // 螢月禁林（精靈王國的地城）：螢火之靈 + 月蛾（墮落的精靈在 art/elfMonsters.ts）
  wraithE: () => withWalk(ph => hdWraith(pal(['#14281a', '#24442c', '#3a6a40', '#5a9a5a', '#9ad08a'], ['#c8f0a0', '#f0ffc8', '#ffffff'], '#f8ff9a'), ph), undefined, RANGED_POSES),
  mothE: () => withWalk(ph => hdBat(pal(['#3a3424', '#6a5e40', '#a89670', '#d8caa0', '#f8f0d8'], ['#4a3a6a', '#7a64a8', '#b4a0e0'], '#9ad8ff'), ph), undefined, LUNGE_POSES, 6),
};
/* 第一次用到才畫：SPR.spiderM 被讀的那一刻才 sculpt，之後就是一般的屬性 */
for (const k in DEF) Object.defineProperty(SPR, k, { configurable: true, enumerable: true, get() { const v = DEF[k](); Object.defineProperty(SPR, k, { value: v, writable: true, enumerable: true, configurable: true }); return v; } });
export const DUNGEON_KINDS = Object.keys(DEF);
