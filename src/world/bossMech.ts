/* ================= Boss 的機制（打到 66% 和 33% 血時發動） =================
   Boss 被一層護盾包住（打不到），護盾連到場上 4 個東西（裂口、弩砲、水晶、卵、旗子……）。
   這 4 個東西「你自己砍不壞」，要引 Boss 的招打中它：站在它旁邊，等 Boss 的攻擊落下來的瞬間閃開。
   算「打中」的有：預警範圍（紅色的圈 / 直線 / 扇形 / 甜甜圈）放出來的那一下、從天上掉下來的一擊、
   Boss 的子彈、Boss 衝撞 / 跳躍落地時撞到。大招一下就打壞，子彈要 2 發。
   要冒險：物件被打壞 0.45 秒後會原地炸開（紅圈預警，半徑 48，走路逃不出去，要瞬移），而你為了引招一定站在旁邊 → 要連閃兩次。
   護盾期間 Boss 動作快 30%。不閃的話，站在物件旁邊解完一輪大概會倒下（5 隻裡 3 隻打得死你）。
   4 個都壞了 → 護盾碎掉、Boss 暈眩露出破綻（受到的傷害 ×1.5）。
   35 秒內沒打完 → 護盾消失，剩下的物件把力量灌回 Boss：每剩一個回 5% 血（沒有破綻）。
   有些是「卵 / 孢子囊」：太慢打破就會孵出小怪。
   Boss 全程都在場上照常出招（以前鑽地 / 升空會整隻消失，配上瞬移等於休息時間，所以改掉了）。
   kind 只決定提示文字：burrow = 地脈裂口，sky = 拉住牠的機關，shield = 連著護盾的東西 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { collides } from '../game/collision';
import { makeEnemy } from '../game/enemies';
import { hitSpark, quakeFx, shake } from '../game/worldUpdate';
import { burst as dust } from './bossThemes';
import { drawStar } from '../render/fx';
import { toast } from '../ui/hud';
import { hurtPlayer } from '../game/combat';
import { teleCircle } from '../render/enemy';
import { tier } from '../data/levels';
import { DG } from '../data/items';

type Kind = 'burrow' | 'sky' | 'shield';
type ObjK = 'vent' | 'crystal' | 'lantern' | 'root' | 'egg' | 'banner' | 'ballista' | 'totem';
interface MDef { kind: Kind; obj: ObjK; col: string[]; name: string; hatch?: string; fx?: Record<string, number> }
const LAVA = ['#5a1408', '#f07a32', '#ffd04a'], SAND = ['#6a4a2a', '#d8b878', '#fff0c8'], WATER = ['#1a3a6a', '#4aa8e8', '#d8f4ff'], ICE = ['#2a4a78', '#a8dcff', '#ffffff'];
const MUD = ['#2a2a14', '#6a7a3a', '#c8e08a'], SNOW = ['#5e86ba', '#dce8f4', '#ffffff'], GHOST = ['#1a3a7a', '#4aa8ff', '#e0f4ff'], VOID = ['#3a1a6a', '#9a6ae8', '#e8d8ff'];
const GOLD = ['#7a4a1a', '#f2c14e', '#fff6d0'], ROOT = ['#2a3a14', '#6aa84a', '#d0f0a0'], RED = ['#5a0e14', '#e04a3a', '#ffd0a0'], SPORE = ['#3a1a4a', '#c46ad8', '#f0c8ff'];
/* key：地城 Boss = DBOSS 的 key；主線 / 區域 Boss = RBDEF 的 id。
   只挑 5 隻有機制（每個等級段一隻、機關不重複）：巢母 25、沙王 38、熔岩巨龍 52、沼澤巫妖 75、星之看守者 80。
   其他 Boss 照常打。MECH_SPARE 是以前也有機制的 Boss，要加回去就把那一行搬進 MECH */
