import { objHit } from '../world/bossMech';
import { G } from '../core/state';
import { TAU, angDiff, pick, rr } from '../core/util';
import { ANIM, HAND_R, HSY, REACH, STYLE, WLEN } from '../art/hero';
import { BEH, RAR, WT } from '../data/items';
import { ACLS } from '../data/gear';
import { rbs, regionBossDie } from '../world/regionBoss';
import { input, level } from './player';
import { applyFx, type FX } from './status';
import { gapDealt, gapTaken } from './bossTuning';
import { canSee, collides, moveEnt } from './collision';
import { sfx } from '../core/audio';
import { killEnemy } from './enemies';
import { bossDie } from './boss';
import { burst, hitSpark, quakeFx, shake } from './worldUpdate';
import { STARC } from '../render/fx';
import { bumpPot, showBanner, toast } from '../ui/hud';
import type { Enemy } from '../types';
import { WOLF_DASH, dismount, wolfDashFx } from './mount';
import { SEALC, bindFx, fxOf, onHit, onKill } from './weaponFx';
import { bindSig, sigBlock, sigCrit, sigHit, sigKill, sigPre, sigSlam, sigSwing } from './signatures';
import { UQSIG } from '../data/uniques';
import { bindBuilds, buildHit, canDodge, dodgeStarted, forcedCrit, fullCharge, iframeHit, playerHurt } from './builds';
import './bossTuning';                                                   // Boss 的傷害倍率和獎勵（平衡用）
import type { Player } from '../types';
import { CRIT_BASE, healMul, retalMul } from '../data/attrs';

/* ================= PLAYER COMBAT ================= */
export function targets(pl: Player) { const t = []; for (const e of G.enemies) if (Math.abs(e.x - pl.x) < 300 && Math.abs(e.y - pl.y) < 300) t.push(e); if (G.B && !G.bossDead && G.B.state !== 'sleep' && !(G.B.z > 8)) t.push(G.B);
  for (const e of rbs) { if (e.dead || e.state === 'sleep' || e.state === 'intro') continue; if (!(e.z > 8) && !e.hidden) t.push(e);
    if (e.mech) for (const o of e.mech.objs) if (!o.dead) t.push(o);
    for (const o of e.objs || []) if (o.hittable && !o.dead) t.push(o); }   // Boss 丟出來、打得到的東西（彈反球，world/bossAI4.ts）                // Boss 機制的物件（裂口、水晶、卵……）也打得到
  return t; }
function nearestTarget(pl: Player, maxD) { let best = null, bd = maxD; for (const e of targets(pl)) { const d = Math.hypot(e.x - pl.x, e.y - pl.y) - e.r; if (d < bd && canSee(pl.x, pl.y - 6, e.x, e.y - 6)) { bd = d; best = e; } } return best; }   // 隔著牆的不算（不會瞄準 / 撲向牆後的敵人）
function autoFace(pl: Player, maxD) { const t = nearestTarget(pl, maxD); if (t) pl.face = Math.atan2(t.y - pl.y, t.x - pl.x); pl.aimLock = .3; updFlip(pl); }
export function updFlip(pl: Player) { const c = Math.cos(pl.face); if (c < -.1) pl.flip = true; else if (c > .1) pl.flip = false; }
function spendSt(pl: Player, v) { pl.st = Math.max(0, pl.st - v); pl.stDelay = .55; }
/* 暴擊傷害：×1.8 + 幸運（data/attrs.ts 的 CRIT_BASE、perks）。隨機暴擊和保證暴擊（完美閃避、居合、背刺…）一樣 */
const sureMul = (pl: Player) => pl.critMul || CRIT_BASE;
function calcDmg(pl: Player, mult, cb = 0) {                                   // cb = 額外暴擊率（細劍連刺）
  let v = (pl.atkPow || pl.weapon.atk) * mult * rr(.9, 1.1);           // atkPow = 武器攻擊 × 能力值加成（recalc 算好的）
  const T = pl.tfx || {};
  if (T.lowHp && pl.hp < pl.maxHp * .35) v *= 1 + T.lowHp / 100;            // 飾品：低血量時加攻
  if (T.dodgeAtk && G.time < (pl.dodgeAtkT || 0)) { v *= 1 + T.dodgeAtk / 100; pl.dodgeAtkT = 0; }   // 飾品：瞬移後的下一擊
  const ctr = T.counter && G.time < (pl.counterT || 0); if (ctr) { v *= 1 + T.counter / 100 * retalMul(pl); pl.counterT = 0; }   // 反擊之誓：被打中後的下一擊
  const sure = ctr || forcedCrit(pl), crit = sure || Math.random() * 100 < pl.crit + cb + sigCrit(pl);   // sigCrit：蠍尾短刀的連鎖
  if (crit) v *= sureMul(pl);   // forcedCrit：完美閃避後的下一擊（game/builds.ts）
  return { v: Math.max(1, Math.round(v)), crit };
}
export function damageEnemy(pl: Player, e: Enemy, mult: number, sx: number, sy: number, opts: { heavy?: boolean; stun?: number; crit?: boolean; heal?: number; proc?: boolean; cb?: number; kb?: number } = {}) {
  if (e.hp <= 0) return;
  if (!canSee(sx, sy - 6, e.x, e.y - 6)) return;                         // 隔著牆（懸崖、石牆、房子）打不到
  if (e.onHit) { e.onHit(pl, sx, sy); return; }                         // 打得到的 Boss 招式（彈反球：打回去，world/bossAI4.ts）
  if (e.guard && e.onGuard) { e.onGuard(pl, sx, sy); return; }           // Boss 架招中：格擋 → 反擊（world/bossAI4.ts）
  if (e.obj) { objHit(e); return; }                                      // Boss 機制的物件：每下 -1（world/bossMech.ts）
  if (e.immune) { G.fx.push({ k:'warp', x:e.x, y:e.y - 14, r0:16, r1:26, th:2, t:0, d:.2, col:'#ffffff' }); sfx.hit(); return; }   // 護盾：打不進去
  let { v, crit } = calcDmg(pl, mult, opts.cb || 0);
  v = Math.max(1, Math.round(v * gapDealt(level(pl), e.lv || 0) * (e.mStun > 0 ? 1.5 : 1)));   // 等級差（見 bossTuning.ts）；Boss 露出破綻時 ×1.5
  if (opts.crit && !crit) { crit = true; v = Math.round(v * sureMul(pl)); }      // 居合：一定暴擊
  { const sg = sigPre(pl, e, !!opts.proc); if (sg.crit && !crit) { crit = true; v = Math.round(v * sureMul(pl)); } if (sg.mul !== 1) v = Math.round(v * sg.mul); }   // 獨特武器：背刺、蛛網易傷（game/signatures.ts）
  if (opts.heal) { if (G.time - (pl.healT0 || -9) > .6) { pl.healT0 = G.time; pl.healN = 0; }   // 鐮刀收割：打中一隻回一點血，一次技能最多算 3 隻
    if (pl.healN < 3) { pl.healN++; pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * opts.heal * (e.boss ? .5 : 1) * healMul(pl))); } }
  v = buildHit(pl, e, v, crit, !!opts.proc);                           // 流派：怒氣、吸血、暴擊減冷卻（game/builds.ts）
  e.hp -= v; e.flash = .1; e.hitT = .32; e.hitDir = Math.sign(e.x - sx) || 1;
  G.nums.push({ x:e.x + rr(-3, 3), y:e.y - (e.boss ? 26 : 16), txt:String(v), col: crit ? '#ffd84a' : '#ffffff', t:0, d:.7, big:crit });
  const a = Math.atan2(e.y - sy, e.x - sx);
  if (!e.boss && !e.elite && !BEH[e.beh].heavy) { const k = 110 * (opts.kb ?? 1); e.kx = Math.cos(a) * k; e.ky = Math.sin(a) * k; }   // kb = 擊退倍率（雙頭刀風車：只推一點點，不然一下就把怪推出圈外）
  if (opts.stun && !e.boss) e.stun = e.elite ? opts.stun * .4 : opts.stun;
  if (!e.boss && (e.state === 'idle' || e.state === 'return')) e.state = 'chase';
  if (pl.ls > 0) pl.hp = Math.min(pl.maxHp, pl.hp + Math.min(v * pl.ls, pl.maxHp * .01) * (e.boss ? .5 : 1) * healMul(pl));   // 吸血：每一下最多回 1% 生命，打 Boss 減半
  hitSpark(e.x, e.y - 7, crit, a);
  if (opts.heavy) { G.hitStop = Math.max(G.hitStop, .055); shake(3, .1); }
  crit ? sfx.crit() : sfx.hit();
  if (crit) shake(2, .1);
  if (!opts.proc) onHit(pl, e, v, crit);                                // 刻印效果（出血、燃燒、寒霜、雷鳴…）
  if (!opts.proc) sigHit(pl, e, crit);                                         // 獨特武器的招牌（game/signatures.ts）
  finish(pl, e);
}
function finish(pl: Player, e: Enemy) {                                  // 血量歸零 → 依種類走對應的死亡流程（只會走一次）
  if (e.hp > 0 || e.dying) return; e.dying = true; e.soulMul = onKill(pl, e); sigKill(pl, e);
  if (e.rb) regionBossDie(e, pl); else if (e.boss) bossDie(pl); else killEnemy(e, pl);
}
/** 效果造成的傷害：不暴擊、不擊退、不再觸發效果 */
export function rawHit(pl: Player, e: Enemy, v: number, col: string) {
  if (e.hp <= 0 || e.dead || e.obj || e.immune) return;
  e.hp -= v; e.flash = .08; if (!e.boss && (e.state === 'idle' || e.state === 'return')) e.state = 'chase';
  if (col === '#ffe85a') G.nums.push({ x:e.x + rr(-3, 3), y:e.y - (e.boss ? 26 : 16), txt:String(v), col, t:0, d:.6 });
  finish(pl, e);
}
bindFx(rawHit, targets, shake);
bindBuilds({ aoe: aoeHit, shake, quakeFx, dodge: tryDodge });
bindSig({ damage: damageEnemy, aoe: aoeHit, line: lineHit, shoot: shootArrow, raw: rawHit, targets, shake, quake: quakeFx });
function meleeHit(pl: Player, range, arcDeg, mult, opts?, fa = pl.face) {   // 回傳打中幾個（戰斧要知道有沒有砍到東西）；fa = 往哪個方向砍（雙頭刀的後半截往背後）
  const half = arcDeg / 2 * Math.PI / 180; let n = 0;
  for (const e of targets(pl)) {
    const d = Math.hypot(e.x - pl.x, e.y - pl.y) - e.r;
    if (d > range) continue;
    if (arcDeg < 360 && d > 4 && angDiff(Math.atan2(e.y - pl.y, e.x - pl.x), fa) > half) continue;
    damageEnemy(pl, e, mult, pl.x, pl.y, opts); n++;
  }
  return n;
}
const TIP = .3, TIP_K = 1.5;                                             // 長槍普攻：敵人在最遠那 30% 的地方（槍尖）→ 傷害 ×1.5
function lineHit(pl: Player, x, y, a, len, w, mult, opts?, tip = false) {         // 直線範圍：長槍突刺用（穿過整排）
  const c = Math.cos(a), s = Math.sin(a);
  for (const e of targets(pl)) { const dx = e.x - x, dy = e.y - y, al = dx * c + dy * s;
    if (al < -e.r || al > len + e.r || Math.abs(dy * c - dx * s) > w + e.r) continue;
    if (tip && al >= len * (1 - TIP)) { damageEnemy(pl, e, mult * TIP_K, x, y, { ...opts, heavy:true }); tipFx(e); }
    else damageEnemy(pl, e, mult, x, y, opts); }
}
function tipFx(e: Enemy) {                                               // 槍尖命中：白色小光圈 + 星屑
  G.fx.push({ k:'warp', x:e.x, y:e.y - 8, r0:3, r1:16, th:2, t:0, d:.18, col:'#ffffff' });
  for (let i = 0; i < 6; i++) { const a = rr(0, TAU), v = rr(50, 110); G.parts.push({ x:e.x, y:e.y - 8, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:.25, max:.25, col:'#e0fcff', star:rr(1.2, 2.2), drag:6 }); }
}
export function aoeHit(pl: Player, cx, cy, rad, mult, opts?) {
  for (const e of targets(pl)) if (Math.hypot(e.x - cx, e.y - cy) - e.r <= rad) damageEnemy(pl, e, mult, cx, cy, opts);
}
export const busy = (pl: Player) => pl.dodge > 0 || pl.drink > 0 || pl.skillLock > 0 || pl.dash || pl.dead;
/* ---- 普通攻擊：三段連擊，每一下留下新月刀光 ---- */
export const WFX = {                                                         // 外層光 / 中層 / 白芯
  sword: ['#4a6ae0', '#a8c0ff', '#ffffff'], dagger: ['#7a4ae0', '#d0b8ff', '#ffffff'], axe: ['#c8401e', '#ffb040', '#fff6d0'],
  spear: ['#2a8a9a', '#9af0ff', '#ffffff'], staff: ['#6a4ad0', '#b49cff', '#ffffff'], wolfblade: ['#3a2470', '#9a6cff', '#f0e0ff'],
  katana: ['#a8203a', '#ff8aa0', '#ffffff'], hammer: ['#8a5a1a', '#f2c14e', '#fff6d0'], scythe: ['#1e5a46', '#6ae0b0', '#e0fff0'],
  bow: ['#6a4a2a', '#d8c8a0', '#ffffff'], greatsword: ['#5a6a8a', '#c8d4ec', '#ffffff'], rapier: ['#c03070', '#ff9ad0', '#ffffff'],
  crescent: ['#2c3a8a', '#a8c4ff', '#f4f8ff'], twinblade: ['#2a6ac0', '#8ad0ff', '#ffffff'], darkmoon: ['#2a2a8a', '#8aa0ff', '#e8f0ff'],
  elfbow: ['#1e7a5a', '#9ae0b4', '#ffffff'], elfrapier: ['#1e7a6a', '#a8f0e0', '#ffffff'], elfblades: ['#2a8a4a', '#b8f0a0', '#ffffff'] };   // 精靈武器：葉綠色
