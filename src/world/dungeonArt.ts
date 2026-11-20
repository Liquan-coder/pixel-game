/* 地城入口、上樓階梯的圖（跟 world/dungeons.ts 分開放：那邊會被地圖生成 import，不能牽到 tileArt） */
import { G } from '../core/state';
import { ctx, snapF } from '../core/canvas';
import { SH, sculpt } from '../art/monsters';
import { MW, TS, reg } from './map';
import { SRAMP } from './tileArt';
import { drawArtSprite, flame } from './chunks';
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
/* ---- 入口上方的地標：洞窟 / 石窟 = 一根高高的尖岩（顏色跟著地區），古墓 = 一根斷掉的方尖碑。比岩丘高很多 → 還沒看到洞口就先看到它 ---- */
const CRAG = [0, 1, 2, 3, 5, 6].reduce((o, r) => { const R = SRAMP.rock[r];
  o[r] = sculpt(66, 196, [{ sh: SH.ell(33, 176, 30, 18), ramp: R, tex: .35, grp: 1 }, { sh: SH.cap(34, 170, 30, 40, 22, 9), ramp: R, tex: .35, grp: 2 },
    { sh: SH.cap(30, 60, 34, 8, 10, 4), ramp: R, tex: .35, grp: 3 }, { sh: SH.ell(18, 150, 9, 22), ramp: R, tex: .35, grp: 4 }], a => {
    if (r === 5) for (let x = 20; x < 46; x++) for (let y = 0; y < 196; y++) if (a.get(x, y) && !a.get(x, y - 3)) { a.set(x, y, '#ffffff'); a.set(x, y + 1, '#dce8f4'); }   // 雪原：岩頂積雪
    if (r <= 1 || r === 6) for (let k = 0; k < 40; k++) { const x = 14 + ((k * 37) % 40), y = 60 + ((k * 53) % 120); if (a.get(x, y)) a.set(x, y, k & 1 ? '#3e7050' : '#5a8a46'); }   // 青苔
  }); return o; }, {} as Record<number, HTMLCanvasElement>);
const OBELISK = sculpt(40, 170, [{ sh: SH.box(20, 158, 18, 10, 3), ramp: ['#2e2a36', '#4a4558', '#6a6478', '#8e88a0'], grp: 1 },
  { sh: SH.poly([[8, 150], [32, 150], [28, 20], [22, 8], [12, 30]]), ramp: ['#2e2a36', '#4a4558', '#6a6478', '#8e88a0'], tex: .25, grp: 2 }], a => {
  for (const [x, y] of [[20, 60], [19, 61], [21, 61], [20, 62], [20, 59], [18, 61], [22, 61]]) a.set(x, y, '#c8a8ff'); });
const TORCH_POST = sculpt(10, 40, [{ sh: SH.box(5, 22, 2, 18, 3), ramp: ['#2e1c0e', '#4a3018', '#6a4626', '#86603a'], grp: 1 }, { sh: SH.ell(5, 6, 4, 3), ramp: ['#2a2834', '#4a4858', '#7a788a'], grp: 2 }]);
const MIST = { cave: '#b8b2c8', grotto: '#9ad0e8', crypt: '#c8b8e8' } as Record<string, string>;
const regAtT = (tx: number, ty: number) => reg[ty * MW + tx];
export function drawDoors(vis, list, L, addLight) {
  for (const d of DUNGEONS) {
    const ex = d.ent[0] * TS + 8, ey = (d.ent[1] + 1) * TS - 1;
    if (d.stairs) { const sx = ex, sy = d.ent[1] * TS + 8; if (vis(sx, sy, 60)) addLight(L, sx, sy, 24 + Math.sin(G.time * 3) * 2, 3); }   // 地底遺跡的石階：地圖上的格子已經畫好了，只加一點光
    else if (vis(ex, ey, 60) || vis(ex, ey - 70, 40)) {
      const crypt = d.style === 'crypt', sp = crypt ? CRYPT_SP : CAVE_SP, top = crypt ? OBELISK : CRAG[regAtT(d.ent[0], d.ent[1])] || CRAG[0];
      list.push({ y: ey - 40, f: () => drawArtSprite(top, ex + (crypt ? 0 : 10), ey - 40) });                 // 岩丘上的尖岩 / 方尖碑（排在洞口後面）
      list.push({ y: ey - 2, f: () => drawArtSprite(sp, ex, ey) });
      for (const s of [-1, 1]) { const tx = ex + s * 30, ty = ey + 22;                               // 洞口兩邊的火把
        list.push({ y: ty, f: () => { drawArtSprite(TORCH_POST, tx, ty); flame(tx, ty - 12, 4, d.ent[0] + s); } }); addLight(L, tx, ty - 14, 46 + Math.sin(G.time * 9 + s) * 2, 1); }
      list.push({ y: ey + 1, f: () => {                                                               // 從洞口飄出來的霧（一團一團，慢慢往外散開、變淡）
        ctx.fillStyle = MIST[d.style] || MIST.cave;
        for (let k = 0; k < 6; k++) { const u = (G.time * .18 + k / 6) % 1, x = ex + Math.sin(k * 2.3 + G.time * .4) * (4 + u * 26), y = ey - 6 + u * 18, r = 3 + u * 9;
          ctx.globalAlpha = .22 * (1 - u) * Math.min(1, u * 5); ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y), r * 1.6, r * .7, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1; } });
      if (d.style === 'cave') list.push({ y: ey - 30, f: () => {                                       // 洞口附近繞著飛的蝙蝠
        for (let k = 0; k < 3; k++) { const t = G.time * (.9 + k * .23) + k * 2.1, x = ex + Math.sin(t) * (18 + k * 6), y = ey - 30 - k * 8 + Math.sin(t * 2.3) * 7, f = Math.sin(G.time * 22 + k * 3) > 0;
          ctx.fillStyle = '#16121c'; ctx.fillRect(snapF(x - 1), snapF(y - 1), 2, 2);
          if (f) { ctx.fillRect(snapF(x - 4), snapF(y - 2), 3, 1); ctx.fillRect(snapF(x + 1), snapF(y - 2), 3, 1); } else { ctx.fillRect(snapF(x - 4), snapF(y), 3, 1); ctx.fillRect(snapF(x + 1), snapF(y), 3, 1); } }
      } });
      addLight(L, ex, ey - 8, (crypt ? 30 : 26) + Math.sin(G.time * 3) * 2, 3); }                      // 洞口淡淡的紫光
    if (d.exX !== undefined && vis(d.exX, d.exY, 60)) { list.push({ y: d.exY - 20, f: () => {                // 上樓階梯：地上的石階 + 從上面灑下來的光
      drawArtSprite(STAIRS_SP, d.exX, d.exY + 5); const k = (Math.sin(G.time * 2) + 1) / 2; ctx.globalAlpha = .18 + .1 * k; ctx.fillStyle = '#fff6d0';
      ctx.fillRect(snapF(d.exX - 5), snapF(d.exY - 40), 10, 40); ctx.globalAlpha = 1; } });
      addLight(L, d.exX, d.exY - 6, 40, 1); }
  }
}