export const MECH: Record<string, MDef> = {
  broodmother: { kind: 'sky', obj: 'egg', col: ['#8a8aa0', '#e8e8f4', '#ffffff'], name: '卵囊', hatch: 'spiderF' },
  dragon:      { kind: 'sky', obj: 'ballista', col: LAVA, name: '鎖龍弩砲' },
  sandking:    { kind: 'shield', obj: 'crystal', col: GOLD, name: '王的卡諾卜罐' },
  starwarden:  { kind: 'shield', obj: 'crystal', col: VOID, name: '星之柱' },
  lich:        { kind: 'shield', obj: 'crystal', col: ['#1a4a1a', '#6ae04a', '#d0ffb0'], name: '命匣' },
};
export const MECH_SPARE: Record<string, MDef> = {
  magmaworm:   { kind: 'burrow', obj: 'vent', col: LAVA, name: '熔岩裂口' },
  scorpion:    { kind: 'burrow', obj: 'vent', col: SAND, name: '流沙洞' },
  drowned:     { kind: 'burrow', obj: 'vent', col: WATER, name: '深水的漩渦' },
  sandgiant:   { kind: 'burrow', obj: 'vent', col: SAND, name: '流沙洞' },
  frostwyrm:   { kind: 'sky', obj: 'ballista', col: ICE, name: '鎖龍弩砲' },
  mistwitch:   { kind: 'sky', obj: 'totem', col: GHOST, name: '霧之圖騰' },
  rootheart:   { kind: 'shield', obj: 'root', col: ROOT, name: '根瘤' },
  icequeen:    { kind: 'shield', obj: 'crystal', col: ICE, name: '冰晶' },
  mushking:    { kind: 'shield', obj: 'egg', col: SPORE, name: '孢子囊', hatch: 'shroom' },
  elfking:     { kind: 'shield', obj: 'banner', col: ['#1e3a5e', '#9ad8ff', '#e0c060'], name: '精靈王旗' },     // 精靈王國
  mothqueen:   { kind: 'sky', obj: 'egg', col: ['#6a5a80', '#e8dcb0', '#ffffff'], name: '蛾繭', hatch: 'mothE' },
};
const AT = [.66, .33], HITS = 2, HATCH = 13, LIMIT = 35, NEAR = 56;   // NEAR = 你離物件多近，Boss 的招才算得上打到它
export const MECH_SPEED = 1.3;                                           // 護盾期間 Boss 的動作快幾倍
const BLAST = { delay: .45, r: 48, k: 1.4, heal: .05 };                    // 物件碎掉後的爆炸：幾秒後炸、半徑、傷害倍率；時間到每剩一個物件 Boss 回幾 % 血
export const mechOf = (e) => MECH[e.def.dg ? String(e.kind).slice(3) : e.def.id];

