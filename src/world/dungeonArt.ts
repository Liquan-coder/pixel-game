/* 地城入口、出口傳送門的圖（跟 world/dungeons.ts 分開放：那邊會被地圖生成 import，不能牽到 tileArt） */
import { G } from '../core/state';
import { HK, ctx, snapF } from '../core/canvas';
import { drawShadow } from '../render/player';
import { SH, sculpt } from '../art/monsters';
import { MW, TS, reg } from './map';
import { SRAMP } from './tileArt';
import { drawArtSprite, flame } from './chunks';
import { DUNGEONS, dungeonHooks } from './dungeons';
import { pick, rr } from '../core/util';
import { RUNE_SLATE, guardStatue, runeStone } from '../art/stoneArt';
import { MON_H, MON_TOP, MON_W, monument } from '../art/monuments';

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
/* ---- 入口上方的地標：每座地城都是同一尊守護王像（art/monuments.ts），不透露裡面的 Boss。
   比岩丘高 → 還沒看到洞口就先看到它；王冠上冒紫色光柱，打完地城就熄掉 ---- */
const STONE5 = ['#1e1a26', '#2e2a36', '#4a4558', '#6a6478', '#8e88a0'];   // 古墓用的偏紫灰石頭
const TORCH_POST = sculpt(10, 40, [{ sh: SH.box(5, 22, 2, 18, 3), ramp: ['#2e1c0e', '#4a3018', '#6a4626', '#86603a'], grp: 1 }, { sh: SH.ell(5, 6, 4, 3), ramp: ['#2a2834', '#4a4858', '#7a788a'], grp: 2 }]);
const MIST = { cave: '#b8b2c8', grotto: '#9ad0e8', crypt: '#c8b8e8' } as Record<string, string>;
const regAtT = (tx: number, ty: number) => reg[ty * MW + tx];
/* ---- 地城裡的出口（入口房 + 打倒 Boss 後的大廳）：跟外面的入口長得一樣 = 洞口 / 石門 + 一整面白霧，兩邊立著火把
   (x, y) = 腳下（玩家站上去的位置）；op = 0~1，大廳那座升起來的動畫（從地底往上冒、霧慢慢亮起來） */
function exitGate(d: any, x: number, y: number, op: number, list, L, addLight) {
  const crypt = d.style === 'crypt' || d.style === 'ruin', sp = crypt ? CRYPT_SP : CAVE_SP, e = 1 - (1 - op) ** 3, rise = (1 - e) * 14;
  list.push({ y: y - 2, f: () => {
    ctx.save(); ctx.beginPath(); ctx.rect(x - 40, y - 60, 80, 61); ctx.clip();                     // 升起來時：地面以下的部分不畫
    drawShadow(x, y + 1, 22 * e); if (op >= .4) fogHalo(x, y - 6, crypt ? 13.2 : 10.8, .16 * (op - .4) / .6); drawArtSprite(sp, x, y + rise); ctx.restore();   // 光暈在石頭後面、淡一點
    if (op >= .4) drawFog(x, y, crypt, x * .013, false); } });
  if (op >= 1) for (const s of [-1, 1]) { const tx = x + s * 22, ty = y + 6;                     // 兩邊的火把（升好了才點起來）
    list.push({ y: ty, f: () => { drawArtSprite(TORCH_POST, tx, ty); flame(tx, ty - 12, 4, x + s); } }); addLight(L, tx, ty - 14, 40 + Math.sin(G.time * 9 + s) * 2, 1); }
  if (op > .4) addLight(L, x, y - 6, (13 + Math.sin(G.time * 3)) * op, 5);                     // 霧門的白光：只照亮霧本身（地城裡很暗，光太大會把整座石門洗白）
}
const HKP = 2 / 3;
const portalT = new Map<string, number>();                                                        // Boss 大廳的傳送門第一次被看到的時間 → 打開的動畫
/* ---- 霧門：洞口整面蓋著一層白霧 + 往上飄的白色光點（像艾爾登法環的霧門），一看就知道「這裡進得去」 ----
   shape = 洞口的形狀：cave = 拱形（半橢圓 + 下面一塊），crypt = 長方形石門 */
