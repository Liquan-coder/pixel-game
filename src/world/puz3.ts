/* ================= 地城的招牌機關（二）：寒氣、彈跳蘑菇、黑暗迷宮、潛行、熔爐、光束鏡子 ================= */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { CLIFF, GROUND, MW, PILLAR, PROPS, RWALL, TS, WATER, map } from './map';
import type { Room } from './dungeons';
import { flame } from './chunks';
import { applyFx } from '../game/status';
import { makeEnemy } from '../game/enemies';
import { moveEnt } from '../game/collision';
import { burst, shake } from '../game/worldUpdate';
import { teleCircle } from '../render/enemy';
import { showBanner, toast } from '../ui/hud';
import type { Player } from '../types';
import { MECHS, floorAt, hitP, knockBack, openGate, pedestal, roomsOf, tileOf, type Puz } from './puzzles';

const key = (tx: number, ty: number) => ty * MW + tx;
const inBox = (r: Room, tx: number, ty: number, pad = 0) => Math.abs(tx - r.x) <= r.rx + pad && Math.abs(ty - r.y) <= r.ry + pad;
const plTile = (pl: Player) => tileOf(pl.x, pl.y - 2);
const busyMove = (pl: Player) => pl.dodge > 0 || !!pl.dash;
const findFloor = (tx: number, ty: number) => { for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (floorAt(tx + dx, ty + dy)) return [tx + dx, ty + dy]; return [tx, ty]; };
/** 拉桿：拉下就開門（擋住 = 不能拉，回傳原因） */
function lever(x: number, y: number) { PROPS.push({ x, y, r: 5 }); return { x, y }; }
function drawLever(list, lv: { x: number; y: number }, down: boolean) {
  list.push({ y: lv.y, f: () => { pedestal(lv.x, lv.y, 7); ctx.save(); ctx.translate(snapF(lv.x), snapF(lv.y - 7)); ctx.rotate(down ? .9 : -.9);
    ctx.fillStyle = '#4a3018'; ctx.fillRect(-1, -12, 2, 12); ctx.fillStyle = down ? '#7ae07a' : '#e04a3a'; ctx.fillRect(-2.5, -14, 5, 4); ctx.restore(); } });
}

