import { G } from '../core/state';
import { $, clamp } from '../core/util';
import { OL } from '../art/sprite';
import { ARENA, CAMPS, DOOR, MH, MW, OPEN_REGIONS, REGIONS, SUBS, TS, discovered, explored } from '../world/map';
import { RBDEF, rbDead } from '../world/regionBoss';
import { mctx, miniBase, miniFull } from '../world/minimap';
import { merchant } from '../ui/shop';
import { CHESTS } from '../world/chests';
import { mapMarker } from '../game/quest';

/* miniT → 已移到 G（core/state.js） */
export function renderMini() {
  const px = Math.floor(G.me.x / TS), py = Math.floor(G.me.y / TS), ox = clamp(px - 64, 0, MW - 128), oy = clamp(py - 40, 0, MH - 80);
  mctx.fillStyle = '#07060b'; mctx.fillRect(0, 0, 128, 80);
  mctx.drawImage(miniBase, ox, oy, 128, 80, 0, 0, 128, 80);
  for (const c of CAMPS) if (explored[c.ty * MW + c.tx]) { mctx.fillStyle = c.lit ? '#f2c14e' : '#8a869a'; mctx.fillRect(c.tx - ox - 1, c.ty - oy - 1, 3, 3); }
  if (!G.bossDead && explored[ARENA.y1 * MW + DOOR[1]]) { mctx.fillStyle = '#ff3b3b'; mctx.fillRect(189 - ox, 109 - oy, 3, 3); }
  for (const d of Object.values(RBDEF)) if (!rbDead.has(d.id) && explored[d.ty * MW + d.tx]) { mctx.fillStyle = '#ff3b3b'; mctx.fillRect(d.tx - ox - 1, d.ty - oy - 1, 3, 3); }
  for (const c of CHESTS) if (!c.opened && explored[c.ty * MW + c.tx]) { mctx.fillStyle = '#ffd04a'; mctx.fillRect(c.tx - ox, c.ty - oy, 1, 1); }
  if (merchant) { const mx = Math.floor(merchant.x / TS) - ox, my = Math.floor(merchant.y / TS) - oy; mctx.fillStyle = OL; mctx.fillRect(mx - 2, my - 2, 5, 5); mctx.fillStyle = '#5ae0b0'; mctx.fillRect(mx - 1, my - 1, 3, 3); }
  if (G.lost) { mctx.fillStyle = '#b49cff'; mctx.fillRect(Math.floor(G.lost.x / TS) - ox - 1, Math.floor(G.lost.y / TS) - oy - 1, 3, 3); }
  mapMarker(mctx, 1, ox, oy);
  mctx.fillStyle = Math.floor(G.time * 4) % 2 ? '#ffffff' : '#7fdcff'; mctx.fillRect(px - ox - 1, py - oy - 1, 3, 3);
}
/* ================= 世界地圖：拖曳平移、雙指 / 滾輪縮放、點營火快速傳送 =================
   mv = 地圖鏡頭：(x, y) = 畫面中心是哪一格，z = 每格幾個 CSS 像素 */
