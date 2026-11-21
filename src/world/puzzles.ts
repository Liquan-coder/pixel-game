/* ================= 地城的機關和謎題 =================
   不只打怪。每座地城從下面挑幾種（PUZ 表）：
   第一間房（闖關）
     spikes  尖刺陷阱：整片尖刺一排一排升起，像浪一樣往前推 → 看準空檔走，或用瞬移（無敵）穿過去
     crumble 崩塌石橋：整間房變成地底湖 / 熔岩池，只剩一條彎彎曲曲的石頭路；站太久石頭就會裂開掉下去 → 一直走，或瞬移跳過缺口。掉下去：扣血、回到起點
   Boss 大廳前那間房（解謎，解開才會升起通往 Boss 大廳的鐵柵門）
     braziers 火盆：牆上壁畫刻著四個符號的順序，照順序點燃四個火盆。點錯 → 火焰暴走 + 叫出守衛
     simon    符文踏板：碰一下記憶石，地上的四塊符文會依序亮起；照同樣的順序踩上去。踩錯 → 被電一下、重來
     statues  轉動雕像：四座雕像圍著祭壇，目光（光線）要全部聚在祭壇上。相鄰的雕像連在一起：轉一座，下一座也會跟著轉
   寶箱房（探索）
     secret   隱藏的牆：一面有裂痕的牆，砍一下就碎，後面藏著金箱（像艾爾登法環的幻影牆）
   解開的狀態存在 quest 的 flags（'puz:地城:fire' = 門、'puz:地城:wall' = 牆），每幀對一次，讀檔 / 開新遊戲時門和牆自動變成對的樣子。 */
