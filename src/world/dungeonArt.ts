/* 地城入口、出口傳送門的圖（跟 world/dungeons.ts 分開放：那邊會被地圖生成 import，不能牽到 tileArt） */
import { G } from '../core/state';
import { ctx, snapF } from '../core/canvas';
import { SH, sculpt } from '../art/monsters';
import { MW, TS, reg } from './map';
import { SRAMP } from './tileArt';
import { drawArtSprite, flame } from './chunks';
import { DUNGEONS, dungeonHooks } from './dungeons';
import { pick, rr } from '../core/util';

/* ---- 圖：洞口（洞窟、石窟）、石門（古墓） ---- */
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
/* ---- 傳送門：一圈立著的石環，裡面是旋轉的藍白光 ----
   (x, y) = 腳下（玩家站上去的位置）；open = 0~1，打開的動畫（從一個點長大成整圈） */
const PCOL = ['#ffffff', '#c8e8ff', '#7ab8ff', '#3a5a9a'];
export function drawPortal(x: number, y: number, open = 1) {
  const s = Math.max(0, Math.min(1, open)), e = 1 - (1 - s) ** 3, cx = x, cy = y - 15, RX = 10 * e, RY = 14 * e, t = G.time;
  if (e <= 0) return;
  ctx.globalAlpha = .55; ctx.fillStyle = '#0c0a14'; ctx.beginPath(); ctx.ellipse(snapF(cx), snapF(y + 1), 14 * e, 4.5 * e, 0, 0, Math.PI * 2); ctx.fill();   // 地上的石台
  ctx.globalAlpha = .35 + .15 * Math.sin(t * 3); ctx.strokeStyle = PCOL[2]; ctx.lineWidth = .7; ctx.beginPath(); ctx.ellipse(snapF(cx), snapF(y + 1), 12.5 * e, 3.8 * e, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, RY); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.35, 'rgba(170,215,255,.75)'); g.addColorStop(.8, 'rgba(70,110,200,.55)'); g.addColorStop(1, 'rgba(30,40,90,.4)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(snapF(cx), snapF(cy), RX, RY, 0, 0, Math.PI * 2); ctx.fill();                   // 門裡的光
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, RX, RY, 0, 0, Math.PI * 2); ctx.clip();
  for (let arm = 0; arm < 3; arm++) for (let k = 0; k < 14; k++) {                                       // 三條旋臂往中心捲進去
    const u = k / 14, a = t * 2.2 + arm * 2.094 + u * 4.2, r = 1 - u;
    ctx.globalAlpha = .25 + .55 * u; ctx.fillStyle = u > .7 ? PCOL[0] : PCOL[1];
    ctx.fillRect(snapF(cx + Math.cos(a) * RX * r * .95), snapF(cy + Math.sin(a) * RY * r * .95), HKP, HKP); }
  ctx.restore(); ctx.globalAlpha = 1;
  ctx.lineWidth = 2.6; ctx.strokeStyle = '#2a2638'; ctx.beginPath(); ctx.ellipse(snapF(cx), snapF(cy), RX + 1.2, RY + 1.2, 0, 0, Math.PI * 2); ctx.stroke();   // 石環
  ctx.lineWidth = 1; ctx.strokeStyle = '#5a5470'; ctx.beginPath(); ctx.ellipse(snapF(cx), snapF(cy), RX + 1.9, RY + 1.9, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.lineWidth = .8; ctx.strokeStyle = PCOL[1]; ctx.globalAlpha = .7 + .3 * Math.sin(t * 4); ctx.beginPath(); ctx.ellipse(snapF(cx), snapF(cy), RX + .2, RY + .2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  for (let k = 0; k < 6; k++) { const a = t * 1.3 + k * 1.047, px = cx + Math.cos(a) * (RX + 1.2), py = cy + Math.sin(a) * (RY + 1.2);   // 石環上一圈會轉的符文光點
    ctx.fillStyle = k % 2 ? PCOL[0] : PCOL[1]; ctx.fillRect(snapF(px - .5), snapF(py - .5), 1, 1); }
  if (e >= 1 && Math.random() < .5) G.parts.push({ x: cx + rr(-RX, RX), y: y - rr(0, 3), vx: rr(-4, 4), vy: -rr(14, 34), life: rr(.6, 1.1), max: 1.1, col: pick(PCOL.slice(0, 3)), star: rr(.5, 1.3), drag: 1 });
}
const HKP = 2 / 3;
const portalT = new Map<string, number>();                                                        // Boss 大廳的傳送門第一次被看到的時間 → 打開的動畫
/* ---- 霧門：洞口整面蓋著一層白霧 + 往上飄的白色光點（像艾爾登法環的霧門），一看就知道「這裡進得去」 ----
   shape = 洞口的形狀：cave = 拱形（半橢圓 + 下面一塊），crypt = 長方形石門 */
function drawFog(ex: number, ey: number, crypt: boolean, seed: number) {
  const t = G.time, W = crypt ? 4.8 : 6, H = crypt ? 13.2 : 10.8, top = ey - H, pulse = .5 + .5 * Math.sin(t * 2 + seed);
  const path = (grow = 0) => { ctx.beginPath(); if (crypt) ctx.rect(ex - W - grow, top - grow, (W + grow) * 2, H + grow); else { ctx.ellipse(ex, top + W, W + grow, W + grow, 0, Math.PI, 0); ctx.rect(ex - W - grow, top + W, (W + grow) * 2, H - W); } };
  const halo = ctx.createRadialGradient(ex, ey - H * .5, 0, ex, ey - H * .5, H * 1.5);                   // 洞口外面一圈白色光暈
  halo.addColorStop(0, 'rgba(255,255,255,' + (.35 + .1 * pulse) + ')'); halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo; ctx.fillRect(ex - H * 1.5, ey - H * 2, H * 3, H * 2 + 2);
  ctx.save(); path(); ctx.clip();
  const g = ctx.createLinearGradient(0, top, 0, ey); g.addColorStop(0, 'rgba(236,242,255,.72)'); g.addColorStop(1, 'rgba(255,255,255,.95)');
  ctx.globalAlpha = .88 + .12 * pulse; ctx.fillStyle = g; ctx.fillRect(ex - W, top, W * 2, H);          // 一整面白霧
  for (let k = 0; k < 8; k++) { const u = (t * (.22 + k * .035) + k * .37 + seed) % 1, y = ey - u * H, x = ex + Math.sin(t * 1.3 + k * 2.1) * W * .5;   // 霧裡慢慢翻動的灰藍色紋路
    ctx.globalAlpha = .28 * Math.sin(u * Math.PI); ctx.fillStyle = k % 2 ? '#b8c4dc' : '#d0d8ec'; ctx.fillRect(snapF(x - W * .8), snapF(y), W * 1.6, .7); }
  ctx.restore(); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .7; ctx.globalAlpha = .6 + .4 * pulse; path(.3); ctx.stroke(); ctx.globalAlpha = 1;   // 霧的邊緣亮一圈
  for (let n = 0; n < 2; n++) if (Math.random() < .6) G.parts.push({ x: ex + rr(-W, W), y: ey - rr(0, H), vx: rr(-7, 7), vy: -rr(8, 28), life: rr(.9, 1.8), max: 1.8, col: pick(['#ffffff', '#ffffff', '#eef2ff']), star: rr(.6, 1.6), drag: .6 });   // 白色光點從霧裡飄出來
}

export function drawDoors(vis, list, L, addLight) {
  for (const d of DUNGEONS) {
    const ex = d.ent[0] * TS + 8, ey = (d.ent[1] + 1) * TS - 1, done = dungeonHooks.cleared(d);   // 打完了：洞口變回普通的洞口（沒有白霧、白光、白色光點），一看就知道「這裡來過了」
    if (d.stairs && done) { /* 石階本身畫在地圖格子上，什麼都不加 */ }
    else if (d.stairs) { const sx = ex, sy = d.ent[1] * TS + 8; if (vis(sx, sy, 60)) { addLight(L, sx, sy, 28 + Math.sin(G.time * 3) * 2, 5);   // 地底遺跡的石階：格子已經畫好了，加白光 + 往上飄的白色光點
      list.push({ y: sy + 8, f: () => { ctx.globalAlpha = .22 + .08 * Math.sin(G.time * 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(snapF(sx - 7), snapF(sy - 8), 14, 16); ctx.globalAlpha = 1;
        if (Math.random() < .5) G.parts.push({ x: sx + rr(-7, 7), y: sy + rr(-6, 8), vx: rr(-4, 4), vy: -rr(8, 24), life: rr(.8, 1.5), max: 1.5, col: pick(['#ffffff', '#e8eeff']), star: rr(.4, 1.2), drag: 1 }); } }); } }
    else if (vis(ex, ey, 60) || vis(ex, ey - 70, 40)) {
      const crypt = d.style === 'crypt', sp = crypt ? CRYPT_SP : CAVE_SP, top = crypt ? OBELISK : CRAG[regAtT(d.ent[0], d.ent[1])] || CRAG[0];
      list.push({ y: ey - 40, f: () => drawArtSprite(top, ex + (crypt ? 0 : 10), ey - 40) });                 // 岩丘上的尖岩 / 方尖碑（排在洞口後面）
      list.push({ y: ey - 2, f: () => { drawArtSprite(sp, ex, ey); if (!done) drawFog(ex, ey, crypt, d.ent[0] * .13); } });
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
      if (!done) addLight(L, ex, ey - 8, (crypt ? 34 : 30) + Math.sin(G.time * 3) * 2, 5); }                      // 洞口的白光（霧門）
    if (d.exX !== undefined && vis(d.exX, d.exY, 60)) { const px = d.exX, py = d.exY + 4;            // 出口：一圈傳送門
      list.push({ y: py - 6, f: () => drawPortal(px, py) }); addLight(L, px, py - 14, 46 + Math.sin(G.time * 3) * 3, 2); }
    if (d.portal && vis(d.portal[0], d.portal[1], 60) && dungeonHooks.cleared(d)) { const [px, py] = d.portal;   // Boss 倒下 → 大廳中央打開一圈傳送門
      if (!portalT.has(d.id)) { portalT.set(d.id, G.time); for (let i = 0; i < 30; i++) G.parts.push({ x: px + rr(-3, 3), y: py - 15 + rr(-3, 3), vx: rr(-60, 60), vy: rr(-60, 60), life: rr(.4, .8), max: .8, col: pick(PCOL), star: rr(.8, 2), drag: 3 }); }
      const op = Math.max(0, Math.min(1, (G.time - portalT.get(d.id)) / 1.2));                   // 0 → 1：1.2 秒內從一個點長成整圈
      list.push({ y: py + 4 - 6, f: () => drawPortal(px, py + 4, op) }); addLight(L, px, py - 10, Math.max(1, op * (46 + Math.sin(G.time * 3) * 3)), 2); }
  }
}