const bigmap = $<HTMLCanvasElement>('bigmap'), bctx = bigmap.getContext('2d');
export const mv = { x: 0, y: 0, z: 3, w: 0, h: 0 };
const zMin = () => Math.min(mv.w / MW, mv.h / MH) * .9, zMax = 10;
export function centerMap() {
  const r = bigmap.getBoundingClientRect(); if (!r.width) return; mv.w = r.width; mv.h = r.height;
  mv.x = G.me.x / TS; mv.y = G.me.y / TS; mv.z = clamp(Math.max(zMin(), mv.w / 140), zMin(), zMax);
}
const toScr = (tx: number, ty: number) => [(tx - mv.x) * mv.z + mv.w / 2, (ty - mv.y) * mv.z + mv.h / 2];
const toTile = (sx: number, sy: number) => [(sx - mv.w / 2) / mv.z + mv.x, (sy - mv.h / 2) / mv.z + mv.y];
function clampView() { mv.z = clamp(mv.z, zMin(), zMax); mv.x = clamp(mv.x, 0, MW); mv.y = clamp(mv.y, 0, MH); }
export let mapSel: string | null = null;                                // 點了哪個營火（等確認傳送）
export function renderBigMap() {
  const r = bigmap.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
  if (!r.width) return;
  if (bigmap.width !== Math.round(r.width * dpr) || bigmap.height !== Math.round(r.height * dpr)) { bigmap.width = Math.round(r.width * dpr); bigmap.height = Math.round(r.height * dpr); }
  mv.w = r.width; mv.h = r.height; clampView();
  const g = bctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
  g.fillStyle = '#07060b'; g.fillRect(0, 0, mv.w, mv.h);
  const [x0, y0] = toScr(0, 0), W = MW * mv.z, H = MH * mv.z;
  g.globalAlpha = .22; g.drawImage(miniFull, x0, y0, W, H); g.globalAlpha = 1; g.drawImage(miniBase, x0, y0, W, H);   // 沒去過的地方淡淡的，去過的亮起來
  const label = (txt, x, y, col, size) => { g.font = size + 'px "DotGothic16", "PingFang TC", sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#07060b'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y); };
  const box = (x, y, n, col) => { g.fillStyle = OL; g.fillRect(Math.round(x - n / 2 - 1), Math.round(y - n / 2 - 1), n + 2, n + 2); g.fillStyle = col; g.fillRect(Math.round(x - n / 2), Math.round(y - n / 2), n, n); };
  const big = mv.z >= 2.2;                                               // 拉近才顯示小地名
  if (mv.z < 5) for (const k of OPEN_REGIONS) { const [x, y] = toScr(REGIONS[k].c[0], REGIONS[k].c[1]); label(REGIONS[k].name, x, y, '#f1e7d0', 16); label(REGIONS[k].sub.replace('建議等級 ', 'Lv '), x, y + 15, '#a99db8', 11); }
  if (big) for (const s of SUBS) if (discovered.has(s.name)) { const [x, y] = toScr(s.x, s.y); label(s.name, x, y + 18, '#c9bfa8', 11); }
  for (const c of CHESTS) if (!c.opened && explored[c.ty * MW + c.tx]) { const [x, y] = toScr(c.tx + .5, c.ty + .5); box(x, y, 4, '#ffd04a'); }
  if (!G.bossDead && explored[ARENA.y1 * MW + DOOR[1]]) { const [x, y] = toScr(DOOR[1] + .5, (ARENA.y0 + ARENA.y1) / 2); box(x, y, 8, '#ff3b3b'); label('狼王', x, y - 8, '#ff8a7a', 11); }
  for (const d of Object.values(RBDEF)) if (!rbDead.has(d.id) && explored[d.ty * MW + d.tx]) { const [x, y] = toScr(d.tx + .5, d.ty + .5); box(x, y, 8, '#ff3b3b'); label(d.short, x, y - 8, '#ff8a7a', 11); }
  if (merchant) { const [x, y] = toScr(merchant.x / TS, merchant.y / TS); box(x, y, 7, '#5ae0b0'); if (big) label('商人', x, y - 7, '#9af0d0', 11); }
  if (G.lost) { const [x, y] = toScr(G.lost.x / TS, G.lost.y / TS); box(x, y, 6, '#b49cff'); }
  for (const c of CAMPS) if (explored[c.ty * MW + c.tx] || c.lit) { const [x, y] = toScr(c.tx + .5, c.ty + .5), sel = c.id === mapSel;
    if (sel) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x - 9, y - 9, 18, 18); }
    box(x, y, c.lit ? 10 : 7, c.lit ? '#f2c14e' : '#8a869a'); if (c.lit) { g.fillStyle = '#e8743b'; g.fillRect(Math.round(x - 2), Math.round(y - 3), 4, 5); }
    if (big || sel) label(c.name, x, y + 18, c.lit ? '#ffe38a' : '#a99db8', 11); }
  mapMarker(g, mv.z, mv.x - mv.w / 2 / mv.z, mv.y - mv.h / 2 / mv.z);
  const [px, py] = toScr(G.me.x / TS, G.me.y / TS);
  box(px, py, 7, '#7fdcff'); g.fillStyle = '#ffffff'; g.fillRect(Math.round(px - 1), Math.round(py - 1), 3, 3);
}
/* ---- 手勢 ---- */
const ptrs = new Map<number, { x: number; y: number }>();
let pinch0 = 0, z0 = 0, tap: { x: number; y: number; t: number } | null = null;
const local = (e: PointerEvent) => { const r = bigmap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
bigmap.addEventListener('pointerdown', e => { e.preventDefault(); const p = local(e); ptrs.set(e.pointerId, p); try { bigmap.setPointerCapture(e.pointerId); } catch (err) {}
  tap = ptrs.size === 1 ? { ...p, t: performance.now() } : null;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = mv.z; } });
bigmap.addEventListener('pointermove', e => { const o = ptrs.get(e.pointerId); if (!o) return; e.preventDefault(); const p = local(e);
  if (ptrs.size === 1) { mv.x -= (p.x - o.x) / mv.z; mv.y -= (p.y - o.y) / mv.z; if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 8) tap = null; }
  ptrs.set(e.pointerId, p);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; zoomAt(mx, my, z0 * d / (pinch0 || d)); }
  renderBigMap(); });
const up = (e: PointerEvent) => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  if (tap && ptrs.size === 0 && performance.now() - tap.t < 450) tapAt(tap.x, tap.y); tap = null; };
bigmap.addEventListener('pointerup', up); bigmap.addEventListener('pointercancel', up);
bigmap.addEventListener('wheel', e => { e.preventDefault(); const p = { x: e.offsetX, y: e.offsetY }; zoomAt(p.x, p.y, mv.z * Math.pow(1.0015, -e.deltaY)); renderBigMap(); }, { passive: false });
export function zoomAt(sx: number, sy: number, z: number) {                // 縮放時手指下面那一點不動
  const [tx, ty] = toTile(sx, sy); mv.z = clamp(z, zMin(), zMax); mv.x = tx - (sx - mv.w / 2) / mv.z; mv.y = ty - (sy - mv.h / 2) / mv.z; clampView();
}
let onPick: (id: string | null) => void = () => {};
export function onMapPick(f: (id: string | null) => void) { onPick = f; }
function tapAt(sx: number, sy: number) {                                // 點到營火（12px 內）→ 選它；點空白 → 取消
  let best = null, bd = 16; for (const c of CAMPS) { if (!explored[c.ty * MW + c.tx] && !c.lit) continue; const [x, y] = toScr(c.tx + .5, c.ty + .5), d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; best = c; } }
  mapSel = best ? best.id : null; onPick(mapSel); renderBigMap();
}
export function clearMapSel() { mapSel = null; }