import { tier } from '../data/levels';
import { G } from '../core/state';
import { TAU, mulberry32, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { CLIFF, GROUND, LAVA, MW, PROPS, RFLOOR, RWALL, TS, WATER, explored, map, spawns } from './map';
import { DUNGEONS, type Dungeon, type Room } from './dungeons';
import { invalidate, flame } from './chunks';
import { miniPix } from './minimap';
import { CHESTS } from './chests';
import { flags } from '../game/quest';
import { downPlayer, hurtPlayer } from '../game/combat';
import { makeEnemy } from '../game/enemies';
import { burst, shake } from '../game/worldUpdate';
import { showBanner, toast } from '../ui/hud';
import { save } from '../game/save';
import type { Player } from '../types';

type Cfg = { r1?: 'spikes' | 'crumble'; gate?: 'braziers' | 'simon' | 'statues'; secret?: boolean; pit?: 'water' | 'lava'; seq?: number };
const PUZ: Record<string, Cfg> = {                                       // 哪座地城有哪些機關（沒列到的 = 純戰鬥；地底遺跡先不放）
  moss:       { gate: 'simon', secret: true, seq: 4 },
  barrow:     { r1: 'spikes', gate: 'braziers', secret: true },
  grotto:     { r1: 'crumble', pit: 'water', gate: 'statues' },
  roots:      { r1: 'spikes', gate: 'statues', secret: true },
  windcave:   { gate: 'simon', secret: true },
  sandtemple: { r1: 'spikes', gate: 'braziers' },
  lavatube:   { r1: 'crumble', pit: 'lava', gate: 'simon', seq: 6 },
  icecave:    { gate: 'statues', secret: true },
  frostcrypt: { r1: 'spikes', gate: 'simon', secret: true, seq: 6 },
  rotcave:    { r1: 'crumble', pit: 'water', gate: 'braziers' },
  sunkgrotto: { r1: 'crumble', pit: 'water', gate: 'statues', secret: true },
};
type Sym = 'moon' | 'sun' | 'star' | 'eye';
const SYMS: Sym[] = ['moon', 'sun', 'star', 'eye'];
const SYM_COL: Record<Sym, string> = { moon: '#8ac8ff', sun: '#ffb040', star: '#ffe38a', eye: '#c88aff' };
const SYM_N: Record<Sym, string> = { moon: '月', sun: '日', star: '星', eye: '眼' };
type Prop = { x: number; y: number; r: number };
interface Brazier { x: number; y: number; sym: Sym; lit: boolean; prop: Prop }
interface Plate { x: number; y: number; tx: number; ty: number; sym: Sym; flash: number; bad: number }
interface Stat { x: number; y: number; want: number; prop: Prop }        // want = 朝哪個方向才會看著祭壇（0 東、1 南、2 西、3 北）
interface Crumb { x: number; y: number; tx: number; ty: number; on: number; crack: number; gone: number }
interface Puz {
  d: Dungeon; cfg: Cfg;
  spikes: { x: number; y: number; row: number }[]; rows: number;
  crumb: Crumb[]; start: { x: number; y: number }; pitCol: string[];
  braz: Brazier[]; order: Sym[]; got: number; mural: { x: number; y: number };
  plates: Plate[]; seq: number[]; step: number; show: number; stone: { x: number; y: number } | null; shown: boolean; onPlate: number;
  stats: Stat[]; off: number[]; altar: { x: number; y: number } | null;
  gate: { x: number; y: number; prop: Prop }[]; gateOpen: boolean; gateT: number;
  wall: { tx: number; ty: number }[]; wallOpen: boolean; wallHint: { x: number; y: number }; wallT: number;
  lastSwing?: any;
}
export const PUZZLES: Puz[] = [];
const fFire = (p: Puz) => 'puz:' + p.d.id + ':fire', fWall = (p: Puz) => 'puz:' + p.d.id + ':wall';
const isFloor = (t: number) => t === RFLOOR || t === GROUND;
const base = (p: Puz) => 10 + 3 * tier(p.d.lv);

/* ---- 生成：main.ts 在 dressEntrances 之後呼叫（PROPS 那時候才清乾淨） ---- */
export function setupPuzzles() {
  PUZZLES.length = 0;
  for (const id in PUZ) { const d = DUNGEONS.find(x => x.id === id); if (!d || !d.rooms || d.style === 'ruin') continue;
    const cfg = PUZ[id], [, r1, r2, r3, hall] = d.rooms, R = mulberry32(id.length * 131 + d.ent[0]);
    const I = (x: number, y: number) => y * MW + x, floor = (x: number, y: number) => isFloor(map[I(x, y)]);
    const near = (x: number, y: number) => { for (let r = 0; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (floor(x + dx, y + dy)) return [x + dx, y + dy]; return null; };
    const inRoom = (r: Room, tx: number, ty: number) => Math.abs(tx - r.x) <= r.rx + 1 && Math.abs(ty - r.y) <= r.ry + 1;
    for (let i = spawns.length - 1; i >= 0; i--) if ((cfg.r1 && inRoom(r1, spawns[i].tx, spawns[i].ty)) || (cfg.gate && inRoom(r3, spawns[i].tx, spawns[i].ty))) spawns.splice(i, 1);   // 機關房裡不放怪
    const p: Puz = { d, cfg, spikes: [], rows: r1.ry * 2 + 1, crumb: [], start: { x: 0, y: 0 }, pitCol: cfg.pit === 'lava' ? ['#5a1408', '#e8743b', '#ffd04a'] : ['#0e2440', '#3b6ea8', '#a8dcff'],
      braz: [], order: [], got: 0, mural: { x: 0, y: 0 }, plates: [], seq: [], step: 0, show: 0, stone: null, shown: false, onPlate: -1, stats: [], off: [], altar: null,
      gate: [], gateOpen: false, gateT: 0, wall: [], wallOpen: false, wallHint: { x: 0, y: 0 }, wallT: 0 };
    // ---- 第一間房 ----
    if (cfg.r1 === 'spikes') for (let ty = r1.y - r1.ry; ty <= r1.y + r1.ry; ty++) for (let tx = r1.x - r1.rx; tx <= r1.x + r1.rx; tx++) if (floor(tx, ty)) p.spikes.push({ x: tx * TS + 8, y: ty * TS + 8, row: r1.y + r1.ry - ty });
    if (cfg.r1 === 'crumble') {                                          // 只留一條彎路，其他地板變成水 / 熔岩
      const s = Math.sign(r3.x - r1.x) || 1, yb = r1.y + r1.ry, path = new Set<number>(), seg = (x0: number, y0: number, x1: number, y1: number) => {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) path.add(I(x, y)); };
      const pts = [[r1.x, yb + 1], [r1.x, yb - 2], [r1.x - s * 4, yb - 2], [r1.x - s * 4, r1.y - 2], [r1.x + s * 2, r1.y - 2], [r1.x + s * 2, r1.y], [r1.x + s * (r1.rx + 1), r1.y]];
      for (let k = 1; k < pts.length; k++) seg(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]);
      const pit = cfg.pit === 'lava' ? LAVA : WATER;
      for (let ty = r1.y - r1.ry - 1; ty <= r1.y + r1.ry; ty++) for (let tx = r1.x - r1.rx - 1; tx <= r1.x + r1.rx + 1; tx++) if (floor(tx, ty) && !path.has(I(tx, ty)) && Math.abs(tx - r1.x) <= r1.rx && Math.abs(ty - r1.y) <= r1.ry) map[I(tx, ty)] = pit;
      const fl = d.style === 'crypt' ? RFLOOR : GROUND, list = [...path];
      for (const i of list) { map[i] = fl; }
      let k = 0; for (let j = 1; j < pts.length; j++) { const [x0, y0] = pts[j - 1], [x1, y1] = pts[j], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));   // 照走的順序排，頭尾三格不會碎
        for (let q = j === 1 ? 0 : 1; q <= n; q++) { const tx = x0 + Math.sign(x1 - x0) * q, ty = y0 + Math.sign(y1 - y0) * q; k++;
          if (k > 3 && !(j === pts.length - 1 && q > n - 3)) p.crumb.push({ x: tx * TS + 8, y: ty * TS + 8, tx, ty, on: 0, crack: 0, gone: 0 }); } }
      p.start = { x: r1.x * TS + 8, y: (yb + 1) * TS + 8 };
    }
    // ---- Boss 大廳前的謎題 ----
    const gy = hall.y + hall.ry + 1;
    if (cfg.gate) for (let tx = hall.x - 3; tx <= hall.x + 3; tx++) if (floor(tx, gy)) { const prop = { x: tx * TS + 8, y: gy * TS + 8, r: 9 }; PROPS.push(prop); p.gate.push({ x: prop.x, y: prop.y, prop }); }
    const shuf = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    if (cfg.gate === 'braziers') {
      p.order = id === 'barrow' ? ['moon', 'sun', 'star', 'eye'] : shuf(SYMS);
      const at: Sym[] = id === 'barrow' ? ['star', 'moon', 'eye', 'sun'] : shuf(SYMS);
      [-6, -2, 2, 6].forEach((ox, k) => { const q = near(r3.x + ox, r3.y + 1); if (!q) return; const x = q[0] * TS + 8, y = q[1] * TS + 10, prop = { x, y, r: 5 };   // 房間四角有柱子（±5, ±2）
        PROPS.push(prop); p.braz.push({ x, y, sym: at[k], lit: false, prop }); });
      p.mural = { x: (r3.x - 2) * TS + 8, y: (r3.y - r3.ry) * TS };
    }
    if (cfg.gate === 'simon') {
      [-4, -1, 2, 5].forEach((ox, k) => { const q = near(r3.x + ox, r3.y + 1); if (q) p.plates.push({ x: q[0] * TS + 8, y: q[1] * TS + 8, tx: q[0], ty: q[1], sym: SYMS[k], flash: 0, bad: 0 }); });
      const n = cfg.seq || 5; for (let k = 0; k < n; k++) { let v; do v = Math.floor(R() * p.plates.length); while (k && v === p.seq[k - 1]); p.seq.push(v); }   // 不會連續兩次同一塊
      const q = near(r3.x, r3.y - 2); if (q) { p.stone = { x: q[0] * TS + 8, y: q[1] * TS + 12 }; PROPS.push({ x: p.stone.x, y: p.stone.y, r: 6 }); }
    }
    if (cfg.gate === 'statues') {
      const ax = r3.x, ay = r3.y; p.altar = { x: ax * TS + 8, y: ay * TS + 12 }; PROPS.push({ x: p.altar.x, y: p.altar.y, r: 6 });
      for (const [ox, oy, want] of [[-3, 0, 0], [0, -2, 1], [3, 0, 2], [0, 2, 3]]) { if (!floor(ax + ox, ay + oy)) continue; const x = (ax + ox) * TS + 8, y = (ay + oy) * TS + 12, prop = { x, y, r: 6 }; PROPS.push(prop); p.stats.push({ x, y, want, prop }); }
      p.off = p.stats.map(() => 0); const n = p.stats.length;
      for (let k = 0; k < 5 || p.off.every(o => o === 0); k++) { const i = Math.floor(R() * n); p.off[i] = (p.off[i] + 1) % 4; p.off[(i + 1) % n] = (p.off[(i + 1) % n] + 1) % 4; }   // 從「已解開」往回亂轉 → 一定解得開
    }
    // ---- 隱藏的牆：寶箱房四邊找一邊，牆後面 3×3 都是實心的 → 挖一個小房間放金箱 ----
    const W0 = d.style === 'crypt' ? RWALL : CLIFF, fl0 = d.style === 'crypt' ? RFLOOR : GROUND;
    if (cfg.secret) for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const ex = dx ? r2.x + dx * (r2.rx + 1) : r2.x, ey = dy ? r2.y + dy * (r2.ry + 1) : r2.y;
      const cells: number[][] = [], room: number[][] = [];
      for (let k = -1; k <= 1; k++) cells.push(dx ? [ex, ey + k] : [ex + k, ey]);
      for (let a = 1; a <= 3; a++) for (let k = -1; k <= 1; k++) room.push(dx ? [ex + dx * a, ey + k] : [ex + k, ey + dy * a]);
      const solid = (x: number, y: number) => map[I(x, y)] === W0 && x > d.x0 + 1 && x < d.x0 + d.w - 2 && y > d.y0 + 1;
      if (![...cells, ...room].every(([x, y]) => solid(x, y))) continue;
      if (!cells.some(([x, y]) => [[x - dx, y - dy]].every(([a, b]) => floor(a, b)))) continue;   // 牆的這一面要對著寶箱房的地板（不然砍不到）
      const ring = room.flatMap(([x, y]) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]).filter(([x, y]) => !room.some(q => q[0] === x && q[1] === y) && !cells.some(q => q[0] === x && q[1] === y));
      if (!ring.every(([x, y]) => map[I(x, y)] === W0)) continue;
      for (const [x, y] of room) map[I(x, y)] = fl0;
      p.wall = cells.map(([tx, ty]) => ({ tx, ty })); p.wallT = W0; p.wallHint = { x: ex * TS + 8, y: ey * TS + 8 };
      const [cx, cy] = room[4], cid = 'pz_' + d.id;
      if (!CHESTS.some(c => c.id === cid)) CHESTS.push({ id: cid, tx: cx, ty: cy, x: cx * TS + 8, y: cy * TS + 10, tier: 2, lv: d.lv + 8, mimic: false, opened: false, t: 0 });
      break; }
    PUZZLES.push(p);
  }
}

