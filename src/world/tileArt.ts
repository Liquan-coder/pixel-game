import { mulberry32 } from '../core/util';
import { SH, hash2, sculpt } from '../art/monsters';
import { ARENA, BIGT, BRIDGE, CLIFF, CRATE, DOOR, FOG, GRAVE, GROUND, HOUSE, HOUSES, LAVA, MH, MW, PILLAR, RFLOOR, ROAD, ROCK, RWALL, TREE, WALKABLE, WATER, map, reg } from './map';
import { CARPU, CRUSTU, ICEW, LAVU, MUDW, NZ0, NZ1, NZ2, RUIN, RUINU, SCU, TA, UL, WATU, WOODU, groundK, hexU, isLavaish, isRoadish, isWallT, isWaterish, nz, tileAt } from './gen';

export function bakeTileHD(buf, CA, tx, ty, ox, oy) {
  const i = ty * MW + tx, t = map[i], r = reg[i], S = SCU[r], U = RUINU[r];
  const up = tileAt(tx, ty - 1), dn = tileAt(tx, ty + 1), lf = tileAt(tx - 1, ty), rt = tileAt(tx + 1, ty);
  const AX = tx * TA, AY = ty * TA, wallUp = isWallT(up), wallL = isWallT(lf), wallR = isWallT(rt);
  const at = (lx, ly) => (oy + ly) * CA + ox + lx;
  /* 地區交界：靠近邊的地面像素，有機會改用隔壁地區的顏色（越靠邊機會越大）→ 顏色是漸漸混過去的，不是一條直線 */
  const rAt = (x, y) => reg[Math.min(MH - 1, Math.max(0, y)) * MW + Math.min(MW - 1, Math.max(0, x))];
  const rU = rAt(tx, ty - 1), rD = rAt(tx, ty + 1), rL = rAt(tx - 1, ty), rR = rAt(tx + 1, ty), mix = rU !== r || rD !== r || rL !== r || rR !== r;
  const ground = (lx, ly) => { const ax = AX + lx, ay = AY + ly;
    if (mix) { let d = 99, o = r; if (rL !== r && lx < d) { d = lx; o = rL; } if (rR !== r && 47 - lx < d) { d = 47 - lx; o = rR; } if (rU !== r && ly < d) { d = ly; o = rU; } if (rD !== r && 47 - ly < d) { d = 47 - ly; o = rD; }
      if (o !== r && o !== 4 && hash2(ax, ay * 3 + 1) < (24 - d) / 48) { const k2 = groundK(o, ax, ay); return SCU[o].g[k2]; } }
    let k = groundK(r, ax, ay);
    if (wallUp && ly < 15) k -= ly < 5 ? 2 : ly < 10 ? 1 : (hash2(ax, ay) < .5 ? 1 : 0);
    if (wallL && lx < 7) k -= lx < 3 ? 2 : 1; if (wallR && lx > 40) k -= lx > 44 ? 2 : 1;   // 牆腳的影子：一看就知道牆比地面高
    return S.g[k < 0 ? 0 : k]; };
  if (t === CLIFF) {
    if (!isWallT(dn)) {                                                  // 崖壁正面：直條岩紋 + 橫向岩層 + 上緣草皮/岩唇
      for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
        const v = nz(NZ1, ax, ay * .22); let k = 2 + (v > .58 ? 1 : 0) + (v > .7 ? 1 : 0) - (v < .4 ? 1 : 0);
        if ((ay + Math.floor(nz(NZ2, ax * .25, 3) * 7)) % 15 === 0) k = 1;
        if (hash2(ax >> 1, (ay / 7) | 0) < .012) k = 0;
        if (ly >= 40) k -= 1; if (ly >= 45) k -= 1;
        if ((!isWallT(lf) && lx < 2) || (!isWallT(rt) && lx > 45)) k = 0;
        let c = S.face[k < 0 ? 0 : k > 4 ? 4 : k];
        const lh = 3 + Math.floor(nz(NZ2, ax * 2.5, AY) * 6);
        if (ly < lh) c = ly === lh - 1 ? S.lip[0] : (ly === 0 ? S.lip[3] : S.lip[(ax + ly) % 3 === 0 ? 1 : 2]);
        buf[at(lx, ly)] = c; }
    } else {                                                             // 崖頂：一整片大石塊（跟崖壁同色系），外圈亮邊 + 黑框 → 一看就是走不上去的岩石高地
      const eL = !isWallT(lf), eR = !isWallT(rt), eU = !isWallT(up); boulderCells(AX, AY);
      for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
        const b = boulder(ax, ay), s2 = -(b.bx + b.by) / BC;
        let k = 2 + (s2 > .2 ? 1 : 0) + (s2 > .55 ? 1 : 0) - (s2 < -.3 ? 1 : 0);
        if (hash2(ax, ay) < .06) k--;
        let c = S.face[k < 0 ? 0 : k > 4 ? 4 : k];
        if (r === 5 && s2 > -.05 && hash2(b.id, 5) < .85) c = S.lip[s2 > .45 ? 3 : 2];                         // 雪原：石頭上積雪
        else if ((r <= 1 || r === 6) && s2 > .1 && nz(NZ1, ax * .7, ay * .7) > .6) c = S.lip[s2 > .5 ? 3 : 2]; // 平原 / 森林 / 沼澤：石頭上長青苔
        else if (r === 3 && b.gap < 3.2 && b.gap >= 1.6 && hash2(b.id, 3) < .35) c = LAVU[3];                  // 熔岩：石縫透出紅光
        if (b.gap < 1.6) c = S.face[0]; else if (b.gap < 2.8 && b.bx + b.by > 0) c = S.face[1];
        const e = Math.min(eL ? lx : 99, eR ? 47 - lx : 99, eU ? ly : 99);
        if (e < 2) c = DK; else if (e < 4) c = S.face[4];
        buf[at(lx, ly)] = c; }
    }
    return;
  }
  if (t === RWALL) {
    if (!isWallT(dn)) {                                                  // 磚牆：交錯磚塊 + 灰縫 + 頂石 + 青苔垂落
      for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx;
        const row = ly >> 3, off = ((row + tx) & 1) * 8, bx = (lx + off) & 15, by = ly & 7, brick = (tx * 4 + ((lx + off) >> 4)) * 31 + ty * 8 + row;
        let c;
        if (by === 7 || bx === 15) c = U.mo;
        else { const h = hash2(brick, 3); c = h < .3 ? U.wf2 : h < .85 ? U.wf : U.hi; if (by === 0 || bx === 0) c = h < .3 ? U.wf : U.hi; if (by === 6) c = U.wf2;
          if (hash2(ax, AY + ly) < .04) c = U.mo; }
        if (ly < 4) c = ly === 3 ? U.mo : ly === 0 ? U.hi : U.cap;
        if (U.moss && hash2(ax, AY) < .3 && ly >= 3 && ly < 4 + Math.floor(hash2(ax + 7, AY) * 10)) c = (ly + ax) % 3 ? U.moss : RUINU[1].moss;
        if (ly >= 45) c = U.mo;
        if ((!isWallT(lf) && lx < 1) || (!isWallT(rt) && lx > 46)) c = U.mo;
        buf[at(lx, ly)] = c; }
    } else {                                                             // 牆頂：深色大石磚 + 外圈亮邊 + 黑框（以前是一片黑，看起來像洞）
      const eL = !isWallT(lf), eR = !isWallT(rt), eU = !isWallT(up);
      for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
        const row = Math.floor(ay / 12), off = (row & 1) * 8, u = (ax + off) % 16, v = ay % 12, h = hash2(Math.floor((ax + off) / 16), row);
        let c = u === 0 || v === 0 ? U.top : (u === 1 || v === 1) ? U.wf2 : h < .35 ? U.mo : U.edge;
        if (hash2(ax, ay) < .04) c = U.top;
        const e = Math.min(eL ? lx : 99, eR ? 47 - lx : 99, eU ? ly : 99);
        if (e < 2) c = DK; else if (e < 4) c = U.cap;
        buf[at(lx, ly)] = c; }
    }
    return;
  }
  if (t === WATER || (t === BRIDGE && r !== 3)) {                       // 水：橫向波紋、深淺、白色浪花、北岸土坡
    const deep = isWaterish(up) && isWaterish(dn) && isWaterish(lf) && isWaterish(rt);
    for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
      const n = nz(NZ1, ax, ay * 3); let k = 3 + (n > .62 ? 1 : 0) - (n < .36 ? 1 : 0) - (deep ? 1 : 0);
      if (Math.abs(nz(NZ2, ax * .5, ay * 2) - .5) < .025) k = 5;
      let d = 99; if (!isWaterish(lf)) d = Math.min(d, lx); if (!isWaterish(rt)) d = Math.min(d, 47 - lx); if (!isWaterish(dn)) d = Math.min(d, 47 - ly);
      if (d < 2) k = 6; else if (d < 5) k = Math.max(k, 5); else if (d < 10) k = Math.max(k, 4);
      if (d < 1) { buf[at(lx, ly)] = S.bank[0]; continue; }             // 岸邊一圈深色描邊：水和陸地的界線一眼就看得出來
      const WP = r === 5 ? ICEU : r === 6 ? MUDU : WATU;                // 雪原是結冰的湖、沼澤是混濁的泥水
      if (r === 5 && k < 5 && hash2(ax >> 3, ay >> 3) < .05 && Math.abs(((ax + ay * 2) % 13) - 6) < 1) k = 6;   // 冰面裂紋
      let c = WP[k];
      if (!isWaterish(up)) { if (ly < 7) c = S.bank[ly < 2 ? 2 : (hash2(ax, ay >> 2) < .3 ? 0 : 1)]; else if (ly < 9) c = WP[6]; else if (ly < 14) c = WP[Math.max(k, 5)]; }
      buf[at(lx, ly)] = c; }
    if (t === WATER && (r === 6 || r === 1) && hash2(tx, ty) < (r === 6 ? .45 : .2)) lily(buf, CA, ox + 8 + ((hash2(ty, tx) * 26) | 0), oy + 14 + ((hash2(tx + 5, ty) * 22) | 0), hash2(tx, ty + 9));
  } else if (t === LAVA || (t === BRIDGE && r === 3)) {                 // 熔岩：流動紋 + 黑色結痂 + 發光邊
    for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
      const n = .65 * nz(NZ1, ax * .45, ay * 1.1) + .35 * nz(NZ0, ax * 2, ay * 2), m = nz(NZ1, ax * .3 + 70, ay * .3 + 20);
      let k = 3 + (n > .55 ? 1 : 0) + (n > .64 ? 1 : 0) + (n > .74 ? 1 : 0) - (n < .36 ? 1 : 0);
      if (Math.abs(n - .64) < .012) k = 4 + ((ax + ay) & 1);
      let c = LAVU[k];
      if (m > .72) c = m > .745 ? CRUSTU[m > .8 ? 0 : m > .77 ? 1 : 2] : LAVU[6];
      let d = 99; if (!isLavaish(lf)) d = Math.min(d, lx); if (!isLavaish(rt)) d = Math.min(d, 47 - lx); if (!isLavaish(dn)) d = Math.min(d, 47 - ly);
      if (d < 2) c = CRUSTU[1]; else if (d < 4) c = LAVU[6];
      if (!isLavaish(up)) { if (ly < 7) c = S.bank[ly < 2 ? 2 : (hash2(ax, ay >> 2) < .3 ? 0 : 1)]; else if (ly < 9) c = LAVU[7]; else if (ly < 12) c = LAVU[6]; }
      buf[at(lx, ly)] = c; }
  }
  if (t === BRIDGE) {
    const horiz = WALKABLE(lf) && WALKABLE(rt) && lf !== FOG;
    for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
      if (r === 3) { const u = ax % 16, v = ay % 12, s = hash2((ax >> 4) + (((ay / 12) | 0) & 1) * 7, (ay / 12) | 0);
        buf[at(lx, ly)] = (u === 0 || v === 0) ? S.road[0] : v === 1 || u === 1 ? S.road[4] : S.road[s < .4 ? 2 : 3]; continue; }
      const a = horiz ? lx : ly, b = horiz ? ly : lx, pa = horiz ? ax : ay, pb = horiz ? ay : ax;
      const board = Math.floor(a / 12), u = a % 12;
      let k = 3 + (nz(NZ2, pa * 3 + board * 40, pb * .25) > .55 ? 1 : 0) - (hash2(board, horiz ? tx : ty) < .3 ? 1 : 0);
      if (u === 11) k = 0; else if (u === 0) k = 4; else if (u === 10) k = 2;
      if ((u === 3 || u === 8) && (b === 6 || b === 41)) k = 5;
      const e0 = horiz ? up !== BRIDGE : lf !== BRIDGE, e1 = horiz ? dn !== BRIDGE : rt !== BRIDGE;
      if ((e0 && b < 4) || (e1 && b > 43)) k = (b === 0 || b === 47) ? 0 : (b === 1 || b === 46) ? 2 : 1;
      buf[at(lx, ly)] = WOODU[k < 0 ? 0 : k]; }
    return;
  }
  if (t === WATER || t === LAVA) return;
  if (t === RFLOOR || t === PILLAR || t === CRATE || t === FOG) {        // 石板地：交錯石板 + 斜面光影 + 裂痕 + 青苔
    const door = r === 4 && tx >= DOOR[0] && tx <= DOOR[2] && ty > ARENA.y0;
    for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
      if (door) { const ex = (tx === DOOR[0] && lx < 4) || (tx === DOOR[2] && lx > 43);
        buf[at(lx, ly)] = ex ? CARPU[lx === 2 || lx === 45 ? 5 : 4] : CARPU[((ax + ay) % 12 === 0 || (ax - ay) % 12 === 0) ? 3 : (tx === DOOR[1] ? 2 : 1)]; continue; }
      const sr = Math.floor(ay / 24), off = (sr & 1) * 12, sc = Math.floor((ax + off) / 24), u = (ax + off) % 24, v = ay % 24, h = hash2(sc, sr);
      let c = h < .4 ? U.fl2 : U.fl;
      if (u === 0 || v === 0) c = U.gr; else if (u === 1 || v === 1) c = U.hi; else if (u === 23 || v === 23) c = U.mo || U.gr;
      else { const s = hash2(ax, ay); if (s < .025) c = U.hi; else if (s > .975) c = U.gr;
        if (h > .82 && Math.abs((u - v) - ((h * 40) % 8)) < .8 && u > 4 && u < 20) c = U.gr; }
      if (U.moss && nz(NZ1, ax, ay) > .74 && (u === 0 || v === 0 || hash2(ax, ay) < .3)) c = U.moss;
      if (wallUp && ly < 12) c = ly < 5 ? U.gr : (hash2(ax, ay) < .5 ? U.gr : c);
      buf[at(lx, ly)] = c; }
    if (r === 4 && !door && hash2(tx, ty) < .06) decoBones(buf, CA, ox + 14 + ((hash2(ty, tx) * 16) | 0), oy + 22);
    return;
  }
  if (t === ROAD) {                                                    // 道路：泥土路，邊緣不規則地吃進草地（以前荒地用鵝卵石，看起來像磚牆，已拿掉）
    const nr = [!isRoadish(up), !isRoadish(dn), !isRoadish(lf), !isRoadish(rt)];
    for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
      let d = 99; if (nr[0]) d = Math.min(d, ly); if (nr[1]) d = Math.min(d, 47 - ly); if (nr[2]) d = Math.min(d, lx); if (nr[3]) d = Math.min(d, 47 - lx);
      const th = 2 + Math.floor(nz(NZ2, ax * 1.7, ay * 1.7) * 9);
      if (d < th) { buf[at(lx, ly)] = ground(lx, ly); continue; }
      let c;
      { const big = nz(NZ0, ax + 300, ay), mid = nz(NZ1, ax + 50, ay), s = hash2(ax, ay); let k = big > .58 ? 3 : 2;
        if (Math.abs(big - .58) < .02) k = 2 + ((ax + ay) & 1); if (mid > .74) k++; else if (mid < .25) k--;
        if (s < .012) k = 4; else if (s > .99) k = 0; else if (hash2(ax, ay - 1) < .012) k = 1; c = S.road[k < 0 ? 0 : k > 4 ? 4 : k]; }
      if (d < th + 2) c = S.road[0];
      if (wallUp && ly < 10) c = S.road[0];
      buf[at(lx, ly)] = c; }
    return;
  }
  for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) buf[at(lx, ly)] = ground(lx, ly);
  if (t === GROUND) decoGround(buf, CA, r, tx, ty, ox, oy);
}
/* 崖頂的石塊：Worley 雜訊（每個格點一顆石頭）。gap = 離兩顆石頭交界多近（越小越接近石縫），bx/by = 離石頭中心的偏移（拿來打光） */
const BC = 14, BN = 7, BPX = new Float32Array(BN * BN), BPY = new Float32Array(BN * BN);   // 這一格會用到的石頭中心（7×7 個格點），每格只算一次
let bgx0 = 0, bgy0 = 0;
function boulderCells(AX, AY) {
  bgx0 = Math.floor(AX / BC) - 1; bgy0 = Math.floor(AY / BC) - 1;
  for (let j = 0; j < BN; j++) for (let i = 0; i < BN; i++) { const gx = bgx0 + i, gy = bgy0 + j;
    BPX[j * BN + i] = (gx + .15 + hash2(gx, gy) * .7) * BC; BPY[j * BN + i] = (gy + .15 + hash2(gy + 911, gx) * .7) * BC; }
}
const BQ = { gap: 0, bx: 0, by: 0, id: 0 };
function boulder(ax, ay) {                                              // 先呼叫 boulderCells(這一格的左上角)
  const ci = Math.floor(ax / BC) - bgx0, cj = Math.floor(ay / BC) - bgy0; let d1 = 1e9, d2 = 1e9, bx = 0, by = 0, id = 0;
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) { const k = j * BN + i, dx = ax - BPX[k], dy = (ay - BPY[k]) * 1.2, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; bx = dx; by = dy; id = (bgx0 + i) * 7919 + bgy0 + j; } else if (d < d2) d2 = d; }
  BQ.gap = Math.sqrt(d2) - Math.sqrt(d1); BQ.bx = bx; BQ.by = by; BQ.id = id; return BQ;
}
const LILY = UL(['#1e3a18', '#3e6a2e', '#5a8a3a', '#8ab858', '#f0c8e0']);
function lily(buf, CA, cx, cy, h) {                                    // 睡蓮葉：橢圓 + 一道缺口，偶爾開一朵粉紅小花
  const R = 5 + Math.floor(h * 3);
  for (let y = -R; y <= R; y++) for (let x = -R - 1; x <= R + 1; x++) { const d = (x * x) / ((R + 1) * (R + 1)) + (y * y) / (R * R); if (d > 1) continue;
    if (x > 0 && Math.abs(y) <= Math.max(0, x / 3)) continue;
    buf[(cy + y) * CA + cx + x] = d > .78 ? LILY[0] : (x + y < -R * .4 ? LILY[3] : d < .35 && h > .5 ? LILY[2] : LILY[1]); }
  if (h > .7) { buf[(cy - 1) * CA + cx - 1] = LILY[4]; buf[(cy - 1) * CA + cx - 2] = LILY[4]; buf[(cy - 2) * CA + cx - 1] = LILY[4]; }
}
/* 小裝飾：直接寫進像素緩衝 */
function stamp(buf, CA, rows, pal, x0, y0) { for (let y = 0; y < rows.length; y++) { const row = rows[y]; for (let x = 0; x < row.length; x++) { const c = pal[row[x]]; if (c) buf[(y0 + y) * CA + x0 + x] = c; } } }
const DK = hexU('#0e0b14'), ICEU = UL(ICEW), MUDU = UL(MUDW);
const DECO = {
  tuft: ["a...a...a", ".a..a..a.", ".ba.ab.a.", "..bab.ab.", "..bbbbb.."],
  tuft2: [".a...a.", "..a.a..", "a.bab.a", ".bbabb.", "..bbb.."],
  flower: [".p.", "pcp", ".p.", ".s.", ".s."],
  pebble: [".kkk.", "kwrrk", "krrRk", ".kkk."],
  bone: ["wk.....kw", "kwwwwwwwk", "wk.....kw"],
  mush: [".kkk.", "krwrk", "krrrk", ".kSk.", "..k.."],
  fern: ["a.......a", ".a..a..a.", "..a.a.a..", ".aabbbaa.", "...bbb..."],
  twig: ["n......", ".nn....", "...nnnn", "..n...."],
  shard: ["..k..", ".kpk.", ".kPk.", "kpPPk", "kkkkk"],
  ember: ["e.....", "eE....", ".EyE..", "...Ee.", ".....e"],
};
const DP = {
  p0: { a:0, b:0 }, flowers: ['#f4e27a', '#ffffff', '#f29bb8', '#9ac8ff', '#c8a0ff'].map(hexU),
  stone: [UL(['#1a1820','#b0adbb','#8d8a99','#6b6878']), UL(['#0f1712','#8a9a8a','#6a7a6a','#4a5a4a']), UL(['#2a2014','#d8c8a8','#b0a080','#8a7a5a']), UL(['#100a0a','#6a5a5c','#4a3a3c','#2e2224']), UL(['#0e0b14','#6a6478','#4a4558','#34303f']),
    UL(['#2a3448','#e8f0fa','#b0bed0','#8494ac']), UL(['#0e120a','#5e6a52','#46503c','#2e3626']), UL(['#0e0b14','#6a6478','#4a4558','#34303f'])],
};
function decoBones(buf, CA, x, y) { stamp(buf, CA, DECO.bone, { w:hexU('#e8e0cc'), k:hexU('#8a8270') }, x, y); }
function decoGround(buf, CA, r, tx, ty, ox, oy) {
  const R = mulberry32((ty * MW + tx) * 977 + 31), G = SCU[r].g, P = (rows, pal) => { const w = rows[0].length, h = rows.length; stamp(buf, CA, rows, pal, ox + 2 + Math.floor(R() * (44 - w)), oy + 2 + Math.floor(R() * (44 - h))); };
  const st = DP.stone[r], stoneP = { k:st[0], w:st[1], r:st[2], R:st[3] };
  if (r === 0) {
    const n = R() < .55 ? 1 + (R() < .3 ? 1 : 0) : 0; for (let k = 0; k < n; k++) P(R() < .5 ? DECO.tuft : DECO.tuft2, { a:G[5], b:G[2] });
    if (R() < .14) { const col = DP.flowers[(R() * 5) | 0]; for (let k = 0; k < 1 + ((R() * 3) | 0); k++) P(DECO.flower, { p:col, c:hexU('#e8a33a'), s:G[1] }); }
    if (R() < .05) P(DECO.pebble, stoneP);
  } else if (r === 1) {
    if (R() < .45) P(DECO.tuft2, { a:G[5], b:G[2] });
    if (R() < .14) P(DECO.fern, { a:hexU('#4f9a5e'), b:hexU('#2f6a3e') });
    if (R() < .06) P(DECO.mush, { k:DK, r:hexU('#c4483e'), w:hexU('#f4e4e0'), S:hexU('#efe3c8') });
    if (R() < .08) P(DECO.twig, { n:hexU('#5a3c27') });
  } else if (r === 2) {
    if (R() < .14) P(DECO.pebble, stoneP);
    if (R() < .12) P(DECO.tuft2, { a:hexU('#c8b080'), b:hexU('#8a7650') });
    if (R() < .035) P(DECO.bone, { w:hexU('#e8e0cc'), k:hexU('#8a8270') });
  } else if (r === 3) {
    if (R() < .14) P(DECO.ember, { e:hexU('#5a1a0c'), E:hexU('#e8743b'), y:hexU('#ffd27a') });
    if (R() < .08) P(DECO.shard, { k:DK, p:hexU('#4a3a4e'), P:hexU('#2a2030') });
    if (R() < .06) P(DECO.pebble, stoneP);
  } else if (r === 5) {                                               // 雪原：冰晶、雪堆裡露出來的枯草
    if (R() < .1) P(DECO.shard, { k:DK, p:hexU('#c8ecff'), P:hexU('#7ab8e8') });
    if (R() < .12) P(DECO.tuft2, { a:hexU('#b8a880'), b:hexU('#7a6a50') });
    if (R() < .05) P(DECO.pebble, stoneP);
  } else if (r === 6) {                                               // 沼澤：紫色毒菇、蘆葦、斷枝
    if (R() < .3) P(DECO.tuft, { a:hexU('#5a7040'), b:hexU('#2e3a20') });
    if (R() < .08) P(DECO.mush, { k:DK, r:hexU('#8a4ab0'), w:hexU('#e0c8f0'), S:hexU('#c8b8a0') });
    if (R() < .1) P(DECO.twig, { n:hexU('#3a2c1c') });
    if (R() < .05) P(DECO.fern, { a:hexU('#3e5a30'), b:hexU('#22301a') });
  } else {
    if (R() < .07) P(DECO.bone, { w:hexU('#d8d0bc'), k:hexU('#6a6270') });
    if (R() < .08) P(DECO.pebble, stoneP);
  }
}

