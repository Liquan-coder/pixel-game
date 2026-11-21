/* ================= Boss 的機制（打到 66% 和 33% 血時發動） =================
   不只是「躲招 → 砍」：每隻 Boss 有一個照牠的樣子設計的機制，要解開才打得下去。

   burrow 鑽地：Boss 鑽進地底（打不到），地面隆起的土丘一直追著你，追到就從腳下衝出來（紅圈預警）。
                結界四周出現 4 個地脈裂口 → 一個一個砍到封住，Boss 就會被逼出地面、暈眩露出破綻（受到的傷害 ×1.5）。
                30 秒內沒封完 → 牠自己衝出來（沒有破綻）。熔渣蠕蟲、風蝕巨蠍、沙暴巨人、深淵水鬼
   sky    升空：飛上天 / 爬上天花板（打不到），地上只看得到影子，每隔一下就俯衝砸你。
                4 個機關（弩砲的鎖鏈、霧之圖騰……）砍完 → 被拉下來摔在地上、暈眩。巢母、熔岩巨龍、冰霜飛龍、霧林女妖
   shield 護盾：Boss 照樣打你，但被一層護盾包住（打不到），護盾連到 4 個東西上（水晶、燈籠、旗子、樹根……）。
                全部打碎 → 護盾碎掉、暈眩。有些是「卵 / 孢子囊」：太慢打破就會孵出小怪。冰晶女王、星之看守者、巫妖、蘑菇王、根縛樹心、沙王
   打機關不看傷害、看「打中幾下」（武器強不強都一樣要 3 下），所以拿什麼武器都解得開。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { DG } from '../data/items';
import { tier } from '../data/levels';
import { collides, moveEnt } from '../game/collision';
import { hurtPlayer } from '../game/combat';
import { makeEnemy } from '../game/enemies';
import { nearestPlayer } from '../game/player';
import { hitSpark, quakeFx, shake } from '../game/worldUpdate';
import { burst as dust } from './bossThemes';
import { teleCircle } from '../render/enemy';
import { drawStar } from '../render/fx';
import { toast } from '../ui/hud';
import { keepIn } from './regionBoss';

type Kind = 'burrow' | 'sky' | 'shield';
type ObjK = 'vent' | 'crystal' | 'lantern' | 'root' | 'egg' | 'banner' | 'ballista' | 'totem';
interface MDef { kind: Kind; obj: ObjK; col: string[]; name: string; hatch?: string; fx?: Record<string, number> }
const LAVA = ['#5a1408', '#f07a32', '#ffd04a'], SAND = ['#6a4a2a', '#d8b878', '#fff0c8'], WATER = ['#1a3a6a', '#4aa8e8', '#d8f4ff'], ICE = ['#2a4a78', '#a8dcff', '#ffffff'];
const MUD = ['#2a2a14', '#6a7a3a', '#c8e08a'], SNOW = ['#5e86ba', '#dce8f4', '#ffffff'], GHOST = ['#1a3a7a', '#4aa8ff', '#e0f4ff'], VOID = ['#3a1a6a', '#9a6ae8', '#e8d8ff'];
const GOLD = ['#7a4a1a', '#f2c14e', '#fff6d0'], ROOT = ['#2a3a14', '#6aa84a', '#d0f0a0'], RED = ['#5a0e14', '#e04a3a', '#ffd0a0'], SPORE = ['#3a1a4a', '#c46ad8', '#f0c8ff'];
/* key：地城 Boss = DBOSS 的 key；主線 / 區域 Boss = RBDEF 的 id。
   只有一半的 Boss 有機制（挑跟牠的樣子最搭的）；前期的 Boss（史萊姆女王、苔蝸王、守墓人、潮音巨蟹……）沒有，中期才開始出現。
   其他 Boss 照常打；要加回去就在這裡加一筆 */
