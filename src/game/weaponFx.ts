/* ================= 刻印效果 =================
   史詩武器隨機帶一種、傳說（獨特）武器固定帶一種。稀有度不加攻擊力，改成給這些效果。
   掛在 combat.ts 的 damageEnemy（每次命中）和擊殺時；燃燒每幀在 tickWeaponFx 結算。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { sfx } from '../core/audio';
import type { Enemy, Item, Player } from '../types';
import { UQ } from '../data/uniques';
import { BEH, WT } from '../data/items';
import { BUILD_DECAY, BUILD_HOLD } from '../data/ailments';
import { healMul } from '../data/attrs';

export const WFXD: Record<string, { n: string; c: string; d: string; pre: string }> = {
  bleed: { n: '出血', c: '#ff5a64', pre: '血棘', d: '連續命中會累積出血，滿了爆發「最大生命 15%」的傷害（Boss 5%）' },
  burn:  { n: '燃燒', c: '#ff9a3a', pre: '烈焰', d: '命中有 30% 機率點燃敵人：3 秒內每 0.5 秒受到攻擊力 20% 的傷害' },
  frost: { n: '寒霜', c: '#9ae0ff', pre: '霜語', d: '連續命中會累積凍傷，滿了造成攻擊力 150% 的傷害並凍住敵人 1 秒（Boss 不會被凍住）' },
  shock: { n: '雷鳴', c: '#ffe85a', pre: '雷鳴', d: '打中時劈下一道雷（冷卻 2 秒，刀身冒電花 = 下一刀會劈）：雷 = 這一下傷害的 50%，再跳到附近最多 2 個敵人（30%）。一下越痛的武器，雷越痛' },
  soul:  { n: '噬魂', c: '#c8a8ff', pre: '噬魂', d: '打倒敵人時，牠的魂會飛回你身上，回復 4% 生命；拿到的魂晶 +25%' },
  /* 下面這幾種不是「多一點傷害」，是改變打法：疊層、把怪打去撞東西、把怪吸成一團、追著一隻打、抓節奏、蓄力 */
  poison:  { n: '劇毒', c: '#7ac25a', pre: '蝕毒', d: '每次打中疊一層毒（最多 8 層），每層每秒扣攻擊力 6%；3 秒沒打就每秒少一層。中毒的怪死掉時，毒會跳到旁邊的怪身上（帶一半層數）' },
  impact:  { n: '衝擊', c: '#d8b070', pre: '震岳', d: '把怪打得飛很遠：飛出去撞到牆或別的怪，兩邊都受到攻擊力 80% 的傷害並暈 0.6 秒。打不飛的精英和 Boss 改成累積震盪，滿了受到攻擊力 120% 的傷害（精英會暈 0.8 秒）' },
  gravity: { n: '引力', c: '#6a8aff', pre: '星引', d: '打中時在敵人身上開一個小漩渦（冷卻 2.5 秒）：1 秒內把附近的小怪吸過去，最後往內一縮，圈裡每隻受到攻擊力 60% 的傷害' },
  mark:    { n: '標記', c: '#ffb070', pre: '獵印', d: '打中的第一隻怪會被標記，受到你的傷害 +25%（Boss +15%）。打倒被標記的怪 → 回復 30 體力，標記自己跳到附近的下一隻' },
  echo:    { n: '迴響', c: '#7ae8c8', pre: '迴響', d: '每打 4 下，第 4 下會在 0.3 秒後再響一次（那一下傷害的 70%）。慢而重的武器數得比較快（戰鎚大約每 2 下就響一次）' },
  star:    { n: '星辰', c: '#ff9ad0', pre: '星辰', d: '蓄力攻擊放出星星（蓄一段 1 顆、蓄滿 3 顆），先飄在你背後等著（最多 6 顆、12 秒）。你打中怪的時候，星星就一起飛過去，每顆攻擊力 70%（弓拉滿的那一箭不算）' },
};
export const FX_KEYS = Object.keys(WFXD);
export const fxOf = (it: Item | null) => it ? (it.uq && UQ[it.uq] ? UQ[it.uq].fx : it.fx) || null : null;

type RawHit = (pl: Player, e: Enemy, v: number, col: string) => void;
type Targets = (pl: Player) => Enemy[];
let rawHit: RawHit, targetsOf: Targets, shake: (m: number, t: number) => void = () => {};
export function bindFx(r: RawHit, t: Targets, sh: (m: number, t: number) => void) { rawHit = r; targetsOf = t; shake = sh; }   // combat.ts 開機時接上（避免互相 import）

/* 刻印的顏色：深 / 中 / 亮。刀光、武器身上的粒子（render/player.ts）都用這個 */
export const SEALC: Record<string, [string, string, string]> = {
  bleed: ['#8a1020', '#ff5a64', '#ffc0c8'], burn: ['#c0401a', '#ffa040', '#ffe08a'], frost: ['#2a6aa0', '#9ae0ff', '#ffffff'],
  shock: ['#a08a10', '#ffe85a', '#ffffff'], soul: ['#5a3a9a', '#c8a8ff', '#f0e8ff'],
  poison: ['#2a5a20', '#7ac25a', '#d0f0b0'], impact: ['#6a4a20', '#d8b070', '#fff0c8'], gravity: ['#2a3a8a', '#6a8aff', '#d0dcff'],
  mark: ['#8a4a18', '#ffb070', '#ffe8d0'], echo: ['#1a6a58', '#7ae8c8', '#e0fff4'], star: ['#8a2a5a', '#ff9ad0', '#fff0f8'] };