/* ---------- 場景物件：用怪物的雕塑器做，打光和外框都一樣 ---------- */
export const SRAMP = {
  leaf: ['#1e4a1e','#2c6428','#3e7e32','#559a42','#74b456','#9ad070'], leafD: ['#163a1a','#225026','#2e6430','#3c7a3c','#52944c'],
  pine: ['#0e2a1e','#163a2a','#1f4c36','#2a6044','#387656'], bark: ['#2a1a0e','#432c1a','#5e3e24','#7a5432','#946a42'],
  dead: ['#2a2018','#3e3226','#54463a','#6c5c4c','#857462'], obs: ['#120c14','#20162a','#30223c','#46344e','#625068'],
  rock: [['#2a2834','#4a4858','#6b6878','#8d8a99','#b0adbb'], ['#1a261e','#33433a','#4a5a4a','#6a7a6a','#8a9a8a'], ['#4a3c28','#6e5e44','#8a7a5a','#b0a080','#d8c8a8'], ['#140c0c','#241a1a','#3a2c2e','#4a3a3c','#6a5a5c'], ['#1a1822','#2e2a38','#46425a','#5e5a72','#7a7690'],
    ['#3a4458','#5e6a82','#8494ac','#b0bed0','#e8f0fa'], ['#141810','#262c20','#3a4230','#525c44','#6a765a']],
  pineS: ['#14283a','#1c3648','#26465a','#32586c','#426e80'], leafS: ['#141a10','#1e2616','#2a341e','#384428','#4a5634'], deadS: ['#121008','#22200e','#363218','#4a4422','#5e582e'],
  crate: ['#3a2414','#5a3c26','#7a5434','#9a7048','#b48a5a'], metal: ['#2a2834','#4a4858','#7a788a','#aaa8ba'],
  grave: ['#3a3846','#5e5a6a','#7a7688','#9a96a8','#bab6c6'], dirt: ['#2e2216','#46341f','#5a4a3a','#6e5c48'],
};
function hdTreeRound(seed, L, B) { const R = mulberry32(seed), j = () => R() * 3 - 1.5;
  return sculpt(54, 66, [
    { sh: SH.cap(27, 64, 27, 42, 4.4, 3.4), ramp: B, tex: .3, grp: 1 },
    { sh: SH.cap(27, 62, 19, 65, 2.8, 1.4), ramp: B, grp: 1 }, { sh: SH.cap(27, 62, 35, 65, 2.8, 1.4), ramp: B, grp: 1 },
    { sh: SH.ell(27, 34, 23, 12), ramp: L, tex: .55, bias: -.2, grp: 2 },
    { sh: SH.ell(15 + j(), 25, 13, 11.5), ramp: L, tex: .55, grp: 3, line: L[1] },
    { sh: SH.ell(39 + j(), 24, 13, 11.5), ramp: L, tex: .55, grp: 4, line: L[1] },
    { sh: SH.ell(27 + j(), 14, 15, 12), ramp: L, tex: .55, grp: 5, line: L[1] },
  ], a => { for (let k = 0; k < 9; k++) { const x = 8 + R() * 38, y = 6 + R() * 30; a.ell(x, y, 2.4, 1.3, L[L.length - 1], true); a.set(x - 1, y - 1, L[L.length - 1]); }
    if (L === SRAMP.leaf) for (let k = 0; k < 4; k++) { const x = 10 + R() * 34, y = 10 + R() * 24; if (a.get(x, y)) { a.set(x, y, '#f2a4c8'); a.set(x + 1, y, '#ffd8ea'); } } }); }
