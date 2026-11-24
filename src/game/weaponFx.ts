/* ================= 刻印效果 =================
   史詩武器隨機帶一種、傳說（獨特）武器固定帶一種。稀有度不加攻擊力，改成給這些效果。
   掛在 combat.ts 的 damageEnemy（每次命中）和擊殺時；燃燒每幀在 tickWeaponFx 結算。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { sfx } from '../core/audio';
import type { Enemy, Item, Player } from '../types';
import { UQ } from '../data/uniques';
import { WT } from '../data/items';
import { BUILD_DECAY, BUILD_HOLD } from '../data/ailments';
import { healMul } from '../data/attrs';
import { gapDealt } from '../data/levels';
import { level } from './player';
/* 刻印的傷害也吃等級差（跟普通攻擊一樣，bossTuning.ts）：等級太低的時候，出血 / 寒霜 / 燃燒不能拿來越級打王 */
const gp = (pl: Player, e: Enemy) => gapDealt(level(pl), e.lv || 0);

export const WFXD: Record<string, { n: string; c: string; d: string; pre: string }> = {
  bleed: { n: '出血', c: '#ff5a64', pre: '血棘', d: '連續命中會累積出血，滿了爆發「最大生命 15%」的傷害（Boss 5%）' },
  burn:  { n: '燃燒', c: '#ff9a3a', pre: '烈焰', d: '命中有 30% 機率點燃敵人：3 秒內每 0.5 秒受到攻擊力 20% 的傷害' },
  frost: { n: '寒霜', c: '#9ae0ff', pre: '霜語', d: '連續命中會累積凍傷，滿了造成攻擊力 150% 的傷害並凍住敵人 1 秒（Boss 不會被凍住）' },
  shock: { n: '雷鳴', c: '#ffe85a', pre: '雷鳴', d: '每次打中都會劈下一道雷（冷卻 1 秒）：雷 = 這一下傷害的 50%，再跳到附近最多 2 個敵人（30%）。一下越痛的武器，雷越痛' },
  soul:  { n: '噬魂', c: '#c8a8ff', pre: '噬魂', d: '打倒敵人時，牠的魂會飛回你身上，回復 4% 生命；拿到的魂晶 +25%' },
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
  shock: ['#a08a10', '#ffe85a', '#ffffff'], soul: ['#5a3a9a', '#c8a8ff', '#f0e8ff'] };
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
  if (fx === 'shock') {                                                // 雷鳴：每次打中都劈（冷卻 1 秒，飾品「刻印效果」會縮短），雷照這一下的傷害算 → 慢而重的武器比較吃香
    if (G.time < (pl.shockCd || 0)) return; pl.shockCd = G.time + 1 / (1 + ((pl.tfx && pl.tfx.fxBuild) || 0) / 100); thunder(pl, e, v * .5); return; }
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
  if (fx === 'bleed') { const d = Math.round(Math.max(pow * .6, Math.min(e.maxHp * (e.boss ? .02 : .15), pow * 3)) * gp(pl, e)); num(e, '出血 ' + d, WFXD.bleed.c); bleedPop(e); rawHit(pl, e, d, WFXD.bleed.c); }   // Boss 2% 最大血量、小怪 15%，但最多攻擊力 ×3（以前 Boss 5% 沒上限：攻擊力很低的出血細劍也能磨死高等的王）
  else if (fx === 'frost') { const d = Math.round(pow * 1.5 * gp(pl, e)); if (!e.boss) e.stun = Math.max(e.stun || 0, ICE_SECS(e)); num(e, '凍傷 ' + d, WFXD.frost.c); freezePop(e); rawHit(pl, e, d, WFXD.frost.c); }
  else if (fx === 'shock') thunder(pl, e, pow * .5);
}
function ignite(pl: Player, e: Enemy, pow: number) { if (!(e.burnT > 0)) ignitePop(e); e.burnT = 3; e.burnD = Math.max(1, Math.round(pow * .2 * gp(pl, e))); e.burnBy = pl; }
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
  const T = pl.tfx || {}, soul = fxOf(pl.weapon) === 'soul', heal = (soul ? 4 : 0) + (T.killHeal || 0);   // 噬魂刻印 + 飾品「打倒敵人回血」
  if (soul) soulOrb(pl, e, heal);                                        // 噬魂：魂飛回來才回血（tickOrbs）
  else if (heal) { const h = Math.round(pl.maxHp * heal / 100 * healMul(pl)); pl.hp = Math.min(pl.maxHp, pl.hp + h);
    G.nums.push({ x: pl.x, y: pl.y - 28, txt: '+' + h, col: '#c8a8ff', t: 0, d: .7 }); }
  return (soul ? 1.25 : 1) * (1 + (T.souls || 0) / 100);                 // 魂晶倍率
}
/* 出血 / 凍傷 / 雷鳴的累積：最後一次累積後 BUILD_HOLD 秒不動，之後每秒掉 BUILD_DECAY（game/status.ts，主角也是這套） */
function decayBuild(e: Enemy, dt: number) {
  if (e.decF === G.time || !(e.bleedB > 0 || e.frostB > 0 || e.shockB > 0)) return; e.decF = G.time;   // decF：這一幀退過了（同一隻不會退兩次）
  if (G.time - (e.fxT || 0) < BUILD_HOLD) return; const d = BUILD_DECAY * dt;
  if (e.bleedB > 0) e.bleedB = Math.max(0, e.bleedB - d); if (e.frostB > 0) e.frostB = Math.max(0, e.frostB - d); if (e.shockB > 0) e.shockB = Math.max(0, e.shockB - d);
}
/** 每幀：燃燒每 0.5 秒扣一次；噬魂的魂往主角飛；刻印累積慢慢退 */
export function tickWeaponFx(dt: number, list: Enemy[]) {
  if (orbs.length) tickOrbs(dt);
  for (const e of G.enemies) decayBuild(e, dt);                         // 刻印累積慢慢退（跟主角身上的出血 / 凍傷一樣）；離得遠的怪也會退
  for (const e of list) decayBuild(e, dt);                              // Boss 不在 G.enemies 裡
  for (const e of list) { if (!(e.burnT > 0) || e.hp <= 0) continue;
    e.burnT -= dt; e.burnAcc = (e.burnAcc || 0) + dt;
    if (Math.random() < dt * 30) G.parts.push({ x: e.x + rr(-5, 5), y: e.y - rr(0, 12), vx: rr(-6, 6), vy: -rr(25, 50), life: rr(.3, .5), max: .5, col: pick(['#ff9a3a', '#ffd27a', '#e8402a', '#ffffff']), star: rr(.8, 1.6), drag: 1 });   // 身上一直冒火
    if (e.burnAcc >= .5) { e.burnAcc -= .5; G.nums.push({ x: e.x + rr(-4, 4), y: e.y - 18, txt: String(e.burnD), col: WFXD.burn.c, t: 0, d: .5 }); rawHit(e.burnBy || G.me, e, e.burnD, WFXD.burn.c); } }
}