const ICE_SECS = (e: Enemy) => e.elite ? .4 : 1;                       // 凍住幾秒（Boss 不會被凍住）

const num = (e: Enemy, txt: string, col: string) => G.nums.push({ x: e.x + rr(-4, 4), y: e.y - (e.boss ? 34 : 22), txt, col, t: 0, d: .9, big: true });
function sparks(e: Enemy, col: string, n: number) { for (let i = 0; i < n; i++) G.parts.push({ x: e.x + rr(-5, 5), y: e.y - rr(2, 14), vx: rr(-40, 40), vy: -rr(20, 70), life: rr(.3, .6), max: .6, col, star: rr(.8, 1.8), drag: 2 }); }
/* 發作的瞬間：畫面停一下 + 輕輕震 + 怪閃白，讓人注意到「剛剛那一下不一樣」 */
function popJuice(e: Enemy, stop: number, mag: number) { G.hitStop = Math.max(G.hitStop, stop); shake(mag, .12); e.flash = Math.max(e.flash || 0, .12); }
function bleedPop(e: Enemy) {                                          // 出血：往上噴的血花（會掉下來）+ 紅色圈
  for (let i = 0; i < 26; i++) { const a = rr(-Math.PI, 0), s = rr(50, 150); G.parts.push({ x: e.x + rr(-3, 3), y: e.y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(.35, .75), max: .75, col: pick(['#c01020', '#ff3a4a', '#7a0810', '#ff7a84']), s: Math.random() < .3 ? 2 : 1, g: 320 }); }
  G.fx.push({ k: 'ring', x: e.x, y: e.y - 6, r0: 4, r1: 26, t: 0, d: .3, col: '#ff3a4a' });
  popJuice(e, .06, 2.5); sfx.bleedPop();
}
function freezePop(e: Enemy) {                                         // 寒霜：冰屑四散 + 冰藍圈；小怪被包進冰塊（render/enemy.ts 畫）
  for (let i = 0; i < 20; i++) { const a = rr(0, TAU), v = rr(40, 120); G.parts.push({ x: e.x, y: e.y - 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .6 - 20, life: rr(.4, .8), max: .8, col: pick(['#ffffff', '#d8f0ff', '#9ae0ff']), star: rr(.6, 1.8), drag: 3 }); }
  G.fx.push({ k: 'ring', x: e.x, y: e.y - 4, r0: 4, r1: 28, t: 0, d: .35, col: '#9ae0ff' });
  if (!e.boss) { if (!(e.iceT > G.time)) e.iceT0 = G.time; e.iceT = G.time + ICE_SECS(e); }   // iceT0：冰晶從什麼時候開始長（已經凍著就不重長）
  popJuice(e, .06, 2); sfx.freeze();
}
function ignitePop(e: Enemy) {                                         // 燃燒：剛點著的時候「呼」一下竄出火
  for (let i = 0; i < 14; i++) G.parts.push({ x: e.x + rr(-6, 6), y: e.y - rr(0, 8), vx: rr(-20, 20), vy: -rr(40, 90), life: rr(.3, .55), max: .55, col: pick(['#ffe08a', '#ffa040', '#e8402a']), star: rr(.8, 2), drag: 2 });
  G.fx.push({ k: 'ring', x: e.x, y: e.y, r0: 3, r1: 18, t: 0, d: .25, col: '#ffa040' });
  sfx.ignite();
}
/* 噬魂：打倒的怪身上飄出一顆紅色的魂（紫色會跟魂晶搞混），先往上浮一下，再轉彎追著主角飛回來；碰到主角才回血 */
type Orb = { x: number; y: number; vx: number; vy: number; t: number; pl: Player; heal: number; done?: boolean };
const orbs: Orb[] = [];
function soulOrb(pl: Player, e: Enemy, heal: number) {
  const o = { x: e.x, y: e.y - 10, vx: rr(-50, 50), vy: -rr(80, 110), t: 0, pl, heal }; orbs.push(o);
  G.fx.push({ k: 'sorb', o, t: 0, d: 9 });                                 // 魂的本體：一顆會發光的紫色球（render.ts 畫，跟著 o 走；o.done 之後消失）
  for (let i = 0; i < 10; i++) { const a = rr(0, TAU), v = rr(20, 60); G.parts.push({ x: e.x, y: e.y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rr(.3, .5), max: .5, col: pick(['#ff5a64', '#ffc0c8', '#c01020']), star: rr(.8, 1.6), drag: 3 }); }
  G.fx.push({ k: 'ring', x: e.x, y: e.y - 8, r0: 2, r1: 16, t: 0, d: .25, col: '#ff5a64' });
}
function tickOrbs(dt: number) {
  for (let i = orbs.length - 1; i >= 0; i--) { const o = orbs[i], pl = o.pl; o.t += dt;
    const dx = pl.x - o.x, dy = pl.y - 10 - o.y, d = Math.hypot(dx, dy);
    if (o.t > .22) { const sp = 120 + o.t * 420, k = Math.min(1, dt * 9); o.vx += (dx / d * sp - o.vx) * k; o.vy += (dy / d * sp - o.vy) * k; }   // 浮起來之後越飛越快地追過去
    else { o.vx *= .9; o.vy *= .9; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    G.parts.push({ x: o.x + rr(-1.5, 1.5), y: o.y + rr(-1.5, 1.5), vx: rr(-8, 8), vy: rr(-8, 8), life: rr(.25, .4), max: .4, col: pick(['#ff3a4a', '#c01020', '#ff9aa4', '#ffffff']), star: rr(.7, 1.6), drag: 2 });   // 拖著的尾巴
    if (d < 7 || o.t > 1.6 || pl.dead) { orbs.splice(i, 1); o.done = true; if (pl.dead) continue;
      const h = Math.round(pl.maxHp * o.heal / 100 * healMul(pl)); pl.hp = Math.min(pl.maxHp, pl.hp + h);                                             // 碰到主角才回血
      G.nums.push({ x: pl.x, y: pl.y - 28, txt: '+' + h, col: '#ff6a74', t: 0, d: .8, big: true });
      G.fx.push({ k: 'ring', x: pl.x, y: pl.y - 4, r0: 3, r1: 20, t: 0, d: .3, col: '#ff5a64' });
      for (let k = 0; k < 12; k++) { const a = rr(0, TAU); G.parts.push({ x: pl.x + Math.cos(a) * 9, y: pl.y - 10 + Math.sin(a) * 9, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30 - 20, life: .4, max: .4, col: pick(['#ff5a64', '#ffc0c8']), star: rr(.8, 1.6), drag: 2 }); }
      sfx.soulTake(); }
  }
}
/* 雷鳴：從天上劈下一道粗的閃電（render.ts 的 'zap'）+ 白光一閃 + 地上燒焦的圈 */
function thunder(pl: Player, e: Enemy, dmg: number) {                 // dmg = 雷打在目標身上的傷害（旁邊的怪 60%）
  const d = Math.max(1, Math.round(dmg)), tx = e.x, ty = e.y - 6;
  const pts = jag(tx + rr(-20, 20), ty - 130, tx, ty, 8, 9), br = [2, 4].map(i => { const [bx, by] = pts[i], sg = Math.random() < .5 ? -1 : 1; return jag(bx, by, bx + sg * rr(14, 24), by + rr(14, 26), 3, 4); });   // 兩條小分岔
  G.fx.push({ k: 'zap', pts, br, t: 0, d: .36, col: '#ffe85a' });
  G.fx.push({ k: 'flash', a: .16, col: '#fff8d0', t: 0, d: .12 });
  G.fx.push({ k: 'ring', x: tx, y: e.y, r0: 4, r1: 26, t: 0, d: .32, col: '#ffe85a' });
  for (let i = 0; i < 18; i++) { const a = rr(-Math.PI, 0), v = rr(50, 140); G.parts.push({ x: tx, y: e.y - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rr(.2, .4), max: .4, col: pick(['#ffffff', '#ffe85a', '#fff3a0']), star: rr(.8, 1.8), drag: 4 }); }
  if (!e.boss) e.stun = Math.max(e.stun || 0, .2);                       // 麻痺一下（每秒都可能劈，太久會一直定住）
  num(e, '雷擊 ' + d, WFXD.shock.c); popJuice(e, .07, 3.5); sfx.thunder(); rawHit(pl, e, d, WFXD.shock.c);
  const near = targetsOf(pl).filter(o => o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 72).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 2);
  for (const o of near) { G.fx.push({ k: 'zap', pts: jag(tx, ty, o.x, o.y - 6, 4, 6), t: 0, d: .3, col: '#ffe85a', thin: true }); sparks(o, '#ffe85a', 8);   // 跳到旁邊的怪
    o.flash = Math.max(o.flash || 0, .1); if (!o.boss) o.stun = Math.max(o.stun || 0, .15); rawHit(pl, o, Math.max(1, Math.round(dmg * .6)), WFXD.shock.c); }
}
/* 鋸齒線：從 (x0,y0) 到 (x1,y1) 分 n 段，中間每個點往旁邊亂偏 dev */
function jag(x0: number, y0: number, x1: number, y1: number, n: number, dev: number) {
  const pts: number[][] = [[x0, y0]], L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
  for (let i = 1; i < n; i++) { const t = i / n, o = rr(-dev, dev); pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]); }
  pts.push([x1, y1]); return pts;
}
/** 每次命中（proc = 由效果本身造成的傷害，不再觸發，避免連鎖無限）
    B 也照武器速度調：慢的武器每下累積比較多 / 比較容易觸發，所以每種武器大約一樣快爆（太刀 0.34 秒一下 = 1 倍；短刀 0.76 倍、戰鎚 2.35 倍） */