function hdPine(seed) { const R = mulberry32(seed), P = SRAMP.pine;
  return sculpt(44, 72, [
    { sh: SH.cap(22, 71, 22, 58, 3.4, 2.8), ramp: SRAMP.bark, tex: .3, grp: 1 },
    { sh: SH.tri(22, 22, 62, 21, 3), ramp: P, tex: .35, grp: 2 },
    { sh: SH.tri(22, 10, 46, 17, 3), ramp: P, tex: .35, grp: 3, line: P[0] },
    { sh: SH.tri(22, 0, 30, 12, 2.5), ramp: P, tex: .35, grp: 4, line: P[0] },
  ], a => { for (let k = 0; k < 7; k++) { const y = 8 + R() * 50, x = 22 + (R() - .7) * (y * .4); if (a.get(x, y)) { a.set(x, y, P[4]); a.set(x + 1, y + 1, P[3]); } } }); }
function hdPineSnow(seed) { const R = mulberry32(seed), P = SRAMP.pineS;    // 雪松：每一層樹冠上緣蓋著雪
  return sculpt(44, 72, [
    { sh: SH.cap(22, 71, 22, 58, 3.4, 2.8), ramp: SRAMP.bark, tex: .3, grp: 1 },
    { sh: SH.tri(22, 22, 62, 21, 3), ramp: P, tex: .35, grp: 2 },
    { sh: SH.tri(22, 10, 46, 17, 3), ramp: P, tex: .35, grp: 3, line: P[0] },
    { sh: SH.tri(22, 0, 30, 12, 2.5), ramp: P, tex: .35, grp: 4, line: P[0] },
  ], a => { for (let y = 0; y < 66; y++) for (let x = 0; x < 44; x++) { const p = a.pid(x, y); if (p < 2 || a.pid(x, y - 1) === p) continue;
      a.set(x, y, '#ffffff'); if (R() < .8) a.set(x, y + 1, '#dce8f4'); if (R() < .35) a.set(x, y + 2, '#b0c4d8'); }
    for (let k = 0; k < 6; k++) { const x = 8 + R() * 28, y = 14 + R() * 40; if (a.get(x, y)) a.set(x, y, '#e8f0fa'); } }); }