/* ---------- 寒氣（霜墓）：在這兩間房裡會一直累積凍傷（滿了就冰凍）。點亮火盆，火盆旁邊是暖的。Boss 大廳前那間的四個火盆都點亮 → 開門 ---------- */
function setupCold(p: Puz, r: Room, spots: number[][]) {
  const braz = spots.map(([ox, oy]) => { const [tx, ty] = findFloor(r.x + ox, r.y + oy), b = { x: tx * TS + 8, y: ty * TS + 10, lit: false }; PROPS.push({ x: b.x, y: b.y, r: 5 }); return b; });
  return { r, braz, acc: 0 };
}
function coldUpdate(p: Puz, st, dt: number, gateRoom: boolean) {
  if (gateRoom && !p.gateOpen && st.braz.length && st.braz.every(b => b.lit)) openGate(p);
  if (gateRoom && p.gateOpen) for (const b of st.braz) b.lit = true;
  st.acc += dt; if (st.acc < .5) return; st.acc = 0;
  for (const pl of G.players) { if (pl.dead) continue; const [tx, ty] = plTile(pl); if (!inBox(st.r, tx, ty)) continue;
    if (!st.braz.some(b => b.lit && Math.hypot(b.x - pl.x, b.y - pl.y) < 56)) applyFx(pl, { frost: 6 }); }   // 每 0.5 秒 +6 → 大概 8 秒就會被凍住
}
function coldDraw(p: Puz, st, vis, list, L, addLight) {
  const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
  if (Math.random() < .5) G.parts.push({ x: (r.x + rr(-r.rx, r.rx)) * TS, y: (r.y - r.ry) * TS, vx: rr(-6, 6), vy: rr(14, 26), life: 2, max: 2, col: pick(['#ffffff', '#dce8f4']), s: 1 });   // 飄雪
  for (const b of st.braz) { list.push({ y: b.y, f: () => { if (b.lit) { ctx.globalAlpha = .12; ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 56, 40, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    pedestal(b.x, b.y); ctx.fillStyle = '#2a1a0e'; ctx.fillRect(snapF(b.x - 8), snapF(b.y - 17), 16, 3); if (b.lit) flame(b.x, b.y - 17, 6, b.x * .1);
    else { ctx.fillStyle = '#dce8f4'; ctx.fillRect(snapF(b.x - 6), snapF(b.y - 18), 12, HK * 3); } } });   // 沒點的火盆上積著霜
    if (b.lit) addLight(L, b.x, b.y - 20, 60, 1); }
}
const coldTarget = (p: Puz, st, pl: Player) => { for (const b of st.braz) if (!b.lit && Math.hypot(b.x - pl.x, b.y - pl.y) < 22) return { btn: '點燃', text: '點燃火盆（取暖）', run: () => { b.lit = true; sfx.fire(); burst(b.x, b.y - 16, 12, '#ffb040', 50); } }; return null; };
MECHS.cold = { setup: (p, r) => setupCold(p, r, [[-3, 0], [3, -2]]), update: (p, st, dt) => coldUpdate(p, st, dt, false), draw: coldDraw, target: coldTarget };
MECHS.cold3 = { setup: (p, r) => setupCold(p, r, [[-6, -1], [-2, 2], [2, -2], [6, 1]]), update: (p, st, dt) => coldUpdate(p, st, dt, true), draw: coldDraw, target: coldTarget, reset: (p, st) => { for (const b of st.braz) b.lit = false; } };

/* ---------- 彈跳蘑菇（腐根洞窟，Boss 大廳前）：整間房變成毒沼，只剩四座小島。踩上蘑菇會被彈到別的島；有些蘑菇是爛的，會把你丟進毒沼 ---------- */
MECHS.jump = {
  setup(p, r, R) {
    const { hall } = roomsOf(p.d), isl = new Set<number>(), I: number[][] = [];
    const island = (cx: number, cy: number, w: number, h: number) => { I.push([cx, cy]); for (let dy = -h; dy <= h; dy++) for (let dx = -w; dx <= w; dx++) isl.add(key(cx + dx, cy + dy)); };
    island(r.x, r.y + r.ry - 1, 1, 1);                                    // 0：入口（下面）
    island(r.x - 5, r.y, 1, 1); island(r.x + 5, r.y, 1, 1);               // 1、2：左右
    const top = r.y - r.ry + 1; island(r.x, top, 1, 0); for (let x = Math.min(r.x, hall.x); x <= Math.max(r.x, hall.x); x++) isl.add(key(x, top)), isl.add(key(x, top - 1));   // 3：上面（接到 Boss 大廳的通道）
    for (let ty = r.y - r.ry - 1; ty <= r.y + r.ry; ty++) for (let tx = r.x - r.rx - 1; tx <= r.x + r.rx + 1; tx++) if (floorAt(tx, ty) && inBox(r, tx, ty) && !isl.has(key(tx, ty))) map[key(tx, ty)] = WATER;
    for (const k of isl) if (inBox(r, k % MW, (k / MW) | 0, 1) && !floorAt(k % MW, (k / MW) | 0)) map[k] = GROUND;
    const { r2 } = roomsOf(p.d), s2 = Math.sign(r2.x - r.x) || 1; for (let k = 5; k <= r.rx + 1; k++) isl.add(key(r.x + s2 * k, r.y));   // 往寶箱房的那一邊要接得出去
    for (const k of isl) if (inBox(r, k % MW, (k / MW) | 0, 1) && map[k] === WATER) map[k] = GROUND;
    const at = (i: number, dx: number) => ({ x: (I[i][0] + dx) * TS + 8, y: I[i][1] * TS + 8 }), side = R() < .5 ? 1 : 2, other = 3 - side;   // 正確的路：0 → side → other → 3（蘑菇放在島的邊上，落地點在島中間，不會一落地又被彈走）
    const pads = [
      { ...at(0, -1), to: at(side, 0), rot: false }, { ...at(0, 1), to: { x: r.x * TS + 8, y: (r.y - 1) * TS + 8 }, rot: true },
      { ...at(side, side === 1 ? 1 : -1), to: at(other, 0), rot: false }, { ...at(other, 0 + (other === 1 ? -1 : 1)), to: at(3, 0), rot: false }, { x: I[other][0] * TS + 8, y: (I[other][1] - 1) * TS + 8, to: { x: (r.x + (other === 1 ? 2 : -2)) * TS + 8, y: (r.y + 2) * TS + 8 }, rot: true },
      { ...at(3, -1), to: at(0, 0), rot: false }];
    return { r, pads, fly: null as any, back: at(0, 0), used: new Set<number>() };
  },
  update(p, st) {
    const pl = G.me; if (!pl || pl.dead || st.fly) return;
    st.pads.forEach((q, i) => { if (Math.abs(q.x - pl.x) < 6 && Math.abs(q.y - (pl.y - 2)) < 6 && !busyMove(pl)) { st.fly = { pl, x0: q.x, y0: q.y, q, t: 0, T: .75 }; st.used.add(i); sfx.dodge(); burst(q.x, q.y - 4, 10, q.rot ? '#6a5a3a' : '#e04a5a', 60); } });
  },
  move(p, st, pl, dt) {
    const f = st.fly; if (!f || f.pl !== pl) return false; f.t += dt; const u = Math.min(1, f.t / f.T);
    pl.x = f.x0 + (f.q.to.x - f.x0) * u; pl.y = f.y0 + (f.q.to.y - f.y0) * u - Math.sin(Math.PI * u) * 34; pl.moving = false; pl.iframe = Math.max(pl.iframe, .05);
    if (u >= 1) { st.fly = null; pl.y = f.q.to.y;
      if (f.q.rot) { knockBack(p, pl, st.back.x, st.back.y, .1, '這朵蘑菇是爛的……掉進毒沼了', '#6ae04a'); applyFx(pl, { poison: 4 }); } else { shake(2, .1); burst(pl.x, pl.y, 8, '#8a7a5a', 40); } }
    return true;
  },
  draw(p, st, vis, list) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 60)) return;
    st.pads.forEach((q, i) => { const sq = st.fly && st.fly.q === q ? .7 : 1;   // 蘑菇：好的 = 紅傘白點；爛的 = 褐色、有斑
      list.push({ y: q.y, f: () => { ctx.fillStyle = '#e8dcc8'; ctx.fillRect(snapF(q.x - 2), snapF(q.y - 6), 4, 6);
        ctx.fillStyle = q.rot ? '#6a5a3a' : '#c8304a'; ctx.beginPath(); ctx.ellipse(q.x, q.y - 7 * sq, 8, 5 * sq, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = q.rot ? '#4a3a24' : '#ffffff'; for (const [dx, dy] of [[-4, -9], [2, -10], [5, -8]]) ctx.fillRect(snapF(q.x + dx), snapF(q.y + dy * sq), 2, 2); } });
      if (st.used.has(i) && !q.rot) list.push({ y: q.y - 300, f: () => { ctx.globalAlpha = .35; ctx.fillStyle = '#ffe38a';   // 跳過一次 → 記得路線（虛線弧）
        for (let k = 1; k < 10; k++) { const u = k / 10; ctx.fillRect(snapF(q.x + (q.to.x - q.x) * u), snapF(q.y + (q.to.y - q.y) * u - Math.sin(Math.PI * u) * 34), 2, 2); } ctx.globalAlpha = 1; } }); });
    if (st.fly) list.push({ y: st.fly.pl.y + 50, f: () => { const f = st.fly; if (!f) return; const u = Math.min(1, f.t / f.T); ctx.fillStyle = 'rgba(0,0,0,.35)';   // 飛在空中：地上的影子
      ctx.beginPath(); ctx.ellipse(f.x0 + (f.q.to.x - f.x0) * u, f.y0 + (f.q.to.y - f.y0) * u, 6, 2.5, 0, 0, TAU); ctx.fill(); } });
  },
};

