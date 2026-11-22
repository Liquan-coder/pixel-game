/* ================= 精靈王國的小怪（地區 8，world/elfland.ts） =================
   精靈（人形）：細長的身體、尖耳朵、長頭髮、披風。兩種職業：
     劍舞者 elfBlade（blade）：拿一把細長的彎刀，動作跟骷髏 / 食屍鬼同一套（ready → raise → swing → strike → recoil、被打 hit）
     弓手   elfArcher（ranged）：拿長弓，'squat' 搭箭 → 'puff' 拉滿 → 'spit' 放箭
   另外兩種用現成的身體換色：銀月獵犬（狼）、古樹衛士（樹精，白樺樹皮 + 藍綠色的葉子）。
   地城「螢月禁林」裡的墮落精靈 elfShade 也是這個人形，換成深紫色。圖是第一次用到才畫（lazy）。 */
import { SPR, SH, sculpt, legParts, STEP6, BOB6, withWalk, hdWolf2, hdTreant, makeHD } from './monsters';

type EPal = { R: string[]; A: string[]; skin: string[]; hair: string[]; eye: string; metal: string[] };
const P = (sh, ramp, extra = {}) => ({ sh, ramp, ...extra });
const BLADE_POSES = ['ready', 'raise', 'swing', 'strike', 'recoil', 'hit'], RANGED_POSES = ['squat', 'puff', 'spit'];

