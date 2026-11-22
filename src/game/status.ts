/* ================= 玩家身上的異常狀態 =================
   怪物 / Boss 打中你的時候，除了扣血，還可能讓你中這些狀態：

   累積型（像艾爾登法環：被打中會累積，滿了才發作；不被打就慢慢退掉）
     frost 凍傷 → 滿 100：冰凍，整個人被冰塊包住 1.1 秒不能動（狂按攻擊 / 瞬移可以提早掙脫）+ 扣 8% 生命
     bleed 出血 → 滿 100：一口氣扣 15% 生命
   持續型（中了就持續幾秒，再被打中會重新計時）
     poison 中毒：每秒扣 1.2% 生命        burn 燃燒：每秒扣 3% 生命（瞬移可以把火滾掉一半）
     stun   暈眩：頭上轉星星，不能動也不能出手（暈完有 1.5 秒不會再被暈，不會被連續暈死）
     slow   緩速：走路變慢             root  纏繞：腳被纏住不能走、不能瞬移（狂按可以提早掙脫），但可以攻擊
     silence 封印：不能用技能           blind 目盲：畫面周圍變暗，只看得到身邊

   用法：hurtPlayer(pl, 傷害, x, y, { frost: 30, stun: .5 }) —— 這一下有打中（不是無敵時間）才會中狀態。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { toast } from '../ui/hud';
import type { Player } from '../types';
import { drawIceCrystal, iceShatter } from '../art/iceCrystal';
import { rageFrac } from './builds';
import { BUILD_DECAY, BUILD_HOLD } from '../data/ailments';

export interface FX { frost?: number; bleed?: number; poison?: number; burn?: number; stun?: number; slow?: number; root?: number; silence?: number; blind?: number }
export interface Status { iceAt?: number; iceOn?: boolean; frost: number; bleed: number; frozen: number; stun: number; stunImm: number; rootImm: number; slow: number; poison: number; burn: number; root: number; silence: number; blind: number; hold: number; dot: number; dotT: number }
const fresh = (): Status => ({ frost: 0, bleed: 0, frozen: 0, stun: 0, stunImm: 0, rootImm: 0, slow: 0, poison: 0, burn: 0, root: 0, silence: 0, blind: 0, hold: 0, dot: 0, dotT: 0 });
export const sx = (pl: Player): Status => pl.sx || (pl.sx = fresh());
export function clearStatus(pl: Player) { pl.sx = fresh(); }

/* 名字和顏色：HUD 的狀態列、中狀態時的提示都用這個 */
export const SNAME: Record<string, [string, string]> = {
  frozen: ['冰凍', '#a8dcff'], frost: ['凍傷', '#a8dcff'], bleed: ['出血', '#ff5a5a'], poison: ['中毒', '#8ae05a'], burn: ['燃燒', '#ff9a3a'],
  stun: ['暈眩', '#ffe38a'], slow: ['緩速', '#7ab8e8'], root: ['纏繞', '#a8c870'], silence: ['封印', '#c8a8ff'], blind: ['目盲', '#b8a888'] };
function announce(pl: Player, k: string) { if (pl !== G.me) return; const [n, c] = SNAME[k]; toast(n + '！', c); }

/* 被打中時呼叫（hurtPlayer 裡面）。dmgDone = 這一下實際扣的血 */
export function applyFx(pl: Player, f: FX | undefined) {
  if (!f || pl.dead) return; const S = sx(pl);
  if (f.frost && S.frozen <= 0) { S.frost += f.frost; S.hold = BUILD_HOLD;
    if (S.frost >= 100) { S.frost = 0; S.frozen = 1.1; S.iceAt = G.time; pl.hp -= Math.max(1, Math.round(pl.maxHp * .08)); announce(pl, 'frozen'); sfx.hurt();
      for (let i = 0; i < 16; i++) { const a = rr(0, TAU), v = rr(30, 90); G.parts.push({ x: pl.x, y: pl.y - 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .6 - 20, life: rr(.4, .8), max: .8, col: pick(['#ffffff', '#d8f0ff', '#a8dcff']), star: rr(.6, 1.6), drag: 3 }); } } }
  if (f.bleed) { S.bleed += f.bleed; S.hold = BUILD_HOLD;
    if (S.bleed >= 100) { S.bleed = 0; const v = Math.max(1, Math.round(pl.maxHp * .15)); pl.hp -= v; announce(pl, 'bleed');
      G.nums.push({ x: pl.x, y: pl.y - 34, txt: String(v), col: '#ff3a4a', t: 0, d: .9, big: true });
      for (let i = 0; i < 22; i++) { const a = rr(-Math.PI, 0), s = rr(40, 130); G.parts.push({ x: pl.x, y: pl.y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(.3, .7), max: .7, col: pick(['#c01020', '#ff3a4a', '#7a0810']), s: 1, g: 300 }); } } }
  const timed = (k: 'poison' | 'burn' | 'slow' | 'silence' | 'blind') => { const v = f[k]; if (!v) return; if (S[k] <= 0) announce(pl, k); S[k] = Math.max(S[k], v); };
  timed('poison'); timed('burn'); timed('slow'); timed('silence'); timed('blind');
  if (f.stun && S.stunImm <= 0 && S.frozen <= 0) { S.stun = f.stun; S.stunImm = f.stun + 1.5; announce(pl, 'stun'); }
  if (f.root && S.rootImm <= 0) { S.root = f.root; S.rootImm = f.root + 2; announce(pl, 'root'); }
  if (pl.hp <= 0) pl.hp = 0;
}

