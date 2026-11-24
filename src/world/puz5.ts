/* ================= 地城的謎題（三）：牆中之眼、持鑰的守衛、試煉、記憶石板、引路幽火、燈陣拉桿、滑冰石塊 =================
   都是「解開 → 鐵柵門升起」的謎題（寶庫或 Boss 大廳前）。哪座地城用哪一種：world/dungeons.ts 的 PUZ 表。
   牆中之眼、持鑰的守衛要在整座地城裡找東西：寶庫的門不是在謎題房裡就解得開的。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { CLIFF, MW, PROPS, RWALL, TS, map } from './map';
import { dungeonAt, type Room } from './dungeons';
import { flags } from '../game/quest';
import { makeEnemy } from '../game/enemies';
import { input } from '../game/player';
import { burst, shake } from '../game/worldUpdate';
import { showBanner, toast } from '../ui/hud';
import { save } from '../game/save';
import type { Player } from '../types';
import { MECHS, SYM_COL, drawSym, floorAt, inner, knockBack, openGate, pedestal, route, swingFace, tileOf, walk, type Puz, type Sym } from './puzzles';

const key = (tx: number, ty: number) => ty * MW + tx;
const inBox = (r: Room, tx: number, ty: number, pad = 0) => Math.abs(tx - r.x) <= r.rx + pad && Math.abs(ty - r.y) <= r.ry + pad;
const plTile = (pl: Player) => tileOf(pl.x, pl.y - 2);
const busyMove = (pl: Player) => pl.dodge > 0 || !!pl.dash;
const inRoom = (r: Room, pl: Player) => { const [tx, ty] = plTile(pl); return inBox(r, tx, ty); };
const findFloor = (tx: number, ty: number) => { for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (floorAt(tx + dx, ty + dy)) return [tx + dx, ty + dy]; return [tx, ty]; };
const shuf = <T,>(a: T[], R: () => number) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const isWall = (tx: number, ty: number) => map[key(tx, ty)] === CLIFF || map[key(tx, ty)] === RWALL;
/** 牆上的告示石板（壁畫）：掛在房間上面那面牆、離門遠一點 */
function plaque(r) { const tops = r.doors.filter(q => q.side === 3).map(q => q.x), ox = [-3, 3, 0].sort((a, b) => Math.min(99, ...tops.map(t => Math.abs(r.x + b - t))) - Math.min(99, ...tops.map(t => Math.abs(r.x + a - t))))[0];
  return { x: (r.x + ox) * TS + 8, y: (r.y - r.ry) * TS }; }
function drawPlaque(list, m: { x: number; y: number }, f: (x: number, y: number) => void) {
  list.push({ y: m.y - 100, f: () => { const x = m.x, y = m.y - 10; ctx.fillStyle = '#1e1a24'; ctx.fillRect(snapF(x - 26), snapF(y - 11), 52, 22); ctx.fillStyle = '#4a4558'; ctx.fillRect(snapF(x - 24), snapF(y - 9), 48, 18);
    ctx.fillStyle = '#6a6478'; ctx.fillRect(snapF(x - 24), snapF(y - 9), 48, HK * 2); f(x, y); } });
}
const nearPlaque = (m: { x: number; y: number }, pl: Player) => Math.abs(m.x - pl.x) < 30 && pl.y > m.y && pl.y - m.y < 40;

/* ---------- 牆中之眼（苔石洞窟、風蝕岩窟、沉沒神殿地底）：地城裡別的房間，牆上藏著三隻眼睛（會跟著你轉）。
   砍一下 → 眼睛閉上。三隻都閉上 → 謎題房的門打開。謎題房牆上的石板記著找到了幾隻 ---------- */