export const SPD_REF = .34;
export function onHit(pl: Player, e: Enemy, v: number, crit: boolean) {
  const fx = fxOf(pl.weapon); if (!fx || e.hp <= 0) return;
  const pow = pl.atkPow || pl.weapon.atk || 10, B = (1 + ((pl.tfx && pl.tfx.fxBuild) || 0) / 100) * (WT[pl.weapon.type]?.cd || SPD_REF) / SPD_REF;   // 飾品「刻印效果加強」× 武器速度
  if (fx === 'burn') { if (Math.random() < .3 * B) { const fresh = !(e.burnT > 0); ignite(pl, e, pow); if (fresh) spread(pl, e, fx, pow); } return; }
  if (fx === 'shock') {                                                // 雷鳴：打中就劈（冷卻 2 秒，飾品「刻印效果」會縮短），雷照這一下的傷害算 → 慢而重的武器比較吃香
    if (G.time < (pl.shockCd || 0)) return; pl.shockCd = G.time + 2 / (1 + ((pl.tfx && pl.tfx.fxBuild) || 0) / 100); thunder(pl, e, v * .5); return; }
  if (fx === 'star') { sendStars(pl, e); return; }
  if (fx === 'poison') { poisonAdd(pl, e, B, pow); return; }
  if (fx === 'impact') { impactHit(pl, e, B, pow); return; }
  if (fx === 'gravity') { if (G.time < (pl.gravCd || 0)) return; pl.gravCd = G.time + 2.5 / (1 + ((pl.tfx && pl.tfx.fxBuild) || 0) / 100); vortex(pl, e, pow); return; }
  if (fx === 'mark') { const m = pl.markE; if (!m || m.hp <= 0 || m.dead || m.gone) setMark(pl, e); return; }
  if (fx === 'echo') { if (G.time - (pl.echoT ?? -9) < .12) return; pl.echoT = G.time;   // 同一刀砍到好幾隻只算一拍
    pl.echoC = (pl.echoC || 0) + Math.min(2, B); if (pl.echoC >= 4) { pl.echoC = 0;   // 每刀最多 2 拍（最快每 2 刀響一次）；響了就歸零，不留零頭 → 刀上的提示一定會暗掉一次
    echoes.push({ t: .3, pl, e, v: Math.max(1, Math.round(v * .7)) }); G.fx.push({ k: 'ring', x: e.x, y: e.y - 6, r0: 22, r1: 3, t: 0, d: .3, col: '#7ae8c8' }); } return; }   // 往內收的青色圈 = 0.3 秒後會響
  const inc = fx === 'bleed' ? (22 + (crit ? 15 : 0)) * B : fx === 'frost' ? 25 * B : 0; if (!inc) return;
  build(pl, e, fx, inc, pow, true);
}
/* 累積 → 滿 100 發作。canSpread：自己打出來的發作才會傳染（被傳染而發作的不會再往外傳，避免一路連鎖下去） */
const BK: Record<string, string> = { bleed: 'bleedB', frost: 'frostB', shock: 'shockB' };
function build(pl: Player, e: Enemy, fx: string, inc: number, pow: number, canSpread: boolean) {
  const k = BK[fx]; e[k] = (e[k] || 0) + inc; e.fxT = G.time;             // fxT：最後一次累積的時間（頭上的圖示要不要畫）
  if (e[k] < 100) return; e[k] = 0; pop(pl, e, fx, pow); if (canSpread) spread(pl, e, fx, pow);
}
function pop(pl: Player, e: Enemy, fx: string, pow: number) {
  if (fx === 'bleed') { const d = Math.round(Math.max(pow * .6, Math.min(e.maxHp * (e.boss ? .02 : .15), pow * 3))); num(e, '出血 ' + d, WFXD.bleed.c); bleedPop(e); rawHit(pl, e, d, WFXD.bleed.c); }   // Boss 2% 最大血量、小怪 15%，但最多攻擊力 ×3（以前 Boss 5% 沒上限：攻擊力很低的出血細劍也能磨死高等的王）
  else if (fx === 'frost') { const d = Math.round(pow * 1.5); if (!e.boss) e.stun = Math.max(e.stun || 0, ICE_SECS(e)); num(e, '凍傷 ' + d, WFXD.frost.c); freezePop(e); rawHit(pl, e, d, WFXD.frost.c); }
  else if (fx === 'shock') thunder(pl, e, pow * .5);
}
function ignite(pl: Player, e: Enemy, pow: number) { if (!(e.burnT > 0)) ignitePop(e); e.burnT = 3; e.burnD = Math.max(1, Math.round(pow * .2)); e.burnBy = pl; }
/* 異常流（瘟疫之瓶，飾品 spread）：發作的那隻把同一種刻印傳給附近最多 4 隻 —— 一道刻印顏色的細線連過去 */
function spread(pl: Player, e: Enemy, fx: string, pow: number) {
  const v = pl.tfx && pl.tfx.spread; if (!v || fx === 'shock') return;   // 雷鳴本來就會跳到旁邊，不另外傳染
  const near = targetsOf(pl).filter(o => o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 64).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 4);
  for (const o of near) {
    G.fx.push({ k: 'zap', pts: jag(e.x, e.y - 8, o.x, o.y - 8, 3, 3), t: 0, d: .3, col: SEALC[fx][1], thin: true });
    sparks(o, SEALC[fx][1], 6);
    if (fx === 'burn') ignite(pl, o, pow); else build(pl, o, fx, v, pow, false);
  }
}
/** 擊殺（回傳魂晶倍率） */
export function onKill(pl: Player, e: Enemy) {
  if (!pl) return 1;
  if (e.psn > 0) poisonJump(e);                                          // 劇毒：中毒的怪死掉 → 毒跳到旁邊
  if (pl.markE === e) markKill(pl, e);                                   // 標記：回體力、標記跳到下一隻
  const T = pl.tfx || {}, soul = fxOf(pl.weapon) === 'soul', heal = (soul ? 4 : 0) + (T.killHeal || 0);   // 噬魂刻印 + 飾品「打倒敵人回血」
  if (soul) soulOrb(pl, e, heal);                                        // 噬魂：魂飛回來才回血（tickOrbs）
  else if (heal) { const h = Math.round(pl.maxHp * heal / 100 * healMul(pl)); pl.hp = Math.min(pl.maxHp, pl.hp + h);
    G.nums.push({ x: pl.x, y: pl.y - 28, txt: '+' + h, col: '#c8a8ff', t: 0, d: .7 }); }
  return (soul ? 1.25 : 1) * (1 + (T.souls || 0) / 100);                 // 魂晶倍率
}
/* 出血 / 凍傷 / 雷鳴的累積：最後一次累積後 BUILD_HOLD 秒不動，之後每秒掉 BUILD_DECAY（game/status.ts，主角也是這套） */
function decayBuild(e: Enemy, dt: number) {
  if (e.decF === G.time || !(e.bleedB > 0 || e.frostB > 0 || e.shockB > 0 || e.impB > 0)) return; e.decF = G.time;   // decF：這一幀退過了（同一隻不會退兩次）
  if (G.time - (e.fxT || 0) < BUILD_HOLD) return; const d = BUILD_DECAY * dt;
  if (e.bleedB > 0) e.bleedB = Math.max(0, e.bleedB - d); if (e.frostB > 0) e.frostB = Math.max(0, e.frostB - d); if (e.shockB > 0) e.shockB = Math.max(0, e.shockB - d); if (e.impB > 0) e.impB = Math.max(0, e.impB - d);
}
/** 每幀：燃燒每 0.5 秒扣一次；噬魂的魂往主角飛；刻印累積慢慢退 */
export function tickWeaponFx(dt: number, list: Enemy[]) {
  if (orbs.length) tickOrbs(dt);
  if (stars.length) tickStars(dt);
  if (vortices.length) tickVortex(dt);
  for (let i = echoes.length - 1; i >= 0; i--) { const o = echoes[i]; o.t -= dt; if (o.t > 0) continue; echoes.splice(i, 1); echoHit(o); }
  for (const e of list) tickPoison(e, dt);
  for (const e of G.enemies) decayBuild(e, dt);                         // 刻印累積慢慢退（跟主角身上的出血 / 凍傷一樣）；離得遠的怪也會退
  for (const e of list) decayBuild(e, dt);                              // Boss 不在 G.enemies 裡
  for (const e of list) { if (!(e.burnT > 0) || e.hp <= 0) continue;
    e.burnT -= dt; e.burnAcc = (e.burnAcc || 0) + dt;
    if (Math.random() < dt * 30) G.parts.push({ x: e.x + rr(-5, 5), y: e.y - rr(0, 12), vx: rr(-6, 6), vy: -rr(25, 50), life: rr(.3, .5), max: .5, col: pick(['#ff9a3a', '#ffd27a', '#e8402a', '#ffffff']), star: rr(.8, 1.6), drag: 1 });   // 身上一直冒火
    if (e.burnAcc >= .5) { e.burnAcc -= .5; G.nums.push({ x: e.x + rr(-4, 4), y: e.y - 18, txt: String(e.burnD), col: WFXD.burn.c, t: 0, d: .5 }); rawHit(e.burnBy || G.me, e, e.burnD, WFXD.burn.c); } }
}