function start(e, M: MDef) {
  const d = e.def, objs = [];
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2;
    let r = d.R * .64, x = d.x + Math.cos(a) * r, y = d.y + Math.sin(a) * r * .8;
    for (let n = 0; n < 6 && collides(x, y, 8); n++) { r *= .82; x = d.x + Math.cos(a) * r; y = d.y + Math.sin(a) * r * .8; }
    objs.push({ obj: true, x, y, r: 9, hp: HITS, maxHp: HITS, lv: e.lv, dead: false, hatched: false, k: M.obj, owner: e, flash: 0, hatchT: M.hatch ? HATCH + k * .8 : 0, ph: rr(0, 9), kx: 0, ky: 0, state: 'obj', mark: 0 }); }
  e.mech = { M, t: 0, objs, tele: null, st: '', tx: e.x, ty: e.y, pend: [], px: e.x, py: e.y, pz: 0, hintT: 0 };
  e.immune = true;
  sfx.skill(); G.fx.push({ k: 'warp', x: e.x, y: e.y - 10, r0: 6, r1: 40, th: 4, t: 0, d: .5, col: M.col[1] });
  const verb = M.kind === 'burrow' ? '震塌' : M.kind === 'sky' ? '打壞' : '打碎';
  toast(d.short + '被護盾包住了……引牠的攻擊' + verb + '四周的' + M.name + (M.hatch ? '（太慢會孵化）' : ''), M.col[2]);
}
function finish(e, clean: boolean) {
  const M: MDef = e.mech.M, left = e.mech.objs.filter(o => !o.dead); e.mech = null; e.immune = false; e.mi = (e.mi || 0) + 1;
  if (left.length) { const h = Math.round(e.maxHp * BLAST.heal * left.length); e.hp = Math.min(e.maxHp, e.hp + h);   // 時間到：剩下的物件把力量灌回 Boss
    for (const o of left) { G.fx.push({ k: 'warp', x: o.x, y: o.y - 8, r0: 20, r1: 2, th: 3, t: 0, d: .4, col: M.col[2] });
      for (let i = 0; i < 10; i++) { const u = i / 10; G.parts.push({ x: o.x + (e.x - o.x) * u, y: o.y - 10 + (e.y - 14 - o.y + 10) * u, vx: rr(-10, 10), vy: rr(-20, 0), life: .4 + u * .4, max: .8, col: pick(M.col), star: rr(.8, 1.8), drag: 2 }); } }
    G.nums.push({ x: e.x, y: e.y - 40, txt: '+' + h, col: '#7aff9a', t: 0, d: 1.2 }); }
  dust(e.x, e.y, M.kind === 'burrow' ? 'dust' : 'stars', 34); quakeFx(e.x, e.y, 50); shake(7, .4); sfx.boom();
  for (const dl of [0, .1]) G.fx.push({ k: 'warp', x: e.x, y: e.y, r0: 6, r1: 70, th: 5, delay: dl, t: 0, d: .45 + dl, col: M.col[1] });
  if (clean) { e.state = 'idle'; e.t = .6; e.tele = null; e.mStun = 4; e.hidden = e.mound = false; G.hitStop = Math.max(G.hitStop, .2); toast(e.def.short + '的護盾碎了，露出了破綻！', '#ffe38a'); }   // hidden / mound：鑽地衝出的途中被打破 → 直接冒出來暈眩
  else { sfx.howl(); toast(left.length ? '剩下的' + M.name + '把力量灌回了' + e.def.short + '……' : e.def.short + '的護盾消失了', '#ff8a6a'); }
}
function breakObj(o) {
  o.dead = true; sfx.boom(); shake(3, .15); const C = o.owner.mech?.M.col || ['#888', '#ccc', '#fff'];
  for (let i = 0; i < 18; i++) { const a = rr(0, TAU), s = rr(40, 120); G.parts.push({ x: o.x, y: o.y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .7 - 30, life: rr(.4, .8), max: .8, col: pick(C), s: 1, g: 260 }); }
  G.fx.push({ k: 'warp', x: o.x, y: o.y - 6, r0: 4, r1: 26, th: 3, t: 0, d: .35, col: C[2] });
  if (!o.hatched) (o.owner.mblast ||= []).push({ x: o.x, y: o.y, t: BLAST.delay, col: C });   // 0.45 秒後原地炸開
}
/* 物件碎掉後的爆炸：放在 Boss 身上（不是 mech 上），最後一個物件碎掉、機制結束了也照樣會炸 */
function tickBlasts(e, dt: number) {
  if (!e.mblast || !e.mblast.length) return;
  e.mblast = e.mblast.filter(b => { b.t -= dt; if (b.t > 0) return true;
    G.hitCtx = e.hc; for (const pl of G.players) if (!pl.dead && Math.hypot(pl.x - b.x, pl.y - b.y) < BLAST.r - DG && hurtPlayer(pl, Math.round((10 + 3 * tier(e.lv)) * BLAST.k), b.x, b.y)) hitSpark(pl.x, pl.y - 8, true, -Math.PI / 2); G.hitCtx = null;
    quakeFx(b.x, b.y, BLAST.r); sfx.boom(); shake(5, .25);
    for (let i = 0; i < 22; i++) { const a = rr(0, TAU), s = rr(60, 160); G.parts.push({ x: b.x, y: b.y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .6 - 40, life: rr(.4, .8), max: .8, col: pick(b.col), s: 2, g: 300 }); }
    return false; });
}
/* Boss 的攻擊打中物件：n = 扣幾格（大招 2 = 直接打壞，子彈 1） */
export function bossHitObj(o, n: number) {
  if (o.dead) return; o.hp -= n; o.flash = .15; sfx.hit(); hitSpark(o.x, o.y - 10, true, -Math.PI / 2);
  if (o.hp <= 0) breakObj(o);
}
/* 你砍到物件（game/combat.ts 的 damageEnemy 轉過來）：砍不動，只冒火花 + 提示怎麼解 */
export function objHit(o) {
  if (o.dead) return; o.flash = .08; hitSpark(o.x, o.y - 10, false, -Math.PI / 2); sfx.hit();
  const m = o.owner.mech; if (m && G.time - m.hintT > 4) { m.hintT = G.time; toast('砍不動……引' + o.owner.def.short + '的攻擊打中它', '#e8d8b0'); }
}

