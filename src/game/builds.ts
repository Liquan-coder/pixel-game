/* ================= 流派：改變打法的規則 =================
   基礎（每個人都有）
     · 翻滾要付得起體力才滾得出去；滾 0.3 秒（前 0.22 秒無敵），滾完要站穩一下才能動（負重越重越久，data/gear.ts 的 roll）；
       還沒站穩時按的翻滾記 0.2 秒，時間到自動滾
     · 完美閃避：翻滾開始後 0.15 秒內本來會被打中（後面那段無敵只是普通閃過） → 時間變慢一下、體力退回、1.5 秒內下一擊必定暴擊
   流派核心（獨特飾品，data/uniques.ts 的 UG，放在野外地標旁的寶箱：world/secrets.ts 的 FIELD）
     閃避 afterimage  殘影之紗：完美閃避時原地留下殘影，0.5 秒後爆炸
     反傷 rage        怒棘之心：被打中累積怒氣，下一擊一次打回去
     吸血 thirst      渴血之牙：生命越少吸越多
     暴擊 critCdr     鷹隼之羽：暴擊時技能冷卻減少
     重擊 quake       巨人的心臟：蓄滿的一擊放出震波、震暈小怪
     異常 spread      瘟疫之瓶：刻印發作時傳染給旁邊的怪（寫在 game/weaponFx.ts，因為要用到各種累積值）
   能力值也各接一個流派（data/attrs.ts 的 PERK，加進 tfx）：體魄 → 吸血（回血 +%）、耐力 → 反傷（反擊 +%）、力量 → 重擊（蓄力）、
     敏捷 → 閃避（翻滾省體力）、智識 → 異常（刻印 +%）、幸運 → 暴擊（暴擊率 + 看不到的暴擊傷害）。暴擊流的獨特武器：蠍尾短刀（連鎖，game/signatures.ts）
   combat.ts 只在幾個地方呼叫這裡（tryDodge、hurtPlayer、calcDmg、damageEnemy、releaseCharge），規則都在這個檔案。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { sfx } from '../core/audio';
import { toast } from '../ui/hud';
import type { Enemy, Player } from '../types';
import { healMul, retalMul } from '../data/attrs';

export const ROLL_T = .3, ROLL_IF = .22, PD_WIN = .15;                 // 翻滾：滾多久、前幾秒無敵、完美閃避的判定時間（秒）。滾完還要站穩（data/gear.ts 負重的 roll）
export const WOLF_T = .14, WOLF_CD = .32;                               // 騎星狼往前撲：衝多久、多久能再撲（沒有站穩的時間）
type Hooks = { aoe: (pl: Player, cx: number, cy: number, rad: number, mult: number, opts?: any) => void; shake: (m: number, t: number) => void;
  quakeFx: (x: number, y: number, R: number) => void; dodge: (pl: Player) => void };
let H: Hooks;
export function bindBuilds(h: Hooks) { H = h; }                         // combat.ts 開機時接上（避免互相 import）
const T = (pl: Player) => pl.tfx || {};

/* ---------- 翻滾：體力不夠 / 還沒站穩 ---------- */
let tipNoSt = false;
export function canDodge(pl: Player, cost: number) {
  if (G.time < (pl.dodgeReady || 0)) { pl.dodgeBuf = G.time + .2; return false; }    // 還沒站穩就按的：記 0.2 秒，時間到自動滾
  if (pl.st < cost) { if (pl === G.me) noStamina(); return false; }
  return true;
}
function noStamina() {                                                   // 體力條閃紅 + 悶悶的一聲
  const bar = document.getElementById('stBar')?.parentElement; if (bar) { bar.classList.remove('empty'); void bar.offsetWidth; bar.classList.add('empty'); }
  sfx.noSt(); if (!tipNoSt) { tipNoSt = true; toast('體力不夠，滾不出去', '#8ad0ff'); }
}
export function dodgeStarted(pl: Player, cost: number, cd: number) {
  pl.dodgeReady = G.time + cd; pl.dodgeAt = G.time; pl.dodgeX = pl.x; pl.dodgeY = pl.y; pl.dodgeCost = cost; pl.pdDone = false; pl.dodgeBuf = 0;
}

