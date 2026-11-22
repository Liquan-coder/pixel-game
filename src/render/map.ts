import { G } from '../core/state';
import { $, clamp } from '../core/util';
import { OL } from '../art/sprite';
import { CAMPS, MH, MW, WH, OPEN_REGIONS, REGIONS, SUBS, TOWNS, TS, discovered, explored } from '../world/map';
import { mctx, miniBase } from '../world/minimap';
import { merchant } from '../ui/shop';
import { drawRumors, flags, navT, rumorsOpen } from '../game/quest';
import { STATUES, statueKnown, statueLit, ZONE_NAME, zoneOfReg } from '../world/statues';
import { DUNGEONS, OLDZ, dungeonAt } from '../world/dungeons';
import { POIS } from '../data/poi';
import { MAP_ICONS, MAP_ICON_SCALE } from '../art/mapIcons';
import { CHESTS } from '../world/chests';
import { campKey, dgKey, poiKey, saw, townKey } from '../world/sight';

/* 一座地城佔的範圍（格）：左上角 x0 / y0、寬 w、高 h（world/dungeons.ts 排區塊時算好） */
const BOX = new Map();
function dungeonBox(d) {
  let b = BOX.get(d); if (b) return b;
  b = { x0: d.x0, y0: d.y0, x1: d.x0 + d.w, y1: d.y0 + d.h }; BOX.set(d, b); return b;
}
export function renderMini() {
  const px = Math.floor(G.me.x / TS), py = Math.floor(G.me.y / TS), ox = clamp(px - 64, 0, MW - 128), oy = clamp(py - 40, 0, MH - 80);
  mctx.fillStyle = '#07060b'; mctx.fillRect(0, 0, 128, 80);
  mctx.drawImage(miniBase, ox, oy, 128, 80, 0, 0, 128, 80);
  const dg = dungeonAt(G.me.x, G.me.y);
  if (dg) { const b = dungeonBox(dg), bx = b.x0 - ox, by = b.y0 - oy, bw = b.x1 - b.x0, bh = b.y1 - b.y0;   // 在地城裡：只顯示這一座，其他地城塗黑
    mctx.fillStyle = '#07060b'; mctx.fillRect(0, 0, 128, Math.max(0, by)); mctx.fillRect(0, by + bh, 128, 80); mctx.fillRect(0, by, Math.max(0, bx), bh); mctx.fillRect(bx + bw, by, 128, bh);
    for (const c of CAMPS) if (c.dg === dg.id && (c.lit || seen(c.tx, c.ty))) { mctx.fillStyle = c.lit ? '#f2c14e' : '#8a869a'; mctx.fillRect(c.tx - ox - 1, c.ty - oy - 1, 3, 3); } }   // 這座地城裡的營火
  else { for (const c of CAMPS) if (!c.dg && (c.lit || saw(campKey(c.id)))) { mctx.fillStyle = c.lit ? '#f2c14e' : '#8a869a'; mctx.fillRect(c.tx - ox - 1, c.ty - oy - 1, 3, 3); }   // 營火：點燃過的、或親眼看到過才標（world/sight.ts）
    for (const s of STATUES) if (statueKnown(s)) { mctx.fillStyle = statueLit(s) ? '#ffe38a' : '#c8a8ff'; mctx.fillRect(s.tx - ox - 1, s.ty - oy - 2, 3, 4); } }
  // Boss、寶箱不標：讓玩家自己去找
  if (merchant) { const mx = Math.floor(merchant.x / TS) - ox, my = Math.floor(merchant.y / TS) - oy; mctx.fillStyle = OL; mctx.fillRect(mx - 2, my - 2, 5, 5); mctx.fillStyle = '#5ae0b0'; mctx.fillRect(mx - 1, my - 1, 3, 3); }
  if (G.lost) { mctx.fillStyle = '#b49cff'; mctx.fillRect(Math.floor(G.lost.x / TS) - ox - 1, Math.floor(G.lost.y / TS) - oy - 1, 3, 3); }
  drawRumors(mctx, 1, ox, oy);
  if (navT && !dg) navMini(navT.x / TS - ox, navT.y / TS - oy, px - ox, py - oy);
  mctx.fillStyle = Math.floor(G.uiTime * 4) % 2 ? '#ffffff' : '#7fdcff'; mctx.fillRect(px - ox - 1, py - oy - 1, 3, 3);
}
/* 小地圖上的導航目標：在範圍內 = 閃爍的金色菱形；在範圍外 = 邊緣一個指過去的小箭頭 */
const navOn = () => Math.floor(performance.now() / 300) % 2 === 0;
function navMini(x: number, y: number, mx: number, my: number) {
  const g = mctx, on = navOn();
  if (x >= 2 && x < 126 && y >= 2 && y < 78) {
    g.fillStyle = OL; g.fillRect(x - 3, y - 1, 7, 3); g.fillRect(x - 1, y - 3, 3, 7);
    g.fillStyle = on ? '#fff2b0' : '#ffd04a'; g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); g.fillRect(x - 1, y - 1, 3, 3); return; }
  const a = Math.atan2(y - my, x - mx), c = Math.cos(a), s = Math.sin(a);   // 從你的位置往目標方向，撞到小地圖邊緣的那一點
  const t = Math.min(c > 0 ? (125 - mx) / c : c < 0 ? (3 - mx) / c : 1e9, s > 0 ? (77 - my) / s : s < 0 ? (3 - my) / s : 1e9);
  const ex = mx + c * t, ey = my + s * t;
  g.save(); g.translate(ex, ey); g.rotate(a);
  g.fillStyle = OL; g.beginPath(); g.moveTo(4, 0); g.lineTo(-3, -4); g.lineTo(-3, 4); g.closePath(); g.fill();
  g.fillStyle = on ? '#fff2b0' : '#ffd04a'; g.beginPath(); g.moveTo(2.5, 0); g.lineTo(-2, -2.5); g.lineTo(-2, 2.5); g.closePath(); g.fill();
  g.restore();
}
/* ================= 世界地圖：拖曳平移、雙指 / 滾輪縮放、點營火快速傳送 =================
   mv = 地圖鏡頭：(x, y) = 畫面中心是哪一格，z = 每格幾個 CSS 像素 */
