/* ================= 獨特武器的招牌能力 =================
   獨特武器（data/uniques.ts 的 UQ）不用刻印，每把有自己的規則和特效（UQ[k].sig 是卡片上的說明、sc 是刀光顏色）。
   combat.ts 只在幾個地方呼叫這裡：
     sigPre   打中前：改傷害 / 必定暴擊（背刺、蛛網易傷）
     sigHit   打中後（不含招牌自己造成的傷害 proc，避免一直連鎖）
     sigKill  打倒敵人        sigSwing  普攻出手（第幾下）       sigSlam  戰鎚砸地
     sigBlock 被打中之前（近衛之盾）
   worldUpdate.ts：sigTick 每幀（燈魂、螢火蟲、火海、沙暴……）、sigProj 每個玩家投射物每幀（追蹤、分裂、沙暴月、暗月光）。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { sfx } from '../core/audio';
import { moveEnt } from './collision';
import type { Enemy, Player } from '../types';

type Hooks = {
  damage: (pl: Player, e: Enemy, mult: number, sx: number, sy: number, opts?: any) => void;
  aoe: (pl: Player, cx: number, cy: number, rad: number, mult: number, opts?: any) => void;
  line: (pl: Player, x: number, y: number, a: number, len: number, w: number, mult: number, opts?: any) => void;
  shoot: (pl: Player, a: number, mult: number, pierce: boolean, cols: string[], spd?: number, big?: boolean) => void;
  raw: (pl: Player, e: Enemy, v: number, col: string) => void;
  targets: (pl: Player) => Enemy[];
  shake: (m: number, t: number) => void; quake: (x: number, y: number, R: number) => void;
};
let H: Hooks;
export function bindSig(h: Hooks) { H = h; }                            // combat.ts 開機時接上（避免互相 import）
const uq = (pl: Player) => pl && pl.weapon && pl.weapon.uq;
const PROC = { proc: true };
const near = (pl: Player, x: number, y: number, R: number, skip?: Set<Enemy>) => {   // 最近的敵人
  let b: Enemy = null, bd = R; for (const e of H.targets(pl)) { if (e.hp <= 0 || e.obj || (skip && skip.has(e))) continue; const d = Math.hypot(e.x - x, e.y - 6 - y); if (d < bd) { bd = d; b = e; } } return b; };
const parts = (x: number, y: number, n: number, cols: string[], sp = 80, o: any = {}) => { for (let i = 0; i < n; i++) { const a = rr(0, TAU), v = rr(sp * .3, sp);
  G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .7 - (o.up || 0), life: rr(.3, .6), max: .6, col: pick(cols), star: o.s ? undefined : rr(.7, 1.8), s: o.s, g: o.g, drag: o.drag ?? 3 }); } };
const ring = (x: number, y: number, r1: number, col: string, d = .3) => G.fx.push({ k: 'ring', x, y, r0: 3, r1, t: 0, d, col });
/* 會動的小東西（燈魂、螢火蟲、狼影）用 render.ts 的 'sorb' 畫成光球：o = { x, y, done } */
const orb = (o: any, cols: string[], r: number, lw = 4, lr = 30) => G.fx.push({ k: 'sorb', o, cols, r, lw, lr, t: 0, d: 99 });

/* ---------- 變慢（蛛網、暗月光）：e.slowT 到什麼時候、e.slowK 速度倍率 ---------- */
function slow(e: Enemy, secs: number, k: number) { if (e.boss) return; e.slowT = Math.max(e.slowT || 0, G.time + secs); e.slowK = Math.min(e.slowK || 1, k); }
function tickSlow() {
  for (const e of G.enemies) { if (!e.slowT) continue;
    if (G.time < e.slowT && e.hp > 0) { if (e.spd0 == null) e.spd0 = e.spd; e.spd = e.spd0 * e.slowK; }
    else { if (e.spd0 != null) e.spd = e.spd0; e.spd0 = null; e.slowT = 0; e.slowK = 1; } }
}