const MOONC = ['#23206e', '#8aa0ff', '#eef4ff'];                         // 暗月大劍的月光（不管有沒有刻印都是這個顏色）
const SHADOWBLADE = ['#1a1030', '#6a4ad0', '#e0d0ff'];
export function wcols(pl: Player, type) { const c = WFX[type].slice(), r = pl.weapon.rarity, fx = fxOf(pl.weapon);
  const sg = pl.weapon.uq && UQSIG[pl.weapon.uq]; if (sg) { c[0] = sg.cols[0]; c[1] = sg.cols[1]; return c; }   // 獨特武器：招牌的顏色
  if (fx && SEALC[fx]) { c[0] = SEALC[fx][0]; c[1] = SEALC[fx][1]; return c; }    // 有刻印：刀光換成刻印的顏色（出血紅、燃燒橘、寒霜冰藍、雷鳴黃、噬魂紫）
  if (r >= 3) c[0] = RAR[r].c; return c; }
function smearFx(pl: Player, a0, a1, r, w, sw, cols, hold = .12, delay = 0, sy = HSY) { G.fx.push({ k:'smear', follow:pl, a0, a1, r, w, sw, hold, delay, t:0, d:delay + sw + hold, cols, sy }); }
function lanceFx(pl: Player, a, len, w, cols, d, follow) {
  G.fx.push({ k:'lance', follow:follow ? pl : null, x:pl.x + Math.cos(a) * 6, y:pl.y - 7 + Math.sin(a) * 6, a, len, w, t:0, d, cols });
  G.parts.push({ x:pl.x + Math.cos(a) * (len + 6), y:pl.y - 7 + Math.sin(a) * (len + 6), vx:Math.cos(a) * 40, vy:Math.sin(a) * 40, life:.25, max:.25, col:'#ffffff', star:3, drag:6 });
}
export function restAng(pl: Player) {                                                   // 架式（Ready）時武器的角度
  const W = WT[pl.weapon.type], dir = pl.flip ? -1 : 1, cf = Math.cos(pl.face), sf = Math.sin(pl.face);
  if (pl.weapon.type === 'bow' || pl.weapon.type === 'elfbow') return pl.face + .6 * dir;              // 長弓：朝前、往下垂一點
  return W.ranged ? -Math.PI / 2 + .35 * dir : pl.face - dir * (.9 * Math.abs(cf) + .25 * sf);   // 法杖直立在身旁；近戰武器斜舉在身前
}
function newSwing(pl: Player, type, A, fin, st, extra) {                            // 建一段攻擊動作；角度都存成「相對面向」，揮的方向才不會繞錯邊
  const sd = pl.flip ? -1 : 1, F = fin ? 1.3 : 1, S = st ? STYLE[st] : A, k = st ? (A.lift || 0) / 5 : 1;
  let r0 = S.up, rs = S.from, r1 = S.to, lift = (S.lift || 0) * (st === 'slam' ? 1 : k);
  if (fin && st && st !== 'slam') { r0 *= 1.1; r1 *= 1.15; lift += 2 * Math.sign(lift); }
  let rR = ((restAng(pl) - pl.face) * sd) % TAU; if (rR > Math.PI) rR -= TAU; if (rR < -Math.PI) rR += TAU;
  const wu = A.wu * F * (st === 'slam' ? 1.2 : 1), sw = A.sw * F;
  return Object.assign({ t:0, wu, sw, d:wu + sw + A.hold, back:A.back, f:pl.face, sd, rR, r0, rs, r1, lift, sy:S.sy || HSY, st, ty:type, fin, anim:true }, extra);
}
const TH = { sword:9, dagger:6, axe:13, wolfblade:8, katana:7, hammer:14, scythe:11, greatsword:15, crescent:11, twinblade:8, darkmoon:14, elfblades:8 };   // 刀光粗細
const QDAG = Object.assign({}, ANIM.dagger, { wu:.025, sw:.05, hold:.03 });   // 影步連斬用的快速版短刀動作
const DSEQ = ['diag', 'flat', 'rise', 'flatR'];                        // 斜劈 → 橫掃 → 上撩 → 反橫掃 … 最後一刀重劈
function swingSmear(pl: Player, s, type, cols, fin) {                               // 跟著角色的刀光（貼在刀身上）
  const th = TH[type] || 9, R = WT[type].range + (fin ? 6 : 2), tip = HAND_R + REACH + WLEN[type];
  const Rv = Math.min(R, tip + (fin ? 9 : 6)), wv = Math.max(th, Rv - (HAND_R + REACH + WLEN[type] * .45)), flat = s.sy < .6;
  smearFx(pl, s.f + s.rs * s.sd, s.f + s.r1 * s.sd, flat ? Rv + 3 : Rv, wv * (flat ? 1.3 : 1), s.sw * .75, cols, .08, s.wu + s.sw * .25, s.sy);
}
export function tryAttack(pl: Player) {
  if (pl.atkCd > 0 || busy(pl) || G.time < (pl.wheelT || 0)) return false;   // 普攻不耗體力（體力只用在瞬移和蓄力）；雙頭刀風車轉的時候不能普攻
  const type = pl.weapon.type, W = WT[type], cols = wcols(pl, type), A = ANIM[type] || ANIM.sword;
  /* 戰鎚、戰斧沒有三連擊：戰鎚每一下都舉高往下砸；戰斧左右來回橫掃，連續砍中越砍越快（最多快 30%），停下來就重來
     雙頭刀是四連擊（第四下整支轉一圈） */
  const solo = type === 'hammer' || type === 'axe', chain = pl.comboT > 0, N = type === 'twinblade' || type === 'elfblades' ? 4 : 3;   // 雙頭刀、精靈雙刀：四連擊
  pl.combo = !solo && chain ? (pl.combo + 1) % N : 0; pl.comboT = type === 'axe' ? 1.1 : .8;
  if (type === 'axe' && !chain) pl.axeN = 0;
  if (type === 'darkmoon' && !chain) pl.moonN = 0;                     // 暗月：連段斷掉，存的月光就散了
  const fin = !solo && pl.combo === N - 1;
  sigSwing(pl, fin);                                                     // 獨特武器：潮汐、近衛之盾、王之箭（第幾下）
  const st = type === 'hammer' ? 'slam' : type === 'axe' ? ((pl.axeSide = !pl.axeSide) ? 'flatR' : 'flat') : (A.C || ['diag', 'rise', 'diag'])[pl.combo];   // 三下各用不同揮法（斜劈 → 橫掃 → 重劈）
  pl.atkCd = W.cd / pl.aspd * (fin ? 1.3 : 1) * (type === 'axe' ? 1 - .1 * (pl.axeN || 0) : 1);
  if (type === 'bow') {                                               // 長弓：拉弓 → 放箭；第三下射穿透箭。箭飛越遠越痛
    autoFace(pl, 210);
    const s = pl.swing = newSwing(pl, type, A, false, null, { ranged:true, fin });
    pl.timers.push({ t:s.wu, fn: () => { shootArrow(pl, pl.face, fin ? 1.15 : 1, fin, cols); sfx.swing(); } });
    return true;
  }
  if (type === 'elfbow') {                                            // 精靈弓：箭比較快、飛比較遠；第三下一次射三支（都會穿透）
    autoFace(pl, 230);
    const s = pl.swing = newSwing(pl, type, A, false, null, { ranged:true, fin });
    pl.timers.push({ t:s.wu, fn: () => { for (const da of fin ? [-.13, 0, .13] : [0]) shootArrow(pl, pl.face + da, fin ? .9 : 1, fin, cols, 500); sfx.swing(); } });
    return true;
  }
  if (W.ranged) {                                                     // 法杖：舉杖聚光 → 往前一推放出 → 杖放低收招
    autoFace(pl, 170);
    const s = pl.swing = newSwing(pl, type, A, false, null, { ranged:true, fin });
    pl.timers.push({ t:s.wu, fn: () => {
      for (const da of fin ? [-.2, 0, .2] : [0]) { const a = pl.face + da;
        G.projs.push({ x:pl.x + Math.cos(a) * 12, y:pl.y - 8 + Math.sin(a) * 12, vx:Math.cos(a) * 270, vy:Math.sin(a) * 270, r:3, life:.65, mult:fin ? .8 : 1, owner:'p', by:pl, kind:'bolt' }); }
      G.fx.push({ k:'warp', x:pl.x + Math.cos(pl.face) * 14, y:pl.y - 8 + Math.sin(pl.face) * 14, r0:2, r1:fin ? 12 : 9, th:2, sy:1, t:0, d:.18, col:'#b49cff' });
      smearFx(pl, s.f + s.r0 * s.sd * .6, s.f + s.r1 * s.sd, HAND_R + REACH + WLEN.staff + 2, 4, s.sw, ['#5a2aa0', '#b48cff', '#f4e0ff'], .1);   // 杖頭甩出去的弧光
      sfx.fire(); } });
    return true;
  }
  autoFace(pl, W.range + 40);
  if (type === 'rapier' || type === 'elfrapier') {                    // 細劍：快速直刺，只刺最前面那一隻；第三下往前踏一步。精靈細劍第三下還會刺出一道葉刃（穿透）
    const L = W.range + (fin ? 10 : 0), s = pl.swing = newSwing(pl, type, A, fin, null, {});
    pl.timers.push({ t:s.wu, fn: () => { pl.thrust = .1; if (fin) moveEnt(pl, Math.cos(pl.face) * 10, Math.sin(pl.face) * 10);
      lanceFx(pl, pl.face, L, fin ? 7 : 5, cols, .16, true); rapierHit(pl, L, fin ? 1.3 : 1, fin); sfx.swing();
      if (fin && type === 'elfrapier') leafWave(pl, pl.face, .7, 12); } });
    return true;
  }
  if (type === 'elfblades' && fin) {                                  // 精靈雙刀第四下：兩把刀一起轉一圈，捲起一圈葉子
    pl.timers.push({ t:.05, fn: () => { pl.spin = .3; const a = pl.face;
      smearFx(pl, a, a + TAU * .95, W.range + 6, 10, .16, cols, .1); smearFx(pl, a + Math.PI, a + Math.PI + TAU * .9, W.range, 8, .16, cols, .1);
      meleeHit(pl, W.range + 8, 360, 1.4, { heavy:true }); leafBurst(pl.x, pl.y - 6, 18); sfx.swing(); } });
    return true;
  }
  if (type === 'twinblade' && fin) {                                  // 雙頭刀第四下：整支在身邊轉一圈
    pl.timers.push({ t:.05, fn: () => { pl.spin = .3; const a = pl.face;
      smearFx(pl, a, a + TAU * .95, W.range + 4, 10, .16, cols, .1); smearFx(pl, a + Math.PI, a + Math.PI + TAU * .9, W.range - 4, 7, .16, cols, .1);
      meleeHit(pl, W.range + 6, 360, 1.3, { heavy:true }); sfx.swing(); } });
    return true;
  }
  if (type === 'spear') {
    const L = W.range + (fin ? 14 : 4), s = pl.swing = newSwing(pl, type, A, fin, null, {});
    pl.timers.push({ t:s.wu, fn: () => { pl.thrust = .14; if (fin) moveEnt(pl, Math.cos(pl.face) * 12, Math.sin(pl.face) * 12);   // 第三下：先往前踏一步再刺
      lanceFx(pl, pl.face, L, fin ? 12 : 9, cols, .22, true); lineHit(pl, pl.x, pl.y, pl.face, L, 6, fin ? 1.25 : 1, undefined, true); sfx.swing(); } });
    if (fin) pl.timers.push({ t:s.wu + .14, fn: () => { pl.thrust = .14; pl.swing = newSwing(pl, type, Object.assign({}, A, { wu:0 }), false, null, {}); pl.swing.t = 0;
      lanceFx(pl, pl.face, L + 6, 11, cols, .2, true); lineHit(pl, pl.x, pl.y, pl.face, L + 6, 7, 1.1, { heavy:true }, true); sfx.swing(); } });
    return true;
  }
  const s = pl.swing = newSwing(pl, type, A, fin, st, { armor: type === 'greatsword' || type === 'darkmoon' });   // armor = 霸體（hurtPlayer）
  const th = TH[type] || 9, R = W.range + (fin ? 6 : 2);
  const tip = HAND_R + REACH + WLEN[type], Rv = Math.min(R, tip + (fin ? 9 : 6)), wv = Math.max(th, Rv - (HAND_R + REACH + WLEN[type] * .45));
  const as = s.f + s.rs * s.sd, a1 = s.f + s.r1 * s.sd, d0 = s.wu + s.sw * .25, sw2 = s.sw * .75;   // 刀先從頭頂甩到前方（25%），刀光從那裡開始畫
  const flat = s.sy < .6, Rs = flat ? Rv + 3 : Rv;                    // 橫掃：刀光畫成扁扁的一大圈，繞過身體前方
  pl.aimLock = Math.max(pl.aimLock, d0 + sw2 * .3 + .05);           // 砍到之前不准轉身（autoFace 只鎖 0.3 秒，戰鎚、大劍砸下來比較晚，不鎖的話推搖桿會砸到背後）
  smearFx(pl, as, a1, Rs, wv * (fin ? 1.1 : 1) * (flat ? 1.3 : 1), sw2, cols, A.hold + .04, d0, s.sy);
  if (type === 'wolfblade') smearFx(pl, a1, as, Rs - 4, wv * .7, sw2, SHADOWBLADE, .12, d0 + .04, s.sy);
  if (type === 'twinblade') smearFx(pl, as + Math.PI, a1 + Math.PI, Rs - 3, wv * .8, sw2, cols, A.hold, d0, s.sy);   // 雙頭刀：後半截同時往背後砍
  if (type === 'darkmoon') smearFx(pl, as, a1, Rs + 4, wv * .5, sw2, MOONC, A.hold, d0 + .02, s.sy);
  if (type === 'dagger' && fin) smearFx(pl, s.f - s.r0 * s.sd * .55, s.f + s.r1 * s.sd * -1, Rv, wv, sw2, cols, .12, d0 + .07);   // 短刀收尾：交叉第二刀
  pl.timers.push({ t:d0 + sw2 * .3, fn: () => {
    if (type === 'hammer') {                                           // 戰鎚：砸在前方地上，一圈範圍、每下都震地、小怪會暈一下
      const cx = pl.x + Math.cos(pl.face) * 20, cy = pl.y + Math.sin(pl.face) * 20;
      aoeHit(pl, cx, cy, 22, 1.05, { heavy:true, stun:.3 }); quakeFx(cx, cy, 26); shake(3, .12); G.hitStop = Math.max(G.hitStop, .04);
      sigSlam(pl, cx, cy);                                               // 霜鬃巨鎚的冰柱、古爐鍛鎚的熔岩爆炸
    } else {
      const n = meleeHit(pl, R, W.arc * (fin ? 1.3 : 1), fin ? 1.35 : 1, fin ? { heavy:true } : undefined);
      if (type === 'axe') { pl.axeN = n ? Math.min(3, (pl.axeN || 0) + 1) : 0;   // 砍中 → 下一下快 10%（最多 3 層）；揮空就重來
        if (n && pl.axeN >= 3) { shake(2, .08); for (let i = 0; i < 10; i++) { const a = pl.face + rr(-1.4, 1.4), v = rr(60, 150);   // 滿層：斧刃冒火
          G.parts.push({ x:pl.x + Math.cos(a) * 16, y:pl.y - 8 + Math.sin(a) * 10, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 30, life:rr(.25, .45), max:.45, col:pick(['#ff6a2a', '#ffb040', '#fff0a0']), star:rr(1, 2), drag:5 }); } } }
      if (type === 'twinblade') meleeHit(pl, R - 4, 100, .6, undefined, pl.face + Math.PI);   // 背後的敵人吃 60%
      if (type === 'crescent' && fin) throwBoom(pl, pl.face, .6, 17, cols, .3);                  // 月牙刀第三下：把刀氣丟出去，會飛回來
      if (type === 'greatsword' && fin) crackLine(pl, pl.face, 64, 9, .8, { stun:.4 });       // 大劍第三下：砸地，往前裂一小段
      if (type === 'darkmoon') {                                       // 暗月：打中存一層月光（最多 3），第三下把月光全部放成劍氣
        if (!fin && n) { pl.moonN = Math.min(3, (pl.moonN || 0) + 1);
          for (let i = 0; i < 8; i++) { const a = rr(0, TAU); G.parts.push({ x:pl.x + Math.cos(a) * 14, y:pl.y - 10 + Math.sin(a) * 10, vx:-Math.cos(a) * 50, vy:-Math.sin(a) * 40, life:.3, max:.3, col:pick(MOONC), star:rr(.8, 1.8), drag:3 }); } }
        if (fin) { const k = 1 + (pl.moonN || 0); for (let i = 0; i < k; i++) moonWave(pl, pl.face + (i - (k - 1) / 2) * .24, .55, 16); pl.moonN = 0; }
      }
      if (fin && type === 'sword') { const a = pl.face;                // 長劍第三下：往前飛一道小劍氣（約 70 px，穿透）
        G.projs.push({ x:pl.x + Math.cos(a) * 10, y:pl.y - 7 + Math.sin(a) * 10, vx:Math.cos(a) * 300, vy:Math.sin(a) * 300, r:8, life:.24, mult:.8, owner:'p', by:pl, kind:'wave', pierce:true, hit:new Set(), R:11, th:5, cols, light:true }); }
    }
    const mx = pl.x + Math.cos(pl.face) * Rv * .9, my = pl.y - 7 + Math.sin(pl.face) * Rv * .9 * HSY;   // 刀光前緣迸出火花
    for (let i = 0; i < (fin ? 18 : 12); i++) { const a = pl.face + rr(-1.1, 1.1), v = rr(40, 140);
      G.parts.push({ x:mx, y:my, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:rr(.15, .32), max:.32, col:pick(['#ffb070', '#ff7a5a', '#ffffff', cols[1]]), star:rr(.6, 1.8), drag:6 }); }
    for (let i = 0; i < (fin ? 6 : 3); i++) { const a = pl.face + rr(-.6, .6), v = rr(90, 170);   // 白色星屑往前飛
      G.parts.push({ x:mx, y:my, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 20, life:rr(.3, .45), max:.45, col:'#ffffff', star:rr(1.6, 2.6), drag:4 }); }
    if (fin) moveEnt(pl, Math.cos(pl.face) * 7, Math.sin(pl.face) * 7);
    sfx.swing(); } });
  return true;
}
/* ---- 新武器的小工具 ---- */
function shootArrow(pl: Player, a, mult, pierce, cols, spd = 420, big = false) {   // 長弓的箭（飛行距離越遠越痛：worldUpdate.ts 的 projMult）
  const x = pl.x + Math.cos(a) * 10, y = pl.y - 7 + Math.sin(a) * 10;
  G.projs.push({ x, y, x0:x, y0:y, vx:Math.cos(a) * spd, vy:Math.sin(a) * spd, r:big ? 5 : 3, life:210 / spd + (big ? .1 : 0), mult, owner:'p', by:pl, kind:'arrow', far:true,
    pierce, hit:pierce ? new Set() : undefined, light:!big, cols, big, wood:pl.weapon.type === 'bow' });   // wood：長弓射的是一般的木箭
}
const LEAFC = ['#1e6a4a', '#9ae0b4', '#f0fff4'];                         // 精靈武器的葉刃 / 葉子
function leafWave(pl: Player, a, mult, R, spd = 300, life = .32) {             // 精靈細劍的葉刃（穿透，飛一小段）
  G.projs.push({ x:pl.x + Math.cos(a) * 12, y:pl.y - 7 + Math.sin(a) * 12, vx:Math.cos(a) * spd, vy:Math.sin(a) * spd, r:R * .6, life, mult, owner:'p', by:pl, kind:'wave',
    pierce:true, hit:new Set(), R, th:Math.round(R * .4), cols:LEAFC, light:true });
}
function leafBurst(x, y, n) { for (let i = 0; i < n; i++) { const a = rr(0, TAU), v = rr(40, 120);
  G.parts.push({ x:x + Math.cos(a) * 6, y:y + Math.sin(a) * 4, vx:Math.cos(a) * v, vy:Math.sin(a) * v * .6 - 20, life:rr(.4, .8), max:.8, col:pick(['#4ab088', '#9ae0b4', '#e8fff0']), s:2, drag:2.5 }); } }
