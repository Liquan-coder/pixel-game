/* ================= Boss 專屬的攻擊特效（畫法） =================
   哪隻 Boss 用哪一種：world/bossThemes.ts。全部用細像素（HK）畫，跟其他特效同一種顆粒感。
   - drawBossProj：子彈（鬼火、泡泡、蛛網球、冰錐、星星……）
   - drawFall：落雷 / 落石倒數時，天上正在掉下來的東西
   - drawBossFx：水柱 / 火柱（pillar）、插在地上的劍（stuck）、舌頭 / 尾刺 / 鎖鏈 / 光束 / 火鞭 / 藤蔓（lash）
   - drawPoolDecor：地上那一灘的花紋（蛛網、氣泡、岩漿裂縫、漣漪、流沙） */
import { G } from '../core/state';
import { TAU } from '../core/util';
import { HK, ctx } from '../core/canvas';
import { artDot, artLine, artPath, drawLance, drawOrb, drawStar, drawWaveP, fillArt } from './fx';
import { addLight } from './enemy';
import { drawSandSpout } from './sand';

const FIRE = ['#7a1a08', '#f07a32', '#ffe38a'], ICE = ['#2a4a78', '#a8dcff', '#ffffff'], GOLD = ['#7a4a1a', '#f2c14e', '#fff6d0'];
const DEF: Record<string, string[]> = {
  sporeG: ['#1e4a2a', '#6ad08a', '#e0ffd0'], wisp: ['#1a3a7a', '#4aa8ff', '#e0f4ff'], bubble: ['#2a6aa8', '#8ad0ff', '#ffffff'], web: ['#8a8a9a', '#e8e8f4', '#ffffff'],
  thorn: ['#3a2a14', '#86643e', '#c8e090'], venom: ['#6a3a08', '#e0a030', '#fff0a0'], scarab: ['#5a3a10', '#c89a3a', '#fff0a8'], lantern: ['#5a0e14', '#e04a3a', '#ffd0a0'],
  flame: FIRE, magma: ['#ff6a2a', '#ffb040', '#ffe38a'], icicle: ICE, frostwave: ICE, poison: ['#2a5a1a', '#7ad04a', '#e0ffb0'], drop: ['#0e3a3a', '#4fd0c0', '#d8fff8'],
  star: GOLD, cinder: ['#7a1a08', '#ff8a3a', '#fff6d0'],
};
const LIGHT: Record<string, [number, number]> = { wisp: [30, 3], lantern: [30, 1], flame: [30, 1], magma: [26, 1], cinder: [26, 1], star: [32, 3], icicle: [22, 2], sporeG: [22, 2], frostwave: [30, 2] };