/* ================= 改變打法的刻印 ================= */
const fxB = (pl: Player) => 1 + ((pl.tfx && pl.tfx.fxBuild) || 0) / 100;      // 飾品「刻印效果加強」
const nearest = (pl: Player, x: number, y: number, R: number, skip: (o: Enemy) => boolean) => targetsOf(pl).filter(o => !skip(o) && o.hp > 0 && !o.dead && !o.obj && Math.hypot(o.x - x, o.y - y) < R)
  .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
const knockable = (e: Enemy) => !e.boss && !e.elite && !(BEH[e.beh] && BEH[e.beh].heavy);   // 跟 combat.ts 的擊退條件一樣

/* ---- 劇毒：疊層，每 0.5 秒扣「攻擊力 3% × 層數」；3 秒沒打就每秒少一層；死掉時跳到旁邊 ---- */
const PSN_MAX = 8;
function poisonAdd(pl: Player, e: Enemy, n: number, pow: number) {
  const was = e.psn || 0; e.psn = Math.min(PSN_MAX, was + n); e.psnT = G.time; e.psnBy = pl; e.psnPow = pow;
  for (let i = 0; i < 4; i++) G.parts.push({ x: e.x + rr(-5, 5), y: e.y - rr(2, 12), vx: rr(-10, 10), vy: -rr(10, 30), life: rr(.3, .5), max: .5, col: pick(['#7ac25a', '#3a7a2a', '#d0f0b0']), star: rr(.6, 1.2), drag: 2 });
  if (was < PSN_MAX && e.psn >= PSN_MAX) { G.fx.push({ k: 'ring', x: e.x, y: e.y - 6, r0: 4, r1: 20, t: 0, d: .3, col: '#7ac25a' }); sfx.splash(); }   // 疊滿：綠色圈 + 一聲
}
function tickPoison(e: Enemy, dt: number) {
  if (!(e.psn > 0) || e.hp <= 0) return;
  if (G.time - (e.psnT || 0) > 3) { e.psn = Math.max(0, e.psn - dt); if (!e.psn) return; }
  if (Math.random() < dt * (4 + e.psn * 2)) G.parts.push({ x: e.x + rr(-5, 5), y: e.y - rr(0, 10), vx: rr(-4, 4), vy: -rr(12, 28), life: rr(.4, .7), max: .7, col: pick(['#7ac25a', '#3a7a2a', '#a8d08a']), s: 1, drag: 1 });   // 冒綠色泡泡
  e.psnAcc = (e.psnAcc || 0) + dt; if (e.psnAcc < .5) return; e.psnAcc -= .5;
  const d = Math.max(1, Math.round((e.psnPow || 10) * .03 * Math.ceil(e.psn)));
  G.nums.push({ x: e.x + rr(-4, 4), y: e.y - 18, txt: String(d), col: WFXD.poison.c, t: 0, d: .5 }); rawHit(e.psnBy || G.me, e, d, WFXD.poison.c);
}
function poisonJump(e: Enemy) {
  const pl: Player = e.psnBy || G.me, n = (pl.tfx && pl.tfx.spread) ? 4 : 1;   // 瘟疫之瓶：一次跳 4 隻
  for (const o of nearest(pl, e.x, e.y, 72, o => o === e).slice(0, n)) {
    G.fx.push({ k: 'zap', pts: jag(e.x, e.y - 8, o.x, o.y - 8, 4, 3), t: 0, d: .35, col: WFXD.poison.c, thin: true });
    poisonAdd(pl, o, Math.max(2, e.psn / 2), e.psnPow || 10); }
  e.psn = 0; sfx.splash();
}

