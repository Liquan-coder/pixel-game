/* ================= 地城的機關和謎題（先在「無名古墓」試做） =================
   不只打怪：
   1. 尖刺陷阱房（闖關）：第一間房的地上整片尖刺，一排一排往上升起、像浪一樣往前推 → 看準空檔走，或用瞬移（無敵）穿過去
   2. 火盆謎題（解謎）：Boss 大廳前那間房，牆上的壁畫刻著四個符號的順序；房間裡四個火盆各有一個符號，照壁畫的順序點燃。
      點錯 → 火焰暴走（燒你一下）+ 叫出兩隻食屍鬼，火全部熄掉重來；點對 → 通往 Boss 大廳的鐵柵門升起來
   3. 隱藏的牆（探索）：寶箱房有一面裂開的牆，砍它一下就會碎掉，後面藏著一個金箱（像艾爾登法環的幻影牆）
   解開的狀態存在 quest 的 flags（'puz:古墓:fire'、'puz:古墓:wall'），讀檔 / 開新遊戲時每幀對一次，自動把門、牆變成對的樣子。
   之後要加到別的地城：在 PUZ 裡加一筆。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { MW, PROPS, RFLOOR, RWALL, TS, explored, map, spawns } from './map';
import { DUNGEONS, type Dungeon } from './dungeons';
import { invalidate, flame } from './chunks';
import { miniPix } from './minimap';
import { CHESTS } from './chests';
import { flags } from '../game/quest';
import { hurtPlayer } from '../game/combat';
import { makeEnemy } from '../game/enemies';
import { burst, shake } from '../game/worldUpdate';
import { showBanner, toast } from '../ui/hud';
import { save } from '../game/save';
import type { Player } from '../types';

const PUZ = ['barrow'];                                                  // 有機關的地城（DUNGEONS 的 id）
type Sym = 'moon' | 'sun' | 'star' | 'eye';
const SYM_COL: Record<Sym, string> = { moon: '#8ac8ff', sun: '#ffb040', star: '#ffe38a', eye: '#c88aff' };
interface Brazier { x: number; y: number; sym: Sym; lit: boolean; prop: { x: number; y: number; r: number } }
interface Puz {
  d: Dungeon;
  spikes: { x: number; y: number; row: number }[]; rows: number;       // 尖刺：每一格的中心 + 第幾排（從下面數）
  braz: Brazier[]; order: Sym[]; got: number; mural: { x: number; y: number };
  gate: { x: number; y: number; prop: { x: number; y: number; r: number } }[]; gateOpen: boolean; gateT: number;
  wall: { tx: number; ty: number }[]; wallOpen: boolean; wallHint: { x: number; y: number };
  lastSwing?: any;
}
export const PUZZLES: Puz[] = [];
const fFire = (p: Puz) => 'puz:' + p.d.id + ':fire', fWall = (p: Puz) => 'puz:' + p.d.id + ':wall';

/* ---- 生成：main.ts 在 dressEntrances 之後呼叫（PROPS 那時候才清乾淨） ---- */
export function setupPuzzles() {
  PUZZLES.length = 0;
  for (const id of PUZ) { const d = DUNGEONS.find(x => x.id === id); if (!d || !d.rooms) continue;
    const [, r1, r2, r3, hall] = d.rooms, floor = (x: number, y: number) => map[y * MW + x] === RFLOOR;
    const inRoom = (r, tx, ty) => Math.abs(tx - r.x) <= r.rx && Math.abs(ty - r.y) <= r.ry;
    for (let i = spawns.length - 1; i >= 0; i--) if (inRoom(r1, spawns[i].tx, spawns[i].ty) || inRoom(r3, spawns[i].tx, spawns[i].ty)) spawns.splice(i, 1);   // 機關房裡不放怪
    const p: Puz = { d, spikes: [], rows: r1.ry * 2 + 1, braz: [], order: ['moon', 'sun', 'star', 'eye'], got: 0, mural: { x: 0, y: 0 }, gate: [], gateOpen: false, gateT: 0, wall: [], wallOpen: false, wallHint: { x: 0, y: 0 } };
    // 1. 尖刺：第一間房的每一格地板（排 = 從最下面那排往上數）
    for (let ty = r1.y - r1.ry; ty <= r1.y + r1.ry; ty++) for (let tx = r1.x - r1.rx; tx <= r1.x + r1.rx; tx++) if (floor(tx, ty)) p.spikes.push({ x: tx * TS + 8, y: ty * TS + 8, row: r1.y + r1.ry - ty });
    // 2. 火盆：第三間房下半部一排四個（房間四角有柱子在 ±5, ±2，要避開），符號的位置跟壁畫的順序不一樣
    const at: Sym[] = ['star', 'moon', 'eye', 'sun'];
    [-6, -2, 2, 6].forEach((ox, k) => { let tx = r3.x + ox, ty = r3.y + 1; if (!floor(tx, ty)) ty++; if (!floor(tx, ty)) return; const x = tx * TS + 8, y = ty * TS + 10, prop = { x, y, r: 5 };
      PROPS.push(prop); p.braz.push({ x, y, sym: at[k], lit: false, prop }); });
    p.mural = { x: (r3.x - 2) * TS + 8, y: (r3.y - r3.ry) * TS };       // 壁畫：刻在房間上面那道牆上
    // 鐵柵門：Boss 大廳正下方那一排通道
    const gy = hall.y + hall.ry + 1;
    for (let tx = hall.x - 3; tx <= hall.x + 3; tx++) if (floor(tx, gy)) { const prop = { x: tx * TS + 8, y: gy * TS + 8, r: 9 }; PROPS.push(prop); p.gate.push({ x: prop.x, y: prop.y, prop }); }
    // 3. 隱藏的牆：寶箱房四邊找一邊，牆後面 3×3 都是實心的岩壁 → 挖一個小房間放金箱，中間隔一排「會碎的牆」
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const ex = dx ? r2.x + dx * (r2.rx + 1) : r2.x, ey = dy ? r2.y + dy * (r2.ry + 1) : r2.y;   // 牆那一排的中間
      const cells: number[][] = [], room: number[][] = [];
      for (let k = -1; k <= 1; k++) cells.push(dx ? [ex, ey + k] : [ex + k, ey]);
      for (let a = 1; a <= 3; a++) for (let k = -1; k <= 1; k++) room.push(dx ? [ex + dx * a, ey + k] : [ex + k, ey + dy * a]);
      const solid = (x: number, y: number) => map[y * MW + x] === RWALL && x > d.x0 + 1 && x < d.x0 + d.w - 2 && y > d.y0 + 1;
      if (![...cells, ...room].every(([x, y]) => solid(x, y))) continue;
      const ring = room.flatMap(([x, y]) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]).filter(([x, y]) => !room.some(q => q[0] === x && q[1] === y) && !cells.some(q => q[0] === x && q[1] === y));
      if (!ring.every(([x, y]) => map[y * MW + x] === RWALL)) continue;   // 小房間四周也要是牆（不會跟別的通道打通）
      for (const [x, y] of room) map[y * MW + x] = RFLOOR;
      p.wall = cells.map(([tx, ty]) => ({ tx, ty })); p.wallHint = { x: ex * TS + 8, y: ey * TS + 8 };
      const [cx, cy] = room[4]; const id = 'pz_' + d.id;
      if (!CHESTS.some(c => c.id === id)) CHESTS.push({ id, tx: cx, ty: cy, x: cx * TS + 8, y: cy * TS + 10, tier: 2, lv: d.lv + 3, mimic: false, opened: false, t: 0 });
      break; }
    PUZZLES.push(p);
  }
}

