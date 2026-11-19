import { G } from '../core/state';
import { $, clamp } from '../core/util';
import { OL } from '../art/sprite';
import { CAMPS, MH, MW, OPEN_REGIONS, REGIONS, SUBS, TOWNS, TS, discovered, explored } from '../world/map';
import { mctx, miniBase, miniFull } from '../world/minimap';
import { merchant } from '../ui/shop';
import { current, flags, mapMarker } from '../game/quest';
import { DUNGEONS, DZONE, dungeonAt } from '../world/dungeons';
import { POIS } from '../data/poi';
import { MAP_ICONS, MAP_ICON_SCALE } from '../art/mapIcons';

/* miniT → 已移到 G（core/state.js） */
export function renderMini() {
  const px = Math.floor(G.me.x / TS), py = Math.floor(G.me.y / TS), ox = clamp(px - 64, 0, MW - 128), oy = clamp(py - 40, 0, MH - 80);
  mctx.fillStyle = '#07060b'; mctx.fillRect(0, 0, 128, 80);
  mctx.drawImage(miniBase, ox, oy, 128, 80, 0, 0, 128, 80);
  for (const c of CAMPS) if (explored[c.ty * MW + c.tx]) { mctx.fillStyle = c.lit ? '#f2c14e' : '#8a869a'; mctx.fillRect(c.tx - ox - 1, c.ty - oy - 1, 3, 3); }
  // Boss、寶箱不標：讓玩家自己去找
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
  const dg = dungeonAt(G.me.x, G.me.y); mv.x = dg ? dg.ent[0] : G.me.x / TS; mv.y = dg ? dg.ent[1] : G.me.y / TS; mv.z = clamp(Math.max(zMin(), mv.w / 140), zMin(), zMax);
}
const toScr = (tx: number, ty: number) => [(tx - mv.x) * mv.z + mv.w / 2, (ty - mv.y) * mv.z + mv.h / 2];
const toTile = (sx: number, sy: number) => [(sx - mv.w / 2) / mv.z + mv.x, (sy - mv.h / 2) / mv.z + mv.y];
function clampView() {                                               // 地圖比畫面小 → 置中；比畫面大 → 不能拖出邊界
  mv.z = clamp(mv.z, zMin(), zMax); const hw = mv.w / 2 / mv.z, hh = mv.h / 2 / mv.z;
  mv.x = MW <= hw * 2 ? MW / 2 : clamp(mv.x, hw, MW - hw); mv.y = MH <= hh * 2 ? MH / 2 : clamp(mv.y, hh, MH - hh); }
