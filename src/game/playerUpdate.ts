import { G } from '../core/state';
import { TAU, dist, pick, rr } from '../core/util';
import { LH, LW } from '../core/canvas';
import { ARENA, CAMPS, MW, REGIONS, ROAD, SUBS, TS, discovered, map } from '../world/map';
import { fightingRB, rbs, resetRegionBosses } from '../world/regionBoss';
import { cam, held, input, keys, pressed } from './player';
import { canSee, collides, moveEnt, regAt } from './collision';
import { sfx } from '../core/audio';
import { respawnAll } from './enemies';
import { resetBoss } from './boss';
import { puzzleMove } from '../world/puzzles';
import { dungeonAt } from '../world/dungeons';
import { clearStatus, locked, moveMul, rollOut, rooted, silenced, struggle, tickStatus } from './status';
import { LOAD_TIERS } from '../data/gear';
import { BOW_MIN, blinkFx, bowShot, busy, damageEnemy, dodgeCut, downPlayer, releaseCharge, stopCharge, targets, tryAttack, tryDodge, tryPot, trySkill, updFlip, updateCharge } from './combat';
import { burst, shake } from './worldUpdate';
import { STARC } from '../render/fx';
import { flashHp, hideBanner, showArea, toast } from '../ui/hud';
import { save } from './save';
import { RIDE_SPD, dismount, toggleMount, updateMount } from './mount';
import type { Player } from '../types';

/* ================= PLAYER UPDATE ================= */
/* 死掉的時候：魂晶和金幣各掉 80% 在原地（身上留 20%），走回去就全部撿回來；還沒撿又死一次，舊的那包就沒了 */
export const LOST_K = .8, KEEP_K = .2;                                // 直接寫 0.2：1 - 0.8 在電腦裡是 0.19999…，1000 魂晶會變成只留 199
/* Boss 區：狼王的巢穴（ARENA 整塊）、還活著的區域 Boss / 地城守護者的結界（多算 8 px）。
   死在這裡 → 那包放在「最後一次站在 Boss 區外面」的地方，不用再進去跟牠打才撿得到 */
export const inBossZone = (x: number, y: number) =>
  (!G.bossDead && x >= ARENA.x0 * TS && x < (ARENA.x1 + 1) * TS && y >= ARENA.y0 * TS && y < (ARENA.y1 + 1) * TS) ||
  rbs.some(e => !e.dead && Math.hypot(x - e.def.x, y - e.def.y) < e.def.R + 8);
