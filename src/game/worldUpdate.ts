import { projTrail } from '../world/bossThemes';
import { G } from '../core/state';
import { updateNPCs } from '../world/towns';
import { updateQuest } from './quest';
import { TAU, pick, rr } from '../core/util';
import { HK, LH, LW, ctx, snapF } from '../core/canvas';
import { COIN_SP, ICON, RAR, SOUL_SP } from '../data/items';
import { MATS, ORE_SP, ORE_TO_MAT } from '../data/forge';
import { BLOCKP, TS, spawns } from '../world/map';
import { updateRegionBosses } from '../world/regionBoss';
import { tileAt } from '../world/gen';
import { cam } from './player';
import { moveEnt } from './collision';
import { sfx } from '../core/audio';
import { streamSpawns, updateEnemy } from './enemies';
import { updateBoss } from './boss';
import { aoeHit, damageEnemy, hurtPlayer, targets } from './combat';
import { tickWeaponFx } from './weaponFx';
import { tickBuilds } from './builds';
import { sigProj, sigTick } from './signatures';
import { updatePlayer } from './playerUpdate';
import { STARC, asn } from '../render/fx';
import { gain, toast } from '../ui/hud';
import { nearestPlayer } from './player';
import { SET } from '../ui/pause';
import { updatePuzzles } from '../world/puzzles';
import { updateSecrets } from '../world/secrets';