function hdDead(seed, B) { const R = mulberry32(seed);
  return sculpt(46, 56, [
    { sh: SH.cap(23, 55, 23, 30, 3.6, 2.4), ramp: B, tex: .3, grp: 1 },
    { sh: SH.cap(23, 54, 15, 55.5, 2.4, 1.2), ramp: B, grp: 1 }, { sh: SH.cap(23, 54, 31, 55.5, 2.4, 1.2), ramp: B, grp: 1 },
    { sh: SH.cap(23, 34, 9, 18, 2.2, 1), ramp: B, tex: .3, grp: 1 }, { sh: SH.cap(23, 30, 36, 12, 2.2, 1), ramp: B, tex: .3, grp: 1 },
    { sh: SH.cap(23, 32, 24, 4, 2, 1), ramp: B, tex: .3, grp: 1 }, { sh: SH.cap(13, 21, 5, 19, 1.2, .8), ramp: B, grp: 1 },
    { sh: SH.cap(33, 16, 42, 15, 1.2, .8), ramp: B, grp: 1 }, { sh: SH.cap(24, 14, 30, 6, 1.2, .8), ramp: B, grp: 1 },
  ], a => { for (let k = 0; k < 5; k++) a.set(20 + R() * 6, 34 + R() * 18, B[0]); }); }