const fEye = (p: Puz, i: number) => 'puz:' + p.d.id + ':eye' + i;
MECHS.eyes = {
  setup(p, r, R) {
    const lay = p.d.lay, cand = shuf(lay.rooms.filter(q => q.role === 'path' || q.role === 'branch' || q.role === 'end'), R), picked: Room[] = [];
    const far = (q: Room) => Math.min(Math.hypot(q.x - r.x, q.y - r.y) * .6, ...picked.map(o => Math.hypot(q.x - o.x, q.y - o.y)));
    const eyes = [] as any[];
    while (eyes.length < 3 && cand.length) { cand.sort((a, b) => far(b) - far(a)); const q = cand.shift();   // 挑離得遠的房間；房間裡找不到能放眼睛的牆（例如推石區的柱廊）→ 換下一間，一定湊滿 3 隻（石板寫的是三隻）
      for (const x of shuf([...Array(q.rx * 2 - 1).keys()].map(k => q.x - q.rx + 1 + k), R)) {
        let y = q.y; if (!floorAt(x, y)) continue; while (y > q.y - q.ry - 2 && floorAt(x, y - 1)) y--;               // 這一行最上面的地板
        if (!isWall(x, y - 1) || !isWall(x - 1, y - 1) || !isWall(x + 1, y - 1) || !isWall(x, y - 2) || lay.corr.has(key(x, y - 1))) continue;
        eyes.push({ tx: x, ty: y - 1, x: x * TS + 8, y: (y - 1) * TS + 9, i: eyes.length }); picked.push(q); break; } }
    return { r, eyes, mural: plaque(r), last: null };
  },
  update(p, st) {
    for (const pl of G.players) { if (pl.dead || !pl.swing || pl.swing === st.last) continue; st.last = pl.swing;
      for (const e of st.eyes) if (!flags.has(fEye(p, e.i)) && Math.hypot(pl.x - e.x, pl.y - 8 - e.y) < 34 && (swingFace(pl, e.x, e.y + 8) || (Math.abs(pl.x - e.x) < 14 && pl.y - e.y < 32))) {   // 站在眼睛正下方：怎麼揮都算（攻擊會自動轉向附近的怪）
        flags.add(fEye(p, e.i)); sfx.boom(); shake(3, .2); burst(e.x, e.y, 18, '#c88aff', 70);
        const n = st.eyes.filter(q => flags.has(fEye(p, q.i))).length; toast(n < st.eyes.length ? '牆裡的眼睛閉上了（' + n + ' / ' + st.eyes.length + '）' : '最後一隻眼睛閉上了。遠處有東西鬆開了', '#c8a8ff'); save(); } }
    if (!p.gateOpen && st.eyes.length && st.eyes.every(e => flags.has(fEye(p, e.i)))) openGate(p);
  },
  target(p, st, pl) { if (!nearPlaque(st.mural, pl)) return null; const n = st.eyes.filter(e => flags.has(fEye(p, e.i))).length;
    return { btn: '查看', text: '查看石板', run: () => toast('石板上刻著三隻睜開的眼睛：「牠們藏在這座地城的牆裡看著你。讓牠們全部閉上，門就會打開。」（閉上了 ' + n + ' / ' + st.eyes.length + '）', '#e8dcff') }; },
  draw(p, st, vis, list, L, addLight) {
    for (const e of st.eyes) { if (!vis(e.x, e.y, 30)) continue; const shut = flags.has(fEye(p, e.i)), pl = G.me, a = Math.atan2(pl.y - 10 - e.y, pl.x - e.x), blink = Math.floor(G.time * .7 + e.i) % 5 === 0 && G.time % 1.43 < .15;
      list.push({ y: e.y + 9, f: () => { ctx.fillStyle = '#16121c'; ctx.beginPath(); ctx.ellipse(snapF(e.x), snapF(e.y), 7, shut || blink ? 1.5 : 4.5, 0, 0, TAU); ctx.fill();
        if (!(shut || blink)) { ctx.fillStyle = '#e8dcff'; ctx.beginPath(); ctx.ellipse(snapF(e.x), snapF(e.y), 6, 3.5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#9a4ae8'; ctx.fillRect(snapF(e.x + Math.cos(a) * 3 - 1.5), snapF(e.y + Math.sin(a) * 1.5 - 1.5), 3, 3); }
        else if (shut) { ctx.fillStyle = '#6a6478'; ctx.fillRect(snapF(e.x - 6), snapF(e.y), 12, HK * 2); } } });
      if (!shut) addLight(L, e.x, e.y, 20 + Math.sin(G.time * 2 + e.i) * 3, 3); }
    if (vis(st.mural.x, st.mural.y, 40)) drawPlaque(list, st.mural, (x, y) => st.eyes.forEach((e, k) => { const shut = flags.has(fEye(p, e.i)), ex = x - 14 + k * 14;
      ctx.fillStyle = '#16121c'; ctx.beginPath(); ctx.ellipse(snapF(ex), snapF(y), 5, shut ? 1.2 : 3, 0, 0, TAU); ctx.fill(); if (!shut) { ctx.fillStyle = '#c88aff'; ctx.fillRect(snapF(ex - 1), snapF(y - 1), 2, 2); } }));
  },
};

/* ---------- 持鑰的守衛（樹根地穴、黑曜石窟、霜墓）：寶庫的鐵柵門掛著一把大鎖。鑰匙在地城某條死路深處的精英怪身上 ---------- */
const fKey = (p: Puz) => 'puz:' + p.d.id + ':key';
MECHS.key = {
  setup(p, r) {
    const lay = p.d.lay, ends = lay.ends.map(i => lay.rooms[i]).sort((a, b) => Math.hypot(b.x - r.x, b.y - r.y) - Math.hypot(a.x - r.x, a.y - r.y)), h = ends[0] || lay.rooms[lay.path[Math.floor(lay.path.length / 2)]];
    const [tx, ty] = findFloor(h.x, h.y + 1), g0 = p.gate[0], g1 = p.gate[p.gate.length - 1];
    return { r, home: { x: tx * TS + 8, y: ty * TS + 8 }, e: null, sp: null, drop: null, lock: { x: (g0.x + g1.x) / 2, y: g0.y } };
  },
  update(p, st) {
    if (p.gateOpen || flags.has(fKey(p))) { st.drop = null; return; }
    if (st.sp && !st.sp.alive && st.e) { st.drop = { x: st.e.x, y: st.e.y }; st.e = null; st.sp = null; toast('守衛倒下的地方，有一把古老的鑰匙在發光', '#ffe38a'); }
    if (st.e && !G.enemies.includes(st.e)) { st.e = null; st.sp = null; }                                              // 休息 / 走遠了 → 收起來，下次走近再出現
    if (!st.e && !st.drop && G.players.some(pl => !pl.dead && Math.hypot(pl.x - st.home.x, pl.y - st.home.y) < 420)) {
      st.sp = { elite: true, ename: '持鑰的守衛', alive: true, timer: 0 }; st.e = makeEnemy(p.d.kinds[0], p.d.lv + 3, st.home.x, st.home.y, st.sp); G.enemies.push(st.e); }
    if (st.drop) for (const pl of G.players) if (!pl.dead && Math.hypot(pl.x - st.drop.x, pl.y - st.drop.y) < 16) {
      flags.add(fKey(p)); st.drop = null; sfx.epic(); burst(pl.x, pl.y - 8, 18, '#ffe38a', 60); showBanner('寶庫的鑰匙', '那扇掛著大鎖的鐵柵門，現在打得開了', 2400); save(); break; }
  },
  target(p, st, pl) { if (p.gateOpen || Math.hypot(st.lock.x - pl.x, st.lock.y - pl.y) > 34) return null;
    return flags.has(fKey(p)) ? { btn: '開鎖', text: '用鑰匙打開鐵柵門', run: () => { sfx.boom(); openGate(p); } }
      : { btn: '查看', text: '查看大鎖', run: () => toast('鐵柵門上掛著一把生鏽的大鎖。鎖孔的形狀……這座地城裡，應該有人帶著鑰匙。', '#e8dcff') }; },
  draw(p, st, vis, list, L, addLight) {
    if (!p.gateOpen && vis(st.lock.x, st.lock.y, 30)) list.push({ y: st.lock.y + 9, f: () => { const x = st.lock.x, y = st.lock.y - 8;   // 大鎖
      ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(snapF(x), snapF(y - 5), 4, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#c8a050'; ctx.fillRect(snapF(x - 6), snapF(y - 5), 12, 10);
      ctx.fillStyle = '#16121c'; ctx.fillRect(snapF(x - 1), snapF(y - 2), 2, 4); } });
    if (st.drop && vis(st.drop.x, st.drop.y, 30)) { const d = st.drop, bob = Math.sin(G.time * 3) * 2;
      list.push({ y: d.y, f: () => { ctx.fillStyle = '#ffe38a'; ctx.fillRect(snapF(d.x - 6), snapF(d.y - 12 + bob), 4, 4); ctx.fillRect(snapF(d.x - 2), snapF(d.y - 11 + bob), 9, 2); ctx.fillRect(snapF(d.x + 4), snapF(d.y - 10 + bob), 2, 3); } });
      addLight(L, d.x, d.y - 10, 30, 4); }
  },
};

/* ---------- 試煉（蛛巢洞窟、腐根洞窟）：走進房間 → 入口被紫色的結界封住，三波敵人。全部打倒 → 門打開。倒下或離開 → 重來 ---------- */
MECHS.trial = {
  setup(p, r) {
    const D = p.inD, bar = [-1, 0, 1].map(o => { const tx = D.side % 2 ? D.x + o : D.x, ty = D.side % 2 ? D.y : D.y + o, q = { x: tx * TS + 8, y: ty * TS + 8, r: 0 }; PROPS.push(q); return q; });
    return { r, bar, on: false, wave: 0, foes: [] as any[], cd: 0 };
  },
  update(p, st, dt) {
    const stop = () => { st.on = false; for (const b of st.bar) b.r = 0; G.enemies = G.enemies.filter(e => !st.foes.includes(e)); st.foes = []; };
    if (p.gateOpen) { if (st.on) stop(); return; }
    const me = G.me, inside = me && !me.dead && inRoom(st.r, me);
    if (!st.on) { if (!inside) return; st.on = true; st.wave = 0; st.cd = 1.2; for (const b of st.bar) b.r = 9; sfx.howl(); shake(4, .4); showBanner('試煉', '打倒所有出現的敵人', 1800); return; }
    if (!inside || st.foes.some(e => e.hp > 0 && !G.enemies.includes(e))) { stop(); toast('試煉中斷了……', '#c8a8ff'); return; }
    if (st.foes.some(e => e.hp > 0)) return;
    if ((st.cd -= dt) > 0) return;
    if (st.wave >= 3) { stop(); openGate(p); toast('試煉通過了', '#ffe38a'); return; }
    const n = 2 + st.wave, r = st.r; st.foes = [];
    for (let k = 0; k < n; k++) { let x = r.x * TS + 8, y = r.y * TS + 8;
      for (let t = 0; t < 20; t++) { const tx = r.x + Math.round(rr(-r.rx + 1, r.rx - 1)), ty = r.y + Math.round(rr(-r.ry + 1, r.ry - 1)); if (floorAt(tx, ty) && Math.hypot(tx * TS + 8 - me.x, ty * TS + 8 - me.y) > 60) { x = tx * TS + 8; y = ty * TS + 8; break; } }
      const el = st.wave === 2 && k === 0, e = makeEnemy(p.d.kinds[k % p.d.kinds.length], p.d.lv + st.wave, x, y, el ? { elite: true, ename: '試煉的守衛', alive: true, timer: 0 } : { alive: true, timer: 0 });
      e.state = 'chase'; G.enemies.push(e); st.foes.push(e); G.fx.push({ k: 'warp', x, y, r0: 2, r1: 18, th: 3, t: 0, d: .4, col: '#c8a8ff' }); }
    st.wave++; st.cd = 1.2; sfx.skill();
  },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40) || p.gateOpen) return;
    const cx = r.x * TS + 8, cy = r.y * TS + 8, a = st.on ? .5 + .2 * Math.sin(G.time * 6) : .18;
    list.push({ y: cy - 300, f: () => { ctx.globalAlpha = a; ctx.strokeStyle = '#c88aff'; ctx.lineWidth = HK * 2;   // 地上的試煉法陣
      for (const R of [34, 26]) { ctx.beginPath(); ctx.ellipse(cx, cy, R, R * .6, 0, 0, TAU); ctx.stroke(); }
      for (let k = 0; k < 6; k++) { const t = k / 6 * TAU + G.time * .3; ctx.fillStyle = '#c88aff'; ctx.fillRect(snapF(cx + Math.cos(t) * 30 - 1), snapF(cy + Math.sin(t) * 18 - 1), 3, 3); } ctx.globalAlpha = 1; } });
    if (st.on) { for (const b of st.bar) list.push({ y: b.y + 8, f: () => { ctx.globalAlpha = .55 + .25 * Math.sin(G.time * 12 + b.x); ctx.fillStyle = '#9a6ae8'; ctx.fillRect(snapF(b.x - 8), snapF(b.y - 22), 16, 30);
      ctx.fillStyle = '#e8d8ff'; for (let k = 0; k < 3; k++) ctx.fillRect(snapF(b.x - 6 + k * 5), snapF(b.y - 22 + ((G.time * 40 + k * 11) % 30)), 2, 4); ctx.globalAlpha = 1; } }); addLight(L, cx, cy, 70, 3); }
  },
};