function throwBoom(pl: Player, a, mult, R, cols, out = .26, spd = 330) {       // 月牙刀的月牙：飛出去 out 秒（路上自動追著還沒砍到的敵人），再飛回來（來回各打一次）
  G.projs.push({ x:pl.x + Math.cos(a) * 10, y:pl.y - 7 + Math.sin(a) * 10, vx:Math.cos(a) * spd, vy:Math.sin(a) * spd, r:R * .6, life:3.5, mult, owner:'p', by:pl, kind:'boom', ret:out,
    pierce:true, hit:new Set(), R, th:Math.round(R * .55), half:1.45, cols, light:R < 20, seek:true });
}
function moonWave(pl: Player, a, mult, R, spd = 290, life = .42) {             // 暗月大劍的月光劍氣（穿透）
  G.projs.push({ x:pl.x + Math.cos(a) * 10, y:pl.y - 7 + Math.sin(a) * 10, vx:Math.cos(a) * spd, vy:Math.sin(a) * spd, r:R * .6, life, mult, owner:'p', by:pl, kind:'wave',
    pierce:true, hit:new Set(), R, th:Math.round(R * .45), cols:MOONC, light:R < 24 });
}
function crackLine(pl: Player, a, len, w, mult, opts?) {                        // 地裂：傷害一次算完，裂痕一段一段往前跑
  const x0 = pl.x, y0 = pl.y, n = Math.max(2, Math.round(len / 22));
  lineHit(pl, x0, y0, a, len, w, mult, opts);
  for (let i = 1; i <= n; i++) pl.timers.push({ t:i * .04, fn: () => { const u = len * i / n, x = x0 + Math.cos(a) * u, y = y0 + Math.sin(a) * u;
    quakeFx(x, y, 12 + i * 2); burst(x, y, 6, '#8a8296', 70); } });
  shake(4, .18); sfx.boom();
}
const RAP_K = 12, RAP_MAX = 4;                                           // 細劍：同一隻每刺一下暴擊率 +12%（最多 4 層 = +48%），換目標就重來
function rapierHit(pl: Player, len, mult, heavy) {
  const c = Math.cos(pl.face), s = Math.sin(pl.face); let best = null, bd = 1e9;
  for (const e of targets(pl)) { const dx = e.x - pl.x, dy = e.y - pl.y, al = dx * c + dy * s;
    if (al < -e.r || al > len + e.r || Math.abs(dy * c - dx * s) > 6 + e.r) continue; if (al < bd) { bd = al; best = e; } }
  if (!best) return;
  if (pl.rapT !== best) { pl.rapT = best; pl.rapN = 0; }
  damageEnemy(pl, best, mult, pl.x, pl.y, { cb: pl.rapN * RAP_K, heavy });
  pl.rapN = Math.min(RAP_MAX, pl.rapN + 1);
  G.fx.push({ k:'warp', x:best.x, y:best.y - 8, r0:2, r1:5 + pl.rapN * 3, th:1.5, t:0, d:.16, col: pl.rapN >= RAP_MAX ? '#ffd84a' : '#ff9ad0' });   // 層數越多光圈越大，滿了變金色
}
/* ---- 蓄力：長按攻擊鍵，兩段蓄力，放開放出武器專屬招式 ---- */
export const CH1 = .45, CH2 = 1.1, CHC = ['#9a7cff', '#c8a0ff', '#ffd04a'];
export function stopCharge(pl: Player) { pl.chargeArm = false; pl.charging = false; pl.charge = 0; pl.chargeLv = 0; pl.chargeHold = 0; }
export function updateCharge(pl: Player, dt) {
  pl.charge += dt * (1 + ((pl.tfx && pl.tfx.charge) || 0) / 100);        // 飾品 + 力量：蓄力比較快
  const lv = pl.charge >= CH2 ? 2 : pl.charge >= CH1 ? 1 : 0;
  if (lv > pl.chargeLv) { pl.chargeLv = lv; sfx.charge(lv); if (lv === 2) shake(1.5, .1);
    G.fx.push({ k:'warp', x:pl.x, y:pl.y, r0:4, r1:lv === 2 ? 26 : 18, th:3, t:0, d:.3, col:CHC[lv] });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; G.parts.push({ x:pl.x, y:pl.y - 8, vx:Math.cos(a) * 80, vy:Math.sin(a) * 60, life:.35, max:.35, col:lv === 2 ? '#ffd04a' : pick(STARC), star:rr(1, 2.4), drag:6 }); } }
  if (Math.random() < .55 + lv * .3) { const a = rr(0, TAU), R = rr(18, 28);                      // 往身上聚集的星光
    G.parts.push({ x:pl.x + Math.cos(a) * R, y:pl.y - 8 + Math.sin(a) * R * .7, vx:-Math.cos(a) * R * 3.2, vy:-Math.sin(a) * R * 2.2, life:.3, max:.3, col:lv === 2 ? '#ffd04a' : pick(STARC), star:rr(.6, 1.6) }); }
}
/* 蓄力弓（長弓）放開時還沒蓄到第一段：射一支一般的箭（game/playerUpdate.ts）。至少要拉 BOW_MIN 秒，太早放開不會射 */
export const BOW_MIN = .45;
export function bowShot(pl: Player) {
  autoFace(pl, 230); pl.swing = { t:0, d:.22, ranged:true, ty:'bow' }; pl.atkCd = .35;   // 拉 0.45 秒 + 冷卻 0.35 秒 ≈ 每 0.8 秒一箭，所以每箭 160%（跟以前每 0.5 秒 100% 差不多）
  shootArrow(pl, pl.face, 1.6, false, wcols(pl, 'bow')); sfx.swing();
}
export function releaseCharge(pl: Player, lv) {
  if (pl.st <= 0) return;
  const type = pl.weapon.type, cols = wcols(pl, type), s = lv >= 2 ? 1.45 * (1 + ((pl.tfx && pl.tfx.chargeDmg) || 0) / 100) : 1;   // 蓄滿：力量讓這一下更痛
  spendSt(pl, lv >= 2 ? 26 : 18); pl.atkCd = .35; pl.combo = 0; pl.comboT = 0; sfx.release(lv);
  if (lv >= 2) fullCharge(pl);                                           // 重擊流：蓄滿放出震波（game/builds.ts）
  switch (type) {
    case 'sword': {                                                   // 月輪斬：一圈刀光 + 往前飛的新月劍氣
      autoFace(pl, 160); const a = pl.face; pl.spin = .3;
      smearFx(pl, a - Math.PI, a + Math.PI, 34, 12, .2, cols, .16); meleeHit(pl, 36, 360, 1.4 * s, { heavy:true });
      G.projs.push({ x:pl.x + Math.cos(a) * 10, y:pl.y - 7 + Math.sin(a) * 10, vx:Math.cos(a) * 300, vy:Math.sin(a) * 300, r:10, life:.6, mult:2.2 * s, owner:'p', by:pl, kind:'wave', pierce:true, hit:new Set(), R:lv >= 2 ? 20 : 15, th:lv >= 2 ? 9 : 7, cols });
      shake(3, .12); break; }
    case 'dagger': {                                                  // 影步連斬：瞬移到敵人身邊連砍
      const t = nearestTarget(pl, 130), n = lv >= 2 ? 5 : 3;
      pl.skillLock = .1 + n * .07; pl.iframe = Math.max(pl.iframe, .2 + n * .07); blinkFx(pl, pl.x, pl.y, true);
      if (t) { const a = Math.atan2(pl.y - t.y, pl.x - t.x), nx = t.x + Math.cos(a) * (t.r + 9), ny = t.y + Math.sin(a) * (t.r + 9);
        if (!collides(nx, ny, pl.r)) { pl.x = nx; pl.y = ny; } pl.face = a + Math.PI; updFlip(pl); }
      else moveEnt(pl, Math.cos(pl.face) * 50, Math.sin(pl.face) * 50);
      blinkFx(pl, pl.x, pl.y, false);
      pl.skillLock = .1 + n * .1;
      for (let i = 0; i < n; i++) pl.timers.push({ t:.06 + i * .1, fn: () => {   // 角色自己連砍：每一刀換一種揮法跟姿勢
        const tt = t && t.hp > 0 ? t : null, last = i === n - 1;
        if (tt) { pl.face = Math.atan2(tt.y - pl.y, tt.x - pl.x); updFlip(pl); }
        const sw = pl.swing = newSwing(pl, 'dagger', QDAG, last, last ? 'slam' : DSEQ[i % DSEQ.length], {});
        swingSmear(pl, sw, 'dagger', cols, last);
        const cx = tt ? tt.x : pl.x + Math.cos(pl.face) * 14, cy = tt ? tt.y : pl.y + Math.sin(pl.face) * 14;
        aoeHit(pl, cx, cy, 20, .9 * s, last ? { heavy:true } : undefined); if (last) shake(3, .1); sfx.swing(); } });
      break; }
    case 'axe': {                                                     // 震地重擊：跳起來劈下，震波 + 裂痕
      autoFace(pl, 80); pl.skillLock = .5; pl.slam = .5; pl.iframe = Math.max(pl.iframe, .3);
      pl.timers.push({ t:.26, fn: () => { const cx = pl.x + Math.cos(pl.face) * 20, cy = pl.y + Math.sin(pl.face) * 20, R = lv >= 2 ? 70 : 52;
        smearFx(pl, pl.face - 1.7, pl.face + .3, 30, 14, .07, cols, .14);
        aoeHit(pl, cx, cy, R * .8, 2.6 * s, { stun:1.4, heavy:true }); quakeFx(cx, cy, R);
        sfx.boom(); shake(7, .3); G.hitStop = Math.max(G.hitStop, .07); } });
      break; }
    case 'spear': {                                                   // 流星突刺：往前衝 + 超長貫穿槍芒
      autoFace(pl, 130); const a = pl.face, L = lv >= 2 ? 100 : 80;      // L = 槍芒長度
      const LT = .14, LV = 250;                                         // 往前衝 0.14 秒 × 速度 250 ≈ 35 像素
      pl.skillLock = .22; pl.iframe = Math.max(pl.iframe, .3); pl.thrust = .2; pl.lunge = { t:LT, vx:Math.cos(a) * LV, vy:Math.sin(a) * LV };
      lanceFx(pl, a, L, lv >= 2 ? 16 : 12, cols, .3, true);
      // 槍芒會跟著角色往前衝，所以傷害範圍從「出發點」一路算到「衝完後槍芒的尖端」，看到的光都打得到
      const x0 = pl.x, y0 = pl.y, reach = LT * LV + 6 + L;
      pl.timers.push({ t:.05, fn: () => lineHit(pl, x0, y0, a, reach, 10, 2.4 * s, { heavy:true }) });
      break; }
    case 'staff': {                                                   // 星爆魔彈：大魔力球，爆炸（滿蓄力還會分裂）
      autoFace(pl, 200); const a = pl.face; pl.swing = { t:0, d:.25, ranged:true };
      G.projs.push({ x:pl.x + Math.cos(a) * 10, y:pl.y - 8 + Math.sin(a) * 10, vx:Math.cos(a) * 190, vy:Math.sin(a) * 190, r:6, life:1.2, mult:2.5 * s, owner:'p', by:pl, kind:'orb', rad:lv >= 2 ? 60 : 46, split:lv >= 2, big:lv >= 2 ? 8 : 6 });
      G.fx.push({ k:'rune', x:pl.x, y:pl.y, r:16, t:0, d:.45, rot:rr(0, TAU) });
      break; }
    case 'katana': {                                                  // 燕返：往前一閃，回頭再一閃（兩道交叉的刀光）
      autoFace(pl, 140); const a = pl.face, L = lv >= 2 ? 90 : 64; pl.skillLock = .34; pl.iframe = Math.max(pl.iframe, .34);
      const x0 = pl.x, y0 = pl.y; blinkFx(pl, pl.x, pl.y, true); moveEnt(pl, Math.cos(a) * L * .7, Math.sin(a) * L * .7); blinkFx(pl, pl.x, pl.y, false);
      lanceFx(pl, a + Math.PI, L * .7, 7, cols, .26, false); lineHit(pl, x0, y0, a, L * .7 + 10, 10, 1.6 * s, { heavy:true });
      pl.timers.push({ t:.16, fn: () => { pl.face = a + Math.PI; updFlip(pl); smearFx(pl, a + Math.PI - 1.4, a + Math.PI + 1.4, 34, 12, .08, cols, .14);
        meleeHit(pl, 38, 200, 1.5 * s, { heavy:true, crit:lv >= 2 }); sfx.swing(); shake(3, .12); } });
      sfx.swing(); break; }
    case 'hammer': {                                                  // 隕星重鎚：跳起來砸，落點炸開大震波（範圍比斧頭大）
      autoFace(pl, 80); pl.aimLock = .4; pl.skillLock = .62; pl.slam = .5;   // 0.32 秒才落地，面向要鎖到那時候 pl.iframe = Math.max(pl.iframe, .35);
      pl.timers.push({ t:.32, fn: () => { const cx = pl.x + Math.cos(pl.face) * 18, cy = pl.y + Math.sin(pl.face) * 18, R = lv >= 2 ? 84 : 62;
        smearFx(pl, pl.face - 1.8, pl.face + .3, 30, 16, .08, cols, .16);
        aoeHit(pl, cx, cy, R * .8, 3 * s, { stun:1.6, heavy:true }); quakeFx(cx, cy, R, lv >= 2);
        for (const dl of [0, .1]) G.fx.push({ k:'warp', x:cx, y:cy, r0:6, r1:R, th:5, delay:dl, t:0, d:.4 + dl, col:dl ? '#ffffff' : '#f2c14e' });
        sfx.boom(); shake(8, .35); G.hitStop = Math.max(G.hitStop, .09); } });
      break; }
    case 'scythe': {                                                  // 新月迴旋：鐮刀轉兩圈，第二圈範圍更大，打中回血
      const n = lv >= 2 ? 3 : 2; pl.skillLock = n * .17; pl.iframe = Math.max(pl.iframe, n * .15);
      for (let i = 0; i < n; i++) pl.timers.push({ t:i * .17, fn: () => { pl.spin = .3; const a = rr(0, TAU), R = 36 + i * 8;
        smearFx(pl, a, a + TAU * .97, R, 11, .15, cols, .1);
        aoeHit(pl, pl.x, pl.y, R + 2, 1.25 * s, { heal:.02, heavy: i === n - 1 }); sfx.swing(); } });
      break; }
    case 'wolfblade': {                                               // 狼牙迴旋：雙刃轉圈
      const n = lv >= 2 ? 3 : 2; pl.skillLock = n * .15 + .05; pl.iframe = Math.max(pl.iframe, n * .15);
      for (let i = 0; i < n; i++) pl.timers.push({ t:i * .15, fn: () => { pl.spin = .3; const a = rr(0, TAU);
        smearFx(pl, a, a + TAU * .95, 32, 9, .14, cols, .1); smearFx(pl, a + Math.PI, a + Math.PI - TAU * .9, 24, 7, .14, SHADOWBLADE, .1);
        aoeHit(pl, pl.x, pl.y, 34, 1.3 * s, i === n - 1 ? { heavy:true } : undefined); sfx.swing(); } });
      break; }
    case 'bow': {                                                     // 蓄力射擊：一支很粗的穿透箭（滿蓄力：三支）
      autoFace(pl, 230); pl.swing = { t:0, d:.25, ranged:true, ty:'bow' };
      for (const da of lv >= 2 ? [-.14, 0, .14] : [0]) shootArrow(pl, pl.face + da, 2.2 * s, true, cols, 540, true);
      G.fx.push({ k:'warp', x:pl.x + Math.cos(pl.face) * 12, y:pl.y - 7 + Math.sin(pl.face) * 12, r0:2, r1:lv >= 2 ? 16 : 12, th:2, sy:1, t:0, d:.2, col:cols[1] });
      shake(2, .1); break; }
    case 'elfbow': {                                                  // 精靈弓蓄力：滿月箭，一支很粗的穿透箭，落點炸開一圈葉刃（滿蓄力：五支扇形）
      autoFace(pl, 240); pl.swing = { t:0, d:.25, ranged:true, ty:'elfbow' };
      for (const da of lv >= 2 ? [-.24, -.12, 0, .12, .24] : [-.08, 0, .08]) shootArrow(pl, pl.face + da, (lv >= 2 ? 1.6 : 1.8) * s, true, cols, 560, da === 0);
      leafBurst(pl.x + Math.cos(pl.face) * 12, pl.y - 7, 10); shake(2, .1); break; }
    case 'elfrapier': {                                               // 精靈細劍蓄力：往前一閃，路上留下三道葉刃（滿蓄力一定暴擊）
      autoFace(pl, 130); const a = pl.face, L = lv >= 2 ? 90 : 64, x0 = pl.x, y0 = pl.y;
      pl.skillLock = .22; pl.iframe = Math.max(pl.iframe, .32); pl.thrust = .2;
      blinkFx(pl, pl.x, pl.y, true); moveEnt(pl, Math.cos(a) * L, Math.sin(a) * L); blinkFx(pl, pl.x, pl.y, false);
      const D = Math.hypot(pl.x - x0, pl.y - y0);
      G.fx.push({ k:'lance', follow:null, x:x0, y:y0 - 7, a, len:D + 18, w:6, t:0, d:.28, cols });
      lineHit(pl, x0, y0, a, D + 18, 8, 2.1 * s, { heavy:true, crit:lv >= 2 });
      for (const da of [-.35, 0, .35]) leafWave(pl, a + da, .6 * s, 12, 280, .26);
      sfx.swing(); shake(3, .1); break; }
    case 'elfblades': {                                               // 精靈雙刀蓄力：落葉旋風，在原地轉三圈（滿蓄力四圈），每圈越轉越大
      const n = lv >= 2 ? 4 : 3; pl.skillLock = n * .13 + .05; pl.iframe = Math.max(pl.iframe, n * .13);
      for (let i = 0; i < n; i++) pl.timers.push({ t:i * .13, fn: () => { pl.spin = .3; const a = rr(0, TAU), R = 30 + i * 4;
        smearFx(pl, a, a + TAU * .95, R, 9, .12, cols, .08); aoeHit(pl, pl.x, pl.y, R + 2, 1.1 * s, i === n - 1 ? { heavy:true } : undefined); leafBurst(pl.x, pl.y - 6, 6); sfx.swing(); } });
      break; }
    case 'greatsword': {                                              // 巨劍落：跳起來劈下，前方扇形 + 一條地裂（滿蓄力更長）
      autoFace(pl, 90); pl.skillLock = .55; pl.slam = .5; pl.iframe = Math.max(pl.iframe, .3);
      pl.timers.push({ t:.28, fn: () => { const a = pl.face;
        smearFx(pl, a - 1.8, a + .3, 34, 16, .08, cols, .16);
        meleeHit(pl, 42, 150, 2.4 * s, { heavy:true, stun:.8 }); crackLine(pl, a, lv >= 2 ? 120 : 80, 10, 1.2 * s, { stun:.6 });
        G.hitStop = Math.max(G.hitStop, .07); shake(6, .25); } });
      break; }
    case 'rapier': {                                                  // 閃刺：往前一閃穿過去（滿蓄力一定暴擊）
      autoFace(pl, 130); const a = pl.face, L = lv >= 2 ? 80 : 60, x0 = pl.x, y0 = pl.y;
      pl.skillLock = .2; pl.iframe = Math.max(pl.iframe, .3); pl.thrust = .2;
      blinkFx(pl, pl.x, pl.y, true); moveEnt(pl, Math.cos(a) * L, Math.sin(a) * L); blinkFx(pl, pl.x, pl.y, false);
      const D = Math.hypot(pl.x - x0, pl.y - y0);
      G.fx.push({ k:'lance', follow:null, x:x0, y:y0 - 7, a, len:D + 18, w:6, t:0, d:.28, cols });
      lineHit(pl, x0, y0, a, D + 18, 8, 2.2 * s, { heavy:true, crit:lv >= 2 }); sfx.swing(); shake(3, .1);
      break; }
    case 'crescent': {                                                // 月蝕：丟出一道大月牙（滿蓄力：前後各一道）
      autoFace(pl, 160); const a = pl.face; pl.spin = .3;
      smearFx(pl, a - Math.PI, a + Math.PI, 32, 11, .18, cols, .14);
      for (const da of lv >= 2 ? [0, Math.PI] : [0]) throwBoom(pl, a + da, 2 * s, 24, cols, .4, 360);
      sfx.swing(); shake(3, .12); break; }
    case 'twinblade': {                                               // 雙月突進：轉著刀往前衝，路上的都被捲進去，衝完再轉一圈
      autoFace(pl, 130); const a = pl.face, L = lv >= 2 ? 90 : 60, x0 = pl.x, y0 = pl.y, T = .18;
      pl.skillLock = .4; pl.iframe = Math.max(pl.iframe, .4); pl.spin = .3; pl.lunge = { t:T, vx:Math.cos(a) * L / T, vy:Math.sin(a) * L / T };
      smearFx(pl, a, a + TAU * .95, 30, 9, .16, cols, .08);
      pl.timers.push({ t:.1, fn: () => { lineHit(pl, x0, y0, a, L + 20, 14, 1.4 * s); sfx.swing(); } });
      pl.timers.push({ t:.22, fn: () => { pl.spin = .3; smearFx(pl, a, a + TAU * .95, 36, 11, .16, cols, .12);
        meleeHit(pl, 38, 360, 1.6 * s, { heavy:true }); sfx.swing(); shake(3, .12); } });
      break; }
    case 'darkmoon': {                                                // 月輪：轉一圈，往四周放出月光劍氣（滿蓄力 8 道）
      const n = lv >= 2 ? 8 : 6, a0 = pl.face; pl.spin = .3; pl.skillLock = .3; pl.iframe = Math.max(pl.iframe, .3);
      smearFx(pl, a0 - Math.PI, a0 + Math.PI, 36, 14, .2, MOONC, .16); meleeHit(pl, 40, 360, 1.6 * s, { heavy:true });
      for (let i = 0; i < n; i++) moonWave(pl, a0 + i / n * TAU, 1.1 * s, 15);
      G.fx.push({ k:'warp', x:pl.x, y:pl.y, r0:6, r1:44, th:3, t:0, d:.35, col:'#8aa0ff' }); shake(4, .15);
      break; }
  }
}
/* ---- 瞬移：原地留下錯位的殘影 + 內縮光圈，落點擴散光圈 + 星光，角色閃白出現 ---- */
export function blinkFx(pl: Player, x, y, out) {
  if (out) {
    G.ghosts.push({ x, y, flip:pl.flip, life:.32, max:.32, col:'glitch' });
    G.fx.push({ k:'warp', x, y, r0:16, r1:2, th:3, t:0, d:.22, col:'#9a7cff' });
    for (let i = 0; i < 10; i++) { const a = rr(0, TAU), sp = rr(30, 80); G.parts.push({ x:x + Math.cos(a) * 4, y:y - 8 + Math.sin(a) * 6, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 10, life:rr(.2, .4), max:.4, col:pick(STARC), star:rr(.6, 1.8), drag:4 }); }
  } else {
    G.fx.push({ k:'warp', x, y, r0:2, r1:18, th:3, t:0, d:.3, col:'#b49cff' });
    G.fx.push({ k:'warp', x, y:y - 8, r0:1, r1:10, th:2, sy:1, t:0, d:.18, col:'#ffffff' });
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; G.parts.push({ x, y:y - 8, vx:Math.cos(a) * 70, vy:Math.sin(a) * 50, life:.35, max:.35, col:pick(STARC), star:rr(1, 2.2), drag:5 }); }
    pl.blinkIn = .2;
  }
}
export function trySkill(pl: Player) {
  if (busy(pl)) return;
  const W = WT[pl.weapon.type], BS = pl.tfx && pl.tfx.bloodSkill;
  if (pl.skillCd > 0) {                                                  // 冷卻中：血契之戒 → 花生命放技能（冷卻不重算）
    const cost = Math.round(pl.maxHp * (BS || 0) / 100); if (!BS || pl.hp <= cost + 1) return;
    pl.hp -= cost; G.nums.push({ x:pl.x, y:pl.y - 28, txt:'-' + cost, col:'#d8434e', t:0, d:.7 }); burst(pl.x, pl.y - 8, 10, '#a01a2a', 70); sfx.skill();
  } else { pl.skillCd = W.scd * (1 - pl.cdr); sfx.skill(); }
  const col = RAR[pl.weapon.rarity].c, wc = wcols(pl, pl.weapon.type);
  switch (W.skill) {
    case 'spin':
      pl.skillLock = .45; pl.spin = .3; meleeHit(pl, 46, 360, 2.6);     // 第一圈 260%；0.2 秒後第二圈更大（也是 260%）
      pl.timers.push({ t:.2, fn: () => { pl.spin = .3; meleeHit(pl, 58, 360, 2.6, { heavy:true }); G.fx.push({ k:'ring', x:pl.x, y:pl.y - 6, r0:20, r1:60, t:0, d:.28, col:wc[1] });
        G.fx.push({ k:'arc', x:pl.x, y:pl.y - 6, a:0, arc:TAU, r:52, t:0, d:.2, col }); sfx.swing(); shake(3, .12); } });
      G.fx.push({ k:'ring', x:pl.x, y:pl.y - 6, r0:14, r1:46, t:0, d:.25, col:'#ffffff' });
      G.fx.push({ k:'arc', x:pl.x, y:pl.y - 6, a:0, arc:TAU, r:40, t:0, d:.2, col });
      for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, v = rr(90, 160);   // 一圈星光往外炸開
        G.parts.push({ x:pl.x + Math.cos(a) * 10, y:pl.y - 6 + Math.sin(a) * 8, vx:Math.cos(a) * v, vy:Math.sin(a) * v * .7, life:rr(.25, .42), max:.42, col:pick([wc[0], wc[1], wc[2], wc[2]]), star:rr(1, 2.4), drag:5 }); }
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU;             // 腳邊的灰被捲起來轉
        G.parts.push({ x:pl.x + Math.cos(a) * 7, y:pl.y + Math.sin(a) * 3, vx:Math.cos(a + 1.4) * 70, vy:Math.sin(a + 1.4) * 30 - 10, life:rr(.3, .5), max:.5, col:pick(['#d8ccb0', '#b8a888', '#8a7a64']), s:1, drag:3.5 }); }
      break;
    case 'dash': {
      const m = Math.hypot(input.mx, input.my); if (m > .2 && !nearestTarget(pl, 130)) pl.face = Math.atan2(input.my, input.mx); else autoFace(pl, 130);
      updFlip(pl);
      // 拖尾光帶：衝刺期間持續拉長（尾細頭粗），結束後從尾巴往前收
      const streak = { k:'streak', x0:pl.x, y0:pl.y - 8, x1:pl.x, y1:pl.y - 8, t:0, d:.4 };
      G.fx.push(streak);
      pl.dash = { t:.16, vx:Math.cos(pl.face) * 560, vy:Math.sin(pl.face) * 560, hit:new Set(), streak }; pl.iframe = .24;
      for (let i = 0; i < 3; i++) pl.timers.push({ t:.2 + i * .07, fn: () => { const t = nearestTarget(pl, 40); if (!t) return;   // 衝完：轉身對最近的敵人連砍三刀
        pl.face = Math.atan2(t.y - pl.y, t.x - pl.x); updFlip(pl); const a = pl.face + (i % 2 ? .9 : -.9);
        smearFx(pl, a, a - (i % 2 ? 1.8 : -1.8), 24, 7, .07, wc, .06); meleeHit(pl, 28, 160, 1.3, i === 2 ? { heavy:true } : undefined); sfx.swing(); } });
      // 起跑：腳下展開魔法陣 + 星光往後噴 + 輕微震動
      G.fx.push({ k:'rune', x:pl.x, y:pl.y, r:17, t:0, d:.55, rot:rr(0, TAU) });
      for (let i = 0; i < 14; i++) { const a = pl.face + Math.PI + rr(-.9, .9), s = rr(50, 160);
        G.parts.push({ x:pl.x, y:pl.y - rr(2, 14), vx:Math.cos(a) * s, vy:Math.sin(a) * s, life:rr(.3, .6), max:.6, col:pick(STARC), star:rr(1, 3), drag:5 }); }
      shake(2, .1); break; }
    case 'slam':
      autoFace(pl, 70); pl.skillLock = .5; pl.slam = .5;
      pl.timers.push({ t:.24, fn: () => { const cx = pl.x + Math.cos(pl.face) * 24, cy = pl.y + Math.sin(pl.face) * 24;
        aoeHit(pl, cx, cy, 40, 3.5, { stun:1.2 }); G.fx.push({ k:'ring', x:cx, y:cy, r0:6, r1:44, t:0, d:.35, col:'#f2c14e' });
        burst(cx, cy, 24, '#8a8296', 90); sfx.boom(); shake(5, .25);
        for (let i = 0; i < 18; i++) { const a = rr(0, TAU), v = rr(30, 110);   // 碎石飛起來再掉下去
          G.parts.push({ x:cx + rr(-6, 6), y:cy + rr(-3, 3), vx:Math.cos(a) * v, vy:Math.sin(a) * v * .5 - rr(70, 150), life:rr(.5, .8), max:.8, col:pick(['#8a8296', '#5e5a6e', '#b8a888', '#6a5040']), s:2, g:400, drag:1 }); }
        for (let i = 0; i < 22; i++) { const a = i / 22 * TAU;            // 沿地面擴散的塵土
          G.parts.push({ x:cx, y:cy, vx:Math.cos(a) * 120, vy:Math.sin(a) * 55, life:.42, max:.42, col:pick(['#d8ccb0', '#b8a888']), s:Math.random() < .3 ? 2 : 1, drag:4 }); }
        for (let i = 0; i < 12; i++) G.parts.push({ x:cx + rr(-14, 14), y:cy + rr(-6, 6), vx:rr(-15, 15), vy:-rr(30, 70), life:rr(.5, .9), max:.9, col:pick(['#ffb040', '#ff7a2a', '#ffe08a']), star:rr(.8, 1.8), drag:1.5 });   // 火星
      } }); break;
    case 'triple':
      autoFace(pl, 80); pl.skillLock = .42;
      for (let i = 0; i < 3; i++) pl.timers.push({ t: i * .13, fn: () => { meleeHit(pl, 56, 34, 2); pl.thrust = .1;
        G.fx.push({ k:'line', x:pl.x, y:pl.y - 6, a:pl.face, len:56, t:0, d:.12, col:'#ffffff' }); sfx.swing();
        const c = Math.cos(pl.face), sn = Math.sin(pl.face), tx = pl.x + c * 50, ty = pl.y - 6 + sn * 50;
        for (let k = 0; k < 9; k++) { const a = pl.face + rr(-.45, .45), v = rr(60, 170); G.parts.push({ x:tx, y:ty, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:rr(.15, .3), max:.3, col:pick([wc[1], wc[2], '#ffffff']), star:rr(.8, 2), drag:6 }); }   // 槍尖噴火花
        for (let k = 0; k < 10; k++) { const u = rr(.15, 1); G.parts.push({ x:pl.x + c * 56 * u, y:pl.y - 6 + sn * 56 * u + rr(-3, 3), vx:c * rr(80, 170), vy:sn * rr(80, 170), life:rr(.12, .22), max:.22, col:pick([wc[1], '#ffffff']), star:rr(.5, 1), drag:3 }); }   // 沿著槍的風
      } });
      break;
    case 'fireball':
      autoFace(pl, 190);
      G.projs.push({ x:pl.x + Math.cos(pl.face) * 8, y:pl.y - 7 + Math.sin(pl.face) * 8, vx:Math.cos(pl.face) * 200, vy:Math.sin(pl.face) * 200, r:4, life:1.1, mult:4.5, owner:'p', by:pl, kind:'fire' });
      { const mx = pl.x + Math.cos(pl.face) * 12, my = pl.y - 7 + Math.sin(pl.face) * 12;   // 杖頭噴出火焰 + 橘色光圈
        G.fx.push({ k:'warp', x:mx, y:my, r0:3, r1:13, th:2.5, sy:1, t:0, d:.22, col:'#ff9a3a' });
        for (let i = 0; i < 16; i++) { const a = pl.face + rr(-1.2, 1.2), v = rr(40, 140); G.parts.push({ x:mx, y:my, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 15, life:rr(.2, .4), max:.4, col:pick(['#ffe08a', '#ffb040', '#ff7a2a', '#ffffff']), star:rr(.8, 2), drag:5 }); } }
      pl.swing = { t:0, d:.2, ranged:true, ty:'staff' }; break;
    case 'iai': {                                                     // 居合一閃：收刀一瞬 → 消失 → 出現在前方，路上的敵人全被斬（必定暴擊）
      const m = Math.hypot(input.mx, input.my); if (m > .2 && !nearestTarget(pl, 120)) pl.face = Math.atan2(input.my, input.mx); else autoFace(pl, 120);
      updFlip(pl); pl.skillLock = .36; pl.iframe = .5; const a = pl.face, x0 = pl.x, y0 = pl.y;
      G.fx.push({ k:'warp', x:pl.x, y:pl.y, r0:18, r1:3, th:3, t:0, d:.14, col:wc[1] });
      pl.timers.push({ t:.12, fn: () => {
        blinkFx(pl, pl.x, pl.y, true); moveEnt(pl, Math.cos(a) * 78, Math.sin(a) * 78); const L = Math.hypot(pl.x - x0, pl.y - y0);
        G.fx.push({ k:'lance', follow:null, x:x0, y:y0 - 7, a, len:L + 10, w:6, t:0, d:.32, cols:wc });
        G.fx.push({ k:'line', x:x0, y:y0 - 7, a, len:L + 14, t:0, d:.22, col:'#ffffff' });
        lineHit(pl, x0, y0, a, L + 12, 12, 4, { crit:true, heavy:true });
        blinkFx(pl, pl.x, pl.y, false); pl.face = a; updFlip(pl); sfx.crit(); shake(4, .15); G.hitStop = Math.max(G.hitStop, .08);
        for (let k = 0; k < 18; k++) { const u = Math.random(); G.parts.push({ x:x0 + (pl.x - x0) * u, y:y0 - 7 + (pl.y - y0) * u, vx:rr(-20, 20), vy:rr(-30, 10), life:rr(.3, .6), max:.6, col:pick(['#ff8aa0', '#ffffff', '#ffd0dc']), star:rr(.6, 1.6), drag:2 }); }   // 刀光走過的地方飄下花瓣般的光點
      } });
      break; }
    case 'quake': {                                                   // 三重震波：連砸三下，一圈比一圈大
      autoFace(pl, 80); pl.skillLock = pl.aimLock = .95; pl.iframe = Math.max(pl.iframe, .3);
      for (let i = 0; i < 3; i++) pl.timers.push({ t:.12 + i * .3, fn: () => { pl.slam = .3;
        const cx = pl.x + Math.cos(pl.face) * 16, cy = pl.y + Math.sin(pl.face) * 16, R = 34 + i * 18;
        aoeHit(pl, cx, cy, R, 2, { stun:.8, heavy:true }); quakeFx(cx, cy, R, i === 2);
        G.fx.push({ k:'ring', x:cx, y:cy, r0:6, r1:R + 6, t:0, d:.35, col: i === 2 ? '#ffffff' : '#f2c14e' });
        burst(cx, cy, 14 + i * 6, '#8a8296', 90 + i * 20); sfx.boom(); shake(4 + i * 2, .2); } });
      break; }
    case 'reap': {                                                    // 死神收割：把周圍的敵人拉過來，再轉一大圈砍
      pl.skillLock = .4; pl.iframe = Math.max(pl.iframe, .3);
      for (const e of targets(pl)) { const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy); if (d > 90 || d < 20 || e.boss || e.elite) continue;
        moveEnt(e, dx / d * (d - 20) * .8, dy / d * (d - 20) * .8); }
      G.fx.push({ k:'warp', x:pl.x, y:pl.y, r0:90, r1:16, th:4, t:0, d:.22, col:wc[1] });
      pl.timers.push({ t:.14, fn: () => { pl.spin = .3; const a = rr(0, TAU);
        smearFx(pl, a, a + TAU * .97, 44, 14, .16, wc, .14); smearFx(pl, a + Math.PI, a + Math.PI - TAU * .9, 30, 8, .16, ['#0e2a20', '#2e7a5c', '#a8f0d0'], .12);
        aoeHit(pl, pl.x, pl.y, 46, 3.6, { heal:.04, heavy:true }); sfx.release(2); shake(4, .15);
        for (let k = 0; k < 24; k++) { const b = k / 24 * TAU; G.parts.push({ x:pl.x + Math.cos(b) * 40, y:pl.y - 6 + Math.sin(b) * 28, vx:-Math.cos(b) * 60, vy:-Math.sin(b) * 40 - 10, life:.45, max:.45, col:pick(wc), star:rr(.8, 2), drag:3 }); } } });
      break; }
    case 'wolfrush':
      pl.skillLock = .5; pl.iframe = .6;
      for (let i = 0; i < 3; i++) pl.timers.push({ t: i * .17, fn: () => {
        const t = nearestTarget(pl, 150);
        if (t) { const a = Math.atan2(t.y - pl.y, t.x - pl.x), nx = t.x + Math.cos(a) * (t.r + 8), ny = t.y + Math.sin(a) * (t.r + 8);
          trail(pl.x, pl.y, nx, ny);
          for (let k = 0; k < 16; k++) { const u = Math.random(); G.parts.push({ x:pl.x + (nx - pl.x) * u + rr(-3, 3), y:pl.y - rr(2, 12) + (ny - pl.y) * u, vx:rr(-12, 12), vy:-rr(10, 30), life:rr(.3, .55), max:.55, col:pick(['#3a2470', '#6a4ad0', '#9a6cff', '#e0d0ff']), star:rr(.6, 1.6), drag:2 }); }   // 路徑上的狼影紫霧
          for (let k = 0; k < 10; k++) { const b = a + rr(-1, 1), v = rr(60, 150); G.parts.push({ x:t.x, y:t.y - 7, vx:Math.cos(b) * v, vy:Math.sin(b) * v, life:rr(.15, .3), max:.3, col:pick(['#9a6cff', '#e0d0ff', '#ffffff']), star:rr(.8, 2), drag:6 }); }   // 撲到時的爪擊火花
          const bx = t.x - Math.cos(a) * (t.r + pl.r + 2), by = t.y - Math.sin(a) * (t.r + pl.r + 2);   // 穿過去會撞牆 → 停在敵人這一側
          if (!collides(nx, ny, pl.r) && canSee(t.x, t.y - 6, nx, ny - 6)) { pl.x = nx; pl.y = ny; }
          else if (!collides(bx, by, pl.r)) { pl.x = bx; pl.y = by; }
          pl.face = a + Math.PI; updFlip(pl); aoeHit(pl, t.x, t.y, 22, 1.8);
          G.fx.push({ k:'arc', x:t.x, y:t.y - 6, a:a, arc:2.2, r:22, t:0, d:.18, col:'#b49cff' }); }
        else { const nx = pl.x + Math.cos(pl.face) * 40, ny = pl.y + Math.sin(pl.face) * 40; trail(pl.x, pl.y, nx, ny); moveEnt(pl, nx - pl.x, ny - pl.y); }
        sfx.swing(); } });
      break;
    case 'arrowrain': {                                               // 箭雨：往天上射，前方一塊地落下 10 支箭（是子彈，瞬移也不會取消）
      const t = nearestTarget(pl, 200); autoFace(pl, 200);
      const cx = t ? t.x : pl.x + Math.cos(pl.face) * 90, cy = t ? t.y : pl.y + Math.sin(pl.face) * 90;
      pl.swing = { t:0, d:.25, ranged:true, ty:'bow' }; pl.skillLock = .25;
      G.fx.push({ k:'warp', x:cx, y:cy, r0:52, r1:48, th:2, t:0, d:.9, col:wc[1] });              // 落點的圈
      for (let i = 0; i < 6; i++) G.parts.push({ x:pl.x + rr(-3, 3), y:pl.y - 12, vx:rr(-20, 20), vy:-rr(220, 300), life:.25, max:.25, col:pick([wc[1], '#ffffff']), star:rr(1, 2), drag:1 });   // 往天上射的箭光
      for (let i = 0; i < 16; i++) { const ra = rr(0, TAU), rd = Math.sqrt(Math.random()) * 50;   // 16 支、半徑 50（以前 10 支、32）
        G.projs.push({ x:cx + Math.cos(ra) * rd, y:cy + Math.sin(ra) * rd * .8, vx:0, vy:0, r:0, life:.35 + i * .035, max:.35 + i * .035, mult:1.1, owner:'p', by:pl, kind:'rain', cols:wc, wood:pl.weapon.type === 'bow' }); }
      sfx.fire(); break; }
    case 'leafvolley': {                                              // 千葉齊射：往前方扇形連射十二支葉箭（穿透）
      autoFace(pl, 220); pl.skillLock = .5; const a0 = pl.face;
      for (let i = 0; i < 12; i++) pl.timers.push({ t:i * .035, fn: () => { pl.swing = { t:0, d:.1, ranged:true, ty:'elfbow' }; shootArrow(pl, a0 + (i % 2 ? 1 : -1) * (i >> 1) * .06, .8, true, wc, 520); if (i % 3 === 0) sfx.swing(); } });
      leafBurst(pl.x, pl.y - 8, 12); break; }
    case 'moonstep': {                                                // 月步：化成月光往前閃三次，每次穿過路上的敵人
      pl.skillLock = .5; pl.iframe = Math.max(pl.iframe, .55);
      for (let i = 0; i < 3; i++) pl.timers.push({ t:i * .16, fn: () => { const t = nearestTarget(pl, 120); if (t) pl.face = Math.atan2(t.y - pl.y, t.x - pl.x); updFlip(pl);
        const a = pl.face, x0 = pl.x, y0 = pl.y; blinkFx(pl, pl.x, pl.y, true); moveEnt(pl, Math.cos(a) * 56, Math.sin(a) * 56); blinkFx(pl, pl.x, pl.y, false);
        const D = Math.hypot(pl.x - x0, pl.y - y0); G.fx.push({ k:'lance', follow:null, x:x0, y:y0 - 7, a, len:D + 14, w:5, t:0, d:.24, cols:wc });
        lineHit(pl, x0, y0, a, D + 14, 9, 2.2, i === 2 ? { heavy:true } : undefined); sfx.swing(); } });
      break; }
    case 'windwaltz': {                                               // 風之輪舞：旋轉著往前衝，路上一直砍（6 下），衝完再轉一圈
      autoFace(pl, 140); const a = pl.face, L = 110, T = .36; pl.skillLock = .5; pl.iframe = Math.max(pl.iframe, .45);
      pl.lunge = { t:T, vx:Math.cos(a) * L / T, vy:Math.sin(a) * L / T };
      for (let i = 0; i < 6; i++) pl.timers.push({ t:i * .06, fn: () => { pl.spin = .3; const b = rr(0, TAU); smearFx(pl, b, b + TAU * .9, 28, 8, .1, wc, .05);
        aoeHit(pl, pl.x, pl.y, 30, 1); leafBurst(pl.x, pl.y - 6, 4); if (i % 2 === 0) sfx.swing(); } });
      pl.timers.push({ t:.4, fn: () => { pl.spin = .3; smearFx(pl, a, a + TAU * .95, 36, 11, .16, wc, .1); meleeHit(pl, 38, 360, 1.6, { heavy:true }); shake(3, .12); } });
      break; }
    case 'cleave':                                                    // 破山斬：舉劍過頭 → 往前劈，地面裂出一條直線
      autoFace(pl, 130); pl.skillLock = .6; pl.slam = .5; pl.iframe = Math.max(pl.iframe, .25);
      pl.timers.push({ t:.3, fn: () => { const a = pl.face; smearFx(pl, a - 1.8, a + .3, 36, 18, .08, wc, .18);
        crackLine(pl, a, 130, 12, 3.8, { heavy:true, stun:.8 }); G.hitStop = Math.max(G.hitStop, .07); shake(7, .3); } });
      break;
    case 'flurry':                                                    // 百花刺：連刺八下，最後一下一定暴擊
      autoFace(pl, 80); pl.skillLock = .62; pl.iframe = Math.max(pl.iframe, .2);
      for (let i = 0; i < 8; i++) pl.timers.push({ t:i * .07, fn: () => { const last = i === 7, a = pl.face + (last ? 0 : rr(-.22, .22));
        pl.thrust = .07; lanceFx(pl, a, 46, last ? 8 : 4, wc, .14, true);
        lineHit(pl, pl.x, pl.y, a, 48, 7, last ? 1.4 : .7, last ? { crit:true, heavy:true } : undefined); sfx.swing();
        for (let k = 0; k < 4; k++) { const b = a + rr(-.5, .5), v = rr(50, 120); G.parts.push({ x:pl.x + Math.cos(a) * 40, y:pl.y - 7 + Math.sin(a) * 40, vx:Math.cos(b) * v, vy:Math.sin(b) * v, life:rr(.25, .45), max:.45, col:pick(['#ff9ad0', '#ffd0e8', '#ffffff']), star:rr(.6, 1.6), drag:3 }); } } });   // 刺出去的地方飄出花瓣光
      break;
    case 'moonring': {                                                // 月輪迴旋：丟出三道月牙，飛出去再飛回來
      autoFace(pl, 160); pl.skillLock = .25; pl.spin = .3; const a = pl.face;
      for (const da of [-.5, 0, .5]) throwBoom(pl, a + da, 1.5, 17, wc, .38, 320);
      sfx.swing(); shake(2, .1); break; }
    case 'bladewheel':                                                // 旋刃風車：1.5 秒內一直轉，可以走動（不鎖移動），期間不能普攻
      pl.wheelT = G.time + 1.5;
      for (let i = 0; i < 10; i++) pl.timers.push({ t:i * .15, fn: () => { if (i % 2 === 0) { pl.spin = .3; sfx.swing(); } const a = rr(0, TAU);
        smearFx(pl, a, a + TAU * .9, 30, 9, .14, wc, .06);
        aoeHit(pl, pl.x, pl.y, 32, .6, { kb:.15 }); } });
      break;
    case 'moonbeam':                                                  // 暗月光波：舉劍吸月光 → 往前放出巨大的月光劍浪
      autoFace(pl, 200); pl.skillLock = .62; pl.slam = .5; pl.iframe = Math.max(pl.iframe, .3);
      G.fx.push({ k:'warp', x:pl.x, y:pl.y - 10, r0:32, r1:4, th:3, t:0, d:.3, col:'#8aa0ff' });
      pl.timers.push({ t:.32, fn: () => { const a = pl.face;
        smearFx(pl, a - 1.8, a + .3, 36, 18, .08, MOONC, .18); moonWave(pl, a, 4, 30, 260, .8);
        for (let k = 0; k < 20; k++) { const b = a + rr(-.8, .8), v = rr(60, 180); G.parts.push({ x:pl.x + Math.cos(a) * 16, y:pl.y - 8 + Math.sin(a) * 16, vx:Math.cos(b) * v, vy:Math.sin(b) * v, life:rr(.3, .5), max:.5, col:pick(MOONC), star:rr(1, 2.4), drag:4 }); }
        sfx.boom(); shake(6, .25); G.hitStop = Math.max(G.hitStop, .06); } });
      break;
  }
}
function trail(x0, y0, x1, y1) { for (let i = 0; i <= 10; i++) { const k = i / 10; G.parts.push({ x:x0 + (x1 - x0) * k, y:y0 - 6 + (y1 - y0) * k, vx:rr(-8, 8), vy:rr(-8, 8), life:.35, max:.35, col: i % 2 ? '#b49cff' : '#e8e2ff', s:2 }); } }
export function tryDodge(pl: Player) {                                                // 瞬移：消失、極快地移動一小段、在落點閃現
  if (pl.dodge > 0 || pl.drink > 0 || pl.dash || pl.dead) return;
  const C = ACLS[pl.acls] || ACLS.medium, cost = Math.round((20 + C.dodgeSt) * (1 - ((pl.tfx && pl.tfx.dodgeSave) || 0) / 100));   // 敏捷：瞬移省體力        // 防具類型：輕甲省體力、閃得遠；重甲相反
  if (!canDodge(pl, cost)) return;                                       // 體力要付得起、閃完 0.32 秒內不能再閃（game/builds.ts）
  stopCharge(pl); spendSt(pl, cost); dodgeStarted(pl, cost); const m = Math.hypot(input.mx, input.my);
  const a = m > .2 ? Math.atan2(input.my, input.mx) : pl.face, sp = 520 * C.dodgeMul * (pl.ride ? WOLF_DASH : 1);   // 騎著星狼：往前撲，距離短一點
  pl.dodge = .14; pl.cutSet = null; pl.iframe = Math.max(pl.iframe, .3); pl.dvx = Math.cos(a) * sp; pl.dvy = Math.sin(a) * sp;
  if (pl.tfx && pl.tfx.dodgeAtk) pl.dodgeAtkT = G.time + 1.5; pl.skillLock = 0; pl.timers = []; pl.lunge = null; pl.wheelT = 0;
  if (pl.swing && pl.swing.anim && pl.swing.t < pl.swing.wu) { pl.swing = null; for (let i = G.fx.length - 1; i >= 0; i--) if (G.fx[i].k === 'smear' && G.fx[i].follow === pl && G.fx[i].t < (G.fx[i].delay || 0)) G.fx.splice(i, 1); }   // 預備中翻滾 = 取消這一刀
  if (pl.ride) wolfDashFx(pl); else { blinkFx(pl, pl.x, pl.y, true); sfx.blink(); }
}
export function tryPot(pl: Player) {
  if (pl.pot <= 0 || busy(pl)) { if (pl.pot <= 0) toast('藥水用完了，回營火休息可以補滿', '#ff8a8a'); return; }
  pl.pot--; pl.drink = .55; sfx.drink(); if (pl === G.me) bumpPot();
}
/* 這一下是誰打的：怪 / Boss 更新時設定 G.hitCtx = { lv: 等級, fx: 這隻怪的異常狀態 }（子彈射出去時也記著），
   extra = 這一招額外的狀態（例如 Boss 砸地 = 暈眩） */
