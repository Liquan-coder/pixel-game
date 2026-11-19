/* ---- 寶箱：散落在野外偏僻的地方，按 E 打開。木箱 / 銀箱 / 金箱，越好的箱子東西越好；有些是寶箱怪 ---- */
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
  uq?: string; need?: string }                                           // uq = 固定的獨特武器；need = 要先達成的旗標（地城守護者倒下）
export const CHESTS: Chest[] = [];
const TIER = [{ n:'木製寶箱', col:'#c8a070' }, { n:'白銀寶箱', col:'#cfd8ea' }, { n:'黃金寶箱', col:'#f2c14e' }];
const REG_LV = [3, 8, 13, 18, 8, 23, 28, 4];                               // 每個地區寶箱的等級

/* 放寶箱：reach = 從起點走得到的格子。偏僻 = 離道路、營火都有一段距離 */
export function genChests(reach: Uint8Array) {
  CHESTS.length = 0;
  const R = mulberry32(4242), I = (x, y) => y * MW + x;
  const open = (x, y) => { const i = I(x, y); if (!reach[i] || !(map[i] === GROUND || map[i] === RFLOOR)) return false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!WALKABLE(map[I(x + dx, y + dy)])) return false; return true; };
  const blocked = (x, y) => (x >= ARENA.x0 - 3 && x <= ARENA.x1 + 3 && y >= ARENA.y0 - 3 && y <= ARENA.y1 + 3) ||
    Object.values(RBDEF).some(d => Math.hypot(d.tx - x, d.ty - y) < d.tr + 3) || CHESTS.some(c => Math.hypot(c.tx - x, c.ty - y) < 22);
  const add = (x, y, tier, lv, mimic) => CHESTS.push({ id: 'c' + x + '_' + y, /* 用位置當編號：地圖改了也不會對錯箱子 */ tx: x, ty: y, x: x * TS + 8, y: y * TS + 10, tier, lv, mimic, opened: false, t: 0 });
  const near = (x0, y0) => { for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = x0 + dx, y = y0 + dy;   // 從指定點往外找最近能放的格子
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && open(x, y) && !blocked(x, y)) return [x, y]; } return null; };
  // 地標寶箱：固定位置、比較好的箱子
  for (const [x, y, tier, lv] of [[80, 40, 2, 14], [35, 31, 1, 12], [205, 168, 1, 9], [84, 146, 0, 4], [165, 116, 0, 8], [206, 36, 1, 19], [318, 87, 1, 23], [266, 160, 2, 28], [44, 104, 0, 3]]) {
    const p = near(x, y); if (p) add(p[0], p[1], tier, lv, false); }
  // 地城：岔路房的銀箱 + 最深處的金箱（獨特武器，要先打倒守護者）。地城裡面走路到不了起點，所以直接放
  for (const d of DUNGEONS) { const dd = d as any; if (!dd.bossChest) continue;
    CHESTS.push({ id: 'd_' + d.id, tx: dd.bossChest[0], ty: dd.bossChest[1], x: dd.bossChest[0] * TS + 8, y: dd.bossChest[1] * TS + 10, tier: 2, lv: d.lv + 2, mimic: false, opened: false, t: 0, uq: d.uq, need: 'dgn:' + d.id });
    add(dd.sideChest[0], dd.sideChest[1], 1, d.lv + 1, false); }
  // 野外隨機寶箱：每個地區 8 個
  for (const r of [0, 1, 2, 3, 5, 6]) {
    let n = 0, tries = 0;
    while (n < (r === 0 ? 20 : 8) && tries++ < 40000) {                 // 平原變大了，寶箱也多放一些
      const x = 4 + Math.floor(R() * (MW - 8)), y = 4 + Math.floor(R() * (MH - 8));
      if (reg[I(x, y)] !== r || !open(x, y) || blocked(x, y)) continue;
      if (CAMPS.some(c => Math.hypot(c.tx - x, c.ty - y) < 12) || TOWNS.some(T => Math.hypot(T.tx - x, T.ty - y) < T.r + 6)) continue;
      let road = false; for (let dy = -4; dy <= 4 && !road; dy++) for (let dx = -4; dx <= 4; dx++) if (map[I(x + dx, y + dy)] === ROAD) { road = true; break; }
      if (road) continue;                                              // 不要擺在路邊：要稍微探索才找得到
      const q = R(), tier = q < .1 ? 2 : q < .4 ? 1 : 0;
      add(x, y, tier, REG_LV[r] + Math.floor(R() * 3) - 1, r !== 0 && R() < .15); n++;
    }
  }
}
export const nearChest = (pl: Player) => { if (pl.dead) return null; for (const c of CHESTS) if (!c.opened && !c.foe && Math.abs(c.x - pl.x) < 22 && Math.hypot(c.x - pl.x, c.y - pl.y) < 22) return c; return null; };
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
  const lv = c.lv, T = c.tier;
  dropGold(c.x, c.y, Math.round([20 + lv * 4, 40 + lv * 8, 80 + lv * 15][T] * rr(.85, 1.15)));
  dropSouls(c.x, c.y, [lv * 5, lv * 10, lv * 20][T], pl);
  dropMat(c.x, c.y, oreForLevel(lv), 2 + T, pl); if (T === 2) dropMat(c.x, c.y, oreForLevel(lv + 10), 1, pl);   // 黃金寶箱多一顆下一級的礦石
  if (c.uq) { const it = makeUnique(c.uq); dropItem(it, c.x, c.y); showBanner('獲得傳說武器', it.name, 2600); sfx.epic(); return; }   // 地城最深處：固定的獨特武器
  const q = Math.random();
  if (T === 0) { if (q < .65) dropItem(randomLoot(lv, q < .2 ? 2 : 1), c.x, c.y); }
  else if (T === 1) dropItem(randomLoot(lv, q < .3 ? 3 : 2), c.x, c.y);
  else { dropItem(randomLoot(lv, q < .25 ? 4 : 3), c.x, c.y); dropItem(randomLoot(lv, 2), c.x, c.y); }
  if (T === 2) showBanner('黃金寶箱', '裡面閃閃發光', 1800); else toast('打開了' + TIER[T].n, TIER[T].col);
  for (let i = 0; i < 18 + T * 10; i++) { const a = rr(-Math.PI, 0), v = rr(40, 120); G.parts.push({ x: c.x + rr(-4, 4), y: c.y - 8, vx: Math.cos(a) * v * .6, vy: Math.sin(a) * v, life: rr(.4, .8), max: .8, col: pick(['#ffe38a', '#fff6d0', TIER[T].col]), star: rr(.8, 2), drag: 2 }); }
  sfx.coin(); if (T === 2) sfx.epic();
}
/* 寶箱怪被打倒 → 箱子算打開了，再額外掉一件好東西 */
export function mimicDown(e) { const c: Chest = e.chest; if (!c) return; c.foe = null; c.opened = true; c.t = 1; c.mimic = false; dropItem(randomLoot(c.lv, Math.random() < .4 ? 3 : 2), c.x, c.y); save(); }
/* 休息時野外的怪物會復活：沒打倒的寶箱怪會變回寶箱，下次打開又會跳出來 */
export function resetMimics() { for (const c of CHESTS) c.foe = null; }

