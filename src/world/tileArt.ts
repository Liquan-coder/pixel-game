import { mulberry32 } from '../core/util';
import { SH, hash2, sculpt } from '../art/monsters';
import { ARENA, BIGT, BRIDGE, CLIFF, CRATE, DOOR, FOG, GRAVE, GROUND, HOUSE, HOUSES, LAVA, MW, PILLAR, RFLOOR, ROAD, ROCK, RWALL, TREE, WALKABLE, WATER, map, reg } from './map';
import { CARPU, CRUSTU, ICEW, LAVU, MUDW, NZ0, NZ1, NZ2, RUIN, RUINU, SCU, TA, UL, WATU, WOODU, groundK, hexU, isLavaish, isRoadish, isWallT, isWaterish, nz, tileAt } from './gen';

export function bakeTileHD(buf, CA, tx, ty, ox, oy) {
  const i = ty * MW + tx, t = map[i], r = reg[i], S = SCU[r], U = RUINU[r];
  const up = tileAt(tx, ty - 1), dn = tileAt(tx, ty + 1), lf = tileAt(tx - 1, ty), rt = tileAt(tx + 1, ty);
  const AX = tx * TA, AY = ty * TA, wallUp = isWallT(up);
  const at = (lx, ly) => (oy + ly) * CA + ox + lx;
  const ground = (lx, ly) => { const ax = AX + lx, ay = AY + ly; let k = groundK(r, ax, ay);
    if (wallUp && ly < 15) k -= ly < 5 ? 2 : ly < 10 ? 1 : (hash2(ax, ay) < .5 ? 1 : 0);
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
    } else {                                                             // 崖頂：暗色台地 + 邊緣反光
      for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
        const n = nz(NZ1, ax, ay) + (hash2(ax, ay) - .5) * .2; let c = S.top[n < .42 ? 0 : n < .6 ? 1 : 2];
        if (!isWallT(lf) && lx < 3) c = lx === 0 ? S.face[0] : S.lip[2];
        else if (!isWallT(rt) && lx > 44) c = lx === 47 ? S.face[0] : S.face[1];
        if (!isWallT(up) && ly < 4) c = ly < 2 ? S.face[0] : S.lip[2];
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
    } else {
      for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { let c = hash2(AX + lx, AY + ly) < .08 ? U.mo : U.top;
        if ((!isWallT(lf) && lx < 2) || (!isWallT(rt) && lx > 45) || (!isWallT(up) && ly < 2)) c = U.edge;
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
      const WP = r === 5 ? ICEU : r === 6 ? MUDU : WATU;                // 雪原是結冰的湖、沼澤是混濁的泥水
      if (r === 5 && k < 5 && hash2(ax >> 3, ay >> 3) < .05 && Math.abs(((ax + ay * 2) % 13) - 6) < 1) k = 6;   // 冰面裂紋
      let c = WP[k];
      if (!isWaterish(up)) { if (ly < 7) c = S.bank[ly < 2 ? 2 : (hash2(ax, ay >> 2) < .3 ? 0 : 1)]; else if (ly < 9) c = WP[6]; else if (ly < 14) c = WP[Math.max(k, 5)]; }
      buf[at(lx, ly)] = c; }
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
  if (t === ROAD) {                                                    // 道路：泥土或鵝卵石，邊緣不規則地吃進草地
    const nr = [!isRoadish(up), !isRoadish(dn), !isRoadish(lf), !isRoadish(rt)];
    for (let ly = 0; ly < TA; ly++) for (let lx = 0; lx < TA; lx++) { const ax = AX + lx, ay = AY + ly;
      let d = 99; if (nr[0]) d = Math.min(d, ly); if (nr[1]) d = Math.min(d, 47 - ly); if (nr[2]) d = Math.min(d, lx); if (nr[3]) d = Math.min(d, 47 - lx);
      const th = 2 + Math.floor(nz(NZ2, ax * 1.7, ay * 1.7) * 9);
      if (d < th) { buf[at(lx, ly)] = ground(lx, ly); continue; }
      let c;
      if (S.cob) { const row = Math.floor(ay / 9), o = (row & 1) * 7, col = Math.floor((ax + o) / 13), u = (ax + o) % 13, v = ay % 9, h = hash2(col, row);
        let k = 2 + Math.floor(h * 2.4); if (u === 0 || v === 0 || (u === 1 && v === 1) || (u === 12 && v === 8)) k = 1; else if (u === 1 || v === 1) k++; else if (u === 12 || v === 8) k--;
        c = S.road[k < 0 ? 0 : k > 4 ? 4 : k]; }
      else { const big = nz(NZ0, ax + 300, ay), mid = nz(NZ1, ax + 50, ay), s = hash2(ax, ay); let k = big > .58 ? 3 : 2;
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
    UL(['#2a3448','#e8f0fa','#b0bed0','#8494ac']), UL(['#0e120a','#5e6a52','#46503c','#2e3626'])],
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
/* 房子：整棟畫成一張圖，剛好蓋住它佔的格子（上半是屋頂、下半是正面的牆）。snow = 屋頂積雪 + 冰柱、牆是原木 */
const ROOFS = [['#3a0e10', '#5e1a1c', '#8a2a26', '#b04432', '#d06648'], ['#10203a', '#1c3460', '#2a4a86', '#3e64a8', '#5a82c4'],
  ['#14301c', '#22482a', '#346638', '#4a8448', '#6aa25c'], ['#2a1a10', '#46301c', '#6a4a2a', '#8a663a', '#a8824e']];
function hdHouse(wT, hT, roof, snow, smith) {
  const W = wT * TA, H = hT * TA, R = ROOFS[roof], eave = Math.round(H * .56), WALL = snow ? SRAMP.bark : ['#8a7a5e', '#b0a080', '#cfc0a0', '#e4d8bc', '#f2ead4'];
  const BEAM = ['#2e1c0e', '#4a3018', '#6a4626'], rng = mulberry32(wT * 31 + hT * 7 + roof);
  return sculpt(W, H, [
    { sh: SH.box(W / 2, (eave + H) / 2 - 2, W / 2 - 7, (H - eave) / 2, 9), ramp: WALL, tex: .15, grp: 1 },
    { sh: SH.poly([[16, 4], [W - 16, 4], [W - 1, eave + 4], [1, eave + 4]]), ramp: R, tex: .12, bias: .1, grp: 2 },
    { sh: SH.box(W * .72, 12, 7, 12, 9), ramp: ['#2a2834', '#4a4858', '#6e6c86', '#8e8ca6'], tex: .2, grp: 3 },
  ], a => {
    for (let y = 8; y < eave + 3; y += 7) for (let x = 0; x < W; x++) if (a.pid(x, y) === 1) a.set(x, y, R[0]);           // 一排一排的瓦片
    for (let y = 8; y < eave + 3; y += 7) for (let x = ((y / 7) & 1) * 6; x < W; x += 12) for (let k = 1; k < 7; k++) if (a.pid(x, y + k) === 1) a.set(x, y + k, R[1]);
    for (let x = 0; x < W; x++) if (a.pid(x, eave + 4) === 1 || a.pid(x, eave + 3) === 1) a.set(x, eave + 3, R[0]);
    const wy = eave + 5, wb = H - 3;
    if (snow) { for (let y = wy; y < wb; y += 6) for (let x = 8; x < W - 8; x++) if (a.pid(x, y) === 0) a.set(x, y, WALL[0]); }   // 原木牆
    else { for (const x of [8, W / 2 - 1, W - 10]) for (let y = wy; y < wb; y++) { a.set(x, y, BEAM[1]); a.set(x + 1, y, BEAM[0]); }   // 木頭樑柱
      for (let x = 8; x < W - 8; x++) { a.set(x, wy, BEAM[1]); a.set(x, wy + 1, BEAM[0]); } }
    const dw = 18, dx = Math.round(W / 2 - dw / 2) + (wT > 3 ? 14 : 0), dh = Math.min(30, wb - wy - 6);            // 門
    a.rect(dx - 2, wb - dh - 2, dw + 4, dh + 2, BEAM[0]); a.rect(dx, wb - dh, dw, dh, '#5a3c26');
    for (let x = dx + 4; x < dx + dw; x += 5) for (let y = wb - dh; y < wb; y++) a.set(x, y, '#3a2414');
    a.set(dx + dw - 4, wb - dh / 2, '#f2c14e');
    const winY = wy + 8;                                                                                     // 窗戶：暖黃色的燈光
    for (const wx of wT > 3 ? [16, dx - 26] : [10]) if (wx > 6) { a.rect(wx - 2, winY - 2, 20, 18, BEAM[0]); a.rect(wx, winY, 16, 14, '#ffd27a');
      a.rect(wx, winY, 16, 3, '#fff0b0'); a.rect(wx + 7, winY, 2, 14, BEAM[1]); a.rect(wx, winY + 6, 16, 2, BEAM[1]);
      if (!snow) for (let x = wx - 2; x < wx + 18; x++) { a.set(x, winY + 15, '#6a4626'); if (x % 3) a.set(x, winY + 14, rng() < .5 ? '#f29bb8' : '#f4e27a'); } }   // 花台
    if (snow) { for (let x = 0; x < W; x++) { let top = -1; for (let y = 0; y < eave + 5; y++) if (a.pid(x, y) === 1) { top = y; break; }   // 屋頂積雪
        if (top < 0) continue; const d = 10 + Math.round(Math.sin(x * .3) * 3 + rng() * 2); for (let y = top; y < Math.min(eave + 3, top + d); y++) a.set(x, y, y - top < 2 ? '#ffffff' : y - top > d - 3 ? '#b8c8dc' : '#e8f0fa'); }
      for (let x = 4; x < W - 4; x += 5 + Math.floor(rng() * 4)) { const L = 3 + Math.floor(rng() * 7); for (let k = 0; k < L; k++) a.set(x, eave + 5 + k, k < L - 2 ? '#dcecff' : '#a8c8f0'); } }   // 冰柱
    if (smith) { const sx = dx + dw + 6, sy = wy + 4;                                                       // 鐵匠鋪：門邊掛鐵砧招牌
      a.rect(sx, sy, 22, 16, '#3a2414'); a.rect(sx + 1, sy + 1, 20, 14, '#7a5434');
      a.rect(sx + 5, sy + 5, 12, 3, '#4a4858'); a.rect(sx + 8, sy + 8, 6, 3, '#4a4858'); a.rect(sx + 6, sy + 11, 10, 2, '#4a4858'); a.rect(sx + 5, sy + 5, 12, 1, '#9a98b0'); }
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
