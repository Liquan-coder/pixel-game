/* ================= 地城的陷阱房（三）：火輪、滾石、凝視石像、落石迴廊、交替石板、幽靈之橋、箭陣 =================
   每一種只在一座地城出現（world/dungeons.ts 的 PUZ 表）：每座地城的陷阱房都不一樣。
   陷阱房沒有門要開：走得過去就好。這個檔案被 main.ts 載入時，會把自己登記進 MECHS。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { LAVA, MW, PROPS, TS, WATER, map } from './map';
import type { Room } from './dungeons';
import { flame } from './chunks';
import { applyFx } from '../game/status';
import { burst, shake } from '../game/worldUpdate';
import { teleCircle } from '../render/enemy';
import { toast } from '../ui/hud';
import { flags } from '../game/quest';
import type { Player } from '../types';
import { MECHS, floorAt, hitP, inner, knockBack, pedestal, route, tileOf, walk, type Puz } from './puzzles';

const key = (tx: number, ty: number) => ty * MW + tx;
const inBox = (r: Room, tx: number, ty: number, pad = 0) => Math.abs(tx - r.x) <= r.rx + pad && Math.abs(ty - r.y) <= r.ry + pad;
const plTile = (pl: Player) => tileOf(pl.x, pl.y - 2);
const busyMove = (pl: Player) => pl.dodge > 0 || !!pl.dash;
const inRoom = (r: Room, pl: Player) => { const [tx, ty] = plTile(pl); return inBox(r, tx, ty); };
const anyIn = (r: Room) => G.players.some(pl => !pl.dead && inRoom(r, pl));
/** 房間裡的座標系：a = 往旁邊幾格、b = 從入口往裡面幾格 */
function local(p: Puz) { const D = p.inD, F = [-[1, 0, -1, 0][D.side], -[0, 1, 0, -1][D.side]], Lt = [F[1], -F[0]], depth = D.side % 2 ? p.room.ry * 2 + 1 : p.room.rx * 2 + 1;
  return { at: (a: number, b: number) => [D.x + F[0] * b + Lt[0] * a, D.y + F[1] * b + Lt[1] * a], depth, F, Lt }; }
/** 一條路（route）：路上的格子留著，房間其他的地板變成坑（水 / 熔岩） */
function pitRoom(p: Puz, cells: number[][], pit: number) {
  const r = p.room, keep = new Set(cells.map(([x, y]) => key(x, y)));
  for (let ty = r.y - r.ry; ty <= r.y + r.ry; ty++) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) if (floorAt(tx, ty) && !keep.has(key(tx, ty))) map[key(tx, ty)] = pit;
}

/* ---------- 火輪（熔岩隧道）：兩根石柱上各插一串火球，一根順時針、一根逆時針轉。看準空檔鑽過去 ---------- */
const FB_SPD = 1.45, FB_N = 5;
const fbBalls = (q) => { const a = q.a0 + q.dir * G.time * FB_SPD, out: number[][] = []; for (let k = 0; k < FB_N; k++) { const d = 12 + k * 11; out.push([q.x + Math.cos(a) * d, q.y - 6 + Math.sin(a) * d * .8]); } return out; };
MECHS.firebar = {
  setup(p, r, R) {
    const piv = [[-3, 0], [3, 0]].map(([ox, oy], i) => { const x = (r.x + ox) * TS + 8, y = (r.y + oy) * TS + 10; PROPS.push({ x, y, r: 6 }); return { x, y, dir: i ? -1 : 1, a0: R() * TAU }; });
    return { r, piv };
  },
  update(p, st) {
    for (const pl of G.players) { if (pl.dead || busyMove(pl) || !inRoom(st.r, pl)) continue;
      for (const q of st.piv) if (fbBalls(q).some(([x, y]) => Math.hypot(x - pl.x, y - (pl.y - 6)) < 9)) { hitP(p, pl, .55, { burn: 2.5 }, q.x, q.y); break; } }
  },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 60)) return;
    for (const q of st.piv) {
      list.push({ y: q.y, f: () => { pedestal(q.x, q.y, 10); ctx.fillStyle = '#2a1a0e'; ctx.fillRect(snapF(q.x - 3), snapF(q.y - 14), 6, 4); } });
      list.push({ y: q.y + 60, f: () => { for (const [x, y] of fbBalls(q)) { ctx.fillStyle = '#c8401a'; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y), 6, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y - 1), 4, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff0b0'; ctx.fillRect(snapF(x - 1), snapF(y - 2), 2, 2); } } });
      for (const [x, y] of fbBalls(q)) addLight(L, x, y, 26, 1);
      if (Math.random() < .3) { const [x, y] = pick(fbBalls(q)); G.parts.push({ x, y, vx: rr(-10, 10), vy: -rr(10, 30), life: .4, max: .4, col: pick(['#ffe38a', '#ff9a3a']), s: 1 }); } }
  },
};