/* ---- 判斷 Boss 的一招有沒有打到物件 ---- */
const angDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function covers(t, ex: number, ey: number, o): boolean {
  const R = o.r, ox = o.x, oy = o.y;
  if (t.k === 'circle') return Math.hypot(ox - (t.x ?? ex), oy - (t.y ?? ey)) < t.r + R;
  const dx = ox - ex, dy = oy - 6 - (ey - 6), d = Math.hypot(dx, dy);
  if (t.k === 'lane') { const c = Math.cos(t.a), s = Math.sin(t.a), al = dx * c + dy * s, pe = Math.abs(-dx * s + dy * c); return al > -R && al < t.L + R && pe < t.W + R; }
  if (t.k === 'sector') return d < t.r + R && (d < R || angDiff(Math.atan2(dy, dx), t.a) < t.half + R / Math.max(d, 1));
  if (t.k === 'ring') return d > t.r0 - R && d < t.r + R;
  return false;
}
/* 每幀在 Boss 的 AI 跑完之後呼叫（world/regionBoss.ts）：看這一幀 Boss 有沒有出招打到物件 */
export function mechAfter(e, dt: number) {
  const m = e.mech; if (!m) return;
  e.immune = true;                                                       // 有些招（鑽地衝出）結束時會把 immune 關掉 → 護盾還在就一直補回來
  mechHits(e, m, dt);
  // 記下這一幀的狀態給下一幀比對；正在預警的範圍蓋到的物件 → 閃白框提示「站這裡就對了」
  m.tele = e.tele; m.st = e.state; m.tx = e.x; m.ty = e.y; m.pend = (e.pend || []).slice(); m.px = e.x; m.py = e.y; m.pz = e.z || 0;
  for (const o of m.objs) o.mark = !o.dead && G.players.some(pl => !pl.dead && Math.hypot(pl.x - o.x, pl.y - o.y) < NEAR) && ((e.tele || []).some(t => covers(t, e.x, e.y, o)) || (e.pend || []).some(p => Math.hypot(o.x - p.x, o.y - p.y) < (p.r || 22) + o.r)) ? .25 : Math.max(0, o.mark - dt);
}
function mechHits(e, m, dt: number) {
  // 只有「你附近」的物件會被打中：要你自己站過去把招引過來，繞著 Boss 一整圈的大招也不會一次打壞四個
  const live = m.objs.filter(o => !o.dead && G.players.some(pl => !pl.dead && Math.hypot(pl.x - o.x, pl.y - o.y) < NEAR));
  const hit = (o, n) => bossHitObj(o, n);
  if (m.tele && e.state !== m.st)                                      // 預警放出來了（狀態從「XXWind」換成出招）→ 範圍裡的物件被打中
    for (const o of live) if (m.tele.some(t => covers(t, m.tx, m.ty, o))) hit(o, 2);
  for (const p of m.pend) if (p.t <= 0 && !(e.pend || []).includes(p))  // 從天上掉下來的一擊落地了
    for (const o of live) if (Math.hypot(o.x - p.x, o.y - p.y) < (p.r || 22) + o.r) hit(o, 2);
  const sp = Math.hypot(e.x - m.px, e.y - m.py) / Math.max(dt, 1e-3), landed = m.pz > 4 && !(e.z > 0);
  if (sp > 150 || landed) for (const o of live) if (Math.hypot(o.x - e.x, o.y - e.y) < e.r + o.r + (landed ? 18 : 4)) hit(o, 2);   // 衝撞 / 跳起來砸下來
  if (live.length) for (let i = G.projs.length - 1; i >= 0; i--) { const p = G.projs[i];   // Boss 的子彈
    if (p.owner !== 'e' || p.kind === 'rain' || !p.hc || p.hc.src !== e) continue;
    const o = live.find(o => !o.dead && Math.hypot(o.x - p.x, o.y - 8 - p.y) < (p.r || 4) + o.r); if (o) { hit(o, 1); G.projs.splice(i, 1); } }
}