/* ---------- 記憶石板（潮音石窟、沉沒石窟、螢月禁林）：地上八塊石板，踩一塊會翻出一個符號。連續踩到兩塊一樣的 → 亮著不翻回去；不一樣 → 兩塊都翻回去。全部配對 → 開門 ---------- */
MECHS.pairs = {
  setup(p, r, R) {
    const syms = shuf(['moon', 'moon', 'sun', 'sun', 'star', 'star', 'eye', 'eye'] as Sym[], R), slabs = [] as any[];
    [-1, 2].forEach(oy => [-5, -2, 2, 5].forEach(ox => { const [tx, ty] = findFloor(r.x + ox, r.y + oy); slabs.push({ tx, ty, x: tx * TS + 8, y: ty * TS + 8, sym: syms[slabs.length], done: false }); }));
    return { r, slabs, open: [] as number[], bad: 0, on: -1, mural: plaque(r) };
  },
  update(p, st, dt) {
    if (p.gateOpen) return; if (st.bad > 0 && (st.bad -= dt) <= 0) st.open = [];
    const pl = G.me; if (!pl || pl.dead) return; const k = st.slabs.findIndex(q => Math.abs(q.x - pl.x) < 8 && Math.abs(q.y - (pl.y - 2)) < 8);
    if (k === st.on) return; st.on = k; if (k < 0 || st.bad > 0) return; const q = st.slabs[k]; if (q.done || st.open.includes(k)) return;
    st.open.push(k); sfx.pick(); burst(q.x, q.y, 6, SYM_COL[q.sym], 30); if (st.open.length < 2) return;
    const [a, b] = st.open.map(i => st.slabs[i]);
    if (a.sym === b.sym) { a.done = b.done = true; st.open = []; sfx.level(); if (st.slabs.every(s => s.done)) { openGate(p); toast('八塊石板全部亮了', '#ffe38a'); } }
    else { st.bad = .9; sfx.hit(); }
  },
  reset(p, st) { for (const s of st.slabs) s.done = false; st.open = []; },
  target(p, st, pl) { return nearPlaque(st.mural, pl) ? { btn: '查看', text: '查看石板', run: () => toast('牆上刻著：「同樣的記憶，要連著想起來。」地上的石板底下好像刻著符號。', '#e8dcff') } : null; },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
    st.slabs.forEach((q, k) => { const up = q.done || st.open.includes(k) || p.gateOpen, bad = st.bad > 0 && st.open.includes(k);
      list.push({ y: q.y - 200, f: () => { ctx.fillStyle = '#1e1a24'; ctx.fillRect(snapF(q.x - 7), snapF(q.y - 7), 14, 14); ctx.fillStyle = up ? '#3a3050' : '#4a4558'; ctx.fillRect(snapF(q.x - 6), snapF(q.y - 6), 12, 12);
        if (up) drawSym(q.sym, q.x, q.y, bad ? '#ff5a5a' : SYM_COL[q.sym], 1, 4); else { ctx.fillStyle = '#6a6478'; ctx.fillRect(snapF(q.x - 4), snapF(q.y - 4), 8, HK * 2); } } });
      if (q.done || p.gateOpen) addLight(L, q.x, q.y, 26, 3); });
    if (vis(st.mural.x, st.mural.y, 40)) drawPlaque(list, st.mural, (x, y) => { drawSym('moon', x - 7, y, '#8ac8ff', .8, 3); drawSym('moon', x + 7, y, '#8ac8ff', .8, 3); });
  },
};

