/* ---- 地城 Boss 的通用 AI：一套招式庫，每隻 Boss 用 world/dungeonBoss.ts 的 moves 挑自己的招式 ----
   每一招都是「預警（紅色範圍，越來越滿）→ 出招 → 收招」三段，預警時間二階段會變短。
   招式：
   charge 衝撞（直線預警 → 往前衝，撞到就受傷；trail = 身後留下一灘；wind = 預警秒數倍率；minD = 太近不衝）  combo 連續三次衝撞
   thrust 刺（拿長兵器的：往後收 → 往前刺一條短直線，身體往前踏 step）
   sweep 的 rev = 反手（上撩）：只影響動作，範圍一樣
   chain  連段：seq 裡的招一招接一招，後面的預警縮短（例：刺、刺、橫掃）。比 combo 合理：拿武器的就該用武器連段
   ※ 每一招打出去的瞬間會記 e.act = { k, t0, aim }，render/bossAnim.ts 用它畫「出招後的收招動作」
   slam   砸地（自己周圍一圈）        leap  跳到你頭上砸下來（落點一圈；pool = 落地留一灘）
   sweep  橫掃（面前扇形）            lash  鞭打 / 吐舌 / 光束（面前一條長直線，瞬間打中；trail = 線上留一排火）
   fan    扇射（往你的方向射一排彈）  nova  環射（往四面八方射一圈）
   rain   落雷 / 落石（你附近好幾個圓，倒數後落下）   pools 毒池（地上留下會持續扣血的一灘）
   summon 召喚這座地城的小怪
   spiral 螺旋：原地轉圈噴子彈（arms 條手臂、dur 秒），彈幕遊戲那種「繞著圈找縫」的招
   ---- 新招（逼你走位）----
   pull   吸引：把你往 Boss 身上吸（走得出來，但很慢），吸完在身邊炸一圈 → 往外走 / 瞬移出去
   donut  甜甜圈：外面一大圈會炸，只有貼在 Boss 身邊是安全的 → 反過來要往內衝
   cross  十字光束：四個方向同時打出光束（二階段會再轉 45 度打第二次）→ 站在斜角
   homing 追蹤彈：慢慢飛、會轉彎追你的光球 → 繞圈甩掉或瞬移躲過
   erupt  鑽地突襲：鑽進地底（打不到）→ 地面隆起的土丘衝到你腳下 → 紅圈預警 → 從下面衝出來（暈眩）。給會鑽地的 Boss 用（蠕蟲不會「跳」） */
import { tier } from '../data/levels';
import { G } from '../core/state';
import { TAU, angDiff, clamp, pick, rr } from '../core/util';
import { DG } from '../data/items';
import { AI } from './bossAI';
import { addPool, fan, jumpStates, summon, tickPools } from './bossAI2';
import { keepIn, rbWind } from './regionBoss';
import { moveEnt, stepToward } from '../game/collision';
import { sfx } from '../core/audio';
import { hurtPlayer } from '../game/combat';
import { hitSpark, quakeFx, shake } from '../game/worldUpdate';
import type { Move } from './dungeonBoss';
import { burst, trail, type Theme } from './bossThemes';
import { MORE, moreStates, startMore, tickMore } from './bossAI4';

export const base = (e) => 10 + 3 * tier(e.lv);
export const dmgOf = (e, o) => Math.round(base(e) * (o.k || 1));
/* 區域 / 主線 Boss 沒有 THEME：用牠的光環顏色 + 一組相近的特效，讓牠們二階段也能用新招（pull / donut / cross / homing） */
const RT: Record<string, [string, string, Theme['lash']]> = { queen: ['bubble', 'splash', 'beam'], general: ['lantern', 'sparks', 'chain'], dragon: ['flame', 'lava', 'firewhip'],
  mushking: ['sporeG', 'poison', 'vine'], yeti: ['icicle', 'ice', 'beam'], lich: ['poison', 'poison', 'chain'], mossguard: ['thorn', 'moss', 'vine'], mistwitch: ['wisp', 'ghost', 'chain'],
  sandgiant: ['scarab', 'dust', 'beam'], slagmother: ['magma', 'lava', 'firewhip'], frostwyrm: ['frostwave', 'ice', 'beam'], toxqueen: ['sporeG', 'poison', 'vine'] };