/* ---------- 滾石（沙埋神殿）：地上一條一條的溝。轟隆聲 + 牆邊冒灰 → 大石頭沿著那條溝滾過去。站在溝和溝中間就安全 ---------- */
const RS_WARN = .9, RS_SPD = 210;
MECHS.rollstone = {
  setup(p, r) { const lanes: number[] = []; for (let y = r.y - r.ry + 1; y <= r.y + r.ry - 1; y += 3) lanes.push(y); return { r, lanes, cur: null, next: 1, last: -1 }; },
  update(p, st, dt) {
    const r = st.r;
    if (!st.cur) { if (!anyIn(r)) return; st.next -= dt; if (st.next > 0) return;
      let i = Math.floor(Math.random() * st.lanes.length); if (i === st.last) i = (i + 1) % st.lanes.length; st.last = i;
      const dir = Math.random() < .5 ? 1 : -1; st.cur = { y: st.lanes[i] * TS + 8, dir, x: (dir > 0 ? r.x - r.rx : r.x + r.rx) * TS + 8 - dir * 10, t: 0, rot: 0 }; sfx.boom(); shake(1.5, .3); return; }
    const c = st.cur; c.t += dt;
    if (c.t < RS_WARN) { if (Math.random() < .6) G.parts.push({ x: c.x + rr(-6, 6), y: c.y - rr(4, 16), vx: c.dir * rr(5, 20), vy: rr(5, 20), life: .6, max: .6, col: pick(['#c8a060', '#8a7a5a']), s: 1 }); return; }
    c.x += c.dir * RS_SPD * dt; c.rot += c.dir * dt * 9;
    for (const pl of G.players) if (!pl.dead && !busyMove(pl) && Math.abs(pl.x - c.x) < 15 && Math.abs(pl.y - 4 - c.y) < 13) hitP(p, pl, 1, { stun: .3 }, c.x - c.dir * 20, c.y);
    if ((c.dir > 0 && c.x > (r.x + r.rx) * TS + 14) || (c.dir < 0 && c.x < (r.x - r.rx) * TS + 2)) { burst(c.x, c.y, 14, '#8a7a5a', 80); sfx.boom(); shake(2, .15); st.cur = null; st.next = .8 + Math.random() * .7; }
  },
  draw(p, st, vis, list) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 60)) return;
    list.push({ y: (r.y - r.ry) * TS - 300, f: () => { for (const ly of st.lanes) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) { if (!floorAt(tx, ly)) continue;   // 滾石的溝
      ctx.fillStyle = 'rgba(40,28,16,.55)'; ctx.fillRect(tx * TS, ly * TS + 3, TS, 10); ctx.fillStyle = 'rgba(200,160,96,.18)'; ctx.fillRect(tx * TS, ly * TS + 3, TS, HK * 2); } } });
    const c = st.cur; if (!c) return;
    if (c.t < RS_WARN) { list.push({ y: c.y - 200, f: () => { ctx.globalAlpha = .5 + .5 * Math.sin(G.time * 30); ctx.fillStyle = '#ff6a4a';   // 預警：溝的起點閃紅色箭頭
      for (let k = 0; k < 3; k++) { const x = c.x + c.dir * (16 + k * 10); ctx.fillRect(snapF(x), snapF(c.y - 3), 4, 6); ctx.fillRect(snapF(x + c.dir * 4), snapF(c.y - 1), 2, 2); } ctx.globalAlpha = 1; } }); return; }
    list.push({ y: c.y + 6, f: () => { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 6, 13, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6a5a44'; ctx.beginPath(); ctx.ellipse(c.x, c.y - 5, 13, 13, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#9a8a6a'; ctx.beginPath(); ctx.ellipse(c.x - 4, c.y - 9, 5, 4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3a2e20'; ctx.lineWidth = HK * 2; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(c.rot) * 10, c.y - 5 + Math.sin(c.rot) * 10); ctx.lineTo(c.x - Math.cos(c.rot) * 10, c.y - 5 - Math.sin(c.rot) * 10); ctx.stroke(); } });
  },
};

/* ---------- 凝視石像（王城地下墓所）：房間盡頭一尊背對你的巨大石像。眼睛發橘光 = 要轉過來了；發紅光 = 正在看。
   它看著的時候你在動（而且沒躲在石柱後面）→ 一道紅光把你打回入口。木頭人 ---------- */
const GZ = { away: 2.6, warn: .8, watch: 2 }, GZ_T = GZ.away + GZ.warn + GZ.watch;
const gzPh = () => { const u = G.time % GZ_T; return u < GZ.away ? 'away' : u < GZ.away + GZ.warn ? 'warn' : 'watch'; };
MECHS.gaze = {
  setup(p, r) {
    const Lc = local(p), O = p.outD, opp = O.side === (p.inD.side + 2) % 4, la = (O.x - p.inD.x) * Lc.Lt[0] + (O.y - p.inD.y) * Lc.Lt[1];   // 出口在正對面 → 石像挪到出口的另一邊
    const [sx, sy] = Lc.at(opp ? (la > 0 ? -4 : 4) : 0, Lc.depth - 1), s = { x: sx * TS + 8, y: sy * TS + 12 }; PROPS.push({ x: s.x, y: s.y, r: 9 });
    const covers = [[-3, 3], [3, 5], [-2, 8], [3, Lc.depth - 4]].filter(([, b]) => b < Lc.depth - 2).map(([a, b]) => { const [tx, ty] = Lc.at(a, b), c = { x: tx * TS + 8, y: ty * TS + 10, r: 8 };
      if (floorAt(tx, ty)) PROPS.push(c); return c; }).filter(c => floorAt(Math.floor(c.x / TS), Math.floor(c.y / TS)));
    return { r, s, covers, start: { x: p.inD.x * TS + 8, y: p.inD.y * TS + 8 }, zap: 0, zx: 0, zy: 0 };
  },
  update(p, st, dt) {
    if (st.zap > 0) st.zap -= dt; const ph = gzPh();
    if (ph === 'warn' && !flags.has('puz:hint:gaze') && G.me && inRoom(st.r, G.me)) { flags.add('puz:hint:gaze'); toast('石像的眼睛亮了……它要轉過來了。它看著你的時候，不要動', '#ff9a6a'); }
    if (ph !== 'watch') return;
    for (const pl of G.players) { if (pl.dead || !inRoom(st.r, pl) || !(pl.moving || busyMove(pl))) continue;
      const dx = pl.x - st.s.x, dy = pl.y - 8 - (st.s.y - 30), d = Math.hypot(dx, dy); let hid = false;
      for (let k = 10; k < d && !hid; k += 4) { const x = st.s.x + dx / d * k, y = st.s.y - 30 + dy / d * k; if (st.covers.some(c => Math.hypot(c.x - x, c.y - 8 - y) < c.r + 2)) hid = true; }
      if (hid) continue;
      st.zap = .3; st.zx = pl.x; st.zy = pl.y - 8; sfx.skill(); hitP(p, pl, .35, { stun: .2 }); knockBack(p, pl, st.start.x, st.start.y, .06, '石像看見你在動了……', '#ff6a5a'); }
  },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 80)) return; const ph = gzPh(), S = st.s;
    if (ph === 'watch') list.push({ y: (r.y - r.ry) * TS - 290, f: () => { ctx.globalAlpha = .1 + .04 * Math.sin(G.time * 10); ctx.fillStyle = '#ff2a2a';   // 看著的時候整間房染紅
      ctx.fillRect((r.x - r.rx) * TS, (r.y - r.ry) * TS, (r.rx * 2 + 1) * TS, (r.ry * 2 + 1) * TS); ctx.globalAlpha = 1; } });
    list.push({ y: S.y, f: () => { pedestal(S.x, S.y, 12); ctx.fillStyle = '#3a3646'; ctx.fillRect(snapF(S.x - 13), snapF(S.y - 36), 26, 8); ctx.fillRect(snapF(S.x - 10), snapF(S.y - 30), 20, 18);   // 肩膀 + 身體
      ctx.fillStyle = '#5a5468'; ctx.fillRect(snapF(S.x - 13), snapF(S.y - 36), 26, 2); ctx.fillRect(snapF(S.x - 7), snapF(S.y - 50), 14, 14);                   // 頭（兜帽）
      ctx.fillStyle = '#4a4558'; ctx.fillRect(snapF(S.x - 8), snapF(S.y - 52), 16, 5);
      if (ph === 'away') { ctx.fillStyle = '#4a4558'; ctx.fillRect(snapF(S.x - 5), snapF(S.y - 46), 10, 6); ctx.fillStyle = '#9a6ae8'; ctx.globalAlpha = .5 + .3 * Math.sin(G.time * 2); ctx.fillRect(snapF(S.x - 1), snapF(S.y - 47), 2, 5); ctx.fillRect(snapF(S.x - 3), snapF(S.y - 45), 6, 1); ctx.globalAlpha = 1; }   // 背對：後腦勺上一個淡紫色的符文
      else { const c = ph === 'warn' ? (Math.floor(G.time * 12) % 2 ? '#ffb040' : '#8a5a20') : '#ff3a3a'; ctx.fillStyle = '#16121c'; ctx.fillRect(snapF(S.x - 5), snapF(S.y - 46), 10, 4);
        ctx.fillStyle = c; ctx.fillRect(snapF(S.x - 4), snapF(S.y - 45), 3, 2); ctx.fillRect(snapF(S.x + 1), snapF(S.y - 45), 3, 2); } } });
    if (ph !== 'away') addLight(L, S.x, S.y - 44, ph === 'watch' ? 70 : 34, 1);
    for (const c of st.covers) list.push({ y: c.y, f: () => { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(snapF(c.x - 9), snapF(c.y - 2), 18, 4);
      ctx.fillStyle = '#3a3646'; ctx.fillRect(snapF(c.x - 7), snapF(c.y - 26), 14, 26); ctx.fillStyle = '#5a5468'; ctx.fillRect(snapF(c.x - 7), snapF(c.y - 26), 14, 3); ctx.fillRect(snapF(c.x - 7), snapF(c.y - 26), 3, 26); } });
    if (st.zap > 0) list.push({ y: st.zy + 40, f: () => { ctx.globalAlpha = st.zap / .3; ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(S.x, S.y - 44); ctx.lineTo(st.zx, st.zy); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1; } });
  },
};