/* ---------- 完美閃避（hurtPlayer 遇到無敵時間時呼叫）---------- */
let tipPd = false;
export function iframeHit(pl: Player) {
  if (pl.dead || pl.pdDone || G.time - (pl.dodgeAt ?? -9) > PD_WIN) return;
  pl.pdDone = true;
  pl.st = Math.min(pl.maxSt, pl.st + (pl.dodgeCost || 20));             // 體力退回
  pl.critNext = G.time + 1.5;                                            // 下一擊必定暴擊
  G.slowT = .3;                                                          // 時間變慢（main.ts）
  const x = pl.dodgeX, y = pl.dodgeY;
  G.ghosts.push({ x, y, flip: pl.flip, life: .45, max: .45 });          // 原地留下一個殘影
  G.fx.push({ k: 'ring', x, y: y - 4, r0: 4, r1: 30, t: 0, d: .35, col: '#e8dcff' });
  G.fx.push({ k: 'flash', a: .12, col: '#e8dcff', t: 0, d: .15 });
  for (let i = 0; i < 16; i++) { const a = rr(0, TAU), v = rr(40, 110); G.parts.push({ x, y: y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rr(.3, .55), max: .55, col: pick(['#ffffff', '#e8dcff', '#b49cff']), star: rr(.8, 2), drag: 4 }); }
  sfx.perfect();
  if (T(pl).afterimage) decoys.push({ pl, x, y, t: .5, mult: T(pl).afterimage / 100 });   // 閃避流：殘影 0.5 秒後爆炸
  if (pl === G.me && !tipPd) { tipPd = true; toast('看破！攻擊打到前一瞬間翻滾：體力退回，下一擊必定暴擊', '#e8dcff', true); }
}
/* calcDmg：完美閃避後的下一擊必定暴擊（用掉就沒了） */
export function forcedCrit(pl: Player) { if (G.time < (pl.critNext || 0)) { pl.critNext = 0; return true; } return false; }

/* ---------- 閃避流：殘影 ---------- */
const decoys: { pl: Player; x: number; y: number; t: number; mult: number }[] = [];
function tickDecoys(dt: number) {
  for (let i = decoys.length - 1; i >= 0; i--) { const d = decoys[i]; d.t -= dt;
    if (Math.random() < dt * 40) G.parts.push({ x: d.x + rr(-6, 6), y: d.y - rr(2, 18), vx: 0, vy: -rr(10, 25), life: .3, max: .3, col: pick(['#e8dcff', '#b49cff']), star: rr(.6, 1.2) });   // 殘影身上的光
    if (d.t > 0) continue; decoys.splice(i, 1);
    H.aoe(d.pl, d.x, d.y, 36, d.mult, { heavy: true });               // 爆炸
    G.fx.push({ k: 'ring', x: d.x, y: d.y - 4, r0: 6, r1: 38, t: 0, d: .35, col: '#b49cff' });
    for (let k = 0; k < 24; k++) { const a = rr(0, TAU), v = rr(60, 150); G.parts.push({ x: d.x, y: d.y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rr(.3, .6), max: .6, col: pick(['#ffffff', '#e8dcff', '#9a7cff', '#6a4ad0']), star: rr(1, 2.4), drag: 4 }); }
    H.shake(3, .15); sfx.boom();
  }
}

/* ---------- 反傷流：怒氣（hurtPlayer 扣完血之後呼叫）---------- */
const RAGE_CAP = .6, RAGE_SECS = 6;
export function playerHurt(pl: Player, v: number) {
  if (!T(pl).rage) return;
  pl.rage = Math.min(pl.maxHp * RAGE_CAP, (pl.rage || 0) + v); pl.rageT = G.time + RAGE_SECS;
  G.fx.push({ k: 'ring', x: pl.x, y: pl.y - 4, r0: 3, r1: 16, t: 0, d: .25, col: '#ff5a3a' });
}
export const rageFrac = (pl: Player) => pl.rage > 0 ? pl.rage / (pl.maxHp * RAGE_CAP) : 0;   // 頭上的怒氣圖示（game/status.ts）