/* ================= WORLD UPDATE ================= */
/* 剛射出去的子彈記住是誰射的（G.hitCtx），打中人的時候才算得出等級差和異常狀態 */
export function tagProjs(n0: number) { for (let i = n0; i < G.projs.length; i++) if (G.projs[i].owner === 'e' && G.projs[i].hc === undefined) G.projs[i].hc = G.hitCtx; }
function updateProjectiles(dt) {
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i];
    if (p.home && p.owner === 'e') { const tg = nearestPlayer(p.x, p.y);         // 追蹤彈：慢慢轉向最近的玩家（轉得不快，繞圈或瞬移就甩得掉）
      if (tg && !tg.dead) { const sp = Math.hypot(p.vx, p.vy), cur = Math.atan2(p.vy, p.vx), want = Math.atan2(tg.y - 6 - p.y, tg.x - p.x);
        let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); const a = cur + Math.max(-p.home * dt, Math.min(p.home * dt, d)); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; } }
    if (p.owner === 'e') bossProjMotion(p, dt);                        // Boss 彈幕：轉彎 / 停住再追 / 結界裡反彈
    if (p.ret) boomMotion(p, dt);
    if (p.owner === 'p' && p.by) sigProj(p, dt);                         // 獨特武器：法彈追蹤、王之箭分裂、沙暴月、暗月光                                        // 月牙刀的月牙：飛出去一段，再飛回主人手上
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    let dead = p.life <= 0 || (p.kind !== 'rain' && !p.arena && BLOCKP.has(tileAt(Math.floor(p.x / TS), Math.floor((p.y + 6) / TS))));
    if (p.back && Math.hypot(p.by.x - p.x, p.by.y - 7 - p.y) < 12) dead = true;   // 月牙飛回手上
    if (!dead && p.arena) dead = bounceIn(p);
    if (p.kind === 'fire' && Math.random() < .8) G.parts.push({ x:p.x, y:p.y, vx:rr(-15, 15), vy:rr(-15, 15), life:.3, max:.3, col: Math.random() < .5 ? '#f2c14e' : '#e8743b', s:2 });
    if (p.kind === 'ember' && Math.random() < .7) G.parts.push({ x:p.x + rr(-2, 2), y:p.y + rr(-2, 2), vx:-p.vx * .1, vy:-p.vy * .1 - 10, life:.35, max:.35, col:pick(p.cols ? [p.cols[1], p.cols[2]] : ['#ffb040', '#ff6a2a']), s:1 });
    if (p.kind === 'glob' && Math.random() < .5) G.parts.push({ x:p.x + rr(-2, 2), y:p.y + rr(-2, 2), vx:0, vy:10, life:.4, max:.4, col:p.cols ? p.cols[1] : '#4fbf5a', s:1, g:60 });
    if (p.kind === 'claw' && Math.random() < .7) G.parts.push({ x:p.x + rr(-3, 3), y:p.y + rr(-3, 3), vx:-p.vx * .1, vy:-p.vy * .1, life:.3, max:.3, col:pick(p.cols ? [p.cols[1], '#ffffff'] : ['#ff5a5a', '#ffd0d0']), star:rr(.6, 1.6), drag:3 });
    if ((p.kind === 'bolt' && Math.random() < .6) || p.kind === 'orb' || ((p.kind === 'wave' || p.kind === 'boom') && Math.random() < .8) || (p.kind === 'arrow' && !p.wood && Math.random() < .8))   // 木箭（長弓）不拖綠光
      G.parts.push({ x:p.x + rr(-2, 2), y:p.y + rr(-2, 2), vx:-p.vx * .1 + rr(-15, 15), vy:-p.vy * .1 + rr(-15, 15), life:rr(.2, .4), max:.4, col:pick(p.kind === 'arrow' ? ['#3fd86a', '#b8ffc8', '#ffffff'] : (p.kind === 'wave' || p.kind === 'boom') && p.cols ? [p.cols[1], '#ffffff'] : STARC), star:rr(.6, p.kind === 'orb' ? 2.4 : 1.6), drag:3 });
    projTrail(p);                                                      // Boss 專屬子彈的拖尾（world/bossThemes.ts）
    if (p.kind === 'spore' && Math.random() < .3) G.parts.push({ x:p.x, y:p.y, vx:0, vy:-5, life:.4, max:.4, col:'#c46ad8', s:1 });
    if (!dead && p.owner === 'e') {
      for (const pl of G.players) if (!dead && Math.hypot(pl.x - p.x, pl.y - 6 - p.y) < p.r + pl.r - 4) { G.hitCtx = p.hc || null; hurtPlayer(pl, p.dmg, p.x, p.y, p.fx); G.hitCtx = null; dead = true; }   // 打到哪個玩家就傷哪個
    } else if (!dead && p.owner === 'p' && p.kind !== 'rain') {
      for (const e of targets(p.by)) if (Math.hypot(e.x - p.x, e.y - 6 - p.y) < p.r + e.r) {
        const m = projMult(p, e);
        if (p.pierce) { if (p.hit.has(e)) continue; p.hit.add(e); damageEnemy(p.by, e, m, p.x, p.y, { heavy:!p.light }); continue; }   // light = 小劍氣、普通的箭（不停頓）
        if (p.kind === 'fire') explode(p); else if (p.kind === 'orb') explodeOrb(p); else damageEnemy(p.by, e, m, p.x, p.y);
        dead = true; p.exploded = true; break; }
    }
    if (dead && p.kind === 'rain') rainLand(p);
    if (dead) { if (p.kind === 'fire' && !p.exploded) explode(p); if (p.kind === 'orb' && !p.exploded) explodeOrb(p); if (p.shatter) shatter(p); G.projs.splice(i, 1); }
  }
}
/* ---- Boss 彈幕的特殊行為（子彈身上有這些欄位才會動）----
   curve：每秒轉幾弧度（射出去的一圈會變成漩渦）
   pause：[飛幾秒, 停幾秒, 重新出發的速度] → 停在半空中，時間到全部轉向最近的玩家再射出去
   arena：{x, y, R} + bounce：在結界裡碰到邊就反彈，彈完次數才消失（不會被牆擋掉）
   shatter：{n, spd, k}：消失 / 打中人時碎成 n 片往四面八方飛（每片傷害 = 本體 × k） */