function drawFog(ex: number, ey: number, crypt: boolean, seed: number, halo = true) {   // halo = false：外圈的白色光暈另外畫（地城裡的出口畫在石頭後面，不然在暗的地方會把整個洞口蓋掉）
  const t = G.time, W = crypt ? 4.8 : 6, H = crypt ? 13.2 : 10.8, top = ey - H, pulse = .5 + .5 * Math.sin(t * 2 + seed);
  const path = (grow = 0) => { ctx.beginPath(); if (crypt) ctx.rect(ex - W - grow, top - grow, (W + grow) * 2, H + grow); else { ctx.ellipse(ex, top + W, W + grow, W + grow, 0, Math.PI, 0); ctx.rect(ex - W - grow, top + W, (W + grow) * 2, H - W); } };
  if (halo) fogHalo(ex, ey, H, .35 + .1 * pulse);                                                 // 洞口外面一圈白色光暈
  ctx.save(); path(); ctx.clip();
  const g = ctx.createLinearGradient(0, top, 0, ey); g.addColorStop(0, 'rgba(236,242,255,.72)'); g.addColorStop(1, 'rgba(255,255,255,.95)');
  ctx.globalAlpha = .88 + .12 * pulse; ctx.fillStyle = g; ctx.fillRect(ex - W, top, W * 2, H);          // 一整面白霧
  for (let k = 0; k < 8; k++) { const u = (t * (.22 + k * .035) + k * .37 + seed) % 1, y = ey - u * H, x = ex + Math.sin(t * 1.3 + k * 2.1) * W * .5;   // 霧裡慢慢翻動的灰藍色紋路
    ctx.globalAlpha = .28 * Math.sin(u * Math.PI); ctx.fillStyle = k % 2 ? '#b8c4dc' : '#d0d8ec'; ctx.fillRect(snapF(x - W * .8), snapF(y), W * 1.6, .7); }
  ctx.restore(); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .7; ctx.globalAlpha = .6 + .4 * pulse; path(.3); ctx.stroke(); ctx.globalAlpha = 1;   // 霧的邊緣亮一圈
  for (let n = 0; n < 2; n++) if (Math.random() < .6) G.parts.push({ x: ex + rr(-W, W), y: ey - rr(0, H), vx: rr(-7, 7), vy: -rr(8, 28), life: rr(.9, 1.8), max: 1.8, col: pick(['#ffffff', '#ffffff', '#eef2ff']), star: rr(.6, 1.6), drag: .6 });   // 白色光點從霧裡飄出來
}

function fogHalo(ex: number, ey: number, H: number, a: number) {
  const g = ctx.createRadialGradient(ex, ey - H * .5, 0, ex, ey - H * .5, H * 1.5);
  g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(ex - H * 1.5, ey - H * 2, H * 3, H * 2 + 2);
}

/* 尖岩 / 方尖碑頂端：一團紫光 + 往上淡掉的光柱 + 一直往上飄的紫色光點。比岩丘高，從四面八方遠遠就看得到。打完地城就熄掉 */
function beacon(x: number, y: number, seed: number) {
  const t = G.time, p = .5 + .5 * Math.sin(t * 2 + seed);
  const col = ctx.createLinearGradient(0, y - 90, 0, y);                                          // 光柱：往上越來越淡
  col.addColorStop(0, 'rgba(200,168,255,0)'); col.addColorStop(1, 'rgba(200,168,255,' + (.34 + .12 * p) + ')');
  ctx.fillStyle = col; ctx.fillRect(snapF(x - 3), snapF(y - 90), 6, 90);
  ctx.globalAlpha = .5; ctx.fillRect(snapF(x - 1), snapF(y - 90), 2, 90); ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 9 + 2 * p); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.3, 'rgba(216,190,255,.55)'); g.addColorStop(1, 'rgba(140,90,230,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9 + 2 * p, 0, Math.PI * 2); ctx.fill();   // 小小一團：不要蓋住石像
  for (let k = 0; k < 3; k++) { const a = t * 1.6 + k * 2.094; ctx.fillStyle = k ? '#c8a8ff' : '#ffffff'; ctx.fillRect(snapF(x + Math.cos(a) * 6), snapF(y + Math.sin(a) * 3), HKP * 1.5, HKP * 1.5); }   // 繞著轉的光點
  if (Math.random() < .35) G.parts.push({ x: x + rr(-3, 3), y: y - rr(0, 4), vx: rr(-5, 5), vy: -rr(16, 34), life: rr(1, 1.8), max: 1.8, col: pick(['#c8a8ff', '#9a6ae8', '#f0e8ff']), star: rr(.6, 1.5), drag: .6 });
}