$('chestBtn').addEventListener('click', () => { const c = nearChest(G.me); if (c) openChest(G.me, c); });
/* ---- 畫：三種箱子 × 關著 / 打開 ---- */
const WOOD = ['#2e1c0e', '#4a3018', '#6a4626', '#86603a', '#a07a4c'], RED = ['#2a0e10', '#4a1820', '#6a2430', '#8a3440', '#a84a52'];
const BANDS = [['#2a2834', '#4a4858', '#6e6c86', '#9a98b0'], ['#4a5468', '#8a96ac', '#c4d0e4', '#ffffff'], ['#7a4a1a', '#c0862c', '#f2c14e', '#fff0a8']];
function chestArt(tier, open) {
  const B = BANDS[tier], body = tier === 2 ? RED : WOOD;
  const parts: Record<string, any>[] = [{ sh: SH.box(18, 23, 15, 7, 7), ramp: body, tex: .2, grp: 1 }];
  if (open) parts.unshift({ sh: SH.box(18, 10, 14.5, 4, 7), ramp: body, tex: .2, grp: 2 });          // 打開：蓋子往後翻，畫在箱子後面
  else parts.push({ sh: SH.ell(18, 16, 15.5, 7.5, (x, y) => y < 16.5), ramp: body, tex: .2, grp: 2 });
  return sculpt(36, 31, parts, a => {
    for (const py of [20, 25]) for (let x = 4; x < 32; x++) if (a.get(x, py) && a.get(x, py + 1)) a.set(x, py, body[1]);   // 木板縫
    if (!open) for (const py of [11, 14]) for (let x = 5; x < 31; x++) if (a.get(x, py) && a.get(x, py - 1)) a.set(x, py, body[1]);
    for (const bx of [7, 28]) for (let y = open ? 7 : 9; y < 30; y++) if (a.get(bx, y)) { a.set(bx, y, B[2]); a.set(bx + 1, y, B[1]); }
    for (let x = 3; x < 33; x++) if (a.get(x, 16)) a.set(x, 16, B[0]);
    if (open) { for (let y = 13; y < 17; y++) for (let x = 4; x < 32; x++) a.set(x, y, y === 13 ? '#3a2410' : y === 14 ? '#ffe38a' : y === 15 ? '#f2c14e' : '#7a4a1a');   // 箱子裡的金光
      for (let x = 7; x < 29; x += 3) a.set(x, 12, '#fff6d0'); }
    else { a.rect(16, 14, 4, 5, B[2]); a.set(16, 14, B[3]); a.set(18, 16, '#140c08'); a.set(18, 17, '#140c08'); }
    if (tier === 2) for (const [x, y] of [[11, 21], [25, 21], [18, 25]]) { a.set(x, y, '#ff4a6a'); a.set(x - 1, y - 1, '#ffd0dc'); }   // 金箱：鑲紅寶石
  });
}
export const ART = [0, 1, 2].map(t => [chestArt(t, false), chestArt(t, true)]);
export function drawChests(L, vis, addLight, list) {
  for (const c of CHESTS) {
    if (c.foe || !vis(c.x, c.y)) continue;
    list.push({ y: c.y, f: () => {
      drawShadow(c.x, c.y + 1, 14);
      const pop = c.opened && c.t < .3 ? Math.sin(c.t / .3 * Math.PI) * 3 : 0;
      drawArtSprite(ART[c.tier][c.opened ? 1 : 0], c.x, c.y + 3 - pop);
      if (!c.opened && Math.floor(G.time * 2 + c.tx) % 5 === 0) {           // 關著的箱子偶爾閃一下，遠遠就看得到
        const k = (G.time * 2 + c.tx) % 1; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffffff';
        ctx.fillRect(snapF(c.x - 10 + k * 20), snapF(c.y - 8), HK * 2, HK * 2); ctx.globalAlpha = 1; }
    } });
    if (c.opened) { if (c.t < 2) c.t += 1 / 60; }
    else addLight(L, c.x, c.y - 4, 18 + c.tier * 6, 3);
  }
}