export function updatePlayer(pl: Player, dt) {
  if (pl.dead) { pl.deathT += dt; if (pl.deathT > 2.6) respawn(pl); return; }
  if (!inBossZone(pl.x, pl.y)) { pl.safeX = pl.x; pl.safeY = pl.y; }
  if (tickStatus(pl, dt)) { downPlayer(pl); return; }                  // 中毒 / 燃燒（game/status.ts）
  for (const k of ['atkCd','skillCd','iframe','hurt','aimLock','spin','thrust','slam','comboT','blinkIn']) if (pl[k] > 0) pl[k] -= dt;
  if (pl.lunge) { pl.lunge.t -= dt; moveEnt(pl, pl.lunge.vx * dt, pl.lunge.vy * dt); G.ghosts.push({ x:pl.x, y:pl.y, flip:pl.flip, life:.2, max:.2 }); if (pl.lunge.t <= 0) pl.lunge = null; }
  if (pl.skillLock > 0) pl.skillLock -= dt;
  for (let i = pl.timers.length - 1; i >= 0; i--) { const tm = pl.timers[i]; tm.t -= dt; if (tm.t <= 0) { pl.timers.splice(i, 1); tm.fn(); } }
  if (pl.stDelay > 0) pl.stDelay -= dt; else if (!pl.charging) pl.st = Math.min(pl.maxSt, pl.st + (pl.drink > 0 ? 15 : 48) * LOAD_TIERS[pl.loadTier ?? 1].st * dt);   // 蓄力時體力不會回（不然蓄力等於免費）；太重回得慢（data/gear.ts 的負重）
  if (pl.swing) { const s = pl.swing; s.t += dt; if (s.t >= s.d) { if (s.anim) { const g = s.f + s.r1 * s.sd; pl.wFrom = s.ranged ? g : Math.atan2(Math.sin(g) * s.sy, Math.cos(g)); pl.wRec = pl.wRecD = s.back; pl.wTy = s.ty; pl.wRot = Math.sign(s.r1 - (s.rs ?? s.r0)) * s.sd; } pl.swing = null; } }
  if (pl.wRec > 0) pl.wRec -= dt;
  if (Math.abs(pl.kx) + Math.abs(pl.ky) > 2) { moveEnt(pl, pl.kx * dt, pl.ky * dt); const k = Math.pow(0.001, dt); pl.kx *= k; pl.ky *= k; } else pl.kx = pl.ky = 0;
  if (pl.tfx && pl.tfx.regen && pl.hp > 0 && pl.hp < pl.maxHp) pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * pl.tfx.regen / 100 * dt);   // 飾品：慢慢回血
  if (pl.healGlow > 0) pl.healGlow -= dt;
  if (pl.drink > 0) { pl.drink -= dt;
    if (Math.random() < dt * 26) G.parts.push({ x:pl.x + rr(-8, 8), y:pl.y + rr(-2, 2), vx:0, vy:-rr(14, 26), life:rr(.4, .6), max:.6, col:pick(HEALC), s:1 });   // 喝的時候腳邊慢慢冒綠光
    if (pl.drink <= 0) { const h = Math.round(pl.maxHp * (.5 + ((pl.tfx && pl.tfx.potion) || 0) / 100));   // 飾品：藥水多回一點
      const got = Math.min(pl.maxHp, pl.hp + h) - pl.hp; pl.hp += got; healFx(pl, h, got); } }
  const m = Math.hypot(input.mx, input.my);
  if (pl.dash) {
    pl.dash.t -= dt; moveEnt(pl, pl.dash.vx * dt, pl.dash.vy * dt);
    const D = pl.dash, back = pl.face + Math.PI;
    D.streak.x1 = pl.x; D.streak.y1 = pl.y - 8; D.streak.t = 0;             // 光帶跟著人走，衝完才淡出
    G.ghosts.push({ x:pl.x, y:pl.y, flip:pl.flip, life:.28, max:.28 });       // 每幀留一個殘影
    G.fx.push({ k:'aline', x:pl.x + rr(-6, 6), y:pl.y - 8 + rr(-9, 9), a:back, len:rr(12, 26), t:0, d:.14, col:'#ffffff' }); // 細速度線
    for (let i = 0; i < 2; i++) { const a = back + rr(-.6, .6), s = rr(20, 70);                                       // 一路灑下的星屑
      G.parts.push({ x:pl.x + rr(-5, 5), y:pl.y - rr(2, 16), vx:Math.cos(a) * s, vy:Math.sin(a) * s + 10, life:rr(.3, .55), max:.55, col:pick(STARC), star:rr(.8, 2.4), drag:3 }); }
    for (const e of targets(pl)) if (!D.hit.has(e) && Math.hypot(e.x - pl.x, e.y - pl.y) < e.r + pl.r + 8) { D.hit.add(e); damageEnemy(pl, e, 3, pl.x, pl.y);
      // 命中：兩道交叉的新月斬痕 + 炸開的星光 + 一下重震
      G.fx.push({ k:'cres', x:e.x, y:e.y - 7, a:pl.face - Math.PI / 2 + .55, r:15, t:0, d:.24 });
      G.fx.push({ k:'cres', x:e.x, y:e.y - 7, a:pl.face + Math.PI / 2 - .55, r:15, t:0, d:.24, late:.04 });
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + rr(-.2, .2), s = rr(70, 140);
        G.parts.push({ x:e.x, y:e.y - 7, vx:Math.cos(a) * s, vy:Math.sin(a) * s, life:rr(.25, .45), max:.45, col:pick(STARC), star:rr(1.5, 3.2), drag:6 }); }
      shake(3, .12); }
    if (D.t <= 0) {
      pl.dash = null;
      G.fx.push({ k:'rune', x:pl.x, y:pl.y, r:11, t:0, d:.35, rot:rr(0, TAU) });   // 落地：小魔法陣 + 一圈星光
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, s = rr(40, 70);
        G.parts.push({ x:pl.x, y:pl.y - 4, vx:Math.cos(a) * s, vy:Math.sin(a) * s * .5, life:.35, max:.35, col:pick(STARC), star:rr(1, 2), drag:5 }); }
    }
  } else if (pl.dodge > 0) {
    pl.dodge -= dt; const ox = pl.x, oy = pl.y; moveEnt(pl, pl.dvx * dt, pl.dvy * dt);   // 隱身移動，只留下一道細光和星屑
    dodgeCut(pl);                                                       // 月影之鈴：穿過的敵人被砍一刀
    G.fx.push({ k:'aline', x:ox, y:oy - 8 + rr(-5, 5), a:Math.atan2(pl.y - oy, pl.x - ox), len:Math.hypot(pl.x - ox, pl.y - oy) + 4, t:0, d:.16, col:'#d8c8ff' });
    if (Math.random() < .7) G.parts.push({ x:pl.x + rr(-4, 4), y:pl.y - rr(2, 16), vx:rr(-15, 15), vy:rr(-20, 0), life:rr(.25, .45), max:.45, col:pick(STARC), star:rr(.6, 1.8), drag:3 });
    if (pl.dodge <= 0) { pl.dodge = 0; blinkFx(pl, pl.x, pl.y, false); sfx.blinkIn(); }   // 歸零：停在負數的話 !pl.dodge 會一直是 false → pl.moving 永遠 false（凝視石像抓不到人、受傷不閃爍）
  } else if (puzzleMove(pl, dt)) {                                      // 機關接手移動：冰面滑行、被蘑菇彈飛（world/puzzles.ts）
  } else if (m > .05 && !locked(pl) && !rooted(pl)) {
    const spd = 84 * moveMul(pl) * (pl.drink > 0 ? .45 : 1) * (pl.skillLock > 0 ? .25 : 1) * (pl.swing ? .6 : 1) * (pl.charging ? .45 : 1) * (pl.ride ? RIDE_SPD : LOAD_TIERS[pl.loadTier ?? 1].mv) * (pl.rideT > 0 ? .3 : 1) * (map[(pl.y / TS | 0) * MW + (pl.x / TS | 0)] === ROAD ? 1.12 : 1);
    moveEnt(pl, input.mx * spd * dt, input.my * spd * dt);
    if (pl.aimLock <= 0) { pl.face = Math.atan2(input.my, input.mx); updFlip(pl); }
  }
  pl.moving = m > .05 && !pl.dodge && !locked(pl) && !rooted(pl);
  if (pl.moving) pl.anim += dt;
  updateMount(pl, dt);                                                 // 星狼：呼喚、奔跑步伐、走進城鎮 / 地城自動下來

  if (locked(pl) || (rooted(pl) && pressed.dodge)) {                  // 冰凍 / 暈眩：什麼都不能做；被冰住 / 纏住時狂按攻擊或瞬移可以提早掙脫
    if (pressed.atk || pressed.dodge) struggle(pl);
    if (locked(pl)) { stopCharge(pl); pl.atkBuf = 0; pl.chargeArm = false; pressed.atk = pressed.dodge = pressed.skill = pressed.pot = false; }
    else pressed.dodge = false;
  }
  if (pressed.skill && silenced(pl)) { pressed.skill = false; if (pl === G.me && G.time - (pl.silT || -9) > 1.2) { pl.silT = G.time; toast('被封印了，暫時不能用技能', '#c8a8ff'); } }
  if (pressed.mount) toggleMount(pl);
  if (pl.ride && (pressed.atk || pressed.skill || pressed.pot || pressed.dodge)) dismount(pl);   // 騎著按動作鍵：先跳下來，這一下照常做
  // 點一下 = 普通攻擊；按住 = 蓄力，放開放招。
  // 按下去的當下先不出手，等「放開」或「按滿 0.22 秒」才決定是哪一種 → 按住蓄力時不會先多揮一刀
  const atkDown = held.atk || keys.atk;
  const tap = () => { if (!tryAttack(pl)) pl.atkBuf = .25; };
  if (pl.atkBuf > 0) { pl.atkBuf -= dt; if (tryAttack(pl)) pl.atkBuf = 0; }      // 連點太快時先記住，冷卻一好就出手
  /* 弓分兩種：精靈弓 = 連發弓（按住一直射、不蓄力）；長弓 = 蓄力弓（按下就拉弓，放開才射，不能連點） */
  const wt = pl.weapon.type, drawBow = wt === 'bow';
  if (wt === 'elfbow') { if (pressed.atk) tap(); else if (atkDown && !pl.dead) tryAttack(pl); if (pl.chargeArm) stopCharge(pl); }
  else {
  if (pressed.atk) { if (drawBow && pl.bowAuto && pl.charging) { pl.bowAuto = false; pl.chargeArm = true; }   // 蓄力弓自動拉弓途中又按下：接著原本拉的繼續（連點不會一直重拉）
    else { pl.chargeArm = true; pl.chargeHold = 0; pl.charging = false; pl.charge = 0; pl.chargeLv = 0; pl.bowAuto = false; } }
  if (pl.chargeArm) {
    if (!atkDown || pl.dead) {                                         // 放開了
      if (!pl.dead && drawBow && pl.charging) {                        // 蓄力弓：拉滿第一段以上 → 蓄力箭；拉超過 0.3 秒 → 一般箭；拉太短 → 自動拉到 0.3 秒再射
        if (pl.chargeLv > 0 && pl.st > 0) { releaseCharge(pl, pl.chargeLv); stopCharge(pl); }
        else if (pl.charge >= BOW_MIN) { bowShot(pl); stopCharge(pl); }
        else { pl.bowAuto = true; pl.chargeArm = false; }
      } else {
        if (!pl.dead) { if (pl.charging && pl.chargeLv > 0) releaseCharge(pl, pl.chargeLv); else tap(); }   // 蓄到第一段以上 → 放招；很快放開 / 還沒蓄到第一段 → 普通攻擊
        stopCharge(pl);
      }
    }
    else if (pl.charging) { if (pl.dodge > 0 || pl.drink > 0 || pl.dash) stopCharge(pl); else updateCharge(pl, dt); }
    else { pl.chargeHold += dt; if (drawBow ? pl.atkCd <= 0 && !busy(pl) : pl.chargeHold > .22 && !busy(pl) && pl.st > 0) { pl.charging = true; pl.charge = 0; pl.chargeLv = 0; } }   // 蓄力弓一按就開始拉
  }
  if (pl.bowAuto) { if (!pl.charging || pl.dead || pl.dodge > 0) { pl.bowAuto = false; stopCharge(pl); }
    else { updateCharge(pl, dt); if (pl.charge >= BOW_MIN) { bowShot(pl); stopCharge(pl); pl.bowAuto = false; } } }
  }
  if (pressed.dodge) { tryDodge(pl); if (pl.dodge > 0) rollOut(pl); }
  if (pressed.skill) trySkill(pl);
  if (pressed.pot) tryPot(pl);

  if (G.lost && Math.hypot(G.lost.x - pl.x, G.lost.y - pl.y) < 14) {
    const g = G.lost.gold || 0; pl.souls += G.lost.amount; pl.gold += g;
    toast('取回了 ' + G.lost.amount + ' 魂晶' + (g ? '、' + g + ' 金幣' : ''), '#b49cff'); burst(G.lost.x, G.lost.y - 4, 28, '#b49cff', 80); G.fx.push({ k:'ring', x:G.lost.x, y:G.lost.y, r0:4, r1:36, t:0, d:.5, col:'#b49cff' }); sfx.epic(); G.lost = null;
  }
  for (const c of CAMPS) if (!c.lit && Math.abs(c.x - pl.x) < 48 && Math.hypot(c.x - pl.x, c.y - pl.y) < 48) {
    c.lit = true; toast('點燃了「' + c.name + '」，可以在這裡休息和傳送', '#f2c14e'); burst(c.x, c.y - 4, 20, '#f2c14e', 60); sfx.level(); save();
  }
  const rg = REGIONS[regAt(pl.x, pl.y)].key;
  const tx = pl.x / TS, ty = pl.y / TS; let sb = '';
  if (rg === 'dungeon') sb = dungeonAt(pl.x, pl.y)?.name || '';                // 地城裡：地名 = 這座地城
  else for (const s of SUBS) if (Math.abs(s.x - tx) < s.r && Math.hypot(s.x - tx, s.y - ty) < s.r) { sb = s.name; break; }
  if (rg !== G.region) { G.region = rg; G.sub = sb;
    if (rg === 'dungeon' && sb) { const first = !discovered.has(sb); discovered.add(sb); showArea(sb, first ? '發現新地點 · 地城' : '地城'); if (first) sfx.discover(); }   // 地城：直接顯示地城的名字
    else showArea(REGIONS.find(r => r.key === rg).name, REGIONS.find(r => r.key === rg).sub); }
  else if (sb !== G.sub) { G.sub = sb; if (sb) { const first = !discovered.has(sb); discovered.add(sb); showArea(sb, first ? '發現新地點' : REGIONS.find(r => r.key === rg).name); if (first) sfx.discover(); } }
}
/* 附近有怪正在追打你（或區域 / 地城 Boss 開打中）→ 攻擊鍵保持攻擊，不會變成撿東西/休息 */
// 戰鬥中（攻擊鍵不會變成互動）：自己在打 Boss，或附近有怪在追你、而且中間沒隔著牆
export const inFight = (pl: Player) => { const rb = fightingRB(); if (rb && Math.hypot(pl.x - rb.def.x, pl.y - rb.def.y) < rb.def.R + 40) return true;
  return G.enemies.some(e => e.state !== 'idle' && e.state !== 'return' && Math.abs(e.x - pl.x) < 140 && dist(e, pl) < 140 && canSee(e.x, e.y - 6, pl.x, pl.y - 6)); };