/* ---------- 每一下打中敵人（damageEnemy 扣血之前呼叫，回傳新的傷害）：怒氣、吸血、暴擊減冷卻 ---------- */
export function buildHit(pl: Player, e: Enemy, v: number, crit: boolean, proc: boolean) {
  const t = T(pl);
  if (!proc && t.rage && pl.rage > 0) {                                  // 反傷流：怒氣一次打回去
    const extra = Math.round(pl.rage * t.rage / 100 * retalMul(pl)); v += extra;   // 耐力：反擊更痛
    pl.rage = 0;
    G.fx.push({ k: 'ring', x: e.x, y: e.y - 6, r0: 4, r1: 34, t: 0, d: .35, col: '#ff5a3a' });
    for (let k = 0; k < 22; k++) { const a = rr(0, TAU), s = rr(60, 160); G.parts.push({ x: e.x, y: e.y - 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(.3, .55), max: .55, col: pick(['#ff5a3a', '#ffb040', '#ffffff', '#c8201a']), star: rr(1, 2.2), drag: 4 }); }
    G.hitStop = Math.max(G.hitStop, .08); H.shake(5, .2); sfx.boom();
  }
  if (t.thirst && pl.hp < pl.maxHp) {                                    // 吸血流：生命越少吸越多
    const lost = 1 - pl.hp / pl.maxHp, h = Math.min(v * t.thirst / 100 * lost, pl.maxHp * .03) * (e.boss ? .5 : 1) * healMul(pl);   // 體魄：回血效果
    if (h > 0) { pl.hp = Math.min(pl.maxHp, pl.hp + h); pl.thirstAcc = (pl.thirstAcc || 0) + h;
      for (let k = 0; k < 3; k++) { const life = rr(.25, .4), sx = e.x + rr(-4, 4), sy = e.y - rr(4, 12);       // 血從怪身上飛回主角
        G.parts.push({ x: sx, y: sy, vx: (pl.x - sx) / life, vy: (pl.y - 10 - sy) / life, life, max: life, col: pick(['#ff3a4a', '#c01020', '#ff8a94']), star: rr(.6, 1.2) }); }
      if (G.time - (pl.thirstT || 0) > .45 && pl.thirstAcc >= 1) { pl.thirstT = G.time; G.nums.push({ x: pl.x + rr(-3, 3), y: pl.y - 28, txt: '+' + Math.round(pl.thirstAcc), col: '#ff6a74', t: 0, d: .6 }); pl.thirstAcc = 0; } }
  }
  if (crit && !proc && t.critCdr && pl.skillCd > 0 && G.time - (pl.ccT || 0) > .15) {   // 暴擊流：暴擊時技能冷卻減少（每 0.15 秒最多算一次）
    pl.ccT = G.time; pl.skillCd = Math.max(0, pl.skillCd - t.critCdr);
    for (let k = 0; k < 6; k++) G.parts.push({ x: pl.x + rr(-6, 6), y: pl.y - rr(6, 18), vx: rr(-20, 20), vy: -rr(30, 60), life: .35, max: .35, col: pick(['#8ad0ff', '#ffffff', '#ffd84a']), star: rr(.8, 1.5), drag: 2 });
    if (pl.skillCd <= 0) sfx.charge(1);                                  // 剛好冷卻好：叮一聲
  }
  return v;
}

/* ---------- 重擊流：蓄滿的一擊放出震波（releaseCharge 呼叫）---------- */
export function fullCharge(pl: Player) {
  const q = T(pl).quake; if (!q) return;
  pl.timers.push({ t: .14, fn: () => { const x = pl.x, y = pl.y;      // 等刀落地
    H.aoe(pl, x, y, 56, q / 100, { stun: .8, heavy: true }); H.quakeFx(x, y, 56);
    G.fx.push({ k: 'ring', x, y, r0: 8, r1: 60, t: 0, d: .4, col: '#f2c14e' }); H.shake(6, .3); sfx.boom(); } });
}

/* ---------- 每幀（game/worldUpdate.ts）---------- */
export function tickBuilds(dt: number) {
  if (decoys.length) tickDecoys(dt);
  for (const pl of G.players) {
    if (pl.dodgeBuf && G.time >= (pl.dodgeReady || 0)) { const b = pl.dodgeBuf; pl.dodgeBuf = 0; if (G.time <= b) H.dodge(pl); }   // 還沒站穩時按的翻滾
    if (pl.rage > 0) { if (G.time > pl.rageT || pl.dead) pl.rage = 0;        // 怒氣 6 秒沒用掉就消失
      else if (Math.random() < dt * (8 + 30 * rageFrac(pl))) G.parts.push({ x: pl.x + rr(-6, 6), y: pl.y - rr(0, 14), vx: rr(-5, 5), vy: -rr(20, 45), life: .4, max: .4, col: pick(['#ff5a3a', '#ffb040', '#c8201a']), star: rr(.6, 1.4), drag: 1 }); }   // 身上冒紅光，怒氣越多越旺
  }
}
