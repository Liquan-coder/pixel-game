import { G } from '../core/state';
import { $ } from '../core/util';
import { BIGT, BRIDGE, CLIFF, CRATE, FOG, GRAVE, GROUND, HOUSE, LAVA, MH, MW, PILLAR, RFLOOR, ROAD, ROCK, RWALL, TREE, TS, WATER, WALKABLE, explored, map, reg } from './map';

export const mini = $<HTMLCanvasElement>('mini'), mctx = mini.getContext('2d');
export const miniBase = document.createElement('canvas'); miniBase.width = MW; miniBase.height = MH;
const mbx = miniBase.getContext('2d');
const MCOL = { [ROAD]:'#b8956a', [WATER]:'#3b6ea8', [LAVA]:'#e8743b', [RWALL]:'#2a2633', [RFLOOR]:'#7a768a', [BRIDGE]:'#8a6038', [TREE]:null, [ROCK]:'#6b6878', [PILLAR]:'#2a2633', [CRATE]:'#7a5434', [FOG]:'#e8e4ff', [GRAVE]:'#8a8696', [BIGT]:'#2a5a26', [HOUSE]:'#a8503a' };
const MGROUND = ['#5a9a46', '#2f5a3e', '#9a8a6a', '#3a2b2d', '#3a3444', '#c8d4e2', '#2b3822', '#4a4339', '#3e7a6a'], MTREE = ['#3a7a30', '#1c4635', '#6a5a44', '#2a1e20', '#3a7a30', '#2a4a5c', '#3a3220', '#2a3a24', '#266462'], MCLIFF = ['#6e685c', '#404c40', '#62533c', '#3a2c2e', '#43303d', '#58647e', '#3a4048', '#16141a', '#9aa6b4'];   // 8 = 精靈王國   // 岩石高地 = 跟遊戲裡崖頂石塊同色
const MWATER = { 5: '#8ab4d4', 6: '#22544e' };
const colOf = i => { const t = map[i], r = reg[i]; return (t === GROUND ? MGROUND[r] : t === TREE ? MTREE[r] : t === CLIFF ? MCLIFF[r] : t === WATER && MWATER[r] ? MWATER[r] : MCOL[t]) || '#000'; };
export function miniPix(i) { mbx.fillStyle = colOf(i); mbx.fillRect(i % MW, (i / MW) | 0, 1, 1); }
const rgba = new Map<string, number>();                                 // '#rrggbb' → 0xAABBGGRR（ImageData 用）
const u32 = (c: string) => { let v = rgba.get(c); if (v === undefined) { const n = parseInt(c.slice(1), 16); v = (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; rgba.set(c, v); } return v; };
function paint(g: CanvasRenderingContext2D, only?: Uint8Array) {       // 一次寫整張圖（地圖很大時，一格一格 fillRect 會很慢）
  const img = g.createImageData(MW, MH), buf = new Uint32Array(img.data.buffer);
  for (let i = 0; i < MW * MH; i++) if (!only || only[i]) buf[i] = u32(colOf(i));
  g.putImageData(img, 0, 0);
}
/** 把身邊標成「看過」（小地圖 / 大地圖才畫得出來）。
    flood = 0：野外，半徑 12 格的圓（不管牆）。
    flood > 0：地城裡，只揭開沿著地板走 flood 步以內的地方，碰到牆就停（牆本身會畫出來 = 通道的輪廓）→ 牆後面的路、迷宮的形狀要真的走過才會出現在地圖上 */
export function reveal(flood = 0) {
  const px = Math.floor(G.me.x / TS), py = Math.floor(G.me.y / TS), see = (i: number) => { if (!explored[i]) { explored[i] = 1; miniPix(i); } };
  if (!flood) { const R = 12;
    for (let y = py - R; y <= py + R; y++) for (let x = px - R; x <= px + R; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH || (x - px) ** 2 + (y - py) ** 2 > R * R) continue; see(y * MW + x); }
    return; }
  const dist = new Map<number, number>([[py * MW + px, 0]]), q = [py * MW + px];   // 照「要走幾步」算（不是直線距離）：牆後面要繞一大圈才到的路不會揭開
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % MW, y = (i / MW) | 0, d = dist.get(i);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const j = ny * MW + nx; if (!WALKABLE(map[j])) { see(j); continue; }   // 旁邊的牆都畫（= 通道的輪廓）；地板要真的走得到才畫（不然會從斜角漏出牆另一邊的地板）
      if (dx && dy || d >= flood || dist.has(j)) continue;               // 只往上下左右走（不從牆角斜著鑽過去）
      dist.set(j, d + 1); see(j); q.push(j); } }
  see(py * MW + px);
}
export const miniFull = document.createElement('canvas'); miniFull.width = MW; miniFull.height = MH;
export function bakeFullMap() { paint(miniFull.getContext('2d')); }
export function redrawMini() { paint(mbx, explored); }
export function packExplored() { let s = ''; for (let i = 0; i < explored.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (explored[i + k]) b |= 1 << k; s += String.fromCharCode(b); } try { return btoa(s); } catch (e) { return ''; } }
export function unpackExplored(str, w = MW) {                          // w = 存檔時的地圖寬度：舊存檔是 256，要換算到新的格子位置
  explored.fill(0); try { const s = atob(str); for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i); for (let k = 0; k < 8; k++) if (b & (1 << k)) { const j = i * 8 + k, x = j % w, y = (j / w) | 0; if (y < MH) explored[y * MW + x] = 1; } } } catch (e) {} redrawMini(); }

