/* ---- 寶箱：散落在野外偏僻的地方，按攻擊鍵打開（打開後會化成光點消失）。木箱 / 銀箱 / 金箱，越好的箱子東西越好；有些是寶箱怪 ---- */
import { tier } from '../data/levels';
import { G } from '../core/state';
import { $, mulberry32, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { SH, sculpt } from '../art/monsters';
import { makeUnique, randomLoot } from '../data/items';
import { DUNGEONS } from './dungeons';
import { flags } from '../game/quest';
import { ARENA, CAMPS, GROUND, MH, MW, RFLOOR, ROAD, TOWNS, TS, WALKABLE, map, reg } from './map';
import { RBDEF } from './regionBoss';
import { drawArtSprite } from './chunks';
import { dropItem, makeEnemy } from '../game/enemies';
import { burst, dropGold, dropMat, dropSouls, shake } from '../game/worldUpdate';
import { oreForLevel } from '../data/forge';
import { drawShadow } from '../render/player';
import { sfx } from '../core/audio';
import { showBanner, toast } from '../ui/hud';
import { save } from '../game/save';
import type { Player } from '../types';

export interface Chest { id: string; tx: number; ty: number; x: number; y: number; tier: number; lv: number; mimic: boolean; opened: boolean; t: number; foe?: any;
  uq?: string; need?: string; poof?: boolean; wild?: boolean }         // wild = 野外隨機寶箱（東西最高到藍色）                        // poof = 打開後消失的特效已經放過了                                           // uq = 固定的獨特武器；need = 要先達成的旗標（地城守護者倒下）
export const CHESTS: Chest[] = [];
const TIER = [{ n:'木製寶箱', col:'#c8a070' }, { n:'白銀寶箱', col:'#9ad0ff' }, { n:'黃金寶箱', col:'#f2c14e' }];
const REG_LV = [8, 20, 32, 45, 20, 58, 70, 10];                               // 每個地區野外寶箱的等級
export const WILD_CAP = 2;                                              // 野外寶箱開出來的東西最高到藍色（RAR[2]）：沒有刻印、沒有獨特

/* 放寶箱：reach = 從起點走得到的格子。偏僻 = 離道路、營火都有一段距離 */
export function genChests(reach: Uint8Array) {
  CHESTS.length = 0;
  const I = (x, y) => y * MW + x;
  const open = (x, y) => { const i = I(x, y); if (!reach[i] || !(map[i] === GROUND || map[i] === RFLOOR)) return false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!WALKABLE(map[I(x + dx, y + dy)])) return false; return true; };
  const blocked = (x, y) => (x >= ARENA.x0 - 3 && x <= ARENA.x1 + 3 && y >= ARENA.y0 - 3 && y <= ARENA.y1 + 3) ||
    Object.values(RBDEF).some(d => Math.hypot(d.tx - x, d.ty - y) < d.tr + 3) || CHESTS.some(c => Math.hypot(c.tx - x, c.ty - y) < 22);
  const add = (x, y, tier, lv, mimic, wild = false) => CHESTS.push({ id: 'c' + x + '_' + y, /* 用位置當編號：地圖改了也不會對錯箱子 */ tx: x, ty: y, x: x * TS + 8, y: y * TS + 10, tier, lv, mimic, opened: false, t: 0, wild });
  const near = (x0, y0) => { for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = x0 + dx, y = y0 + dy;   // 從指定點往外找最近能放的格子
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && open(x, y) && !blocked(x, y)) return [x, y]; } return null; };
  // 地標寶箱：固定位置、比較好的箱子
  for (const [x, y, tier, lv] of [[84, 362, 0, 10], [48, 330, 0, 8], [182, 470, 1, 12], [96, 330, 0, 10],                          // 平原
    [368, 382, 1, 22], [240, 302, 0, 20], [282, 346, 1, 20], [206, 256, 0, 18],                                                         // 森林
    [160, 62, 2, 35], [38, 50, 1, 30], [100, 104, 2, 38], [30, 206, 0, 30], [118, 242, 1, 32],                                      // 荒地
    [380, 163, 2, 48], [304, 168, 1, 45], [396, 62, 1, 48], [252, 96, 1, 42],                                                       // 熔岩
    [545, 152, 1, 58], [470, 182, 1, 55], [612, 70, 2, 62], [500, 104, 0, 52],                                                      // 雪原
    [455, 342, 2, 70], [522, 300, 1, 68], [610, 260, 1, 70], [534, 462, 1, 72]]) {                                                 // 沼澤
    const p = near(x, y); if (p) add(p[0], p[1], tier, lv, false); }
  // 地城：岔路房的銀箱 + 最深處的金箱（獨特武器，要先打倒守護者）。地城裡面走路到不了起點，所以直接放
  for (const d of DUNGEONS) { if (!d.bossChest) continue;
    CHESTS.push({ id: 'd_' + d.id, tx: d.bossChest[0], ty: d.bossChest[1], x: d.bossChest[0] * TS + 8, y: d.bossChest[1] * TS + 10, tier: 2, lv: d.lv + 2, mimic: false, opened: false, t: 0, uq: d.uq, need: 'dgn:' + d.id });
    d.sideChests.forEach(([x, y], k) => add(x, y, d.style === 'ruin' && k === 0 ? 2 : 1, d.lv + 1, false)); }
  /* 野外隨機寶箱：每個地區只留幾個，而且最多是白銀寶箱、東西最高到藍色、只給一顆素材
     （以前一百多個、還會開出刻印和一堆素材，路邊隨手開幾個就變很強。刻印要去地城、地標、機關拿） */
  const R = mulberry32(4242);
  for (const r of [0, 1, 2, 3, 5, 6]) {
    let n = 0, tries = 0;
    while (n < (r === 0 ? 6 : 5) && tries++ < 120000) {
      const x = 4 + Math.floor(R() * (MW - 8)), y = 4 + Math.floor(R() * (MH - 8));
      if (reg[I(x, y)] !== r || !open(x, y) || blocked(x, y)) continue;
      if (CAMPS.some(c => Math.hypot(c.tx - x, c.ty - y) < 12) || TOWNS.some(T => Math.hypot(T.tx - x, T.ty - y) < T.r + 6)) continue;
      let road = false; for (let dy = -4; dy <= 4 && !road; dy++) for (let dx = -4; dx <= 4; dx++) if (map[I(x + dx, y + dy)] === ROAD) { road = true; break; }
      if (road) continue;                                              // 不要擺在路邊：要稍微探索才找得到
      add(x, y, R() < .35 ? 1 : 0, REG_LV[r] + Math.floor(R() * 5) - 2, r !== 0 && R() < .2, true); n++;   // 平原以外 20% 是寶箱怪
    }
  }
}
export const sealed = (c: Chest) => !!c.need && !flags.has(c.need);   // 地城最深處的金箱：守護者還活著 → 封著，靠近也不會變成「打開」
export const nearChest = (pl: Player) => { if (pl.dead) return null; for (const c of CHESTS) if (!c.opened && !c.foe && !sealed(c) && Math.abs(c.x - pl.x) < 22 && Math.hypot(c.x - pl.x, c.y - pl.y) < 22) return c; return null; };
export function openChest(pl: Player, c: Chest) {
  if (c.opened || c.foe) return;
  if (c.need && !flags.has(c.need)) { toast('寶箱被一股力量封住了……先打倒這裡的守護者', '#c8a8ff'); return; }
  if (c.mimic) {                                                       // 寶箱怪：張開嘴撲過來，打倒才拿得到東西
    const e = makeEnemy('mimic', c.lv + 1, c.x, c.y - 2, { elite: true, ename: '寶箱怪', alive: true, timer: 0 });
    e.state = 'chase'; e.chest = c; c.foe = e; G.enemies.push(e);
    toast('是寶箱怪！', '#ff6a5a'); shake(4, .25); sfx.howl(); burst(c.x, c.y - 6, 16, '#7a5434', 80);
    return;
  }
  c.opened = true; c.t = 0; giveLoot(c, pl); save();
}
function giveLoot(c: Chest, pl: Player) {
  const lv = c.lv, t = tier(lv), T = c.tier;
  dropGold(c.x, c.y, Math.round([20 + t * 4, 40 + t * 8, 80 + t * 15][T] * rr(.85, 1.15)));
  dropSouls(c.x, c.y, Math.round([t * 5, t * 10, t * 20][T]), pl);
  dropMat(c.x, c.y, oreForLevel(lv), c.wild ? 1 : 2 + T, pl); if (T === 2) dropMat(c.x, c.y, oreForLevel(lv + 12), 1, pl);   // 野外寶箱只給一顆   // 黃金寶箱多一顆下一級的素材（一個地區差不多 12 級 = tier +5）
  if (c.uq) { const it = makeUnique(c.uq); dropItem(it, c.x, c.y); showBanner('獲得傳說武器', it.name, 2600); sfx.epic(); return; }   // 地城最深處：固定的獨特武器
  const q = Math.random(), cap = c.wild ? WILD_CAP : 4;
  if (T === 0) { if (q < .65) dropItem(randomLoot(lv, q < .2 ? 2 : 1, undefined, cap), c.x, c.y); }
  else if (T === 1) dropItem(randomLoot(lv, q < .3 ? 3 : 2, undefined, cap), c.x, c.y);
  else { dropItem(randomLoot(lv, q < .25 ? 4 : 3), c.x, c.y); dropItem(randomLoot(lv, 2), c.x, c.y); }
  if (T === 2) showBanner('黃金寶箱', '裡面閃閃發光', 1800); else toast('打開了' + TIER[T].n, TIER[T].col);
  for (let i = 0; i < 18 + T * 10; i++) { const a = rr(-Math.PI, 0), v = rr(40, 120); G.parts.push({ x: c.x + rr(-4, 4), y: c.y - 8, vx: Math.cos(a) * v * .6, vy: Math.sin(a) * v, life: rr(.4, .8), max: .8, col: pick(['#ffe38a', '#fff6d0', TIER[T].col]), star: rr(.8, 2), drag: 2 }); }
  sfx.coin(); if (T === 2) sfx.epic();
}
/* 寶箱怪被打倒 → 箱子算打開了，再額外掉一件好東西 */
export function mimicDown(e) { const c: Chest = e.chest; if (!c) return; c.foe = null; c.opened = true; c.t = 2; c.mimic = false; dropItem(randomLoot(c.lv, Math.random() < .4 ? 3 : 2, undefined, c.wild ? WILD_CAP : 4), c.x, c.y); save(); }
/* 休息時野外的怪物會復活：沒打倒的寶箱怪會變回寶箱，下次打開又會跳出來 */
export function resetMimics() { for (const c of CHESTS) c.foe = null; }

