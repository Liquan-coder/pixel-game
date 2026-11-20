/* ================= 野外地形：一塊一塊「看得懂」的地形，不是到處亂撒的障礙 =================
   v9 的原則（跟 docs 的筆記一樣）：
   - 擋路的東西一定是成片、有形狀的：森林是一整片（中間有小路）、斷崖是一條線（有缺口 / 坡道）、
     河有橋或淺灘、遺跡有牆。空曠的原野就真的是空曠的。
   - 擋路的 = 高、有影子（樹、岩壁、石柱、牆）；走得過去的 = 平的（地面、路、石板、橋）。不放模稜兩可的小石頭。
   - 探索靠「引導」不是迷宮：路會岔到每個地點，地點有光 / 煙 / 霧，岩洞前面有小路。
   genWorld（gen.ts）會依序呼叫：formations() → vegetation() → （地標、道路、城鎮…）→ connectPockets() */
import { CLIFF, GROUND, LAVA, MH, MW, ROCK, SUBS, TREE, WALKABLE, WATER, hgt, map, reg } from './map';
import { I, inb, river } from './gen';

type Noise = (x: number, y: number) => number;

/* ---- 小工具 ---- */
/* 雜訊扭曲的橢圓：邊緣自然，但整塊連在一起（不會碎成一顆一顆）。only = 只蓋哪些格子 */
function blob(cx: number, cy: number, rx: number, ry: number, tile: number, n: Noise, jag = .25, only: (i: number) => boolean = i => map[i] === GROUND) {
  for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
    if (!inb(x, y)) continue; const i = I(x, y), e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (e < 1 + (n(x * 1.7, y * 1.7) - .5) * jag * 2 && only(i)) map[i] = tile; }
}
/* 一條有厚度的線（斷崖、山脊）：w = 半寬，邊緣用雜訊稍微起伏 */
function ridge(pts: number[][], w: number, tile: number, n: Noise, only: (i: number) => boolean = i => map[i] === GROUND) {
  for (let s = 0; s < pts.length - 1; s++) { const [x0, y0] = pts[s], [x1, y1] = pts[s + 1], L = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d <= L; d += .5) { const t = d / L, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, ww = w + (n(x * 2.3, y * 2.3) - .5) * 1.6;
      for (let dy = -Math.ceil(ww); dy <= ww; dy++) for (let dx = -Math.ceil(ww); dx <= ww; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy);
        if (inb(X, Y) && dx * dx + dy * dy <= ww * ww + .3 && only(I(X, Y))) map[I(X, Y)] = tile; } } }
}
/* 一堆大石頭（只放在斷崖腳下）：從中心往外長，石頭彼此相連 → 是「一片落石」，不是單顆的小障礙 */
function boulders(cx: number, cy: number, r: number, n: number, R: () => number) {
  let x = cx, y = cy;
  for (let k = 0; k < n * 3 && n > 0; k++) { const i = I(x, y); if (inb(x, y) && map[i] === GROUND && Math.hypot(x - cx, y - cy) <= r) { map[i] = ROCK; n--; }
    x += Math.floor(R() * 3) - 1; y += Math.floor(R() * 3) - 1; if (Math.hypot(x - cx, y - cy) > r) { x = cx; y = cy; } }
}
/* 細胞自動機：讓一片東西的邊緣變圓、把小洞補起來、把單獨一格的拿掉 */
function smooth(tile: number, inRegion: (r: number) => boolean, passes = 2, die = 3, born = 5) {
  for (let p = 0; p < passes; p++) { const prev = map.slice();
    for (let y = 4; y < MH - 4; y++) for (let x = 4; x < MW - 4; x++) { const i = I(x, y), t = prev[i]; if ((t !== tile && t !== GROUND) || !inRegion(reg[i])) continue;
      let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && prev[I(x + dx, y + dy)] === tile) c++;
      if (t === tile && c < die) map[i] = GROUND; else if (t === GROUND && c >= born) map[i] = tile; } }
}