function hdSpike(seed) { const R = mulberry32(seed), O = SRAMP.obs;
  return sculpt(40, 52, [
    { sh: SH.tri(12, 14, 50, 6, 0), ramp: O, grp: 1 }, { sh: SH.tri(29, 18, 50, 6, 0), ramp: O, grp: 2 },
    { sh: SH.tri(20, 0, 51, 9, 0), ramp: O, grp: 3 },
  ], a => { let x = 20, y = 12; for (let k = 0; k < 16; k++) { a.set(x, y, k % 3 ? '#e8743b' : '#ffd27a'); y += 2; x += R() < .5 ? -1 : 1; }
    for (let k = 0; k < 4; k++) a.set(11 + k % 2, 30 + k * 3, '#e8743b'); }); }
function hdRock(seed, Rm, moss, glow) { const R = mulberry32(seed);
  return sculpt(40, 28, [
    { sh: SH.ell(14, 18, 11, 9), ramp: Rm, tex: .35, grp: 1 },
    { sh: SH.ell(25, 16, 13, 11), ramp: Rm, tex: .35, grp: 2, line: Rm[0] },
    { sh: SH.ell(33, 22, 6, 5), ramp: Rm, tex: .35, grp: 3, line: Rm[0] },
  ], a => { if (moss) for (let x = 0; x < 40; x++) for (let y = 0; y < 28; y++) { const p = a.pid(x, y); if (p >= 0 && a.pid(x, y - 1) !== p && R() < .7) { a.set(x, y, moss[1]); a.set(x, y + 1, moss[0]); } }
    if (glow) { a.line(22, 9, 26, 16, '#e8743b'); a.line(26, 16, 24, 22, '#e8743b'); a.set(25, 15, '#ffd27a'); } }); }
function hdPillar(U) { const W = [U.mo, U.wf2, U.wf, U.cap, U.hi];
  return sculpt(42, 96, [
    { sh: SH.box(21, 89, 19, 6, 4), ramp: W, grp: 1 },
    { sh: SH.box(21, 47, 12, 40, 6), ramp: W, grp: 2 },
    { sh: SH.box(21, 7, 19, 6, 4), ramp: W, grp: 3 },
  ], a => { for (const x of [15, 20, 25, 29]) for (let y = 14; y < 82; y++) if (a.get(x, y) && (y + x) % 9) a.set(x, y, W[x < 21 ? 1 : 0]);
    for (let k = 0; k < 6; k++) a.set(12 + (k * 7) % 18, 30 + k * 9, W[0]);
    if (U.moss) for (let x = 3; x < 39; x++) { const n = (x * 7) % 5; for (let y = 1; y < 3 + n; y++) if (a.get(x, y)) a.set(x, y, y % 2 ? U.moss : '#3e7050'); } }); }
function hdCrate() { const C = SRAMP.crate, M = SRAMP.metal;
  return sculpt(44, 42, [{ sh: SH.box(22, 22, 20, 19, 8), ramp: C, grp: 1 }], a => {
    for (let x = 4; x < 40; x++) { a.set(x, 14, C[0]); a.set(x, 28, C[0]); }
    for (let y = 4; y < 40; y++) { a.set(5, y, C[1]); a.set(38, y, C[1]); }
    for (let k = 0; k < 30; k++) a.set(8 + k, 6 + k, C[1]);
    for (const [x, y] of [[3, 3], [37, 3], [3, 36], [37, 36]]) { a.rect(x, y, 4, 4, M[2]); a.set(x, y, M[3]); a.set(x + 3, y + 3, M[0]); }
    for (const [x, y] of [[11, 9], [32, 9], [11, 33], [32, 33]]) a.set(x, y, '#e0c060'); }); }
function hdGrave(seed) { const G = SRAMP.grave, R = mulberry32(seed);
  return sculpt(34, 46, [
    { sh: SH.ell(17, 42, 16, 4.5), ramp: SRAMP.dirt, grp: 1 },
    { sh: SH.box(17, 25, 11, 16, 5), ramp: G, grp: 2 }, { sh: SH.ell(17, 11, 11, 9, (x, y) => y < 14), ramp: G, grp: 2 },
  ], a => { a.rect(16, 13, 2, 16, G[0]); a.rect(11, 18, 12, 2, G[0]); a.line(16, 14, 16, 28, G[1]);
    for (let k = 0; k < 10; k++) { const x = 7 + R() * 20, y = 30 + R() * 10; if (a.get(x, y)) a.set(x, y, R() < .5 ? '#4a6a3a' : '#5a8a46'); } }); }
