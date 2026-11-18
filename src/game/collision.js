import { clamp } from '../core/util.js';
import { ARENA, BIGT, CAMPS, CRATE, GRAVE, MH, MW, PILLAR, ROCK, TREE, TS, reg } from '../world/map.js';
import { solidT, tileAt } from '../world/gen.js';

/* ================= COLLISION ================= */
/* 碰撞：障礙物是「圓角方塊」—— 露在外面的角磨圓（樹、石頭幾乎是圓的），撞到時沿著表面滑開，不會卡死 */
const ROUNDT = new Set([TREE, ROCK, PILLAR, CRATE, GRAVE, BIGT]);
function tilePen(x, y, r, tx, ty, t) {                                  // 圓 (x,y,r) 跟這格重疊多深；回傳 [深度, 推出方向x, 推出方向y] 或 null
  const L = tx * TS, T = ty * TS, R = L + TS, Bt = T + TS, qx = x < L + TS / 2 ? -1 : 1, qy = y < T + TS / 2 ? -1 : 1;
  const k = solidT(tileAt(tx + qx, ty)) || solidT(tileAt(tx, ty + qy)) ? 0 : ROUNDT.has(t) ? 8 : 3;   // 旁邊也是牆的角不磨圓，長牆才不會凹凹凸凸
  const ix0 = qx < 0 ? L + k : L, ix1 = qx > 0 ? R - k : R, iy0 = qy < 0 ? T + k : T, iy1 = qy > 0 ? Bt - k : Bt;
  const nx = clamp(x, ix0, ix1), ny = clamp(y, iy0, iy1), dx = x - nx, dy = y - ny, d = Math.sqrt(dx * dx + dy * dy), pen = r + k - d;
  if (pen <= 0) return null;
  if (d < 1e-4) return [0, 0, 0];                                         // 中心已經在牆裡（例如出生點），不推
  return [pen, dx / d, dy / d];
}
export function collides(x, y, r) {
  const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = tileAt(tx, ty); if (solidT(t) && tilePen(x, y, r, tx, ty, t)) return true; }
  for (const c of CAMPS) if (Math.abs(x - c.x) < 20 && (x - c.x) ** 2 + (y - c.y) ** 2 < (r + 5) ** 2) return true;
  return false;
}
function pushOut(e) {                                                   // 把重疊的部分沿著表面法線推出去 → 自然沿著牆滑
  const r = e.r;
  for (let it = 0; it < 4; it++) {
    let best = null;
    const x0 = Math.floor((e.x - r) / TS), x1 = Math.floor((e.x + r) / TS), y0 = Math.floor((e.y - r) / TS), y1 = Math.floor((e.y + r) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = tileAt(tx, ty); if (!solidT(t)) continue;
      const p = tilePen(e.x, e.y, r, tx, ty, t); if (p && p[0] > 0 && (!best || p[0] > best[0])) best = p; }
    for (const c of CAMPS) { if (Math.abs(e.x - c.x) > 20) continue; const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy), pen = r + 5 - d;
      if (pen > 0 && d > 1e-4 && (!best || pen > best[0])) best = [pen, dx / d, dy / d]; }
    if (!best) return;
    e.x += best[1] * (best[0] + .01); e.y += best[2] * (best[0] + .01);   // 一次只推最深的那個，再重算（角落兩面牆也推得乾淨）
  }
}
export function moveEnt(e, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3)), x0 = e.x, y0 = e.y;
  for (let i = 0; i < steps; i++) { e.x += dx / steps; e.y += dy / steps; pushOut(e); }
  e.x = clamp(e.x, 8, MW * TS - 8); e.y = clamp(e.y, 8, MH * TS - 8);
  const dd = dx * dx + dy * dy;
  return dd > 1e-6 && ((e.x - x0) * dx + (e.y - y0) * dy) / dd < .5;     // 實際走不到一半 = 被擋住（衝刺類招式用來提早停下）
}
export function stepToward(e, tx, ty, spd, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy); if (d < 1) return;
  const s = Math.min(d, spd * dt); moveEnt(e, dx / d * s, dy / d * s);
  if (Math.abs(dx) > 2) e.flip = dx < 0;
}
export const inArena = (x, y) => x > (ARENA.x0 + 1) * TS && x < ARENA.x1 * TS && y > (ARENA.y0 + 1) * TS && y < ARENA.y1 * TS - 4;
export const regAt = (x, y) => reg[clamp(y / TS | 0, 0, MH - 1) * MW + clamp(x / TS | 0, 0, MW - 1)];