/* 每幀：計時、累積值慢慢退掉、中毒 / 燃燒扣血。回傳 true = 這一幀被毒 / 火燒死了 */
export function tickStatus(pl: Player, dt: number): boolean {
  const S = pl.sx; if (!S) return false;
  for (const k of ['frozen', 'stun', 'stunImm', 'rootImm', 'slow', 'poison', 'burn', 'root', 'silence', 'blind'] as const) if (S[k] > 0) S[k] = Math.max(0, S[k] - dt);
  if (S.hold > 0) S.hold -= dt; else { S.frost = Math.max(0, S.frost - BUILD_DECAY * dt); S.bleed = Math.max(0, S.bleed - BUILD_DECAY * dt); }
  const rate = (S.poison > 0 ? .012 : 0) + (S.burn > 0 ? .03 : 0);
  if (rate > 0) { S.dot += pl.maxHp * rate * dt; S.dotT += dt;
    if (S.dotT >= .5) { S.dotT = 0; const v = Math.floor(S.dot); if (v >= 1) { S.dot -= v; pl.hp -= v;
      G.nums.push({ x: pl.x + rr(-4, 4), y: pl.y - 26, txt: String(v), col: S.burn > 0 ? '#ff9a3a' : '#8ae05a', t: 0, d: .7 }); } } }
  else { S.dot = 0; S.dotT = 0; }
  if (S.burn > 0 && Math.random() < .5) G.parts.push({ x: pl.x + rr(-5, 5), y: pl.y - rr(2, 16), vx: rr(-6, 6), vy: -rr(20, 45), life: rr(.25, .5), max: .5, col: pick(['#ffe38a', '#ff9a3a', '#e8432b']), s: 1 });
  if (S.poison > 0 && Math.random() < .2) G.parts.push({ x: pl.x + rr(-5, 5), y: pl.y - rr(4, 14), vx: 0, vy: -rr(8, 16), life: .6, max: .6, col: pick(['#8ae05a', '#4fbf5a', '#c8ffc0']), s: 1 });
  return pl.hp <= 0 && !pl.dead;
}

export const locked = (pl: Player) => !!pl.sx && (pl.sx.frozen > 0 || pl.sx.stun > 0);       // 冰凍 / 暈眩：完全不能動
export const rooted = (pl: Player) => !!pl.sx && pl.sx.root > 0;                                // 纏繞：不能走、不能瞬移
export const silenced = (pl: Player) => !!pl.sx && pl.sx.silence > 0;
export const moveMul = (pl: Player) => pl.sx && pl.sx.slow > 0 ? .55 : 1;
/* 被冰住 / 纏住時狂按：每按一下少 0.15 秒 */
export function struggle(pl: Player) { const S = pl.sx; if (!S) return;
  if (S.frozen > 0) { S.frozen = Math.max(0, S.frozen - .15); for (let i = 0; i < 4; i++) G.parts.push({ x: pl.x + rr(-7, 7), y: pl.y - rr(2, 18), vx: rr(-50, 50), vy: -rr(20, 70), life: .4, max: .4, col: pick(['#ffffff', '#d8f0ff']), s: 1, g: 300 }); }
  else if (S.root > 0) { S.root = Math.max(0, S.root - .15); for (let i = 0; i < 3; i++) G.parts.push({ x: pl.x + rr(-6, 6), y: pl.y - rr(0, 4), vx: rr(-40, 40), vy: -rr(20, 50), life: .35, max: .35, col: pick(['#a8c870', '#6a8a3a']), s: 1, g: 300 }); }
}
/* 瞬移：把身上的火滾掉一半 */
export function rollOut(pl: Player) { const S = pl.sx; if (S && S.burn > 0) S.burn *= .5; }