/* ================= 地城前院的裝飾（位置在 world/dungeons.ts 的 dressEntrances） =================
   石板地 + 發黑的地面 + 守門雕像 + 破旗 + 符文石 + 頭骨 / 舊劍。打完以後雕像的眼睛、符文石的光會熄掉 */
const STONE = ['#2e2a36', '#4a4558', '#6a6478', '#8e88a0'], BONE = ['#6a6456', '#a8a08a', '#d8d0b8', '#f4f0e0'], STEEL = ['#3a3a4e', '#6a6a80', '#a8a8c0', '#e8e8f8'];
const WOOD = ['#2e1c0e', '#4a3018', '#6a4626', '#86603a'], CLOTH = ['#1e0e30', '#3a1c5a', '#5a2e88', '#7a4ab0'], DCOL = '#c8a8ff';
const statueCache: Record<string, HTMLCanvasElement> = {};
function statueArt(kind: 'garg' | 'hood', R: string[]) {                  // 守門雕像：石像鬼（洞窟、石窟）/ 拿劍的兜帽騎士（古墓）。60×124 細像素
  const key = kind + R[1]; if (statueCache[key]) return statueCache[key];
  return statueCache[key] = guardStatue(kind, R);                       // 鑿刻切面的石像（art/stoneArt.ts）
}
const BANNER = sculpt(34, 112, [{ sh: SH.box(6, 58, 2, 52, 2), ramp: WOOD, grp: 1 }, { sh: SH.ell(6, 5, 3, 3), ramp: STEEL, grp: 2 }, { sh: SH.box(17, 13, 13, 1.6, 2), ramp: WOOD, grp: 3 },
  { sh: SH.poly([[8, 15], [31, 15], [31, 70], [27, 62], [23, 78], [18, 64], [13, 74], [8, 64]]), ramp: CLOTH, tex: .25, grp: 4 }], a => {
  for (const [x, y] of [[19, 30], [19, 31], [19, 32], [19, 33], [19, 34], [17, 32], [18, 32], [20, 32], [21, 32], [19, 29], [19, 35]]) a.set(x, y, '#c8a060');   // 褪色的金色星紋
  for (let k = 0; k < 10; k++) { const x = 10 + ((k * 7) % 20), y = 40 + ((k * 11) % 26); if (a.get(x, y)) a.set(x, y, CLOTH[0]); } });               // 破洞、污漬
const SKULL = sculpt(30, 18, [{ sh: SH.cap(2, 15, 28, 14, 1.6, 1.6), ramp: BONE, grp: 1 }, { sh: SH.ell(9, 10, 5.5, 5), ramp: BONE, grp: 2 }, { sh: SH.ell(21, 11, 4.5, 4.5), ramp: BONE, grp: 3 }], a => {
  for (const [x, y] of [[7, 10], [11, 10], [20, 11], [23, 11]]) { a.set(x, y, '#1a1612'); a.set(x, y + 1, '#1a1612'); } a.set(9, 13, '#3a3428'); });
const BONES = sculpt(30, 14, [{ sh: SH.cap(3, 4, 26, 11, 1.5, 1.5), ramp: BONE, grp: 1 }, { sh: SH.cap(4, 11, 24, 5, 1.4, 1.4), ramp: BONE, grp: 2 }, { sh: SH.ell(3, 4, 2.4, 2.4), ramp: BONE, grp: 3 },
  { sh: SH.ell(26, 11, 2.4, 2.4), ramp: BONE, grp: 3 }, { sh: SH.ell(4, 11, 2.2, 2.2), ramp: BONE, grp: 4 }, { sh: SH.ell(24, 5, 2.2, 2.2), ramp: BONE, grp: 4 }]);
const SWORD = sculpt(16, 40, [{ sh: SH.ell(8, 37, 7, 3), ramp: ['#1e1a14', '#3a3226', '#4e4434'], grp: 1 }, { sh: SH.box(8, 24, 1.8, 13, 2), ramp: STEEL, grp: 2 },
  { sh: SH.box(8, 10, 6.5, 1.4, 2), ramp: ['#3a2a14', '#6a4a24', '#a07a3a', '#d0a860'], grp: 3 }, { sh: SH.box(8, 5, 1.3, 3.5, 2), ramp: WOOD, grp: 4 }, { sh: SH.ell(8, 1.5, 1.8, 1.6), ramp: STEEL, grp: 5 }], a => {
  for (let y = 18; y < 34; y += 3) if (a.get(9, y)) a.set(9, y, '#7a5a3a'); });                 // 生鏽