/* ---------- 引路幽火（無名古墓、腐根洞窟）：漆黑的房間，地上到處是看不見的坑。點亮祭壇 → 一團幽火慢慢飄向門口，它的光照得到坑。
   跟緊它（它會等你一下）；它飄到門口時你在旁邊 → 門打開。掉進坑 → 回到入口，幽火熄掉 ---------- */
MECHS.wisp = {
  setup(p, r, R) {
    const cells = walk(route(p, R)), path = new Set(cells.map(([x, y]) => key(x, y))), holes = new Set<number>(), safe = [inner(p.inD), inner(p.outD)];
    for (let ty = r.y - r.ry; ty <= r.y + r.ry; ty++) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) {
      const k = key(tx, ty); if (!floorAt(tx, ty) || path.has(k) || safe.some(([x, y]) => Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1) || R() > .55) continue; holes.add(k); }
    const [ax, ay] = cells[2]; return { r, cells, holes, altar: { x: ax * TS + 8, y: ay * TS + 12 }, w: null as any, start: { x: p.inD.x * TS + 8, y: p.inD.y * TS + 8 } };
  },
  update(p, st, dt) {
    for (const pl of G.players) { if (pl.dead || busyMove(pl)) continue; const [tx, ty] = plTile(pl); if (!st.holes.has(key(tx, ty))) continue;
      st.w = null; knockBack(p, pl, st.start.x, st.start.y, .1, '掉進坑裡了……幽火也熄了', '#c8a8ff'); }
    const w = st.w; if (!w || p.gateOpen) return;
    const i = Math.min(st.cells.length - 1, Math.floor(w.t)), j = Math.min(st.cells.length - 1, i + 1), f = w.t - i;
    w.x = (st.cells[i][0] + (st.cells[j][0] - st.cells[i][0]) * f) * TS + 8; w.y = (st.cells[i][1] + (st.cells[j][1] - st.cells[i][1]) * f) * TS + 4;
    const near = G.me && !G.me.dead && Math.hypot(G.me.x - w.x, G.me.y - 8 - w.y) < 56;
    if (!near) { if ((w.wait += dt) > 6) { st.w = null; burst(w.x, w.y, 10, '#8ac8ff', 40); if (G.me && dungeonAt(G.me.x, G.me.y) === p.d) toast('幽火等不到你，熄滅了……', '#8ac8ff'); } return; }
    w.wait = 0; w.t = Math.min(st.cells.length - 1, w.t + dt * 2.2);
    if (w.t >= st.cells.length - 1) { st.w = null; sfx.epic(); openGate(p); toast('幽火鑽進了鐵柵門的鎖裡', '#8ac8ff'); }
  },
  target(p, st, pl) { if (p.gateOpen || st.w || Math.hypot(st.altar.x - pl.x, st.altar.y - pl.y) > 22) return null;
    return { btn: '點亮', text: '點亮祭壇', run: () => { st.w = { t: 2, x: st.altar.x, y: st.altar.y - 16, wait: 0 }; sfx.skill(); burst(st.altar.x, st.altar.y - 14, 12, '#8ac8ff', 50);
      if (!flags.has('puz:hint:wisp')) { flags.add('puz:hint:wisp'); toast('一團幽火從祭壇飄了起來……跟著它走', '#8ac8ff'); } } }; },
  dark(p, st, pl) { if (p.gateOpen || !inRoom(st.r, pl)) return 0; return st.w && Math.hypot(st.w.x - pl.x, st.w.y - pl.y + 8) < 64 ? 60 : 26; },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
    list.push({ y: (r.y - r.ry) * TS - 300, f: () => { for (const k of st.holes) { const x = (k % MW) * TS, y = ((k / MW) | 0) * TS; ctx.fillStyle = '#07060b'; ctx.fillRect(x + 1, y + 1, TS - 2, TS - 2); ctx.fillStyle = '#26222c'; ctx.fillRect(x + 1, y + 1, TS - 2, HK * 2); } } });
    const A = st.altar; list.push({ y: A.y, f: () => { pedestal(A.x, A.y, 9); ctx.fillStyle = st.w || p.gateOpen ? '#8ac8ff' : '#4a5a7a'; ctx.fillRect(snapF(A.x - 3), snapF(A.y - 14), 6, 3); } });
    addLight(L, A.x, A.y - 12, 20, 2);
    const w = st.w; if (!w) return;
    list.push({ y: w.y + 30, f: () => { const b = Math.sin(G.time * 5) * 2; ctx.fillStyle = '#4aa8ff'; ctx.beginPath(); ctx.ellipse(snapF(w.x), snapF(w.y - 10 + b), 5, 6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.ellipse(snapF(w.x), snapF(w.y - 9 + b), 2.5, 3, 0, 0, TAU); ctx.fill(); } });
    addLight(L, w.x, w.y - 10, 64, 2); if (Math.random() < .4) G.parts.push({ x: w.x + rr(-3, 3), y: w.y - 8, vx: rr(-6, 6), vy: -rr(8, 20), life: .6, max: .6, col: pick(['#8ac8ff', '#e8f8ff']), s: 1 });
  },
};