/* ---- 形狀 ---- */
// 水滴 / 火焰：頭圓、尾巴往後收尖（a = 前進方向）。wob = 尾巴抖動
function teardrop(x: number, y: number, a: number, R: number, tail: number, cols: string[], wob = 0) {
  const c = Math.cos(a), s = Math.sin(a), ext = R + tail + 2;
  fillArt(x - ext, y - ext, x + ext, y + ext, (px, py) => {
    const dx = px - x, dy = py - y, u = dx * c + dy * s, v = -dx * s + dy * c;
    let q: number;
    if (u >= 0) q = Math.hypot(u, v) / R;
    else { if (-u > tail) return 0; const k = -u / tail, w = R * Math.pow(1 - k, .8) * (1 + Math.sin(G.time * 30 + u * .8) * wob * k); if (Math.abs(v) > w) return 0; q = Math.max(Math.abs(v) / Math.max(.01, w), k * 1.1); }
    return q > 1 ? 0 : q > .7 ? 1 : q > .38 ? 2 : 3; }, cols);
}
// 尖刺 / 冰錐：前尖後鈍的菱形（a = 尖端方向）
function shard(x: number, y: number, a: number, L: number, W: number, cols: string[]) {
  const c = Math.cos(a), s = Math.sin(a), ext = L + 2;
  fillArt(x - ext, y - ext, x + ext, y + ext, (px, py) => {
    const dx = px - x, dy = py - y, u = dx * c + dy * s, v = -dx * s + dy * c;
    if (u > L * .6 || u < -L * .4) return 0; const w = u >= 0 ? W * (1 - u / (L * .6)) : W * (1 + u / (L * .4) * .7); if (Math.abs(v) > w) return 0;
    const r = Math.abs(v) / Math.max(.01, w); return v > 0 && r > .35 ? 1 : r > .55 ? 1 : r > .2 ? 2 : 3; }, cols);
}
function bubble(x: number, y: number, R: number, cols: string[]) {
  fillArt(x - R - 1, y - R - 1, x + R + 1, y + R + 1, (px, py) => { const d = Math.hypot(px - x, py - y); if (d > R) return 0;
    if (Math.hypot(px - (x - R * .4), py - (y - R * .4)) < R * .28) return 3; return d > R - HK * 1.6 ? 2 : 1; }, cols, [.35, 1, 1]);
}
function star5(x: number, y: number, R: number, rot: number, cols: string[]) {
  const inner = R * .45;
  fillArt(x - R - 1, y - R - 1, x + R + 1, y + R + 1, (px, py) => { const dx = px - x, dy = py - y, d = Math.hypot(dx, dy);
    const f = ((((Math.atan2(dy, dx) - rot) / (TAU / 5)) % 1) + 1) % 1, edge = inner + (R - inner) * Math.abs(1 - 2 * f); if (d > edge) return 0;
    const q = d / edge; return q > .62 ? 1 : q > .3 ? 2 : 3; }, cols);
}
function webBall(x: number, y: number, R: number, rot: number, cols: string[]) {
  const a0 = ctx.globalAlpha; ctx.fillStyle = cols[1]; artPath();
  for (let i = 0; i < 6; i++) { const a = rot + i * TAU / 6; artLine(x, y, x + Math.cos(a) * R, y + Math.sin(a) * R, 1); }
  for (const rr of [R * .45, R * .85]) for (let i = 0; i < 18; i++) { const a = rot + i * TAU / 18; artDot(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1); }
  ctx.fill(); ctx.fillStyle = cols[2]; artPath(); artDot(x, y, 2); ctx.fill(); ctx.globalAlpha = a0;
}
function rock(x: number, y: number, R: number, glow: string[]) {
  drawOrb(x, y, R, ['#1a1012', '#3a2a2e', '#5e4a4e']);
  ctx.fillStyle = glow[0]; artPath(); for (let i = 0; i < 3; i++) { const a = G.time * 3 + i * 2.1; artLine(x, y, x + Math.cos(a) * R * .8, y + Math.sin(a) * R * .8, 1); } ctx.fill();
  ctx.fillStyle = glow[2]; artPath(); artDot(x, y, 1); ctx.fill();
}
function scarab(x: number, y: number, a: number, R: number, cols: string[]) {
  const c = Math.cos(a), s = Math.sin(a);
  ctx.fillStyle = '#2a1a08'; artPath(); for (const k of [-.5, 0, .5]) for (const sg of [-1, 1]) { const bx = x + c * R * k, by = y + s * R * k; artLine(bx, by, bx - s * sg * R * 1.1, by + c * sg * R * 1.1, 1); } ctx.fill();
  fillArt(x - R - 1, y - R - 1, x + R + 1, y + R + 1, (px, py) => { const dx = px - x, dy = py - y, u = dx * c + dy * s, v = -dx * s + dy * c, q = Math.hypot(u / R, v / (R * .72));
    if (q > 1) return 0; if (Math.abs(v) < HK * .6 && u < R * .3) return 1; return q > .7 ? 1 : q > .35 ? 2 : 3; }, cols);
}
function blade(x: number, y: number, L: number, cols: string[]) {             // 往下插的劍（尖端在 y）
  shard(x, y - L * .55, Math.PI / 2, L, 2.2, cols);
  ctx.fillStyle = '#3a2a14'; artPath(); artLine(x - 5, y - L * .95, x + 5, y - L * .95, 2); artLine(x, y - L * .95, x, y - L * 1.25, 2); ctx.fill();
  ctx.fillStyle = '#f2c14e'; artPath(); artDot(x, y - L * 1.28, 2); ctx.fill();
}

