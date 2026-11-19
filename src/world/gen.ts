import { G } from '../core/state';
import { clamp, makeNoise, mulberry32 } from '../core/util';
import { hash2 } from '../art/monsters';
import { ARENA, BIGT, BRIDGE, CAMPS, CLIFF, CRATE, DOOR, FOG, GRAVE, GROUND, HOUSE, HOUSES, LAVA, MH, MW, OPEN_REGIONS, PILLAR, REGIONS, TOWNS, RFLOOR, ROAD, ROADS, ROCK, RWALL, SOLID, TREE, TS, WALKABLE, WATER, braziers, glows, map, reg, shade, spawns, torches } from './map';
import { RBDEF } from './regionBoss';
import { addDungeonSpawns, stampEntrances } from './dungeons';
export let reachable: Uint8Array = null;                               // 從起點走得到的格子（genWorld 算好）

export function genWorld() {
  const R = mulberry32(9137);
  const nA = makeNoise(11, 14), nB = makeNoise(23, 14), nC = makeNoise(37, 5), nD = makeNoise(51, 9), nE = makeNoise(77, 7);
  const I = (x, y) => y * MW + x, inb = (x, y) => x >= 3 && y >= 3 && x < MW - 3 && y < MH - 3;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const px = x + (nA(x, y) - .5) * 46, py = y + (nB(x, y) - .5) * 46;
    let best = 0, bd = 1e9; for (const k of OPEN_REGIONS) for (const [cx, cy] of (REGIONS[k] as any).cs || [REGIONS[k].c]) { const d = (px - cx) ** 2 + (py - cy) ** 2; if (d < bd) { bd = d; best = k; } }
    if (y > 206) best = 0;                                              // 南半邊全部是平原（不會有一小塊沼澤滲進來）
    reg[I(x, y)] = best; shade[I(x, y)] = nC(x, y) > .56 ? 1 : 0;
  }
  map.fill(GROUND);
  /* 地區之間沒有牆了：交界處只是零星的石頭和樹（地面顏色在 tileArt 裡混色過渡），難度靠「越往外怪越強」來分 */
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const r = reg[I(x, y)]; let other = -1;
    for (let dy = -1; dy <= 1 && other < 0; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= MW || Y >= MH) continue; if (reg[I(X, Y)] !== r) { other = reg[I(X, Y)]; break; } }
    if (other >= 0 && hash2(x * 7 + 3, y * 13 + 5) < .1) map[I(x, y)] = (r <= 1 && other <= 1) ? TREE : ROCK;
    if (!inb(x, y)) map[I(x, y)] = CLIFF;
  }
  /* 南半邊的平原：東邊是海、南邊是海岸，中間一條河往東流進海裡，還有一座湖和幾塊岩石丘 */
  const coastX = y => 258 + Math.sin(y * .05) * 12 + (nA(3, y) - .5) * 24;
  for (let y = 186; y < MH; y++) for (let x = 0; x < MW; x++) { const i = I(x, y);
    const sea = (y >= 194 && x > coastX(y) - Math.max(0, 200 - y) * -3) || y > MH - 7 - nB(x, 5) * 6 || (y >= 196 && x < 3 + nC(4, y) * 4);
    if (sea && (y >= 194 || x > 250)) map[i] = WATER;
    else if (reg[i] === 0 && y > 196 && nE(x * 1.15 + 200, y * 1.15) > .77) map[i] = CLIFF; }
  for (let pass = 0; pass < 3; pass++) {                                // 岩石丘磨圓：周圍 8 格少於 4 格是岩石就拿掉、多於 5 格就補上 → 不會有一格一格的碎石柱
    const prev = map.slice();
    for (let y = 197; y < MH - 4; y++) for (let x = 4; x < MW - 4; x++) { const i = I(x, y); if (reg[i] !== 0 || (prev[i] !== CLIFF && prev[i] !== GROUND)) continue;
      let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && prev[I(x + dx, y + dy)] === CLIFF) n++;
      if (prev[i] === CLIFF && n < 4) map[i] = GROUND; else if (prev[i] === GROUND && n > 5) map[i] = CLIFF; } }
  const riverY = x => 300 - (x - 3) * .25 + Math.sin(x * .06) * 8;
  for (let x = 3; x < 270; x++) { const yc = Math.round(riverY(x)), w = x > 200 ? 2 : 1; for (let d = -w; d <= w; d++) if (inb(x, yc + d)) map[I(x, yc + d)] = WATER; }
  for (let y = 322; y <= 342; y++) for (let x = 44; x <= 72; x++) if (inb(x, y) && ((x - 58) / 11) ** 2 + ((y - 332) / 7) ** 2 < 1 + (nE(x, y) - .5) * .5) map[I(x, y)] = WATER;
  for (let y = 100; y <= 124; y++) for (let x = 28; x <= 52; x++) if (inb(x, y) && reg[I(x, y)] === 0 && ((x - 40) / 9) ** 2 + ((y - 112) / 7) ** 2 < 1 + (nE(x, y) - .5) * .5) map[I(x, y)] = WATER;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = I(x, y); if (reg[i] !== 3 || map[i] !== GROUND) continue;
    if (nE(x * 1.3, y * 1.3) > .7) map[i] = LAVA;
  }
  // 冰封湖（雪原）、沼澤裡一攤一攤的水
  for (let y = 70; y <= 88; y++) for (let x = 306; x <= 332; x++) if (inb(x, y) && reg[I(x, y)] === 5 && ((x - 318) / 11) ** 2 + ((y - 78) / 6.5) ** 2 < 1 + (nE(x, y) - .5) * .5) map[I(x, y)] = WATER;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = I(x, y); if (reg[i] === 6 && map[i] === GROUND && nE(x * 1.6 + 30, y * 1.6) > .66) map[i] = WATER; }
  for (let x = 150; x < 246; x++) { const yc = Math.round(24 + Math.sin(x * .09) * 5 + (x - 150) * .22); for (let d = -1; d <= 1; d++) { const i = I(x, yc + d); if (inb(x, yc + d) && reg[i] === 3) map[i] = LAVA; } }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = I(x, y); if (map[i] !== GROUND) continue;
    const r = reg[i], n = nD(x * 1.3 + 90, y * 1.3 + 40), q = R();
    if (r === 0) { if (q < .018 + (n > .7 ? .38 : 0) + (y > 196 && n > .62 ? .12 : 0)) map[i] = TREE; else if (q > .99) map[i] = ROCK; }
    else if (r === 1) { if (q < .1 + .55 * Math.max(0, n - .35)) map[i] = TREE; else if (q > .992) map[i] = ROCK; }
    else if (r === 2) { if (q < .014) map[i] = TREE; else if (q > .978) map[i] = ROCK; }
    else if (r === 3) { if (q < .03) map[i] = TREE; else if (q > .984) map[i] = ROCK; }
    else if (r === 5) { if (q < .03 + .3 * Math.max(0, n - .55)) map[i] = TREE; else if (q > .982) map[i] = ROCK; }
    else if (r === 6) { if (q < .06 + .3 * Math.max(0, n - .5)) map[i] = TREE; else if (q > .99) map[i] = ROCK; }
  }
  const clearDisk = (cx, cy, rad, keepWalls) => { for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
    if (!inb(x, y) || (x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue; const i = I(x, y), t = map[i];
    if (t === TREE || t === ROCK || t === GRAVE || (!keepWalls && (t === CLIFF || t === WATER || t === LAVA))) map[i] = GROUND; } };
  const wallRect = (x0, y0, w, h, broken, doorSide) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (!inb(x, y)) continue; const i = I(x, y), edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      if (!edge) { map[i] = RFLOOR; continue; }
      const mx = x0 + (w >> 1), my = y0 + (h >> 1);
      const isDoor = (doorSide.includes('s') && y === y0 + h - 1 && Math.abs(x - mx) <= 1) || (doorSide.includes('n') && y === y0 && Math.abs(x - mx) <= 1) ||
        (doorSide.includes('w') && x === x0 && Math.abs(y - my) <= 1) || (doorSide.includes('e') && x === x0 + w - 1 && Math.abs(y - my) <= 1);
      map[i] = isDoor || R() < broken ? RFLOOR : RWALL;
    } };
  // 殘破村落
  clearDisk(88, 150, 15, true);
  for (const [ox, oy, w, h] of [[-11,-8,7,6],[2,-9,8,6],[-10,4,7,5],[4,4,8,6],[14,-3,6,5]]) {
    wallRect(88 + ox, 150 + oy, w, h, .2, 's');
    if (R() < .7) { const x = 88 + ox + 1 + Math.floor(R() * (w - 2)), y = 150 + oy + 1; if (map[I(x, y)] === RFLOOR) map[I(x, y)] = CRATE; }
  }
  // 沉沒遺跡
  clearDisk(80, 40, 18, true);
  wallRect(66, 30, 28, 20, .28, 'nsew');
  for (let x = 70; x <= 90; x += 4) { for (const y of [34, 45]) map[I(x, y)] = PILLAR; }
  wallRect(75, 36, 10, 8, .12, 's');
  // 骸骨墓地
  clearDisk(35, 30, 9, true);
  for (let y = 23; y <= 37; y += 3) for (let x = 28; x <= 42; x += 3) if (((x - 35) ** 2 + (y - 30) ** 2) < 64 && R() < .75) map[I(x, y)] = GRAVE;
  // 古樹空地
  clearDisk(205, 165, 10, false);
  map[I(205, 165)] = BIGT; map[I(206, 165)] = BIGT; map[I(205, 164)] = BIGT; map[I(206, 164)] = BIGT;
  // 區域 boss 的場地：清空一圈
  for (const d of Object.values(RBDEF)) clearDisk(d.tx, d.ty, Math.ceil(d.tr) + 1, false);
  // 蘑菇谷
  for (let y = 109; y <= 131; y++) for (let x = 154; x <= 176; x++) if (map[I(x, y)] === TREE && ((x - 165) ** 2 + (y - 120) ** 2) < 121 && R() < .7) map[I(x, y)] = GROUND;
  // 道路
  const setRoad = (x, y) => { if (!inb(x, y)) return; const i = I(x, y), t = map[i]; if (t === BIGT) return;
    if (t === WATER || t === LAVA) map[i] = BRIDGE; else if (t === RWALL || t === PILLAR || t === CRATE) map[i] = RFLOOR; else if (t !== BRIDGE && t !== RFLOOR) map[i] = ROAD; };
  ROADS.forEach((pts, k) => { for (let s = 0; s < pts.length - 1; s++) {
    const [x0, y0] = pts[s], [x1, y1] = pts[s + 1], L = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d <= L; d += .5) { const t = d / L, nx = -(y1 - y0) / L, ny = (x1 - x0) / L, w = Math.sin((d + k * 13 + s * 7) * .17) * 1.5 * Math.min(1, d / 4, (L - d) / 4);
      const x = Math.round(x0 + (x1 - x0) * t + nx * w), y = Math.round(y0 + (y1 - y0) * t + ny * w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) setRoad(x + dx, y + dy); } } });
  // 城鎮：清出一塊地 → 廣場 + 十字街 → 一圈房子 → 廣場四角的火盆
  HOUSES.length = 0;
  for (const T of TOWNS) { const { tx: cx, ty: cy } = T;
    clearDisk(cx, cy, T.r, false);
    for (let y = cy - T.r; y <= cy + T.r; y++) for (let x = cx - T.r; x <= cx + T.r; x++) { if (!inb(x, y)) continue; const d = Math.hypot(x - cx, y - cy);
      if (d <= T.r && (map[I(x, y)] === CLIFF || map[I(x, y)] === WATER)) map[I(x, y)] = GROUND;
      if (d < 4.6 || (Math.abs(y - cy) <= 1 && Math.abs(x - cx) < T.r - 1) || (Math.abs(x - cx) <= 1 && Math.abs(y - cy) < T.r - 1)) map[I(x, y)] = ROAD; }
    const LAY = [[-10, -8, 4, 4], [-5, -11, 4, 4], [3, -10, 5, 4], [-10, 3, 4, 4], [4, 3, 5, 4], [-5, 6, 3, 3], [9, -4, 3, 3]];
    LAY.forEach(([dx, dy, w, h], k) => { const x0 = cx + dx, y0 = cy + dy;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) map[I(x, y)] = HOUSE;
      const door = I(x0 + (w >> 1), y0 + h); if (!WALKABLE(map[door])) map[door] = GROUND;   // 門口一定走得到
      HOUSES.push({ tx: x0, ty: y0, w, h, roof: (k * 3 + (T.snow ? 1 : 0)) % 4, snow: T.snow, smith: k === 4 }); });
    for (const [bx, by] of [[-3, -3], [3, -3], [-3, 4], [3, 4]]) braziers.push({ x: (cx + bx) * TS + 8, y: (cy + by) * TS + 12 });
  }
  // 狼王巢穴
  for (let y = ARENA.y0 - 2; y <= ARENA.y1 + 2; y++) for (let x = ARENA.x0 - 2; x <= ARENA.x1 + 2; x++) {
    const i = I(x, y), inside = x >= ARENA.x0 && x <= ARENA.x1 && y >= ARENA.y0 && y <= ARENA.y1;
    if (inside) { reg[i] = 4; const edge = x === ARENA.x0 || x === ARENA.x1 || y === ARENA.y0 || y === ARENA.y1; map[i] = edge ? RWALL : RFLOOR; }
    else if (map[i] !== ROAD) map[i] = GROUND;
  }
  for (const [px, py] of [[185,106],[195,106],[185,115],[195,115]]) map[I(px, py)] = PILLAR;
  for (const x of DOOR) map[I(x, ARENA.y1)] = FOG;
  for (const [bx, by] of [[183,104],[197,104],[183,117],[197,117]]) braziers.push({ x:bx * TS + 8, y:by * TS + 12 });
  stampEntrances(inb); addDungeonSpawns();                              // 地城：野外入口的小山 + 海上的地城區塊（裡面的怪也在這裡放）
  for (const c of CAMPS) clearDisk(c.tx, c.ty, 3, false);
  for (let y = 3; y < MH - 3; y++) for (let x = 3; x < MW - 3; x++) {
    const i = I(x, y);
    if (map[i] === RWALL && map[i + MW] === RFLOOR && reg[i] !== 4 && R() < .25 && !torches.some(t => Math.abs(t.tx - x) + Math.abs(t.ty - y) < 6)) torches.push({ tx:x, ty:y, x:x * TS + 8, y:y * TS + 8, ph:R() * 10 });
    if (reg[i] === 1 && map[i] === GROUND) {
      const inValley = ((x - 165) ** 2 + (y - 120) ** 2) < 121;
      if (R() < (inValley ? .06 : .006) && !glows.some(t => Math.abs(t.tx - x) + Math.abs(t.ty - y) < (inValley ? 2 : 6))) glows.push({ tx:x, ty:y, x:x * TS + 4 + R() * 8, y:y * TS + 6 + R() * 6, ph:R() * 10 });
    }
  }
  // 可到達範圍
  const reach = new Uint8Array(MW * MH), q = [I(CAMPS[0].tx, CAMPS[0].ty + 1)]; reach[q[0]] = 1;
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % MW, y = (i / MW) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const j = I(x + dx, y + dy); if (!reach[j] && WALKABLE(map[j])) { reach[j] = 1; q.push(j); } } }
  reachable = reach;                                                   // main.ts 會用它來放寶箱
  // 怪物
  const R2 = mulberry32(99);
  const near = (tx, ty, d) => { for (const s of spawns) if (Math.abs(s.tx - tx) < d && Math.abs(s.ty - ty) < d && Math.hypot(s.tx - tx, s.ty - ty) < d) return true; return false; };
  const ok = (tx, ty) => { const i = I(tx, ty); if (!reach[i] || reg[i] === 4 || !(map[i] === GROUND || map[i] === ROAD || map[i] === RFLOOR)) return false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) if (!WALKABLE(map[I(tx + dx, ty + dy)])) return false;
    if (tx >= ARENA.x0 - 3 && tx <= ARENA.x1 + 3 && ty >= ARENA.y0 - 3 && ty <= ARENA.y1 + 3) return false;
    for (const c of CAMPS) if (Math.hypot(c.tx - tx, c.ty - ty) < 10) return false;
    for (const T of TOWNS) if (Math.hypot(T.tx - tx, T.ty - ty) < T.r + 7) return false;   // 鎮上和鎮外一圈沒有怪
    for (const d of Object.values(RBDEF)) if (Math.hypot(d.tx - tx, d.ty - ty) < d.tr + 5) return false; return true; };
  const TABLE = [
    { n:240, lv:[1,5], anchor:[118,356], span:230, kinds:lv => lv <= 2 ? 'slime' : lv >= 4 ? (R2() < .75 ? 'wolf' : 'slime') : (R2() < .5 ? 'wolf' : 'slime') },   // span：離起點多遠就到最高等級
    { n:88, lv:[5,10], anchor:[125,140], kinds:() => { const q = R2(); return q < .35 ? 'shroom' : q < .7 ? 'treant' : 'wolfF'; } },
    { n:80, lv:[10,15], anchor:[64,96], kinds:() => R2() < .6 ? 'skel' : 'golem' },
    { n:74, lv:[15,20], anchor:[200,92], kinds:() => { const q = R2(); return q < .3 ? 'slimeM' : q < .7 ? 'skelE' : 'golemL'; } },
    null,
    { n:85, lv:[20,25], anchor:[262,72], kinds:() => { const q = R2(); return q < .4 ? 'wolfS' : q < .65 ? 'slimeI' : 'golemI'; } },
    { n:85, lv:[25,30], anchor:[292,112], kinds:() => { const q = R2(); return q < .35 ? 'skelS' : q < .65 ? 'shroomP' : 'treantS'; } },
  ];
  TABLE.forEach((T, r) => { if (!T) return;
    let n = 0, tries = 0;
    while (n < T.n && tries++ < 30000) {
      const tx = 3 + Math.floor(R2() * (MW - 6)), ty = 3 + Math.floor(R2() * (MH - 6));
      if (reg[I(tx, ty)] !== r || !ok(tx, ty) || near(tx, ty, 4)) continue;
      const d = Math.hypot(tx - T.anchor[0], ty - T.anchor[1]);
      const lv = clamp(T.lv[0] + Math.round(Math.min(1, d / ((T as any).span || 95)) * (T.lv[1] - T.lv[0])) + (R2() < .3 ? 1 : 0), T.lv[0], T.lv[1]);
      const kind = T.kinds(lv);
      spawns.push({ tx, ty, x:tx * TS + 8, y:ty * TS + 8, kind, lv, alive:false, timer:0 }); n++;
      if (R2() < .42) for (let k = 0; k < 1 + Math.floor(R2() * 2); k++) { const ax = tx + Math.floor(R2() * 5) - 2, ay = ty + Math.floor(R2() * 5) - 2;
        if ((ax !== tx || ay !== ty) && ok(ax, ay)) spawns.push({ tx:ax, ty:ay, x:ax * TS + 8, y:ay * TS + 8, kind, lv, alive:false, timer:0 }); }
    }
  });
  for (const [kind, lv, tx, ty, name] of [['slime',3,64,316,'湖畔巨史萊姆'],['wolf',5,206,300,'風車丘狼首'],['wolf',4,70,256,'落石坡狼王'],['wolf',6,92,150,'野狼頭目'],['treant',11,205,169,'古樹守衛'],['skel',13,35,33,'守墓人'],['golem',16,80,40,'遺跡守衛'],['golemL',21,210,40,'熔岩巨像'],['wolfS',24,300,84,'冰原狼首'],['golemI',25,288,30,'凍土守衛'],['treantS',29,266,160,'沉木古妖'],['skelS',28,318,132,'沼底亡將']] as const) {
    let x = tx, y = ty; for (let k = 0; k < 40 && !WALKABLE(map[I(x, y)]); k++) { x = tx + Math.floor(R2() * 7) - 3; y = ty + Math.floor(R2() * 7) - 3; }
    spawns.push({ tx:x, ty:y, x:x * TS + 8, y:y * TS + 8, kind, lv, elite:true, ename:name, alive:false, timer:0 });
  }
}
export const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? CLIFF : map[ty * MW + tx];
export const solidT = t => SOLID.has(t) || (t === FOG && G.fogLocked);

