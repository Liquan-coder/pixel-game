import { G } from '../core/state';
import { $, TAU, clamp, pick, rr } from '../core/util';
import { HK, ctx } from '../core/canvas';
import { SPR } from '../art/monsters';
import { makeGear, makeUnique } from '../data/items';
import { TS } from './map';
import { AI, FIREC } from './bossAI';
import { drawPools } from './bossAI2';
import { flame } from './chunks';
import { sfx } from '../core/audio';
import { dropItem } from '../game/enemies';
import { oreForLevel } from '../data/forge';
import { dropGold, dropSouls, shake, dropMat } from '../game/worldUpdate';
import { artDot, artPath, drawOrb } from '../render/fx';
import { teleCircle, teleLane, teleSector, warnMark } from '../render/enemy';
import { showBanner, toast } from '../ui/hud';
import { save } from '../game/save';
import { flags } from '../game/quest';
import { nearestPlayer } from '../game/player';

export const RBDEF: Record<string, any> = {
  queen: { id:'queen', name:'史萊姆女王・翠凝', short:'史萊姆女王', sub:'聖堂的聖壇前，湖水凝成了女王', tx:34, ty:322, tr:8.5, lv:6, hp:950, kind:'queen', ai:'queen',
    ring:['#7fe07a', '#ffffff'], aura:['#7fe07a', '#c8ffc0', '#ffffff'], souls:300, gold:150,
    reward: () => { const it = makeGear('amulet', 7, 4); it.name = '翠凝之心'; it.aff = { hp:60, lifesteal:3, def:6, crit:5 }; return it; } },
  general: { id:'general', name:'骸骨將軍・朽鋼', short:'骸骨將軍', sub:'王城的中庭裡，將軍仍在守著內城', tx:100, ty:128, tr:8.5, lv:14, hp:2600, kind:'general', ai:'general',
    ring:['#e8d6b0', '#ffffff'], aura:['#ff9a3a', '#ffd27a', '#ffffff'], souls:900, gold:400,
    reward: () => { const it = makeGear('mail', 15, 4); it.name = '朽鋼胸甲'; it.def = Math.round(it.def * 1.15); it.aff = { hp:90, def:10, crit:6 }; return it; } },
  dragon: { id:'dragon', name:'熔岩巨龍・燼翼', short:'熔岩巨龍', sub:'要塞鎖住的火口深處，傳來低吼', tx:330, ty:68, tr:9.5, lv:21, hp:4200, kind:'dragon', ai:'dragon',
    ring:['#ff8a3a', '#fff0a0'], aura:['#ff6a2a', '#ffb040', '#fff0a0'], souls:2000, gold:800,
    reward: () => { return makeUnique('emberstaff'); } },
  mushking: { id:'mushking', name:'蘑菇王・孢冠', short:'蘑菇王', sub:'森林深處的菌絲在顫動', tx:212, ty:342, tr:8.5, lv:10, hp:1700, kind:'mushking', ai:'mushking',
    ring:['#c46ad8', '#ffffff'], aura:['#c46ad8', '#f0c8ff', '#ffffff'], souls:550, gold:260,
    reward: () => { const it = makeGear('ring', 11, 4); it.name = '孢冠指環'; it.aff = { crit:8, hp:45, lifesteal:3, cdr:10 }; return it; } },
  yeti: { id:'yeti', name:'雪原巨人・霜鬃', short:'雪原巨人', sub:'城塞中庭的雪動了起來', tx:600, ty:34, tr:9.5, lv:25, hp:5600, kind:'yeti', ai:'yeti',
    ring:['#a8dcff', '#ffffff'], aura:['#7ab8e8', '#dcecff', '#ffffff'], souls:3000, gold:1100,
    reward: () => { return makeUnique('frostmaul'); } },
  lich: { id:'lich', name:'沼澤巫妖・腐沼', short:'沼澤巫妖', sub:'大殿的主人睜開了眼睛', tx:590, ty:442, tr:9.5, lv:30, hp:7000, kind:'lich', ai:'lich',
    ring:['#6ae04a', '#d0ffb0'], aura:['#3ac83a', '#9aff6a', '#eaffd0'], souls:4200, gold:1500,
    reward: () => { return makeUnique('rotscythe'); } },
  /* ---- 區域 Boss（不是主線）：每個地區一隻，守在地標上。沿用主線 Boss 的招式（ai），dmgMul = 傷害照等級縮放 ---- */
  mossguard: { id:'mossguard', name:'古哨堡的守衛・苔甲', short:'苔甲守衛', sub:'哨堡的中庭裡，長滿青苔的盔甲站了起來', tx:180, ty:482, tr:8.5, lv:5, hp:800, kind:'generalMoss', ai:'general', dmgMul:.5, region:true,
    ring:['#8ad86a', '#ffffff'], aura:['#5aa04a', '#c8f0a0', '#ffffff'], souls:260, gold:120,
    reward: () => { const it = makeGear('leather', 6, 3); it.name = '苔甲護胸'; it.aff = { hp:40, def:5, lifesteal:2 }; return it; } },
  mistwitch: { id:'mistwitch', name:'霧林女妖・薄暮', short:'霧林女妖', sub:'學塔裡的霧，凝成了一個人影', tx:372, ty:252, tr:9.5, lv:9, hp:1500, kind:'lichMist', ai:'lich', dmgMul:.4, region:true,
    ring:['#a8c8e8', '#ffffff'], aura:['#7a9ab8', '#d0e4f8', '#ffffff'], souls:520, gold:240,
    reward: () => { const it = makeGear('robe', 10, 3); it.name = '薄暮霧衣'; it.aff = { hp:50, cdr:10, crit:5 }; return it; } },
  sandgiant: { id:'sandgiant', name:'沙暴巨人・赭鬃', short:'沙暴巨人', sub:'巨獸的骨頭之間，沙子站了起來', tx:118, ty:250, tr:9.5, lv:13, hp:2400, kind:'yetiSand', ai:'yeti', dmgMul:.6, region:true,
    ring:['#e8c890', '#ffffff'], aura:['#c8a060', '#f0dcb0', '#ffffff'], souls:850, gold:380,
    reward: () => { const it = makeGear('ring', 14, 3); it.name = '赭鬃指環'; it.aff = { crit:7, hp:60, def:6 }; return it; } },
  slagmother: { id:'slagmother', name:'熔渣母體・沸', short:'熔渣母體', sub:'熔爐後院的廢渣坑，冒出一個巨大的泡泡', tx:380, ty:139, tr:8.5, lv:18, hp:3400, kind:'queenSlag', ai:'queen', dmgMul:2.1, region:true,
    ring:['#ff9a4a', '#fff0a0'], aura:['#e8743b', '#ffd27a', '#fff4c0'], souls:1500, gold:620,
    reward: () => { const it = makeGear('amulet', 19, 3); it.name = '沸騰之心'; it.aff = { hp:90, lifesteal:3, crit:6 }; return it; } },
  frostwyrm: { id:'frostwyrm', name:'冰霜飛龍・凜翼', short:'冰霜飛龍', sub:'湖心島的冰裂開了', tx:560, ty:174, tr:9.5, lv:23, hp:4800, kind:'dragonFrost', ai:'dragon', dmgMul:1.1, region:true,
    ring:['#a8dcff', '#ffffff'], aura:['#7ab8e8', '#dcecff', '#ffffff'], souls:2500, gold:950,
    reward: () => { const it = makeGear('mail', 24, 3); it.name = '凜翼鱗甲'; it.aff = { hp:110, def:12, crit:5 }; return it; } },
  toxqueen: { id:'toxqueen', name:'毒菇母后・紫冠', short:'毒菇母后', sub:'菇園裡的菇全都轉向了你', tx:522, ty:286, tr:8.5, lv:28, hp:6300, kind:'mushToxic', ai:'mushking', dmgMul:2.2, region:true,
    ring:['#c46ad8', '#ffffff'], aura:['#8a3ab0', '#e0a8ff', '#ffffff'], souls:3800, gold:1300,
    reward: () => { const it = makeGear('ring', 29, 3); it.name = '紫冠指環'; it.aff = { crit:9, cdr:12, lifesteal:4, hp:80 }; return it; } },
};
for (const d of Object.values(RBDEF)) { d.x = d.tx * TS + 8; d.y = d.ty * TS + 8; d.R = d.tr * TS; }
export let rbs = [];
export const rbDead = new Set();
function makeRB(d) { return { rb:true, boss:true, def:d, id:d.id, kind:d.kind, beh:'slime', x:d.x, y:d.y, r:14, lv:d.lv, hp:d.hp, maxHp:d.hp, state:'sleep', t:0, wt:0, phase:1,
  flash:0, kx:0, ky:0, stun:0, flip:false, anim:0, aim:0, z:0, tele:null, splitT:0 }; }