/** 子彈。回傳 true = 畫好了（不是 Boss 專屬的子彈就回傳 false，交給原本的畫法） */
export function drawBossProj(p, L): boolean {
  const D = DEF[p.kind]; if (!D) return false;
  const cols = p.cols || D, a = Math.atan2(p.vy, p.vx), spin = G.time * 9 + (p.x + p.y) * .05;
  switch (p.kind) {
    case 'sporeG': drawOrb(p.x, p.y, 3.6, cols); for (let i = 0; i < 4; i++) { const b = spin + i * TAU / 4; drawStar(p.x + Math.cos(b) * 5, p.y + Math.sin(b) * 4, 1, cols[2]); } break;
    case 'wisp': teardrop(p.x, p.y, a, 4, 9, cols, .35); break;
    case 'lantern': teardrop(p.x, p.y, a, 4, 8, cols, .3); break;
    case 'flame': teardrop(p.x, p.y, a, 4.5, 11, cols, .45); break;
    case 'venom': teardrop(p.x, p.y, a, 3.4, 6, cols); break;
    case 'drop': teardrop(p.x, p.y, a, 3.6, 7, cols); break;
    case 'cinder': teardrop(p.x, p.y, a, 3.4, 9, cols, .2); break;
    case 'bubble': bubble(p.x, p.y, 4.5 + Math.sin(G.time * 12 + p.x) * .5, cols); break;
    case 'poison': bubble(p.x, p.y, 4.5, cols); drawStar(p.x + 1, p.y + 1, 1, '#c46ad8'); break;
    case 'web': webBall(p.x, p.y, 6, spin * .3, cols); break;
    case 'thorn': shard(p.x, p.y, a, 13, 2.6, cols); break;
    case 'icicle': shard(p.x, p.y, a, 15, 3, cols); break;
    case 'scarab': scarab(p.x, p.y, a, 4.2, cols); break;
    case 'magma': rock(p.x, p.y, 4.6, cols); break;
    case 'star': star5(p.x, p.y, 5.5, spin, cols); break;
    case 'frostwave': drawWaveP({ ...p, cols }); break;
  }
  const lt = LIGHT[p.kind]; if (lt && L) addLight(L, p.x, p.y, lt[0], lt[1]);
  return true;
}

/** 落雷 / 落石倒數中：從天上掉下來的東西（q = 0 → 1，1 = 落地） */
export function drawFall(m, q: number) {
  if (q < .12) return;
  const u = (q - .12) / .88, h = (1 - u) * (1 - u) * 150, x = m.x, y = m.y - 6 - h, cols = m.cols;
  switch (m.fall) {
    case 'meteor': drawOrb(x, y, 5.5, cols); for (let i = 1; i < 4; i++) drawOrb(x + i * 1.5, y - i * 5, 3.6 - i * .8, cols); break;
    case 'icicle': shard(x, y, Math.PI / 2, 20, 3.4, cols); break;
    case 'sword': blade(x, y + 6, 22, cols); break;
    case 'arrow': for (const dx of [-4, 0, 4]) { shard(x + dx, y - (dx ? 6 : 0), Math.PI / 2, 16, 1.6, cols); ctx.fillStyle = '#ffffff'; artPath(); artDot(x + dx - 1, y - 16 - (dx ? 6 : 0), 1); artDot(x + dx + 1, y - 16 - (dx ? 6 : 0), 1); ctx.fill(); } break;   // 箭雨：三支一起落下（白色的箭羽）
    case 'star': star5(x, y, 6, G.time * 6, cols); drawStar(x, y - 9, 2, '#ffffff'); break;
    case 'drop': teardrop(x, y, Math.PI / 2, 4, 9, cols); break;
    case 'web': webBall(x, y, 7, G.time * 2, ['#8a8a9a', '#e8e8f4', '#ffffff']); break;
    case 'spore': drawOrb(x, y, 4, cols); ctx.fillStyle = cols[2]; artPath(); artDot(x - 2, y - 1, 1); artDot(x + 2, y + 1, 1); ctx.fill(); break;
  }
}