/* ---------- 場上的東西 ---------- */
type Ent = { k: string; pl: Player; x: number; y: number; t: number; [key: string]: any };
const ents: Ent[] = [];
const count = (pl: Player, k: string) => ents.filter(n => n.pl === pl && n.k === k).length;

/* 苔牙短刀「背刺」：從背後打（怪面向另一邊）→ 必定暴擊、傷害 ×1.3，噴出綠色苔蘚 */
function behind(pl: Player, e: Enemy) { const face = e.flip ? -1 : 1; return (pl.x - e.x) * face < -3; }

/* 守墓人長劍「守墓燈火」：打倒敵人 → 召喚一盞小燈魂繞著你轉（最多 3 盞、20 秒），每 1.2 秒射附近的怪 */
const LANTC = ['#5a3010', '#f0a030', '#ffe08a', '#ffffff'];
function lantern(pl: Player) {
  const n: Ent = { k: 'lantern', pl, x: pl.x, y: pl.y - 12, t: 20, a: rr(0, TAU), cd: rr(.3, .8) }; ents.push(n); orb(n, LANTC, 2.6, 1, 34);
  ring(pl.x, pl.y - 10, 16, '#f0a030'); parts(pl.x, pl.y - 12, 10, ['#ffe08a', '#f0a030', '#ffffff'], 60); sfx.soulTake();
}
/* 潮音長槍「潮汐」：第三下刺出一道水浪，把一排怪推開 */
const WATERC = ['#1a4a8a', '#6ac8ff', '#e8f8ff'];
function tide(pl: Player) {
  const a = pl.face, x = pl.x + Math.cos(a) * 8, y = pl.y - 7 + Math.sin(a) * 8;
  H.line(pl, pl.x, pl.y, a, 74, 16, .8, { proc: true, kb: 3.2 });
  G.fx.push({ k: 'lance', follow: null, x, y, a, len: 74, w: 10, t: 0, d: .32, cols: WATERC });
  for (let i = 0; i < 26; i++) { const u = rr(0, 1), sp = rr(80, 200); G.parts.push({ x: x + Math.cos(a) * 74 * u + rr(-4, 4), y: y + Math.sin(a) * 74 * u + rr(-4, 4), vx: Math.cos(a) * sp + rr(-20, 20), vy: Math.sin(a) * sp - rr(10, 50), life: rr(.3, .55), max: .55, col: pick(['#6ac8ff', '#e8f8ff', '#3a8ad8', '#ffffff']), s: Math.random() < .5 ? 2 : 1, g: 220, drag: 2 }); }
  sfx.splash(); H.shake(2, .1);
}
/* 狼牙雙刃「狼群」：連續打中 5 下 → 跳出一隻狼影撲咬目標 */
function wolfLeap(pl: Player, e: Enemy) {
  const n: Ent = { k: 'wolf', pl, x: pl.x, y: pl.y, t: 0, tgt: e, x0: pl.x, y0: pl.y }; ents.push(n);
  G.fx.push({ k: 'ring', x: pl.x, y: pl.y - 4, r0: 4, r1: 18, t: 0, d: .25, col: '#b8a8ff' }); sfx.howl();
}
/* 燼翼法杖「燼翼」：打中的地方燒起一片火（2.5 秒，每 0.5 秒燒一次），最多 5 片 */
function firePatch(pl: Player, x: number, y: number) {
  if (count(pl, 'fire') >= 5) { const old = ents.find(n => n.pl === pl && n.k === 'fire'); if (old) old.t = 0; }
  ents.push({ k: 'fire', pl, x, y, t: 2.5, tick: .25 }); ring(x, y, 18, '#ff8a2a', .25);
}
/* 霜鬃巨鎚「冰柱」：砸地時，砸地點前方竄出半圈冰柱（5 叢） */
const ICEC = ['#1a3a5a', '#4a8ac8', '#9ae0ff', '#f0faff'];
function iceSpikes(pl: Player, cx: number, cy: number) {
  for (let i = 0; i < 5; i++) { const a = pl.face + (i - 2) * .85 + rr(-.12, .12), sx = cx + Math.cos(a) * 28, sy = cy + Math.sin(a) * 19;   // 砸地點前方的半圈（不會長在自己身上）
    G.fx.push({ k: 'spike', x: sx, y: sy, r: 10, t: 0, d: .6, cols: ICEC }); H.aoe(pl, sx, sy, 12, .35, { proc: true, stun: .3 });
    parts(sx, sy - 6, 4, ['#ffffff', '#9ae0ff'], 50); }
  sfx.freeze();
}
/* 腐沼之鐮「收割」：一般小怪剩 25% 以下（精英 12%）直接斬殺 */
function execute(pl: Player, e: Enemy) {
  const a = Math.atan2(e.y - pl.y, e.x - pl.x);
  G.fx.push({ k: 'slash', x: e.x, y: e.y - 8, a: a + Math.PI / 4, len: 34, t: 0, d: .25, col: '#ff3a4a' });
  G.fx.push({ k: 'slash', x: e.x, y: e.y - 8, a: a - Math.PI / 4, len: 26, t: 0, d: .25, col: '#3ad08a' });
  parts(e.x, e.y - 8, 20, ['#ff3a4a', '#c01020', '#3ad08a', '#ffffff'], 140, { s: 1, g: 260, drag: 1 });
  G.hitStop = Math.max(G.hitStop, .08); H.shake(4, .15); sfx.bleedPop();
  H.raw(pl, e, e.hp, '#ff3a4a');
}
/* 王城近衛劍「近衛之盾」：三連擊的最後一下 → 一層金色護盾（8 秒內擋下一次攻擊） */
function shieldUp(pl: Player) { const had = pl.sigShield > G.time; pl.sigShield = G.time + 8; if (!had) { ring(pl.x, pl.y - 6, 20, '#f2c14e'); parts(pl.x, pl.y - 10, 12, ['#f2c14e', '#fff0a8', '#ffffff'], 70); sfx.charge(1); } }
/* 古爐鍛鎚「鍛打」：打中會加熱（最多 6 層），熱到最高時下一次砸地 → 熔岩爆炸 */
function erupt(pl: Player, cx: number, cy: number) {
  pl.heat = 0; H.aoe(pl, cx, cy, 42, 1.6, { proc: true, heavy: true }); H.quake(cx, cy, 44);
  ring(cx, cy, 46, '#ff6a2a', .4); G.fx.push({ k: 'flash', a: .1, col: '#ffb060', t: 0, d: .15 });
  for (let i = 0; i < 30; i++) { const a = rr(-Math.PI, 0), v = rr(80, 220); G.parts.push({ x: cx + rr(-8, 8), y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rr(.4, .8), max: .8, col: pick(['#ff6a2a', '#ffb040', '#fff0a0', '#c0301a']), s: Math.random() < .4 ? 2 : 1, g: 300, drag: 1 }); }
  firePatch(pl, cx, cy); G.hitStop = Math.max(G.hitStop, .08); H.shake(7, .3); sfx.boom();
}
/* 巢母雙頭刀「蛛網」：打中黏上蛛網 3 秒：變慢、受到的傷害 +20% */
function web(e: Enemy) { const fresh = !(e.webT > G.time); e.webT = G.time + 3; slow(e, 3, .55);   // 網本身畫在 render/enemy.ts 的 drawWeb
  if (fresh) { e.webT0 = G.time; e.webR = rr(0, TAU); ring(e.x, e.y - 8, 18, '#f0f0f8', .22); parts(e.x, e.y - 8, 14, ['#ffffff', '#f0f0f8', '#c8c8d8'], 70); } }