const CRYS = ['#1e0e38', '#4a2a88', '#8a5ae0', '#c8a8ff', '#f0e8ff'];   // 岩丘上的紫水晶：三根斜斜的晶柱（30×42 細像素）
const CRYSTAL = sculpt(30, 42, [{ sh: SH.ell(15, 39, 13, 3), ramp: ['#16121c', '#2a2434', '#3a3446'], grp: 1 },
  { sh: SH.poly([[5, 40], [11, 40], [8, 16], [4, 22]]), ramp: CRYS, tex: .1, grp: 2 }, { sh: SH.poly([[19, 40], [25, 40], [28, 20], [24, 14]]), ramp: CRYS, tex: .1, grp: 3 },
  { sh: SH.poly([[10, 40], [20, 40], [18, 8], [15, 1], [12, 8]]), ramp: CRYS, tex: .1, bias: .1, grp: 4 }], a => {
  for (let y = 5; y < 34; y++) if (a.get(15, y)) a.set(15, y, y % 7 ? CRYS[4] : CRYS[3]);   // 中間那根的亮邊
  for (const [x, y] of [[7, 22], [24, 20], [25, 24]]) if (a.get(x, y)) a.set(x, y, CRYS[4]); });
const plazaCache = new Map<string, HTMLCanvasElement>();
function plaza(d: any, R: string[]) {                                    // 碎石板地：一片 144×88 世界像素的圖（細像素 ×3），邊緣的石板一塊一塊缺掉
  if (plazaCache.has(d.id)) return plazaCache.get(d.id);
  const W = 432, H = 264, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); let seed = d.ent[0] * 131 + d.ent[1];
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xffff) / 0x10000; };
  for (let y = 0, row = 0; y < H; y += 18, row++) for (let x = -(row % 2) * 14; x < W;) { const w = 22 + Math.floor(rnd() * 16), mx = (x + w / 2 - W / 2) / (W / 2), my = (y + 9 - 10) / (H - 10);
    const keep = mx * mx + my * my * 1.1 < .95 - rnd() * .35;                                     // 越外面越容易缺
    if (keep) { const sh = rnd(); g.fillStyle = R[sh < .45 ? 0 : sh < .9 ? 1 : 2]; g.fillRect(x + 2, y + 2, w - 3, 15);
      g.fillStyle = R[2]; g.globalAlpha = .4; g.fillRect(x + 2, y + 2, w - 3, 2); g.globalAlpha = 1;   // 上緣亮一點
      g.fillStyle = '#0c0a10'; g.globalAlpha = .4; g.fillRect(x + 2, y + 15, w - 3, 2); g.globalAlpha = 1;
      if (rnd() < .3) { g.fillStyle = '#16121c'; let cx = x + 4 + rnd() * (w - 8), cy = y + 3; for (let k = 0; k < 6; k++) { g.fillRect(cx, cy, 1, 2); cx += rnd() < .5 ? -1 : 1; cy += 2; } }   // 裂縫
      if (rnd() < .35) { g.fillStyle = rnd() < .5 ? '#3e5a3a' : '#4e6e3a'; for (let k = 0; k < 5; k++) g.fillRect(x + 2 + rnd() * (w - 4), y + (rnd() < .5 ? 2 : 13) + rnd() * 3, 2, 1); } }   // 縫裡的青苔
    x += w; }
  plazaCache.set(d.id, c); return c;
}
function drawDeco(d: any, vis, list, L, addLight, done: boolean) {
  const ex = d.ent[0] * TS + 8, cy = (d.ent[1] + 1) * TS, r = regAtT(d.ent[0], d.ent[1]), R = d.style === 'crypt' ? STONE : (SRAMP.rock[r] || STONE);
  if (vis(ex, cy + 50, 150)) list.push({ y: cy - 600, f: () => {                                  // 地面：發黑的一大片 + 石板地（最先畫，在所有東西底下）
    const g = ctx.createRadialGradient(ex, cy + 44, 10, ex, cy + 44, 150); g.addColorStop(0, done ? 'rgba(20,14,28,.22)' : 'rgba(26,10,40,.42)'); g.addColorStop(1, 'rgba(26,10,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex, cy + 44, 150, 100, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .8; drawArtSprite(plaza(d, R), ex, cy + 90); ctx.globalAlpha = 1;
    if (!done && Math.random() < .25) G.parts.push({ x: ex + rr(-110, 110), y: cy + rr(0, 100), vx: rr(-3, 3), vy: -rr(6, 14), life: rr(1.2, 2), max: 2, col: pick(['#3a1c5a', '#5a2e88', '#1e0e30']), s: 1, drag: .5 });   // 地上飄起來的黑紫色塵
  } });
  const hx = ex, hy = (d.ent[1] - 2.5) * TS + 8;                                                // 岩丘中心
  if (vis(hx, hy, 190)) list.push({ y: cy - 601, f: () => {                                     // 岩丘四周一圈發黑、發紫的地（從背面、側面走過來也覺得不對勁）
    const g = ctx.createRadialGradient(hx, hy, 60, hx, hy, 190); g.addColorStop(0, done ? 'rgba(20,14,28,.18)' : 'rgba(30,10,46,.5)'); g.addColorStop(1, 'rgba(30,10,46,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(hx, hy, 190, 160, 0, 0, Math.PI * 2); ctx.fill();
    if (!done && Math.random() < .2) { const a = rr(Math.PI, Math.PI * 2), r = rr(110, 170); G.parts.push({ x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r * .8, vx: rr(-3, 3), vy: -rr(6, 14), life: rr(1.2, 2), max: 2, col: pick(['#3a1c5a', '#5a2e88', '#1e0e30']), s: 1, drag: .5 }); }
  } });
  for (const o of d.deco || []) { if (!vis(o.x, o.y, 60)) continue; const { x, y } = o;
    if (o.k === 'crystal') { list.push({ y, f: () => { if (o.flip) { ctx.save(); ctx.translate(snapF(x), 0); ctx.scale(-1, 1); drawArtSprite(CRYSTAL, 0, y + 1); ctx.restore(); } else drawArtSprite(CRYSTAL, x, y + 1);
        if (!done) { ctx.globalAlpha = .18 + .14 * Math.sin(G.time * 2.4 + x * .07); ctx.fillStyle = '#e0c8ff'; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y - 6), 7, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          if (Math.random() < .06) G.parts.push({ x: x + rr(-4, 4), y: y - rr(4, 12), vx: rr(-3, 3), vy: -rr(8, 18), life: rr(.6, 1.1), max: 1.1, col: pick(['#c8a8ff', '#f0e8ff']), star: rr(.5, 1.2), drag: 1 }); } } });
      addLight(L, x, y - 6, done ? 10 : 22, 3); }
    else if (o.k === 'statue') { const sp = statueArt(d.style === 'crypt' ? 'hood' : 'garg', R);
      list.push({ y, f: () => { drawShadow(x, y + 1, 20); drawArtSprite(sp, x, y + 2);
        if (!done) { const eyY = y + 2 - 124 * HK + (d.style === 'crypt' ? 42 : 44) * HK, gl = .65 + .35 * Math.sin(G.time * 3 + x);   // 眼睛發紫光
          ctx.globalAlpha = gl; ctx.fillStyle = DCOL; for (const ox of d.style === 'crypt' ? [-2, 1] : [-5, 2]) ctx.fillRect(snapF(x + ox * HK), snapF(eyY), HK * 3, HK * 2); ctx.globalAlpha = 1; } } });
      if (!done) addLight(L, x, y - 30, 14, 3); }
    else if (o.k === 'banner') list.push({ y, f: () => { ctx.save(); ctx.translate(snapF(x), 0); if (o.flip) ctx.scale(-1, 1); drawArtSprite(BANNER, 5 * HK * 2, y + 1); ctx.restore(); } });
    else if (o.k === 'rune') { const art = (o as any).art ||= runeStone(900 + Math.round(x * 7 + y * 3) % 997, RUNE_SLATE, ['#d8b8ff', '#ffffff']);   // 跟野外的符文石同一種石頭，符文發紫光
      list.push({ y, f: () => { drawShadow(x, y + 1, 9); drawArtSprite(art.stone, x, y + 2);
        if (!done) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .75 + .25 * Math.sin(G.time * 2 + x * .1); drawArtSprite(art.glow, x, y + 2); drawArtSprite(art.glow, x, y + 2);   // 打完了 → 符文熄掉，只剩刻痕
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } } });
      if (!done) addLight(L, x, y - 8, 16, 3); }
    else { const sp = o.k === 'skull' ? SKULL : o.k === 'bones' ? BONES : SWORD;
      list.push({ y: y - 4, f: () => { if (o.flip) { ctx.save(); ctx.translate(snapF(x), 0); ctx.scale(-1, 1); drawArtSprite(sp, 0, y + 1); ctx.restore(); } else drawArtSprite(sp, x, y + 1); } }); }
  }
}