/** pillar / stuck / lash。回傳 true = 畫好了 */
export function drawBossFx(f, k: number, L): boolean {
  if (f.k === 'pillar' && f.sand) { drawSandSpout(f, k, L); return true; }   // 沙：一粒粒噴起來再落下（render/sand.ts），不畫成一根黃色的柱子
  if (f.k === 'pillar') {                                                  // 從地上噴出的柱子：水柱、火柱、鬼火
    const up = k < .25 ? k / .25 : 1, fade = k > .55 ? (1 - k) / .45 : 1, H = f.r * 2.4 * up * (.6 + .4 * fade), W = f.r * .5 * (.7 + .3 * fade);
    if (H < 1) return true; const a0 = ctx.globalAlpha; ctx.globalAlpha = Math.min(1, fade * 1.4);
    fillArt(f.x - W - 2, f.y - H - 2, f.x + W + 2, f.y + 2, (px, py) => { const v = (f.y - py) / H; if (v < 0 || v > 1) return 0;
      const w = W * (1 - v * .35) * (1 + Math.sin(py * .6 + G.time * 30) * .12), dx = Math.abs(px - f.x); if (dx > w) return 0; const r = dx / w; return r > .65 ? 1 : r > .25 ? 2 : 3; }, f.cols, [.85, 1, 1]);
    ctx.globalAlpha = a0; if (L) addLight(L, f.x, f.y - H * .5, f.r * 2, f.warm || 2); return true;
  }
  if (f.k === 'stuck') {                                                   // 插在地上的劍，慢慢淡掉
    const a0 = ctx.globalAlpha; ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1; blade(f.x, f.y + 4, 18, f.cols); ctx.globalAlpha = a0; return true;
  }
  if (f.k === 'lash') { drawLash(f, k, L); return true; }
  return false;
}
function drawLash(f, k: number, L) {
  const ext = k < .3 ? 1 - (1 - k / .3) ** 2 : k > .65 ? 1 - (k - .65) / .35 : 1, len = f.L * ext, c = Math.cos(f.a), s = Math.sin(f.a);
  if (len < 2) return;
  const at = (t: number, off = 0) => [f.x + c * t - s * off, f.y + s * t + c * off];
  const a0 = ctx.globalAlpha; ctx.globalAlpha = 1;
  switch (f.style) {
    case 'tongue': { const C = ['#7a1a3a', '#e05a7a', '#ffb0c8'];
      for (const [w, col] of [[9, '#2a0a14'], [7, C[0]], [4.5, C[1]], [1.6, C[2]]] as const) { ctx.fillStyle = col; artPath(); for (let t = 4; t < len; t += HK) { const [x, y] = at(t, Math.sin(t * .15) * 1.5); artDot(x, y, w); } ctx.fill(); }
      const [tx, ty] = at(len); drawOrb(tx, ty, 6, ['#2a0a14', C[1], C[2]]); break; }
    case 'tail': { const n = 7;                                                   // 一節一節的尾巴 + 尾刺
      for (let i = 0; i < n; i++) { const t = len * (i + 1) / (n + 1), [x, y] = at(t, Math.sin(i * 1.3) * 1.2); drawOrb(x, y, 4 - i * .3, ['#5a3a10', '#c8902e', '#f0d080']); }
      const [tx, ty] = at(len); shard(tx, ty, f.a, 12, 3, ['#3a1a08', '#e0a030', '#fff0a0']); break; }
    case 'chain': for (const [w, col] of [[3, '#14141c'], [1.4, '#b8b8cc']] as const) { ctx.fillStyle = col; artPath();   // 鎖鏈：一圈一圈的環 + 前端的鐵球
      for (let t = 6, i = 0; t < len - 4; t += 5, i++) { const [x, y] = at(t); for (let j = 0; j < 10; j++) { const b = j * TAU / 10; artDot(x + Math.cos(b) * 2.6, y + Math.sin(b) * (i % 2 ? 1.3 : 2.6), w); } }
      ctx.fill(); } { const [tx, ty] = at(len); drawOrb(tx, ty, 5.5, ['#1a1a24', '#6a6a7e', '#d0d0e4']); } break;
    case 'beam': drawLance({ x: f.x, y: f.y, a: f.a, len: f.L, w: f.W * 1.4, t: f.t, d: f.d, cols: f.cols }); break;
    case 'firewhip': case 'vine': {
      const C = f.style === 'vine' ? ['#1e3a14', '#4a8a2e', '#a8e070'] : FIRE;
      for (const [w, col] of [[7, C[0]], [4.2, C[1]], [1.6, C[2]]] as const) { ctx.fillStyle = col; artPath();
        for (let t = 4; t < len; t += HK) { const [x, y] = at(t, Math.sin(t * .22 - G.time * 24) * 3 * (t / len)); artDot(x, y, w); } ctx.fill(); }
      if (f.style === 'vine') { ctx.fillStyle = '#86c45a'; artPath(); for (let t = 10; t < len; t += 12) { const [x, y] = at(t, (t % 24 ? 3 : -3)); artDot(x, y, 2); } ctx.fill(); }
      else if (L) for (let t = 20; t < len; t += 30) { const [x, y] = at(t); addLight(L, x, y, 26, 1); }
      break; }
  }
  ctx.globalAlpha = a0;
}