/* ---- 門 / 牆：照 flags 變成對的樣子（讀檔、開新遊戲都會自動對上） ---- */
function setWall(p: Puz, open: boolean) {
  p.wallOpen = open;
  for (const { tx, ty } of p.wall) { const i = ty * MW + tx; map[i] = open ? RFLOOR : RWALL; invalidate(tx, ty); if (explored[i]) miniPix(i); }
}
const swingFace = (pl: Player, x: number, y: number) => Math.abs(((Math.atan2(y - pl.y, x - pl.x) - pl.face) % TAU + TAU * 1.5) % TAU - Math.PI) < 1.2;

/* ---- 每幀 ---- */
export function updatePuzzles(dt: number) {
  for (const p of PUZZLES) {
    const fire = flags.has(fFire(p)), wall = flags.has(fWall(p));
    if (p.wallOpen !== wall) setWall(p, wall);
    if (fire !== p.gateOpen) { p.gateOpen = fire; p.gateT = fire ? 0 : 1; for (const b of p.braz) b.lit = fire; p.got = fire ? 4 : 0; }
    if (p.gateOpen && p.gateT < 1) p.gateT = Math.min(1, p.gateT + dt / 1.2);
    for (const g of p.gate) g.prop.r = p.gateOpen && p.gateT > .6 ? 0 : 9;   // 升到一半以上就可以走過去
    for (const pl of G.players) { if (pl.dead) continue;
      // 尖刺：站在「升起來」的那格 → 受傷 + 出血（瞬移中無敵，可以直接穿過去）
      const ph = spikePhase(p, pl.y);
      if (ph === 'up' && p.spikes.some(s => Math.abs(s.x - pl.x) < 9 && Math.abs(s.y - (pl.y - 2)) < 9)) {
        G.hitCtx = { lv: p.d.lv }; hurtPlayer(pl, Math.round((10 + 3 * p.d.lv) * .75), pl.x, pl.y + 3, { bleed: 22 }); G.hitCtx = null; }
      // 隱藏的牆：揮刀的那一下，靠近而且面向裂開的牆 → 碎掉
      if (!p.wallOpen && p.wall.length && pl.swing && pl.swing !== p.lastSwing) {
        p.lastSwing = pl.swing;
        if (Math.hypot(pl.x - p.wallHint.x, pl.y - p.wallHint.y) < 32 && swingFace(pl, p.wallHint.x, p.wallHint.y)) {
          flags.add(fWall(p)); setWall(p, true); sfx.boom(); shake(5, .3); save();
          for (const { tx, ty } of p.wall) burst(tx * TS + 8, ty * TS + 8, 18, '#6a6478', 90);
          toast('牆碎掉了……後面有一條隱藏的通道', '#c8a8ff'); }
      }
    }
  }
}
/* 尖刺這一刻在那一排是「收著 / 快升起來（預警）/ 升起來」：每排相隔 0.32 秒，一次升兩排，像浪一樣從下往上推 */
const SP_T = 2.4, SP_ROW = .32, SP_UP = .62, SP_WARN = .4;
function rowPhase(row: number): 'down' | 'warn' | 'up' { const u = ((G.time - row * SP_ROW) % SP_T + SP_T) % SP_T; return u < SP_UP ? 'up' : u > SP_T - SP_WARN ? 'warn' : 'down'; }
function spikePhase(p: Puz, y: number) { const s = p.spikes.find(s => Math.abs(s.y - (y - 2)) < 8); return s ? rowPhase(s.row) : 'down'; }