/* ---- 衝擊：小怪打飛（擊退 ×2.6），飛的途中撞到牆 / 別的怪 → 兩邊受傷 + 暈；打不飛的累積震盪 ---- */
function impactHit(pl: Player, e: Enemy, B: number, pow: number) {
  if (knockable(e)) { e.kx = (e.kx || 0) * 2.6; e.ky = (e.ky || 0) * 2.6; e.impT = G.time + .45; e.impBy = pl; e.impPow = pow; return; }   // 擊退是 combat.ts 先設好的，這裡放大
  e.impB = (e.impB || 0) + 18 * B; e.fxT = G.time; if (e.impB < 100) return; e.impB = 0;
  const d = Math.round(pow * 1.2); if (!e.boss) e.stun = Math.max(e.stun || 0, .8);
  num(e, '震盪 ' + d, WFXD.impact.c); dust(e.x, e.y, 22); G.fx.push({ k: 'ring', x: e.x, y: e.y, r0: 6, r1: 34, t: 0, d: .35, col: '#d8b070' });
  popJuice(e, .08, 5); sfx.boom(); rawHit(pl, e, d, WFXD.impact.c);
}
function dust(x: number, y: number, n: number) { for (let i = 0; i < n; i++) { const a = rr(-Math.PI, 0), v = rr(30, 110); G.parts.push({ x: x + rr(-4, 4), y: y - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .5, life: rr(.3, .6), max: .6, col: pick(['#d8b070', '#a08050', '#fff0c8', '#6a5030']), s: Math.random() < .4 ? 2 : 1, drag: 4 }); } }
/** game/enemies.ts 每幀擊退移動之後呼叫：blocked = 這一步被牆擋住 */
export function impactMove(e: Enemy, blocked: boolean) {
  if (!(e.impT > G.time) || e.hp <= 0) return;
  if (blocked) { slam(e, null); return; }
  for (const o of G.enemies) if (o !== e && o.hp > 0 && !o.dead && !o.gone && !o.chest && Math.hypot(o.x - e.x, o.y - e.y) < (e.r || 6) + (o.r || 6)) { slam(e, o); return; }
}
function slam(e: Enemy, o: Enemy | null) {
  const pl: Player = e.impBy || G.me, base = (e.impPow || 10) * .8, d = Math.max(1, Math.round(base)); e.impT = 0;
  dust(e.x, e.y, 16); G.fx.push({ k: 'ring', x: e.x, y: e.y - 4, r0: 4, r1: 24, t: 0, d: .3, col: '#d8b070' });
  num(e, '撞擊 ' + d, WFXD.impact.c); popJuice(e, .05, 3); sfx.boom();
  if (!e.boss) e.stun = Math.max(e.stun || 0, .6);
  if (o) { if (knockable(o)) { o.kx = e.kx * .7; o.ky = e.ky * .7; } if (!o.boss) o.stun = Math.max(o.stun || 0, .6); o.flash = .12; rawHit(pl, o, Math.max(1, Math.round(base)), WFXD.impact.c); }   // 被撞的那隻也飛出去一點
  e.kx *= .15; e.ky *= .15; rawHit(pl, e, d, WFXD.impact.c);
}