/* ---- 門 / 牆：照 flags 變成對的樣子 ---- */
function setWall(p: Puz, open: boolean) {
  p.wallOpen = open; const fl = p.wallT === RWALL ? RFLOOR : GROUND;
  for (const { tx, ty } of p.wall) { const i = ty * MW + tx; map[i] = open ? fl : p.wallT; invalidate(tx, ty); if (explored[i]) miniPix(i); }
}
function openGate(p: Puz) { flags.add(fFire(p)); p.gateOpen = true; p.gateT = 0; sfx.level(); shake(4, .5); showBanner('遠處傳來鐵柵門升起的聲音', '', 2400); save(); }
const swingFace = (pl: Player, x: number, y: number) => Math.abs(((Math.atan2(y - pl.y, x - pl.x) - pl.face) % TAU + TAU * 1.5) % TAU - Math.PI) < 1.2;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const statDir = (p: Puz, i: number) => (p.stats[i].want + p.off[i]) % 4;

/* ---- 每幀 ---- */
export function updatePuzzles(dt: number) {
  for (const p of PUZZLES) {
    const fire = flags.has(fFire(p)), wall = flags.has(fWall(p));
    if (p.wall.length && p.wallOpen !== wall) setWall(p, wall);
    if (fire !== p.gateOpen) { p.gateOpen = fire; p.gateT = fire ? 0 : 1; for (const b of p.braz) b.lit = fire; p.got = fire ? 4 : 0; p.step = fire ? p.seq.length : 0; if (fire) p.off = p.off.map(() => 0); }
    if (p.gateOpen && p.gateT < 1) p.gateT = Math.min(1, p.gateT + dt / 1.2);
    for (const g of p.gate) g.prop.r = p.gateOpen && p.gateT > .6 ? 0 : 9;   // 升到一半以上就可以走過去
    if (p.show > 0) p.show -= dt;                                        // 符文踏板：記憶石正在示範
    for (const pl of p.plates) { if (pl.flash > 0) pl.flash -= dt; if (pl.bad > 0) pl.bad -= dt; }
    for (const c of p.crumb) { if (c.gone > 0) { c.gone -= dt; if (c.gone <= 0) { c.crack = 0; c.on = 0; } } else if (c.crack > 0) { c.crack -= dt; if (c.crack <= 0) { c.gone = 4; sfx.boom(); burst(c.x, c.y, 8, '#6a6478', 60); } } }
    for (const pl of G.players) { if (pl.dead) continue;
      // 尖刺：站在「升起來」的那格 → 受傷 + 出血（瞬移中無敵，可以直接穿過去）
      if (p.spikes.length && spikePhase(p, pl.y) === 'up' && p.spikes.some(s => Math.abs(s.x - pl.x) < 9 && Math.abs(s.y - (pl.y - 2)) < 9)) {
        G.hitCtx = { lv: p.d.lv }; hurtPlayer(pl, Math.round(base(p) * .75), pl.x, pl.y + 3, { bleed: 22 }); G.hitCtx = null; }
      // 崩塌石橋：站上去 0.3 秒開始裂、0.5 秒後掉下去；掉了的洞 4 秒後長回來。瞬移中可以飛過缺口
      if (p.crumb.length) { const c = p.crumb.find(c => Math.abs(c.x - pl.x) < 8 && Math.abs(c.y - (pl.y - 2)) < 8);
        if (c && c.gone <= 0 && c.crack <= 0 && (c.on += dt) > .3) { c.crack = .5; sfx.hit(); }
        if (c && c.gone > 0 && !(pl.dodge > 0) && !pl.dash) fall(p, pl); }
      // 符文踏板：踩上去的那一下才算
      if (p.plates.length && !p.gateOpen) { const k = p.plates.findIndex(q => Math.abs(q.x - pl.x) < 8 && Math.abs(q.y - (pl.y - 2)) < 8);
        if (k !== p.onPlate) { p.onPlate = k; if (k >= 0 && p.shown && p.show <= 0) stepPlate(p, k, pl); } }
      // 隱藏的牆：揮刀的那一下，靠近而且面向裂開的牆 → 碎掉
      if (!p.wallOpen && p.wall.length && pl.swing && pl.swing !== p.lastSwing) { p.lastSwing = pl.swing;
        if (Math.hypot(pl.x - p.wallHint.x, pl.y - p.wallHint.y) < 32 && swingFace(pl, p.wallHint.x, p.wallHint.y)) {
          flags.add(fWall(p)); setWall(p, true); sfx.boom(); shake(5, .3); save();
          for (const { tx, ty } of p.wall) burst(tx * TS + 8, ty * TS + 8, 18, '#6a6478', 90);
          toast('牆碎掉了……後面有一條隱藏的通道', '#c8a8ff'); } }
    }
  }
}
function fall(p: Puz, pl: Player) {
  const v = Math.max(1, Math.round(pl.maxHp * .15)); pl.hp -= v; pl.iframe = .8; pl.kx = pl.ky = 0;
  G.nums.push({ x: pl.x, y: pl.y - 28, txt: String(v), col: '#ff5a5a', t: 0, d: .8 }); burst(pl.x, pl.y, 14, p.pitCol[1], 80); sfx.hurt(); shake(4, .3);
  pl.x = p.start.x; pl.y = p.start.y; if (pl === G.me) toast('掉下去了……', '#ff8a8a');
  if (pl.hp <= 0) downPlayer(pl);
}
function stepPlate(p: Puz, k: number, pl: Player) {
  if (p.seq[p.step] === k) { p.plates[k].flash = .5; sfx.pick(); p.step++;
    if (p.step >= p.seq.length) { for (const q of p.plates) q.flash = 1.2; openGate(p); } return; }
  p.step = 0; for (const q of p.plates) q.bad = .6;                     // 踩錯：被電一下，從頭來
  G.hitCtx = { lv: p.d.lv }; hurtPlayer(pl, Math.round(base(p) * .5), pl.x, pl.y + 3, { stun: .4 }); G.hitCtx = null;
  for (let i = 0; i < 12; i++) G.parts.push({ x: pl.x + rr(-8, 8), y: pl.y - rr(0, 20), vx: rr(-40, 40), vy: rr(-60, 10), life: .3, max: .3, col: pick(['#c8e8ff', '#ffffff', '#8ac8ff']), star: rr(.6, 1.4), drag: 4 });
  toast('符文暗了下去……順序不對', '#8ac8ff');
}
/* 尖刺這一刻在那一排是「收著 / 快升起來（預警）/ 升起來」：每排相隔 0.32 秒，一次升兩排，像浪一樣從下往上推 */
const SP_T = 2.4, SP_ROW = .32, SP_UP = .62, SP_WARN = .4;
function rowPhase(row: number): 'down' | 'warn' | 'up' { const u = ((G.time - row * SP_ROW) % SP_T + SP_T) % SP_T; return u < SP_UP ? 'up' : u > SP_T - SP_WARN ? 'warn' : 'down'; }
function spikePhase(p: Puz, y: number) { const s = p.spikes.find(s => Math.abs(s.y - (y - 2)) < 8); return s ? rowPhase(s.row) : 'down'; }
/* 符文踏板的示範：每一步亮 0.6 秒、停 0.25 秒 */
const SH_STEP = .85;
function showing(p: Puz): number { if (p.show <= 0) return -1; const t = p.seq.length * SH_STEP - p.show, i = Math.floor(t / SH_STEP); return t - i * SH_STEP < .6 ? p.seq[i] : -1; }