/* 沙王的月牙刀「沙暴月」：月牙砍到敵人就回頭，在那隻腳下捲起一片貼地的沙暴（1.6 秒），把附近的怪吸過去（沒砍到就沒有） */
function sandstorm(pl: Player, x: number, y: number) {
  const n: Ent = { k: 'sand', pl, x, y, t: 1.6, age: 0, tick: 0 }; ents.push(n);
  G.fx.push({ k: 'sstorm', o: n, t: 0, d: 99 });                         // 小龍捲風本體（render/sand.ts：一粒粒沙子捲成的漏斗）
  parts(x, y - 4, 12, ['#6a4a20', '#a07a3a', '#c8a060', '#e8d098'], 80, { s: 1, drag: 2 }); H.shake(2, .15); sfx.wind();   // 捲起來的一瞬間往外噴一圈沙（不畫光圈）
}
/* 精靈王的長弓「王之箭」：每第 6 箭多射一支金色大箭，第一次打中就分裂成 3 支 */
const ROYALC = ['#8a6a10', '#ffe08a', '#ffffff'];
function royalArrow(pl: Player) {
  const n0 = G.projs.length; H.shoot(pl, pl.face, 2, true, ROYALC, 520, true);
  for (let i = n0; i < G.projs.length; i++) G.projs[i].royal = true;
  parts(pl.x + Math.cos(pl.face) * 12, pl.y - 8, 10, ROYALC, 70); sfx.perfect();
}
function splitRoyal(p: any) {
  p.royal = false; const a0 = Math.atan2(p.vy, p.vx), sp = Math.hypot(p.vx, p.vy);
  for (const da of [-.45, 0, .45]) { const a = a0 + da;
    G.projs.push({ ...p, x0: p.x, y0: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, mult: .7, life: .45, big: false, r: 3, light: true, royal: false, hit: new Set(p.hit) }); }
  ring(p.x, p.y, 14, '#ffe08a', .2); parts(p.x, p.y, 10, ROYALC, 90);
}
/* 月泉細劍「月痕」：連刺同一隻疊月痕（頭上一排小月亮），5 層 → 月光爆發（必定暴擊） */
function moonBurst(pl: Player, e: Enemy) {
  e.mark = 0; H.damage(pl, e, 1.5, pl.x, pl.y, { proc: true, crit: true, heavy: true });
  ring(e.x, e.y - 6, 30, '#c8e0ff', .35); ring(e.x, e.y - 6, 18, '#ffffff', .25);
  G.fx.push({ k: 'zap', pts: [[e.x, e.y - 70], [e.x, e.y - 6]], t: 0, d: .3, col: '#a8c4ff' });
  parts(e.x, e.y - 8, 18, ['#ffffff', '#c8e0ff', '#a8c4ff'], 110); sfx.perfect();
}
/* 螢火雙刀「螢火」：打中有機會放出螢火蟲（最多 8 隻），先飄一下，再衝向附近的怪 */
const FLYC = ['#5a5a10', '#f0f060', '#ffffc8', '#ffffff'];                 // 亮黃綠（太綠會跟草地混在一起）
function firefly(pl: Player, e: Enemy) { const n: Ent = { k: 'fly', pl, x: e.x + rr(-4, 4), y: e.y - 10, t: 0, vx: rr(-40, 40), vy: -rr(30, 60), ph: rr(0, 9) }; ents.push(n); orb(n, FLYC, 2.6, 4, 30); }