export function resetRegionBosses() {
  G.enemies = G.enemies.filter(e => !e.rbAdd);
  rbs = Object.values(RBDEF).filter(d => !rbDead.has(d.id) && !(d.dg && flags.has('dgn:' + d.dg))).map(makeRB);   // 地城 Boss：打倒過（舊存檔的守護者也算）就不再出現
}
export const fightingRB = () => rbs.find(e => !e.dead && e.state !== 'sleep');
export function nearZone() { if (G.me.dead || fightingRB()) return null;                  // 給 HUD 用：「我」是否站在結界邊
  for (const e of rbs) { if (e.dead || e.state !== 'sleep') continue; const d = e.def, k = Math.hypot(G.me.x - d.x, G.me.y - d.y); if (k < d.R + 44 && k > d.R - 16) return d; } return null; }
export function rbWind(e, st, t, tele?) { e.state = st; e.t = e.wt = t; e.tele = tele || null; }
export function keepIn(o, d, r) { const dx = o.x - d.x, dy = o.y - d.y, L = Math.hypot(dx, dy), m = d.R - r; if (L > m) { o.x = d.x + dx / L * m; o.y = d.y + dy / L * m; } }
function startRB(e) {
  e.state = 'intro'; e.t = 1.4; $('bossBar').hidden = false; $('bossBar').querySelector('.bname').textContent = e.def.name;
  showBanner(e.def.name, e.def.sub, 2200); sfx.howl(); shake(5, .6);
  G.fx.push({ k:'warp', x:e.def.x, y:e.def.y, r0:e.def.R * .2, r1:e.def.R, th:4, sy:1, t:0, d:.6, col:e.def.ring[1] });
}
// 結界：把在結界裡（或剛好在邊上）的玩家關在裡面；離很遠的隊友不會被吸進來
function keepPlayersIn(d) { for (const pl of G.players) if (Math.hypot(pl.x - d.x, pl.y - d.y) < d.R + 20) keepIn(pl, d, pl.r + 2); }
export function updateRegionBosses(dt) {
  for (const e of rbs) {
    if (e.dead) continue; e.anim += dt; if (e.flash > 0) e.flash -= dt; const d = e.def;
    if (e.state === 'sleep') { if (G.players.some(pl => !pl.dead && Math.hypot(pl.x - d.x, pl.y - d.y) < d.R - 14)) startRB(e); continue; }
    if (e.state === 'intro') { e.t -= dt; keepPlayersIn(d); if (e.t <= 0) { e.state = 'idle'; e.t = .6; } continue; }
    e.tgt = nearestPlayer(e.x, e.y);                                  // 每幀瞄準最近的活著的玩家
    if (e.tgt.dead) continue;
    if (e.phase === 1 && e.hp < e.maxHp * .5) {
      e.phase = 2; toast(d.short + '發怒了！', '#ff6a5a'); G.hitStop = Math.max(G.hitStop, .25); shake(6, .5);
      G.fx.push({ k:'flash', col:d.aura[0], a:.3, t:0, d:.45 });
      for (const dl of [0, .1, .2]) G.fx.push({ k:'warp', x:e.x, y:e.y, r0:8, r1:70, th:5, delay:dl, t:0, d:.5 + dl, col:d.aura[0] });
    }
    if (e.splitT > 0) e.splitT -= dt;
    const dx = e.tgt.x - e.x, dy = e.tgt.y - e.y, dist2 = Math.hypot(dx, dy);
    const n0 = G.projs.length; G.dmgMul = d.dmgMul || 1;
    AI[d.ai](e, dt, dist2, dx, dy);
    for (let i = n0; i < G.projs.length; i++) if (G.projs[i].owner === 'e' && !G.projs[i].scaled) { G.projs[i].dmg = Math.max(1, Math.round(G.projs[i].dmg * G.dmgMul)); G.projs[i].scaled = true; }
    G.dmgMul = 1;
    keepPlayersIn(d); if (!(e.z > 0)) keepIn(e, d, e.r);
    if (e.phase === 2 && Math.random() < .4) G.parts.push({ x:e.x + rr(-16, 16), y:e.y - rr(4, 26), vx:rr(-5, 5), vy:-rr(20, 40), life:.6, max:.6, col:pick(d.aura), star:rr(.5, 1.4), drag:1 });
  }
}
export function regionBossDie(e, by) {                                  // by = 打死它的玩家
  const d = e.def; e.dead = true; rbDead.add(d.id); G.enemies = G.enemies.filter(x => x.rbAdd !== d.id); $('bossBar').hidden = true;
  G.hitStop = Math.max(G.hitStop, .4); G.fx.push({ k:'flash', col:'#ffffff', a:.7, t:0, d:.6 });
  for (const dl of [0, .12, .24]) G.fx.push({ k:'warp', x:e.x, y:e.y, r0:6, r1:90, th:5, delay:dl, t:0, d:.6 + dl, col:dl ? '#f2c14e' : d.aura[0] });
  for (let i = 0; i < 40; i++) G.parts.push({ x:e.x + rr(-12, 12), y:e.y - rr(0, 24), vx:rr(-15, 15), vy:-rr(40, 140), life:rr(.7, 1.4), max:1.4, col:pick(d.aura.concat(['#f2c14e', '#b49cff'])), star:rr(1, 3), drag:1 });
  dropSouls(e.x, e.y, d.souls, by);
  const it = d.reward(); dropItem(it, e.x, e.y); dropGold(e.x, e.y, d.gold);
  dropMat(e.x, e.y, oreForLevel(d.lv), 3, by); if (d.star !== false) dropMat(e.x, e.y, 'ore4', 1, by);       // Boss 一定掉礦石；區域 Boss 和 20 級以上的地城 Boss 還有一顆強化 +10 用的隕星鐵
  if (d.dg) flags.add('dgn:' + d.dg);                                                    // 地城 Boss：最深處的金箱解開封印、以後不再出現
  sfx.win(); shake(8, .8); showBanner(d.dg ? '守護者倒下了' : '強敵已擊敗', '掉落：' + it.name + (d.dg ? ' · 最深處的寶箱解開了封印' : ''), 3200); save();
}
export function drawBarrier(e, faint?) {                                       // 結界：場地邊緣一圈會流動的虛線光（還沒開打時淡淡地顯示）
  const d = e.def, n = Math.ceil(TAU * d.R / HK), a0 = ctx.globalAlpha = faint ? .35 + .15 * Math.sin(G.time * 3) : 1;
  for (const [L, col] of [[1, d.ring[0]], [2, d.ring[1]]]) { ctx.fillStyle = col; artPath();
    for (let i = 0; i < n; i++) { const u = i / n, ph = (u * 36 + G.time * (L === 1 ? .6 : -1)) % 1; if (L === 1 ? ph > .7 : ph > .25) continue;
      const a = u * TAU; artDot(d.x + Math.cos(a) * d.R, d.y + Math.sin(a) * d.R, L === 1 ? 3 : 1); }
    ctx.globalAlpha = a0 * (L === 1 ? .8 : 1); ctx.fill(); }
  ctx.globalAlpha = a0;
  if (faint) { ctx.globalAlpha = 1; return; }
  if (Math.random() < .5) { const a = rr(0, TAU); G.parts.push({ x:d.x + Math.cos(a) * d.R, y:d.y + Math.sin(a) * d.R, vx:0, vy:-20, life:.6, max:.6, col:d.ring[1], star:rr(.6, 1.5), drag:1 }); }
}
/* RB_L → 已移到 G（core/state.js） */
const vis2 = (x, y) => Math.abs(x - G.me.x) < 260 && Math.abs(y - G.me.y) < 180;   // 畫面附近才畫
export function drawRBTele(e) {
  const q = e.wt ? clamp(1 - e.t / e.wt, 0, 1) : 0;
  if (/Wind$/.test(e.state)) warnMark(e.x, e.y - SPR[e.kind].h - 6 - (e.z || 0));
  drawPools(e);
  for (const m of e.pend || []) teleCircle(m.x, m.y, m.r || 22, clamp(1 - m.t / m.T, 0, 1));
  if (e.state === 'breath' && e.glow) { const [gx, gy, ga] = e.glow; drawOrb(gx, gy, 6 + Math.sin(G.time * 40), FIREC); for (const k of [30, 60, 90]) G.RB_L.push({ x:gx + Math.cos(ga) * k, y:gy + Math.sin(ga) * k, r:46, warm:1 }); }
  for (const b of e.burns || []) { if (vis2(b.x, b.y)) flame(b.x + Math.sin(b.ph) * 2, b.y + 2, 3 + 2 * Math.min(1, b.t), b.ph); }
  for (const t of e.tele || []) { const qq = t.q !== undefined ? t.q : q;
    if (t.k === 'circle') teleCircle(t.x !== undefined ? t.x : e.x, t.y !== undefined ? t.y : e.y, t.r, qq);
    else if (t.k === 'lane') teleLane(e.x, e.y - 6, t.a, t.L, t.W, qq);
    else if (t.k === 'sector') teleSector(e.x, e.y - 6, t.r, t.a, t.half, qq); }
}