/* ph：0~5 走路（blade 6 格；ranged 只用 0~3）、-1 站。role = 'blade' | 'bow' */
function hdElf(C: EPal, role: 'blade' | 'bow', ph: number | string = -1) {
  const pose = typeof ph === 'string' ? ph : '', w = !pose && +ph >= 0 ? +ph : -1, ST = STEP6(2.6, 2.4);
  let LA = [0, 0], LB = [0, 0], bd = [0, 0], hd = [0, 0];
  let hn: [number, number] = [24, 27], hf: [number, number] = [14, 27];               // 近側手（拿武器）、遠側手
  if (w >= 0) { const k = role === 'bow' ? [0, 2, 3, 5][w % 4] : w; LA = ST[k]; LB = ST[(k + 3) % 6]; bd = [0, BOB6[k]]; hn = [24 - LA[0] * .6, 27 + BOB6[k]]; hf = [14 - LB[0] * .6, 27 + BOB6[k]]; }
  if (role === 'blade') {
    if (pose === 'ready') { bd = [-1, 1]; hd = [-1, 1]; hn = [14, 24]; hf = [20, 25]; }
    if (pose === 'raise') { bd = [-1, 0]; hd = [-1, -1]; hn = [19, 4]; hf = [14, 22]; }
    if (pose === 'swing') { bd = [1, 0]; hd = [1, 0]; hn = [30, 12]; hf = [14, 24]; }
    if (pose === 'strike') { bd = [2, 2]; hd = [2, 2]; hn = [32, 27]; hf = [13, 22]; LA = [3, 0]; LB = [-3, 0]; }
    if (pose === 'recoil') { bd = [1, 1]; hd = [1, 1]; hn = [28, 29]; hf = [15, 26]; }
    if (pose === 'hit') { bd = [-1, 0]; hd = [-3, -2]; hn = [12, 16]; hf = [26, 14]; }
  } else {
    hn = [27, 20 + bd[1]]; hf = [19, 21 + bd[1]];                                       // 弓拿在前面
    if (pose === 'squat') { bd = [0, 2]; hd = [0, 2]; hn = [26, 22]; hf = [21, 22]; }
    if (pose === 'puff') { bd = [-1, 0]; hd = [-1, 0]; hn = [29, 17]; hf = [15, 17]; }    // 拉滿：遠側手拉到臉旁邊
    if (pose === 'spit') { bd = [-2, 0]; hd = [-2, 0]; hn = [29, 17]; hf = [12, 19]; }     // 放箭：手往後甩開
  }
  const B = (x: number, y: number): [number, number] => [x + bd[0], y + bd[1]], H = (x: number, y: number): [number, number] => [x + hd[0], y + hd[1]];
  const arm = (sh: [number, number], hand: [number, number], far: boolean) => [...legParts(sh, hand, 6, 6.5, 1, 1.6, 1.3, 1.1, { ramp: C.R, bias: far ? -.7 : 0, grp: far ? 1 : 8 }),
    P(SH.ell(hand[0], hand[1], 1.6, 1.5), C.skin, { bias: far ? -.6 : 0, grp: far ? 1 : 8 })];
  const boot = ['#14101a', '#2a2234', '#463a52', '#64587a'];
  return sculpt(36, 44, [
    P(SH.poly([B(15, 16), B(19, 17), B(21, 34), B(10, 36), B(9, 31)]), C.A, { tex: .15, grp: 0, bias: -.3 }),   // 披風（在身體後面）
    ...arm(B(16, 18), hf, true),
    ...legParts(B(16, 28), [15 + LB[0], 42.5 + LB[1]], 7, 7.5, -1, 1.9, 1.5, 1.4, { ramp: boot, bias: -.6, grp: 2 }),
    P(SH.cap(...B(17, 29), ...B(18, 18), 4, 4.6), C.R, { tex: .15, grp: 3 }),                 // 身體（長衣）
    P(SH.box(...B(17, 30), 5, 3, 2), C.R, { grp: 3 }),
    ...legParts(B(18, 28), [19 + LA[0], 43 + LA[1]], 7, 7.5, -1, 2, 1.6, 1.5, { ramp: boot, grp: 4 }),
    P(SH.poly([H(15, 11), H(9, 7), H(15, 13.5)]), C.skin, { grp: 5 }),                      // 尖耳朵（往後上方）
    P(SH.ell(...H(19, 11), 4.8, 4.8), C.skin, { grp: 5 }),
    P(SH.ell(...H(18.4, 9.6), 5.4, 4.8, (x, y) => y < 9.6 + hd[1] || x < 16.5 + hd[0]), C.hair, { grp: 6 }),   // 頭髮：頭頂 + 後腦
    P(SH.cap(...H(15, 11), ...H(13, 22), 3, 1.6), C.hair, { grp: 6, bias: -.3 }),           // 長髮垂到背後
    ...arm(B(19, 18), hn, false),
  ], a => {
    const h = H; a.rect(...h(21, 11), 1.4, 1.6, C.eye); a.set(...h(21.4, 11), '#ffffff'); a.line(...h(20, 9.6), ...h(22.6, 9.8), C.hair[0]);   // 眼睛、眉毛
    a.set(...h(22.5, 13.6), C.skin[0]);
    a.line(...B(14, 22), ...B(21, 22), C.metal[2]); a.set(...B(18, 22), C.metal[3]);       // 腰帶 + 扣環
    if (role === 'blade') {                                                                 // 細長的彎刀：從手往外，刀身微微彎
      const [x, y] = hn, dir = pose === 'raise' ? [-.1, -1] : pose === 'swing' ? [.8, -.6] : pose === 'strike' ? [1, .35] : pose === 'recoil' ? [.9, .5] : pose === 'ready' ? [-.9, -.3] : pose === 'hit' ? [-.3, -1] : [.55, -.85];
      const L = 13; for (let k = 2; k <= L; k++) { const bend = Math.sin(k / L * Math.PI) * 1.4, px = x + dir[0] * k - dir[1] * bend, py = y + dir[1] * k + dir[0] * bend;
        a.set(px, py, k > L - 2 ? C.metal[3] : C.metal[2]); a.set(px + dir[1] * .9, py - dir[0] * .9, C.metal[1]); }
      a.line(x - dir[1] * 2, y + dir[0] * 2, x + dir[1] * 2, y - dir[0] * 2, '#e0c060');   // 護手
    } else {                                                                                // 長弓：直立的弓 + 弦；拉滿時弦被拉到遠側手
      const [x, y] = hn, top = [x + 1, y - 11], bot = [x + 1, y + 11];
      for (let k = -11; k <= 11; k++) { const bx = x + 2.4 * Math.cos(k / 11 * Math.PI / 2) - .6, by = y + k; a.set(bx, by, Math.abs(k) > 9 ? '#e0c060' : C.metal[1]); a.set(bx + 1, by, Math.abs(k) > 9 ? '#a07a2a' : C.metal[0]); }
      const sx = pose === 'puff' ? hf[0] + 1 : x - 1.5;
      a.line(top[0] - 1, top[1], sx, y, '#e8ecf4'); a.line(sx, y, bot[0] - 1, bot[1], '#e8ecf4');
      if (pose === 'puff' || pose === 'squat') a.line(sx, y, x + 7, y, '#c8a070');          // 搭在弦上的箭
      if (pose === 'puff') a.set(x + 7, y, C.metal[3]);
    }
  }, { l: 6, r: 8, t: 6 });
}