/* ---- 互動（ui/interact.ts） ---- */
export function puzzleTarget(pl: Player): { btn: string; text: string; run: () => void } | null {
  for (const p of PUZZLES) {
    if (!p.gateOpen) {
      for (const b of p.braz) if (!b.lit && Math.hypot(b.x - pl.x, b.y - pl.y) < 22) return { btn: '點燃', text: '點燃火盆', run: () => light(p, b, pl) };
      if (p.stone && p.show <= 0 && Math.hypot(p.stone.x - pl.x, p.stone.y - pl.y) < 24) return { btn: '觸摸', text: '觸摸記憶石', run: () => { p.show = p.seq.length * SH_STEP; p.shown = true; p.step = 0; sfx.skill();
        if (!flags.has('puz:hint:simon')) { flags.add('puz:hint:simon'); toast('地上的符文一個一個亮了起來……照這個順序踩上去', '#8ac8ff'); } } };
      for (let i = 0; i < p.stats.length; i++) { const s = p.stats[i]; if (Math.hypot(s.x - pl.x, s.y - pl.y) < 22) return { btn: '轉動', text: '轉動雕像', run: () => turn(p, i) }; }
      if (p.altar && Math.hypot(p.altar.x - pl.x, p.altar.y - pl.y) < 22) return { btn: '查看', text: '查看祭壇', run: () => toast('祭壇上刻著：「四道目光聚在這裡的時候，門就會打開。」雕像的底座連在一起——轉一座，下一座也會跟著轉。', '#e8dcff') };
    }
    if (p.braz.length && Math.abs(p.mural.x - pl.x) < 34 && pl.y - p.mural.y < 40 && pl.y > p.mural.y) return { btn: '查看', text: '查看壁畫', run: () => toast('壁畫上從左到右刻著四個符號：' + p.order.map(s => SYM_N[s]).join('、') + '。火盆上也刻著一樣的符號', '#e8dcff') };
  }
  return null;
}
function turn(p: Puz, i: number) {
  const n = p.stats.length; p.off[i] = (p.off[i] + 1) % 4; p.off[(i + 1) % n] = (p.off[(i + 1) % n] + 1) % 4; sfx.hit(); shake(1.5, .1);
  for (const k of [i, (i + 1) % n]) burst(p.stats[k].x, p.stats[k].y - 6, 6, '#8a8494', 40);
  if (p.off.every(o => o === 0)) openGate(p);
}
function light(p: Puz, b: Brazier, pl: Player) {
  b.lit = true; sfx.fire(); burst(b.x, b.y - 10, 10, SYM_COL[b.sym], 50);
  if (p.order[p.got] === b.sym) { p.got++; if (p.got >= 4) openGate(p); return; }
  // 點錯：火焰暴走 → 燒你一下、叫出兩隻守衛，火全部熄掉
  p.got = 0; for (const x of p.braz) x.lit = false;
  for (const x of p.braz) { burst(x.x, x.y - 10, 16, '#ff6a2a', 90); G.fx.push({ k: 'warp', x: x.x, y: x.y - 6, r0: 4, r1: 30, th: 4, t: 0, d: .4, col: '#ff8a3a' }); }
  G.hitCtx = { lv: p.d.lv }; hurtPlayer(pl, Math.round(base(p) * .6), b.x, b.y, { burn: 2 }); G.hitCtx = null;
  for (let k = 0; k < 2; k++) { const a = rr(0, TAU), e = makeEnemy(p.d.kinds[0], p.d.lv, pl.x + Math.cos(a) * 50, pl.y + Math.sin(a) * 30);
    e.state = 'chase'; G.enemies.push(e); G.fx.push({ k: 'warp', x: e.x, y: e.y, r0: 2, r1: 16, th: 3, t: 0, d: .4, col: '#c8a8ff' }); }
  sfx.howl(); shake(5, .3); toast('火焰暴走了……順序不對', '#ff8a6a');
}

