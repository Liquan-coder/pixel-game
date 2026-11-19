/* ================= 地城（洞窟 / 古墓 / 石窟） =================
   做法：地城的「裡面」也蓋在同一張地圖上，放在東南邊的海裡（DZONE，走路到不了）。
   野外的入口（山壁上的洞口 / 石門）按 E → 傳送到裡面；裡面的上樓階梯按 E → 回到入口前面。
   這樣碰撞、怪物、燈光、寶箱、存檔都不用另外寫一套。

   每個地城：入口房 → 幾個有怪的房間（一個岔出去的小房間放銀箱）→ 最深處的守護者（精英怪）+ 金箱（固定的獨特武器）。
   守護者打倒一次就不會再復活（記在 quest 的 flags：'dgn:編號'），金箱要等守護者倒下才打得開。
   新增地城：在 DUNGEONS 加一筆（入口位置、風格、怪物、守護者、獎勵），區塊會自動往下排。 */
import { G } from '../core/state';
import { mulberry32 } from '../core/util';
import { CLIFF, GROUND, MW, PILLAR, RFLOOR, RWALL, SUBS, TREE, TS, WATER, BRIDGE, ROCK, glows, map, reg, spawns } from './map';
import type { Player } from '../types';

export const DREG = 7;                                                   // 地城的地區編號（REGIONS[7]）
export const DZONE = { x0: 266, y0: 500, x1: 636, y1: 674 };              // 地城區塊放在這裡（東南邊的海上，走路到不了，大地圖會蓋掉）：一排 7 格、3 排
export interface Dungeon {
  id: string; name: string; style: 'cave' | 'crypt' | 'grotto';
  ent: [number, number];                                                  // 野外入口：山壁正面那一格（玩家站在它下面一格）
  lv: number; kinds: string[];
  boss: { kind: string; lv: number; name: string };
  uq: string;                                                             // 最深處金箱裡的獨特武器
  lore: { title: string; text: string };                                  // 地城裡的石碑
  // genWorld 算出來的：
  x0?: number; y0?: number; inX?: number; inY?: number; exX?: number; exY?: number;
}
export const DUNGEONS: Dungeon[] = [
  { id: 'moss', name: '苔石洞窟', style: 'cave', ent: [66, 462], lv: 3, kinds: ['slime', 'wolf'], boss: { kind: 'slime', lv: 6, name: '洞窟史萊姆王' }, uq: 'mossfang',
    lore: { title: '洞窟深處的刻痕', text: '「牙齒長了苔的那隻狼，是第一個聞到星星味道的。」' } },
  { id: 'barrow', name: '無名古墓', style: 'crypt', ent: [172, 576], lv: 4, kinds: ['skel', 'skel', 'wolf'], boss: { kind: 'skel', lv: 7, name: '古墓守衛' }, uq: 'barrowblade',
    lore: { title: '古墓的墓誌銘', text: '「這裡葬著一位無名的劍士。他守的不是墓，是一盞永遠不能熄的燈。」' } },
  { id: 'grotto', name: '潮音石窟', style: 'grotto', ent: [226, 484], lv: 5, kinds: ['shroom', 'slime', 'wolf'], boss: { kind: 'shroom', lv: 7, name: '潮音毒菇' }, uq: 'tidespear',
    lore: { title: '石窟裡的貝殼', text: '「把耳朵貼上去，能聽見海浪——還有一首很久以前的搖籃曲。」' } },
];
const SLOT_W = 50, SLOT_H = 54;
DUNGEONS.forEach((d, k) => { d.x0 = DZONE.x0 + (k % 7) * (SLOT_W + 3); d.y0 = DZONE.y0 + Math.floor(k / 7) * (SLOT_H + 3); SUBS.push({ name: d.name, x: d.x0 + SLOT_W / 2, y: d.y0 + SLOT_H / 2, r: 27 }); });   // r 不能大過半個區塊，不然會蓋到隔壁的地城
export const inDZone = (tx: number, ty: number) => tx >= DZONE.x0 && tx <= DZONE.x1 && ty >= DZONE.y0 && ty <= DZONE.y1;
export const dungeonAt = (x: number, y: number) => { const tx = x / TS, ty = y / TS; return inDZone(tx, ty) ? DUNGEONS.find(d => ty >= d.y0 && ty < d.y0 + SLOT_H && tx >= d.x0 && tx < d.x0 + SLOT_W) || null : null; };