/* ================= combat.ts 呼叫的 ================= */
/* 蠍尾短刀「連鎖」：額外的暴擊率（combat.ts 的 calcDmg 加上去）。層數在 sigHit 更新 */
export const CHAIN_K = 20, CHAIN_MAX = 3;
export function sigCrit(pl: Player) { return uq(pl) === 'scorpfang' ? (pl.chain || 0) * CHAIN_K : 0; }
function chainHit(pl: Player, e: Enemy, crit: boolean) {
  if (G.time - (pl.chainT || 0) < .1) return;                            // 同一刀砍到好幾隻只算一次
  pl.chainT = G.time;
  if (!crit) { if (pl.chain > 0) parts(pl.x, pl.y - 26, 6, ['#6a3a3a', '#8a6a6a'], 30); pl.chain = 0; return; }   // 斷掉：頭上的蠍尾散掉
  pl.chain = Math.min(CHAIN_MAX, (pl.chain || 0) + 1);
  const C = ['#ff4a5a', '#ffd0d4', '#ffffff'];
  ring(e.x, e.y - 6, 10 + pl.chain * 5, pl.chain === CHAIN_MAX ? '#ffd84a' : '#ff4a5a', .22); parts(e.x, e.y - 8, 4 + pl.chain * 4, C, 80 + pl.chain * 20);
  if (pl.chain === CHAIN_MAX) sfx.charge(2);
}
/* 打中前：回傳要不要改成暴擊、傷害倍率 */
export function sigPre(pl: Player, e: Enemy, proc: boolean) {
  const k = uq(pl), r = { crit: false, mul: 1 }; if (!k || proc) return r;
  if (k === 'mossfang' && behind(pl, e)) { r.crit = true; r.mul = 1.3; ring(e.x, e.y - 6, 16, '#6ab04a', .25); parts(e.x, e.y - 8, 12, ['#6ab04a', '#3a7a2a', '#c8f0a0'], 90, { s: 1, g: 200 }); }
  if (k === 'silktwin' && e.webT > G.time) r.mul *= 1.2;
  return r;
}
export function sigHit(pl: Player, e: Enemy, crit = false) {
  const k = uq(pl); if (!k) return;
  if (k === 'scorpfang') chainHit(pl, e, crit);
  if (k === 'wolfblade') { if (G.time - (pl.huntT || 0) > .1) { pl.huntT = G.time; pl.hunt = (pl.hunt || 0) + 1; }
    if (pl.hunt >= 5 && e.hp > 0) { pl.hunt = 0; wolfLeap(pl, e); } }
  else if (k === 'emberstaff') { if (G.time - (pl.emT || 0) > .35) { pl.emT = G.time; firePatch(pl, e.x, e.y); } }
  else if (k === 'rotscythe') { if (!e.boss && e.hp > 0 && e.hp <= e.maxHp * (e.elite ? .12 : .25)) execute(pl, e); }
  else if (k === 'forgehammer') { if (G.time - (pl.heatHit || 0) > .1) { pl.heatHit = G.time; pl.heat = Math.min(6, (pl.heat || 0) + 1); if (pl.heat === 6) { ring(pl.x, pl.y - 6, 18, '#fff0a0', .3); sfx.charge(2); } } }
  else if (k === 'silktwin') web(e);
  else if (k === 'elfrapier') { if (G.time - (e.markT || 0) > 2.5) e.mark = 0; if (G.time - (e.markT || 0) > .08) { e.markT = G.time; e.mark = (e.mark || 0) + 1; } if (e.mark >= 5 && e.hp > 0) moonBurst(pl, e); }
  else if (k === 'elfblades') { if (G.time - (pl.flyT || 0) > .15 && Math.random() < .4 && count(pl, 'fly') < 8) { pl.flyT = G.time; firefly(pl, e); } }
}
export function sigKill(pl: Player, e: Enemy) { if (uq(pl) === 'barrowblade' && count(pl, 'lantern') < 3) lantern(pl); }
export function sigSwing(pl: Player, fin: boolean) {
  const k = uq(pl); if (!k) return;
  if (k === 'tidespear' && fin) pl.timers.push({ t: .14, fn: () => tide(pl) });
  if (k === 'royalguard' && fin) pl.timers.push({ t: .16, fn: () => shieldUp(pl) });
  if (k === 'elfbow') { pl.royalN = (pl.royalN || 0) + 1; if (pl.royalN >= 6) { pl.royalN = 0; pl.timers.push({ t: .12, fn: () => royalArrow(pl) }); } }
}
export function sigSlam(pl: Player, cx: number, cy: number) {
  const k = uq(pl);
  if (k === 'frostmaul') iceSpikes(pl, cx, cy);
  if (k === 'forgehammer' && pl.heat >= 6) erupt(pl, cx, cy);
}
/* 被打中之前：近衛之盾擋下這一下（回傳 true = 這一下不算） */
export function sigBlock(pl: Player) {
  if (!(pl.sigShield > G.time)) return false; pl.sigShield = 0; pl.iframe = Math.max(pl.iframe, .35);
  ring(pl.x, pl.y - 6, 26, '#f2c14e', .35); parts(pl.x, pl.y - 10, 18, ['#f2c14e', '#fff0a8', '#ffffff'], 130); H.shake(2, .1); sfx.block();
  return true;
}