const ELF_SKIN = ['#8a6a6a', '#c8a090', '#ecc8b4', '#fae4d8'], STEEL = ['#3e3b63', '#76739f', '#c8cce0', '#ffffff'];
const BLADE: EPal = { R: ['#0e2a2a', '#1a4442', '#2a6460', '#40867a', '#68b09c'], A: ['#141632', '#22264e', '#32386e', '#464e90'], skin: ELF_SKIN,
  hair: ['#5a6078', '#8a92a8', '#bcc4d4', '#eef2f8'], eye: '#7affd8', metal: STEEL };
const ARCHER: EPal = { R: ['#1a2a14', '#2e4a22', '#466a32', '#62904a', '#8ab868'], A: ['#2a1e10', '#463420', '#64502e', '#84703e'], skin: ELF_SKIN,
  hair: ['#7a5a20', '#b08a34', '#dcbc58', '#fff0a8'], eye: '#9affb0', metal: ['#4a3018', '#8a6038', '#c8cce0', '#ffffff'] };
const SHADE: EPal = { R: ['#140c1e', '#24163a', '#382458', '#503a7a', '#705aa0'], A: ['#0a0812', '#16122a', '#241c40', '#342a58'], skin: ['#4a4058', '#7a6a8e', '#a898b8', '#cabcd8'],
  hair: ['#1a1222', '#2e2240', '#4a3a62', '#6a5888'], eye: '#ff5aa8', metal: ['#2a1e3a', '#5a4a7a', '#b8a8e0', '#ffe0ff'] };
const HOUND = ['#1e2a34', '#3a5060', '#64808e', '#9ab8c0', '#dcf0f0'];
const LEAF_E = ['#12303a', '#1c4a50', '#266462', '#348074', '#5aa890'], BARK_E = ['#3a3e4a', '#6a707e', '#9aa0ae', '#c8ccd6', '#eef0f4'];