/* ---------- 落石迴廊（樹根地穴）：樹根把天花板撐裂了。走進房間，頭頂就一直掉石頭：地上的紅圈 = 1 秒後會砸下來 ---------- */
const RF_T = 1.05;
MECHS.rockfall = {
  setup(p, r) { return { r, rocks: [] as any[], acc: 0 }; },
  update(p, st, dt) {
    const r = st.r, ins = G.players.filter(pl => !pl.dead && inRoom(r, pl));
    if (ins.length && (st.acc += dt) > .42) { st.acc = 0; const pl = pick(ins);
      if ((st.n = (st.n || 0) + 1) % 2) st.rocks.push({ x: pl.x + rr(-4, 4), y: pl.y - 2 + rr(-4, 4), t: 0, hit: false });             // 每兩顆有一顆對準你站的地方
      else for (let t = 0; t < 8; t++) { const tx = Math.floor(pl.x / TS) + Math.round(rr(-3, 3)), ty = Math.floor(pl.y / TS) + Math.round(rr(-3, 3)); if (!inBox(r, tx, ty) || !floorAt(tx, ty)) continue;
        st.rocks.push({ x: tx * TS + 8 + rr(-4, 4), y: ty * TS + 8 + rr(-4, 4), t: 0, hit: false }); break; } }
    for (const k of st.rocks) { k.t += dt;
      if (!k.hit && k.t >= RF_T) { k.hit = true; burst(k.x, k.y, 8, '#6a5a48', 60);
        if (G.players.some(pl => !pl.dead && Math.hypot(pl.x - k.x, pl.y - k.y) < 120)) { sfx.hit(); shake(1.5, .1); }
        for (const pl of G.players) if (!pl.dead && !busyMove(pl) && Math.hypot(pl.x - k.x, pl.y - 2 - k.y) < 15) hitP(p, pl, .7, { stun: .35 }, k.x, k.y); } }
    st.rocks = st.rocks.filter(k => k.t < RF_T + .5);
  },
  draw(p, st, vis, list) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 60)) return;
    if (anyIn(r) && Math.random() < .4) G.parts.push({ x: (r.x + rr(-r.rx, r.rx)) * TS, y: (r.y + rr(-r.ry, r.ry)) * TS - 20, vx: rr(-3, 3), vy: rr(30, 60), life: .5, max: .5, col: pick(['#8a7a5a', '#5a4a3a']), s: 1 });   // 天花板一直掉灰
    for (const k of st.rocks) {
      if (k.t < RF_T) teleCircle(k.x, k.y, 15, k.t / RF_T);
      if (k.t > RF_T - .3 && k.t < RF_T) { const u = (k.t - (RF_T - .3)) / .3; list.push({ y: k.y + 1, f: () => { const y = k.y - 120 * (1 - u);
        ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(k.x, y - 6, 7, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#8a7a5a'; ctx.fillRect(snapF(k.x - 3), snapF(y - 10), 4, 3); } }); }
      else if (k.t >= RF_T) list.push({ y: k.y - 150, f: () => { ctx.globalAlpha = Math.max(0, 1 - (k.t - RF_T) / .5); ctx.fillStyle = '#4a3e30';
        for (const [ox, oy] of [[-5, 1], [3, -2], [5, 3], [-1, 4]]) ctx.fillRect(snapF(k.x + ox), snapF(k.y + oy), 3, 3); ctx.globalAlpha = 1; } });
    }
  },
};

/* ---------- 交替石板（熔爐地底遺跡）：熔岩池上只有一條石板路，石板分成藍、橘兩組，輪流沉下去（快沉的那組會閃）。跟著節奏換腳 ---------- */
const AL_T = 4.4, AL_ON = 2.4, AL_WARN = .6;
const alV = (set: number) => ((G.time - set * AL_T / 2) % AL_T + AL_T) % AL_T;
const alSolid = (set: number) => set < 0 || alV(set) < AL_ON;
MECHS.alternate = {
  setup(p, r, R) {
    const cells = walk(route(p, R)).filter(([x, y]) => inBox(r, x, y)), pit = p.cfg.pit === 'water' ? WATER : LAVA; pitRoom(p, cells, pit);
    const n = cells.length, tiles = new Map<number, any>();
    cells.forEach(([tx, ty], k) => tiles.set(key(tx, ty), { tx, ty, set: k < 3 || k > n - 4 ? -1 : Math.floor((k - 3) / 3) % 2 }));
    return { r, tiles, lava: pit === LAVA, start: { x: p.inD.x * TS + 8, y: p.inD.y * TS + 8 } };
  },
  update(p, st) {
    if (!flags.has('puz:hint:alt') && G.me && inRoom(st.r, G.me)) { flags.add('puz:hint:alt'); toast('藍色和橘色的石板輪流沉下去……快沉的會一直閃', '#ffb040'); }
    for (const pl of G.players) { if (pl.dead || busyMove(pl)) continue; const [tx, ty] = plTile(pl), t = st.tiles.get(key(tx, ty));
      if (t && !alSolid(t.set)) { knockBack(p, pl, st.start.x, st.start.y, .12, '石板沉下去了……', st.lava ? '#ff9a3a' : '#6ac0f0'); if (st.lava) applyFx(pl, { burn: 2 }); } }
  },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
    list.push({ y: (r.y - r.ry) * TS - 300, f: () => { for (const t of st.tiles.values()) { const x = t.tx * TS, y = t.ty * TS;
      if (!alSolid(t.set)) { ctx.fillStyle = st.lava ? '#7a1a08' : '#0e2440'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = st.lava ? '#e8743b' : '#3b6ea8'; ctx.globalAlpha = .6 + .2 * Math.sin(G.time * 5 + t.tx); ctx.fillRect(x + 1, y + 4, TS - 2, 10); ctx.globalAlpha = 1; continue; }
      if (t.set < 0) continue; const warn = alV(t.set) > AL_ON - AL_WARN, col = t.set ? '#ffb040' : '#8ac8ff';   // 石板上的符文：藍 / 橘兩組；快沉了 → 閃
      ctx.globalAlpha = warn ? (Math.floor(G.time * 14) % 2 ? .95 : .25) : .7; ctx.fillStyle = col; ctx.fillRect(x + 5, y + 5, 6, 6); ctx.fillStyle = '#16121c'; ctx.fillRect(x + 7, y + 7, 2, 2); ctx.globalAlpha = 1; } } });
    for (const t of st.tiles.values()) if (t.set >= 0 && alSolid(t.set) && (t.tx + t.ty) % 2 === 0) addLight(L, t.tx * TS + 8, t.ty * TS + 8, 18, t.set ? 1 : 2);
  },
};

/* ---------- 幽靈之橋（沉沒神殿地底）：整間房是看不見底的星空深淵，橋是看不見的。摸一下發光的石頭，橋會亮 5 秒（最後會淡掉）。
   橋上偶爾會閃過一點星光（細心的人看得出路）。踩空 → 回到入口 ---------- */
const GB_T = 5;
MECHS.ghostbridge = {
  setup(p, r, R) {
    const cells = walk(route(p, R)).filter(([x, y]) => inBox(r, x, y)), path = new Set(cells.map(([x, y]) => key(x, y)));
    const stones = [cells[1], cells[Math.floor(cells.length / 2)]].map(([tx, ty]) => ({ x: tx * TS + 8, y: ty * TS + 12 }));
    return { r, cells, path, stones, lit: 0, start: { x: p.inD.x * TS + 8, y: p.inD.y * TS + 8 } };
  },
  update(p, st, dt) {
    if (st.lit > 0) st.lit -= dt;
    for (const pl of G.players) { if (pl.dead || busyMove(pl)) continue; const [tx, ty] = plTile(pl); if (!inBox(st.r, tx, ty) || st.path.has(key(tx, ty))) continue;
      st.lit = 0; knockBack(p, pl, st.start.x, st.start.y, .1, '踩空了……', '#c8a8ff'); }
  },
  target(p, st, pl) { for (const s of st.stones) if (Math.hypot(s.x - pl.x, s.y - pl.y) < 22) return { btn: '觸摸', text: '觸摸發光的石頭', run: () => { st.lit = GB_T; sfx.skill(); burst(s.x, s.y - 14, 14, '#c8e8ff', 50);
    if (!flags.has('puz:hint:ghost')) { flags.add('puz:hint:ghost'); toast('深淵上浮出一條發光的路……很快就會消失', '#c8e8ff'); } } }; return null; },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
    const a = st.lit > 0 ? Math.min(1, st.lit / 1.5) : 0;
    list.push({ y: (r.y - r.ry) * TS - 300, f: () => {
      for (let ty = r.y - r.ry; ty <= r.y + r.ry; ty++) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) { if (!floorAt(tx, ty)) continue; const x = tx * TS, y = ty * TS;   // 深淵：深藍黑 + 一閃一閃的星星
        ctx.fillStyle = '#07060f'; ctx.fillRect(x, y, TS, TS); const h = (tx * 73 + ty * 151) % 97;
        if (h < 14) { ctx.globalAlpha = .4 + .4 * Math.sin(G.time * 2 + h); ctx.fillStyle = h < 5 ? '#c8e8ff' : '#6a6aa8'; ctx.fillRect(x + (h % 12) + 2, y + ((h * 7) % 12) + 2, HK * 2, HK * 2); ctx.globalAlpha = 1; } }
      if (a > 0) { ctx.globalAlpha = a * .85; for (const [tx, ty] of st.cells) { ctx.fillStyle = '#4a6a9a'; ctx.fillRect(tx * TS + 1, ty * TS + 1, TS - 2, TS - 2); ctx.fillStyle = '#c8e8ff'; ctx.fillRect(tx * TS + 1, ty * TS + 1, TS - 2, HK * 2); } ctx.globalAlpha = 1; } } });
    if (Math.random() < .08) { const [tx, ty] = pick(st.cells); G.parts.push({ x: tx * TS + rr(3, 13), y: ty * TS + rr(3, 13), vx: 0, vy: -4, life: .8, max: .8, col: '#e8f8ff', star: .8, drag: 1 }); }   // 橋上偶爾閃一下
    for (const s of st.stones) { list.push({ y: s.y, f: () => { pedestal(s.x, s.y, 8); ctx.fillStyle = st.lit > 0 ? '#e8f8ff' : '#8ab8e8'; ctx.beginPath(); ctx.ellipse(snapF(s.x), snapF(s.y - 13), 4, 5, 0, 0, TAU); ctx.fill(); } });
      addLight(L, s.x, s.y - 14, st.lit > 0 ? 40 : 24, 2); }
    if (a > 0) for (let i = 0; i < st.cells.length; i += 3) addLight(L, st.cells[i][0] * TS + 8, st.cells[i][1] * TS + 8, 22 * a, 2);
  },
};

