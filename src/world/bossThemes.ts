/* ================= 每隻 Boss 自己的攻擊特效 =================
   地城 Boss 都用同一套招式庫（world/bossAI3.ts），以前每一隻的子彈、落石、橫掃長得都一樣，只換顏色 → 很單調。
   這裡幫每一隻配一組「主題」：子彈長什麼樣、天上掉下來的是什麼、橫掃 / 鞭打 / 地上的一灘長怎樣、撞擊時噴出什麼。
   畫法在 render/bossFx.ts。

   區域 Boss 沿用主線 Boss 的招式（冰霜飛龍 = 熔岩巨龍的招式），以前連特效顏色也一起沿用 → 冰霜飛龍會噴火。
   REGION_FX：把那隻 Boss 放出來的特效全部換色（跟以前圖的換色同一套），必要時把子彈換成另一種外觀。 */
import { G } from '../core/state';
import { pick, rr } from '../core/util';

export interface Theme {
  cols?: string[];       // 特效顏色（暗 / 中 / 亮），沒寫就用 Boss 的 cols
  proj: string;          // 扇射 / 環射的子彈外觀（render/bossFx.ts 的 drawBossProj）
  rain: string;          // 落雷 / 落石：天上掉下來的東西（meteor icicle sword star drop web spore）或從地上冒出來的（pillar spike）
  rainCols?: string[];
  impact: string;        // 砸地、跳壓、落下時噴出的碎片（BURST 的名字）
  sweep: 'blade' | 'claw' | 'whip' | 'wave';
  lash: 'tongue' | 'tail' | 'chain' | 'beam' | 'firewhip' | 'vine';
  pool: 'slime' | 'web' | 'sand' | 'lava' | 'water' | 'poison';
  trail: string;         // 衝撞時身後揚起的東西（BURST 的名字）
}
const GHOST = ['#1a3a7a', '#4aa8ff', '#e0f4ff'], ICE = ['#2a4a78', '#a8dcff', '#ffffff'], STEEL = ['#3a3a4e', '#a8a8c0', '#ffffff'];
export const THEME: Record<string, Theme> = {
  snail:       { proj: 'sporeG', rain: 'spore', impact: 'moss', sweep: 'wave', lash: 'vine', pool: 'slime', trail: 'moss' },
  warden:      { cols: GHOST, proj: 'wisp', rain: 'pillar', impact: 'ghost', sweep: 'blade', lash: 'chain', pool: 'water', trail: 'ghost' },
  tidecrab:    { proj: 'bubble', rain: 'pillar', impact: 'splash', sweep: 'claw', lash: 'beam', pool: 'water', trail: 'splash' },
  broodmother: { proj: 'web', rain: 'web', impact: 'web', sweep: 'claw', lash: 'beam', pool: 'web', trail: 'dust' },
  rootheart:   { cols: ['#3a2a14', '#6aa84a', '#d0f0a0'], proj: 'thorn', rain: 'spike', rainCols: ['#3a2a14', '#86643e', '#c8a878'], impact: 'leaves', sweep: 'whip', lash: 'vine', pool: 'slime', trail: 'leaves' },
  scorpion:    { proj: 'venom', rain: 'spike', impact: 'dust', sweep: 'claw', lash: 'tail', pool: 'sand', trail: 'dust' },
  sandking:    { proj: 'scarab', rain: 'pillar', rainCols: ['#6a4a2a', '#d8b878', '#fff0c8'], impact: 'dust', sweep: 'wave', lash: 'beam', pool: 'sand', trail: 'dust' },
  captain:     { cols: ['#5a0e14', '#e04a3a', '#ffd0a0'], proj: 'lantern', rain: 'sword', rainCols: STEEL, impact: 'sparks', sweep: 'blade', lash: 'beam', pool: 'lava', trail: 'sparks' },
  salamander:  { proj: 'flame', rain: 'meteor', impact: 'lava', sweep: 'whip', lash: 'firewhip', pool: 'lava', trail: 'sparks' },
  magmaworm:   { proj: 'magma', rain: 'pillar', impact: 'lava', sweep: 'wave', lash: 'firewhip', pool: 'lava', trail: 'lava' },
  icequeen:    { proj: 'icicle', rain: 'icicle', impact: 'ice', sweep: 'wave', lash: 'beam', pool: 'water', trail: 'ice' },
  frostknight: { cols: ICE, proj: 'frostwave', rain: 'sword', rainCols: ICE, impact: 'ice', sweep: 'blade', lash: 'beam', pool: 'water', trail: 'ice' },
  toadking:    { proj: 'poison', rain: 'drop', impact: 'poison', sweep: 'wave', lash: 'tongue', pool: 'poison', trail: 'poison' },
  drowned:     { proj: 'drop', rain: 'pillar', impact: 'splash', sweep: 'wave', lash: 'chain', pool: 'water', trail: 'splash' },
  forgeguard:  { proj: 'cinder', rain: 'meteor', rainCols: ['#2a2024', '#f07a32', '#ffe38a'], impact: 'sparks', sweep: 'blade', lash: 'firewhip', pool: 'lava', trail: 'sparks' },
  starwarden:  { proj: 'star', rain: 'star', rainCols: ['#7a4a1a', '#f2c14e', '#fff6d0'], impact: 'stars', sweep: 'wave', lash: 'beam', pool: 'water', trail: 'stars' },
};