/* ---- 畫：三種箱子 × 關著 / 打開。一眼要分得出來：
   木箱 = 褐色 + 鐵條，沒什麼光；銀箱 = 藍鋼 + 亮銀邊 + 藍寶石，冷藍光和往上飄的藍色光點；
   金箱 = 紅漆 + 粗金邊 + 紅寶石，一道往上的金色光柱（遠遠就看得到）+ 金色火花 ---- */
const WOOD = ['#2e1c0e', '#4a3018', '#6a4626', '#86603a', '#a07a4c'], STEEL = ['#121a2e', '#1e2e52', '#2e4a7a', '#44689c', '#5e86ba'], RED = ['#2a0e10', '#4a1820', '#6a2430', '#8a3440', '#a84a52'];
const BANDS = [['#1e1c24', '#34323e', '#4e4c5c', '#6a6878'], ['#4a5468', '#a4b2c8', '#e0e8f6', '#ffffff'], ['#7a4a1a', '#c0862c', '#f2c14e', '#fff0a8']];
function chestArt(tier, open) {
  const B = BANDS[tier], body = [WOOD, STEEL, RED][tier];
  const parts: Record<string, any>[] = [{ sh: SH.box(18, 23, 15, 7, 7), ramp: body, tex: .2, grp: 1 }];
  if (open) parts.unshift({ sh: SH.box(18, 10, 14.5, 4, 7), ramp: body, tex: .2, grp: 2 });          // 打開：蓋子往後翻，畫在箱子後面
  else parts.push({ sh: SH.ell(18, 16, 15.5, 7.5, (x, y) => y < 16.5), ramp: body, tex: .2, grp: 2 });
  return sculpt(36, 31, parts, a => {
    for (const py of [20, 25]) for (let x = 4; x < 32; x++) if (a.get(x, py) && a.get(x, py + 1)) a.set(x, py, body[1]);   // 木板縫
    if (!open) for (const py of [11, 14]) for (let x = 5; x < 31; x++) if (a.get(x, py) && a.get(x, py - 1)) a.set(x, py, body[1]);
    const bw = tier === 0 ? 1 : 2;                                                                     // 銀箱、金箱的邊條比較粗
    for (const bx of [7, 28]) for (let y = open ? 7 : 9; y < 30; y++) if (a.get(bx, y)) for (let k = 0; k <= bw; k++) a.set(bx + k - (bx > 18 ? bw - 1 : 0), y, k === 0 ? B[3] : k === bw ? B[1] : B[2]);
    for (let x = 3; x < 33; x++) if (a.get(x, 16)) { a.set(x, 16, B[tier ? 2 : 0]); if (tier) a.set(x, 17, B[1]); }
    if (tier) for (let x = 3; x < 33; x++) for (const y of [29, 30]) if (a.get(x, y) && !a.get(x, y + 2)) a.set(x, y, y === 29 ? B[2] : B[1]);   // 底邊也包一圈金屬
    if (open) { for (let y = 13; y < 17; y++) for (let x = 4; x < 32; x++) a.set(x, y, y === 13 ? '#3a2410' : y === 14 ? '#ffe38a' : y === 15 ? '#f2c14e' : '#7a4a1a');   // 箱子裡的金光
      for (let x = 7; x < 29; x += 3) a.set(x, 12, '#fff6d0'); }
    else { a.rect(15, 13, 6, 7, B[2]); a.rect(16, 14, 4, 5, B[1]); a.set(15, 13, B[3]); a.set(18, 16, '#140c08'); a.set(18, 17, '#140c08');
      if (tier === 1) { a.rect(17, 14, 2, 2, '#6ac8ff'); a.set(17, 14, '#e0f4ff'); } }                  // 銀箱：鎖上一顆藍寶石
    if (tier === 2) for (const [x, y] of [[12, 21], [24, 21], [18, 25], [12, 12], [24, 12]]) if (a.get(x, y)) { a.rect(x - 1, y - 1, 3, 3, '#c01838'); a.set(x, y, '#ff4a6a'); a.set(x - 1, y - 1, '#ffd0dc'); }   // 金箱：鑲紅寶石
  });
}
export const ART = [0, 1, 2].map(t => [chestArt(t, false), chestArt(t, true)]);
const GLOW = [null, ['#9ad0ff', '#d8f0ff', '#ffffff'], ['#f2c14e', '#ffe38a', '#fff6d0']];
function drawBeam(c: Chest) {                                            // 金箱：從箱子往上的光柱，越上面越淡，慢慢呼吸
  const k = .5 + .5 * Math.sin(G.time * 2 + c.tx), H = 70, x = c.x, y = c.y - 4;
  for (const [w, al] of [[7, .1], [4, .16], [1.4, .35]]) {
    const g = ctx.createLinearGradient(0, y - H, 0, y); g.addColorStop(0, 'rgba(255,226,140,0)'); g.addColorStop(1, 'rgba(255,236,170,' + (al * (.75 + .25 * k)) + ')');
    ctx.fillStyle = g; ctx.fillRect(snapF(x - w / 2), snapF(y - H), w, H); }
}
function drawGround(c: Chest, col: string, r: number) {                  // 箱子底下一圈光暈
  ctx.globalAlpha = .18 + .06 * Math.sin(G.time * 3 + c.tx); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(snapF(c.x), snapF(c.y + 1), r, r * .35, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}
function drawSealed(c: Chest) {                                           // 封住的金箱：暗暗的、沒有光柱；一圈紫色封印繞著它轉，偶爾飄出紫色光點
  drawShadow(c.x, c.y + 1, 14); ctx.globalAlpha = .55; drawArtSprite(ART[c.tier][0], c.x, c.y + 3); ctx.globalAlpha = 1;
  const t = G.time, cy = c.y - 6;
  for (let k = 0; k < 10; k++) { const a = t * .9 + k * TAU10, x = c.x + Math.cos(a) * 15, y = cy + Math.sin(a) * 6;
    ctx.globalAlpha = .55 + .35 * Math.sin(t * 3 + k); ctx.fillStyle = k % 2 ? '#c8a8ff' : '#8a5ad8'; ctx.fillRect(snapF(x - HK), snapF(y - HK), HK * 2, HK * 2); }
  ctx.globalAlpha = 1;
  if (Math.random() < .12) G.parts.push({ x: c.x + rr(-10, 10), y: c.y - rr(0, 8), vx: rr(-3, 3), vy: -rr(8, 18), life: rr(.6, 1), max: 1, col: pick(['#8a5ad8', '#c8a8ff']), star: rr(.5, 1), drag: 1 });
}
const TAU10 = Math.PI * 2 / 10;
const VANISH = .7, GONE = 1.2;                                           // 打開後 0.7 秒開始化成光點，1.2 秒完全消失
export function drawChests(L, vis, addLight, list) {
  for (const c of CHESTS) {
    if (c.foe || !vis(c.x, c.y, c.tier === 2 ? 80 : 20)) continue;
    if (c.opened) { if (c.t < 2) c.t += 1 / 60; if (c.t >= GONE) continue; }
    if (c.opened && c.t >= VANISH && !c.poof) { c.poof = true;                                        // 消失：一圈光點往上散開
      const cols = GLOW[c.tier] || ['#c8a070', '#ffe38a', '#fff6d0'];
      for (let i = 0; i < 22 + c.tier * 8; i++) G.parts.push({ x: c.x + rr(-7, 7), y: c.y - rr(0, 10), vx: rr(-20, 20), vy: -rr(20, 60), life: rr(.5, 1), max: 1, col: pick(cols), star: rr(.6, 1.8), drag: 2 });
      G.fx.push({ k: 'warp', x: c.x, y: c.y - 4, r0: 4, r1: 22, th: 2, delay: 0, t: 0, d: .35, col: cols[1] }); }
    const T = c.tier, closed = !c.opened, seal = closed && sealed(c);
    if (seal) { list.push({ y: c.y, f: () => drawSealed(c) }); addLight(L, c.x, c.y - 6, 22, 3); continue; }
    if (closed && T === 2) list.push({ y: c.y - 30, f: () => drawBeam(c) });
    list.push({ y: c.y, f: () => {
      const fade = c.opened && c.t > VANISH ? 1 - (c.t - VANISH) / (GONE - VANISH) : 1;
      if (closed && T) drawGround(c, T === 2 ? '#ffd04a' : '#7ac0ff', T === 2 ? 15 : 12);
      ctx.globalAlpha = fade; drawShadow(c.x, c.y + 1, 14);
      const pop = c.opened && c.t < .3 ? Math.sin(c.t / .3 * Math.PI) * 3 : 0, rise = c.opened && c.t > VANISH ? (c.t - VANISH) * 8 : 0;
      drawArtSprite(ART[T][c.opened ? 1 : 0], c.x, c.y + 3 - pop - rise); ctx.globalAlpha = 1;
      if (closed && Math.floor(G.time * 2 + c.tx) % (T ? 2 : 5) === 0) {                            // 閃一下：銀箱、金箱閃得比較勤
        const k = (G.time * 2 + c.tx) % 1; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffffff';
        ctx.fillRect(snapF(c.x - 10 + k * 20), snapF(c.y - 8), HK * 2, HK * 2); ctx.globalAlpha = 1; }
      if (closed && T && Math.random() < (T === 2 ? .35 : .12)) {                                   // 往上飄的光點
        const g = GLOW[T]; G.parts.push({ x: c.x + rr(-8, 8), y: c.y - rr(0, 6), vx: rr(-3, 3), vy: -rr(10, T === 2 ? 34 : 20), life: rr(.6, 1.2), max: 1.2, col: pick(g), star: rr(.5, T === 2 ? 1.6 : 1.1), drag: 1 }); }
    } });
    if (closed) { addLight(L, c.x, c.y - 4, [18, 30, 44][T], [3, 2, 4][T]); if (T === 2) addLight(L, c.x, c.y - 40, 26, 4); }
  }
}