export function nearCamp(pl: Player) {
  if (pl.dead) return null;
  for (const c of CAMPS) if (c.lit && Math.abs(c.x - pl.x) < 30 && Math.hypot(c.x - pl.x, c.y - pl.y) < 30) {
    if (inFight(pl)) return null;
    return c;
  }
  return null;
}
export function restoreWorld() {                                       // 營火休息/重生：所有玩家補滿，世界重置
  for (const pl of G.players) { pl.hp = pl.maxHp; pl.st = pl.maxSt; pl.pot = G.potMax; pl.timers = []; pl.dash = null; pl.dodge = 0; clearStatus(pl); }
  G.projs = []; G.drops = G.drops.filter(d => d.item.rarity >= 2); respawnAll(); resetBoss(); resetRegionBosses();
}
export function placeAtCamp(pl: Player, id) {
  const c = CAMPS.find(c => c.id === id) || CAMPS[0];
  pl.x = c.x; pl.y = c.y + 16;
  if (collides(pl.x, pl.y, pl.r)) pl.y = c.y - 16;
  if (pl === G.me) { cam.x = pl.x - LW / 2; cam.y = pl.y - LH / 2; }   // 鏡頭只跟著「我」
}
/* 喝完藥水回血的那一下：綠色光圈從腳下擴開、一圈「+」光點往上飄、身上綠光外框、大號綠色數字、血條發光、叮一聲
   h = 這瓶本來能回多少（數字顯示這個，滿血喝也看得到效果），got = 實際回了多少（血條要不要閃） */
