/* 地城入口、上樓階梯的圖（跟 world/dungeons.ts 分開放：那邊會被地圖生成 import，不能牽到 tileArt） */
import { G } from '../core/state';
import { ctx, snapF } from '../core/canvas';
import { SH, sculpt } from '../art/monsters';
import { TS } from './map';
import { drawArtSprite } from './chunks';
import { DUNGEONS } from './dungeons';

/* ---- 圖：洞口（洞窟、石窟）、石門（古墓）、上樓階梯 ---- */
const ROCKR = ['#2a2630', '#46404e', '#655e6e', '#8a8294'];
const CAVE_SP = sculpt(84, 58, [{ sh: SH.ell(42, 46, 41, 34, (x, y) => y < 58), ramp: ROCKR, tex: .35, grp: 1 }], a => {   // 洞口：大約 28×19 世界像素
  a.ell(42, 44, 17, 18, '#07060a'); a.rect(25, 44, 35, 14, '#07060a'); a.ell(42, 44, 12, 13, '#000000'); a.rect(30, 44, 25, 14, '#000000');
  for (const [x, y] of [[20, 30], [64, 28], [30, 16], [54, 17], [12, 44], [72, 44]]) { a.set(x, y, '#a8a0b4'); a.set(x + 1, y, '#8a8294'); }
  for (let x = 27; x < 58; x += 4) { a.set(x, 57, '#3a3440'); a.set(x + 1, 56, '#2a2630'); } });
const CRYPT_SP = sculpt(72, 64, [{ sh: SH.box(36, 38, 30, 25, 2), ramp: ['#2e2a36', '#4a4558', '#6a6478', '#8e88a0'], tex: .2, grp: 1 },
  { sh: SH.box(36, 10, 35, 6, 1), ramp: ['#3a3646', '#5a5468', '#7e7890', '#aaa4bc'], grp: 2 }], a => {
  a.rect(22, 24, 28, 40, '#08060c'); a.rect(25, 27, 22, 37, '#000000'); a.rect(22, 22, 28, 2, '#aaa4bc');
  for (const [x, y] of [[35, 17], [36, 17], [36, 16], [36, 18], [37, 17], [36, 15], [36, 19], [34, 17], [38, 17]]) a.set(x, y, '#c8a8ff');   // 門楣上的星形刻紋
  a.rect(13, 26, 3, 36, '#2e2a36'); a.rect(56, 26, 3, 36, '#2e2a36'); });
const STAIRS_SP = sculpt(30, 22, [{ sh: SH.box(15, 14, 13, 7, 1), ramp: ['#2a2630', '#46404e', '#655e6e', '#8a8294'], grp: 1 }], a => {
  for (let k = 0; k < 4; k++) { a.rect(4 + k * 2, 8 + k * 3, 22 - k * 4, 1, '#14121a'); a.rect(4 + k * 2, 9 + k * 3, 22 - k * 4, 1, '#a8a0b4'); }
  a.rect(12, 2, 6, 6, '#fff6d0'); a.rect(13, 0, 4, 2, '#fff6d0'); });
export function drawDoors(vis, list, L, addLight) {
  for (const d of DUNGEONS) {
    const ex = d.ent[0] * TS + 8, ey = (d.ent[1] + 1) * TS - 1;
    if (d.stairs) { const sx = ex, sy = d.ent[1] * TS + 8; if (vis(sx, sy, 60)) addLight(L, sx, sy, 24 + Math.sin(G.time * 3) * 2, 3); }   // 地底遺跡的石階：地圖上的格子已經畫好了，只加一點光
    else if (vis(ex, ey, 60)) { const sp = d.style === 'crypt' ? CRYPT_SP : CAVE_SP; list.push({ y: ey - 2, f: () => drawArtSprite(sp, ex, ey) });
      addLight(L, ex, ey - 8, (d.style === 'crypt' ? 26 : 18) + Math.sin(G.time * 3) * 2, 3); }   // 入口淡淡的紫光：遠遠就看得到
    if (d.exX !== undefined && vis(d.exX, d.exY, 60)) { list.push({ y: d.exY - 20, f: () => {                // 上樓階梯：地上的石階 + 從上面灑下來的光
      drawArtSprite(STAIRS_SP, d.exX, d.exY + 5); const k = (Math.sin(G.time * 2) + 1) / 2; ctx.globalAlpha = .18 + .1 * k; ctx.fillStyle = '#fff6d0';
      ctx.fillRect(snapF(d.exX - 5), snapF(d.exY - 40), 10, 40); ctx.globalAlpha = 1; } });
      addLight(L, d.exX, d.exY - 6, 40, 1); }
  }
}
