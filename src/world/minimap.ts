import { G } from '../core/state';
import { $ } from '../core/util';
import { BIGT, BRIDGE, CLIFF, CRATE, FOG, GRAVE, GROUND, HOUSE, LAVA, MH, MW, PILLAR, RFLOOR, ROAD, ROCK, RWALL, TREE, TS, WATER, explored, map, reg } from './map';

export const mini = $<HTMLCanvasElement>('mini'), mctx = mini.getContext('2d');
export const miniBase = document.createElement('canvas'); miniBase.width = MW; miniBase.height = MH;
const mbx = miniBase.getContext('2d');
const MCOL = { [ROAD]:'#b8956a', [WATER]:'#3b6ea8', [LAVA]:'#e8743b', [RWALL]:'#2a2633', [RFLOOR]:'#7a768a', [BRIDGE]:'#8a6038', [TREE]:null, [ROCK]:'#6b6878', [PILLAR]:'#2a2633', [CRATE]:'#7a5434', [FOG]:'#e8e4ff', [GRAVE]:'#8a8696', [BIGT]:'#2a5a26', [HOUSE]:'#a8503a' };
const MGROUND = ['#5a9a46', '#2f5a3e', '#9a8a6a', '#3a2b2d', '#3a3444', '#c8d4e2', '#2b3822'], MTREE = ['#3a7a30', '#1c4635', '#6a5a44', '#2a1e20', '#3a7a30', '#2a4a5c', '#3a3220'], MCLIFF = ['#6e685c', '#404c40', '#62533c', '#3a2c2e', '#43303d', '#58647e', '#3a4048'];   // 岩石高地 = 跟遊戲裡崖頂石塊同色
const MWATER = { 5: '#8ab4d4', 6: '#22544e' };
export function miniPix(i) {
  const t = map[i], r = reg[i];
  const col = t === GROUND ? MGROUND[r] : t === TREE ? MTREE[r] : t === CLIFF ? MCLIFF[r] : t === WATER && MWATER[r] ? MWATER[r] : MCOL[t];
  mbx.fillStyle = col || '#000'; mbx.fillRect(i % MW, (i / MW) | 0, 1, 1);
}
export function reveal() {
  const px = Math.floor(G.me.x / TS), py = Math.floor(G.me.y / TS), R = 12;
  for (let y = py - R; y <= py + R; y++) for (let x = px - R; x <= px + R; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH || (x - px) ** 2 + (y - py) ** 2 > R * R) continue;
    const i = y * MW + x; if (!explored[i]) { explored[i] = 1; miniPix(i); }
  }
}
export const miniFull = document.createElement('canvas'); miniFull.width = MW; miniFull.height = MH;
export function bakeFullMap() { const g = miniFull.getContext('2d'), keep = mbx; for (let i = 0; i < MW * MH; i++) { const t = map[i], r = reg[i]; g.fillStyle = (t === GROUND ? MGROUND[r] : t === TREE ? MTREE[r] : t === CLIFF ? MCLIFF[r] : t === WATER && MWATER[r] ? MWATER[r] : MCOL[t]) || '#000'; g.fillRect(i % MW, (i / MW) | 0, 1, 1); } }
export function redrawMini() { mbx.clearRect(0, 0, MW, MH); for (let i = 0; i < explored.length; i++) if (explored[i]) miniPix(i); }
export function packExplored() { let s = ''; for (let i = 0; i < explored.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (explored[i + k]) b |= 1 << k; s += String.fromCharCode(b); } try { return btoa(s); } catch (e) { return ''; } }
export function unpackExplored(str, w = MW) {                          // w = 存檔時的地圖寬度：舊存檔是 256，要換算到新的格子位置
  explored.fill(0); try { const s = atob(str); for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i); for (let k = 0; k < 8; k++) if (b & (1 << k)) { const j = i * 8 + k, x = j % w, y = (j / w) | 0; if (y < MH) explored[y * MW + x] = 1; } } } catch (e) {} redrawMini(); }

