/* ================= 地城的格局：每座地城自己亂數排一次（同一個種子 → 每次都一樣） =================
   地城切成一格一格（一般地城 5×5、地底遺跡 6×6，一格 20×16 格地圖），每一格最多一個房間，最上面多一條放 Boss 大廳。
   1. 主路：從最下面一排的入口，彎彎曲曲走到最上面一排（Boss 大廳正下方）——不走直線，走過的格子不重複
   2. 主路上：入口房（營火）→ 陷阱房（解謎區一）→ 中途營火 → … → 守護者前營火 → Boss 大廳前的謎題房（解謎區三）→ Boss 大廳
   3. 寶庫：主路後半段岔出去一間謎題房（解謎區二），解開 → 鐵柵門升起，後面是放金箱的寶物房
   4. 岔路：幾條 1～3 間的死路，最裡面放銀箱（地底遺跡的第一條是金箱）；其中一間可能有隱藏的牆
   房間之間是 3 格寬的直通道（洞窟會在中段長出凹凸）。鐵柵門一定擋在「上下方向」的通道上（門是一排橫的鐵條）。 */
import { CLIFF, GROUND, LAVA, MW, PILLAR, RFLOOR, RWALL, TS, WATER, BRIDGE, glows, map } from './map';
import type { Dungeon } from './dungeons';

export interface LDoor { x: number; y: number; side: 0 | 1 | 2 | 3; to: number }   // 門 = 房間外面第一格（通道的中線）；side：0 東、1 南、2 西、3 北；to = 通到哪間（-1 = Boss 大廳）
export interface LRoom { x: number; y: number; rx: number; ry: number; role: Role; doors: LDoor[]; ci: number; cj: number }
export type Role = 'entry' | 'path' | 'camp' | 'trap' | 'boss' | 'vault' | 'treasure' | 'branch' | 'end' | 'hall';
export interface Station { room: LRoom; inD: LDoor; outD: LDoor }                 // 一個解謎區：房間 + 從哪裡進來 + 從哪裡出去（鐵柵門在出口）
export interface Layout {
  rooms: LRoom[]; hall: LRoom; path: number[]; camps: number[]; ends: number[]; treasure: number;
  trap: Station; vault: Station; boss: Station; corr: Set<number>;
}
export const CW = 20, CH = 16, HB = 18;                                      // 一格多大、上面放 Boss 大廳那一條多高
export const gridOf = (d: Dungeon) => d.style === 'ruin' ? { C: 6, Rg: 6 } : { C: 5, Rg: 5 };
export const slotSize = (d: Dungeon) => { const { C, Rg } = gridOf(d); return { w: 4 + C * CW, h: HB + Rg * CH + 2 }; };
const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];                              // 跟 side 的編號一樣：東南西北