/* ---- 引力：在打中的位置開漩渦，1 秒內把小怪吸過來（精英、Boss 不會被吸），最後往內一縮 ---- */
type Vortex = { x: number; y: number; t: number; pl: Player; pow: number };
const vortices: Vortex[] = [], VR = 72, VT = 1;
function vortex(pl: Player, e: Enemy, pow: number) {
  vortices.push({ x: e.x, y: e.y, t: 0, pl, pow }); sfx.wind();
  G.fx.push({ k: 'ring', x: e.x, y: e.y, r0: VR, r1: 8, t: 0, d: VT, col: '#6a8aff' });   // 一圈往內收的光環 = 吸的範圍
}
function tickVortex(dt: number) {
  for (let i = vortices.length - 1; i >= 0; i--) { const v = vortices[i]; v.t += dt;
    for (let k = 0; k < 3; k++) { const a = rr(0, TAU), r = rr(30, VR); G.parts.push({ x: v.x + Math.cos(a) * r, y: v.y + Math.sin(a) * r * .6, vx: -Math.cos(a) * r * 1.6 - Math.sin(a) * 60, vy: (-Math.sin(a) * r * 1.6 + Math.cos(a) * 60) * .6, life: .5, max: .5, col: pick(['#6a8aff', '#d0dcff', '#2a3a8a']), star: rr(.6, 1.4), drag: 1 }); }   // 繞著轉、往中間掉
    for (const o of G.enemies) { if (!knockable(o) || o.hp <= 0 || o.dead || o.chest) continue;
      const dx = v.x - o.x, dy = v.y - o.y, d = Math.hypot(dx, dy); if (d > VR || d < 5) continue;
      moveEnt(o, dx / d * 150 * dt, dy / d * 150 * dt); }
    if (v.t < VT) continue; vortices.splice(i, 1);
    for (const o of nearest(v.pl, v.x, v.y, 30, () => false)) { const d = Math.max(1, Math.round(v.pow * .6 * fxB(v.pl))); if (!o.boss) o.stun = Math.max(o.stun || 0, .3); num(o, String(d), WFXD.gravity.c); rawHit(v.pl, o, d, WFXD.gravity.c); }
    G.fx.push({ k: 'ring', x: v.x, y: v.y, r0: 6, r1: 34, t: 0, d: .25, col: '#d0dcff' }); G.fx.push({ k: 'flash', a: .08, col: '#d0dcff', t: 0, d: .1 });
    for (let k = 0; k < 18; k++) { const a = rr(0, TAU), s = rr(40, 120); G.parts.push({ x: v.x, y: v.y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .6, life: rr(.25, .45), max: .45, col: pick(['#ffffff', '#d0dcff', '#6a8aff']), star: rr(.8, 1.8), drag: 4 }); }
    shake(3, .12); sfx.blinkIn(); }
}
let moveEnt: (e: any, dx: number, dy: number) => boolean = () => false;
export function bindMove(m: typeof moveEnt) { moveEnt = m; }                 // combat.ts 接上（避免 import collision.ts 打亂載入順序）

