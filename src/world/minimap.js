import { G } from '../core/state.js';
import { $ } from '../core/util.js';
import { BIGT, BRIDGE, CLIFF, CRATE, FOG, GRAVE, GROUND, LAVA, MH, MW, PILLAR, RFLOOR, ROAD, ROCK, RWALL, TREE, TS, WATER, explored, map, reg } from './map.js';

export const mini = $('mini'), mctx = mini.getContext('2d');
export const miniBase = document.createElement('canvas'); miniBase.width = MW; miniBase.height = MH;
const mbx = miniBase.getContext('2d');
const MCOL = { [ROAD]:'#b8956a', [WATER]:'#3b6ea8', [LAVA]:'#e8743b', [RWALL]:'#2a2633', [RFLOOR]:'#7a768a', [BRIDGE]:'#8a6038', [TREE]:null, [ROCK]:'#6b6878', [PILLAR]:'#2a2633', [CRATE]:'#7a5434', [FOG]:'#e8e4ff', [GRAVE]:'#8a8696', [BIGT]:'#2a5a26' };
const MGROUND = ['#5a9a46', '#2f5a3e', '#9a8a6a', '#3a2b2d', '#3a3444'], MTREE = ['#3a7a30', '#1c4635', '#6a5a44', '#2a1e20', '#3a7a30'], MCLIFF = ['#3a352e', '#232a22', '#5a4a34', '#1a1214', '#14111b'];
export function miniPix(i) {
  const t = map[i], r = reg[i];
  const col = t === GROUND ? MGROUND[r] : t === TREE ? MTREE[r] : t === CLIFF ? MCLIFF[r] : MCOL[t];
  mbx.fillStyle = col || '#000'; mbx.fillRect(i % MW, (i / MW) | 0, 1, 1);
}
export function reveal() {
  const px = Math.floor(G.P.x / TS), py = Math.floor(G.P.y / TS), R = 12;
  for (let y = py - R; y <= py + R; y++) for (let x = px - R; x <= px + R; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH || (x - px) ** 2 + (y - py) ** 2 > R * R) continue;
    const i = y * MW + x; if (!explored[i]) { explored[i] = 1; miniPix(i); }
  }
}
export const miniFull = document.createElement('canvas'); miniFull.width = MW; miniFull.height = MH;
export function bakeFullMap() { const g = miniFull.getContext('2d'), keep = mbx; for (let i = 0; i < MW * MH; i++) { const t = map[i], r = reg[i]; g.fillStyle = (t === GROUND ? MGROUND[r] : t === TREE ? MTREE[r] : t === CLIFF ? MCLIFF[r] : MCOL[t]) || '#000'; g.fillRect(i % MW, (i / MW) | 0, 1, 1); } }
export function redrawMini() { mbx.clearRect(0, 0, MW, MH); for (let i = 0; i < explored.length; i++) if (explored[i]) miniPix(i); }
export function packExplored() { let s = ''; for (let i = 0; i < explored.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (explored[i + k]) b |= 1 << k; s += String.fromCharCode(b); } try { return btoa(s); } catch (e) { return ''; } }
export function unpackExplored(str) { explored.fill(0); try { const s = atob(str); for (let i = 0; i < s.length; i++) { const b = s.charCodeAt(i); for (let k = 0; k < 8; k++) if (b & (1 << k)) explored[i * 8 + k] = 1; } } catch (e) {} redrawMini(); }