/* ---- 畫在角色身上（角色畫完之後呼叫） ---- */
export function drawStatus(pl: Player) {
  const S = pl.sx; if (!S || pl.dead) return; const x = pl.x, y = pl.y, t = G.time;
  if (S.root > 0) { ctx.fillStyle = '#4a6a2a'; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + t * .5, px = x + Math.cos(a) * 6, py = y - 1 + Math.sin(a) * 2;   // 腳邊纏上來的藤蔓
      ctx.fillRect(snapF(px - HK), snapF(py - 6), HK * 2, 7); ctx.fillStyle = k % 2 ? '#a8c870' : '#4a6a2a'; ctx.fillRect(snapF(px - HK * 2), snapF(py - 6 + Math.sin(t * 3 + k) * 1.5), HK * 2, HK * 2); } }
  if (S.slow > 0 && S.frozen <= 0) { ctx.globalAlpha = .35; ctx.fillStyle = '#7ab8e8'; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y), 9, 3, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }   // 腳下一圈冷光
  if (S.frozen > 0) { drawIceCrystal(x, y + 2, G.time - (S.iceAt || 0), S.frozen); S.iceOn = true; }   // 冰晶（art/iceCrystal.ts）
  else if (S.iceOn) { S.iceOn = false; iceShatter(x, y + 2); sfx.iceBreak(); }                                  // 解凍：碎掉
  if (S.stun > 0) for (let k = 0; k < 3; k++) { const a = t * 6 + k / 3 * TAU, px = x + Math.cos(a) * 8, py = y - 30 + Math.sin(a) * 2.5;   // 頭上轉圈的星星
    ctx.fillStyle = '#ffe38a'; ctx.fillRect(snapF(px - HK), snapF(py - HK * 3), HK * 2, HK * 6); ctx.fillRect(snapF(px - HK * 3), snapF(py - HK), HK * 6, HK * 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(snapF(px - HK), snapF(py - HK), HK * 2, HK * 2); }
  if (S.silence > 0) { const py = y - 32 + Math.sin(t * 3); ctx.fillStyle = '#c8a8ff';                 // 頭上一個紫色的封印「×」
    for (let k = -2; k <= 2; k++) { ctx.fillRect(snapF(x + k * HK * 2 - HK), snapF(py + k * HK * 2 - HK), HK * 2, HK * 2); ctx.fillRect(snapF(x - k * HK * 2 - HK), snapF(py + k * HK * 2 - HK), HK * 2, HK * 2); } }
  // 累積圖示：頭上一個血滴（出血）/ 雪花（凍傷），從下往上變亮，亮到頂就發作。快滿時外框會閃
  const icons: [string, number, number?][] = []; if (S.bleed > 0) icons.push(['bleed', S.bleed / 100]); if (S.frost > 0) icons.push(['frost', S.frost / 100]);
  if (pl.rage > 0) icons.push(['rage', rageFrac(pl), 2]);              // 反傷流的怒氣
  buildRow(icons, x, y - 29);
}
/* 累積圖示的形狀（x = 有顏色的格子，外框自動加）和顏色：亮 / 反光 / 暗（還沒累積的部分）
   怪物身上的刻印累積也用同一套（render/enemy.ts）：burn = 燃燒還剩幾秒 */