/* ================= 畫 ================= */
function drawSym(s: Sym, x: number, y: number, col: string, a = 1, sc = 1) {   // 一個 5×5 格的小符號（sc = 一格幾個細像素）
  const P: Record<Sym, string[]> = { moon: ['01110', '11000', '11000', '11000', '01110'], sun: ['10101', '01110', '11111', '01110', '10101'],
    star: ['00100', '00100', '11111', '00100', '00100'], eye: ['00000', '01110', '11011', '01110', '00000'] };
  ctx.globalAlpha = a; ctx.fillStyle = col;
  const c = HK * sc; P[s].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '1') ctx.fillRect(snapF(x + (i - 2.5) * c), snapF(y + (j - 2.5) * c), c, c); }); ctx.globalAlpha = 1;
}
function pedestal(x: number, y: number, h = 14) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(snapF(x - 8), snapF(y - 1), 16, 3);
  ctx.fillStyle = '#1e1a24'; ctx.fillRect(snapF(x - 7), snapF(y - h), 14, h); ctx.fillStyle = '#4a4558'; ctx.fillRect(snapF(x - 6), snapF(y - h), 12, h - 1); ctx.fillStyle = '#6a6478'; ctx.fillRect(snapF(x - 6), snapF(y - h), 12, HK * 2); }