export const MECH: Record<string, MDef> = {
  magmaworm:   { kind: 'burrow', obj: 'vent', col: LAVA, name: '熔岩裂口' },
  scorpion:    { kind: 'burrow', obj: 'vent', col: SAND, name: '流沙洞' },
  drowned:     { kind: 'burrow', obj: 'vent', col: WATER, name: '深水的漩渦' },
  sandgiant:   { kind: 'burrow', obj: 'vent', col: SAND, name: '流沙洞' },
  broodmother: { kind: 'sky', obj: 'egg', col: ['#8a8aa0', '#e8e8f4', '#ffffff'], name: '卵囊', hatch: 'spiderF' },
  dragon:      { kind: 'sky', obj: 'ballista', col: LAVA, name: '鎖龍弩砲' },
  frostwyrm:   { kind: 'sky', obj: 'ballista', col: ICE, name: '鎖龍弩砲' },
  mistwitch:   { kind: 'sky', obj: 'totem', col: GHOST, name: '霧之圖騰' },
  rootheart:   { kind: 'shield', obj: 'root', col: ROOT, name: '根瘤' },
  sandking:    { kind: 'shield', obj: 'crystal', col: GOLD, name: '王的卡諾卜罐' },
  icequeen:    { kind: 'shield', obj: 'crystal', col: ICE, name: '冰晶' },
  starwarden:  { kind: 'shield', obj: 'crystal', col: VOID, name: '星之柱' },
  mushking:    { kind: 'shield', obj: 'egg', col: SPORE, name: '孢子囊', hatch: 'shroom' },
  lich:        { kind: 'shield', obj: 'crystal', col: ['#1a4a1a', '#6ae04a', '#d0ffb0'], name: '命匣' },
};
const AT = [.66, .33], HITS = 3, HATCH = 11, LIMIT = 30;
export const mechOf = (e) => MECH[e.def.dg ? String(e.kind).slice(3) : e.def.id];
const dmgOf = (e, k: number) => Math.round((10 + 3 * tier(e.lv)) * k);

function start(e, M: MDef) {
  const d = e.def, objs = [];
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2;
    let r = d.R * .64, x = d.x + Math.cos(a) * r, y = d.y + Math.sin(a) * r * .8;
    for (let n = 0; n < 6 && collides(x, y, 8); n++) { r *= .82; x = d.x + Math.cos(a) * r; y = d.y + Math.sin(a) * r * .8; }
    objs.push({ obj: true, x, y, r: 9, hp: HITS, maxHp: HITS, lv: e.lv, dead: false, hatched: false, k: M.obj, owner: e, flash: 0, hatchT: M.hatch ? HATCH + k * .8 : 0, ph: rr(0, 9), kx: 0, ky: 0, state: 'obj' }); }
  e.mech = { M, t: 0, objs, mx: e.x, my: e.y, hitT: 1.6, hit: null };
  e.immune = true; e.tele = null; e.z = 0; e.state = 'idle';
  if (M.kind !== 'shield') { e.hidden = true; dust(e.x, e.y, M.kind === 'burrow' ? 'dust' : 'stars', 30); quakeFx(e.x, e.y, 40); sfx.boom(); shake(6, .5); }
  else { sfx.skill(); G.fx.push({ k: 'warp', x: e.x, y: e.y - 10, r0: 6, r1: 40, th: 4, t: 0, d: .5, col: M.col[1] }); }
  toast(M.kind === 'burrow' ? d.short + '鑽進了地底……封住四周的' + M.name + '，逼牠出來'
    : M.kind === 'sky' ? d.short + '離開了地面……打壞四周的' + M.name + '，把牠拉下來'
    : d.short + '被護盾包住了……打碎連著護盾的' + M.name + (M.hatch ? '（太慢會孵化）' : ''), M.col[2]);
}
function finish(e, clean: boolean) {
  const M: MDef = e.mech.M; e.mech = null; e.immune = false; e.hidden = false; e.mi = (e.mi || 0) + 1; e.state = 'idle'; e.t = .6;
  dust(e.x, e.y, M.kind === 'burrow' ? 'dust' : 'stars', 34); quakeFx(e.x, e.y, 50); shake(7, .4); sfx.boom();
  for (const dl of [0, .1]) G.fx.push({ k: 'warp', x: e.x, y: e.y, r0: 6, r1: 70, th: 5, delay: dl, t: 0, d: .45 + dl, col: M.col[1] });
  if (clean) { e.mStun = 4; G.hitStop = Math.max(G.hitStop, .2); toast(e.def.short + '露出了破綻！', '#ffe38a'); }
  else { sfx.howl(); toast(e.def.short + '回來了', '#ff8a6a'); }
}
/* 物件被打中（game/combat.ts 的 damageEnemy 轉過來）：不看傷害，每下 -1 */
export function objHit(o) {
  if (o.dead) return; o.hp -= 1; o.flash = .15; sfx.hit(); hitSpark(o.x, o.y - 10, false, -Math.PI / 2);
  if (o.hp <= 0) { o.dead = true; sfx.boom(); shake(3, .15); const C = o.owner.mech?.M.col || ['#888', '#ccc', '#fff'];
    for (let i = 0; i < 18; i++) { const a = rr(0, TAU), s = rr(40, 120); G.parts.push({ x: o.x, y: o.y - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .7 - 30, life: rr(.4, .8), max: .8, col: pick(C), s: 1, g: 260 }); }
    G.fx.push({ k: 'warp', x: o.x, y: o.y - 6, r0: 4, r1: 26, th: 3, t: 0, d: .35, col: C[2] }); }
}