const bigmap = $<HTMLCanvasElement>('bigmap'), bctx = bigmap.getContext('2d');
export const mv = { x: 0, y: 0, z: 3, w: 0, h: 0 };
/* 地圖能看的範圍（格）：平常是整張世界；在地城裡 = 只有這一座地城（多留 2 格邊） */
let area = { x0: 0, y0: 0, x1: MW, y1: WH };                          // 野外只到 WH（下面那一條是地城區）
function setArea() { const dg = dungeonAt(G.me.x, G.me.y), b = dg && dungeonBox(dg);
  area = b ? { x0: b.x0 - 2, y0: b.y0 - 2, x1: b.x1 + 2, y1: b.y1 + 2 } : { x0: 0, y0: 0, x1: MW, y1: WH }; }
const zMin = () => Math.min(mv.w / (area.x1 - area.x0), mv.h / (area.y1 - area.y0)) * .9, zMax = 14;
export function centerMap() {
  const r = bigmap.getBoundingClientRect(); if (!r.width) return; mv.w = r.width; mv.h = r.height; setArea();
  mv.x = G.me.x / TS; mv.y = G.me.y / TS; mv.z = clamp(Math.max(zMin(), mv.w / 140), zMin(), zMax);
}
const toScr = (tx: number, ty: number) => [(tx - mv.x) * mv.z + mv.w / 2, (ty - mv.y) * mv.z + mv.h / 2];
const toTile = (sx: number, sy: number) => [(sx - mv.w / 2) / mv.z + mv.x, (sy - mv.h / 2) / mv.z + mv.y];
function clampView() {                                               // 地圖比畫面小 → 置中；比畫面大 → 不能拖出邊界
  mv.z = clamp(mv.z, zMin(), zMax); const hw = mv.w / 2 / mv.z, hh = mv.h / 2 / mv.z, A = area;
  mv.x = A.x1 - A.x0 <= hw * 2 ? (A.x0 + A.x1) / 2 : clamp(mv.x, A.x0 + hw, A.x1 - hw); mv.y = A.y1 - A.y0 <= hh * 2 ? (A.y0 + A.y1) / 2 : clamp(mv.y, A.y0 + hh, A.y1 - hh); }