/* ---- 1. 在格子上排房間（只決定哪一格是什麼，還沒挖地圖）---- */
interface Plan { C: number; Rg: number; path: number[][]; t: number; camps: number[]; vault: number[][]; pa: number; branches: { at: number; cells: number[][] }[] }
function shuffle<T>(a: T[], R: () => number) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function findPath(C: number, Rg: number, s: number[], g: number[], minL: number, maxL: number, R: () => number) {
  const seen = new Set<number>(), path: number[][] = []; let budget = 40000;
  const dfs = (i: number, j: number): boolean => {
    if (--budget < 0) return false; path.push([i, j]); seen.add(j * C + i);
    if (i === g[0] && j === g[1]) { if (path.length >= minL) return true; }
    else if (path.length < maxL) for (const [di, dj] of shuffle(D4, R)) { const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= C || b >= Rg || seen.has(b * C + a) || path.length + 1 + Math.abs(a - g[0]) + Math.abs(b - g[1]) > maxL) continue;
      if (dfs(a, b)) return true; }
    path.pop(); seen.delete(j * C + i); return false; };
  return dfs(s[0], s[1]) ? path : null;
}
function plan(d: Dungeon, R: () => number, vertTrap: boolean): Plan {
  const { C, Rg } = gridOf(d), ruin = d.style === 'ruin', minL = ruin ? 13 : 10, maxL = ruin ? 19 : 15;
  for (let attempt = 0; attempt < 400; attempt++) {
    const e = Math.floor(R() * C), far = [...Array(C).keys()].filter(c => Math.abs(c - e) >= 2), h = far.length ? far[Math.floor(R() * far.length)] : (e + 2) % C;
    const path = findPath(C, Rg, [e, Rg - 1], [h, 0], minL, maxL, R); if (!path) continue;
    const L = path.length, used = new Set(path.map(([i, j]) => j * C + i)), free = (i: number, j: number) => i >= 0 && j >= 0 && i < C && j < Rg && !used.has(j * C + i);
    // 陷阱房：主路前段。冷卻熔岩 / 彈跳蘑菇要「從下面進來、從上面出去」（或反過來）
    const tc = [] as number[]; for (let k = 2; k <= Math.floor(L * .5); k++) { const [a, b] = [path[k - 1], path[k + 1]], [i, j] = path[k];
      if (!vertTrap || (a[0] === i && b[0] === i && Math.abs(a[1] - b[1]) === 2)) tc.push(k); }
    if (!tc.length) continue; const t = tc[Math.floor(R() * tc.length)];
    let mid = Math.round((t + L - 2) / 2); if (mid === t) mid++; if (mid >= L - 2) continue;
    const camps = [0, mid, L - 2];
    // 寶庫：主路後半段（陷阱房之後）的某一間，旁邊空著一格（謎題房），謎題房的正上 / 正下方再空一格（寶物房）
    const vc = [] as number[][]; for (let k = t + 1; k <= L - 2; k++) { const [i, j] = path[k];
      for (const [di, dj] of D4) { const a = i + di, b = j + dj; if (!free(a, b)) continue;
        for (const s of [-1, 1]) if (free(a, b + s) && !(a === i && b + s === j)) vc.push([k, a, b, a, b + s]); } }
    if (!vc.length) continue; const [pa, va, vb, ta, tb] = vc[Math.floor(R() * vc.length)];
    used.add(vb * C + va); used.add(tb * C + ta);
    // 岔路（死路，最裡面放寶箱）
    const branches: { at: number; cells: number[][] }[] = [], want = ruin ? 5 : 3;
    for (let n = 0, tries = 0; n < want && tries < 60; tries++) { const k = 1 + Math.floor(R() * (L - 2)); if (k === t || k === L - 1) continue;
      let [ci, cj] = path[k]; const cells: number[][] = [], len = 1 + Math.floor(R() * 3);
      for (let s = 0; s < len; s++) { const opts = D4.map(([di, dj]) => [ci + di, cj + dj]).filter(([a, b]) => free(a, b)); if (!opts.length) break;
        const [a, b] = opts[Math.floor(R() * opts.length)]; cells.push([a, b]); used.add(b * C + a); ci = a; cj = b; }
      if (cells.length) { branches.push({ at: k, cells }); n++; } }
    if (branches.length < (ruin ? 3 : 2)) continue;
    return { C, Rg, path, t, camps, vault: [[va, vb], [ta, tb]], pa, branches };
  }
  throw new Error('地城格局排不出來：' + d.id);
}