/* ================= 1. 地形骨架：斷崖、台地、山脈、湖、熔岩湖、水道 ================= */
export function formations(R: () => number, n: Noise) {
  const only = (r: number) => (i: number) => map[i] === GROUND && reg[i] === r;
  /* ---- 翠風平原：大致上是開闊的草原。落石坡是一道斷崖（苔石洞窟在崖壁上），另外兩座圓圓的小丘 ---- */
  ridge([[34, 450], [48, 455], [62, 457], [76, 455], [88, 449]], 2.4, CLIFF, n, only(0));        // 落石坡
  boulders(46, 462, 3, 6, R); boulders(84, 456, 3, 5, R);
  blob(150, 508, 7, 4.5, CLIFF, n, .2, only(0)); boulders(144, 515, 2, 3, R);                      // 南邊的小丘
  blob(28, 492, 6, 4, CLIFF, n, .2, only(0));
  /* ---- 骸骨荒地：開闊的沙地 + 幾座有清楚邊緣的紅岩台地 + 一條峽谷（北上的路從中間穿過） ---- */
  blob(30, 138, 13, 8, CLIFF, n, .18, only(2)); boulders(46, 150, 3, 5, R);                        // 風蝕台地（風蝕岩窟在南面）
  blob(172, 168, 11, 6.5, CLIFF, n, .18, only(2)); boulders(184, 178, 3, 4, R);                     // 紅岩石台
  blob(150, 214, 9, 5, CLIFF, n, .2, only(2));
  blob(36, 250, 10, 6, CLIFF, n, .2, only(2)); boulders(48, 258, 3, 4, R);
  ridge([[58, 276], [64, 254], [70, 232], [80, 212]], 2.2, CLIFF, n, only(2));                    // 峽谷西壁
  ridge([[86, 282], [90, 262]], 2.2, CLIFF, n, only(2)); ridge([[94, 240], [102, 214]], 2.2, CLIFF, n, only(2));   // 峽谷東壁（中間的缺口通往巨獸骸骨）
  blob(178, 22, 12, 6, CLIFF, n, .2, only(2));
  /* ---- 熔岩高地：黑岩山脊 + 幾座大熔岩湖（熔岩河另外畫） ---- */
  ridge([[214, 36], [228, 37], [244, 34], [258, 28]], 2.6, CLIFF, n, only(3));                    // 北邊的黑岩壁（熔岩隧道在這裡）
  ridge([[256, 66], [266, 80], [276, 100]], 2.2, CLIFF, n, only(3));
  ridge([[398, 92], [408, 94], [420, 90]], 2.2, CLIFF, n, only(3));                               // 黑曜石窟的岩壁
  blob(288, 30, 11, 6, LAVA, n, .25, only(3));
  blob(410, 196, 7, 4, LAVA, n, .25, only(3));
  blob(262, 186, 6, 4, LAVA, n, .25, only(3));
  blob(352, 192, 5, 3.5, CLIFF, n, .2, only(3));
  blob(362, 28, 8, 4, LAVA, n, .25, only(3)); blob(284, 140, 6, 4, LAVA, n, .25, only(3)); blob(332, 140, 5, 3.5, LAVA, n, .25, only(3));
  ridge([[278, 202], [292, 194], [304, 190]], 2, CLIFF, n, only(3));                               // 南邊的岩壁（北上的路從中間切過去 = 坡道）
  ridge([[382, 44], [396, 48], [410, 56]], 2.4, CLIFF, n, only(3));                                // 熔岩裂谷北岸
  /* ---- 霜寒雪原：北邊和東邊是連綿的雪山，中間是開闊的雪原 ---- */
  ridge([[434, 22], [452, 30], [470, 34], [490, 28], [512, 18], [540, 14]], 4, CLIFF, n, only(5));   // 北邊的雪山（霜墓在山腳）
  blob(626, 104, 9, 12, CLIFF, n, .2, only(5));                                                   // 東邊的雪山（冰晶洞窟在山腳）
  blob(626, 180, 8, 10, CLIFF, n, .2, only(5));
  blob(520, 174, 6, 4, CLIFF, n, .2, only(5)); boulders(512, 180, 3, 4, R);
  /* ---- 幽影沼澤：幾條水道 + 幾個大水塘（不是到處都有的小水窪） ---- */
  river([[404, 262], [424, 280], [430, 300], [418, 330]], 1, WATER, i => reg[i] === 6);
  river([[480, 400], [500, 420], [520, 418], [546, 430]], 1, WATER, i => reg[i] === 6);
  blob(498, 350, 9, 5.5, WATER, n, .3, only(6));
  blob(562, 384, 7, 4.5, WATER, n, .3, only(6));
  blob(470, 424, 8, 5, WATER, n, .3, only(6));
  blob(542, 262, 6, 4, WATER, n, .3, only(6));
  blob(620, 420, 6, 4, WATER, n, .3, only(6));
  for (let y = 4; y < MH - 4; y++) for (let x = 4; x < MW - 4; x++) { const i = I(x, y);         // 再加幾片大的淺水區（低頻雜訊 → 一大片一大片的）
    if (map[i] === GROUND && reg[i] === 6 && n(x * .45 + 900, y * .45 + 300) > .69) map[i] = WATER; }
  smooth(WATER, r => r === 6, 2, 3, 5);
}