/* ---------- 黑暗迷宮（沉沒石窟，Boss 大廳前）：整間房變成一座迷宮，進去之後只看得到身邊一小圈。死路上有發光的珍珠 ---------- */
MECHS.maze = {
  setup(p, r, R) {
    const { hall, r2 } = roomsOf(p.d), nC = r.rx + 1, nR = r.ry;          // 格子中心：x = r.x - rx + 2i（i = 0…rx），y = r.y - ry + 1 + 2j（j = 0…ry-1）
    const CX = (i: number) => r.x - r.rx + i * 2, CY = (j: number) => r.y - r.ry + 1 + j * 2;
    for (let ty = r.y - r.ry; ty <= r.y + r.ry; ty++) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) map[key(tx, ty)] = CLIFF;
    const seen = new Set<number>(), dead: number[][] = [], dig = (i: number, j: number) => { seen.add(j * nC + i); map[key(CX(i), CY(j))] = GROUND; let kids = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => R() - .5)) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nC || b >= nR || seen.has(b * nC + a)) continue;
        map[key(CX(i) + di, CY(j) + dj)] = GROUND; kids++; dig(a, b); }
      if (!kids) dead.push([CX(i), CY(j)]); };
    dig(Math.floor(nC / 2), nR - 1);
    const near = (tx: number, ty: number) => { let bi = 0, bj = 0, bd = Infinity; for (let i = 0; i < nC; i++) for (let j = 0; j < nR; j++) { const d = Math.abs(CX(i) - tx) + Math.abs(CY(j) - ty); if (d < bd) { bd = d; bi = i; bj = j; } } return [CX(bi), CY(bj)]; };
    const link = (tx: number, ty: number, vertFirst: boolean) => { const [cx, cy] = near(tx, ty); let x = tx, y = ty;   // 從房間外的通道挖一條 L 形的路，接到最近的格子
      const stepY = () => { while (y !== cy) { map[key(x, y)] = GROUND; y += Math.sign(cy - y); } }, stepX = () => { while (x !== cx) { map[key(x, y)] = GROUND; x += Math.sign(cx - x); } };
      if (vertFirst) { stepY(); stepX(); } else { stepX(); stepY(); } map[key(x, y)] = GROUND; };
    link(r.x, r.y + r.ry + 1, true); link(hall.x, r.y - r.ry - 1, true);   // 下面的入口、上面通往 Boss 大廳
    const s2 = Math.sign(r2.x - r.x) || 1; link(r.x + s2 * (r.rx + 1), r.y, false);   // 旁邊通往寶箱房
    const tab = (p.d as any).tablet; if (tab && inBox(r, tab[0], tab[1])) { map[key(tab[0], tab[1])] = GROUND; const [cx, cy] = near(tab[0], tab[1]); for (let x = Math.min(cx, tab[0]); x <= Math.max(cx, tab[0]); x++) map[key(x, cy)] = GROUND; for (let y = Math.min(cy, tab[1]); y <= Math.max(cy, tab[1]); y++) map[key(tab[0], y)] = GROUND; }   // 石碑不能被埋在牆裡
    return { r, pearls: dead.slice(0, 4).map(([tx, ty]) => ({ x: tx * TS + 8, y: ty * TS + 8 })) };
  },
  dark(p, st, pl) { const [tx, ty] = plTile(pl); return inBox(st.r, tx, ty) ? 34 : 0; },
  draw(p, st, vis, list, L, addLight) { for (const q of st.pearls) if (vis(q.x, q.y, 20)) { list.push({ y: q.y, f: () => { ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.ellipse(q.x, q.y - 3, 2.5, 2.5, 0, 0, TAU); ctx.fill(); } }); addLight(L, q.x, q.y - 3, 22, 2); } },
};