function bossProjMotion(p, dt) {
  if (p.curve) { const c = Math.cos(p.curve * dt), s = Math.sin(p.curve * dt), vx = p.vx; p.vx = vx * c - p.vy * s; p.vy = vx * s + p.vy * c; }
  if (p.pause) { const [t1, t2, sp] = p.pause; p.age = (p.age || 0) + dt;
    if (!p.held && p.age > t1) { p.held = 1; p.vx = p.vy = 0; }
    else if (p.held === 1 && p.age > t1 + t2) { p.held = 2; const tg = nearestPlayer(p.x, p.y), a = Math.atan2(tg.y - 6 - p.y, tg.x - p.x); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; } }
}
/* 長弓的箭：飛越遠越痛。射出去的地方 → 打中的地方，0 px ×0.8、150 px 以上 ×1.35；遠距離命中會閃一圈白光 */
const FAR = 150;
function projMult(p, e) {
  if (!p.far) return p.mult;
  const d = Math.hypot(p.x - p.x0, p.y - p.y0), k = Math.min(1, d / FAR);
  if (k > .8) G.fx.push({ k:'warp', x:e.x, y:e.y - 8, r0:3, r1:14, th:2, t:0, d:.18, col:'#ffffff' });
  return p.mult * (.8 + .55 * k);
}
function boomMotion(p, dt) {
  p.age = (p.age || 0) + dt;
  if (p.age < p.ret) {                                                  // 去程：附近有還沒砍到的敵人 → 轉過去追（月牙刀）；沒有 → 慢慢減速
    let tg = null, bd = 100; const cur0 = Math.atan2(p.vy, p.vx);
    if (p.seek) for (const e of targets(p.by)) { if (e.hp <= 0 || p.hit.has(e) || e.obj) continue;      // 只追前方 70 度以內、還沒被別的月牙盯上的（三道月牙才會分頭砍）
      if (e.moonBy && e.moonBy !== p && G.projs.includes(e.moonBy) && !e.moonBy.back && !e.moonBy.hit.has(e)) continue;
      const d = Math.hypot(e.x - p.x, e.y - 7 - p.y), da = Math.atan2(e.y - 7 - p.y, e.x - p.x) - cur0; if (d > 20 && Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) > 1.22) continue;
      if (d < bd) { bd = d; tg = e; } }
    if (tg) tg.moonBy = p;
    if (tg) { const sp = Math.max(230, Math.hypot(p.vx, p.vy)), cur = Math.atan2(p.vy, p.vx); let d = Math.atan2(tg.y - 7 - p.y, tg.x - p.x) - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
      const a = cur + Math.max(-9 * dt, Math.min(9 * dt, d)); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; }
    else { const k = 1 - 1.6 * dt; p.vx *= k; p.vy *= k; }
    return; }
  if (!p.back) { p.back = true; p.hit = new Set(); p.sp = Math.max(260, Math.hypot(p.vx, p.vy) * 1.4); }   // 回程：同一隻可以再被砍一次
  const dx = p.by.x - p.x, dy = p.by.y - 7 - p.y, d = Math.hypot(dx, dy) || 1; p.sp += 500 * dt;
  p.vx = dx / d * p.sp; p.vy = dy / d * p.sp;
}
/* 箭雨：每一支箭等 wait 秒落地（期間不會打到東西），落地時炸一小圈 */
function rainLand(p) {
  aoeHit(p.by, p.x, p.y, 12, p.mult);
  G.fx.push({ k:'warp', x:p.x, y:p.y, r0:2, r1:10, th:2, t:0, d:.18, col:p.cols ? p.cols[1] : '#ffffff' });
  for (let i = 0; i < 5; i++) { const a = rr(0, TAU), v = rr(30, 80); G.parts.push({ x:p.x, y:p.y, vx:Math.cos(a) * v, vy:Math.sin(a) * v * .5 - 20, life:.3, max:.3, col:pick(['#d8ccb0', '#b8a888', '#ffffff']), s:1, g:120, drag:3 }); }
}
function bounceIn(p): boolean {
  const A = p.arena, dx = p.x - A.x, dy = p.y - A.y, L = Math.hypot(dx, dy), m = A.R - p.r;
  if (L <= m) return false; if (!(p.bounce > 0)) return true;
  const nx = dx / L, ny = dy / L, dot = p.vx * nx + p.vy * ny;
  if (dot > 0) { p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; }
  p.x = A.x + nx * m; p.y = A.y + ny * m; p.bounce--; shake(2, .08); sfx.boom();
  for (let i = 0; i < 6; i++) G.parts.push({ x:p.x, y:p.y, vx:rr(-60, 60) - nx * 60, vy:rr(-60, 20) - ny * 40, life:.4, max:.4, col:pick(p.cols || ['#ffffff']), s:2, g:300 });
  return false;
}
function shatter(p) {
  const S = p.shatter, a0 = rr(0, TAU); p.shatter = null;
  for (let i = 0; i < S.n; i++) { const a = a0 + i / S.n * TAU;
    G.projs.push({ x:p.x, y:p.y, vx:Math.cos(a) * S.spd, vy:Math.sin(a) * S.spd, r:4, life:1.2, dmg:Math.max(1, Math.round(p.dmg * S.k)), owner:'e', kind:'claw', R:10, th:4, cols:p.cols,
      hc:p.hc, scaled:true, themed:true }); }
  G.fx.push({ k:'warp', x:p.x, y:p.y, r0:4, r1:26, th:4, t:0, d:.3, col:(p.cols || ['#ffffff', '#ffffff'])[1] }); sfx.boom(); shake(3, .12);
}
function explodeOrb(p) {                                              // 星爆：大光圈 + 魔法陣 + 星光（滿蓄力分裂成六顆小魔彈）
  p.exploded = true; aoeHit(p.by, p.x, p.y + 6, p.rad, p.mult, { heavy:true });
  G.fx.push({ k:'warp', x:p.x, y:p.y + 6, r0:4, r1:p.rad, th:5, t:0, d:.4, col:'#b49cff' }); G.fx.push({ k:'rune', x:p.x, y:p.y + 6, r:p.rad * .6, t:0, d:.5, rot:rr(0, TAU) });
  for (let i = 0; i < 18; i++) { const a = rr(0, TAU), sp = rr(60, 160); G.parts.push({ x:p.x, y:p.y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp * .7, life:rr(.3, .6), max:.6, col:pick(STARC), star:rr(1, 3), drag:4 }); }
  if (p.split) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3; G.projs.push({ x:p.x, y:p.y, vx:Math.cos(a) * 220, vy:Math.sin(a) * 220, r:3, life:.45, mult:.7, owner:'p', by:p.by, kind:'bolt' }); }
  sfx.boom(); shake(5, .22);
}
export function quakeFx(x, y, R, red?) {                                            // 震地：擴散的震波 + 放射狀裂痕 + 碎石
  const rays = []; for (let i = 0; i < 7; i++) rays.push({ a:i / 7 * TAU + rr(-.3, .3), len:R * rr(.5, .9) });
  G.fx.push({ k:'quake', x, y, r:R, rays, red, t:0, d:.55 });
  for (let i = 0; i < 16; i++) { const a = rr(0, TAU), sp = rr(40, 120); G.parts.push({ x:x + Math.cos(a) * 6, y, vx:Math.cos(a) * sp, vy:-rr(60, 140), life:rr(.4, .7), max:.7, col:pick(['#8a7a64', '#5a4a3a', '#c8b496', '#ffb040']), s:1, g:420 }); }
}
export function hitSpark(x, y, crit, a) {                                     // 受擊：小光圈 + 順著攻擊方向噴出的星光
  G.fx.push({ k:'warp', x, y, r0:2, r1:crit ? 12 : 8, th:2, sy:1, t:0, d:.13, col:crit ? '#ffd84a' : '#ffffff' });
  for (let i = 0; i < (crit ? 7 : 4); i++) { const b = a + rr(-.9, .9), sp = rr(60, 140); G.parts.push({ x, y, vx:Math.cos(b) * sp, vy:Math.sin(b) * sp, life:rr(.15, .3), max:.3, col:crit ? '#ffd84a' : '#ffffff', star:rr(.8, crit ? 2.6 : 1.8), drag:7 }); }
}
export function killFx(e) {                                                    // 擊殺：紫色魂光往上飄 + 一圈光
  G.fx.push({ k:'warp', x:e.x, y:e.y, r0:3, r1:e.elite ? 26 : 16, th:3, t:0, d:.35, col:'#b49cff' });
  for (let i = 0; i < (e.elite ? 16 : 8); i++) G.parts.push({ x:e.x + rr(-6, 6), y:e.y - rr(2, 12), vx:rr(-12, 12), vy:-rr(30, 70), life:rr(.5, .9), max:.9, col:pick(['#b49cff', '#e8dcff', '#9a7cff']), star:rr(.8, 2), drag:1.5 });
}
function explode(p) { p.exploded = true; aoeHit(p.by, p.x, p.y + 6, 40, p.mult); G.fx.push({ k:'ring', x:p.x, y:p.y, r0:6, r1:42, t:0, d:.35, col:'#f2c14e' }); burst(p.x, p.y, 26, '#e8743b', 100); sfx.boom(); shake(4, .2); }
/* ---- 金幣：掉在地上，靠近會自己飛過來 ---- */
/* coins → 已移到 G（core/state.js） */
export function dropGold(x, y, v) { if (v <= 0) return; const n = Math.min(6, 1 + Math.floor(v / 10));
  for (let i = 0; i < n; i++) G.coins.push({ x, y, z:2, vz:rr(60, 110), vx:rr(-45, 45), vy:rr(-35, 35), v:Math.floor(v / n) + (i < v % n ? 1 : 0), t:rr(0, 1), mag:false });   // 平均分，加起來剛好等於 v
  capCoins(); }