/* 每幀（world/regionBoss.ts 在跑 Boss 的 AI 之前呼叫）。回傳 true = 這一幀由機制接手，不跑原本的 AI */
export function mechTick(e, dt: number): boolean {
  const M = mechOf(e); if (!M) return false;
  if (e.mStun > 0) { e.mStun -= dt; e.state = 'idle'; e.tele = null; return true; }   // 破綻：站著不動
  if (!e.mech) { const i = e.mi || 0;
    if (i < AT.length && e.hp < e.maxHp * AT[i] && e.state === 'idle' && !(e.z > 8)) start(e, M); else return false; }   // z ≤ 8：巫妖、女妖一直飄著也算在地上
  const m = e.mech, d = e.def; m.t += dt;
  for (const o of m.objs) { if (o.flash > 0) o.flash -= dt;
    if (!o.dead && M.hatch && (o.hatchT -= dt) <= 0) { o.dead = true; o.hatched = true; sfx.howl();   // 孵化：跳出兩隻小怪
      for (let k = 0; k < 2; k++) { const w = makeEnemy(M.hatch, Math.max(1, e.lv - 5), o.x + rr(-12, 12), o.y + rr(-8, 8)); w.state = 'chase'; w.rbAdd = d.id; G.enemies.push(w); }
      dust(o.x, o.y, 'web', 16); } }
  if (m.objs.every(o => o.dead)) { finish(e, m.objs.every(o => !o.hatched)); return M.kind !== 'shield'; }
  if (M.kind === 'shield') return false;                                 // 護盾：照常出招，只是打不到
  if (m.t > LIMIT) { for (const o of m.objs) o.dead = true; e.x = m.mx; e.y = m.my; finish(e, false); return true; }
  // 鑽地：土丘追著最近的玩家；升空：影子追得比較快
  const tg = nearestPlayer(m.mx, m.my), sp = M.kind === 'burrow' ? 70 : 105;
  if (tg && !tg.dead && !m.hit) { const dx = tg.x - m.mx, dy = tg.y - m.my, L = Math.hypot(dx, dy); if (L > 3) { m.mx += dx / L * Math.min(L, sp * dt); m.my += dy / L * Math.min(L, sp * dt); } }
  const q = { x: m.mx, y: m.my }; keepIn(q, d, 16); m.mx = q.x; m.my = q.y; e.x = m.mx; e.y = m.my;
  if (M.kind === 'burrow' && Math.random() < .5) G.parts.push({ x: m.mx + rr(-10, 10), y: m.my + rr(-4, 4), vx: rr(-20, 20), vy: -rr(20, 60), life: .4, max: .4, col: pick(M.col), s: 1, g: 300 });
  if (!m.hit) { m.hitT -= dt; if (m.hitT <= 0) m.hit = { x: m.mx, y: m.my, t: .85, T: .85, r: M.kind === 'burrow' ? 34 : 42 }; }   // 預警：紅圈慢慢填滿
  else if ((m.hit.t -= dt) <= 0) { const h = m.hit; m.hit = null; m.hitT = e.phase === 2 ? 1.5 : 1.9;
    for (const pl of G.players) if (Math.hypot(pl.x - h.x, pl.y - h.y) < h.r - DG && hurtPlayer(pl, dmgOf(e, 1.25), h.x, h.y, { stun: .45 })) hitSpark(pl.x, pl.y - 8, true, -Math.PI / 2);
    quakeFx(h.x, h.y, h.r); dust(h.x, h.y, M.kind === 'burrow' ? 'lava' : 'stars', 24); sfx.boom(); shake(5, .25);
    for (let i = 0; i < 16; i++) { const a = rr(0, TAU), s = rr(40, 140); G.parts.push({ x: h.x, y: h.y - 4, vx: Math.cos(a) * s * .6, vy: -rr(80, 200), life: rr(.4, .8), max: .8, col: pick(M.col), s: 2, g: 420 }); } }
  return true;
}