export const TH = (e): Theme => { const d = e.def; if (d.theme) return d.theme; const [proj, impact, lash] = RT[d.id] || ['bolt', 'sparks', 'beam'];   // 這隻 Boss 的特效主題（world/bossThemes.ts）
  return d.theme = { cols: d.aura, proj, rain: 'pillar', impact, sweep: 'wave', lash, pool: 'water', trail: impact } as Theme; };
export const colsOf = (e) => TH(e).cols || e.def.boss.cols;
function shoot(e, a, spd, dmg) { const T = TH(e);
  G.projs.push({ x: e.x + Math.cos(a) * 16, y: e.y - 12 + Math.sin(a) * 12, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 5, life: 1.7, dmg, owner: 'e', kind: T.proj, R: 12, th: 5, cols: T.cols,
    fence: { x: e.def.x, y: e.def.y, R: e.def.R } }); }   // 飛到 Boss 戰的圈外就熄掉（不然會在圈外繼續飛一陣子）
function strike(m) {                                                    // 落下 / 冒出來的一擊：圓裡的人受傷 + 這隻 Boss 自己的樣子
  const { x, y, r, dmg, cols } = m;
  for (const pl of G.players) if (Math.hypot(pl.x - x, pl.y - y) < r - DG && hurtPlayer(pl, dmg, x, y)) hitSpark(pl.x, pl.y - 8, true, -Math.PI / 2);
  if (m.fall === 'pillar') G.fx.push({ k: 'pillar', x, y, r, cols, warm: m.warm, sand: m.impact === 'dust', t: 0, d: .6 });   // 沙王 / 沙巨人：沙泉
  else if (m.fall === 'spike') G.fx.push({ k: 'spike', x, y, r: r - 2, cols, t: 0, d: .5 });
  else if (m.fall === 'sword') G.fx.push({ k: 'stuck', x, y, cols, t: 0, d: 1.4 });
  if (m.fall !== 'pillar') quakeFx(x, y, r * .8);
  if (!(m.fall === 'pillar' && m.impact === 'dust')) G.fx.push({ k: 'warp', x, y, r0: 4, r1: r, th: 4, t: 0, d: .3, col: cols[1] });   // 沙泉自己會往外噴一圈沙，不用光圈
  burst(x, y - 2, m.impact, 12);
}
function pickMove(e, d): Move {
  const B = e.def.boss, list: Move[] = e.phase === 2 ? B.moves.concat(B.p2) : B.moves;
  const fits = (m: string, o, d: number) => !(m === 'summon' && (e.sumT || 0) > 0) && !((m === 'sweep' || m === 'slam') && d > 90) && !(m === 'charge' && d < (o?.minD || 40)) && !(m === 'pull' && d > (o?.r || 50) * 2.4)
    && !(m === 'thrust' && d > (o?.L || 80) + 16)                      // 刺：要走到刺得到的距離才出手
    && !(m === 'grab' && d > (o?.L || 64) + 20) && !(m === 'counter' && d > 90)   // 抓取、架招：你在身邊才有用
    && !(m === 'orbit' && e.objs?.some(x => x.k === 'orbit')) && !(m === 'mirage' && d < 50);   // 環繞物同時只有一組
  const ok = list.filter(([m, , o]) => m === 'chain' ? fits(o.seq[0][0], o.seq[0][1], d) : fits(m, o, d));
  let r = Math.random() * ok.reduce((s, m) => s + m[1], 0); for (const m of ok) if ((r -= m[1]) < 0) return m; return ok[0] || list[0];
}
export const laneTele = (e, o) => [{ k: 'lane', a: e.aim, L: o.L, W: o.W }];
const crossTele = (e, o) => [0, 1, 2, 3].map(i => ({ k: 'lane', a: e.aim + i * Math.PI / 2, L: o.L, W: o.W }));
function laneHit(e, a, o) {                                                // 一條直線（長 o.L、半寬 o.W）上的人受傷
  const c = Math.cos(a), s = Math.sin(a);
  for (const pl of G.players) { const rx = pl.x - e.x, ry = pl.y - e.y, along = rx * c + ry * s, side = Math.abs(-rx * s + ry * c);
    if (along > 0 && along < o.L && side < o.W + pl.r - DG && hurtPlayer(pl, dmgOf(e, o), e.x, e.y)) hitSpark(pl.x, pl.y - 8, true, a); }
}
function beam(e, a, o) {                                                   // 一道光束：直線上的人受傷 + 光束特效
  laneHit(e, a, o);
  G.fx.push({ k: 'lash', style: TH(e).lash, x: e.x, y: e.y - 8, a, L: o.L, W: o.W, cols: colsOf(e), t: 0, d: .42 });
}
function pool(e, x, y, r, t, dmg, cols) { addPool(e, x, y, r, t, dmg, cols); e.pools[e.pools.length - 1].style = TH(e).pool; }   // 地上的一灘 + 這隻 Boss 的花紋
function sweepFx(e, o) {                                                 // 橫掃：劍光 / 三道爪痕 / 細長的鞭 / 掀起一道浪
  const T = TH(e), C = colsOf(e), base0 = { x: e.x, y: e.y - 12, a0: e.aim - o.half, a1: e.aim + o.half, t: 0, sy: .8 };
  if (T.sweep === 'claw') for (const [i, dr] of [[0, 0], [1, 9], [2, 18]]) G.fx.push({ ...base0, k: 'smear', r: o.r - 6 - dr, w: 5, sw: .08, hold: .12, delay: i * .04, d: .3, cols: C });
  else if (T.sweep === 'whip') G.fx.push({ ...base0, k: 'smear', r: o.r - 4, w: 7, sw: .12, hold: .1, delay: 0, d: .26, cols: C, sy: .55 });
  else { G.fx.push({ ...base0, k: 'smear', r: o.r - 6, w: T.sweep === 'blade' ? 18 : 14, sw: .1, hold: .14, delay: 0, d: .26, cols: C });
    if (T.sweep === 'blade') G.fx.push({ ...base0, k: 'smear', r: o.r - 14, w: 4, sw: .1, hold: .1, delay: .03, d: .24, cols: ['#ffffff', '#ffffff', C[2]] }); }
  for (let i = 0; i < 5; i++) { const a = e.aim - o.half + o.half * 2 * i / 4; burst(e.x + Math.cos(a) * (o.r - 8), e.y + Math.sin(a) * (o.r - 8) * .8, T.sweep === 'claw' || T.sweep === 'blade' ? 'sparks' : T.impact, 2); }
}
/* ---- 新招：開始（dgn 的 idle 挑到，或區域 Boss 二階段由 regionBoss.ts 插進來）+ 每幀的狀態 ---- */
export const EXTRA_STATES = new Set(['pullWind', 'donutWind', 'crossWind', 'homingWind']);
export function startExtra(e, m: string, mo, dx: number, dy: number) {
  const p2 = e.phase === 2, wk = p2 ? .78 : 1; e.mo = mo; e.aim = Math.atan2(dy, dx);
  if (m === 'pull') { rbWind(e, 'pullWind', 1.2 * wk, [{ k: 'circle', r: mo.r }]); sfx.howl(); }
  else if (m === 'donut') rbWind(e, 'donutWind', 1 * wk, [{ k: 'ring', r0: mo.r0, r: mo.r }]);
  else if (m === 'cross') { e.crossN = p2 ? 2 : 1; rbWind(e, 'crossWind', .75 * wk, crossTele(e, mo)); }
  else if (m === 'homing') rbWind(e, 'homingWind', .6 * wk, [{ k: 'circle', r: 30 }]);
}
export function extraStates(e, dt): boolean {
  if (!EXTRA_STATES.has(e.state)) return false;
  const D = e.def, o = e.mo || {}, p2 = e.phase === 2, wk = p2 ? .78 : 1;
  switch (e.state) {
    case 'pullWind': {                                                   // 吸：每幀把附近的人往 Boss 拉（比走路慢一點，用力走還是走得出去）
      e.t -= dt; const R2 = o.r * 2.6;
      for (const pl of G.players) { if (pl.dead || pl.dodge > 0) continue; const px = e.x - pl.x, py = e.y - pl.y, L = Math.hypot(px, py);
        if (L > 6 && L < R2) moveEnt(pl, px / L * (o.pull || 62) * dt, py / L * (o.pull || 62) * dt); }
      if (TH(e).impact === 'dust') for (let i = 0; i < 4; i++) { const a = rr(0, TAU), r = rr(o.r * .6, R2), sw = 1.1;   // 沙王 / 沙巨人：地上的沙被吸著繞圈流進去（一粒粒的沙，不是光點）
        G.parts.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * .8, vx: (-Math.cos(a) - Math.sin(a) * sw) * r * 1.5, vy: (-Math.sin(a) + Math.cos(a) * sw) * r * 1.1, life: .5, max: .5, col: pick(['#6a4a20', '#a07a3a', '#c8a060', '#e8d098']), s: 1, drag: 1 }); }
      else if (Math.random() < .9) { const a = rr(0, TAU), r = rr(o.r, R2); G.parts.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * .8, vx: -Math.cos(a) * r * 1.6, vy: -Math.sin(a) * r * 1.3, life: .5, max: .5, col: pick(colsOf(e)), star: rr(.6, 1.4), drag: 1 }); }
      if (e.t <= 0) { e.tele = null;
        for (const pl of G.players) if (Math.hypot(pl.x - e.x, pl.y - e.y) < o.r - DG && hurtPlayer(pl, dmgOf(e, o), e.x, e.y, { stun: .4 })) hitSpark(pl.x, pl.y - 8, true, Math.atan2(pl.y - e.y, pl.x - e.x));
        for (const dl of [0, .08, .16]) G.fx.push({ k: 'warp', x: e.x, y: e.y, r0: 6, r1: o.r + 6, th: 6, delay: dl, t: 0, d: .4 + dl, col: dl ? colsOf(e)[2] : D.aura[0] });
        quakeFx(e.x, e.y, o.r); burst(e.x, e.y, TH(e).impact, 30); sfx.boom(); shake(7, .35); G.hitStop = Math.max(G.hitStop, .08); e.state = 'idle'; e.t = rr(.9, 1.2) * wk; }
      break; }
    case 'donutWind':                                                    // 甜甜圈：外圈炸，貼著 Boss 才安全
      e.t -= dt; if (e.t <= 0) { e.tele = null;
        for (const pl of G.players) { const pd = Math.hypot(pl.x - e.x, pl.y - e.y); if (pd > o.r0 + DG && pd < o.r && hurtPlayer(pl, dmgOf(e, o), e.x, e.y)) hitSpark(pl.x, pl.y - 8, true, Math.atan2(pl.y - e.y, pl.x - e.x)); }
        for (const dl of [0, .1]) G.fx.push({ k: 'warp', x: e.x, y: e.y, r0: o.r0, r1: o.r, th: 8, delay: dl, t: 0, d: .45 + dl, col: dl ? colsOf(e)[2] : D.aura[0] });
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = (o.r0 + o.r) / 2 + rr(-10, 10); burst(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * .8, TH(e).impact, 3); }
        sfx.boom(); shake(6, .3); e.act = { k: 'plant', t0: G.time, aim: e.aim }; e.state = 'idle'; e.t = rr(.8, 1.1) * wk; }
      break;
    case 'crossWind':                                                    // 十字光束（二階段：轉 45 度再打一次）
      e.t -= dt; if (e.t <= 0) { e.tele = null; for (let i = 0; i < 4; i++) beam(e, e.aim + i * Math.PI / 2, o);
        sfx.skill(); shake(4, .18);
        if (--e.crossN > 0) { e.aim += Math.PI / 4; rbWind(e, 'crossWind', .5 * wk, crossTele(e, o)); }
        else { e.state = 'idle'; e.t = rr(.7, 1) * wk; } }
      break;
    case 'homingWind':                                                   // 追蹤彈：慢、會轉彎
      e.t -= dt; if (e.t <= 0) { e.tele = null; const n = o.n + (p2 ? 1 : 0), T = TH(e);
        for (let i = 0; i < n; i++) { const a = e.aim + Math.PI + (i - (n - 1) / 2) * .9;     // 先往後、往兩邊飛出去，再慢慢轉回來追你
          G.projs.push({ x: e.x + Math.cos(a) * 14, y: e.y - 14 + Math.sin(a) * 10, vx: Math.cos(a) * o.spd, vy: Math.sin(a) * o.spd, r: 6, life: 4, dmg: dmgOf(e, o), owner: 'e', kind: T.proj, R: 12, th: 5, cols: T.cols, home: o.turn || 2.2 }); }
        G.fx.push({ k: 'warp', x: e.x, y: e.y - 12, r0: 8, r1: 34, th: 3, t: 0, d: .3, col: colsOf(e)[1] }); sfx.fire(); e.state = 'idle'; e.t = rr(.6, .9) * wk; }
      break;
  }
  return true;
}
/* 開始一招（idle 挑到的、或連段的下一招）：設定預警，進入「xxxWind」狀態 */
export function startMove(e, m: string, mo, dx: number, dy: number) {
  const D = e.def, p2 = e.phase === 2, wk = p2 ? .78 : 1; e.mo = mo; e.aim = Math.atan2(dy, dx);
  if (m === 'chain') { e.chain = mo.seq.slice(1); const [m1, o1] = mo.seq[0]; startMove(e, m1, o1, dx, dy); }   // 連段：一招接一招（例：刺、刺、橫掃）
  else if (m === 'thrust') rbWind(e, 'thrustWind', (mo.wind || .65) * wk, laneTele(e, mo));
  else if (m === 'charge' || m === 'combo') { e.combo = m === 'combo' ? 3 : 1; rbWind(e, 'chargeWind', (mo.wind || .6) * wk, laneTele(e, mo)); }
  else if (m === 'slam') rbWind(e, 'slamWind', .75 * wk, [{ k: 'circle', r: mo.r }]);
  else if (m === 'leap') { rbWind(e, 'jumpWind', .7 * wk); e.tx = e.tgt.x; e.ty = e.tgt.y; }
  else if (m === 'sweep') rbWind(e, 'sweepWind', .55 * wk, [{ k: 'sector', r: mo.r, a: e.aim, half: mo.half }]);
  else if (m === 'lash') rbWind(e, 'lashWind', .6 * wk, laneTele(e, mo));
  else if (m === 'fan') { const n = mo.n + (p2 ? 2 : 0); e.shots = []; for (let i = 0; i < n; i++) e.shots.push(n === 1 ? e.aim : e.aim - mo.spread / 2 + mo.spread * i / (n - 1));
    rbWind(e, 'fanWind', .55 * wk, e.shots.map(a => ({ k: 'lane', a, L: 110, W: 12 }))); }
  else if (m === 'nova') { e.shots = []; const n = mo.n, a0 = rr(0, TAU); for (let i = 0; i < n; i++) e.shots.push(a0 + i / n * TAU);
    rbWind(e, 'novaWind', .7 * wk, e.shots.map(a => ({ k: 'lane', a, L: 64, W: 6 }))); }   // 預警畫成放射線（每一顆會飛的方向），站在兩條線中間就躲得掉；畫成圓圈會被當成砸地
  else if (m === 'rain') { const pts = []; for (let i = 0; i < mo.n + (p2 ? 2 : 0); i++) { const q = i === 0 ? { x: e.tgt.x, y: e.tgt.y } : { x: e.tgt.x + rr(-80, 80), y: e.tgt.y + rr(-60, 60) }; keepIn(q, D, 18); pts.push(q); }
    const T = TH(e); for (const [i, q] of pts.entries()) e.pend.push({ x: q.x, y: q.y, r: mo.r, t: .9 * wk + i * .08, T: .9 * wk + i * .08, dmg: dmgOf(e, mo), fall: T.rain, impact: T.impact,
      cols: T.rainCols || mo.cols || colsOf(e), warm: T.rain === 'pillar' && T.impact === 'lava' ? 1 : 2 });
    rbWind(e, 'castWind', .5); }
  else if (m === 'pools') { const pts = [{ x: e.tgt.x, y: e.tgt.y }]; for (let i = 1; i < mo.n + (p2 ? 1 : 0); i++) { const q = { x: e.tgt.x + rr(-70, 70), y: e.tgt.y + rr(-50, 50) }; keepIn(q, D, 24); pts.push(q); }
    e.cpts = pts; rbWind(e, 'poolWind', .8 * wk, pts.map(q => ({ k: 'circle', x: q.x, y: q.y, r: mo.r }))); }
  else if (m === 'spiral') { e.sa = e.aim; rbWind(e, 'spiralWind', .5 * wk, [{ k: 'circle', r: 30 }]); }
  else if (m === 'summon') { e.sumT = 14; rbWind(e, 'summonWind', .7, [{ k: 'circle', r: 30 }]); }
  else if (m === 'pull' || m === 'donut' || m === 'cross' || m === 'homing') startExtra(e, m, mo, dx, dy);
  else if (MORE.has(m)) startMore(e, m, mo, dx, dy);                    // 第二批招式（world/bossAI4.ts）
  else if (m === 'erupt') { e.hidden = e.immune = e.mound = true; rbWind(e, 'sinkWind', .45); burst(e.x, e.y, TH(e).impact, 22); quakeFx(e.x, e.y, 30); sfx.boom(); }
}
/* 一招打完：連段還有下一招 → 直接接（預警縮短成 6 成）；沒有 → 站著喘一下 rest 秒 */
export function done(e, rest: number, dx: number, dy: number) {
  if (e.chain?.length) { const [m, mo] = e.chain.shift(); startMove(e, m, mo, dx, dy); e.t *= .6; e.wt = e.t; return; }
  e.chain = null; e.state = 'idle'; e.t = rest;
}
AI.dgn = (e, dt, d, dx, dy) => {
  const B = e.def.boss, D = e.def, p2 = e.phase === 2, wk = p2 ? .78 : 1;
  tickPools(e, dt); if (e.sumT > 0) e.sumT -= dt;
  e.pend = (e.pend || []).filter(m => { m.t -= dt; if (m.t > 0) return true; strike(m); shake(2, .1); sfx.boom(); return false; });
  tickMore(e, dt);                                                      // 震波、光球、迴力鏢、分身、環繞物（world/bossAI4.ts）
  if (jumpStates(e, dt, e.mo?.r || 48, dmgOf(e, e.mo || {}), e.mo?.air || .7, () => { burst(e.x, e.y, TH(e).impact, 26); if (e.mo?.pool) pool(e, e.x, e.y, 34, 3.5, Math.round(base(e) * .35), e.mo.pool); })) return;
  if (extraStates(e, dt)) return;
  if (moreStates(e, dt, dx, dy)) return;
  const o = e.mo || {};
  switch (e.state) {
    case 'idle': {
      e.t -= dt; e.flip = dx < 0;
      if (d > 40) stepToward(e, e.tgt.x, e.tgt.y, B.spd * (p2 ? 1.2 : 1), dt);
      if (e.t > 0) break;
      const [m, , mo = {}] = pickMove(e, d); e.chain = null; startMove(e, m, mo, dx, dy);
      break; }
    case 'chargeWind':
      e.t -= dt; if (e.t > .2) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = laneTele(e, o); }
      if (e.t <= 0) { e.tele = null; e.state = 'dash'; e.t = o.L / o.spd; e.lvx = Math.cos(e.aim) * o.spd; e.lvy = Math.sin(e.aim) * o.spd; e.hitDone = false; sfx.dodge(); }
      break;
    case 'dash':
      e.t -= dt; if (moveEnt(e, e.lvx * dt, e.lvy * dt)) e.t = Math.min(e.t, .03); keepIn(e, D, e.r);
      if (Math.random() < .6) G.fx.push({ k: 'rghost', kind: e.kind, x: e.x, y: e.y, flip: e.flip, t: 0, d: .22 });
      trail(e.x, e.y, TH(e).trail);
      if (o.trail && (e.trT = (e.trT || 0) + dt) > .09) { e.trT = 0; pool(e, e.x, e.y, 16, 2.5, Math.round(base(e) * .3), o.trail); }
      if (!e.hitDone) for (const pl of G.players) if (Math.hypot(pl.x - e.x, pl.y - e.y) < e.r + pl.r + 4 && hurtPlayer(pl, dmgOf(e, o), e.x, e.y, { stun: .35 })) { e.hitDone = true; hitSpark(pl.x, pl.y - 8, true, e.aim); shake(4, .15); }
      if (e.t <= 0) { if (--e.combo > 0) { e.aim = Math.atan2(dy, dx); rbWind(e, 'chargeWind', .32 * wk, laneTele(e, o)); } else { e.act = { k: 'chargeEnd', t0: G.time, aim: e.aim }; done(e, rr(.6, .9) * wk, dx, dy); } }
      break;
    case 'slamWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null;
        for (const pl of G.players) if (Math.hypot(pl.x - e.x, pl.y - e.y) < o.r - DG && hurtPlayer(pl, dmgOf(e, o), e.x, e.y, { stun: .55 })) hitSpark(pl.x, pl.y - 8, true, Math.atan2(pl.y - e.y, pl.x - e.x));
        for (const dl of [0, .08]) G.fx.push({ k: 'warp', x: e.x, y: e.y, r0: 6, r1: o.r + 8, th: 6, delay: dl, t: 0, d: .4 + dl, col: D.aura[0] });
        quakeFx(e.x, e.y, o.r); burst(e.x, e.y, TH(e).impact, 26); sfx.boom(); shake(6, .3); G.hitStop = Math.max(G.hitStop, .07); e.act = { k: 'slam', t0: G.time, aim: e.aim }; done(e, rr(.8, 1.1) * wk, dx, dy); }
      break;
    case 'sweepWind':
      e.t -= dt; if (e.t > .2) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = [{ k: 'sector', r: o.r, a: e.aim, half: o.half }]; }
      if (e.t <= 0) { e.tele = null;
        for (const pl of G.players) { const pd = Math.hypot(pl.x - e.x, pl.y - e.y); if (pd < o.r - DG && angDiff(Math.atan2(pl.y - e.y, pl.x - e.x), e.aim) < o.half - DG / Math.max(pd, 20) && hurtPlayer(pl, dmgOf(e, o), e.x, e.y)) hitSpark(pl.x, pl.y - 8, true, e.aim); }
        sweepFx(e, o); e.act = { k: 'sweep', t0: G.time, aim: e.aim, half: o.half, rev: o.rev };
        if (o.wave && p2) for (let i = 0; i < o.wave; i++) shoot(e, e.aim + (i - (o.wave - 1) / 2) * .4, o.wspd || 150, dmgOf(e, { k: o.wk || .8 }));   // 二階段：橫掃順勢甩出寒氣
        sfx.swing(); shake(3, .12); done(e, rr(.6, .9) * wk, dx, dy); }
      break;
    case 'thrustWind':                                                   // 刺：往後收 → 往前刺（直線，比 lash 短），身體跟著往前踏一步
      e.t -= dt; if (e.t > .22) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = laneTele(e, o); }
      if (e.t <= 0) { e.tele = null; laneHit(e, e.aim, o);
        G.fx.push({ k: 'lash', style: TH(e).lash, x: e.x, y: e.y - 8, a: e.aim, L: o.L, W: o.W * .6, cols: colsOf(e), t: 0, d: .26 });
        burst(e.x + Math.cos(e.aim) * o.L, e.y - 8 + Math.sin(e.aim) * o.L, TH(e).impact, 8);
        const v = (o.step || 12) / .14; e.lvx = Math.cos(e.aim) * v; e.lvy = Math.sin(e.aim) * v;
        e.act = { k: 'thrust', t0: G.time, aim: e.aim }; e.state = 'thrust'; e.t = .14; sfx.swing(); shake(3, .12); }
      break;
    case 'thrust':
      e.t -= dt; moveEnt(e, e.lvx * dt, e.lvy * dt); keepIn(e, D, e.r);
      if (e.t <= 0) done(e, rr(.7, .95) * wk, dx, dy);
      break;
    case 'lashWind':
      e.t -= dt; if (e.t > .22) { e.aim = Math.atan2(dy, dx); e.flip = dx < 0; e.tele = laneTele(e, o); }
      if (e.t <= 0) { e.tele = null; const c = Math.cos(e.aim), s = Math.sin(e.aim);
        for (const pl of G.players) { const rx = pl.x - e.x, ry = pl.y - e.y, along = rx * c + ry * s, side = Math.abs(-rx * s + ry * c);
          if (along > 0 && along < o.L && side < o.W + pl.r - DG && hurtPlayer(pl, dmgOf(e, o), e.x, e.y)) hitSpark(pl.x, pl.y - 8, true, e.aim); }
        G.fx.push({ k: 'lash', style: TH(e).lash, x: e.x, y: e.y - 8, a: e.aim, L: o.L, W: o.W, cols: colsOf(e), t: 0, d: .42 });
        for (let k = 12; k < o.L; k += 10) G.parts.push({ x: e.x + c * k + rr(-3, 3), y: e.y - 8 + s * k + rr(-3, 3), vx: c * 40, vy: s * 40, life: .3, max: .3, col: pick(colsOf(e)), s: 2 });
        if (o.trail) for (let k = 24; k < o.L; k += 26) pool(e, e.x + c * k, e.y + s * k, 14, 2.5, Math.round(base(e) * .3), o.trail);
        e.act = { k: 'lash', t0: G.time, aim: e.aim }; sfx.swing(); shake(3, .12); done(e, rr(.6, .9) * wk, dx, dy); }
      break;
    case 'fanWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; for (const a of e.shots) shoot(e, a, o.spd, dmgOf(e, o)); e.act = { k: 'toss', t0: G.time, aim: e.aim };
        G.fx.push({ k: 'warp', x: e.x, y: e.y - 12, r0: 8, r1: 30, th: 3, t: 0, d: .25, col: colsOf(e)[1] }); burst(e.x, e.y - 12, TH(e).impact, 6); sfx.fire(); e.state = 'idle'; e.t = rr(.6, .9) * wk; }
      break;
    case 'novaWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; for (const a of e.shots) shoot(e, a, o.spd, dmgOf(e, o));
        for (const dl of [0, .1]) G.fx.push({ k: 'warp', x: e.x, y: e.y - 8, r0: 6, r1: 50, th: 4, delay: dl, t: 0, d: .35 + dl, col: colsOf(e)[1] }); burst(e.x, e.y - 8, TH(e).impact, 14); sfx.skill(); e.act = { k: 'nova', t0: G.time, aim: e.aim }; e.state = 'idle'; e.t = rr(.7, 1) * wk; }
      break;
    case 'castWind':
      e.t -= dt; if (e.t <= 0) { e.act = { k: 'plant', t0: G.time, aim: e.aim }; e.state = 'idle'; e.t = rr(.5, .8) * wk; }
      break;
    case 'poolWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; for (const q of e.cpts) pool(e, q.x, q.y, o.r, o.t + (p2 ? 1 : 0), Math.round(base(e) * o.k), o.cols || colsOf(e)); sfx.skill(); e.act = { k: 'toss', t0: G.time, aim: e.aim }; e.state = 'idle'; e.t = rr(.6, .9) * wk; }
      break;
    case 'sinkWind':                                                     // 鑽進地底
      e.t -= dt; if (e.t <= 0) { e.state = 'under'; e.t = 1.1; } break;
    case 'under': {                                                      // 在地底追你（看得到地面隆起）
      e.t -= dt; const L = Math.hypot(dx, dy); if (L > 4) { e.x += dx / L * Math.min(L, 130 * dt); e.y += dy / L * Math.min(L, 130 * dt); keepIn(e, D, e.r); }
      if (Math.random() < .6) burst(e.x + rr(-8, 8), e.y, TH(e).impact, 1);
      if (e.t <= 0 || L < 10) rbWind(e, 'eruptWind', .7 * wk, [{ k: 'circle', r: o.r }]);
      break; }
    case 'eruptWind':                                                    // 紅圈填滿 → 從腳下衝出來
      e.t -= dt; if (e.t <= 0) { e.tele = null; e.hidden = e.immune = e.mound = false;
        for (const pl of G.players) if (Math.hypot(pl.x - e.x, pl.y - e.y) < o.r - DG && hurtPlayer(pl, dmgOf(e, o), e.x, e.y, { stun: .5 })) hitSpark(pl.x, pl.y - 8, true, -Math.PI / 2);
        for (const dl of [0, .1]) G.fx.push({ k: 'warp', x: e.x, y: e.y, r0: 6, r1: o.r + 8, th: 6, delay: dl, t: 0, d: .4 + dl, col: D.aura[0] });
        quakeFx(e.x, e.y, o.r); burst(e.x, e.y, TH(e).impact, 34); sfx.boom(); shake(7, .35); G.hitStop = Math.max(G.hitStop, .07); e.state = 'idle'; e.t = rr(.9, 1.2) * wk; }
      break;
    case 'spiralWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; e.state = 'spiral'; e.t = o.dur || 1.8; e.emT = 0; sfx.skill(); }
      break;
    case 'spiral':                                                       // 每 0.08 秒每條手臂噴一顆
      e.t -= dt; e.emT -= dt;
      while (e.emT <= 0) { e.emT += .08; const n = o.arms || 2; e.sa += p2 ? .3 : .26; for (let i = 0; i < n; i++) shoot(e, e.sa + i / n * TAU, o.spd || 110, dmgOf(e, o)); }
      if (e.t <= 0) { e.state = 'idle'; e.t = rr(.5, .8) * wk; }
      break;
    case 'summonWind':
      e.t -= dt; if (e.t <= 0) { e.tele = null; summon(e, pick(D.adds), o.n || 2, o.max || 3, 3); sfx.howl(); e.act = { k: 'plant', t0: G.time, aim: e.aim }; e.state = 'idle'; e.t = .8; }
      break;
  }
  void fan; void clamp;
};