/* ---- 魂晶：打倒敵人時噴出來，落地後自己飛向打倒它的玩家（不用走過去撿，也不會漏掉） ---- */
export function dropSouls(x, y, v, by) { if (v <= 0) return; const n = Math.min(10, 1 + Math.floor(v / 15));
  for (let i = 0; i < n; i++) G.coins.push({ x, y, z:2, vz:rr(70, 120), vx:rr(-50, 50), vy:rr(-40, 40),
    v:Math.floor(v / n) + (i < v % n ? 1 : 0),                      // 平均分，餘數分給前幾顆 → 加起來剛好等於 v
    t:rr(0, .2), mag:false, soul:true, to:by });
  capCoins(); }
/* ---- 礦石、藥水：跟魂晶一樣噴出來後自己飛向玩家 ---- */
export function dropMat(x, y, mat, n, by) { if (n <= 0) return; mat = ORE_TO_MAT[mat] || mat;   // 舊的礦石名稱 → 新素材
  for (let i = 0; i < n; i++) G.coins.push({ x, y, z:2, vz:rr(70, 120), vx:rr(-40, 40), vy:rr(-30, 30), v:1, t:rr(0, .2), mag:false, mat, to:by }); }
export function dropPot(x, y, by) { G.coins.push({ x, y, z:2, vz:rr(80, 120), vx:rr(-30, 30), vy:rr(-25, 25), v:1, t:0, mag:false, pot:true, to:by }); }
function capCoins() {                                               // 地上太多就清掉最舊的「金幣」；魂晶不清
  let extra = G.coins.length - 240;
  for (let i = 0; i < G.coins.length && extra > 0;) if (!G.coins[i].soul && !G.coins[i].mat && !G.coins[i].pot) { G.coins.splice(i, 1); extra--; } else i++; }