export const BUILD: Record<string, { rows: string[]; lit: string; hi: string; dark: string; hx: number; hy: number; pal?: Record<string, string>; dk?: Record<string, string> }> = {
  // 燃燒：照使用者給的火焰參考圖縮成 8 × 10（主火舌 + 右邊小火舌 + 淡黃色的芯），多色 → 用 pal / dk（每個字母亮 / 暗各一色）
  burn: { lit: '', hi: '', dark: '', hx: -1, hy: -1, rows: [
    '...r....', '..rr....', '..rrr.r.', '.rorr.rr', '.rooorrr', 'rroyyoor', 'royywyor', 'roywwwyr', '.oywwyo.', '..oyyo..'],
    pal: { r: '#e0562a', o: '#f0883a', y: '#f4b648', w: '#fff0a8' }, dk: { r: '#4a2016', o: '#5a2e1c', y: '#644020', w: '#6e5a34' } },
  // 怒氣（反傷流，game/builds.ts）：漫畫的生氣符號（四個角的青筋），怒氣越多越滿
  rage: { lit: '#ff4a3a', hi: '#ffd0a0', dark: '#5a1a14', hx: 1, hy: 1, rows: [
    '.xx..xx.', 'xxx..xxx', 'xx....xx', '........', '........', 'xx....xx', 'xxx..xxx', '.xx..xx.'] },
  // 雷鳴：閃電
  shock: { lit: '#ffe85a', hi: '#ffffff', dark: '#5a4a14', hx: 3, hy: 3, rows: [
    '....xxx', '...xxx.', '..xxx..', '.xxxxxx', '....xx.', '...xx..', '..xx...', '.xx....', '.x.....'] },
  bleed: { lit: '#ff3a4a', hi: '#ffc0c8', dark: '#6a2028', hx: 2, hy: 6, rows: [
    '...x...', '...x...', '..xxx..', '..xxx..', '.xxxxx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..'] },
  frost: { lit: '#a8dcff', hi: '#ffffff', dark: '#34506e', hx: 4, hy: 4, rows: [
    '....x....', '.x..x..x.', '..x.x.x..', '...xxx...', 'xxxxxxxxx', '...xxx...', '..x.x.x..', '.x..x..x.', '....x....'] },
};
const IP = () => HK * 2, IGAP = () => HK * 2;                         // 圖示 1 格 = 2 美術像素；圖示之間空 2 美術像素（HK 會變，每次算）
export function buildIcon(B, cx: number, bottom: number, f: number, t: number, warnAt = .75) {   // warnAt：累積到多少開始閃（燃燒不閃 → 傳 2）
  const P = IP(), H = B.rows.length, W = B.rows[0].length, X = snapF(cx - W * P / 2), Y = snapF(bottom - H * P);
  const litFrom = H - Math.round(H * Math.min(1, f)), warn = f >= warnAt && Math.sin(t * 18) > 0;   // 第幾列以下是亮的
  ctx.fillStyle = warn ? '#ffffff' : '#0e0b14';                                                    // 外框：每一格往四周多 1 美術像素
  B.rows.forEach((r, ry) => { for (let rx = 0; rx < W; rx++) if (r[rx] !== '.') ctx.fillRect(X + rx * P - HK, Y + ry * P - HK, P + HK * 2, P + HK * 2); });
  B.rows.forEach((r, ry) => { for (let rx = 0; rx < W; rx++) { const ch = r[rx]; if (ch === '.') continue;
    ctx.fillStyle = B.pal ? (ry < litFrom ? B.dk[ch] : B.pal[ch]) : ry < litFrom ? B.dark : rx === B.hx && ry === B.hy ? B.hi : B.lit; ctx.fillRect(X + rx * P, Y + ry * P, P, P); } });
}
/* 一排圖示，置中在 cx：[種類, 進度 0~1, 幾成開始閃]。之後狀態變多也是排成一排（主角和怪物共用） */
export function buildRow(list: [string, number, number?][], cx: number, bottom: number) {
  const ws = list.map(([k]) => BUILD[k].rows[0].length * IP()), total = ws.reduce((a, w) => a + w, 0) + IGAP() * (list.length - 1);
  let x = cx - total / 2;
  list.forEach(([k, f, w], i) => { buildIcon(BUILD[k], x + ws[i] / 2, bottom, f, G.time, w ?? .75); x += ws[i] + IGAP(); });
}
/* 目盲：畫面周圍變暗，只剩身邊一圈看得到（畫在最上層，螢幕座標） */
export function drawBlind(cx: number, cy: number, W: number, H: number) {
  const S = G.me && G.me.sx; if (!S || S.blind <= 0 || G.me.dead) return;
  const k = Math.min(1, S.blind / .4), x = G.me.x - cx, y = G.me.y - 10 - cy, g = ctx.createRadialGradient(x, y, 26, x, y, 90);
  g.addColorStop(0, 'rgba(20,14,6,0)'); g.addColorStop(1, 'rgba(20,14,6,' + (.93 * k) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