/* 每幀（world/regionBoss.ts 在跑 Boss 的 AI 之前呼叫）。回傳 true = 這一幀由機制接手，不跑原本的 AI（只有暈眩的時候） */
export function mechTick(e, dt: number): boolean {
  const M = mechOf(e); if (!M) return false;
  tickBlasts(e, dt);
  if (e.mStun > 0) { e.mStun -= dt; e.state = 'idle'; e.tele = null;   // 破綻：站著不動
    if (e.z > 0) { e.z = Math.max(0, e.z - 420 * dt);   // 跳到一半被打破 → 先摔回地上（不然卡在空中打不到）
      if (e.z === 0) { dust(e.x, e.y, 'dust', 20); quakeFx(e.x, e.y, 40); shake(4, .2); sfx.boom(); } }
    return true; }
  if (!e.mech) { const i = e.mi || 0;
    if (i < AT.length && e.hp < e.maxHp * AT[i] && e.state === 'idle' && !(e.z > 8)) start(e, M); else return false; }   // z ≤ 8：巫妖、女妖一直飄著也算在地上
  const m = e.mech, d = e.def; m.t += dt;
  for (const o of m.objs) { if (o.flash > 0) o.flash -= dt;
    if (!o.dead && M.hatch && (o.hatchT -= dt) <= 0) { o.dead = true; o.hatched = true; sfx.howl();   // 孵化：跳出兩隻小怪
      for (let k = 0; k < 2; k++) { const w = makeEnemy(M.hatch, Math.max(1, e.lv - 5), o.x + rr(-12, 12), o.y + rr(-8, 8)); w.state = 'chase'; w.rbAdd = d.id; G.enemies.push(w); }
      dust(o.x, o.y, 'web', 16); } }
  if (m.objs.every(o => o.dead)) { finish(e, m.objs.every(o => !o.hatched)); return e.mStun > 0; }
  if (m.t > LIMIT) finish(e, false);                                    // 時間到：finish 會算還剩幾個物件、讓 Boss 回血
  return false;                                                          // 照常出招，只是打不到
}