/* ---------- 潛行（王城地下墓所，中央十字廳）：三個亡衛來回巡邏，看得到前面一個扇形。被看到 → 鐘聲響起、叫出守衛、拉桿鎖住 8 秒 ---------- */
const CONE = .55, SEE = 82;
MECHS.stealth = {
  setup(p, r) {
    const path = (pts: number[][]) => pts.map(([ox, oy]) => { const [tx, ty] = findFloor(r.x + ox, r.y + oy); return { x: tx * TS + 8, y: ty * TS + 8 }; });
    const g = (pts: number[][], spd: number) => ({ pts: path(pts), i: 0, x: 0, y: 0, a: 0, spd, wait: 0 });
    const gs = [g([[-6, -3], [6, -3]], 30), g([[6, 1], [-6, 1]], 26), g([[0, -4], [0, 4], [-3, 4], [-3, -4]], 22)]; for (const q of gs) { q.x = q.pts[0].x; q.y = q.pts[0].y; }
    const covers = [[-3, -1], [3, -1], [-5, 3], [4, 3]].map(([ox, oy]) => { const [tx, ty] = findFloor(r.x + ox, r.y + oy), c = { x: tx * TS + 8, y: ty * TS + 10, r: 8 }; PROPS.push(c); return c; });   // 可以躲的石棺
    const [lx, ly] = findFloor(r.x + 2, r.y - r.ry); return { r, gs, covers, lever: lever(lx * TS + 8, ly * TS + 12), alarm: 0 };
  },
  update(p, st, dt) {
    if (st.alarm > 0) st.alarm -= dt;
    for (const q of st.gs) { if (q.wait > 0) { q.wait -= dt; q.a += dt * 1.5; continue; } const t = q.pts[(q.i + 1) % q.pts.length], dx = t.x - q.x, dy = t.y - q.y, d = Math.hypot(dx, dy);
      if (d < 2) { q.i = (q.i + 1) % q.pts.length; q.wait = 1.2; continue; } q.a = Math.atan2(dy, dx); q.x += dx / d * Math.min(d, q.spd * dt); q.y += dy / d * Math.min(d, q.spd * dt); }
    if (p.gateOpen || st.alarm > 0) return;
    for (const pl of G.players) { if (pl.dead) continue; const [tx, ty] = plTile(pl); if (!inBox(st.r, tx, ty)) continue;
      for (const q of st.gs) { const dx = pl.x - q.x, dy = pl.y - q.y, d = Math.hypot(dx, dy); if (d > SEE) continue;
        let da = Math.atan2(dy, dx) - q.a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > CONE) continue;
        let hid = false; for (let k = 6; k < d && !hid; k += 4) { const x = q.x + dx / d * k, y = q.y + dy / d * k, t = map[key(Math.floor(x / TS), Math.floor(y / TS))];   // 中間有柱子、牆、石棺 → 看不到
          if (t === PILLAR || t === RWALL || st.covers.some(c => Math.hypot(c.x - x, c.y - y) < c.r)) hid = true; }
        if (hid) continue;
        st.alarm = 8; sfx.howl(); shake(5, .4); showBanner('被發現了', '鐘聲在墓所裡迴盪', 1800);   // 鐘響：叫出三個守衛
        for (let k = 0; k < 3; k++) { const a = rr(0, TAU), e = makeEnemy(p.d.kinds[0], p.d.lv, pl.x + Math.cos(a) * 50, pl.y + Math.sin(a) * 34); e.state = 'chase'; G.enemies.push(e); }
        return; } }
  },
  draw(p, st, vis, list) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 60)) return; const al = st.alarm > 0;
    for (const q of st.gs) { list.push({ y: q.y - 300, f: () => { if (p.gateOpen) return; ctx.globalAlpha = al ? .22 : .14; ctx.fillStyle = al ? '#ff4a4a' : '#ffe38a';   // 視線的扇形
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.arc(q.x, q.y, SEE, q.a - CONE, q.a + CONE); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; } });
      list.push({ y: q.y, f: () => { const bob = Math.sin(G.time * 3 + q.x) * 1.5; ctx.globalAlpha = .8; ctx.fillStyle = '#8a9ac8';   // 亡衛：半透明的騎士 + 提燈
        ctx.fillRect(snapF(q.x - 5), snapF(q.y - 20 + bob), 10, 16); ctx.fillStyle = '#b8c8e8'; ctx.fillRect(snapF(q.x - 4), snapF(q.y - 26 + bob), 8, 7);
        ctx.fillStyle = al ? '#ff4a4a' : '#e0f4ff'; ctx.fillRect(snapF(q.x - 2 + Math.cos(q.a) * 2), snapF(q.y - 24 + bob), 2, 2); ctx.globalAlpha = 1;
        flame(q.x + Math.cos(q.a) * 7, q.y - 12 + bob, 2.5, q.x, ['#4aa8ff', '#a8dcff', '#ffffff']); } }); }
    for (const c of st.covers) list.push({ y: c.y, f: () => { ctx.fillStyle = '#3a3646'; ctx.fillRect(snapF(c.x - 9), snapF(c.y - 12), 18, 12); ctx.fillStyle = '#5a5468'; ctx.fillRect(snapF(c.x - 9), snapF(c.y - 12), 18, 3); } });
    drawLever(list, st.lever, p.gateOpen);
  },
  target(p, st, pl) { if (p.gateOpen || Math.hypot(st.lever.x - pl.x, st.lever.y - pl.y) > 22) return null;
    return { btn: '拉下', text: '拉下拉桿', run: () => { if (st.alarm > 0) { toast('拉桿被鐵鍊鎖住了……等鐘聲停下來', '#ff8a8a'); return; } sfx.boom(); openGate(p); } }; },
};

