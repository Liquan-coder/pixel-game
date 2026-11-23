/* ================= 地城的招牌機關（一）：潮汐、蛛網、強風、推石板、冷卻熔岩、冰面 =================
   哪座地城用哪一種：world/dungeons.ts 的 PUZ 表。這個檔案被 main.ts 載入時，會把自己登記進 MECHS。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { CLIFF, GROUND, LAVA, MW, PROPS, RFLOOR, TS, map } from './map';
import type { Room } from './dungeons';
import { flame } from './chunks';
import { flags } from '../game/quest';
import { applyFx } from '../game/status';
import { input } from '../game/player';
import { moveEnt } from '../game/collision';
import { burst, shake } from '../game/worldUpdate';
import { toast } from '../ui/hud';
import type { Player } from '../types';
import { MECHS, base, drawSym, floorAt, hitP, inner, knockBack, openGate, pedestal, setTile, tileOf, type Puz } from './puzzles';

const key = (tx: number, ty: number) => ty * MW + tx;
const inBox = (r: Room, tx: number, ty: number, pad = 0) => Math.abs(tx - r.x) <= r.rx + pad && Math.abs(ty - r.y) <= r.ry + pad;
function roomFloor(r: Room) { const out: number[][] = []; for (let ty = r.y - r.ry; ty <= r.y + r.ry; ty++) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) if (floorAt(tx, ty)) out.push([tx, ty]); return out; }
const plTile = (pl: Player) => tileOf(pl.x, pl.y - 2);
const busyMove = (pl: Player) => pl.dodge > 0 || !!pl.dash;

/* ---------- 潮汐（潮音石窟，第一間房）：退潮 → 預警（水慢慢漫上來）→ 漲潮（整間房淹水，只有石島是乾的） ---------- */
const TIDE = { low: 3.4, warn: 1.3, high: 3.2 }, TIDE_T = TIDE.low + TIDE.warn + TIDE.high;
const tidePh = () => { const u = G.time % TIDE_T; return u < TIDE.low ? 'low' : u < TIDE.low + TIDE.warn ? 'warn' : 'high'; };
MECHS.tide = {
  setup(p, r) {
    const isl = new Set<number>(), centers: number[][] = [], a = inner(p.inD), c = [r.x, r.y], e = inner(p.outD);   // 石島：從入口沿著「入口 → 房間中間 → 出口」每 4 格一座
    for (const [[x0, y0], [x1, y1]] of [[a, c], [c, e]]) { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 4));
      for (let k = x0 === a[0] && y0 === a[1] ? 0 : 1; k <= n; k++) centers.push([Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n)]); }
    for (const [cx, cy] of centers) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (floorAt(cx + dx, cy + dy)) isl.add(key(cx + dx, cy + dy));
    const wet = new Set(roomFloor(r).map(([x, y]) => key(x, y)).filter(k => !isl.has(k)));
    return { r, isl, wet, centers, warned: false };
  },
  update(p, st) {
    if (tidePh() !== 'high') return;
    for (const pl of G.players) { if (pl.dead || busyMove(pl)) continue; const [tx, ty] = plTile(pl); if (!st.wet.has(key(tx, ty))) continue;
      let best = st.centers[0], bd = Infinity; for (const c of st.centers) { const d = Math.hypot(c[0] - tx, c[1] - ty); if (d < bd) { bd = d; best = c; } }   // 被浪捲到最近的石島
      knockBack(p, pl, best[0] * TS + 8, best[1] * TS + 8, .08, '被浪捲走了……', '#6ac0f0'); applyFx(pl, { slow: 1.2 }); }
  },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return; const ph = tidePh(), u = G.time % TIDE_T;
    const a = ph === 'high' ? .8 : ph === 'warn' ? .8 * (u - TIDE.low) / TIDE.warn : 0;
    list.push({ y: (r.y - r.ry) * TS - 400, f: () => {
      for (const k of st.isl) { const tx = k % MW, ty = (k / MW) | 0; ctx.fillStyle = '#3a3a4a'; ctx.fillRect(tx * TS, ty * TS, TS, TS); ctx.fillStyle = '#5a5a6e'; ctx.fillRect(tx * TS + 1, ty * TS + 1, TS - 2, 3); }   // 石島
      if (a > 0) { ctx.globalAlpha = a; for (const k of st.wet) { const tx = k % MW, ty = (k / MW) | 0; ctx.fillStyle = '#2a5a98'; ctx.fillRect(tx * TS, ty * TS, TS, TS);
          ctx.fillStyle = '#6ac0f0'; ctx.fillRect(snapF(tx * TS + ((G.time * 8 + ty * 5) % 14)), ty * TS + 6, 3, HK * 2); } ctx.globalAlpha = 1; } } });
    if (ph === 'warn' && Math.random() < .5) { const k = pick([...st.wet]); burst((k % MW) * TS + 8, ((k / MW) | 0) * TS + 8, 2, '#a8dcff', 30); }
  },
};