/* ================= 畫 ================= */
function drawObj(o, M: MDef, list) {
  const C = M.col, x = o.x, y = o.y, fl = o.flash > 0, t = G.time + o.ph;
  if (!o.dead && o.mark > 0) list.push({ y: y - 51, f: () => {          // Boss 正在預警的範圍蓋到它 → 腳下一圈閃白光：「這一下會打中它」
    const p = .5 + .5 * Math.sin(G.time * 24); ctx.globalAlpha = .6 + .4 * p; ctx.lineWidth = HK * 5;
    ctx.strokeStyle = '#1a1020'; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y), 17, 7.5, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = HK * 3; ctx.strokeStyle = p > .5 ? '#ffffff' : '#ffe38a'; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y), 17, 7.5, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } });
  if (o.dead) { if (M.obj === 'vent' && !o.hatched) list.push({ y: y - 50, f: () => { ctx.fillStyle = '#3a3646'; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y), 10, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#6a6478'; ctx.fillRect(snapF(x - 6), snapF(y - 3), 12, HK * 3); } });   // 封住的裂口：一塊石頭
    return; }
  if (M.obj === 'vent') { list.push({ y: y - 50, f: () => {                // 地上的裂口：發光、一直噴出東西
    ctx.fillStyle = '#0c0a10'; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y), 11, 5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = .6 + .4 * Math.sin(t * 5); ctx.fillStyle = fl ? '#ffffff' : C[1]; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y), 8, 3, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    for (let k = 0; k < o.maxHp; k++) { ctx.fillStyle = k < o.hp ? '#ffe38a' : 'rgba(0,0,0,.6)'; ctx.fillRect(snapF(x - 5 + k * 4), snapF(y - 14), 3, 3); } } });   // 還要砍幾下
    if (Math.random() < .4) G.parts.push({ x: x + rr(-6, 6), y: y - 2, vx: rr(-8, 8), vy: -rr(30, 70), life: .5, max: .5, col: pick(C), s: 1, g: 120 }); }
  else list.push({ y, f: () => {
    const c0 = fl ? '#ffffff' : C[0], c1 = fl ? '#ffffff' : C[1], c2 = C[2];
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y), 8, 3, 0, 0, TAU); ctx.fill();
    if (M.obj === 'crystal') { const h = 22 + Math.sin(t * 2) * 1.5; ctx.fillStyle = c0; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 6, y - h * .45); ctx.lineTo(x, y); ctx.lineTo(x - 6, y - h * .45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 3, y - h * .45); ctx.lineTo(x, y - 3); ctx.lineTo(x - 2, y - h * .45); ctx.closePath(); ctx.fill(); ctx.fillStyle = c2; ctx.fillRect(snapF(x - HK), snapF(y - h + 3), HK * 2, 6); }
    else if (M.obj === 'lantern') { ctx.fillStyle = '#2a2632'; ctx.fillRect(snapF(x - 1), snapF(y - 22), 2, 22); ctx.fillStyle = '#4a4558'; ctx.fillRect(snapF(x - 5), snapF(y - 24), 10, 3);
      ctx.fillStyle = c0; ctx.fillRect(snapF(x - 4), snapF(y - 21), 8, 9); ctx.globalAlpha = .7 + .3 * Math.sin(t * 6); ctx.fillStyle = c2; ctx.fillRect(snapF(x - 2), snapF(y - 19), 4, 5); ctx.globalAlpha = 1; }
    else if (M.obj === 'root') { ctx.fillStyle = c0; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y - 7), 8 + Math.sin(t * 3), 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(snapF(x - 1), snapF(y - 9), 5, 5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = c2; ctx.fillRect(snapF(x - 3), snapF(y - 12), 2, 2);
      for (const s of [-1, 1]) { ctx.fillStyle = C[0]; ctx.fillRect(snapF(x + s * 7), snapF(y - 2), s * 6, 2); } }
    else if (M.obj === 'egg') { const w = 1 + .08 * Math.sin(t * (M.hatch && o.hatchT < 4 ? 14 : 3)); ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(snapF(x), snapF(y - 8), 7 * w, 9 / w, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(snapF(x - 2), snapF(y - 11), 2.5, 3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = c0; ctx.fillRect(snapF(x - 4), snapF(y - 4), 8, 2);
      if (M.hatch) { const k = Math.max(0, o.hatchT) / (HATCH + 3); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(snapF(x - 8), snapF(y + 3), 16, 2); ctx.fillStyle = k < .3 ? '#ff5a5a' : '#ffe38a'; ctx.fillRect(snapF(x - 8), snapF(y + 3), 16 * k, 2); } }   // 孵化倒數
    else if (M.obj === 'banner' || M.obj === 'totem') { ctx.fillStyle = '#3a2a14'; ctx.fillRect(snapF(x - 1), snapF(y - 26), 2, 26);
      if (M.obj === 'banner') { ctx.fillStyle = c1; ctx.fillRect(snapF(x + 1), snapF(y - 25), 10, 13); ctx.fillStyle = c0; ctx.fillRect(snapF(x + 1), snapF(y - 13), 10, 2); ctx.fillStyle = c2; ctx.fillRect(snapF(x + 5), snapF(y - 21), 2, 4); }
      else { ctx.fillStyle = c0; ctx.fillRect(snapF(x - 5), snapF(y - 24), 10, 18); ctx.globalAlpha = .6 + .4 * Math.sin(t * 4); ctx.fillStyle = c2; ctx.fillRect(snapF(x - 2), snapF(y - 20), 4, 3); ctx.fillRect(snapF(x - 2), snapF(y - 14), 4, 3); ctx.globalAlpha = 1;
        if (Math.random() < .15) G.parts.push({ x: x + rr(-6, 6), y: y - 20, vx: rr(-4, 4), vy: -rr(6, 14), life: 1, max: 1, col: C[1], s: 1, drag: 1 }); } }
    else if (M.obj === 'ballista') { ctx.fillStyle = '#4a3018'; ctx.fillRect(snapF(x - 9), snapF(y - 8), 18, 4); ctx.fillRect(snapF(x - 2), snapF(y - 14), 4, 14);   // 弩砲 + 往天上拉的鎖鏈
      ctx.fillStyle = '#86603a'; ctx.fillRect(snapF(x - 9), snapF(y - 8), 18, HK * 2); ctx.fillStyle = '#8a8aa0'; for (let k = 0; k < 8; k++) ctx.fillRect(snapF(x - 1 + (k % 2)), snapF(y - 16 - k * 4), 2, 3);
      ctx.fillStyle = fl ? '#ffffff' : c1; ctx.fillRect(snapF(x - 3), snapF(y - 12), 6, 3); }
    for (let k = 0; k < o.maxHp; k++) { ctx.fillStyle = k < o.hp ? '#ffe38a' : 'rgba(0,0,0,.6)'; ctx.fillRect(snapF(x - 5 + k * 4), snapF(y - (M.obj === 'egg' ? 21 : 32)), 3, 3); }   // 還要打幾下
  } });
}
export function drawMechs(rbs, vis, list, L, addLight) {
  for (const e of rbs) { if (e.dead) continue;
    if (e.mound) { const c = e.def.aura; ctx.fillStyle = c[0]; ctx.globalAlpha = .8; ctx.beginPath(); ctx.ellipse(e.x, e.y, 13, 5.5, 0, 0, TAU); ctx.fill();   // 鑽地突襲：地面隆起的土丘
      ctx.fillStyle = c[1]; ctx.globalAlpha = .45 + .3 * Math.sin(G.time * 14); ctx.beginPath(); ctx.ellipse(e.x, e.y - 1, 7, 2.5, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    const M = mechOf(e); if (!M) continue; const m = e.mech;
    for (const b of e.mblast || []) teleCircle(b.x, b.y, BLAST.r, 1 - b.t / BLAST.delay);   // 物件碎掉後的爆炸預警
    if (e.mStun > 0) list.push({ y: e.y + 1, f: () => { for (let k = 0; k < 3; k++) { const a = G.time * 5 + k / 3 * TAU; drawStar(e.x + Math.cos(a) * 12, e.y - 38 - (e.z || 0) + Math.sin(a) * 3, 2.6, '#ffe38a'); } } });   // 破綻：頭上轉星星
    if (!m) continue;
    for (const o of m.objs) { if (vis(o.x, o.y, 40)) drawObj(o, M, list); if (!o.dead) addLight(L, o.x, o.y - 10, 28, 3); }
    list.push({ y: e.y + 2, f: () => { const r = 24 + Math.sin(G.time * 4) * 1.5, cy = e.y - 14 - (e.z || 0);   // 護盾：包住 Boss 的光球 + 連到每個物件的光線
      for (const o of m.objs) if (!o.dead) { ctx.globalAlpha = .35 + .25 * Math.sin(G.time * 6 + o.ph); ctx.strokeStyle = M.col[1]; ctx.lineWidth = HK * 3; ctx.beginPath(); ctx.moveTo(o.x, o.y - 12); ctx.lineTo(e.x, cy); ctx.stroke(); }
      ctx.globalAlpha = .22; ctx.fillStyle = M.col[1]; ctx.beginPath(); ctx.ellipse(e.x, cy, r, r * .95, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = .75; ctx.strokeStyle = M.col[2]; ctx.lineWidth = HK * 2; ctx.beginPath(); ctx.ellipse(e.x, cy, r, r * .95, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } });
  }
}