/* ---- 野外入口：在入口位置堆一座小山（正面就是山壁），前面清出一塊空地 ---- */
export function stampEntrances(inb: (x: number, y: number) => boolean) {
  for (const d of DUNGEONS) { const [ex, ey] = d.ent;
    for (let y = ey - 4; y <= ey + 3; y++) for (let x = ex - 4; x <= ex + 4; x++) { if (!inb(x, y)) continue; const i = y * MW + x;
      const hill = y <= ey && ((x - ex) / 4.6) ** 2 + ((y - ey + .5) / 4.2) ** 2 < 1;
      if (hill) map[i] = CLIFF; else if (y > ey && Math.abs(x - ex) <= 2) map[i] = GROUND; else if (y > ey && (map[i] === TREE || map[i] === ROCK || map[i] === WATER)) map[i] = GROUND; } }
}
/* ---- 地城裡面：房間鏈 ---- */
export function carveDungeons(roomSpawn: (d: Dungeon, tx: number, ty: number, kind: string, lv: number, boss?: boolean) => void) {
  for (let y = DZONE.y0 - 2; y <= DZONE.y1 + 2; y++) for (let x = DZONE.x0 - 2; x <= DZONE.x1; x++) { map[y * MW + x] = CLIFF; reg[y * MW + x] = DREG; }   // 整塊先填滿岩石：從地城裡往外看不會看到海
  for (const d of DUNGEONS) {
    const R = mulberry32(d.id.length * 977 + d.ent[0] * 31 + d.ent[1]), X0 = d.x0, Y0 = d.y0, crypt = d.style === 'crypt';
    const wall = crypt ? RWALL : CLIFF, floor = crypt ? RFLOOR : GROUND;
    for (let y = Y0; y < Y0 + SLOT_H; y++) for (let x = X0; x < X0 + SLOT_W; x++) { map[y * MW + x] = wall; reg[y * MW + x] = DREG; }
    const set = (x: number, y: number, t: number) => { if (x > X0 && y > Y0 && x < X0 + SLOT_W - 1 && y < Y0 + SLOT_H - 1) map[y * MW + x] = t; };
    const j = (n: number) => Math.round((R() - .5) * n);
    // 房間中心（地城內的相對座標）：0 入口（最下面）→ 1 → 3 → 4 守護者（最上面）；2 是岔出去的寶箱房
    const rooms = [[25, 46, 6, 5], [13 + j(6), 35 + j(2), 7, 5], [39 + j(4), 31 + j(4), 5, 4], [22 + j(8), 21 + j(2), 8, 5], [25, 9, 9, 6]].map(([x, y, rx, ry]) => ({ x: X0 + x, y: Y0 + y, rx, ry }));
    const corr = new Set<number>();
    const room = (r) => { for (let y = r.y - r.ry - 1; y <= r.y + r.ry + 1; y++) for (let x = r.x - r.rx - 1; x <= r.x + r.rx + 1; x++) {
      if (crypt) { if (Math.abs(x - r.x) <= r.rx && Math.abs(y - r.y) <= r.ry) set(x, y, floor); }
      else if (((x - r.x) / (r.rx + .5)) ** 2 + ((y - r.y) / (r.ry + .5)) ** 2 < 1 + (R() - .5) * .35) set(x, y, floor); } };
    const tunnel = (a, b) => {                                            // 先橫後直的通道，寬 3 格；洞窟會左右扭一點
      const step = (x: number, y: number, k: number) => { for (let o = -1; o <= 1; o++) { const w = crypt ? 0 : Math.round(Math.sin(k * .45) * .8);
        const px = a.x === b.x ? x + o + w : x, py = a.x === b.x ? y : y + o + w; set(px, py, floor); corr.add(py * MW + px); } };
      let k = 0; for (let x = a.x; x !== b.x; x += Math.sign(b.x - a.x)) step(x, a.y, k++);
      for (let y = a.y; y !== b.y; y += Math.sign(b.y - a.y)) { for (let o = -1; o <= 1; o++) { const w = crypt ? 0 : Math.round(Math.sin(k * .45) * .8); set(b.x + o + w, y, floor); corr.add(y * MW + b.x + o + w); } k++; } };
    rooms.forEach(room); tunnel(rooms[0], rooms[1]); tunnel(rooms[1], rooms[3]); tunnel(rooms[3], rooms[4]); tunnel(rooms[3], rooms[2]);
    if (crypt) for (const r of [rooms[3], rooms[4]]) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) set(r.x + dx * (r.rx - 2), r.y + dy * (r.ry - 2), PILLAR);   // 古墓大廳的柱子
    if (d.style === 'grotto') {                                           // 石窟：房間裡有一攤一攤的水，通道跨過一條暗河（變成木橋）
      const cy = Math.round((rooms[1].y + rooms[3].y) / 2);
      for (let x = X0 + 1; x < X0 + SLOT_W - 1; x++) for (const y of [cy, cy + 1]) { const i = y * MW + x; if (map[i] === floor) map[i] = corr.has(i) ? BRIDGE : WATER; }
      for (const r of [rooms[2], rooms[4]]) for (let k = 0; k < 2; k++) { const px = r.x + (k ? 1 : -1) * (r.rx - 2), py = r.y + j(2);
        for (let y = py - 1; y <= py + 1; y++) for (let x = px - 1; x <= px + 1; x++) if (map[y * MW + x] === floor && (x - px) ** 2 + (y - py) ** 2 <= 1.5) map[y * MW + x] = WATER; }
    }
    if (!crypt) for (const r of rooms) for (let k = 0; k < 3; k++) { const gx = r.x + j(r.rx * 2), gy = r.y + j(r.ry * 2);      // 洞窟裡的發光蘑菇 = 光源
      if (map[gy * MW + gx] === floor) glows.push({ tx: gx, ty: gy, x: gx * TS + 4 + R() * 8, y: gy * TS + 6 + R() * 6, ph: R() * 10 }); }
    const r0 = rooms[0], rb = rooms[4];
    d.inX = r0.x * TS + 8; d.inY = (r0.y - 1) * TS + 8; d.exX = r0.x * TS + 8; d.exY = (r0.y + 3) * TS + 8;
    set(r0.x, r0.y + 3, floor);
    for (const r of [rooms[1], rooms[2], rooms[3]]) { const n = 2 + (R() < .5 ? 1 : 0);
      for (let k = 0; k < n; k++) for (let t = 0; t < 12; t++) { const x = r.x + j(r.rx * 1.6), y = r.y + j(r.ry * 1.6); if (map[y * MW + x] !== floor) continue;
        roomSpawn(d, x, y, d.kinds[Math.floor(R() * d.kinds.length)], d.lv + (R() < .4 ? 1 : 0)); break; } }
    roomSpawn(d, rb.x, rb.y + 1, d.boss.kind, d.boss.lv, true);
    (d as any).bossChest = [rb.x, rb.y - rb.ry + 1]; (d as any).sideChest = [rooms[2].x, rooms[2].y];
    (d as any).tablet = [rooms[3].x + rooms[3].rx - 1, rooms[3].y - rooms[3].ry + 1];
  }
}
export function addDungeonSpawns() {
  carveDungeons((d, tx, ty, kind, lv, boss) => spawns.push(boss
    ? { tx, ty, x: tx * TS + 8, y: ty * TS + 8, kind, lv, elite: true, ename: d.boss.name, once: 'dgn:' + d.id, alive: false, timer: 0 }
    : { tx, ty, x: tx * TS + 8, y: ty * TS + 8, kind, lv, alive: false, timer: 0 }));
}