/* ---------- 箭陣（螢月禁林）：地上藏著壓力板（仔細看，板子有一圈細縫）。踩到 → 喀一聲，牆上的精靈石像從兩邊射箭過來 ---------- */
MECHS.arrows = {
  setup(p, r, R) {
    const safe = [inner(p.inD), inner(p.outD), inner(p.inD, 2), inner(p.outD, 2)], plates = new Map<number, any>();
    for (let ty = r.y - r.ry; ty <= r.y + r.ry; ty++) for (let tx = r.x - r.rx + 1; tx <= r.x + r.rx - 1; tx++) {
      if (!floorAt(tx, ty) || safe.some(([x, y]) => Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1) || R() > .3) continue; plates.set(key(tx, ty), { tx, ty, cd: 0 }); }
    const rows = [...new Set([...plates.values()].map(q => q.ty))];
    return { r, plates, rows, arrows: [] as any[], on: new Map<Player, number>() };
  },
  update(p, st, dt) {
    const r = st.r;
    for (const q of st.plates.values()) if (q.cd > 0) q.cd -= dt;
    for (const pl of G.players) { if (pl.dead) continue; const [tx, ty] = plTile(pl), k = key(tx, ty), q = st.plates.get(k);
      if (q && st.on.get(pl) !== k && !busyMove(pl)) { q.cd = .6; sfx.hit(); const y = ty * TS + 6;
        for (const dir of [1, -1]) st.arrows.push({ x: (dir > 0 ? r.x - r.rx - 1 : r.x + r.rx + 1) * TS + 8, y, dir, t: dir > 0 ? -.3 : -.45 }); }
      st.on.set(pl, q ? k : -1); }
    for (const a of st.arrows) { a.t += dt; if (a.t < 0) continue; a.x += a.dir * 300 * dt;
      for (const pl of G.players) if (!pl.dead && !busyMove(pl) && Math.abs(pl.x - a.x) < 8 && Math.abs(pl.y - 8 - a.y) < 9) { hitP(p, pl, .45, { bleed: 14 }, a.x - a.dir * 10, a.y); a.dead = true; } }
    st.arrows = st.arrows.filter(a => !a.dead && Math.abs(a.x - r.x * TS) < (r.rx + 2) * TS);
  },
  draw(p, st, vis, list) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 60)) return;
    list.push({ y: (r.y - r.ry) * TS - 300, f: () => { for (const q of st.plates.values()) { const x = q.tx * TS, y = q.ty * TS;   // 壓力板：一圈細縫（踩下去 → 凹進去）
      ctx.fillStyle = q.cd > 0 ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.14)'; ctx.fillRect(x + 2, y + 2, 12, HK); ctx.fillRect(x + 2, y + 13, 12, HK); ctx.fillRect(x + 2, y + 2, HK, 12); ctx.fillRect(x + 13, y + 2, HK, 12);
      if (q.cd > 0) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 3, y + 3, 10, 10); } } } });
    for (const ty of st.rows) for (const s of [-1, 1]) { const x = (r.x + s * (r.rx + 1)) * TS + 8, y = ty * TS + 8;   // 兩邊牆上的精靈石像（射箭孔）
      list.push({ y: y + 6, f: () => { ctx.fillStyle = '#26443a'; ctx.fillRect(snapF(x - 4), snapF(y - 14), 8, 12); ctx.fillStyle = '#9ad8c8'; ctx.fillRect(snapF(x - 3), snapF(y - 13), 6, 3);
        ctx.fillStyle = '#16121c'; ctx.fillRect(snapF(x - s * 4 - 1), snapF(y - 4), 2, 2); } }); }
    for (const a of st.arrows) if (a.t >= 0) list.push({ y: a.y + 8, f: () => { ctx.fillStyle = '#e8dcc8'; ctx.fillRect(snapF(a.x - 7), snapF(a.y), 14, HK * 2);
      ctx.fillStyle = '#9ad8c8'; ctx.fillRect(snapF(a.x - a.dir * 7 - 1), snapF(a.y - 1), 3, 4); ctx.fillStyle = '#c8c8d8'; ctx.fillRect(snapF(a.x + a.dir * 7 - 1), snapF(a.y - HK), 3, HK * 4); } });
  },
};
void flame;