/* ---------- 熔爐（熔爐地底遺跡，中央十字廳）：地上是一條一條的輸送帶（把人往左 / 往右送），上面有會砸下來的鍛錘。走到最裡面拉下拉桿 ---------- */
MECHS.forge = {
  setup(p, r) {
    const belts = new Map<number, number>();                              // 哪一排、往哪邊（1 = 右、-1 = 左）
    [[-3, 1], [-2, 1], [0, -1], [1, -1], [3, 1]].forEach(([oy, d]) => belts.set(r.y + oy, d));
    const hs = [[-4, -2], [3, -2], [-2, 1], [5, 1], [0, 3], [-6, 3]].map(([ox, oy], i) => ({ x: (r.x + ox) * TS + 8, y: (r.y + oy) * TS + 8, ph: i * .37, hit: false }));
    const [lx, ly] = findFloor(r.x - 3, r.y - r.ry); return { r, belts, hs, lever: lever(lx * TS + 8, ly * TS + 12) };
  },
  update(p, st, dt) {
    for (const pl of G.players) { if (pl.dead || busyMove(pl)) continue; const [tx, ty] = plTile(pl), d = st.belts.get(ty); if (d && inBox(st.r, tx, ty)) moveEnt(pl, d * 55 * dt, 0); }
    for (const h of st.hs) { const u = ((G.time / 2.2 + h.ph) % 1); if (u < .1) h.hit = false;
      if (u > .78 && !h.hit) { h.hit = true; for (const pl of G.players) if (!pl.dead && Math.hypot(pl.x - h.x, pl.y - h.y) < 20) hitP(p, pl, 1.2, { stun: .5 }, h.x, h.y); shake(4, .15); sfx.boom(); burst(h.x, h.y, 10, '#ffb040', 70); } }
  },
  draw(p, st, vis, list) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 60)) return;
    list.push({ y: (r.y - r.ry) * TS - 300, f: () => { for (const [ty, d] of st.belts) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) { if (!floorAt(tx, ty)) continue; const x = tx * TS, y = ty * TS;
      ctx.fillStyle = '#26222c'; ctx.fillRect(x, y + 2, TS, 12); ctx.fillStyle = '#4a4458'; for (let k = 0; k < 2; k++) { const o = ((G.time * 55 * d + k * 8) % 16 + 16) % 16;   // 輸送帶上往前跑的箭頭
        ctx.fillRect(snapF(x + o), y + 5, 2, 6); ctx.fillRect(snapF(x + o + d * 2), y + 7, 2, 2); } } } });
    for (const h of st.hs) { const u = ((G.time / 2.2 + h.ph) % 1), up = u < .78 ? Math.min(1, (.78 - u) * 4) : 0;
      if (u > .45 && u < .78) teleCircle(h.x, h.y, 20, (u - .45) / .33);
      list.push({ y: h.y + 2, f: () => { const z = up * 26; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(h.x, h.y, 12 - up * 4, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a3646'; ctx.fillRect(snapF(h.x - 2), snapF(h.y - 60), 4, 44 - z); ctx.fillStyle = '#5a5468'; ctx.fillRect(snapF(h.x - 10), snapF(h.y - 16 - z), 20, 14); ctx.fillStyle = '#8a8498'; ctx.fillRect(snapF(h.x - 10), snapF(h.y - 16 - z), 20, 3); } }); }
    drawLever(list, st.lever, p.gateOpen);
  },
  target(p, st, pl) { if (p.gateOpen || Math.hypot(st.lever.x - pl.x, st.lever.y - pl.y) > 22) return null; return { btn: '拉下', text: '拉下拉桿', run: () => { sfx.boom(); openGate(p); } }; },
};

/* ---------- 光束鏡子（沉沒神殿地底，中央十字廳）：天花板的裂縫照下一道星光，轉動鏡子讓光打到門上的水晶 ---------- */
const DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]];                          // 0 東、1 南、2 西、3 北
const reflect = (dir: number, m: number) => m === 0 ? [3, 2, 1, 0][dir] : [1, 0, 3, 2][dir];   // m = 0：「/」；m = 1：「\」
MECHS.mirrors = {
  setup(p, r, R) {
    const ms = [[-3, -2, 1], [-3, 2, 1], [4, 2, 0], [1, -2, 0], [1, 0, 1]].map(([ox, oy, want]) => ({ tx: r.x + ox, ty: r.y + oy, want, m: 0 }));   // 前三面在正確的路上，後兩面是誘餌
    for (const q of ms) { q.m = R() < .5 ? 0 : 1; PROPS.push({ x: q.tx * TS + 8, y: q.ty * TS + 10, r: 5 }); }
    if (ms.slice(0, 3).every(q => q.m === q.want)) ms[0].m = 1 - ms[0].want;
    return { reset0: ms.map(q => q.m), r, ms, src: { tx: r.x - r.rx, ty: r.y - 2 }, goal: { tx: r.x + 4, ty: r.y - 4 }, beam: [] as number[][], hit: false };
  },
  update(p, st) {
    let x = st.src.tx, y = st.src.ty, dir = 0; const beam = [[x, y]]; st.hit = false;
    for (let n = 0; n < 60; n++) { x += DIR[dir][0]; y += DIR[dir][1]; beam.push([x, y]);
      if (x === st.goal.tx && y === st.goal.ty) { st.hit = true; break; }
      const m = st.ms.find(q => q.tx === x && q.ty === y); if (m) { dir = reflect(dir, m.m); continue; }
      if (!floorAt(x, y)) break; }
    st.beam = beam; if (st.hit && !p.gateOpen) { sfx.epic(); openGate(p); }
  },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 60)) return;
    list.push({ y: (r.y + r.ry) * TS + 40, f: () => { ctx.globalAlpha = .7 + .2 * Math.sin(G.time * 8); ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 2; ctx.beginPath();   // 光束
      st.beam.forEach(([x, y], i) => { const X = x * TS + 8, Y = y * TS + 2; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke();
      ctx.strokeStyle = '#ffe38a'; ctx.lineWidth = .7; ctx.stroke(); ctx.globalAlpha = 1; } });
    for (const [x, y] of st.beam) if ((x + y) % 3 === 0) addLight(L, x * TS + 8, y * TS + 2, 18, 4);
    const S = st.src, gl = st.goal;
    list.push({ y: S.ty * TS + 8, f: () => { ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.ellipse(S.tx * TS + 8, S.ty * TS + 2, 5, 5, 0, 0, TAU); ctx.fill(); } });   // 光源
    list.push({ y: gl.ty * TS + 12, f: () => { pedestal(gl.tx * TS + 8, gl.ty * TS + 12, 8); ctx.fillStyle = st.hit || p.gateOpen ? '#ffe38a' : '#6a5a9a';   // 門上的水晶
      ctx.beginPath(); ctx.moveTo(gl.tx * TS + 8, gl.ty * TS - 14); ctx.lineTo(gl.tx * TS + 13, gl.ty * TS - 4); ctx.lineTo(gl.tx * TS + 8, gl.ty * TS + 2); ctx.lineTo(gl.tx * TS + 3, gl.ty * TS - 4); ctx.closePath(); ctx.fill(); } });
    addLight(L, gl.tx * TS + 8, gl.ty * TS - 4, st.hit || p.gateOpen ? 56 : 20, 4);
    for (const q of st.ms) { const x = q.tx * TS + 8, y = q.ty * TS + 10;   // 鏡子：石座 + 一面斜放的銀鏡
      list.push({ y, f: () => { pedestal(x, y, 6); ctx.strokeStyle = '#2a2632'; ctx.lineWidth = 4; ctx.beginPath(); const s = q.m === 0 ? 1 : -1; ctx.moveTo(x - 6, y - 8 + s * 6); ctx.lineTo(x + 6, y - 8 - s * 6); ctx.stroke();
        ctx.strokeStyle = '#e8ecf8'; ctx.lineWidth = 2; ctx.stroke(); } }); }
  },
  reset(p, st) { st.ms.forEach((q, i) => q.m = st.reset0[i]); },
  target(p, st, pl) { if (p.gateOpen) return null; for (const q of st.ms) if (Math.hypot(q.tx * TS + 8 - pl.x, q.ty * TS + 10 - pl.y) < 20) return { btn: '轉動', text: '轉動鏡子', run: () => { q.m = 1 - q.m; sfx.hit(); } }; return null; },
};
void GROUND; void hitP;