/* ---------- 蛛網（蛛巢洞窟）：踩到會被纏住；牆上的火把可以「取火」，拿著火走過去網就會燒起來（會一路延燒）。Boss 大廳前的巨網也要燒掉 ---------- */
function setupWebs(p: Puz, r: Room, R: () => number, torches: number) {
  const webs = new Map<number, number>();                                // 0 = 網、>0 = 燒到第幾秒、-1 = 燒光了
  for (const [tx, ty] of roomFloor(r)) if (R() < .45) webs.set(key(tx, ty), 0);
  const tor: { x: number; y: number }[] = [];
  for (const [ox, oy] of [[-r.rx + 1, -r.ry + 1], [r.rx - 1, r.ry - 1], [r.rx - 1, -r.ry + 1]].slice(0, torches)) { let tx = r.x + ox, ty = r.y + oy;
    for (let k = 0; k < 4 && !floorAt(tx, ty); k++) { tx -= Math.sign(ox); ty -= Math.sign(oy); } if (floorAt(tx, ty)) { webs.delete(key(tx, ty)); tor.push({ x: tx * TS + 8, y: ty * TS + 12 }); PROPS.push({ x: tx * TS + 8, y: ty * TS + 12, r: 4 }); } }
  return { r, webs, tor };
}
let fireT = 0;                                                           // 手上的火還能燒幾秒（兩間房共用）
function webUpdate(p: Puz, st, dt: number) {
  for (const [k, v] of st.webs) if (v > 0) { const n = v + dt; st.webs.set(k, n > .5 ? -1 : n);
    if (v < .15 && n >= .15) for (const d of [1, -1, MW, -MW]) if (st.webs.get(k + d) === 0) st.webs.set(k + d, .01); }   // 延燒到旁邊的網
  for (const pl of G.players) { if (pl.dead) continue; const [tx, ty] = plTile(pl), k = key(tx, ty), w = st.webs.get(k);
    if (fireT > 0 && w === 0) st.webs.set(k, .01);
    else if (w === 0 && !busyMove(pl)) applyFx(pl, { root: .7, slow: 1 }); }
}
function webDraw(p: Puz, st, vis, list, L, addLight) {
  const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
  list.push({ y: (r.y - r.ry) * TS - 300, f: () => { for (const [k, v] of st.webs) { if (v < 0) continue; const x = (k % MW) * TS, y = ((k / MW) | 0) * TS;
    ctx.globalAlpha = v > 0 ? 1 - v * 2 : .7; ctx.fillStyle = v > 0 ? '#ffb040' : '#e8e8f4';
    for (let i = 0; i < 16; i += 2) { ctx.fillRect(snapF(x + i), snapF(y + i), HK * 2, HK * 2); ctx.fillRect(snapF(x + 15 - i), snapF(y + i), HK * 2, HK * 2); }   // X 形的網
    ctx.fillRect(snapF(x), snapF(y + 7.5), 16, HK); ctx.fillRect(snapF(x + 7.5), snapF(y), HK, 16); ctx.globalAlpha = 1;
    if (v > 0 && Math.random() < .3) G.parts.push({ x: x + rr(2, 14), y: y + rr(2, 14), vx: rr(-5, 5), vy: -rr(20, 40), life: .4, max: .4, col: pick(['#ffe38a', '#ff9a3a']), s: 1 }); } } });
  for (const t of st.tor) if (vis(t.x, t.y, 30)) { list.push({ y: t.y, f: () => { ctx.fillStyle = '#4a3018'; ctx.fillRect(snapF(t.x - 1), snapF(t.y - 18), 2, 18); flame(t.x, t.y - 18, 4, t.x * .1); } }); addLight(L, t.x, t.y - 20, 44, 1); }
}
const webTarget = (p: Puz, st, pl: Player) => { for (const t of st.tor) if (Math.hypot(t.x - pl.x, t.y - pl.y) < 22) return { btn: '取火', text: '從火把上取火', run: () => { fireT = 20; sfx.fire(); toast('手上點起了火——靠近蛛網就會燒起來（大概 20 秒）', '#ffb040'); } }; return null; };
MECHS.webs = { setup: (p, r, R) => setupWebs(p, r, R, 2), update: webUpdate, draw: webDraw, target: webTarget };
MECHS.webs3 = {
  setup: (p, r, R) => setupWebs(p, r, R, 1),
  update(p, st, dt) { webUpdate(p, st, dt); if (fireT > 0) fireT -= dt;
    if (!p.gateOpen && fireT > 0 && p.gate.length) for (const pl of G.players) if (p.gate.some(g => Math.hypot(g.x - pl.x, g.y - pl.y) < 30)) {   // 拿著火碰到巨網 → 燒掉
      for (const g of p.gate) burst(g.x, g.y - 10, 20, '#ff9a3a', 90); openGate(p); toast('巨大的蛛網燒了起來', '#ffb040'); } },
  draw(p, st, vis, list, L, addLight) {
    webDraw(p, st, vis, list, L, addLight);
    if (fireT > 0 && G.me && !G.me.dead) { list.push({ y: G.me.y + 1, f: () => flame(G.me.x + (G.me.flip ? -7 : 7), G.me.y - 20, 3.5, 2) }); addLight(L, G.me.x, G.me.y - 20, 60, 1); }   // 手上的火
    if (!p.gateOpen && p.gate.length && vis(p.gate[0].x, p.gate[0].y, 60)) { const g0 = p.gate[0], g1 = p.gate[p.gate.length - 1], cx = (g0.x + g1.x) / 2, cy = g0.y - 8, R = (g1.x - g0.x) / 2 + 12;
      list.push({ y: g0.y + 7, f: () => { ctx.strokeStyle = '#e8e8f4'; ctx.lineWidth = HK * 2; ctx.globalAlpha = .85;   // 巨網：放射狀的線 + 一圈一圈
        for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * .9); ctx.stroke(); }
        for (const rr2 of [.3, .55, .8, 1]) { ctx.beginPath(); ctx.ellipse(cx, cy, R * rr2, R * rr2 * .9, 0, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; } }); }
  },
  target: webTarget,
};