/* ---- 互動（ui/interact.ts）：火盆 = 點燃、壁畫 = 查看 ---- */
export function puzzleTarget(pl: Player): { btn: string; text: string; run: () => void } | null {
  for (const p of PUZZLES) {
    if (!p.gateOpen) for (const b of p.braz) if (!b.lit && Math.hypot(b.x - pl.x, b.y - pl.y) < 22) return { btn: '點燃', text: '點燃火盆', run: () => light(p, b, pl) };
    if (Math.abs(p.mural.x - pl.x) < 34 && pl.y - p.mural.y < 40 && pl.y > p.mural.y) return { btn: '查看', text: '查看壁畫', run: () => toast('壁畫上從左到右刻著四個符號：' + p.order.map(s => ({ moon: '月', sun: '日', star: '星', eye: '眼' })[s]).join('、') + '。火盆上也刻著一樣的符號', '#e8dcff') };
  }
  return null;
}
function light(p: Puz, b: Brazier, pl: Player) {
  b.lit = true; sfx.fire(); burst(b.x, b.y - 10, 10, SYM_COL[b.sym], 50);
  if (p.order[p.got] === b.sym) { p.got++;
    if (p.got >= 4) { flags.add(fFire(p)); p.gateOpen = true; p.gateT = 0; sfx.level(); shake(4, .5); showBanner('遠處傳來鐵柵門升起的聲音', '', 2400); save(); }
    return; }
  // 點錯：火焰暴走 → 燒你一下、叫出兩隻守墓的食屍鬼，火全部熄掉
  p.got = 0; for (const x of p.braz) x.lit = false;
  for (const x of p.braz) { burst(x.x, x.y - 10, 16, '#ff6a2a', 90); G.fx.push({ k: 'warp', x: x.x, y: x.y - 6, r0: 4, r1: 30, th: 4, t: 0, d: .4, col: '#ff8a3a' }); }
  G.hitCtx = { lv: p.d.lv }; hurtPlayer(pl, Math.round((10 + 3 * p.d.lv) * .6), b.x, b.y, { burn: 2 }); G.hitCtx = null;
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
    // 壁畫：一塊刻著四個發光符號的石板
    if (vis(p.mural.x, p.mural.y, 50)) { list.push({ y: p.mural.y - 100, f: () => { const x = p.mural.x, y = p.mural.y - 10;
      ctx.fillStyle = '#1e1a24'; ctx.fillRect(snapF(x - 34), snapF(y - 11), 68, 22); ctx.fillStyle = '#4a4558'; ctx.fillRect(snapF(x - 32), snapF(y - 9), 64, 18);
      ctx.fillStyle = '#6a6478'; ctx.fillRect(snapF(x - 32), snapF(y - 9), 64, HK * 2); ctx.fillStyle = '#2e2a36'; ctx.fillRect(snapF(x - 32), snapF(y + 9 - HK * 2), 64, HK * 2);
      p.order.forEach((s, k) => { ctx.fillStyle = '#2e2a36'; ctx.fillRect(snapF(x - 28 + k * 15), snapF(y - 6), 12, 12);           // 四格凹槽，各刻一個發光的符號
        drawSym(s, x - 22 + k * 15, y, SYM_COL[s], .7 + .3 * Math.sin(G.time * 2 + k), 5); });
      for (let k = 0; k < 3; k++) { ctx.fillStyle = '#8a8494'; ctx.fillRect(snapF(x - 15.5 + k * 15), snapF(y - HK), HK * 2, HK * 2); } } });   // 中間的小點 = 「然後」
      addLight(L, p.mural.x, p.mural.y - 10, 26, 3); }
    // 火盆：石座 + 火盆；點燃 = 火焰 + 光；符號刻在石座上
    for (const b of p.braz) { if (!vis(b.x, b.y, 30)) continue;
      list.push({ y: b.y, f: () => { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(snapF(b.x - 8), snapF(b.y - 1), 16, 3);
        ctx.fillStyle = '#1e1a24'; ctx.fillRect(snapF(b.x - 7), snapF(b.y - 14), 14, 14); ctx.fillStyle = '#4a4558'; ctx.fillRect(snapF(b.x - 6), snapF(b.y - 14), 12, 13);   // 石座
        ctx.fillStyle = '#6a6478'; ctx.fillRect(snapF(b.x - 6), snapF(b.y - 14), 12, HK * 2);
        ctx.fillStyle = '#2a1a0e'; ctx.fillRect(snapF(b.x - 9), snapF(b.y - 18), 18, 4); ctx.fillStyle = '#7a5a30'; ctx.fillRect(snapF(b.x - 9), snapF(b.y - 18), 18, HK * 2);   // 鐵火盆
        ctx.fillStyle = '#1a120a'; ctx.fillRect(snapF(b.x - 7), snapF(b.y - 18 + HK * 2), 14, HK * 2);
        drawSym(b.sym, b.x, b.y - 7, b.lit ? SYM_COL[b.sym] : '#b8b0c8', b.lit ? 1 : .6 + .2 * Math.sin(G.time * 3 + b.x), 4);
        if (b.lit) flame(b.x, b.y - 18, 6, b.x * .1); } });
      if (b.lit) addLight(L, b.x, b.y - 20, 52 + Math.sin(G.time * 9 + b.x) * 2, 1); }
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