export let mapSel: string | null = null;                                // 點了哪個營火（等確認傳送）
/* 地圖上可以點的東西：點了下方會顯示名字和說明（營火還有傳送按鈕） */
export type MapPick = { kind: string; id: string; name: string; desc: string; tx: number; ty: number };
let hits: (MapPick & { x: number; y: number })[] = [], pick: MapPick | null = null;
const seen = (tx: number, ty: number) => !!explored[Math.floor(ty) * MW + Math.floor(tx)];
export function renderBigMap() {
  const r = bigmap.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
  if (!r.width) return;
  if (bigmap.width !== Math.round(r.width * dpr) || bigmap.height !== Math.round(r.height * dpr)) { bigmap.width = Math.round(r.width * dpr); bigmap.height = Math.round(r.height * dpr); }
  mv.w = r.width; mv.h = r.height; clampView();
  const g = bctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
  g.fillStyle = '#07060b'; g.fillRect(0, 0, mv.w, mv.h);
  const [x0, y0] = toScr(0, 0), W = MW * mv.z, H = MH * mv.z;
  g.globalAlpha = .22; g.drawImage(miniFull, x0, y0, W, H); g.globalAlpha = 1; g.drawImage(miniBase, x0, y0, W, H);   // 沒去過的地方淡淡的，去過的亮起來
  { const [zx, zy] = toScr(DZONE.x0 - 1, DZONE.y0 - 1), [zx1, zy1] = toScr(DZONE.x1 + 1, DZONE.y1 + 1); g.fillStyle = '#07060b'; g.fillRect(zx, zy, zx1 - zx, zy1 - zy); }   // 地城裡面是蓋在海上的，地圖上不顯示
  const label = (txt, x, y, col, size) => { g.font = size + 'px "DotGothic16", "PingFang TC", sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#07060b'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y); };
  const big = mv.z >= 2.2;                                               // 拉近才顯示小地名
  if (mv.z < 5) for (const k of OPEN_REGIONS) { const [x, y] = toScr(REGIONS[k].c[0], REGIONS[k].c[1]); label(REGIONS[k].name, x, y, '#f1e7d0', 16); label(REGIONS[k].sub.replace('建議等級 ', 'Lv '), x, y + 15, '#a99db8', 11); }
  if (big) for (const s of SUBS) if (discovered.has(s.name)) { const [x, y] = toScr(s.x, s.y); label(s.name, x, y + 18, '#c9bfa8', 11); }
  // 圖示：放大 2 倍的像素圖，中心對準那一格；同時記下位置給「點一下」用
  hits = [];
  const S = MAP_ICON_SCALE, icon = (k: string, p: MapPick) => { const c = MAP_ICONS[k], [x, y] = toScr(p.tx + .5, p.ty + .5);
    g.drawImage(c, Math.round(x - c.width * S / 2), Math.round(y - c.height * S / 2), c.width * S, c.height * S); hits.push({ ...p, x, y }); };
  for (const T of TOWNS) if (seen(T.tx, T.ty)) icon('town', { kind: 'town', id: T.id, name: T.name, desc: '城鎮 · 有鎮民和鐵匠，可以買賣、強化武器', tx: T.tx, ty: T.ty });
  for (const p of POIS) if (seen(p.tx, p.ty)) icon(p.kind, { kind: p.kind, id: p.id, name: p.name, desc: p.desc || (p.kind === 'ruin' ? '遺跡 · 通往地底的入口' : p.kind === 'town' ? '城鎮' : '地標'), tx: p.tx, ty: p.ty });
  for (const d of DUNGEONS) if (seen(d.ent[0], d.ent[1])) { const done = flags.has('dgn:' + d.id);
    icon(done ? 'dungeonDone' : 'dungeon', { kind: 'dungeon', id: d.id, name: d.name, desc: done ? '地城 · 已經攻略完了' : '地城 · 最深處有守護者看守著寶物', tx: d.ent[0], ty: d.ent[1] }); }
  if (merchant) icon('merchant', { kind: 'merchant', id: 'merchant', name: '流浪商人', desc: '會在點燃過的營火之間移動，賣藥水、礦石和裝備', tx: merchant.x / TS - .5, ty: merchant.y / TS - .5 });
  if (G.lost) icon('lost', { kind: 'lost', id: 'lost', name: '掉落的魂晶', desc: '上次倒下時掉的 ' + G.lost.amount + ' 魂晶 · 走過去就能撿回來（再死一次就沒了）', tx: G.lost.x / TS - .5, ty: G.lost.y / TS - .5 });
  for (const c of CAMPS) if (seen(c.tx, c.ty) || c.lit) icon(c.lit ? 'camp' : 'campOff', { kind: 'camp', id: c.id, name: c.name, desc: '', tx: c.tx, ty: c.ty });
  { const q = current(); hits.push({ kind: 'quest', id: q.id, name: '主線：' + q.title, desc: '跟著金色箭頭走 · 不一定要照順序', tx: q.tx, ty: q.ty, ...(([x, y]) => ({ x, y }))(toScr(q.tx, q.ty)) }); }
  mapMarker(g, mv.z, mv.x - mv.w / 2 / mv.z, mv.y - mv.h / 2 / mv.z);
  // 你：魔女帽 + 一圈閃爍的光（在地城裡 → 標在入口）
  const dg = dungeonAt(G.me.x, G.me.y), mt = dg ? [dg.ent[0], dg.ent[1] + .5] : [G.me.x / TS - .5, G.me.y / TS - .5];
  { const [x, y] = toScr(mt[0] + .5, mt[1] + .5), k = .5 + .5 * Math.sin(performance.now() / 160);
    g.strokeStyle = `rgba(127,220,255,${.35 + .45 * k})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 13 + 2 * k, 0, Math.PI * 2); g.stroke();
    icon('me', { kind: 'me', id: 'me', name: '你在這裡', desc: dg ? '在「' + dg.name + '」裡面' : '', tx: mt[0], ty: mt[1] }); }
  // 選到的東西：白框 + 名字
  if (pick) { const h = hits.find(h => h.kind === pick.kind && h.id === pick.id);
    if (h) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(Math.round(h.x - 14), Math.round(h.y - 14), 28, 28); label(h.name, h.x, h.y + 26, '#ffe38a', 12); } }
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
let onPick: (p: MapPick | null) => void = () => {};
export function onMapPick(f: (p: MapPick | null) => void) { onPick = f; }
function tapAt(sx: number, sy: number) {                                // 點到圖示（16px 內，選最近的）→ 下方顯示是什麼；點空白 → 取消
  let best = null, bd = 16; for (const h of hits) { const d = Math.hypot(h.x - sx, h.y - sy); if (d < bd) { bd = d; best = h; } }
  pick = best ? { kind: best.kind, id: best.id, name: best.name, desc: best.desc, tx: best.tx, ty: best.ty } : null;
  mapSel = pick && pick.kind === 'camp' ? pick.id : null; onPick(pick); renderBigMap();
}
export function clearMapSel() { mapSel = null; pick = null; }
export const mapPick = () => pick;