/* ================= 2. 山和林：大片的「山」（中間岩峰、外圈林坡），山和山之間是空地 =================
   v10：以前整片都是樹 → 像一道道綠色的牆。現在比較大的一片，中心是岩山（tileArt 會依高度畫出一層一層到山頂），
   外面一圈樹當山腳；小片的就是普通樹林。總面積比 v9 少。 */
export function vegetation(R: () => number, n: Noise, nBig: Noise) {
  /* 雜訊大於 th = 林子；大於 th + CORE = 山的岩峰（荒地、熔岩沒有自然林，它們的台地在 formations 裡） */
  const nearSub = (x: number, y: number) => SUBS.some(S => Math.hypot(S.x - x, S.y - y) < S.r + 5);   // 有名字的地點（地標）旁邊不長岩山，地標才走得進去
  const MASS = { 1: .55, 6: .64, 5: .76, 0: .78 } as Record<number, number>, CORE = { 1: .22, 6: .2, 5: .13, 0: .12 } as Record<number, number>;
  for (let y = 4; y < MH - 4; y++) for (let x = 4; x < MW - 4; x++) { const i = I(x, y); if (map[i] !== GROUND) continue; const r = reg[i];
    const th = MASS[r]; if (th === undefined) continue;
    const v = nBig(x * .55 + r * 97, y * .55);
    if (v > th + CORE[r] && !nearSub(x, y)) map[i] = CLIFF; else if (v > th && R() < .92) map[i] = TREE;
  }
  /* 指定位置的山（平原、雪原）和小樹林（荒地的枯樹林、熔岩的焦木） */
  const M = (cx: number, cy: number, rx: number, ry: number) => { blob(cx, cy, rx * .45, ry * .45, CLIFF, n, .25); blob(cx, cy, rx, ry, TREE, n, .3); };
  const G = (cx: number, cy: number, rx: number, ry: number) => blob(cx, cy, rx, ry, TREE, n, .35);
  M(26, 432, 12, 7); M(158, 424, 14, 6); G(92, 528, 7, 5); M(236, 566, 12, 7); G(40, 578, 8, 4); G(210, 470, 6, 4);   // 平原
  G(140, 232, 5, 3); G(40, 196, 4, 3); G(186, 118, 4, 3);                                         // 荒地
  G(242, 172, 5, 3); G(400, 120, 4, 3);                                                           // 熔岩
  M(470, 182, 13, 9); M(540, 62, 12, 7); G(456, 150, 6, 4); G(600, 200, 7, 5);                    // 雪原的針葉林
  /* 林子和山的邊緣磨圓、小洞補起來、單棵的拿掉 */
  smooth(CLIFF, r => r === 1 || r === 5 || r === 6 || r === 0, 2, 3, 5);
  smooth(TREE, r => r === 1 || r === 5 || r === 6 || r === 2 || r === 3 || r === 0, 3, 3, 5);
}

/* ================= 2b. 零散的障礙：空地上一棵樹、一小叢樹、一堆石頭，讓人有東西可以繞、可以閃 =================
   規則：每個障礙四周 3 格內什麼都沒有 → 障礙之間最窄也有 3 格，不會有卡人的縫。不放在路、營火、城鎮、地城入口旁邊。
   在道路、地標、城鎮都蓋好之後才放（genWorld 呼叫），所以看得到它們、會避開。 */