/* ================= worldUpdate.ts 呼叫的 ================= */
/* 玩家的投射物每幀：深淵祭司杖的法彈追蹤、王之箭分裂、沙暴月、暗月光 */
export function sigProj(p: any, dt: number) {
  const k = uq(p.by); if (!k) return;
  if (k === 'deepstaff' && (p.kind === 'bolt' || p.kind === 'fire')) {
    const t = near(p.by, p.x, p.y, 150); if (t) { const sp = Math.hypot(p.vx, p.vy), cur = Math.atan2(p.vy, p.vx); let d = Math.atan2(t.y - 6 - p.y, t.x - p.x) - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
      const a = cur + Math.max(-7 * dt, Math.min(7 * dt, d)); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; }
    if (Math.random() < .7) G.parts.push({ x: p.x + rr(-2, 2), y: p.y + rr(-2, 2), vx: 0, vy: 0, life: .35, max: .35, col: pick(['#2a1040', '#6a3aa0', '#40e0c0']), star: rr(.6, 1.4) }); }
  else if (k === 'elfbow' && p.royal && p.hit && p.hit.size > 0) splitRoyal(p);
  else if (k === 'sandcrescent' && p.kind === 'boom' && !p.sand && p.hit.size > 0) {   // 砍到敵人：去程就立刻回頭；沙暴捲在被砍到的那隻腳下（一道月牙只捲一次，沒砍到就沒有）
    p.sand = true; if (!p.back) p.age = Math.max(p.age || 0, p.ret);   // 讓 boomMotion 下一幀就開始回程
    let x = p.x, y = p.y + 7; for (const e of p.hit) { x = e.x; y = e.y; break; }
    sandstorm(p.by, x, y); }
  else if (k === 'darkmoon' && p.kind === 'wave') { if (p.mlx == null || Math.hypot(p.x - p.mlx, p.y - p.mly) > 16) { p.mlx = p.x; p.mly = p.y; ents.push({ k: 'moon', pl: p.by, x: p.x, y: p.y + 7, t: 2.5 }); } }
}
/* 每幀 */
export function sigTick(dt: number) {
  tickSlow();
  for (const pl of G.players) {
    const k = uq(pl);
    if (pl.sigShield > G.time) { if (Math.random() < dt * 30) { const a = rr(0, TAU); G.parts.push({ x: pl.x + Math.cos(a) * 11, y: pl.y - 8 + Math.sin(a) * 8, vx: -Math.sin(a) * 30, vy: Math.cos(a) * 20, life: .3, max: .3, col: pick(['#f2c14e', '#fff0a8']), star: rr(.6, 1.2) }); } }   // 護盾：身邊一圈金光
    if (pl.chain > 0 && (k !== 'scorpfang' || G.time - (pl.chainT || 0) > 3)) pl.chain = 0;   // 連鎖：3 秒沒打到東西 / 換武器 → 歸零
    if (k === 'forgehammer' && pl.heat > 0) { if (G.time - (pl.heatHit || 0) > 3) pl.heat = Math.max(0, pl.heat - dt * 2);       // 3 秒沒打到東西就慢慢冷掉
      if (Math.random() < dt * pl.heat * 6) { const hx = pl.x + Math.cos(pl.face) * 10; G.parts.push({ x: hx + rr(-4, 4), y: pl.y - rr(6, 14), vx: rr(-6, 6), vy: -rr(20, 50), life: .4, max: .4, col: pl.heat >= 6 ? pick(['#ffffff', '#fff0a0']) : pick(['#ff6a2a', '#ffb040']), star: rr(.6, 1.5), drag: 1 }); } }   // 鎚子越熱冒越多火星，最熱時是白的
    if (k !== 'forgehammer') pl.heat = 0;
  }
  for (const e of G.enemies) {                                           // 怪物身上的記號：蛛網、月痕
    if (e.webT > G.time && Math.random() < dt * 6) G.fx.push({ k: 'aline', x: e.x + rr(-7, 7), y: e.y - rr(2, 14), a: rr(0, TAU), len: rr(5, 9), t: 0, d: .3, col: '#e8e8f4' });
    if (e.mark > 0) { if (G.time - (e.markT || 0) > 2.5) e.mark = 0; else for (let i = 0; i < e.mark; i++) G.parts.push({ x: e.x + (i - (e.mark - 1) / 2) * 4, y: e.y - 26, vx: 0, vy: 0, life: .04, max: .04, col: i === 4 ? '#ffffff' : '#a8c4ff', star: 1.2 }); }   // 頭上一排小月亮 = 疊了幾層
  }
  for (let i = ents.length - 1; i >= 0; i--) { const n = ents[i], pl = n.pl; n.t += n.k === 'wolf' || n.k === 'fly' ? dt : -dt;
    if (n.k === 'lantern') {                                             // 燈魂：繞著主角轉，冷卻好了就射最近的怪
      n.a += dt * 2.2; const idx = ents.filter(m => m.pl === pl && m.k === 'lantern').indexOf(n), a = n.a + idx * TAU / 3;
      n.x = pl.x + Math.cos(a) * 16; n.y = pl.y - 12 + Math.sin(a) * 7; n.cd -= dt;
      if (n.cd <= 0) { const t = near(pl, n.x, n.y, 110); n.cd = t ? 1.2 : .3;
        if (t) { G.fx.push({ k: 'zap', pts: [[n.x, n.y], [t.x, t.y - 8]], t: 0, d: .2, col: '#ffc860', thin: true }); H.damage(pl, t, .35, n.x, n.y + 6, PROC); parts(t.x, t.y - 8, 5, ['#ffe08a', '#f0a030'], 50); } }
      if (n.t <= 0 || pl.dead) { n.done = true; parts(n.x, n.y, 8, ['#ffe08a', '#f0a030'], 40); ents.splice(i, 1); } }
    else if (n.k === 'wolf') {                                           // 狼影：0.28 秒撲到目標身上，留下一路殘影
      const tg = n.tgt, q = Math.min(1, n.t / .28), x = n.x0 + (tg.x - n.x0) * q, y = n.y0 + (tg.y - n.y0) * q - Math.sin(q * Math.PI) * 14;
      n.x = x; n.y = y; G.fx.push({ k: 'wghost', kind: 'wolf', x, y, flip: tg.x < n.x0, t: 0, d: .22 });
      if (q >= 1) { ents.splice(i, 1); if (tg.hp > 0) { H.damage(pl, tg, 2, x, y, { proc: true, stun: .4, heavy: true }); ring(tg.x, tg.y - 6, 22, '#b8a8ff', .3); parts(tg.x, tg.y - 8, 16, ['#b8a8ff', '#ffffff', '#6a5aa0'], 120); sfx.crit(); } } }
    else if (n.k === 'fire') {                                           // 火海：一直冒火，每 0.5 秒燒一次站在裡面的怪
      if (Math.random() < dt * 40) G.parts.push({ x: n.x + rr(-14, 14), y: n.y - rr(0, 6), vx: rr(-6, 6), vy: -rr(25, 55), life: rr(.3, .55), max: .55, col: pick(['#ff6a2a', '#ffb040', '#ffe08a', '#c0301a']), star: rr(.7, 1.6), drag: 1 });
      n.tick -= dt; if (n.tick <= 0) { n.tick = .5; for (const e of H.targets(pl)) if (e.hp > 0 && Math.hypot(e.x - n.x, e.y - n.y) < 18 + e.r) H.damage(pl, e, .15, n.x, n.y - 6, { proc: true, kb: 0 }); }
      if (n.t <= 0) ents.splice(i, 1); }
    else if (n.k === 'sand') {                                           // 沙暴：把附近的小怪往中間吸，每 0.3 秒刮一下（揚起的沙貼著地面、繞著轉、往中間吸）
      n.age += dt;
      for (let s = 0; s < 2; s++) { const a = rr(0, TAU), r = rr(14, 48), h = rr(0, 4); G.parts.push({ x: n.x + Math.cos(a) * r, y: n.y - h + Math.sin(a) * r * .35, vx: -Math.sin(a) * 90 - Math.cos(a) * 40, vy: (Math.cos(a) * 90 - Math.sin(a) * 40) * .35 - 6, life: .35, max: .35, col: pick(['#d8b870', '#b89850', '#f0e0a8', '#8a6a3a']), s: Math.random() < .3 ? 2 : 1, drag: 2 }); }   // 捲起來的沙塵、碎石
      for (const e of H.targets(pl)) { if (e.boss || e.hp <= 0) continue; const dx = n.x - e.x, dy = n.y - e.y, d = Math.hypot(dx, dy); if (d < 56 && d > 4) { moveEnt(e, dx / d * 85 * dt, dy / d * 85 * dt);
        if (Math.random() < dt * 20) G.parts.push({ x: e.x + rr(-5, 5), y: e.y - rr(2, 12), vx: dx / d * 90, vy: dy / d * 50, life: .25, max: .25, col: '#f0e0a8', s: 1 }); } }   // 被吸過去的怪身上拖著沙
      n.tick -= dt; if (n.tick <= 0) { n.tick = .3; H.aoe(pl, n.x, n.y, 40, .2, { proc: true, kb: 0 }); }
      if (n.t <= 0) { n.done = true; ents.splice(i, 1); } }
    else if (n.k === 'moon') {                                           // 暗月光：月光劍浪經過的地方留下冷光，踩到的怪變慢
      if (Math.random() < dt * 10) G.parts.push({ x: n.x + rr(-10, 10), y: n.y - rr(0, 4), vx: 0, vy: -rr(5, 15), life: .6, max: .6, col: pick(['#8aa0ff', '#c8d8ff', '#eef4ff']), star: rr(.5, 1.1) });
      for (const e of G.enemies) if (e.hp > 0 && Math.hypot(e.x - n.x, e.y - n.y) < 14 + e.r) slow(e, .5, .5);
      if (n.t <= 0) ents.splice(i, 1); }
    else if (n.k === 'fly') {                                            // 螢火蟲：飄 0.5 秒 → 衝向最近的怪
      if (n.t < .5) { n.vx *= .94; n.vy *= .94; n.x += n.vx * dt + Math.sin(G.time * 12 + n.ph) * .4; n.y += n.vy * dt; }
      else { if (!n.tgt || n.tgt.hp <= 0) n.tgt = near(pl, n.x, n.y, 140);
        if (!n.tgt || n.t > 2.5) { n.done = true; ents.splice(i, 1); continue; }
        const dx = n.tgt.x - n.x, dy = n.tgt.y - 8 - n.y, d = Math.hypot(dx, dy); n.x += dx / d * 260 * dt; n.y += dy / d * 260 * dt;
        if (d < 8) { n.done = true; ents.splice(i, 1); H.damage(pl, n.tgt, .4, n.x, n.y + 6, PROC); parts(n.x, n.y, 8, ['#c8f060', '#f8ffc0', '#ffffff'], 70); } }
      if (Math.random() < dt * 30) G.parts.push({ x: n.x, y: n.y, vx: 0, vy: 0, life: .3, max: .3, col: pick(['#f0f060', '#ffffc8']), star: 1 }); }
  }
}
export function clearSig() { ents.length = 0; }
