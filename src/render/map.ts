import { G } from '../core/state';
import { $, clamp } from '../core/util';
import { OL } from '../art/sprite';
import { ARENA, CAMPS, DOOR, MH, MW, OPEN_REGIONS, REGIONS, SUBS, TS, discovered, explored } from '../world/map';
import { RBDEF, rbDead } from '../world/regionBoss';
import { mctx, miniBase, miniFull } from '../world/minimap';
import { merchant } from '../ui/shop';

/* miniT → 已移到 G（core/state.js） */
export function renderMini() {
  const px = Math.floor(G.me.x / TS), py = Math.floor(G.me.y / TS), ox = clamp(px - 64, 0, MW - 128), oy = clamp(py - 40, 0, MH - 80);
  mctx.fillStyle = '#07060b'; mctx.fillRect(0, 0, 128, 80);
  mctx.drawImage(miniBase, ox, oy, 128, 80, 0, 0, 128, 80);
  for (const c of CAMPS) if (explored[c.ty * MW + c.tx]) { mctx.fillStyle = c.lit ? '#f2c14e' : '#8a869a'; mctx.fillRect(c.tx - ox - 1, c.ty - oy - 1, 3, 3); }
  if (!G.bossDead && explored[ARENA.y1 * MW + DOOR[1]]) { mctx.fillStyle = '#ff3b3b'; mctx.fillRect(189 - ox, 109 - oy, 3, 3); }
  for (const d of Object.values(RBDEF)) if (!rbDead.has(d.id) && explored[d.ty * MW + d.tx]) { mctx.fillStyle = '#ff3b3b'; mctx.fillRect(d.tx - ox - 1, d.ty - oy - 1, 3, 3); }
  if (merchant) { const mx = Math.floor(merchant.x / TS) - ox, my = Math.floor(merchant.y / TS) - oy; mctx.fillStyle = OL; mctx.fillRect(mx - 2, my - 2, 5, 5); mctx.fillStyle = '#5ae0b0'; mctx.fillRect(mx - 1, my - 1, 3, 3); }
  if (G.lost) { mctx.fillStyle = '#b49cff'; mctx.fillRect(Math.floor(G.lost.x / TS) - ox - 1, Math.floor(G.lost.y / TS) - oy - 1, 3, 3); }
  mctx.fillStyle = Math.floor(G.time * 4) % 2 ? '#ffffff' : '#7fdcff'; mctx.fillRect(px - ox - 1, py - oy - 1, 3, 3);
}
const bigmap = $<HTMLCanvasElement>('bigmap'), bctx = bigmap.getContext('2d'); bigmap.width = MW * 2; bigmap.height = MH * 2;
export function renderBigMap() {
  bctx.imageSmoothingEnabled = false;
  const BW = MW * 2, BH = MH * 2; bctx.fillStyle = '#07060b'; bctx.fillRect(0, 0, BW, BH); bctx.globalAlpha = .28; bctx.drawImage(miniFull, 0, 0, BW, BH); bctx.globalAlpha = 1; bctx.drawImage(miniBase, 0, 0, BW, BH);
  bctx.font = '12px "DotGothic16", "PingFang TC", sans-serif'; bctx.textAlign = 'center'; bctx.lineWidth = 3; bctx.strokeStyle = '#07060b';
  const label = (txt, x, y, col, size) => { bctx.font = size + 'px "DotGothic16", "PingFang TC", sans-serif'; bctx.strokeText(txt, x, y); bctx.fillStyle = col; bctx.fillText(txt, x, y); };
  for (const k of OPEN_REGIONS) { const [x, y] = REGIONS[k].c; label(REGIONS[k].name, x * 2, y * 2, '#f1e7d0', 16); label(REGIONS[k].sub.replace('建議等級 ', 'Lv '), x * 2, y * 2 + 16, '#a99db8', 11); }
  for (const s of SUBS) if (discovered.has(s.name)) label(s.name, s.x * 2, s.y * 2 + 18, '#c9bfa8', 11);
  for (const c of CAMPS) if (explored[c.ty * MW + c.tx]) { bctx.fillStyle = OL; bctx.fillRect(c.tx * 2 - 4, c.ty * 2 - 4, 8, 8); bctx.fillStyle = c.lit ? '#f2c14e' : '#8a869a'; bctx.fillRect(c.tx * 2 - 3, c.ty * 2 - 3, 6, 6); }
  if (!G.bossDead && explored[ARENA.y1 * MW + DOOR[1]]) { bctx.fillStyle = OL; bctx.fillRect(374, 214, 12, 12); bctx.fillStyle = '#ff3b3b'; bctx.fillRect(376, 216, 8, 8); label('狼王', 380, 210, '#ff8a7a', 11); }
  for (const d of Object.values(RBDEF)) if (!rbDead.has(d.id) && explored[d.ty * MW + d.tx]) { bctx.fillStyle = OL; bctx.fillRect(d.tx * 2 - 6, d.ty * 2 - 6, 12, 12); bctx.fillStyle = '#ff3b3b'; bctx.fillRect(d.tx * 2 - 4, d.ty * 2 - 4, 8, 8); label(d.short, d.tx * 2, d.ty * 2 - 9, '#ff8a7a', 11); }
  if (merchant) { const mx = Math.floor(merchant.x / TS) * 2, my = Math.floor(merchant.y / TS) * 2; bctx.fillStyle = OL; bctx.fillRect(mx - 4, my - 4, 9, 9); bctx.fillStyle = '#5ae0b0'; bctx.fillRect(mx - 3, my - 3, 7, 7); label('商人', mx, my - 7, '#9af0d0', 11); }
  if (G.lost) { bctx.fillStyle = '#b49cff'; bctx.fillRect(Math.floor(G.lost.x / TS) * 2 - 3, Math.floor(G.lost.y / TS) * 2 - 3, 6, 6); }
  const px = Math.floor(G.me.x / TS) * 2, py = Math.floor(G.me.y / TS) * 2;
  bctx.fillStyle = OL; bctx.fillRect(px - 4, py - 4, 9, 9); bctx.fillStyle = '#7fdcff'; bctx.fillRect(px - 3, py - 3, 7, 7); bctx.fillStyle = '#ffffff'; bctx.fillRect(px - 1, py - 1, 3, 3);
}