/* ================= 畫 ================= */
function drawObj(o, M: MDef, list) {
  const C = M.col, x = o.x, y = o.y, fl = o.flash > 0, t = G.time + o.ph;
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
    if (e.mStun > 0) list.push({ y: e.y + 1, f: () => { for (let k = 0; k < 3; k++) { const a = G.time * 5 + k / 3 * TAU; drawStar(e.x + Math.cos(a) * 12, e.y - 38 - (e.z || 0) + Math.sin(a) * 3, 2.6, '#ffe38a'); } } });   // 破綻：頭上轉星星
    if (!m) continue;
    for (const o of m.objs) { if (vis(o.x, o.y, 40)) drawObj(o, M, list); if (!o.dead) addLight(L, o.x, o.y - 10, 28, 3); }
    if (M.kind === 'shield') {                                           // 護盾：包住 Boss 的光球 + 連到每個物件的光線
      list.push({ y: e.y + 2, f: () => { const r = 24 + Math.sin(G.time * 4) * 1.5;
        for (const o of m.objs) if (!o.dead) { ctx.globalAlpha = .35 + .25 * Math.sin(G.time * 6 + o.ph); ctx.strokeStyle = M.col[1]; ctx.lineWidth = HK * 3; ctx.beginPath(); ctx.moveTo(o.x, o.y - 12); ctx.lineTo(e.x, e.y - 14); ctx.stroke(); }
        ctx.globalAlpha = .22; ctx.fillStyle = M.col[1]; ctx.beginPath(); ctx.ellipse(e.x, e.y - 14, r, r * .95, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = .75; ctx.strokeStyle = M.col[2]; ctx.lineWidth = HK * 2; ctx.beginPath(); ctx.ellipse(e.x, e.y - 14, r, r * .95, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } });
      continue; }
    if (M.kind === 'burrow') { ctx.fillStyle = M.col[0]; ctx.globalAlpha = .75; ctx.beginPath(); ctx.ellipse(m.mx, m.my, 14, 6, 0, 0, TAU); ctx.fill();   // 土丘（地面在動）
      ctx.fillStyle = M.col[1]; ctx.globalAlpha = .5 + .3 * Math.sin(G.time * 12); ctx.beginPath(); ctx.ellipse(m.mx, m.my - 1, 8, 3, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(m.mx, m.my, 20 + Math.sin(G.time * 2) * 3, 8, 0, 0, TAU); ctx.fill(); }   // 天上的影子
    if (m.hit) teleCircle(m.hit.x, m.hit.y, m.hit.r, 1 - m.hit.t / m.hit.T);
  }
}
void moveEnt;