/* ---- 進出 ---- */
export interface Door { d: Dungeon; out: boolean; x: number; y: number }
export function nearDoor(pl: Player): Door | null {
  if (!pl || pl.dead) return null;
  for (const d of DUNGEONS) {
    const fx = d.ent[0] * TS + 8, fy = (d.ent[1] + 1) * TS + 6;          // 野外：站在洞口前
    if (Math.abs(pl.x - fx) < 20 && Math.abs(pl.y - fy) < 18) return { d, out: false, x: fx, y: fy };
    if (d.exX !== undefined && Math.abs(pl.x - d.exX) < 16 && Math.abs(pl.y - d.exY) < 14) return { d, out: true, x: d.exX, y: d.exY };   // 裡面：站在上樓階梯上
  }
  return null;
}
export function useDoor(pl: Player, door: Door, snap: (pl: Player) => void) {
  const d = door.d;
  if (door.out) { pl.x = d.ent[0] * TS + 8; pl.y = (d.ent[1] + 1) * TS + 12; }
  else { pl.x = d.inX; pl.y = d.inY; }
  pl.dash = null; pl.dvx = pl.dvy = 0; G.projs = [];
  snap(pl); G.fx.push({ k: 'flash', col: '#000000', a: .9, t: 0, d: .45 });
}

export const doorLabel = (door: Door) => door.out ? '離開「' + door.d.name + '」' : '進入「' + door.d.name + '」';