function hdBigTree() { const L = SRAMP.leaf, B = SRAMP.bark, R = mulberry32(77);
  const parts: Record<string, any>[] = [{ sh: SH.cap(78, 196, 78, 110, 18, 13), ramp: B, tex: .35, grp: 1 },
    { sh: SH.cap(78, 188, 46, 197, 9, 3), ramp: B, tex: .3, grp: 1 }, { sh: SH.cap(78, 188, 110, 197, 9, 3), ramp: B, tex: .3, grp: 1 },
    { sh: SH.cap(70, 120, 36, 92, 7, 4), ramp: B, tex: .3, grp: 1 }, { sh: SH.cap(86, 118, 122, 88, 7, 4), ramp: B, tex: .3, grp: 1 },
    { sh: SH.ell(78, 92, 74, 30), ramp: L, tex: .5, bias: -.25, grp: 2 }];
  for (const [x, y, rx, ry] of [[36, 74, 34, 30], [120, 72, 34, 30], [78, 64, 44, 34], [52, 40, 34, 28], [106, 38, 34, 28], [78, 24, 36, 24]]) parts.push({ sh: SH.ell(x, y, rx, ry), ramp: L, tex: .5, grp: parts.length, line: L[1] });
  return sculpt(156, 200, parts, a => {
    for (let k = 0; k < 40; k++) { const x = 10 + R() * 136, y = 4 + R() * 100; a.ell(x, y, 3.5, 1.8, L[5], true); a.set(x - 2, y - 1, L[5]); }
    for (let k = 0; k < 24; k++) { const x = 14 + R() * 128, y = 10 + R() * 90; if (a.get(x, y)) { a.set(x, y, '#f2a4c8'); a.set(x + 1, y, '#ffd8ea'); a.set(x, y + 1, '#d880a8'); } }
    for (const [x, y0] of [[72, 130], [84, 150], [76, 168]]) for (let y = y0; y < y0 + 16; y++) a.set(x + Math.round(Math.sin(y * .5) * 1.5), y, B[0]);
    a.ell(80, 150, 5, 7, '#1a0e06'); });
}
/* 房子：整棟畫成一張圖，剛好蓋住它佔的格子。上半是屋頂（一排一排的瓦片），下半是正面的牆。
   晨風鎮：米色灰泥牆 + 木頭框架；霜歌鎮：原木小屋 + 屋頂積雪 + 冰柱。大一點的房子門上有一個小山牆（三角形的屋頂）。
   全部在 post 裡一格一格畫：pid 0 = 牆、1 = 屋頂、2 = 山牆、3 = 煙囪 */
const ROOFS = [['#3e1412', '#62201c', '#86302a', '#a84638', '#c8664c'], ['#16203a', '#22345a', '#30487a', '#425e98', '#5c7cb4'],
  ['#162c1c', '#22422a', '#30583a', '#43704a', '#5c8c5c'], ['#2a1a10', '#44301e', '#5e442a', '#7a5c3a', '#96784e']];