function updateCoins(dt) {
  for (let i = G.coins.length - 1; i >= 0; i--) { const c = G.coins[i]; c.t += dt;
    if (!c.mag && (c.z > 0 || c.vz > 0)) { c.z += c.vz * dt; c.vz -= 300 * dt; const o = { x:c.x, y:c.y, r:2 }; moveEnt(o, c.vx * dt, c.vy * dt); c.x = o.x; c.y = o.y; if (c.z <= 0) { c.z = 0; c.vz = 0; } }
    const pl = c.to || nearestPlayer(c.x, c.y);                     // 吸向最近的玩家，吸住後就鎖定他
    const dx = pl.x - c.x, dy = pl.y - 6 - c.y, d = Math.hypot(dx, dy);
    const auto = c.soul || c.mat || c.pot;                          // 魂晶、礦石、藥水：一定會飛過來；金幣要走近
    if (auto ? c.t > .45 : !pl.dead && c.t > .35 && d < 52) { c.mag = true; c.to = pl; }
    if (c.mag) { const sp = 140 + 500 * Math.min(1, c.t); c.x += dx / (d || 1) * sp * dt; c.y += dy / (d || 1) * sp * dt; c.z = Math.max(0, c.z - 60 * dt);
      if (d < 7) { G.coins.splice(i, 1);
        if (c.mat) { pl.mats[c.mat] = (pl.mats[c.mat] || 0) + c.v; sfx.pick(); if (pl === G.me) gain(c.mat, MATS[c.mat].n, c.v, MATS[c.mat].c); }
        else if (c.pot) { pl.pot = Math.min(G.potMax, pl.pot + 1); sfx.pick(); if (pl === G.me) gain('pot', '藥水', 1, '#ff8a9a'); }
        else if (c.soul) { pl.souls += c.v; sfx.soul(); if (pl === G.me) gain('soul', '魂晶', c.v, '#b49cff'); }
        else { pl.gold += c.v; sfx.coin(); if (pl === G.me) gain('gold', '金幣', c.v, '#f2c14e'); }
        G.parts.push({ x:pl.x + rr(-3, 3), y:pl.y - 12, vx:rr(-10, 10), vy:-30, life:.3, max:.3, col:c.mat ? MATS[c.mat].c : c.soul ? '#e8dcff' : '#fff0a8', star:1.2, drag:3 }); } } }
}
export function drawCoin(c) { const sp = c.mat ? ORE_SP[c.mat] : c.pot ? ICON.potion : (c.soul ? SOUL_SP : COIN_SP)[Math.floor(c.t * 10) % 4], w = sp.width * HK * (c.pot ? .7 : 1), h = sp.height * HK * (c.pot ? .7 : 1);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(asn(c.x - 1.5), asn(c.y), 3, HK);
  ctx.drawImage(sp, snapF(c.x - w / 2), snapF(c.y - h - c.z + Math.sin(c.t * 5) * .6), w, h); }
