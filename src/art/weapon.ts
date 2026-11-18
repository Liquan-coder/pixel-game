import { TAU } from '../core/util';
import { HK, snapF } from '../core/canvas';
import { rotGrid } from './sprite';
import { WEAP } from './hero';

const WROT = {}, NROT = 32;
export function gridCanvas(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { const col = pal[ch]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }));
  return c;
}
function weaponFrame(type, ang, mir?: boolean) {
  const mirror = (mir ?? Math.cos(ang) < -0.01) ? 1 : 0;           // 預設：指向左邊就左右翻（劍這種對稱的武器怎麼翻都一樣）
  const i = ((Math.round(ang / TAU * NROT) % NROT) + NROT) % NROT;
  const set = WROT[type] || (WROT[type] = [[], []]);
  let f = set[mirror][i];
  if (!f) { const W = WEAP[type], r = rotGrid(W.rows, W.grip, i / NROT * TAU, !!mirror, W.base); f = set[mirror][i] = { c: gridCanvas(r.rows, W.pal), ox: r.ox, oy: r.oy }; }
  return f;
}
// weapons and the heroine are drawn with finer pixels: HK world units per art pixel
// mir：指定要不要左右翻。斧頭只有一邊有刃，要用這個讓刃永遠朝「揮過去的方向」
export function drawWeapon(c, type, x, y, ang, k = HK, mir?: boolean) {
  const f = weaponFrame(type, ang, mir);
  c.drawImage(f.c, snapF(x - f.ox * k), snapF(y - f.oy * k), f.c.width * k, f.c.height * k);
}