/** 地上那一灘的花紋（drawPools 畫完底色之後呼叫）。k = 淡入淡出 */
export function drawPoolDecor(p, k: number) {
  const st = p.style; if (!st) return;
  const a0 = ctx.globalAlpha, seed = (p.x * 7 + p.y * 13) % 100, ry = p.r * .7;
  ctx.globalAlpha = .8 * k;
  if (st === 'web') { ctx.fillStyle = '#e8e8f4'; artPath();
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + seed; artLine(p.x, p.y, p.x + Math.cos(a) * p.r * .95, p.y + Math.sin(a) * ry * .95, 1); }
    for (const f of [.35, .65, .92]) for (let i = 0; i < 40; i++) { const a = i * TAU / 40; artDot(p.x + Math.cos(a) * p.r * f, p.y + Math.sin(a) * ry * f, 1); }
    ctx.fill(); }
  else if (st === 'water' || st === 'sand') {                                     // 漣漪 / 流沙：一圈一圈往外（流沙往內）
    ctx.fillStyle = st === 'water' ? '#d8f4ff' : '#e8d0a0'; artPath();
    for (let j = 0; j < 3; j++) { let f = ((G.time * .5 + j / 3) % 1); if (st === 'sand') f = 1 - f;
      for (let i = 0; i < 36; i++) { const a = i * TAU / 36 + (st === 'sand' ? G.time * 1.5 + f * 3 : 0); if (st === 'sand' && i % 3) continue; artDot(p.x + Math.cos(a) * p.r * f, p.y + Math.sin(a) * ry * f, 1); } }
    ctx.fill(); }
  else if (st === 'lava') {                                                        // 岩漿裂縫：會一明一暗
    ctx.globalAlpha = (.55 + .35 * Math.sin(G.time * 5 + seed)) * k; ctx.fillStyle = '#ffd04a'; artPath();
    for (let i = 0; i < 5; i++) { const a = seed + i * 1.3, l = p.r * (.5 + (i % 3) * .15); artLine(p.x, p.y, p.x + Math.cos(a) * l, p.y + Math.sin(a) * l * .7, 1); } ctx.fill(); }
  else if (st === 'poison' || st === 'slime') {                                    // 氣泡：冒出來、變大、破掉
    const col = st === 'poison' ? '#b8f070' : '#d0ffd0';
    for (let i = 0; i < 5; i++) { const ph = (G.time * .8 + i * .37 + seed * .01) % 1, a = seed + i * 2.4, rr = p.r * .6 * ((i * 37) % 10) / 10;
      const bx = p.x + Math.cos(a) * rr, by = p.y + Math.sin(a) * rr * .7, R = 1 + ph * 2.5;
      ctx.fillStyle = col; artPath(); for (let j = 0; j < 8; j++) { const b = j * TAU / 8; artDot(bx + Math.cos(b) * R, by + Math.sin(b) * R, 1); } ctx.fill(); } }
  ctx.globalAlpha = a0;
}