const PROPS = {                                                       // 每個地區：每 1000 格平地大約幾個、樹 / 石頭的比例
  0: { d: 4.5, tree: .7 }, 1: { d: 4, tree: .85 }, 2: { d: 3.5, tree: .3 }, 3: { d: 3, tree: .2 }, 5: { d: 3.5, tree: .6 }, 6: { d: 3, tree: .75 },
} as Record<number, { d: number; tree: number }>;
export function props(R: () => number, avoid: (x: number, y: number) => boolean) {
  const SHAPES = [[[0, 0]], [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 1], [2, 0]]];
  const clear = (x: number, y: number) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (!inb(x + dx, y + dy) || map[I(x + dx, y + dy)] !== GROUND) return false; } return true; };
  for (const k in PROPS) { const r = +k, P = PROPS[r]; let area = 0;
    for (let i = 0; i < MW * MH; i++) if (reg[i] === r && map[i] === GROUND) area++;
    let want = Math.round(area / 1000 * P.d), tries = 0;
    while (want > 0 && tries++ < 40000) { const x = 4 + Math.floor(R() * (MW - 8)), y = 4 + Math.floor(R() * (MH - 8));
      if (reg[I(x, y)] !== r || avoid(x, y)) continue;
      const sh = SHAPES[Math.floor(R() * SHAPES.length)];
      if (!sh.every(([dx, dy]) => clear(x + dx, y + dy))) continue;
      const tile = R() < P.tree ? TREE : ROCK;
      for (const [dx, dy] of sh) map[I(x + dx, y + dy)] = tile; want--; }
  }
}

/* ================= 2c. 填掉窄縫：兩個障礙中間只剩 1～2 格寬、或三面被包住的凹槽 → 填滿 =================
   玩家最討厭的是「看起來過得去、走進去卡住」。只動平地（不動路、地標裡面），只看天然障礙（樹、石、崖、水、熔岩）。 */
const NAT = (t: number) => t === TREE || t === ROCK || t === CLIFF || t === WATER || t === LAVA;
export function unpinch(keep: (x: number, y: number) => boolean) {
  const blk = (x: number, y: number) => NAT(map[I(x, y)]);
  const fill = (x: number, y: number) => { const i = I(x, y);              // 用旁邊最多的障礙種類填
    const c: Record<number, number> = {}; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = map[I(x + dx, y + dy)]; if (NAT(t)) c[t] = (c[t] || 0) + 1; }
    let best = TREE, bn = -1; for (const t in c) if (c[t] > bn || (c[t] === bn && +t === CLIFF)) { bn = c[t]; best = +t; } map[i] = best; };
  const ok = (x: number, y: number) => { if (map[I(x, y)] !== GROUND || keep(x, y)) return false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const t = map[I(x + dx, y + dy)]; if (!(t === GROUND || NAT(t))) return false; } return true; };
  for (let pass = 0; pass < 4; pass++) { let changed = 0;
    for (let y = 6; y < MH - 6; y++) for (let x = 6; x < MW - 6; x++) { if (!ok(x, y)) continue;
      const L = blk(x - 1, y), Rr = blk(x + 1, y), U = blk(x, y - 1), D = blk(x, y + 1), n = +L + +Rr + +U + +D;
      if (n >= 3 || (L && Rr) || (U && D)) { fill(x, y); changed++; continue; }                      // 1 格寬的縫 / 三面包住的凹槽
      if (L && !Rr && blk(x + 2, y) && ok(x + 1, y)) { fill(x, y); fill(x + 1, y); changed++; continue; }   // 2 格寬的縫（橫）
      if (U && !D && blk(x, y + 2) && ok(x, y + 1)) { fill(x, y); fill(x, y + 1); changed++; continue; }    // 2 格寬的縫（直）
    }
    if (!changed) break; }
}

/* ================= 2d. 高度：每一格岩壁在山的第幾層（tileArt 依這個畫出一層一層往上疊的山） =================
   hgt = 0：不是岩壁；1 ～ 4：第 0 ～ 3 層（山腳那 3 格是第 0 層，往裡面每 3 格高一層）。
   距離用「近似圓形」的算法（直走 3、斜走 4），層線才會是圓的，不會是菱形；最後再修平滑，不留零碎的一格。 */