function updateDrops(dt) {
  updateCoins(dt);
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i]; d.t += dt;
    if (d.z > 0 || d.vz > 0) { d.z += d.vz * dt; d.vz -= 260 * dt; const o = { x:d.x, y:d.y, r:3 }; moveEnt(o, d.vx * dt, d.vy * dt); d.x = o.x; d.y = o.y; if (d.z <= 0) { d.z = 0; d.vz = 0; } }
  }
  G.pick = G.me && !G.me.dead ? nearDrop(G.me) : null;               // 不會自動撿：靠近時顯示屬性，按攻擊鍵才撿（見 ui/interact.ts）
}
/* ---- 掉在地上的裝備：找最近的、撿起來 ---- */
export function nearDrop(pl) {
  let best = null, bd = 18;
  for (const d of G.drops) { if (d.z > 0) continue; const dd = Math.hypot(d.x - pl.x, d.y - pl.y); if (dd < bd) { bd = dd; best = d; } }
  return best;
}
export function pickUp(pl, d) {
  if (pl.inv.length >= 24) { if (pl === G.me) toast('背包滿了，先去分解一些裝備', '#ff8a8a'); return false; }
  const i = G.drops.indexOf(d); if (i < 0) return false;
  G.drops.splice(i, 1); pl.inv.push(d.item);
  if (pl === G.me) { const R = RAR[d.item.rarity]; toast('獲得 ' + R.n + '・' + d.item.name, R.c, true); sfx.pick(); }
  return true;
}
let spawnAcc = 0;
function updateSpawns(dt) {                                              // 每 0.2 秒檢查一次：復活計時 + 玩家附近的怪物生成 / 收起（game/enemies.ts 的 streamSpawns）
  spawnAcc += dt; if (spawnAcc < .2) return; const t = spawnAcc; spawnAcc = 0;
  for (const sp of spawns) if (!sp.alive) {
    sp.timer -= t;
    if (sp.timer <= 0 && G.players.every(pl => Math.hypot(sp.x - pl.x, sp.y - pl.y) > 240)) sp.alive = true;
  }
  streamSpawns();
}
function separate() {
  const list = targets(G.me).filter(e => Math.abs(e.x - G.me.x) < 260 && Math.abs(e.y - G.me.y) < 200);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
    if (d > 0 && d < m) { const push = (m - d) / 2, nx = dx / d, ny = dy / d;
      if (!a.boss) moveEnt(a, -nx * push, -ny * push); if (!b.boss) moveEnt(b, nx * push, ny * push); }
  }
}
export function burst(x, y, n, col, spd) { for (let i = 0; i < n; i++) { const a = rr(0, TAU), s = rr(spd * .3, spd); G.parts.push({ x, y, vx:Math.cos(a) * s, vy:Math.sin(a) * s - 20, life:rr(.25, .6), max:.6, col, s: Math.random() < .3 ? 2 : 1, g:120 }); } }
export function shake(m, t) { if (!SET.shake) return; G.shakeMag = Math.max(G.shakeMag, m); G.shakeT = Math.max(G.shakeT, t); }
const MOTE = { plains:{ col:'#fff4b0', vy:[-3, 3], vx:[4, 10], glow:false, n:16 }, forest:{ col:'#d8ff7a', vy:[-6, 6], vx:[-6, 6], glow:true, n:22 },
  wastes:{ col:'#d8c8a8', vy:[-2, 4], vx:[10, 22], glow:false, n:30 }, lava:{ col:'#ffb04a', vy:[-22, -10], vx:[-5, 5], glow:true, n:28 }, den:{ col:'#c8c0d8', vy:[-3, 3], vx:[-3, 3], glow:false, n:16 },
  snow:{ col:'#ffffff', vy:[14, 26], vx:[-10, 2], glow:false, n:46 }, swamp:{ col:'#9aff6a', vy:[-5, 5], vx:[-5, 5], glow:true, n:26 } };