/* ---- 精靈王・艾瑟蘭（區域 Boss）：銀色鹿角王冠、白色長髮、銀甲、深藍色的長披風（金邊）、手上一把金色的大弓。面向右 ---- */
function hdElfKing() {
  const CAPE = ['#0a0e24', '#141c40', '#1e2a5e', '#2c3c80', '#3e52a0'], ARM = ['#2e3448', '#565e78', '#8a92ac', '#c4cadc', '#f4f6fc'], SKIN = ELF_SKIN;
  const HAIR = ['#6a7088', '#9aa2b8', '#c8d0e0', '#eef2f8', '#ffffff'], ROBE = ['#0e2a2a', '#18403e', '#245a56', '#347a72', '#4e9a8e'];
  return sculpt(64, 88, [
    P(SH.poly([[24, 28], [34, 28], [40, 86], [8, 87], [12, 60]]), CAPE, { tex: .12, grp: 0, bias: -.25 }),                 // 披風
    P(SH.cap(26, 33, 22, 52, 3, 2.4), ARM, { bias: -.6, grp: 1 }), P(SH.ell(22, 53, 2.4, 2.2), SKIN, { bias: -.5, grp: 1 }),   // 遠側手
    P(SH.poly([[24, 48], [39, 48], [44, 86], [19, 86]]), ROBE, { tex: .12, grp: 2 }),                                       // 長袍下襬
    P(SH.box(31, 40, 8.5, 10, 2.2), ARM, { tex: .1, grp: 3 }),                                                               // 銀色胸甲
    P(SH.ell(25, 31, 5.5, 4), ARM, { grp: 4 }), P(SH.ell(37.5, 31, 5.5, 4), ARM, { grp: 4 }),                                 // 肩甲
    P(SH.poly([[26, 20], [16, 11], [26, 23.5]]), SKIN, { grp: 5 }),                                                          // 尖耳
    P(SH.ell(32, 20, 6.6, 6.8), SKIN, { grp: 5 }),
    P(SH.ell(31, 18, 7.4, 6.6, (x, y) => y < 17.5 || x < 28.5), HAIR, { grp: 6 }),
    P(SH.cap(26, 20, 22, 46, 4.4, 2.2), HAIR, { grp: 6, bias: -.3 }),                                                       // 長髮
    P(SH.cap(38, 33, 45, 44, 3, 2.4), ARM, { grp: 7 }), P(SH.ell(46, 45, 2.6, 2.4), SKIN, { grp: 7 }),                      // 近側手（握弓）
  ], a => {
    for (let x = 24; x <= 39; x++) a.set(x, 12, x % 3 ? '#c8d0e0' : '#9aa2b8');                                              // 王冠的圈
    for (const [x0, y0, x1, y1] of [[27, 12, 21, 3], [24, 7, 18, 6], [22, 5, 22, 0], [36, 12, 43, 2], [40, 7, 47, 5], [42, 4, 41, 0], [31, 12, 31, 6]]) a.line(x0, y0, x1, y1, '#e8eef8');   // 鹿角
    a.ell(31.5, 11, 1.6, 1.6, '#4ac8ff'); a.set(31, 10, '#ffffff');                                                          // 王冠上的寶石
    a.rect(34, 19, 2, 2, '#7affd8'); a.set(35, 19, '#ffffff'); a.line(33, 17.4, 37, 17.8, '#6a7088'); a.set(36.5, 24, SKIN[0]);   // 眼睛、眉毛、嘴
    for (const y of [36, 41, 46]) a.line(26, y, 36, y, '#565e78');                                                           // 胸甲的線
    a.ell(31, 37, 2, 2, '#4ac8ff'); a.set(30.5, 36.5, '#ffffff');
    for (let y = 30; y < 86; y++) { const x = Math.round(24 + (y - 28) / 58 * -14); if (a.get(x + 1, y)) a.set(x + 1, y, '#e0c060'); }   // 披風的金邊
    for (let x = 20; x < 44; x++) if (a.get(x, 85)) a.set(x, 85, '#e0c060');
    for (let k = -24; k <= 24; k++) { const bx = 47 + 4 * Math.cos(k / 24 * Math.PI / 2), by = 45 + k;                       // 金色的大弓（兩端捲起來）+ 弦
      a.set(bx, by, Math.abs(k) > 21 ? '#fff0a8' : '#e0c060'); a.set(bx + 1, by, '#a07a2a'); }
    a.line(47, 21, 47, 69, '#e8ecf4');
    for (const [x, y] of [[51, 30], [52, 45], [51, 60]]) { a.set(x, y, '#7affd8'); }                                        // 弓上的符文
  }, { l: 4, r: 4, t: 4 });
}
/* ---- 月蛾女王（地城「螢月禁林」的 Boss）：四片大翅膀（上面有眼紋）、毛茸茸的白領、羽毛觸角、發光的藍眼睛 ---- */
function hdMothQueen() {
  const WING = ['#3a3048', '#6a5a80', '#a894bc', '#d8cce4', '#f6f0fa'], WINGF = ['#241c32', '#443a58', '#6a5a80', '#8e7ea4'], BODY = ['#2a2418', '#54482e', '#8a7a52', '#c0b080', '#ece0b8'];
  return sculpt(100, 82, [
    P(SH.poly([[56, 36], [78, 4], [96, 12], [92, 32], [62, 42]]), WINGF, { tex: .1, grp: 0 }),                              // 遠側的上翅
    P(SH.poly([[56, 46], [82, 52], [88, 70], [70, 74], [58, 54]]), WINGF, { tex: .1, grp: 0 }),                             // 遠側的下翅
    P(SH.cap(46, 52, 28, 68, 9, 4), BODY, { tex: .2, grp: 1 }),                                                             // 腹部
    P(SH.poly([[50, 38], [22, 2], [4, 12], [8, 34], [44, 48]]), WING, { tex: .08, grp: 2 }),                                // 近側的上翅
    P(SH.poly([[48, 48], [18, 52], [10, 72], [32, 76], [48, 58]]), WING, { tex: .08, grp: 3 }),                             // 近側的下翅
    P(SH.ell(52, 44, 9, 8.5), BODY, { tex: .3, grp: 4 }),                                                                   // 胸
    P(SH.spiky(56, 40, 8, 6, 9, .3), ['#a8a090', '#d8d0c0', '#f4f0e8', '#ffffff'], { grp: 5 }),                              // 毛茸茸的白領
    P(SH.ell(62, 36, 7, 6), BODY, { grp: 6 }),                                                                              // 頭
  ], a => {
    for (const [x, y, r] of [[22, 18, 5], [26, 62, 4]]) { a.ell(x, y, r, r, '#2a2040'); a.ell(x, y, r - 1.5, r - 1.5, '#4ac8ff'); a.ell(x, y, 1.4, 1.4, '#ffffff'); }   // 翅膀上的眼紋
    for (const [x0, y0, x1, y1] of [[48, 40, 14, 8], [48, 42, 8, 26], [47, 50, 16, 66]]) a.line(x0, y0, x1, y1, '#8e7ea4');   // 翅脈
    for (let k = 0; k < 6; k++) a.line(44 - k * 3, 54 + k * 2.2, 50 - k * 3, 55 + k * 2.2, '#54482e');                      // 腹部的條紋
    a.ell(66, 35, 2.6, 2.6, '#0a1a3a'); a.ell(66, 35, 1.8, 1.8, '#4ac8ff'); a.set(66, 34, '#ffffff');                       // 大眼睛
    for (const s of [0, 1]) { const bx = 63 + s * 4; for (let k = 0; k < 14; k++) { const x = bx + k * .9, y = 30 - k * 1.6 + k * k * .04; a.set(x, y, '#e8dcb0'); if (k % 2 === 0) { a.set(x - 1, y - 1, '#c0b080'); a.set(x + 1, y - 1, '#c0b080'); } } }   // 羽毛觸角
  }, { t: 6 });
}

const DEF: Record<string, () => any> = {
  elfking: () => makeHD(hdElfKing()),
  db_mothqueen: () => makeHD(hdMothQueen()),
  elfBlade: () => withWalk(ph => hdElf(BLADE, 'blade', ph), undefined, BLADE_POSES, 6),
  elfArcher: () => withWalk(ph => hdElf(ARCHER, 'bow', ph), undefined, RANGED_POSES),
  elfShade: () => withWalk(ph => hdElf(SHADE, 'blade', ph), undefined, BLADE_POSES, 6),
  elfHound: () => withWalk(ph => hdWolf2(HOUND, { eye: '#7affd8' }, ph), undefined, ['crouch', 'strike', 'land'], 6),
  elfTreant: () => withWalk(ph => hdTreant(ph, LEAF_E, BARK_E, '#7affd8'), undefined, ['ready', 'raise', 'mid', 'strike', 'recoil']),
};
for (const k in DEF) Object.defineProperty(SPR, k, { configurable: true, enumerable: true, get() { const v = DEF[k](); Object.defineProperty(SPR, k, { value: v, writable: true, enumerable: true, configurable: true }); return v; } });
export const ELF_KINDS = Object.keys(DEF);