/* ---------- 燈陣拉桿（熔岩隧道、王城地下墓所）：五根拉桿、五盞燈。拉一根 → 正上方那盞和左右兩盞一起切換（亮 ↔ 暗）。五盞全亮 → 開門 ---------- */
MECHS.lightsout = {
  setup(p, r, R) {
    const xs = [-6, -3, 0, 3, 6].map(o => Math.max(-r.rx + 1, Math.min(r.rx - 1, o)));
    const lev = xs.map(o => { const [tx, ty] = findFloor(r.x + o, r.y + 2), q = { x: tx * TS + 8, y: ty * TS + 12 }; PROPS.push({ x: q.x, y: q.y, r: 5 }); return q; });
    const lamps = xs.map(o => ({ x: (r.x + o) * TS + 8, y: (r.y - r.ry) * TS + 6 }));
    let on = [1, 1, 1, 1, 1]; const flip = (i: number) => { for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < 5) on[j] ^= 1; };
    for (const i of shuf([0, 1, 2, 3, 4], R).slice(0, 2 + Math.floor(R() * 2))) flip(i);
    if (on.every(v => v)) flip(2);
    return { r, lev, lamps, on, on0: [...on], down: [0, 0, 0, 0, 0] };
  },
  update(p, st, dt) { for (let i = 0; i < 5; i++) if (st.down[i] > 0) st.down[i] -= dt; if (p.gateOpen) st.on = [1, 1, 1, 1, 1]; },
  reset(p, st) { st.on = [...st.on0]; },
  target(p, st, pl) { if (p.gateOpen) return null; const i = st.lev.findIndex(q => Math.hypot(q.x - pl.x, q.y - pl.y) < 20); if (i < 0) return null;
    return { btn: '拉', text: '拉下拉桿', run: () => { for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < 5) st.on[j] ^= 1; st.down[i] = .4; sfx.hit();
      if (!flags.has('puz:hint:lights')) { flags.add('puz:hint:lights'); toast('上面的燈跟著亮了又暗……一根拉桿會動到三盞燈', '#ffe38a'); }
      if (st.on.every(v => v)) { sfx.level(); openGate(p); } } }; },
  draw(p, st, vis, list, L, addLight) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
    st.lamps.forEach((q, i) => { const on = st.on[i]; list.push({ y: q.y + 4, f: () => { ctx.fillStyle = '#2a2632'; ctx.fillRect(snapF(q.x - 1), snapF(q.y - 14), 2, 6);
      ctx.fillStyle = on ? '#ffe38a' : '#3a3646'; ctx.beginPath(); ctx.ellipse(snapF(q.x), snapF(q.y - 5), 4, 4, 0, 0, TAU); ctx.fill(); if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(snapF(q.x - 1), snapF(q.y - 7), 2, 2); } } });
      if (on) addLight(L, q.x, q.y - 5, 34, 4); });
    st.lev.forEach((q, i) => list.push({ y: q.y, f: () => { pedestal(q.x, q.y, 7); ctx.save(); ctx.translate(snapF(q.x), snapF(q.y - 7)); ctx.rotate(st.down[i] > 0 ? .9 : -.6);
      ctx.fillStyle = '#4a3018'; ctx.fillRect(-1, -11, 2, 11); ctx.fillStyle = '#c8a050'; ctx.fillRect(-2.5, -13, 5, 4); ctx.restore(); } }));
  },
};