export function updateMotes(dt) {
  const M = MOTE[G.region] || MOTE.plains;
  while (G.motes.length < M.n) G.motes.push({ x:cam.x + rr(0, LW), y:cam.y + rr(0, LH), vx:rr(M.vx[0], M.vx[1]), vy:rr(M.vy[0], M.vy[1]), life:rr(3, 7), t:0, col:M.col, glow:M.glow, ph:rr(0, 9) });
  for (let i = G.motes.length - 1; i >= 0; i--) { const m = G.motes[i]; m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.t > m.life || m.col !== M.col || m.x < cam.x - 20 || m.x > cam.x + LW + 20 || m.y < cam.y - 20 || m.y > cam.y + LH + 20) G.motes.splice(i, 1); }
}

export function update(dt) {
  G.time += dt;
  for (const pl of G.players) updatePlayer(pl, dt);
  const near = e => G.players.some(pl => Math.abs(e.x - pl.x) < 520 && Math.abs(e.y - pl.y) < 380);   // 只更新任何玩家附近的怪
  for (let i = G.enemies.length - 1; i >= 0; i--) { const e = G.enemies[i]; if (!near(e)) continue;
    const n0 = G.projs.length; G.hitCtx = e.hc || null; updateEnemy(e, dt); tagProjs(n0); }   // hitCtx = 等級差 + 異常狀態（game/combat.ts 的 hurtPlayer）
  G.hitCtx = null;
  tickWeaponFx(dt, targets(G.me));
  tickBuilds(dt);
  sigTick(dt);                                                           // 獨特武器：燈魂、螢火蟲、火海、沙暴、暗月光（game/signatures.ts）                                                        // 流派：殘影爆炸、怒氣、後搖中按的瞬移（game/builds.ts）
  updatePuzzles(dt);                                                     // 地城的機關（world/puzzles.ts）
  updateSecrets(dt);                                                     // 精靈王城的城門、密室（world/secrets.ts）
  updateNPCs(); updateQuest(); updateBoss(dt); updateRegionBosses(dt); separate(); updateProjectiles(dt); updateDrops(dt); updateSpawns(dt);
  for (let i = G.fx.length - 1; i >= 0; i--) { G.fx[i].t += dt; if (G.fx[i].t >= G.fx[i].d) G.fx.splice(i, 1); }
  for (let i = G.ghosts.length - 1; i >= 0; i--) { G.ghosts[i].life -= dt; if (G.ghosts[i].life <= 0) G.ghosts.splice(i, 1); }
  for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.life -= dt; if (p.life <= 0) { G.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; if (p.drag) { const q = Math.exp(-p.drag * dt); p.vx *= q; p.vy *= q; } }
  for (let i = G.nums.length - 1; i >= 0; i--) { G.nums[i].t += dt; if (G.nums[i].t >= G.nums[i].d) G.nums.splice(i, 1); }
  if (G.shakeT > 0) { G.shakeT -= dt; if (G.shakeT <= 0) G.shakeMag = 0; }
}