/* ---------- 強風（風蝕岩窟，第一間房）：平靜 → 預警（沙子開始飄）→ 一陣強風把人往一邊推，推進流沙。躲在岩石的下風處就吹不動 ---------- */
const WIND = { calm: 2.6, warn: .9, gust: 2.4 }, WIND_T = WIND.calm + WIND.warn + WIND.gust;
MECHS.wind = {
  setup(p, r, R) {
    const pits: { x: number; y: number; r: number }[] = [], rocks: { x: number; y: number }[] = [];
    for (const [ox, oy] of [[-3, -2], [3, 1], [-1, 3], [5, -3]]) { const tx = r.x + ox, ty = r.y + oy; if (floorAt(tx, ty)) pits.push({ x: tx * TS + 8, y: ty * TS + 8, r: 20 }); }
    for (const [ox, oy] of [[-5, 0], [0, -1], [2, 3], [-2, 1]]) { const tx = r.x + ox, ty = r.y + oy; if (!floorAt(tx, ty) || pits.some(q => Math.hypot(q.x - tx * TS - 8, q.y - ty * TS - 8) < 30)) continue;
      const x = tx * TS + 8, y = ty * TS + 10; rocks.push({ x, y }); PROPS.push({ x, y, r: 7 }); }
    return { r, pits, rocks, n: 0, acc: 0 };
  },
  update(p, st, dt) {
    const u = G.time % WIND_T, gust = u > WIND.calm + WIND.warn, dir = Math.floor(G.time / WIND_T) % 2 ? -1 : 1, r = st.r;
    for (const pl of G.players) { if (pl.dead) continue; const [tx, ty] = plTile(pl); if (!inBox(r, tx, ty, 1)) continue;
      if (gust && !busyMove(pl) && !st.rocks.some(k => (k.x - pl.x) * dir < 0 && Math.abs(k.x - pl.x) < 40 && Math.abs(k.y - pl.y) < 12)) moveEnt(pl, dir * 88 * dt, 0);   // 上風處有石頭 = 躲得住
      for (const q of st.pits) { const d = Math.hypot(q.x - pl.x, q.y - pl.y); if (d > q.r || busyMove(pl)) continue;   // 流沙：慢慢往中間拉、扣血
        moveEnt(pl, (q.x - pl.x) / (d || 1) * 26 * dt, (q.y - pl.y) / (d || 1) * 26 * dt); applyFx(pl, { slow: .4 });
        st.acc += pl.maxHp * .04 * dt; if (st.acc >= 1) { const v = Math.floor(st.acc); st.acc -= v; pl.hp -= v; G.nums.push({ x: pl.x, y: pl.y - 26, txt: String(v), col: '#d8b878', t: 0, d: .6 }); if (pl.hp <= 0) { pl.hp = 1; } } } }
  },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return; const u = G.time % WIND_T, dir = Math.floor(G.time / WIND_T) % 2 ? -1 : 1;
    for (const q of st.pits) list.push({ y: q.y - 300, f: () => { for (let k = 0; k < 4; k++) { ctx.globalAlpha = .5 - k * .1; ctx.strokeStyle = k % 2 ? '#8a6a3a' : '#c8a060'; ctx.lineWidth = HK * 3;   // 流沙：轉圈的同心圓
      ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r * (1 - k * .22), q.r * (1 - k * .22) * .6, G.time * (k % 2 ? 1.5 : -1.5), .3, TAU - .3); ctx.stroke(); } ctx.globalAlpha = 1; } });
    for (const k of st.rocks) list.push({ y: k.y, f: () => { ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(k.x, k.y - 6, 9, 8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#8a7a5a'; ctx.beginPath(); ctx.ellipse(k.x - 2, k.y - 9, 5, 4, 0, 0, TAU); ctx.fill(); } });
    const n = u > WIND.calm + WIND.warn ? 4 : u > WIND.calm ? 1 : 0;        // 風：沙子一條一條飛過去
    for (let i = 0; i < n; i++) if (Math.random() < .8) G.parts.push({ x: (r.x - dir * (r.rx + 1)) * TS + rr(-8, 8), y: (r.y + rr(-r.ry, r.ry)) * TS, vx: dir * rr(180, 260), vy: rr(-10, 10), life: .9, max: .9, col: pick(['#d8b878', '#e8d0a0']), s: 1 });
  },
};

/* ---------- 推石板（沙埋神殿，Boss 大廳前）：兩塊大石頭推到兩塊壓力板上 → 開門。推錯卡住了可以按重置 ---------- */
MECHS.boulders = {
  setup(p, r) {
    const mk = (tx: number, ty: number) => { const b = { tx, ty, x: tx * TS + 8, y: ty * TS + 8, sx: 0, sy: 0, t: 0, push: 0, home: [tx, ty], prop: { x: tx * TS + 8, y: ty * TS + 8, r: 7 } }; PROPS.push(b.prop); return b; };
    return { r, plates: [[r.x - 2, r.y - 2], [r.x + 2, r.y - 2]], bs: [mk(r.x - 4, r.y), mk(r.x + 4, r.y)], reset: { x: r.x * TS + 8, y: (r.y + 3) * TS + 12 } };
  },
  update(p, st, dt) {
    for (const b of st.bs) { if (b.t > 0) { b.t = Math.max(0, b.t - dt); const k = 1 - b.t / .22; b.x = (b.sx + (b.tx * TS + 8 - b.sx) * k); b.y = (b.sy + (b.ty * TS + 8 - b.sy) * k); } b.prop.x = b.x; b.prop.y = b.y; }
    if (!p.gateOpen && st.plates.every(([x, y]) => st.bs.some(b => b.tx === x && b.ty === y && b.t <= 0))) { sfx.boom(); openGate(p); }
    /* 怎麼算「在推」：搖桿主要朝哪個方向（上下左右）→ 人在石頭的那一邊、貼著它（跟碰撞用同一個中心點）→ 推 0.15 秒就滾一格，按著不放會一格一格接著推。
       石頭是圓的，撞上去本來會沿著表面滑開（偏 1px 就從旁邊溜走）→ 推的時候把人慢慢吸到石頭的中線上，像推箱子那樣 */
    for (const pl of G.players) { if (pl.dead) continue; const m = Math.hypot(input.mx, input.my); if (m < .25) { for (const b of st.bs) b.push = 0; continue; }   // 搖桿輕推也算
      const ax = Math.abs(input.mx) > Math.abs(input.my), dx = ax ? Math.sign(input.mx) : 0, dy = ax ? 0 : Math.sign(input.my);
      for (const b of st.bs) { const rx = b.tx * TS + 8 - pl.x, ry = b.ty * TS + 8 - pl.y, along = rx * dx + ry * dy, side = rx * dy - ry * dx;   // 用石頭「要去的格子」算：剛推完、還在滾的時候也算數
        if (!(along > 0 && along < 30 && Math.abs(side) < 11)) { b.push = 0; continue; }
        if (Math.abs(side) > .3) { const k = Math.sign(side) * Math.min(Math.abs(side), 70 * dt); moveEnt(pl, k * dy, -k * dx); }   // 吸到中線上（人可能卡牆，所以用 moveEnt）
        if (b.t > 0 || along > 18) continue;                                                                               // 還在滾 / 人還沒跟上：計時先不歸零
        b.push += dt; if (b.push < .15) continue; b.push = 0; const nx = b.tx + dx, ny = b.ty + dy;                       // 推 0.15 秒才動，免得擦過去就推走
        if (floorAt(nx, ny) && !st.bs.some(o => o !== b && o.tx === nx && o.ty === ny)) { b.sx = b.x; b.sy = b.y; b.tx = nx; b.ty = ny; b.t = .22; sfx.hit(); burst(b.x, b.y + 4, 6, '#c8a060', 40); } } }
  },
  draw(p, st, vis, list) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, 120)) return;
    for (const [tx, ty] of st.plates) { const on = st.bs.some(b => b.tx === tx && b.ty === ty), x = tx * TS + 8, y = ty * TS + 8;
      list.push({ y: y - 300, f: () => { ctx.fillStyle = '#2a2014'; ctx.fillRect(x - 7, y - 7, 14, 14); ctx.fillStyle = on ? '#c8a060' : '#6a5a3a'; ctx.fillRect(x - 6, y - 6, 12, 12); drawSym('sun', x, y, on ? '#ffe38a' : '#3a2e1c', 1, 4); } }); }
    for (const b of st.bs) list.push({ y: b.y + 4, f: () => { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 5, 9, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6a5a44'; ctx.beginPath(); ctx.ellipse(b.x, b.y - 2, 9, 9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#9a8a6a'; ctx.beginPath(); ctx.ellipse(b.x - 3, b.y - 5, 4, 3.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2e20'; ctx.fillRect(snapF(b.x + 1), snapF(b.y - 1), 4, HK * 2); } });
    const q = st.reset; list.push({ y: q.y, f: () => { pedestal(q.x, q.y, 9); ctx.fillStyle = '#8a7a5a'; ctx.fillRect(snapF(q.x - 2), snapF(q.y - 14), 4, 5); } });
  },
  reset(p, st) { for (const b of st.bs) { b.tx = b.home[0]; b.ty = b.home[1]; b.x = b.tx * TS + 8; b.y = b.ty * TS + 8; b.t = 0; } },
  target(p, st, pl) { const q = st.reset; if (!p.gateOpen && Math.hypot(q.x - pl.x, q.y - pl.y) < 20) return { btn: '重置', text: '把石頭放回原位', run: () => { for (const b of st.bs) { b.tx = b.home[0]; b.ty = b.home[1]; b.x = b.tx * TS + 8; b.y = b.ty * TS + 8; b.t = 0; } sfx.boom(); toast('石頭滾回了原來的地方', '#c8a060'); } }; return null; },
};

/* ---------- 冷卻熔岩（黑曜石窟，Boss 大廳前）：房間中間一條熔岩河。敲兩岸的冰晶 → 熔岩變成黑曜石 6 秒，最後 1.5 秒會裂開發光 → 變回熔岩 ---------- */
const COOL = 6, COOL_WARN = 1.5;
MECHS.cool = {
  setup(p, r) {
    const river: number[][] = [];
    for (const ty of [r.y - 1, r.y]) for (let tx = r.x - r.rx - 1; tx <= r.x + r.rx + 1; tx++) if (floorAt(tx, ty)) { river.push([tx, ty]); map[key(tx, ty)] = LAVA; }
    const cr = [[r.x - 3, r.y + 2], [r.x + 3, r.y - 3]].map(([tx, ty]) => { for (let k = 0; k < 3 && !floorAt(tx, ty); k++) ty += ty > r.y ? -1 : 1; const c = { x: tx * TS + 8, y: ty * TS + 12, bank: ty > r.y ? 1 : -1 }; PROPS.push({ x: c.x, y: c.y, r: 5 }); return c; });
    return { r, river, cr, t: 0 };
  },
  update(p, st, dt) {
    if (st.t <= 0) return; st.t -= dt;
    if (st.t <= 0) { for (const [tx, ty] of st.river) setTile(tx, ty, LAVA); sfx.fire();
      for (const pl of G.players) { if (pl.dead) continue; const [tx, ty] = plTile(pl); if (!st.river.some(([x, y]) => x === tx && y === ty)) continue;   // 還站在河上 → 燙傷、推回最近的岸
        const c = st.cr.reduce((a, b) => Math.abs(a.y - pl.y) < Math.abs(b.y - pl.y) ? a : b); knockBack(p, pl, c.x, c.y + (c.bank > 0 ? 10 : -10), .2, '熔岩又流回來了……', '#ff9a3a'); applyFx(pl, { burn: 2.5 }); } }
  },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
    for (const c of st.cr) { list.push({ y: c.y, f: () => { pedestal(c.x, c.y, 8); const on = st.t <= 0; ctx.fillStyle = on ? '#a8dcff' : '#4a6a8a';
      ctx.beginPath(); ctx.moveTo(c.x, c.y - 24); ctx.lineTo(c.x + 5, c.y - 14); ctx.lineTo(c.x, c.y - 8); ctx.lineTo(c.x - 5, c.y - 14); ctx.closePath(); ctx.fill(); } }); addLight(L, c.x, c.y - 16, st.t <= 0 ? 30 : 16, 2); }
    if (st.t > 0) { const warn = st.t < COOL_WARN;
      list.push({ y: (r.y - 1) * TS - 300, f: () => { for (const [tx, ty] of st.river) { const x = tx * TS, y = ty * TS;   // 黑曜石：黑紫色；快熔了 → 裂縫發橘光
        ctx.fillStyle = '#1e1624'; ctx.fillRect(x, y, TS, TS); ctx.fillStyle = '#3a2e48'; ctx.fillRect(x + 1, y + 1, TS - 2, 3);
        if (warn) { ctx.globalAlpha = .5 + .5 * Math.sin(G.time * 20); ctx.fillStyle = '#ff9a3a'; ctx.fillRect(x + 3 + (tx % 3) * 3, y + 4, HK * 3, 8); ctx.fillRect(x + 2, y + 9, 10, HK * 3); ctx.globalAlpha = 1; } } } }); }
  },
  target(p, st, pl) { if (st.t > 0) return null; for (const c of st.cr) if (Math.hypot(c.x - pl.x, c.y - pl.y) < 22) return { btn: '敲擊', text: '敲擊冰晶', run: () => {
    st.t = COOL; for (const [tx, ty] of st.river) setTile(tx, ty, GROUND); sfx.skill(); shake(3, .3);
    for (const [tx, ty] of st.river) if (Math.random() < .4) burst(tx * TS + 8, ty * TS + 8, 3, '#a8dcff', 50);
    if (!flags.has('puz:hint:cool')) { flags.add('puz:hint:cool'); toast('冰晶的寒氣讓熔岩凝固了——趁現在走過去', '#a8dcff'); } } }; return null; },
};

/* ---------- 冰面（冰晶洞窟，第一間房）：整間房結冰，會滑、煞不住（有慣性）。地上有冰洞，掉進去會凍傷、回到入口 ---------- */
MECHS.ice = {
  setup(p, r, R) {
    const path = new Set<number>(), seg = (x0, y0, x1, y1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (const d of [0, 1, -1, MW, -MW]) path.add(key(x, y) + d); };
    for (const D of [p.inD, p.outD]) if (D.side % 2) { seg(D.x, D.y, D.x, r.y); seg(D.x, r.y, r.x, r.y); } else { seg(D.x, D.y, r.x, D.y); seg(r.x, D.y, r.x, r.y); }   // 入口 → 房間中間 → 出口的那條路旁邊不放洞（但會滑，還是要小心）
    const ice = new Set(roomFloor(r).map(([x, y]) => key(x, y))), holes = new Set<number>();
    for (const k of ice) if (!path.has(k) && R() < .22) holes.add(k);
    return { r, ice, holes, v: new Map<Player, { x: number; y: number }>(), start: { x: p.inD.x * TS + 8, y: p.inD.y * TS + 8 } };
  },
  update(p, st) {
    for (const pl of G.players) { if (pl.dead || busyMove(pl)) continue; const [tx, ty] = plTile(pl);
      if (st.holes.has(key(tx, ty))) { st.v.set(pl, { x: 0, y: 0 }); knockBack(p, pl, st.start.x, st.start.y, .12, '掉進冰洞了……', '#a8dcff'); applyFx(pl, { frost: 35 }); } }
  },
  move(p, st, pl, dt) {
    const [tx, ty] = plTile(pl); if (busyMove(pl) || !st.ice.has(key(tx, ty))) { st.v.delete(pl); return false; }
    const v = st.v.get(pl) || { x: 0, y: 0 }, A = 230, F = Math.pow(.4, dt), MX = 135;    // 加速慢、幾乎不減速 → 會滑
    v.x = (v.x + input.mx * A * dt) * F; v.y = (v.y + input.my * A * dt) * F; const sp = Math.hypot(v.x, v.y); if (sp > MX) { v.x *= MX / sp; v.y *= MX / sp; }
    const ox = pl.x, oy = pl.y; moveEnt(pl, v.x * dt, v.y * dt);
    if (Math.abs(pl.x - ox) < Math.abs(v.x * dt) * .5) v.x *= -.3; if (Math.abs(pl.y - oy) < Math.abs(v.y * dt) * .5) v.y *= -.3;   // 撞牆彈回來一點
    st.v.set(pl, v); pl.moving = sp > 10; if (sp > 10) { pl.face = Math.atan2(v.y, v.x); pl.flip = v.x < 0; pl.anim += dt * .5; }
    if (sp > 60 && Math.random() < .3) G.parts.push({ x: pl.x + rr(-3, 3), y: pl.y, vx: -v.x * .2, vy: -rr(5, 15), life: .3, max: .3, col: '#e8f8ff', s: 1 });
    return true;
  },
  draw(p, st, vis, list) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
    list.push({ y: (r.y - r.ry) * TS - 300, f: () => {
      ctx.globalAlpha = .32; ctx.fillStyle = '#a8dcff'; for (const k of st.ice) { if (st.holes.has(k)) continue; ctx.fillRect((k % MW) * TS, ((k / MW) | 0) * TS, TS, TS); }
      ctx.globalAlpha = .5; ctx.fillStyle = '#ffffff'; for (const k of st.ice) if ((k * 7) % 5 === 0 && !st.holes.has(k)) ctx.fillRect((k % MW) * TS + 3, ((k / MW) | 0) * TS + 4, 6, HK * 2);   // 反光
      ctx.globalAlpha = 1; for (const k of st.holes) { const x = (k % MW) * TS + 8, y = ((k / MW) | 0) * TS + 8;
        ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.ellipse(x, y, 8, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#1a3a6a'; ctx.beginPath(); ctx.ellipse(x, y + .5, 6.5, 4.5, 0, 0, TAU); ctx.fill(); } } });
  },
};
void CLIFF; void RFLOOR; void base;