/* ---- 2. 照計畫挖地圖 ---- */
export function carveLayout(d: Dungeon, R: () => number, vertTrap: boolean): Layout {
  const P = plan(d, R, vertTrap), X0 = d.x0, Y0 = d.y0, W = d.w, H = d.h, ruin = d.style === 'ruin', built = d.style === 'crypt' || ruin;
  const wall = built ? RWALL : CLIFF, floor = built ? RFLOOR : GROUND;
  for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) map[y * MW + x] = wall;
  const set = (x: number, y: number, t: number) => { if (x > X0 && y > Y0 && x < X0 + W - 1 && y < Y0 + H - 1) map[y * MW + x] = t; };
  const j1 = () => Math.floor(R() * 3) - 1;
  const rooms: LRoom[] = [], at = new Map<number, number>();
  const mk = (ci: number, cj: number, role: Role, rx: number, ry: number, jit = true) => {
    const r: LRoom = { x: X0 + 2 + ci * CW + CW / 2 + (jit ? j1() : 0), y: Y0 + HB + cj * CH + CH / 2 + (jit ? j1() : 0), rx, ry, role, doors: [], ci, cj };
    at.set(cj * P.C + ci, rooms.length); rooms.push(r); return rooms.length - 1; };
  const big = ruin ? 8 : 7, L = P.path.length;
  const pathIdx = P.path.map(([i, j], k) => {
    const role: Role = k === 0 ? 'entry' : k === P.t ? 'trap' : k === L - 1 ? 'boss' : P.camps.includes(k) ? 'camp' : 'path';
    return role === 'trap' || role === 'boss' ? mk(i, j, role, big, 5, false) : role === 'entry' || role === 'camp' ? mk(i, j, role, 5, 4, role !== 'entry')
      : mk(i, j, role, 4 + Math.floor(R() * 3), 3 + Math.floor(R() * 2)); });
  const vIdx = mk(P.vault[0][0], P.vault[0][1], 'vault', big, 5, false), tIdx = mk(P.vault[1][0], P.vault[1][1], 'treasure', 4, 3);
  const ends: number[] = [], edges: number[][] = [];
  for (let k = 1; k < L; k++) edges.push([pathIdx[k - 1], pathIdx[k]]);
  edges.push([pathIdx[P.pa], vIdx], [vIdx, tIdx]);
  for (const b of P.branches) { let prev = pathIdx[b.at]; b.cells.forEach(([i, j], s) => { const last = s === b.cells.length - 1;
    const k = mk(i, j, last ? 'end' : 'branch', last ? 4 : 3 + Math.floor(R() * 3), last ? 3 : 3 + Math.floor(R() * 2)); edges.push([prev, k]); prev = k; if (last) ends.push(k); }); }
  const bossR = rooms[pathIdx[L - 1]], hrx = ruin ? 13 : 11;
  const hall: LRoom = { x: Math.max(X0 + hrx + 2, Math.min(X0 + W - hrx - 3, bossR.x)), y: Y0 + 2 + 7, rx: hrx, ry: 7, role: 'hall', doors: [], ci: bossR.ci, cj: -1 };
  // 房間
  const inRect = (r: LRoom, x: number, y: number, pad = 0) => Math.abs(x - r.x) <= r.rx + pad && Math.abs(y - r.y) <= r.ry + pad;
  for (const r of [...rooms, hall]) for (let y = r.y - r.ry - 1; y <= r.y + r.ry + 1; y++) for (let x = r.x - r.rx - 1; x <= r.x + r.rx + 1; x++) {
    if (built || r.role === 'trap' || r.role === 'vault' || r.role === 'boss') { if (inRect(r, x, y)) set(x, y, floor); }       // 謎題房一定是方的（機關照方形排）
    else if (((x - r.x) / (r.rx + .5)) ** 2 + ((y - r.y) / (r.ry + .5)) ** 2 < 1 + (R() - .5) * .35) set(x, y, floor); }
  // 通道：相鄰兩格之間一條 3 格寬的直通道，從房間中線走到房間中線
  const corr = new Set<number>(), clampI = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const link = (ai: number, bi: number) => { const a = ai < 0 ? hall : rooms[ai], b = bi < 0 ? hall : rooms[bi];
    if (a.cj === b.cj) { const [l, r] = a.x < b.x ? [a, b] : [b, a], y = clampI(Math.round((a.y + b.y) / 2), Math.max(a.y - a.ry, b.y - b.ry) + 1, Math.min(a.y + a.ry, b.y + b.ry) - 1);
      for (let x = l.x; x <= r.x; x++) for (let o = -1; o <= 1; o++) { set(x, y + o, floor); corr.add((y + o) * MW + x); }
      l.doors.push({ x: l.x + l.rx + 1, y, side: 0, to: l === a ? bi : ai }); r.doors.push({ x: r.x - r.rx - 1, y, side: 2, to: r === a ? bi : ai }); }
    else { const [u, w] = a.y < b.y ? [a, b] : [b, a], x = bi < 0 || ai < 0 ? bossR.x : clampI(Math.round((a.x + b.x) / 2), Math.max(a.x - a.rx, b.x - b.rx) + 1, Math.min(a.x + a.rx, b.x + b.rx) - 1);
      for (let y = u.y; y <= w.y; y++) for (let o = -1; o <= 1; o++) { set(x + o, y, floor); corr.add(y * MW + x + o); }
      u.doors.push({ x, y: u.y + u.ry + 1, side: 1, to: u === a ? bi : ai }); w.doors.push({ x, y: w.y - w.ry - 1, side: 3, to: w === a ? bi : ai }); } };
  for (const [a, b] of edges) link(a, b); link(pathIdx[L - 1], -1);
  if (!built) for (const k of [...corr]) { const x = k % MW, y = (k / MW) | 0;                     // 洞窟：通道中段長出凹凸（門口附近不動，鐵柵門才擋得住）
    if ([...rooms, hall].some(r => inRect(r, x, y, 3)) || R() > .1) continue; const [dx, dy] = D4[Math.floor(R() * 4)]; if (map[(y + dy) * MW + x + dx] === wall) set(x + dx, y + dy, floor); }
  // 柱子（古墓 / 遺跡的大房間、Boss 大廳）
  const pil = (x: number, y: number) => { if (!corr.has(y * MW + x)) set(x, y, PILLAR); };
  if (built) { for (const r of rooms) if (r.rx >= 5 && r.ry >= 4 && (r.role === 'path' || r.role === 'branch')) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pil(r.x + sx * (r.rx - 2), r.y + sy * (r.ry - 2));
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pil(hall.x + sx * (hall.rx - 2), hall.y + sy * (hall.ry - 2));
    if (ruin) for (let y = hall.y - hall.ry + 2; y <= hall.y + hall.ry - 2; y += 4) for (const dx of [-hall.rx + 1, hall.rx - 1]) pil(hall.x + dx, y); }
  // 暗河 / 熔岩河：橫過中間某一排房間（營火房、謎題房、寶物房不碰），通道經過的地方是橋；再加幾攤水
  const keep = (r: LRoom) => r.role !== 'path' && r.role !== 'branch';
  if (d.style === 'grotto' || (ruin && d.liquid)) { const liq = d.liquid === 'lava' ? LAVA : WATER;
    for (const jr of shuffle([...Array(P.Rg - 2).keys()].map(k => k + 1), R).slice(0, ruin ? 2 : 1)) { const ys = Y0 + HB + jr * CH + CH / 2 + 2;
      for (let x = X0 + 1; x < X0 + W - 1; x++) for (const y of [ys, ys + 1]) { const i = y * MW + x; if (map[i] !== floor) continue;
        const r = rooms.find(r => inRect(r, x, y, 1)); if (r && keep(r)) continue;
        if (corr.has(i)) { if (corr.has((ys - 1) * MW + x) && corr.has((ys + 2) * MW + x)) map[i] = BRIDGE; continue; }   // 直的通道過河 = 橋；橫的通道剛好壓在河上就不動
        map[i] = r && Math.abs(x - r.x) <= 1 ? BRIDGE : liq; } }
    for (const r of shuffle(rooms.filter(r => !keep(r) && r.rx >= 4), R).slice(0, ruin ? 4 : 3)) for (let k = 0; k < 2; k++) { const px = r.x + (k ? 1 : -1) * (r.rx - 2), py = r.y + j1();
      for (let y = py - 1; y <= py + 1; y++) for (let x = px - 1; x <= px + 1; x++) { const i = y * MW + x; if (map[i] === floor && !corr.has(i) && (x - px) ** 2 + (y - py) ** 2 <= 1.5) map[i] = liq; } } }
  if (!built) for (const r of rooms) for (let k = 0; k < 3; k++) { const gx = r.x + Math.round((R() - .5) * r.rx * 2), gy = r.y + Math.round((R() - .5) * r.ry * 2);   // 洞窟裡的發光蘑菇 = 光源
    if (map[gy * MW + gx] === floor) glows.push({ tx: gx, ty: gy, x: gx * TS + 4 + R() * 8, y: gy * TS + 6 + R() * 6, ph: R() * 10 }); }
  const st = (ri: number, from: number, to: number): Station => { const r = rooms[ri]; return { room: r, inD: r.doors.find(q => q.to === from), outD: r.doors.find(q => q.to === to) }; };
  return { rooms, hall, path: pathIdx, camps: P.camps.map(k => pathIdx[k]), ends, treasure: tIdx, corr,
    trap: st(pathIdx[P.t], pathIdx[P.t - 1], pathIdx[P.t + 1]), vault: st(vIdx, pathIdx[P.pa], tIdx), boss: st(pathIdx[L - 1], pathIdx[L - 2], -1) };
}