/* ---------- 滑冰石塊（冰晶洞窟）：整間房是冰面，一塊冰磚推了會一直滑，撞到冰柱或牆才停。把它推到發光的冰紋上 → 開門。卡住了 → 重置 ---------- */
MECHS.iceblock = {
  setup(p, r, R) {
    const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]], near = (tx: number, ty: number) => [inner(p.inD), inner(p.outD)].some(([x, y]) => Math.abs(x - tx) <= 2 && Math.abs(y - ty) <= 2);
    const cells: number[][] = []; for (let ty = r.y - r.ry; ty <= r.y + r.ry; ty++) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) if (floorAt(tx, ty)) cells.push([tx, ty]);
    let best = null;
    for (let at = 0; at < 400 && !best; at++) {
      const obs = new Set<number>(); for (let k = 0; k < 6; k++) { const [x, y] = cells[Math.floor(R() * cells.length)]; if (!near(x, y)) obs.add(key(x, y)); }
      const free = (x: number, y: number) => inBox(r, x, y) && floorAt(x, y) && !obs.has(key(x, y));
      const pickC = () => { const c = cells[Math.floor(R() * cells.length)]; return free(c[0], c[1]) && !near(c[0], c[1]) ? c : null; };
      const s = pickC(), g = pickC(); if (!s || !g || (s[0] === g[0] && s[1] === g[1])) continue;
      const seen = new Map<number, number>([[key(s[0], s[1]), 0]]), q = [s];                                               // 冰磚能停在哪些格子（推的人要站在後面那格）
      while (q.length) { const [x, y] = q.shift(), d0 = seen.get(key(x, y));
        for (const [dx, dy] of D4) { if (!free(x - dx, y - dy)) continue; let nx = x, ny = y; while (free(nx + dx, ny + dy)) { nx += dx; ny += dy; }
          if ((nx !== x || ny !== y) && !seen.has(key(nx, ny))) { seen.set(key(nx, ny), d0 + 1); q.push([nx, ny]); } } }
      const dg = seen.get(key(g[0], g[1])); if (dg >= 3) best = { obs, s, g };
    }
    if (!best) best = { obs: new Set<number>(), s: [r.x - 3, r.y], g: [r.x + r.rx, r.y] };
    const obs = [...best.obs].map(k => { const o = { tx: k % MW, ty: (k / MW) | 0, x: (k % MW) * TS + 8, y: ((k / MW) | 0) * TS + 8 }; PROPS.push({ x: o.x, y: o.y, r: 8 }); return o; });
    const b = { tx: best.s[0], ty: best.s[1], x: best.s[0] * TS + 8, y: best.s[1] * TS + 8, home: best.s, vx: 0, vy: 0, push: 0, prop: { x: 0, y: 0, r: 7 } }; b.prop.x = b.x; b.prop.y = b.y; PROPS.push(b.prop);
    const [rx, ry] = findFloor(inner(p.inD, 2)[0] + 2, inner(p.inD, 2)[1]); const rs = { x: rx * TS + 8, y: ry * TS + 12 }; PROPS.push({ x: rs.x, y: rs.y, r: 5 });
    return { r, obs, b, goal: { tx: best.g[0], ty: best.g[1] }, reset: rs, blocked: best.obs };
  },
  update(p, st, dt) {
    const b = st.b, r = st.r, free = (x: number, y: number) => inBox(r, x, y) && floorAt(x, y) && !st.blocked.has(key(x, y));
    if (b.vx || b.vy) { const tx = b.tx + b.vx, ty = b.ty + b.vy, gx = tx * TS + 8, gy = ty * TS + 8, d = Math.hypot(gx - b.x, gy - b.y), sp = 170 * dt;
      if (d <= sp) { b.x = gx; b.y = gy; b.tx = tx; b.ty = ty; if (!free(tx + b.vx, ty + b.vy)) { b.vx = b.vy = 0; sfx.hit(); burst(b.x, b.y, 6, '#e8f8ff', 40); } }
      else { b.x += (gx - b.x) / d * sp; b.y += (gy - b.y) / d * sp; } }
    b.prop.x = b.x; b.prop.y = b.y;
    if (!p.gateOpen && !b.vx && !b.vy && b.tx === st.goal.tx && b.ty === st.goal.ty) { sfx.level(); openGate(p); }
    if (p.gateOpen || b.vx || b.vy) return;
    for (const pl of G.players) { if (pl.dead) continue; if (Math.hypot(input.mx, input.my) < .5) { b.push = 0; continue; }
      const ax = Math.abs(input.mx) > Math.abs(input.my), dx = ax ? Math.sign(input.mx) : 0, dy = ax ? 0 : Math.sign(input.my);
      const rx = b.x - pl.x, ry = b.y - (pl.y - 2), along = rx * dx + ry * dy, side = Math.abs(rx * dy - ry * dx);
      if (along > 0 && along < 17 && side < 8 && free(b.tx + dx, b.ty + dy)) { if ((b.push += dt) > .25) { b.push = 0; b.vx = dx; b.vy = dy; sfx.dodge(); } } else b.push = 0; }
  },
  reset(p, st) { const b = st.b; b.tx = b.home[0]; b.ty = b.home[1]; b.x = b.tx * TS + 8; b.y = b.ty * TS + 8; b.vx = b.vy = 0; },
  target(p, st, pl) { if (p.gateOpen || Math.hypot(st.reset.x - pl.x, st.reset.y - pl.y) > 20) return null;
    return { btn: '重置', text: '把冰磚放回原位', run: () => { MECHS.iceblock.reset(p, st); sfx.boom(); toast('冰磚碎掉，又在原來的地方凍了起來', '#a8dcff'); } }; },
  draw(p, st, vis, list) {
    const r = st.r; if (!vis(r.x * TS, r.y * TS, r.rx * TS + 40)) return;
    list.push({ y: (r.y - r.ry) * TS - 300, f: () => { ctx.globalAlpha = .28; ctx.fillStyle = '#a8dcff';
      for (let ty = r.y - r.ry; ty <= r.y + r.ry; ty++) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) if (floorAt(tx, ty)) ctx.fillRect(tx * TS, ty * TS, TS, TS);
      ctx.globalAlpha = 1; const g = st.goal, on = p.gateOpen; ctx.strokeStyle = on ? '#ffe38a' : '#e8f8ff'; ctx.lineWidth = HK * 2; ctx.globalAlpha = .6 + .3 * Math.sin(G.time * 4);
      ctx.strokeRect(g.tx * TS + 2, g.ty * TS + 2, TS - 4, TS - 4); ctx.strokeRect(g.tx * TS + 5, g.ty * TS + 5, TS - 10, TS - 10); ctx.globalAlpha = 1; } });
    for (const o of st.obs) list.push({ y: o.y + 4, f: () => { ctx.fillStyle = '#6a9ac8'; ctx.fillRect(snapF(o.x - 6), snapF(o.y - 20), 12, 22); ctx.fillStyle = '#c8e8ff'; ctx.fillRect(snapF(o.x - 6), snapF(o.y - 20), 4, 22); ctx.fillStyle = '#e8f8ff'; ctx.fillRect(snapF(o.x - 6), snapF(o.y - 22), 12, 3); } });
    const b = st.b; list.push({ y: b.y + 6, f: () => { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(snapF(b.x - 8), snapF(b.y + 4), 16, 3); ctx.fillStyle = '#8ac8f0'; ctx.fillRect(snapF(b.x - 8), snapF(b.y - 10), 16, 15);
      ctx.fillStyle = '#d8f0ff'; ctx.fillRect(snapF(b.x - 8), snapF(b.y - 12), 16, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(snapF(b.x - 6), snapF(b.y - 8), 3, 6); } });
    const q = st.reset; list.push({ y: q.y, f: () => { pedestal(q.x, q.y, 9); ctx.fillStyle = '#a8dcff'; ctx.fillRect(snapF(q.x - 2), snapF(q.y - 14), 4, 5); } });
  },
};