/* ---- 噴出來的碎片 ---- n = 數量；sp = 往外的速度；up = 往上的速度；g = 重力；star = 用四芒星畫 */
const BURST: Record<string, { cols: string[]; sp: [number, number]; up: [number, number]; g: number; life: number; s?: number; star?: boolean; drag?: number }> = {
  moss:   { cols: ['#2a4a1a', '#5a8a2e', '#9ad060', '#d0ff9a'], sp: [30, 90], up: [40, 110], g: 300, life: .6, s: 2 },
  splash: { cols: ['#2a6aa8', '#6ac0f0', '#d8f4ff', '#ffffff'], sp: [40, 110], up: [80, 170], g: 420, life: .55, s: 1 },
  web:    { cols: ['#c8c8d8', '#ffffff', '#e8e8f4'], sp: [50, 120], up: [10, 50], g: 60, life: .5, star: true, drag: 3 },
  leaves: { cols: ['#3a6a2a', '#6aa84a', '#a8d070', '#86643e'], sp: [30, 80], up: [40, 100], g: 90, life: 1, s: 2, drag: 1.5 },
  dust:   { cols: ['#8a6a3a', '#c8a060', '#e8d0a0'], sp: [40, 110], up: [10, 50], g: 40, life: .7, s: 2, drag: 2 },
  sparks: { cols: ['#ff6a2a', '#ffb040', '#ffe38a', '#ffffff'], sp: [80, 200], up: [40, 140], g: 360, life: .45, star: true, drag: 1 },
  lava:   { cols: ['#5a1408', '#c8401e', '#f07a32', '#ffd04a'], sp: [30, 100], up: [80, 180], g: 420, life: .7, s: 2 },
  ice:    { cols: ['#4a7ab8', '#a8dcff', '#e8f8ff', '#ffffff'], sp: [50, 130], up: [50, 140], g: 400, life: .55, s: 2 },
  poison: { cols: ['#2a5a1a', '#6ac83a', '#b8f070', '#c46ad8'], sp: [20, 70], up: [20, 60], g: -30, life: .8, s: 2, drag: 1 },
  ghost:  { cols: ['#2a5aa8', '#4aa8ff', '#a8dcff', '#e0f4ff'], sp: [10, 40], up: [30, 70], g: -40, life: .8, star: true, drag: 1 },
  stars:  { cols: ['#9a7cff', '#c8b0ff', '#ffe38a', '#ffffff'], sp: [40, 120], up: [20, 80], g: 60, life: .7, star: true, drag: 2 },
};
export function burst(x: number, y: number, name: string, n: number) {
  const B = BURST[name]; if (!B) return;
  for (let i = 0; i < n; i++) { const a = rr(0, Math.PI * 2), sp = rr(B.sp[0], B.sp[1]);
    G.parts.push({ x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .5 - rr(B.up[0], B.up[1]), life: rr(B.life * .6, B.life), max: B.life,
      col: pick(B.cols), s: B.s, star: B.star ? rr(.8, 2) : undefined, g: B.g, drag: B.drag }); }
}
/** 身後揚起一點點（衝撞時每幀呼叫） */
export function trail(x: number, y: number, name: string) {
  const B = BURST[name]; if (!B || Math.random() > .7) return;
  G.parts.push({ x: x + rr(-6, 6), y: y + rr(-3, 2), vx: rr(-15, 15), vy: -rr(5, 25), life: B.life * .7, max: B.life * .7, col: pick(B.cols), s: B.s, star: B.star ? rr(.6, 1.4) : undefined, g: B.g * .2, drag: 2 });
}