export let mapSel: string | null = null;                                // 點了哪個營火（等確認傳送）
/* 地圖上可以點的東西：點了下方會顯示名字和說明（營火還有傳送按鈕） */
export type MapPick = { kind: string; id: string; name: string; desc: string; tx: number; ty: number };
let hits: (MapPick & { x: number; y: number })[] = [], pick: MapPick | null = null;
const seen = (tx: number, ty: number) => !!explored[Math.floor(ty) * MW + Math.floor(tx)];
export function renderBigMap() {
  const r = bigmap.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
  if (!r.width) return;
  if (bigmap.width !== Math.round(r.width * dpr) || bigmap.height !== Math.round(r.height * dpr)) { bigmap.width = Math.round(r.width * dpr); bigmap.height = Math.round(r.height * dpr); }
  const a0 = area; setArea(); if (area.x0 !== a0.x0 || area.y0 !== a0.y0) { centerMap(); clearMapSel(); onPick(null); }   // 開著地圖走進 / 走出地城 → 換成那張地圖
  mv.w = r.width; mv.h = r.height; clampView();
  const g = bctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
  g.fillStyle = '#07060b'; g.fillRect(0, 0, mv.w, mv.h);
  const label = (txt, x, y, col, size) => { g.font = size + 'px "DotGothic16", "PingFang TC", sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#07060b'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y); };
  const S = MAP_ICON_SCALE, icon = (k: string, p: MapPick) => { const c = MAP_ICONS[k], [x, y] = toScr(p.tx + .5, p.ty + .5);
    g.drawImage(c, Math.round(x - c.width * S / 2), Math.round(y - c.height * S / 2), c.width * S, c.height * S); hits.push({ ...p, x, y }); };
  hits = [];
  const dg = dungeonAt(G.me.x, G.me.y);
  if (dg) {                                                              // 在地城裡：只畫這一座地城（走過的地方），別的地城、地面都不畫
    const b = dungeonBox(dg), [sx, sy] = toScr(b.x0, b.y0), bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    g.drawImage(miniBase, b.x0, b.y0, bw, bh, sx, sy, bw * mv.z, bh * mv.z);
    label(dg.name, mv.w / 2, 22, '#f1e7d0', 16);
    { const cs = CHESTS.filter(c => dungeonAt(c.x, c.y) === dg); label('找到的寶箱 ' + cs.filter(c => c.opened).length + ' / ' + cs.length, mv.w / 2, 40, '#c9bfa8', 11); }   // 這座地城開過幾個寶箱（想把它翻遍）
    if (G.lost && dungeonAt(G.lost.x, G.lost.y) === dg) icon('lost', { kind: 'lost', id: 'lost', name: '掉落的魂晶', desc: '上次倒下時掉的 ' + G.lost.amount + ' 魂晶' + (G.lost.gold ? '、' + G.lost.gold + ' 金幣' : '') + ' · 走過去就能撿回來（再死一次就沒了）', tx: G.lost.x / TS - .5, ty: G.lost.y / TS - .5 });
    const [x, y] = toScr(G.me.x / TS, G.me.y / TS), k = .5 + .5 * Math.sin(performance.now() / 160);
    g.strokeStyle = `rgba(127,220,255,${.35 + .45 * k})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 13 + 2 * k, 0, Math.PI * 2); g.stroke();
    for (const c of CAMPS) if (c.dg === dg.id && (c.lit || seen(c.tx, c.ty))) icon(c.lit ? 'camp' : 'campOff', { kind: 'camp', id: c.id, name: c.name, desc: '', tx: c.tx, ty: c.ty });   // 地城裡的營火：一樣可以點了傳送
    icon('me', { kind: 'me', id: 'me', name: '你在這裡', desc: '在「' + dg.name + '」裡面', tx: G.me.x / TS - .5, ty: G.me.y / TS - .5 });
    drawPick(g, label); return;
  }
  const [x0, y0] = toScr(0, 0), W = MW * mv.z, H = WH * mv.z;
  g.drawImage(miniBase, 0, 0, MW, WH, x0, y0, W, H);   // 地形：自己走過的路 + 星之神像點亮的整塊地區（world/statues.ts）；其他地方一片黑。圖示要親眼看到才畫（world/sight.ts）
  { const [zx, zy] = toScr(OLDZ.x0 - 1, OLDZ.y0 - 1), [zx1, zy1] = toScr(OLDZ.x1 + 1, OLDZ.y1 + 1); g.fillStyle = '#07060b'; g.fillRect(zx, zy, zx1 - zx, zy1 - zy); }   // 以前蓋地城的那塊海上岩石，地圖上不顯示
  const big = mv.z >= 2.2;                                               // 拉近才顯示小地名
  if (mv.z < 5) for (const k of OPEN_REGIONS) if (flags.has('chart:' + zoneOfReg(k))) { const [x, y] = toScr(REGIONS[k].c[0], REGIONS[k].c[1]); label(REGIONS[k].name, x, y, '#f1e7d0', 16); }   // 地名：那一塊點亮了才寫
  if (big) for (const s of SUBS) if (discovered.has(s.name)) { const [x, y] = toScr(s.x, s.y); label(s.name, x, y + 18, '#c9bfa8', 11); }
  // 圖示：放大 2 倍的像素圖，中心對準那一格；同時記下位置給「點一下」用
  for (const T of TOWNS) if (saw(townKey(T.id))) icon('town', { kind: 'town', id: T.id, name: T.name, desc: '城鎮 · 有鎮民和鐵匠，可以買賣、強化武器', tx: T.tx, ty: T.ty });
  for (const p of POIS) if (saw(poiKey(p.id))) icon(p.kind, { kind: p.kind, id: p.id, name: p.name, desc: p.desc || (p.kind === 'ruin' ? '遺跡 · 通往地底的入口' : p.kind === 'town' ? '城鎮' : '地標'), tx: p.tx, ty: p.ty });
  for (const d of DUNGEONS) if (d.style !== 'ruin' && saw(dgKey(d.id))) { const done = flags.has('dgn:' + d.id);   // 地底遺跡畫成遺跡圖示（POIS）
    icon(done ? 'dungeonDone' : 'dungeon', { kind: 'dungeon', id: d.id, name: d.name, desc: done ? '地城 · 已經攻略完了' : '地城 · 最深處有守護者看守著寶物', tx: d.ent[0], ty: d.ent[1] }); }
  if (merchant) icon('merchant', { kind: 'merchant', id: 'merchant', name: '流浪商人', desc: '會在點燃過的營火之間移動，賣藥水、礦石和裝備', tx: merchant.x / TS - .5, ty: merchant.y / TS - .5 });
  if (G.lost) icon('lost', { kind: 'lost', id: 'lost', name: '掉落的魂晶', desc: '上次倒下時掉的 ' + G.lost.amount + ' 魂晶' + (G.lost.gold ? '、' + G.lost.gold + ' 金幣' : '') + ' · 走過去就能撿回來（再死一次就沒了）', tx: G.lost.x / TS - .5, ty: G.lost.y / TS - .5 });
  for (const c of CAMPS) if (!c.dg && (c.lit || saw(campKey(c.id)))) icon(c.lit ? 'camp' : 'campOff', { kind: 'camp', id: c.id, name: c.name, desc: '', tx: c.tx, ty: c.ty });   // 點燃過的、或親眼看到過才標（熄滅的樣子讓人想去點燃）
  for (const st of STATUES) if (statueKnown(st)) { const [x, y] = toScr(st.tx + .5, st.ty + .5), lit = statueLit(st), k = 3 + Math.max(0, Math.min(4, mv.z - 2));   // 星之神像：小小的星星 + 石座
    g.fillStyle = '#07060b'; g.fillRect(Math.round(x - k - 1), Math.round(y + k * .4 - 1), Math.round(k * 2 + 2), Math.round(k * .8 + 2));
    g.fillStyle = '#8a84a0'; g.fillRect(Math.round(x - k), Math.round(y + k * .4), Math.round(k * 2), Math.round(k * .8));
    g.fillStyle = lit ? '#ffe38a' : '#c8a8ff'; g.beginPath(); g.moveTo(x, y - k * 1.8); g.lineTo(x + k * .6, y - k * .6); g.lineTo(x, y + k * .3); g.lineTo(x - k * .6, y - k * .6); g.closePath(); g.fill();
    hits.push({ kind: 'statue', id: 's' + st.k, name: '星之神像', desc: lit ? ZONE_NAME[st.k] + ' · 已經點亮了' : '去那裡祈禱，' + ZONE_NAME[st.k] + '的地圖就會亮起來', tx: st.tx, ty: st.ty, x, y }); }
  drawRumors(g, mv.z, mv.x - mv.w / 2 / mv.z, mv.y - mv.h / 2 / mv.z);   // 傳聞：模糊的虛線圈
  for (const r of rumorsOpen()) { const [x, y] = toScr(r.tx, r.ty); hits.push({ kind: 'rumor', id: r.id, name: '傳聞', desc: '「' + r.text + '」——' + r.src, tx: r.tx, ty: r.ty, x, y }); }
  if (navT) {                                                            // 導航目標：從你拉一條金色虛線過去 + 一閃一閃的標記
    const [mx, my] = toScr(G.me.x / TS, G.me.y / TS), [tx, ty] = toScr(navT.x / TS, navT.y / TS), on = navOn(), k = .5 + .5 * Math.sin(performance.now() / 140);
    g.save(); g.setLineDash([6, 5]); g.lineDashOffset = -performance.now() / 60;
    g.strokeStyle = '#07060b'; g.lineWidth = 4; g.beginPath(); g.moveTo(mx, my); g.lineTo(tx, ty); g.stroke();
    g.strokeStyle = 'rgba(255,208,74,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(mx, my); g.lineTo(tx, ty); g.stroke(); g.restore();
    g.strokeStyle = `rgba(255,226,120,${.4 + .5 * k})`; g.lineWidth = 2; g.beginPath(); g.arc(tx, ty, 10 + 5 * k, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#07060b'; g.beginPath(); g.moveTo(tx, ty - 8); g.lineTo(tx + 6, ty); g.lineTo(tx, ty + 8); g.lineTo(tx - 6, ty); g.closePath(); g.fill();
    g.fillStyle = on ? '#fff2b0' : '#ffd04a'; g.beginPath(); g.moveTo(tx, ty - 6); g.lineTo(tx + 4, ty); g.lineTo(tx, ty + 6); g.lineTo(tx - 4, ty); g.closePath(); g.fill();
    label('導航：' + navT.name, tx, ty - 14, '#ffe38a', 12);
    const M = 26; if (tx < 0 || tx > mv.w || ty < 0 || ty > mv.h) {          // 目標在畫面外：在畫面邊緣畫一個大箭頭指過去
      const a = Math.atan2(ty - my, tx - mx), c = Math.cos(a), s = Math.sin(a);
      const t = Math.min(c > 0 ? (mv.w - M - mx) / c : c < 0 ? (M - mx) / c : 1e9, s > 0 ? (mv.h - M - my) / s : s < 0 ? (M - my) / s : 1e9);
      const ex = mx + c * Math.max(0, t), ey = my + s * Math.max(0, t);
      g.save(); g.translate(ex, ey); g.rotate(a); g.fillStyle = '#07060b'; g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -11); g.lineTo(-3, 0); g.lineTo(-8, 11); g.closePath(); g.fill();
      g.fillStyle = on ? '#fff2b0' : '#ffd04a'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -8); g.lineTo(-1.5, 0); g.lineTo(-6, 8); g.closePath(); g.fill(); g.restore();
      label(navT.name, clamp(ex - c * 26, 50, mv.w - 50), clamp(ey - s * 22 + 4, 16, mv.h - 8), '#ffe38a', 12); } }
  // 你：魔女帽 + 一圈閃爍的光
  { const [x, y] = toScr(G.me.x / TS, G.me.y / TS), k = .5 + .5 * Math.sin(performance.now() / 160);
    g.strokeStyle = `rgba(127,220,255,${.35 + .45 * k})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 13 + 2 * k, 0, Math.PI * 2); g.stroke();
    icon('me', { kind: 'me', id: 'me', name: '你在這裡', desc: '', tx: G.me.x / TS - .5, ty: G.me.y / TS - .5 }); }
  drawPick(g, label);
}
function drawPick(g: CanvasRenderingContext2D, label) {                 // 選到的東西：白框 + 名字
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