/* ---- 標記：一次只標一隻；被標記的受到的傷害變高（combat.ts 的 damageEnemy 呼叫 markMul） ---- */
export function markMul(pl: Player, e: Enemy) { return pl.markE === e && fxOf(pl.weapon) === 'mark' ? (e.boss || e.rb ? 1.15 : 1.25) : 1; }
function setMark(pl: Player, e: Enemy) {
  pl.markE = e; G.fx.push({ k: 'ring', x: e.x, y: e.y - 6, r0: 22, r1: 6, t: 0, d: .3, col: '#ffb070' }); sparks(e, '#ffb070', 6); sfx.pick();
}
function markKill(pl: Player, e: Enemy) {
  pl.markE = null; if (fxOf(pl.weapon) !== 'mark') return;
  const g = Math.min(pl.maxSt - pl.st, 30); if (g > 0) { pl.st += g; G.nums.push({ x: pl.x, y: pl.y - 28, txt: '體力 +' + Math.round(g), col: '#8ad0ff', t: 0, d: .7 }); }
  const o = nearest(pl, e.x, e.y, 140, o => o === e)[0];
  if (o) { G.fx.push({ k: 'zap', pts: jag(e.x, e.y - 8, o.x, o.y - 8, 5, 4), t: 0, d: .3, col: '#ffb070', thin: true }); setMark(pl, o); }
}

/* ---- 迴響：第 4 下 0.3 秒後再打一次（onHit 數拍子，這裡結算） ---- */
type Echo = { t: number; pl: Player; e: Enemy; v: number };
const echoes: Echo[] = [];
/** 下一刀會不會觸發（雷鳴、引力的冷卻好了；迴響數到第 4 拍）：render/player.ts 在刀身上畫提示 */
export function sealReady(pl: Player) { const fx = fxOf(pl.weapon);
  return fx === 'shock' ? G.time >= (pl.shockCd || 0) : fx === 'gravity' ? G.time >= (pl.gravCd || 0) : fx === 'echo' ? echoReady(pl) >= 1 : false; }
/** 迴響的拍子數到哪了（0~1，1 = 下一刀會響）：render/player.ts 用來決定刀身上的青光多亮 */
export function echoReady(pl: Player) { const B = fxB(pl) * (WT[pl.weapon.type]?.cd || SPD_REF) / SPD_REF; return Math.min(1, ((pl.echoC || 0) + Math.min(2, B)) / 4); }
function echoHit(o: Echo) {
  const e = o.e; if (e.hp <= 0 || e.dead || e.gone) return;
  for (const a of [-.7, .7, Math.PI / 2 - .7 + Math.PI, Math.PI / 2 + .7]) G.fx.push({ k: 'aline', x: e.x - Math.cos(a) * 15, y: e.y - 8 - Math.sin(a) * 15, a, len: 30, t: 0, d: .3, col: '#7ae8c8' });   // 大大的青色 X 刀痕
  for (let i = 0; i < 3; i++) G.fx.push({ k: 'ring', x: e.x, y: e.y - 6, r0: 4, r1: 20 + i * 9, t: 0, d: .3 + i * .08, delay: i * .08, col: i ? '#7ae8c8' : '#e0fff4' });   // 三圈往外擴散的聲波 = 回音
  for (let i = 0; i < 12; i++) { const a = rr(0, TAU), s = rr(40, 100); G.parts.push({ x: e.x, y: e.y - 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .6, life: rr(.25, .45), max: .45, col: pick(['#7ae8c8', '#e0fff4', '#ffffff']), star: rr(.8, 1.6), drag: 4 }); }
  e.flash = Math.max(e.flash || 0, .15); num(e, '迴響 ' + o.v, WFXD.echo.c); popJuice(e, .06, 3); sfx.crit(); rawHit(o.pl, e, o.v, WFXD.echo.c);
}