export function drawPuzzles(vis, list, L, addLight) {
  for (const p of PUZZLES) {
    // 尖刺：收著 = 地上四個小洞；預警 = 尖端冒出來一點；升起 = 一叢亮銀色的尖刺
    for (const s of p.spikes) { if (!vis(s.x, s.y, 16)) continue; const ph = rowPhase(s.row);
      list.push({ y: s.y - 9 + (ph === 'up' ? 8 : -100), f: () => {
        for (const [ox, oy] of [[-4, -3], [3, -3], [-3, 3], [4, 3], [0, 0]]) { const x = s.x + ox, y = s.y + oy;
          ctx.fillStyle = '#16121c'; ctx.fillRect(snapF(x - HK * 2), snapF(y - HK), HK * 4, HK * 2);
          if (ph === 'warn') { ctx.fillStyle = '#a8a8c0'; ctx.fillRect(snapF(x - HK), snapF(y - HK * 2), HK * 2, HK * 2); }
          if (ph === 'up') { ctx.fillStyle = '#5e5e78'; ctx.fillRect(snapF(x - HK * 2), snapF(y - 6), HK * 2, 6); ctx.fillStyle = '#e8e8f8'; ctx.fillRect(snapF(x), snapF(y - 7), HK * 2, 7);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(snapF(x), snapF(y - 8), HK, HK * 3); } } } }); }
    // 崩塌石橋：裂開 = 裂痕 + 抖動；掉下去 = 一個看得到水 / 熔岩的洞
    for (const c of p.crumb) { if (!vis(c.x, c.y, 16) || (c.crack <= 0 && c.gone <= 0 && c.on <= 0)) continue;
      list.push({ y: c.y - 200, f: () => { const L0 = c.x - 8, T0 = c.y - 8;
        if (c.gone > 0) { ctx.fillStyle = p.pitCol[0]; ctx.fillRect(snapF(L0), snapF(T0), 16, 16); ctx.globalAlpha = .55 + .2 * Math.sin(G.time * 4 + c.tx); ctx.fillStyle = p.pitCol[1]; ctx.fillRect(snapF(L0 + 1), snapF(T0 + 4), 14, 11); ctx.globalAlpha = 1;
          ctx.fillStyle = '#07060b'; ctx.fillRect(snapF(L0), snapF(T0), 16, 3); return; }
        const j = c.crack > 0 ? Math.sin(G.time * 60) * .6 : 0; ctx.fillStyle = '#16121c';
        for (const [ax, ay, bx, by] of [[3, 2, 8, 8], [8, 8, 13, 5], [8, 8, 6, 14], [8, 8, 12, 13]]) for (let i = 0; i <= 5; i++) ctx.fillRect(snapF(L0 + j + ax + (bx - ax) * i / 5), snapF(T0 + ay + (by - ay) * i / 5), HK * 2, HK * 2); } }); }
    // 壁畫：一塊刻著四個發光符號的石板
    if (p.braz.length && vis(p.mural.x, p.mural.y, 50)) { list.push({ y: p.mural.y - 100, f: () => { const x = p.mural.x, y = p.mural.y - 10;
      ctx.fillStyle = '#1e1a24'; ctx.fillRect(snapF(x - 34), snapF(y - 11), 68, 22); ctx.fillStyle = '#4a4558'; ctx.fillRect(snapF(x - 32), snapF(y - 9), 64, 18);
      ctx.fillStyle = '#6a6478'; ctx.fillRect(snapF(x - 32), snapF(y - 9), 64, HK * 2); ctx.fillStyle = '#2e2a36'; ctx.fillRect(snapF(x - 32), snapF(y + 9 - HK * 2), 64, HK * 2);
      p.order.forEach((s, k) => { ctx.fillStyle = '#2e2a36'; ctx.fillRect(snapF(x - 28 + k * 15), snapF(y - 6), 12, 12);           // 四格凹槽，各刻一個發光的符號
        drawSym(s, x - 22 + k * 15, y, SYM_COL[s], .7 + .3 * Math.sin(G.time * 2 + k), 5); });
      for (let k = 0; k < 3; k++) { ctx.fillStyle = '#8a8494'; ctx.fillRect(snapF(x - 15.5 + k * 15), snapF(y - HK), HK * 2, HK * 2); } } });   // 中間的小點 = 「然後」
      addLight(L, p.mural.x, p.mural.y - 10, 26, 3); }
    // 火盆：石座 + 火盆；點燃 = 火焰 + 光；符號刻在石座上
    for (const b of p.braz) { if (!vis(b.x, b.y, 30)) continue;
      list.push({ y: b.y, f: () => { pedestal(b.x, b.y);
        ctx.fillStyle = '#2a1a0e'; ctx.fillRect(snapF(b.x - 9), snapF(b.y - 18), 18, 4); ctx.fillStyle = '#7a5a30'; ctx.fillRect(snapF(b.x - 9), snapF(b.y - 18), 18, HK * 2);   // 鐵火盆
        ctx.fillStyle = '#1a120a'; ctx.fillRect(snapF(b.x - 7), snapF(b.y - 18 + HK * 2), 14, HK * 2);
        drawSym(b.sym, b.x, b.y - 7, b.lit ? SYM_COL[b.sym] : '#b8b0c8', b.lit ? 1 : .6 + .2 * Math.sin(G.time * 3 + b.x), 4);
        if (b.lit) flame(b.x, b.y - 18, 6, b.x * .1); } });
      if (b.lit) addLight(L, b.x, b.y - 20, 52 + Math.sin(G.time * 9 + b.x) * 2, 1); }
    // 符文踏板 + 記憶石
    const sh = showing(p);
    p.plates.forEach((q, k) => { if (!vis(q.x, q.y, 16)) return; const on = sh === k || q.flash > 0 || p.gateOpen, bad = q.bad > 0;
      list.push({ y: q.y - 200, f: () => { ctx.fillStyle = '#1e1a24'; ctx.fillRect(snapF(q.x - 7), snapF(q.y - 7), 14, 14); ctx.fillStyle = on ? '#3a3050' : '#34303e'; ctx.fillRect(snapF(q.x - 6), snapF(q.y - 6), 12, 12);
        drawSym(q.sym, q.x, q.y, bad ? '#ff5a5a' : on ? SYM_COL[q.sym] : '#6a6478', on || bad ? 1 : .8, 4); } });
      if (on) addLight(L, q.x, q.y, 34, 3); });
    if (p.stone && vis(p.stone.x, p.stone.y, 30)) { const st = p.stone;
      list.push({ y: st.y, f: () => { pedestal(st.x, st.y, 12); ctx.fillStyle = p.show > 0 ? '#c8e8ff' : '#6a8ab0'; ctx.beginPath(); ctx.ellipse(snapF(st.x), snapF(st.y - 16), 5, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .5 + .5 * Math.sin(G.time * 4); ctx.fillRect(snapF(st.x - 2), snapF(st.y - 19), 2, 2); ctx.globalAlpha = 1; } });
      addLight(L, st.x, st.y - 16, p.show > 0 ? 40 : 22, 3); }
    // 轉動雕像：雕像 + 目光（光線）；看著祭壇 = 金色，沒有 = 淡紫色
    if (p.altar && vis(p.altar.x, p.altar.y, 80)) { const A = p.altar, all = p.off.every(o => o === 0);
      list.push({ y: A.y, f: () => { pedestal(A.x, A.y, 10); ctx.fillStyle = all || p.gateOpen ? '#ffe38a' : '#4a4558'; ctx.fillRect(snapF(A.x - 4), snapF(A.y - 14), 8, 4);
        if (all || p.gateOpen) flame(A.x, A.y - 14, 5, 3); } });
      if (all || p.gateOpen) addLight(L, A.x, A.y - 16, 50, 1);
      p.stats.forEach((s, i) => { const dir = p.gateOpen ? s.want : statDir(p, i), [dx, dy] = DIRS[dir], hit = dir === s.want;
        list.push({ y: s.y - 300, f: () => { const L1 = hit ? Math.hypot(A.x - s.x, A.y - s.y) - 6 : 40; ctx.globalAlpha = hit ? .55 + .2 * Math.sin(G.time * 5) : .3; ctx.fillStyle = hit ? '#ffe38a' : '#c8a8ff';   // 目光
          for (let k = 8; k < L1; k += 3) ctx.fillRect(snapF(s.x + dx * k - HK), snapF(s.y - 14 + dy * k * .9 - HK), HK * 2, HK * 2); ctx.globalAlpha = 1; } });
        list.push({ y: s.y, f: () => { pedestal(s.x, s.y, 8);
          ctx.fillStyle = '#4a4558'; ctx.fillRect(snapF(s.x - 4), snapF(s.y - 22), 8, 14); ctx.fillStyle = '#6a6478'; ctx.fillRect(snapF(s.x - 3), snapF(s.y - 26), 6, 6);   // 身體 + 頭
          ctx.fillStyle = hit ? '#ffe38a' : '#c8a8ff'; ctx.fillRect(snapF(s.x - 1 + dx * 2), snapF(s.y - 24 + dy), 2, 2); } }); });   // 眼睛朝向 = 目光的方向
    }
    // 鐵柵門：一排鐵條，打開時往上收
    if (p.gate.length && vis(p.gate[0].x, p.gate[0].y, 60)) { const g0 = p.gate[0], g1 = p.gate[p.gate.length - 1], lift = p.gateOpen ? p.gateT * 20 : 0;
      list.push({ y: g0.y + 7, f: () => { const L0 = g0.x - 8, W = g1.x - g0.x + 16, top = g0.y - 22, H = 30 - lift;
        if (H > 1) { for (let x = L0 + 1; x < L0 + W; x += 4) { ctx.fillStyle = '#2a2632'; ctx.fillRect(snapF(x), snapF(top), 2, H); ctx.fillStyle = '#6a6a80'; ctx.fillRect(snapF(x), snapF(top), HK, H); }
          ctx.fillStyle = '#3a3646'; for (const yy of [top + 4, top + H - 4]) ctx.fillRect(snapF(L0), snapF(yy), W, 2); }
        ctx.fillStyle = '#1e1a24'; ctx.fillRect(snapF(L0 - 2), snapF(top - 3), W + 4, 4); } }); }
    // 會碎的牆：牆上的裂痕 + 偶爾從縫裡吹出來的灰
    if (!p.wallOpen && p.wall.length && vis(p.wallHint.x, p.wallHint.y, 30)) { const { x, y } = p.wallHint;
      list.push({ y: y + 9, f: () => { ctx.fillStyle = '#16121c';
        for (const [ax, ay, bx, by] of [[-10, -12, -4, -4], [-4, -4, -7, 4], [-4, -4, 3, -2], [3, -2, 9, -9], [3, -2, 5, 6], [-14, 2, -7, 4], [8, 2, 14, 5]]) {
          const n = 6; for (let i = 0; i <= n; i++) ctx.fillRect(snapF(x + ax + (bx - ax) * i / n), snapF(y + ay + (by - ay) * i / n), HK * 2, HK * 2); } } });
      if (Math.random() < .04) G.parts.push({ x: x + rr(-8, 8), y: y + rr(-6, 6), vx: rr(-4, 4), vy: rr(4, 12), life: 1, max: 1, col: pick(['#8a8494', '#6a6478']), s: 1, drag: 1 }); }
  }
}