export const HEALC = ['#7dff8a', '#b8ffc0', '#3fd86a', '#ffffff'];
function healFx(pl: Player, h: number, got: number) {
  pl.healGlow = .7;
  G.fx.push({ k:'ring', x:pl.x, y:pl.y, r0:3, r1:28, t:0, d:.45, col:'#7dff8a' });
  G.fx.push({ k:'ring', x:pl.x, y:pl.y, r0:2, r1:18, t:0, d:.5, delay:.12, col:'#b8ffc0' });
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, r = rr(4, 12);                 // 「+」光點從身體周圍往上飄（四芒星畫小一點就是十字）
    G.parts.push({ x:pl.x + Math.cos(a) * r, y:pl.y - 4 + Math.sin(a) * r * .5, vx:Math.cos(a) * rr(6, 16), vy:-rr(30, 70), life:rr(.55, .9), max:.9, col:pick(HEALC), star:rr(1, 2.2), drag:2 }); }
  burst(pl.x, pl.y - 8, 10, '#b8ffc0', 50);
  G.nums.push({ x:pl.x, y:pl.y - 30, txt:'+' + h, col:'#7dff8a', t:0, d:1.1, big:true });
  if (pl === G.me) { sfx.heal(); if (got > 0) flashHp(); }
}
function respawn(pl: Player) {
  const ds = pl.souls - Math.floor(pl.souls * KEEP_K), dg = pl.gold - Math.floor(pl.gold * KEEP_K);   // 掉的那份（四捨五入算你倒楣：身上留的是無條件捨去的 20%）
  const out = inBossZone(pl.x, pl.y) && pl.safeX !== undefined;
  G.lost = ds > 0 || dg > 0 ? { x: out ? pl.safeX : pl.x, y: out ? pl.safeY : pl.y, amount: ds, gold: dg } : null;
  pl.souls -= ds; pl.gold -= dg; pl.dead = false; pl.kx = pl.ky = 0;
  placeAtCamp(pl, G.lastCamp); restoreWorld(); save();
  if (pl === G.me) { G.region = ''; hideBanner(); }
}