const PLASTER = ['#6e5e4a', '#988670', '#bcab90', '#d6c8aa', '#e8dcc2'], STONE_W = ['#2e2a38', '#48445a', '#686480', '#8a86a0', '#aaa6be'];
const BEAMS = ['#2a1a0e', '#45301a', '#634628', '#80603a'];
function hdHouse(wT, hT, roof, snow, smith) {
  const W = wT * TA, H = hT * TA, R = ROOFS[roof], rng = mulberry32(wT * 31 + hT * 7 + roof * 3 + (snow ? 11 : 0));
  const top = 8, eave = Math.round(H * .5), wl = 7, wr = W - 7, foot = H - 9, LOG = SRAMP.bark;
  const dcx = wT >= 5 ? Math.round(W * .6) : Math.round(W / 2), big = wT >= 4, gw = 30;              // 門的中心；大房子門上有山牆
  const chx = big ? Math.round(dcx < W / 2 ? W * .78 : W * .2) : Math.round(W * .74);                  // 煙囪避開山牆
  const ex = y => 4 - 3 * (y - top) / (eave + 4 - top);                                                 // 屋頂左右邊緣（往下稍微變寬 = 屋簷）
  const parts: any[] = [
    { sh: SH.poly([[wl, eave], [wr, eave], [wr, H], [wl, H]]), ramp: ['#000'], noline: true, rim: false },
    { sh: SH.poly([[4, top], [W - 4, top], [W - 1, eave + 5], [1, eave + 5]]), ramp: ['#000'], noline: true, rim: false },
    { sh: SH.poly(big ? [[dcx, top + 2], [dcx + gw + 4, eave + 6], [dcx - gw - 4, eave + 6]] : [[0, 0], [0, 0], [0, 0]]), ramp: ['#000'], noline: true, rim: false },
    { sh: SH.poly([[chx - 7, 0], [chx + 7, 0], [chx + 7, top + 16], [chx - 7, top + 16]]), ramp: ['#000'], noline: true, rim: false },
  ];
  return sculpt(W, H, parts, a => {
    const N = (x, y) => a.hash(x * 3 + roof, y * 5);
    const shade = (P, k) => P[Math.max(0, Math.min(P.length - 1, Math.round(k)))];
    /* ---- 牆 ---- */
    for (let y = eave; y < H; y++) for (let x = wl; x < wr; x++) { if (a.pid(x, y) !== 0) continue;
      let c;
      if (y >= foot) { const row = (y - foot) >> 2, yy = (y - foot) & 3, off = row & 1 ? 5 : 0;           // 石頭地基
        const bx = (x + off) % 10; c = yy === 3 || bx === 0 ? STONE_W[0] : shade(STONE_W, 2.6 - yy * .5 + (N(Math.floor((x + off) / 10), row) - .5) * 1.4); }
      else if (snow) { const yy = (y - eave) % 7;                                                          // 原木：每根一條亮邊、一條暗邊、中間有木紋
        c = yy === 0 ? LOG[3] : yy === 6 ? LOG[0] : yy === 5 ? LOG[1] : shade(LOG, 2.2 + (N(x >> 2, y) - .5) * .9); if (yy > 0 && yy < 5 && N(x, y) > .93) c = LOG[1]; }
      else c = shade(PLASTER, 3.1 + (N(x, y) - .5) * .7 - (x < wl + 3 ? 1 : 0) - (x > wr - 3 ? .7 : 0));     // 灰泥：有一點斑駁
      const sh = y - eave - 5; if (y < foot && sh < 5) c = snow ? shade(LOG, sh < 2 ? 0 : 1) : shade(PLASTER, sh < 2 ? 0 : sh < 4 ? 1 : 2);   // 屋簷下的陰影
      a.set(x, y, c); }
    if (!snow) {                                                                                          // 木頭框架：兩邊的柱子、地基上的橫樑、斜撐
      for (const px of [wl, wr - 4]) for (let y = eave + 5; y < foot; y++) { a.set(px, y, BEAMS[0]); a.set(px + 1, y, BEAMS[2]); a.set(px + 2, y, BEAMS[1]); a.set(px + 3, y, BEAMS[0]); }
      for (let x = wl; x < wr; x++) { a.set(x, foot - 4, BEAMS[0]); a.set(x, foot - 3, BEAMS[2]); a.set(x, foot - 2, BEAMS[1]); a.set(x, foot - 1, BEAMS[0]); }
      for (let k = 0; k < 14; k++) for (let t = 0; t < 3; t++) { a.set(wl + 4 + k + t, foot - 5 - k, t === 1 ? BEAMS[2] : BEAMS[1]); a.set(wr - 5 - k - t, foot - 5 - k, t === 1 ? BEAMS[2] : BEAMS[1]); }
    } else for (let y = eave + 6; y < foot; y += 7) for (const ox of [wl + 3, wr - 4]) {                // 原木小屋：轉角露出圓圓的木頭截面
      a.ell(ox, y + 3, 3.5, 3.2, LOG[0]); a.ell(ox, y + 3, 2.5, 2.3, '#b08a5a'); a.set(ox, y + 3, '#7a5a38'); }
    /* ---- 窗戶 ---- */
    const wins = big ? [dcx - 46, dcx + 46].concat(wT >= 5 ? [dcx - 92] : []) : [dcx - 40, dcx + 40];
    const winY = eave + 16;
    for (const cx of wins) { if (smith && cx > dcx) continue; const x0 = cx - 8; if (x0 < wl + 10 || x0 + 16 > wr - 10) continue;
      for (const sx of [x0 - 7, x0 + 18]) { a.rect(sx, winY - 1, 6, 18, BEAMS[0]); a.rect(sx + 1, winY, 4, 16, R[2]);         // 百葉窗
        for (let y = winY + 2; y < winY + 15; y += 3) a.rect(sx + 1, y, 4, 1, R[1]); a.rect(sx + 1, winY, 1, 16, R[3]); }
      a.rect(x0 - 1, winY - 2, 18, 19, BEAMS[0]); a.rect(x0 + 1, winY, 14, 15, '#f0b850');
      a.rect(x0 + 1, winY, 14, 5, '#ffd88a'); a.rect(x0 + 1, winY, 6, 2, '#fff4c4');
      a.rect(x0 + 7, winY, 2, 15, BEAMS[1]); a.rect(x0 + 1, winY + 7, 14, 2, BEAMS[1]);
      a.rect(x0 - 3, winY + 16, 22, 3, BEAMS[2]); a.rect(x0 - 3, winY + 18, 22, 1, BEAMS[0]);                   // 窗台
      if (snow) { a.rect(x0 - 3, winY + 15, 22, 2, '#eef4ff'); a.rect(x0 - 2, winY + 15, 20, 1, '#ffffff'); }
      else { a.rect(x0 - 2, winY + 19, 20, 4, '#5a3a20'); a.rect(x0 - 2, winY + 19, 20, 1, '#7a5430');            // 花台
        for (let x = x0 - 1; x < x0 + 17; x++) { const g = rng(); a.set(x, winY + 15, g < .5 ? '#3f7a34' : '#5a9a44'); if (x % 3 === 0) { a.set(x, winY + 14, rng() < .5 ? '#f29bb8' : '#f4e27a'); a.set(x, winY + 13, '#ffffff'); } } } }
    /* ---- 門 ---- */
    const dw = 20, dh = Math.min(40, foot - eave - 14), dx = dcx - dw / 2, dy = foot - dh;
    a.rect(dx - 3, dy - 3, dw + 6, dh + 3, BEAMS[0]); a.rect(dx - 2, dy - 2, dw + 4, 2, BEAMS[2]);
    for (let y = dy; y < foot; y++) for (let x = dx; x < dx + dw; x++) { const cut = y - dy < 4 && (Math.abs(x - dcx + .5) > dw / 2 - (4 - (y - dy))); if (cut) continue;   // 上緣稍微圓角
      const px = (x - dx) % 5; a.set(x, y, px === 0 ? '#3a2414' : px === 1 ? '#8a5a34' : shade(['#4a2e18', '#5e3c22', '#704a2a'], 1.4 + (N(x, y) - .5))); }
    for (const by of [dy + 8, foot - 9]) a.rect(dx, by, dw, 2, '#2e2a38');                                  // 鐵條
    a.rect(dx + dw - 5, dy + dh / 2, 2, 3, '#f2c14e'); a.set(dx + dw - 5, dy + dh / 2, '#fff2a8');
    for (let y = foot; y < H; y++) for (let x = dx - 5; x < dx + dw + 5; x++) a.set(x, y, y === foot ? STONE_W[4] : y === H - 1 ? STONE_W[0] : STONE_W[3]);   // 門前的石階
    if (big) { const ly = dy - 9; a.rect(dcx - 2, ly - 4, 4, 2, BEAMS[0]); a.rect(dcx - 3, ly - 2, 6, 6, '#2e2a38'); a.rect(dcx - 2, ly - 1, 4, 4, '#ffe08a'); a.set(dcx - 1, ly - 1, '#fffbe0'); }   // 門燈
    /* ---- 屋頂 ---- */
    const RH = 7, SW = 10;
    for (let y = top; y <= eave + 5; y++) for (let x = 0; x < W; x++) { if (a.pid(x, y) !== 1) continue;
      const t = (y - top) / (eave - top), r = Math.floor((y - top) / RH), yy = (y - top) % RH, xx = (x + (r & 1) * (SW >> 1) + (N(r, 0) * 4 | 0)) % SW;
      let k = 3.1 - t * 1.4 + (N(Math.floor((x + (r & 1) * 5) / SW), r) - .5) * .7;
      if (yy === 0) k += .8; else if (yy >= RH - 2) k -= yy === RH - 1 ? 3 : 1; else if (xx === 0) k -= 1.6;
      const el = x - ex(y), er = (W - 1 - ex(y)) - x;
      if (el < 3 || er < 3) k = el < 1 || er < 1 ? 1 : 1.6 - (er < 3 ? .6 : 0);                             // 左右的封簷板
      if (y < top + 4) k = y === top ? 3.6 : y === top + 3 ? 0 : 1.8 + ((x >> 3) & 1) * .5;                   // 屋脊
      let c = shade(R, k);
      if (y >= eave + 2) c = y === eave + 2 ? BEAMS[3] : y >= eave + 5 ? BEAMS[0] : BEAMS[1];                 // 屋簷的木板
      a.set(x, y, c); }
    if (big) {                                                                                             // 山牆：三角形的牆面 + 兩條屋簷板 + 圓窗
      const gy0 = top + 6, gy1 = eave + 1;
      for (let y = gy0; y <= eave + 6; y++) for (let x = dcx - gw - 6; x <= dcx + gw + 6; x++) { if (a.pid(x, y) !== 2) continue;
        const half = (y - top - 2) / (eave + 6 - top - 2) * (gw + 4), d = half - Math.abs(x - dcx);
        let c;
        if (d < 6) c = d < 1 ? R[0] : d < 2.2 ? R[3] : d < 5 ? shade(R, x < dcx ? 2 : 1.5) : R[0];                // 斜斜的屋簷板（用屋頂的顏色）
        else if (y > gy1) c = BEAMS[y === gy1 + 1 ? 2 : y >= eave + 5 ? 0 : 1];
        else if (snow) { const yy = (y - gy0) % 6; c = yy === 0 ? LOG[3] : yy === 5 ? LOG[0] : LOG[2]; }
        else c = shade(PLASTER, 3 + (N(x, y) - .5) * .6 - (y > gy1 - 3 ? 1.5 : 0));
        a.set(x, y, c); }
      const oy = Math.round((top + eave) / 2) + 6;                                                          // 閣樓的小圓窗
      a.ell(dcx, oy, 6.5, 6.5, BEAMS[0]); a.ell(dcx, oy, 5, 5, '#f0b850'); a.ell(dcx - 1, oy - 1, 3, 3, '#ffd88a');
      a.rect(dcx - 5, oy, 10, 1, BEAMS[1]); a.rect(dcx, oy - 5, 1, 10, BEAMS[1]); }
    /* ---- 煙囪 ---- */
    for (let y = 0; y < top + 16; y++) for (let x = chx - 7; x <= chx + 7; x++) { if (a.pid(x, y) !== 3) continue;
      const yy = y % 4, bx = (x + ((y >> 2) & 1) * 3) % 6; let c = yy === 3 || bx === 0 ? '#3a1e1a' : shade(['#5a2a22', '#7a3a2e', '#94503c', '#ae6a50'], 2 - (x - chx) * .12 + (N(x >> 1, y >> 2) - .5));
      if (y < 3) c = y === 0 ? '#2a2834' : '#5a5868'; if (y === 3) c = '#1a1416';
      if (x === chx - 7) c = '#2a1a16'; if (y === top + 15) c = R[0];
      a.set(x, y, c); }
    a.rect(chx - 4, 1, 8, 2, '#1a1416');                                                                    // 煙囪口
    /* ---- 雪 ---- */
    if (snow) {
      for (let x = 0; x < W; x++) { let t0 = -1; for (let y = 0; y < eave + 5; y++) { const p = a.pid(x, y); if (p === 1 || p === 2 || p === 3) { t0 = y; break; } }
        if (t0 < 0) continue; const ch = a.pid(x, t0) === 3, d = ch ? 4 : 8 + Math.round(Math.sin(x * .27) * 2.5 + rng() * 2);
        for (let y = t0; y < t0 + d; y++) a.set(x, y, y - t0 < 2 ? '#ffffff' : y - t0 >= d - 2 ? '#b0c4dc' : '#e6eef8'); }
      for (let x = 2; x < W - 2; x++) { if (a.pid(x, eave + 1) !== 1 && a.pid(x, eave + 1) !== 2) continue;    // 屋簷上的一條積雪
        const d = 2 + (Math.sin(x * .5) > .6 ? 1 : 0); for (let k = 0; k < d; k++) a.set(x, eave + k, k === 0 ? '#ffffff' : '#dce8f6'); }
      for (let x = 6; x < W - 6; x += 5 + Math.floor(rng() * 5)) { if (Math.abs(x - dcx) < 14) continue; const L = 3 + Math.floor(rng() * 8);   // 冰柱
        for (let k = 0; k < L; k++) { a.set(x, eave + 6 + k, k < L - 2 ? '#dcecff' : '#a8c8f0'); if (k < L / 2) a.set(x + 1, eave + 6 + k, '#a8c8f0'); } } }
    if (smith) { const sx = dcx + dw / 2 + 12, sy = eave + 14;                                              // 鐵匠鋪：門邊掛鐵砧招牌
      a.rect(sx + 9, sy - 6, 2, 6, BEAMS[0]); a.rect(sx, sy, 28, 20, BEAMS[0]); a.rect(sx + 1, sy + 1, 26, 18, '#7a5434'); a.rect(sx + 1, sy + 1, 26, 1, '#9a7048');
      a.rect(sx + 6, sy + 6, 16, 4, '#4a4858'); a.rect(sx + 10, sy + 10, 8, 3, '#4a4858'); a.rect(sx + 7, sy + 13, 14, 3, '#4a4858'); a.rect(sx + 6, sy + 6, 16, 1, '#aaa8c0');
      a.rect(sx + 18, sy + 3, 3, 4, '#8a6038'); }
  });
}
const HOUSE_ART = new Map();
function houseArt(h) { const k = h.w + ',' + h.h + ',' + h.roof + ',' + h.snow + ',' + !!h.smith; if (!HOUSE_ART.has(k)) HOUSE_ART.set(k, hdHouse(h.w, h.h, h.roof, h.snow, h.smith)); return HOUSE_ART.get(k); }
const SCN = {
  trees: [[hdTreeRound(1, SRAMP.leaf, SRAMP.bark), hdTreeRound(2, SRAMP.leaf, SRAMP.bark), hdTreeRound(3, SRAMP.leaf, SRAMP.bark)],
    [hdPine(4), hdPine(5), hdPine(6)], [hdDead(7, SRAMP.dead), hdDead(8, SRAMP.dead)], [hdSpike(9), hdSpike(10)], [hdDead(11, SRAMP.obs), hdTreeRound(12, SRAMP.leafD, SRAMP.bark)],
    [hdPineSnow(13), hdPineSnow(14), hdPineSnow(15)], [hdDead(16, SRAMP.deadS), hdTreeRound(17, SRAMP.leafS, SRAMP.deadS), hdDead(18, SRAMP.deadS)]],
  rocks: SRAMP.rock.map((Rm, r) => { const moss = r === 1 ? ['#2e5a36', '#4a8a4e'] : r === 5 ? ['#dce8f4', '#ffffff'] : r === 6 ? ['#2e3a1e', '#4a6a2e'] : null; return [hdRock(20 + r, Rm, moss, r === 3), hdRock(30 + r, Rm, moss, false)]; }),
  pillars: RUIN.map(u => hdPillar(u)), crate: hdCrate(), graves: [hdGrave(1), hdGrave(2)], big: hdBigTree(),
};
function shadowEll(g, cx, cy, rx, ry, a = .28) { g.fillStyle = 'rgba(0,0,0,' + a + ')'; g.beginPath();
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2))); if (w > 0) g.rect(Math.round(cx - w), Math.round(cy + y), w * 2, 1); } g.fill(); }
export function bakeObjectHD(g, tx, ty, x, y) {
  const i = ty * MW + tx, t = map[i], r = reg[i], h = hash2(tx, ty), jx = Math.round((h - .5) * 8);
  const blit = (c, ox = 0, oy = 0) => g.drawImage(c, Math.round(x + TA / 2 - c.width / 2 + ox), Math.round(y + TA - c.height + oy));
  if (t === TREE) { const set = SCN.trees[r], c = set[Math.floor(h * set.length)]; shadowEll(g, x + TA / 2 + jx, y + TA - 4, 20, 5); blit(c, jx, 2); }
  else if (t === ROCK) { const c = SCN.rocks[r][(tx + ty) & 1]; shadowEll(g, x + TA / 2, y + TA - 6, 18, 4); blit(c, 0, -4); }
  else if (t === PILLAR) { shadowEll(g, x + TA / 2, y + TA - 4, 22, 5, .35); blit(SCN.pillars[r], 0, -1); }
  else if (t === CRATE) { shadowEll(g, x + TA / 2, y + TA - 4, 22, 5, .35); blit(SCN.crate, 0, -2); }
  else if (t === GRAVE) blit(SCN.graves[(tx + ty) & 1], 0, -2);
  else if (t === HOUSE) { const h = HOUSES.find(h => h.tx === tx && h.ty + h.h - 1 === ty);                // 只在房子的左下角那格畫整棟
    if (h) { shadowEll(g, x + h.w * TA / 2, y + TA - 2, h.w * TA / 2 + 4, 8, .3); g.drawImage(houseArt(h), x, y + TA - h.h * TA); } }
  else if (t === BIGT && tileAt(tx - 1, ty) !== BIGT && tileAt(tx, ty + 1) !== BIGT) {
    shadowEll(g, x + TA, y + TA - 2, 70, 10, .3); g.drawImage(SCN.big, Math.round(x + TA - SCN.big.width / 2), Math.round(y + TA + 4 - SCN.big.height)); }
}