export function drawDoors(vis, list, L, addLight) {
  for (const d of DUNGEONS) {
    const ex = d.ent[0] * TS + 8, ey = (d.ent[1] + 1) * TS - 1, done = dungeonHooks.cleared(d);   // 打完了：洞口變回普通的洞口（沒有白霧、白光、白色光點），一看就知道「這裡來過了」
    if (d.stairs && done) { /* 石階本身畫在地圖格子上，什麼都不加 */ }
    else if (d.stairs) { const sx = ex, sy = d.ent[1] * TS + 8; if (vis(sx, sy, 60)) { addLight(L, sx, sy, 28 + Math.sin(G.time * 3) * 2, 5);   // 地底遺跡的石階：格子已經畫好了，加白光 + 往上飄的白色光點
      list.push({ y: sy + 8, f: () => { ctx.globalAlpha = .22 + .08 * Math.sin(G.time * 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(snapF(sx - 7), snapF(sy - 8), 14, 16); ctx.globalAlpha = 1;
        if (Math.random() < .5) G.parts.push({ x: sx + rr(-7, 7), y: sy + rr(-6, 8), vx: rr(-4, 4), vy: -rr(8, 24), life: rr(.8, 1.5), max: 1.5, col: pick(['#ffffff', '#e8eeff']), star: rr(.4, 1.2), drag: 1 }); } }); } }
    if (!d.stairs) drawDeco(d, vis, list, L, addLight, done);                                       // 前院：石板地、雕像、破旗、符文石……
    if (!d.stairs && (vis(ex, ey, 60) || vis(ex, ey - 110, 90))) {
      const crypt = d.style === 'crypt', sp = crypt ? CRYPT_SP : CAVE_SP, r = regAtT(d.ent[0], d.ent[1]);
      const mon = monument(crypt ? STONE5 : (SRAMP.rock[r] || STONE5), r), mx = ex, my = ey - 40;                              // 石像站在岩丘上、洞口正上方（排在洞口後面）
      const bx = mx + (MON_TOP[0] - MON_W / 2) * HK, by = my - (MON_H - MON_TOP[1]) * HK;                                  // 光柱冒出來的地方：王冠正上方
      list.push({ y: my, f: () => { drawArtSprite(mon, mx, my); if (!done) beacon(bx, by, d.ent[0]); } });
      if (!done) addLight(L, bx, by, 40 + Math.sin(G.time * 2) * 4, 3);
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
    if (d.exX !== undefined && vis(d.exX, d.exY, 60)) exitGate(d, d.exX, d.exY + 4, 1, list, L, addLight);   // 出口：跟外面的入口同一種霧門
    if (d.portal && vis(d.portal[0], d.portal[1], 60) && dungeonHooks.cleared(d)) { const [px, py] = d.portal;   // Boss 倒下 → 大廳中央升起一座霧門
      if (!portalT.has(d.id)) { portalT.set(d.id, G.time); for (let i = 0; i < 30; i++) G.parts.push({ x: px + rr(-3, 3), y: py - 8 + rr(-3, 3), vx: rr(-60, 60), vy: rr(-60, 60), life: rr(.4, .8), max: .8, col: pick(['#ffffff', '#eef2ff', '#c8c8d8']), star: rr(.8, 2), drag: 3 }); }
      exitGate(d, px, py + 4, Math.max(0, Math.min(1, (G.time - portalT.get(d.id)) / 1.2)), list, L, addLight); }   // 0 → 1：1.2 秒內從地上升起來
  }
}