export function hurtPlayer(pl: Player, v, sx, sy, extra?: FX) {
  if (pl.dead) return false;
  if (!canSee(sx, sy - 6, pl.x, pl.y - 6)) return false;                 // 隔著牆打不到你
  if (pl.iframe > 0) { iframeHit(pl); return false; }                   // 無敵中：剛瞬移的話 = 完美閃避（game/builds.ts）
  if (sigBlock(pl)) return false;                                        // 王城近衛劍的護盾擋下這一下
  const T0 = pl.tfx || {};
  if (T0.evade && Math.random() * 100 < Math.min(40, T0.evade)) {         // 閃避流：有機率完全閃開（最多 40%），閃開後 0.25 秒不會再被打
    pl.iframe = .25; G.nums.push({ x:pl.x, y:pl.y - 28, txt:'MISS', col:'#c8e8ff', t:0, d:.7 }); G.ghosts.push({ x:pl.x + Math.sign(pl.x - sx || 1) * 5, y:pl.y, flip:pl.flip, life:.25, max:.25 }); sfx.dodge(); return false; }
  const C = G.hitCtx, T = pl.tfx || {}, res = (T['res_' + G.region] || 0) / 100, guard = (T.guard || 0) / 100;   // 地區抗性、飾品減傷
  const armor = !!(pl.swing && pl.swing.armor);                          // 大劍 / 暗月大劍揮劍中 = 霸體：受傷 ×0.6、不會被擊退
  v = Math.max(1, Math.round(v * (G.dmgMul || 1) * gapTaken(C ? C.lv : 0, level(pl)) * (1 - (pl.defRed || 0)) * (1 - res) * (1 - guard) * (armor ? .6 : 1)));   // 等級差、防禦
  pl.hp -= v; pl.hurt = .3; pl.iframe = .4; playerHurt(pl, v);       // playerHurt：反傷流的怒氣
  if (pl.ride || pl.rideT > 0) dismount(pl, true);                       // 騎著被打中：從星狼背上摔下來
  if (T.counter) pl.counterT = G.time + 2;                               // 反擊之誓：接下來 2 秒的下一擊必定暴擊
  const a = Math.atan2(pl.y - sy, pl.x - sx), kb = pl.acls === 'heavy' || armor ? 0 : 120; pl.kx = Math.cos(a) * kb; pl.ky = Math.sin(a) * kb;   // 重甲：不會被擊退
  G.nums.push({ x:pl.x, y:pl.y - 28, txt:String(v), col:'#ff5a5a', t:0, d:.8 });
  if (pl === G.me) { shake(3, .2); sfx.hurt(); }                       // 震動、音效只給自己（隊友受傷不震你的畫面）
  burst(pl.x, pl.y - 6, 8, '#d8434e', 60);
  if (C && C.fx) applyFx(pl, C.fx); if (extra) applyFx(pl, extra);
  if (T.thorns && C && C.src && !C.src.dead && C.src.hp > 0) {             // 反傷流：把一部分傷害還給打你的那隻（毒池、子彈也算是牠打的）
    let r = Math.max(1, Math.round(v * T.thorns / 100 * retalMul(pl)));   // 耐力：反擊更痛
    if (C.src.boss) r = Math.min(r, C.src.hp - 1);   // Boss 不會被反傷打死（最後一下要自己砍：牠正在出招的程式還在跑）
    if (r > 0) rawHit(pl, C.src, r, '#c88aff');
    if (r > 0) G.nums.push({ x:C.src.x + rr(-3, 3), y:C.src.y - (C.src.boss ? 26 : 16), txt:String(r), col:'#c88aff', t:0, d:.6 }); }
  if (pl.hp <= 0) downPlayer(pl);
  return true;
}
export function downPlayer(pl: Player) {                                 // 倒下（被打死、被毒 / 火燒死）
  pl.hp = 0; pl.dead = true; pl.deathT = 0; stopCharge(pl); pl.lunge = null; pl.ride = false; pl.rideT = 0;
  if (pl === G.me) { sfx.death(); showBanner('力竭倒下', pl.souls > 0 || pl.gold > 0 ? '八成的魂晶和金幣掉了，回去撿就能拿回來' : '', 2400); }
}


/* 月影之鈴：瞬移的時候，穿過的敵人各被砍一刀（每次瞬移每隻最多一次）。game/playerUpdate.ts 在瞬移移動中每幀呼叫 */
export function dodgeCut(pl: Player) {
  const v = pl.tfx && pl.tfx.dodgeCut; if (!v) return;
  const hit: Set<any> = pl.cutSet || (pl.cutSet = new Set());
  for (const e of targets(pl)) { if (hit.has(e) || e.hp <= 0 || Math.hypot(e.x - pl.x, e.y - pl.y) > 14 + (e.r || 6)) continue;
    hit.add(e); damageEnemy(pl, e, v / 100, pl.x, pl.y, { proc: true });
    G.fx.push({ k:'aline', x:e.x - 10, y:e.y - 10, a:Math.atan2(pl.dvy, pl.dvx), len:22, t:0, d:.18, col:'#e8dcff' }); }
}