/* ---- 星辰：蓄力放出星星 → 先彈出去，再飄回主角背後排成一排等著（全部加起來最多 6 顆、等 12 秒）。
   只有主角打中怪 → 背後的星星全部飛向那隻（怪靠近不會自己飛過去）。好幾顆一起打中同一隻 → 數字合成一個往上加 ---- */
type Star = { x: number; y: number; vx: number; vy: number; t: number; pl: Player; dmg: number; tg?: Enemy | null; slot: number; done?: boolean };
const stars: Star[] = [], STAR_MAX = 6, STAR_WAIT = 12;
export function starShot(pl: Player, n: number) {
  const dmg = (pl.atkPow || 10) * .7 * fxB(pl);
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * .8 + rr(-.15, .15), s = rr(90, 120);   // 往上散開
    const o: Star = { x: pl.x, y: pl.y - 12, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, pl, dmg, slot: 0 }; stars.push(o);
    G.fx.push({ k: 'sorb', o, t: 0, d: 99, r: 3, lr: 30, cols: ['#5a1a3a', '#ff6ab0', '#ffc0e0', '#ffffff'] }); }
  const mine = stars.filter(o => o.pl === pl);                           // 全部加起來（等著的 + 正在飛的）最多 6 顆，太多 → 最舊的先消失
  while (mine.length > STAR_MAX) { const o = mine.shift(); o.done = true; stars.splice(stars.indexOf(o), 1); }
  sfx.soul();
}
/** 主角打中怪：背後等著的星星全部飛過去（onHit 呼叫） */
function sendStars(pl: Player, e: Enemy) { for (const o of stars) if (o.pl === pl && !o.tg) o.tg = e; }   // 只有主角打中才飛（怪靠近不會自己去打，免得走在路上惹到精英怪）
function starNum(e: Enemy, d: number) {                                  // 0.35 秒內打中同一隻 → 合成一個數字往上加
  const n = e.starNum; if (n && G.time - (e.starNumT || 0) < .35 && G.nums.includes(n)) { n.v += d; n.txt = '星辰 ' + n.v; n.t = 0; }
  else { const m = { x: e.x, y: e.y - (e.boss ? 34 : 22), txt: '星辰 ' + d, v: d, col: WFXD.star.c, t: 0, d: .9, big: true }; G.nums.push(m); e.starNum = m; }
  e.starNumT = G.time;
}
function tickStars(dt: number) {
  const slots = new Map<Player, number>();
  for (let i = stars.length - 1; i >= 0; i--) { const o = stars[i], pl = o.pl; o.t += dt;
    if (pl.dead || (!o.tg && o.t > STAR_WAIT)) { stars.splice(i, 1); o.done = true; continue; }
    if (o.tg && (o.tg.hp <= 0 || o.tg.dead || o.tg.gone)) o.tg = null;     // 目標死了 → 回到背後
    let gx: number, gy: number, sp: number;
    if (o.tg) { gx = o.tg.x; gy = o.tg.y - 8; sp = 150 + o.t * 15; }   // 飛過去的速度：慢一點，看得到星星一顆顆飛
    else { const k = slots.get(pl) || 0; slots.set(pl, k + 1);              // 背後排一排：面向的反方向，左右錯開，上下輕輕浮
      const back = pl.face + Math.PI, side = (k - 2.5) * 5;
      gx = pl.x + Math.cos(back) * 11 - Math.sin(back) * side; gy = pl.y - 16 + Math.sin(back) * 5 + Math.cos(back) * side * .4 + Math.sin(G.time * 3 + k) * 1.5; sp = 140; }
    const dx = gx - o.x, dy = gy - o.y, d = Math.hypot(dx, dy) || 1;
    if (o.t > .25) { const want = o.tg ? sp : Math.min(sp, d * 6), k = Math.min(1, dt * 6); o.vx += (dx / d * want - o.vx) * k; o.vy += (dy / d * want - o.vy) * k; }
    else { o.vx *= .92; o.vy *= .92; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.tg && d < (o.tg.r || 6) + 4) { const tg = o.tg; stars.splice(i, 1); o.done = true; tg.flash = .1; sparks(tg, '#ff9ad0', 10);
      G.fx.push({ k: 'ring', x: tg.x, y: tg.y - 8, r0: 2, r1: 16, t: 0, d: .2, col: '#ff9ad0' });
      const dm = Math.max(1, Math.round(o.dmg)); starNum(tg, dm); sfx.hit(); rawHit(pl, tg, dm, WFXD.star.c); continue; }
    if (o.tg || Math.random() < .4) G.parts.push({ x: o.x + rr(-1, 1), y: o.y + rr(-1, 1), vx: rr(-6, 6), vy: rr(-6, 6), life: rr(.2, .35), max: .35, col: pick(['#ff9ad0', '#ffc0e0', '#ffffff']), star: rr(.6, 1.3), drag: 2 });   // 星屑（等著的時候少一點）
  }
}