/* ================= 區域 Boss：把沿用來的特效換色 ================= */
type HSL = [number, number, number];
const toward = (h: number, target: number, k: number) => { const d = ((target - h + 540) % 360) - 180; return h + d * k; };
const keepGold = (h: number, s: number) => h > 30 && h < 70 && s > .5;
export const REGION_FX: Record<string, { hue: (c: HSL) => HSL; proj?: Record<string, string> }> = {
  mossguard:  { hue: ([h, s, l]) => [toward(h, 105, .85), s * .8, l] },                                         // 古哨堡的守衛：青苔綠
  mistwitch:  { hue: ([h, s, l]) => [toward(h, 205, .9), s * .5, Math.min(1, l * 1.08)], proj: { glob: 'wisp' } },   // 霧林女妖：灰藍色的霧，毒彈 → 鬼火
  sandgiant:  { hue: ([h, s, l]) => [toward(h, 38, 1), Math.max(s, .35) * .9, l * .9] },                         // 沙暴巨人：冰錐 → 沙刃
  slagmother: { hue: ([h, s, l]) => [keepGold(h, s) ? h : toward(h, 18, 1), Math.max(s, .6), l], proj: { glob: 'magma' } },   // 熔渣母體：酸液 → 熔岩
  frostwyrm:  { hue: ([h, s, l]) => [toward(h, 205, 1), s * .75, Math.min(1, l * 1.2 + .08)], proj: { ember: 'icicle' } },  // 冰霜飛龍：火 → 冰
  toxqueen:   { hue: ([h, s, l]) => [keepGold(h, s) ? h : toward(h, 285, .9), s, l] },                         // 毒菇母后：紫色的毒
};
function hexToHsl(hex: string): HSL | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return null; const v = parseInt(m[1], 16), r = (v >> 16) / 255, g = (v >> 8 & 255) / 255, b = (v & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function hslToHex([H, S, L]: HSL) {
  const h = ((H % 360) + 360) % 360 / 360, s = Math.max(0, Math.min(1, S)), l = Math.max(0, Math.min(1, L));
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return '#' + [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
const CACHE: Record<string, Record<string, string>> = {};
/** 把一個顏色照這隻區域 Boss 的主題換色（很暗、接近黑的不換） */
export function rmap(id: string, hex: string): string {
  const R = REGION_FX[id]; if (!R || typeof hex !== 'string') return hex;
  const C = CACHE[id] || (CACHE[id] = {}); if (C[hex]) return C[hex];
  const hsl = hexToHsl(hex); return C[hex] = !hsl || hsl[2] < .06 || (hsl[1] < .05 && hsl[2] > .95) ? hex : hslToHex(R.hue(hsl));
}
export const rmapCols = (id: string, cols: string[]) => cols.map(c => rmap(id, c));

/* 這些東西原本是寫死的顏色（畫的時候才決定），換色時要先補上 cols */
export const DEFAULT_COLS: Record<string, string[]> = {
  ember: ['#7a1a08', '#f07a32', '#ffe38a'], glob: ['#1d5a32', '#4fbf5a', '#c8ffc0'], bolt: ['#6a4ad0', '#b49cff', '#ffffff'], spore: ['#5a1a6a', '#c46ad8', '#f0c8ff'],
  meteor: ['#5a1408', '#f07a32', '#ffe38a'], spike: ['#5e584c', '#e2dcc8', '#fffaf0'], quake: ['#e8743b', '#1a0e0a', '#ffb040'], fire: ['#c8401e', '#f08a2e', '#ffd04a', '#fff6d0'],
};
/** 區域 Boss 這一幀新放出來的特效 / 碎片 / 子彈 / 毒池，全部換色（f0 / p0 / j0 = AI 跑之前的數量） */
export function recolorNew(e, f0: number, p0: number, j0: number) {
  const id = e.def.id, R = REGION_FX[id]; if (!R) return;
  for (let i = f0; i < G.fx.length; i++) { const f = G.fx[i];
    if (f.k === 'rghost') continue;
    if (!f.cols && DEFAULT_COLS[f.k]) f.cols = DEFAULT_COLS[f.k];
    if (f.col) f.col = rmap(id, f.col); if (f.cols) f.cols = rmapCols(id, f.cols); }
  for (let i = p0; i < G.parts.length; i++) G.parts[i].col = rmap(id, G.parts[i].col);
  for (let i = j0; i < G.projs.length; i++) { const p = G.projs[i]; if (p.owner !== 'e' || p.themed) continue; p.themed = true;
    if (!p.cols && DEFAULT_COLS[p.kind]) p.cols = DEFAULT_COLS[p.kind]; if (p.cols) p.cols = rmapCols(id, p.cols);
    if (R.proj && R.proj[p.kind]) p.kind = R.proj[p.kind]; }
  for (const pool of e.pools || []) if (!pool.themed) { pool.themed = true; pool.cols = rmapCols(id, pool.cols); }
}

/* ---- Boss 專屬子彈的拖尾（每幀、每顆子彈呼叫一次） ---- */
const PT: Record<string, { cols: string[]; ch: number; up?: number; star?: boolean; g?: number }> = {
  sporeG: { cols: ['#6ad08a', '#e0ffd0'], ch: .35, up: 8, star: true }, wisp: { cols: ['#4aa8ff', '#e0f4ff'], ch: .6, up: 20 }, lantern: { cols: ['#e04a3a', '#ffd0a0'], ch: .5, up: 20 },
  flame: { cols: ['#f07a32', '#ffe38a', '#5a5054'], ch: .8, up: 25 }, cinder: { cols: ['#ff8a3a', '#fff6d0'], ch: .7, star: true }, magma: { cols: ['#5a5054', '#ff6a2a'], ch: .5, up: 15 },
  bubble: { cols: ['#8ad0ff', '#ffffff'], ch: .25 }, poison: { cols: ['#7ad04a', '#c46ad8'], ch: .35, g: 40 }, drop: { cols: ['#4fd0c0', '#d8fff8'], ch: .4, g: 80 },
  venom: { cols: ['#e0a030', '#fff0a0'], ch: .4, g: 80 }, icicle: { cols: ['#a8dcff', '#ffffff'], ch: .5, star: true }, frostwave: { cols: ['#a8dcff', '#ffffff'], ch: .6, star: true },
  star: { cols: ['#ffe38a', '#ffffff', '#c8b0ff'], ch: .7, star: true }, snowball: { cols: ['#dce8f4', '#ffffff'], ch: .7, g: 120 }, web: { cols: ['#e8e8f4'], ch: .2 }, thorn: { cols: ['#86643e', '#6aa84a'], ch: .3 }, scarab: { cols: ['#d8b878', '#8a6a3a'], ch: .5, g: 30 },
};
export function projTrail(p) {
  const T = PT[p.kind]; if (!T || Math.random() > T.ch) return;
  const cols = p.cols ? [p.cols[1], p.cols[2]] : T.cols;
  G.parts.push({ x: p.x + rr(-2, 2), y: p.y + rr(-2, 2), vx: -p.vx * .1 + rr(-8, 8), vy: -p.vy * .1 - (T.up || 0), life: .35, max: .35, col: pick(cols), s: T.star ? undefined : 1, star: T.star ? rr(.6, 1.4) : undefined, g: T.g, drag: 2 });
}