export function heights() {
  const N = MW * MH, d = new Uint16Array(N).fill(65535);
  for (let i = 0; i < N; i++) if (map[i] !== CLIFF) d[i] = 0;
  const relax = (i: number, j: number, w: number) => { if (d[j] + w < d[i]) d[i] = d[j] + w; };
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) { const i = I(x, y); if (!d[i]) continue;   // 從左上掃到右下
    relax(i, i - 1, 3); relax(i, i - MW, 3); relax(i, i - MW - 1, 4); relax(i, i - MW + 1, 4); }
  for (let y = MH - 2; y >= 1; y--) for (let x = MW - 2; x >= 1; x--) { const i = I(x, y); if (!d[i]) continue;  // 再從右下掃回左上
    relax(i, i + 1, 3); relax(i, i + MW, 3); relax(i, i + MW + 1, 4); relax(i, i + MW - 1, 4); }
  hgt.fill(0);
  for (let i = 0; i < N; i++) if (map[i] === CLIFF) hgt[i] = 1 + Math.max(0, Math.min(3, Math.floor((Math.min(d[i], 999) - 3) / 9)));
  for (let pass = 0; pass < 2; pass++) { const prev = hgt.slice();               // 修平滑：跟周圍 8 格多數不一樣的，改成多數
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) { const i = I(x, y); if (!prev[i] || prev[i] === 1) continue;
      const c = [0, 0, 0, 0, 0]; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) c[prev[I(x + dx, y + dy)]]++;
      let best = prev[i]; for (let v = 2; v <= 4; v++) if (c[v] >= 5) best = v;
      if (c[best] + (best === prev[i] ? 0 : 0) >= 5 && Math.abs(best - prev[i]) === 1) hgt[i] = best; } }
}

/* ================= 3. 收尾：單獨一格的岩石 / 斷崖拿掉（看起來像雜訊、又會卡人） ================= */
export function despeckle() {
  for (let y = 4; y < MH - 4; y++) for (let x = 4; x < MW - 4; x++) { const i = I(x, y), t = map[i]; if (t !== ROCK && t !== CLIFF) continue;
    let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const u = map[I(x + dx, y + dy)]; if (u === CLIFF || u === ROCK) c++; }
    if (c === 0 || (t === CLIFF && c < 2)) map[i] = GROUND; }
}

/* ================= 4. 林中空地接上小路：被樹林圍起來、走不到的空地，從最近走得到的地方砍一條 3 格寬的小徑進去 =================
   只砍樹和石頭（不會挖穿斷崖、牆、水）。reach = 目前走得到的格子（會一起更新） */
export function connectPockets(reach: Uint8Array, skip: (x: number, y: number) => boolean) {
  const seen = new Uint8Array(MW * MH), D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 4; y < MH - 4; y++) for (let x = 4; x < MW - 4; x++) { const s = I(x, y); if (reach[s] || seen[s] || !WALKABLE(map[s]) || skip(x, y)) continue;
    const comp = [s]; seen[s] = 1;                                         // 這塊空地有多大
    for (let h = 0; h < comp.length; h++) { const j = comp[h], jx = j % MW, jy = (j / MW) | 0;
      for (const [dx, dy] of D4) { const k = I(jx + dx, jy + dy); if (!seen[k] && !reach[k] && WALKABLE(map[k])) { seen[k] = 1; comp.push(k); } } }
    if (comp.length < 24) continue;
    const inComp = new Set(comp), prev = new Map<number, number>(), q = comp.slice(); for (const c of comp) prev.set(c, -1);
    let hit = -1;                                                          // 穿過樹 / 石頭往外找，最多 40 格
    for (let h = 0; h < q.length && hit < 0 && h < 40000; h++) { const j = q[h], jx = j % MW, jy = (j / MW) | 0;
      for (const [dx, dy] of D4) { const k = I(jx + dx, jy + dy); if (prev.has(k) || !inb(jx + dx, jy + dy)) continue;
        if (reach[k]) { prev.set(k, j); hit = k; break; }
        const t = map[k]; if (t !== TREE && t !== ROCK && !WALKABLE(t)) continue; prev.set(k, j); q.push(k); } }
    if (hit < 0) continue;
    for (let k = prev.get(hit); k >= 0 && !inComp.has(k); k = prev.get(k)) {   // 沿路砍出 3 格寬的小徑
      const kx = k % MW, ky = (k / MW) | 0;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) { const m = I(kx + ox, ky + oy); if (map[m] === TREE || map[m] === ROCK) map[m] = GROUND; } }
    for (const c of comp) reach[c] = 1;                                    // 這塊現在也算走得到（跟它相連的小徑之後的 BFS 會補上）
  }
}