/* ---------- tiles ---------- */
const GP = [
  { a:'#5a9a46', b:'#538f40', t:'#6fb055', d:'#437a35', road:'#a9845a', road2:'#bb9668', roadE:'#8a6a45', top:'#467a36', topE:'#62a04c', face:'#7a7266', face2:'#68615a', faceD:'#4a453e' },
  { a:'#2f5a3e', b:'#2b5439', t:'#3d7050', d:'#22452f', road:'#7a6044', road2:'#8a6e50', roadE:'#5a4632', top:'#24452f', topE:'#3a6a48', face:'#5e6a5c', face2:'#4e5a4c', faceD:'#323a30' },
  { a:'#9a8a6a', b:'#938365', t:'#ae9e7e', d:'#7e6e52', road:'#7e776c', road2:'#8e877a', roadE:'#5e584e', top:'#857654', topE:'#a8987a', face:'#8a7a5a', face2:'#76664a', faceD:'#4e4230' },
  { a:'#3a2b2d', b:'#352729', t:'#4a3638', d:'#2a1d1f', road:'#4e4448', road2:'#5a5054', roadE:'#2e2628', top:'#2a1e20', topE:'#4a3436', face:'#4a3a3a', face2:'#3e3030', faceD:'#241a1a' },
  { a:'#2e2934', b:'#332d3b', t:'#3d3747', d:'#201c26', road:'#3a3444', road2:'#443d4f', roadE:'#28232f', top:'#120d13', topE:'#3c2c39', face:'#523c49', face2:'#45313d', faceD:'#2b1f28' },
];
export const ICEW = ['#3a5a80','#4a6e94','#5a82a8','#6a96bc','#8ab4d4','#b8d8ee','#f0f8ff'], MUDW = ['#0a1c1c','#0e2828','#133434','#18423f','#22544e','#3a7868','#8cc8b0'];   // 沼澤水：偏青色，跟橄欖綠的地面分得開
export const RUIN = [
  { fl:'#6a6678', fl2:'#706c80', gr:'#4e4a5e', hi:'#7c788e', wf:'#76728a', wf2:'#68647c', mo:'#46425a', cap:'#9a96b0', top:'#2e2b38', edge:'#55516a', moss:'#5a8a46' },
  { fl:'#4a5250', fl2:'#4e5856', gr:'#343c3a', hi:'#5a6462', wf:'#56605c', wf2:'#4a5450', mo:'#2e3634', cap:'#76827c', top:'#1a201e', edge:'#3a4440', moss:'#3e7050' },
  { fl:'#a89470', fl2:'#b09c78', gr:'#7e6c4e', hi:'#c0ac88', wf:'#b8a078', wf2:'#a68e68', mo:'#6e5c40', cap:'#d4bc94', top:'#5a4a34', edge:'#8a7454', moss:null },
  { fl:'#3e3236', fl2:'#44383c', gr:'#2a2024', hi:'#4e4044', wf:'#4e3a3c', wf2:'#433133', mo:'#2a1e20', cap:'#6a5254', top:'#1a1214', edge:'#3a2a2c', moss:null },
  { fl:'#34303f', fl2:'#38344a', gr:'#25222d', hi:'#413c51', wf:'#4a4560', wf2:'#3e3953', mo:'#2a2637', cap:'#6c6689', top:'#14111b', edge:'#3b3651', moss:null },
  { fl:'#8a96aa', fl2:'#929eb2', gr:'#5e6a80', hi:'#b4c0d4', wf:'#9aa6bc', wf2:'#8a96ac', mo:'#5a6478', cap:'#e8f0fa', top:'#6a7890', edge:'#7a869c', moss:null },
  { fl:'#3a4236', fl2:'#40483a', gr:'#262c22', hi:'#4e5844', wf:'#4a5440', wf2:'#404a38', mo:'#262c22', cap:'#5e6a52', top:'#161a12', edge:'#343c2e', moss:'#4a6a2e' },
  { fl:'#3a3640', fl2:'#403b48', gr:'#28252e', hi:'#4c4756', wf:'#4a4454', wf2:'#3e3948', mo:'#26222e', cap:'#6a6478', top:'#16131c', edge:'#34303e', moss:'#3e5a34' },
];
export const isWallT = t => t === CLIFF || t === RWALL;
/* ---------- tiles：以 3 倍細像素烘焙（每格 48×48），跟角色同一個像素密度 ---------- */
export const AR = 3, TA = TS * AR;
function tileNoise(P, cell, seed) {                                   // 可無縫重複的平滑雜訊
  const n = P / cell, R = mulberry32(seed), lat = new Float32Array(n * n); for (let i = 0; i < n * n; i++) lat[i] = R();
  const out = new Float32Array(P * P);
  for (let y = 0; y < P; y++) { const gy = y / cell, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy), Y0 = y0 % n, Y1 = (y0 + 1) % n;
    for (let x = 0; x < P; x++) { const gx = x / cell, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx), X0 = x0 % n, X1 = (x0 + 1) % n;
      const a = lat[Y0 * n + X0], b = lat[Y0 * n + X1], c = lat[Y1 * n + X0], d = lat[Y1 * n + X1], t = a + (b - a) * sx;
      out[y * P + x] = t + (c + (d - c) * sx - t) * sy; } }
  return { P, out };
}
export const NZ0 = tileNoise(960, 60, 5), NZ1 = tileNoise(192, 12, 7), NZ2 = tileNoise(160, 5, 9);
export const nz = (N, x, y) => { const P = N.P; x = Math.floor(x) % P; y = Math.floor(y) % P; if (x < 0) x += P; if (y < 0) y += P; return N.out[y * P + x]; };
export const hexU = h => { const v = parseInt(h.slice(1), 16); return (0xFF000000 | ((v & 255) << 16) | (v & 0xFF00) | (v >> 16)) >>> 0; };
export const UL = a => a.map(hexU);
export const SCU = [
  { g:UL(['#2c5a28','#3b7432','#4a8c3e','#5aa04a','#72b85c','#8ccc70']), road:UL(['#6a4c32','#86643f','#a07c52','#b48e62','#c6a274']),
    face:UL(['#3a362e','#555046','#6e685c','#878072','#a39a8a']), lip:UL(['#24481f','#3b7432','#5aa04a','#8ccc70']), top:UL(['#25451f','#2e5226','#38602d']), bank:UL(['#33261a','#4a3a28','#5e4a34']) },
  { g:UL(['#15291d','#1c3626','#234430','#2b523a','#356346','#427552']), road:UL(['#33251a','#463424','#584430','#6a533c','#7a634a']),
    face:UL(['#20271f','#2e382e','#404c40','#526052','#667666']), lip:UL(['#10221a','#1c3626','#2b523a','#427552']), top:UL(['#11241a','#162c20','#1c3426']), bank:UL(['#21180f','#30241a','#3e3022']) },
  { g:UL(['#6a5a40','#7e6c50','#8f7e60','#a08f70','#b2a282','#c6b696']), road:UL(['#8a7656','#a89270','#bca684','#ccb894','#dccaa6']),
    face:UL(['#4a3e2c','#62533c','#7a6a4e','#928262','#aa9a78']), lip:UL(['#6a5a40','#8f7e60','#b2a282','#d0c0a0']), top:UL(['#5a4c36','#665640','#72624a']), bank:UL(['#4e4030','#64543e','#7a6a50']) },
  { g:UL(['#1c1214','#261a1c','#302224','#3a2b2d','#46353a','#544246']), road:UL(['#221c1e','#36302e','#46403e','#54504c','#64605a']),
    face:UL(['#1a1214','#2a1e20','#3a2c2e','#4a3a3c','#5c4a4c']), lip:UL(['#1c1214','#302224','#46353a','#6a5054']), top:UL(['#160e10','#1c1214','#22181a']), bank:UL(['#140c0c','#1e1414','#2a1c1a']) },
  { g:UL(['#1a1620','#221d2a','#2a2533','#332d3e','#3d3649','#474056']), road:UL(['#231f2b','#2e2938','#3a3446','#463f54','#524a62']),
    face:UL(['#241a22','#33242f','#43303d','#543d4c','#664c5c']), lip:UL(['#1a141e','#2a2533','#3d3649','#5a5068']), top:UL(['#0e0a10','#120d14','#161118']), bank:UL(['#16121a','#1e1824','#262030']) },
  { g:UL(['#8494ac','#a2b2c8','#bccadc','#d0dcea','#e2eaf4','#f4f8ff']), road:UL(['#56607a','#6e7890','#8690a6','#9ca6ba','#b2bccc']),
    face:UL(['#2a3244','#404a62','#58647e','#727e9a','#8e9ab4']), lip:UL(['#8a9ab0','#c4d2e2','#e8f0f8','#ffffff']), top:UL(['#5e6a82','#68748c','#727e96']), bank:UL(['#6a7890','#8492aa','#a0aec4']) },
  { g:UL(['#161c12','#1c2416','#232e1c','#2b3822','#344428','#3e5030']), road:UL(['#251f16','#352d20','#453b2a','#544934','#63573e']),
    face:UL(['#14161a','#262a30','#3a4048','#505860','#68727a']), lip:UL(['#121810','#232e1c','#344428','#506838']), top:UL(['#0e120a','#12160e','#161c12']), bank:UL(['#1a160e','#262014','#322a1c']) },
  { g:UL(['#1c1a18','#24211e','#2c2824','#35302a','#3f3931','#4a4339']), road:UL(['#2a2622','#36302a','#423a32','#4e453b','#5a5044']),   // 7 地城：深色岩洞
    face:UL(['#16141a','#2a2630','#3e3946','#544e5e','#6c6678']), lip:UL(['#1a2418','#2a3a24','#3e5634','#5a7a48']), top:UL(['#121014','#16131a','#1a1720']), bank:UL(['#141210','#1e1a16','#28221c']) },
];
export const RUINU = RUIN.map(u => { const o: Record<string, number> = {}; for (const k in u) o[k] = u[k] ? hexU(u[k]) : 0; return o; });
export const WATU = UL(['#1a3664','#22467e','#2c5892','#3566a2','#4a80ba','#7cb0dc','#d4ecff']);
export const LAVU = UL(['#3a0e06','#7a2410','#b03c18','#d8582a','#f07a32','#f8a840','#ffd27a','#fff4c0']);
export const CRUSTU = UL(['#160c0c','#24140f','#3a1e14']);
export const WOODU = UL(['#2e1c0e','#4a3018','#6a4626','#86603a','#a07a4c','#b8925e']);
export const CARPU = UL(['#3e1018','#561923','#6a1f2a','#8a2a36','#b08a3a','#e0c060']);
export const isRoadish = v => v === ROAD || v === BRIDGE || v === RFLOOR || v === FOG;
export const isWaterish = v => v === WATER || v === BRIDGE;
export const isLavaish = v => v === LAVA || v === BRIDGE;
export function groundK(r, ax, ay) {                                         // 大片柔和色塊 + 交界處棋盤格混色 + 短草葉
  const big = nz(NZ0, ax, ay), mid = .5 * nz(NZ1, ax, ay) + .5 * nz(NZ1, ax * .83 + 97, ay * .83 + 41), chk = (ax + ay) & 1;   // 兩種尺度疊在一起，花紋就不會明顯重複
  let k = big > .6 ? 3 : big < .4 ? 1 : 2;
  if (Math.abs(big - .6) < .018 || Math.abs(big - .4) < .018) k = (big > .5 ? 2 : 1) + chk;
  if (mid > .69) k++; else if (mid < .31) k--;
  if (r < 2) { const h = hash2(ax, (ay / 3) | 0); if (h < .045) k++; else if (h > .985) k--; }
  else if (r === 2) { if (Math.abs(nz(NZ2, ax * .5, ay * 2.2) - .5) < .025) k++; else if (hash2(ax, ay) > .992) k -= 2; }
  else { const h = hash2(ax, ay); if (h < .012) k++; else if (h > .99) k -= 2; }
  return k < 0 ? 0 : k > 5 ? 5 : k;
}
