import { drawBossFx, drawBossProj } from './bossFx';
import { G } from '../core/state';
import { TAU, clamp, pick, rr } from '../core/util';
import { F, HK, LH, LW, ctx, lctx, lightC, snapF } from '../core/canvas';
import { OL } from '../art/sprite';
import { HERO, HERO_W } from '../art/hero';
import { SPR } from '../art/monsters';
import { ARENA, CAMPS, DOOR, LAVA, MH, MW, REGIONS, TS, WATER, braziers, glows, map, torches } from '../world/map';
import { drawBarrier, drawRBTele, rbs } from '../world/regionBoss';
import { FIREC } from '../world/bossAI';
import { BRAZ_SP, CH, CPX, GLOW_SP, drawArtSprite, flame, getChunk, prefetchChunks } from '../world/chunks';
import { cam, light } from '../game/player';
import { regAt } from '../game/collision';
import { drawCoin } from '../game/worldUpdate';
import { drawNum, drawPlayer, drawShadow, heroSlices } from './player';
import { drawBlind, drawStatus } from '../game/status';
import { artLine, artPath, asn, drawCrescent, drawLance, drawOrb, drawQuake, drawRibbon, drawRune, drawSmear, drawSpikes, drawStar, drawWarp, drawWaveP, fxCols } from './fx';
import { addLight, drawCamp, drawDrop, drawEnemy, drawTelegraph } from './enemy';
import { drawMerchant, merchant } from '../ui/shop';
import { drawChests } from '../world/chests';
import { drawNPCs } from '../world/towns';
import { drawQuestArrow, drawTablets } from '../game/quest';
import { drawDoors } from '../world/dungeonArt';
import { camDt } from '../main';

export const view = { x: 0, y: 0 };                                  // 畫面左上角在世界的哪裡（給 HTML 介面對齊用）
export function render() {
  G.frameNo++;
  ctx.setTransform(F, 0, 0, F, 0, 0); ctx.imageSmoothingEnabled = false;
  const sx = G.shakeT > 0 ? rr(-G.shakeMag, G.shakeMag) : 0, sy = G.shakeT > 0 ? rr(-G.shakeMag, G.shakeMag) : 0;
  const tx = G.me.x - LW / 2, ty = G.me.y - 8 - LH / 2, ck = 1 - Math.pow(.8, Math.min(3, camDt * 60));   // 跟隨速度跟幀率無關（120Hz 手機不會忽快忽慢）
  cam.x += (tx - cam.x) * ck; cam.y += (ty - cam.y) * ck;
  const maxX = Math.max(0, MW * TS - LW), maxY = Math.max(0, MH * TS - LH);
  view.x = clamp(cam.x, 0, maxX); view.y = clamp(cam.y, 0, maxY);
  const cx = snapF(clamp(cam.x + sx, 0, maxX)), cy = snapF(clamp(cam.y + sy, 0, maxY));   // 對齊實體像素，跟角色同一個格子，畫面不會一格一格跳
  ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, LW, LH);
  for (let gy = Math.floor(cy / CPX); gy <= Math.floor((cy + LH) / CPX); gy++) for (let gx = Math.floor(cx / CPX); gx <= Math.floor((cx + LW) / CPX); gx++) {
    if (gx < 0 || gy < 0 || gx * CH >= MW || gy * CH >= MH) continue;
    ctx.drawImage(getChunk(gx, gy), gx * CPX - cx, gy * CPX - cy, CPX, CPX);
  }
  prefetchChunks(cx, cy);
  ctx.save(); ctx.translate(-cx, -cy);
  const vis = (x, y, m = 40) => x > cx - m && x < cx + LW + m && y > cy - m && y < cy + LH + m;
  const L = [];
  addLight(L, G.me.x, G.me.y - 8, 112 + Math.sin(G.time * 9) * 2, 0);
  const tx0 = Math.max(0, Math.floor(cx / TS)), tx1 = Math.min(MW - 1, Math.floor((cx + LW) / TS)), ty0 = Math.max(0, Math.floor(cy / TS)), ty1 = Math.min(MH - 1, Math.floor((cy + LH) / TS));
  const lavaT = [];
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const t = map[y * MW + x];
    if (t === WATER) { const ph = (x * 7 + y * 13) % 20, k = Math.floor(G.time * 3 + ph) % 20; if (k < 3) { const q = HK; ctx.fillStyle = '#b8dcff'; ctx.fillRect(x * TS + (ph % 11) + k, y * TS + 5 + (ph % 7), 7 * q, q); ctx.fillStyle = '#ffffff'; ctx.fillRect(x * TS + (ph % 11) + k + 2 * q, y * TS + 5 + (ph % 7), 2 * q, q); } }
    else if (t === LAVA) { lavaT.push(x, y); const ph = (x * 5 + y * 11) % 17, k = Math.floor(G.time * 2 + ph) % 17; if (k < 2) { const q = HK, bx = x * TS + 4 + (ph % 7), by = y * TS + 6 + (ph % 5) - k; ctx.fillStyle = '#ffd27a'; ctx.fillRect(bx, by, 5 * q, 4 * q); ctx.fillStyle = '#fff4c0'; ctx.fillRect(bx + q, by + q, 2 * q, q); ctx.fillStyle = '#b03c18'; ctx.fillRect(bx + 2 * q, by + 2 * q, 2 * q, q); } }
  }
  for (const t of torches) if (vis(t.x, t.y, 80)) { flame(t.x, t.y, 4, t.ph); addLight(L, t.x, t.y + 4, 74 + Math.sin(G.time * 11 + t.ph) * 3, 1); }
  for (const s of glows) if (vis(s.x, s.y, 50)) {
    const p = .5 + .5 * Math.sin(G.time * 2 + s.ph), x = Math.round(s.x), y = Math.round(s.y);
    drawArtSprite(GLOW_SP[p > .5 ? 1 : 0], s.x, s.y + 1);
    addLight(L, s.x, s.y - 2, 34 + p * 6, 2);
  }
  for (const b of braziers) if (vis(b.x, b.y, 80)) {
    const x = Math.round(b.x), y = Math.round(b.y);
    drawShadow(x, y + 1, 12); drawArtSprite(BRAZ_SP, x, y + 1);
    flame(x - 2.5, y - 6, 5, 4); flame(x + 2.5, y - 6, 6, 5); flame(x, y - 6.5, 9, 6);
    addLight(L, b.x, b.y - 8, 68 + Math.sin(G.time * 10 + b.x) * 3, 1);
  }
  if (!G.bossDead) for (const fxX of DOOR) {
    const x0 = fxX * TS, y0 = ARENA.y1 * TS;
    if (!vis(x0, y0)) continue;
    ctx.globalAlpha = G.fogLocked ? .55 : .3; ctx.fillStyle = '#b8b2e0'; ctx.fillRect(x0, y0 + 2, 16, 14);
    for (let i = 0; i < 10; i++) { const a = G.time * 1.6 + i * .9 + fxX; ctx.globalAlpha = G.fogLocked ? .8 : .5; ctx.fillStyle = i % 2 ? '#e8e4ff' : '#9a94c8';
      ctx.fillRect(asn(x0 + 7 + Math.cos(a) * 6), asn(y0 + 8 + Math.sin(a * 1.3) * 6), 4 * HK, 4 * HK); ctx.fillStyle = '#ffffff'; ctx.fillRect(asn(x0 + 7 + Math.cos(a) * 6) + HK, asn(y0 + 8 + Math.sin(a * 1.3) * 6) + HK, HK, HK); }
    ctx.globalAlpha = 1;
    addLight(L, x0 + 8, y0 + 8, 30, 3);
  }
  for (const c of CAMPS) if (c.lit && vis(c.x, c.y, 100)) addLight(L, c.x, c.y - 6, 104 + Math.sin(G.time * 7) * 4, 1);
  if (G.lost && vis(G.lost.x, G.lost.y)) { const p = Math.sin(G.time * 5); drawStar(G.lost.x, G.lost.y - 6, 5 + p * 1.5, '#9a7cff'); drawStar(G.lost.x, G.lost.y - 6, 2.5 + p, '#e8e2ff');
    if (Math.random() < .2) G.parts.push({ x:G.lost.x + rr(-3, 3), y:G.lost.y - 4, vx:0, vy:-18, life:.6, max:.6, col:'#b49cff', s:1 }); addLight(L, G.lost.x, G.lost.y - 4, 30, 3); }
  for (const e of G.enemies) if (vis(e.x, e.y)) drawTelegraph(e);
  if (G.B) drawTelegraph(G.B);
  G.RB_L = L; for (const e of rbs) { if (e.dead) continue; if (e.state !== 'sleep') { drawBarrier(e); drawRBTele(e); } else if (Math.hypot(G.me.x - e.def.x, G.me.y - e.def.y) < e.def.R + 120) drawBarrier(e, true); }
  const list = [];
  for (const e of G.enemies) if (vis(e.x, e.y)) list.push({ y:e.y, f:() => drawEnemy(e) });
  if (G.B && vis(G.B.x, G.B.y, 60)) list.push({ y:G.B.y, f:() => drawEnemy(G.B) });
  for (const e of rbs) if (!e.dead && vis(e.x, e.y, 80)) list.push({ y:e.y, f:() => drawEnemy(e) });
  for (const c of CAMPS) if (vis(c.x, c.y)) list.push({ y:c.y, f:() => drawCamp(c) });
  for (const d of G.drops) if (vis(d.x, d.y)) { list.push({ y:d.y - 1, f:() => drawDrop(d) }); addLight(L, d.x, d.y - 8, 16 + d.item.rarity * 7, 3); }
  for (const c of G.coins) if (vis(c.x, c.y)) list.push({ y:c.y, f:() => drawCoin(c) });
  drawChests(L, vis, addLight, list); drawNPCs(vis, list); drawTablets(vis, list, L, addLight); drawDoors(vis, list, L, addLight);
  if (merchant && vis(merchant.x, merchant.y, 60)) { list.push({ y:merchant.y, f:drawMerchant }); addLight(L, merchant.x - 5, merchant.y - 10, 46 + Math.sin(G.time * 6) * 2, 1); }
  // 殘影：衝刺是紫色剪影（最新的疊白光），翻滾是會跟著轉的淡白剪影
  for (const g of G.ghosts) { const k = g.life / g.max, sp = HERO.walk[0], w = sp.w * HK, h = sp.h * HK;
    if (g.col === 'glitch') { ctx.globalAlpha = .85 * k; heroSlices(sp, snapF(g.x - (g.flip ? HERO_W - 26 : 26) * HK), snapF(g.y + 2 - h), g.flip, HK, (1 - k) * 12 + 1, k > .6); continue; }
    ctx.save(); ctx.translate(snapF(g.x), snapF(g.y + 2 - h / 2));
    if (g.rot !== undefined) { ctx.rotate(g.rot); ctx.scale(.85, .85); }
    const X = -(g.flip ? HERO_W - 26 : 26) * HK, Y = -h / 2;
    if (g.col === 'w') { ctx.globalAlpha = .4 * k; ctx.drawImage(g.flip ? sp.wf : sp.wn, X, Y, w, h); }
    else { ctx.globalAlpha = .65 * k; ctx.drawImage(g.flip ? sp.pf : sp.pn, X, Y, w, h);
      if (k > .7) { ctx.globalAlpha = .5 * (k - .7) / .3; ctx.drawImage(g.flip ? sp.wf : sp.wn, X, Y, w, h); } }
    ctx.restore(); }
  ctx.globalAlpha = 1;
  for (const pl of G.players) {                                       // 每個玩家都畫，跟其他東西一起依 y 排序
    if (pl.dash) addLight(L, pl.x, pl.y - 8, 50, 3);
    list.push({ y:pl.y, f:() => { drawPlayer(pl); drawStatus(pl); } });   // 身上的冰塊、星星、藤蔓、累積條（game/status.ts）
  }
  list.sort((a, b) => a.y - b.y); for (const it of list) it.f();
  drawQuestArrow();
  for (const p of G.projs) {
    if (drawBossProj(p, L)) continue;                                  // Boss 專屬的子彈（render/bossFx.ts）
    if (p.kind === 'spore' && p.cols) { drawOrb(p.x, p.y, 3.4, p.cols); continue; }
    if (p.kind === 'spore') { ctx.fillStyle = OL; ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 3), 6, 6); ctx.fillStyle = '#c46ad8'; ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 4, 4); ctx.fillStyle = '#f0c8ff'; ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 1, 1); addLight(L, p.x, p.y, 20, 2); }
    else if (p.kind === 'bolt') { drawOrb(p.x, p.y, 3.2, p.cols || ['#6a4ad0', '#b49cff', '#ffffff']); addLight(L, p.x, p.y, 28, 3); }
    else if (p.kind === 'orb') { const pr = p.big + Math.sin(G.time * 20) * .8; drawOrb(p.x, p.y, pr, ['#4a2a9a', '#9a7cff', '#ffffff']);
      for (let i = 0; i < 4; i++) { const a = G.time * 6 + i * TAU / 4; drawStar(p.x + Math.cos(a) * (pr + 4), p.y + Math.sin(a) * (pr + 4) * .7, 1.5, '#e8dcff'); } addLight(L, p.x, p.y, 50, 3); }
    else if (p.kind === 'wave') { drawWaveP(p); addLight(L, p.x, p.y, 40, 3); }
    else if (p.kind === 'claw') { drawWaveP(p); addLight(L, p.x, p.y, 34, 1); }
    else if (p.kind === 'ember') { drawOrb(p.x, p.y, 4.5, p.cols || FIREC); addLight(L, p.x, p.y, 30, 1); }
    else if (p.kind === 'shot') { drawOrb(p.x, p.y, 4, p.cols); addLight(L, p.x, p.y, 24, 2); }
    else if (p.kind === 'glob') { drawOrb(p.x, p.y, 4.5, p.cols || ['#1d5a32', '#4fbf5a', '#c8ffc0']); addLight(L, p.x, p.y, 22, 2); }
    else { ctx.fillStyle = '#e8743b'; ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 3), 6, 6); ctx.fillStyle = '#ffe38a'; ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 3, 3); addLight(L, p.x, p.y, 44, 1); }
  }
  for (const f of G.fx) {
    const k = f.t / f.d; ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.col; ctx.fillStyle = f.col;
    if (drawBossFx(f, k, L)) continue;                                 // 水柱 / 插地的劍 / 舌頭、鎖鏈、光束……（render/bossFx.ts）
    if (f.k === 'smear') drawSmear(f);
    else if (f.k === 'star') drawStar(f.x, f.y, f.s * (1 - f.t / f.d * .7), '#ffffff');   // 刀尖一閃
    else if (f.k === 'lance') drawLance(f);
    else if (f.k === 'warp') drawWarp(f, k);
    else if (f.k === 'quake') drawQuake(f, k);
    else if (f.k === 'spike') drawSpikes(f, k);
    else if (f.k === 'meteor') { const u = k * k, mx = f.x + 50 * (1 - u), my = f.y - 170 * (1 - u); drawOrb(mx, my, 6, f.cols || ['#5a1408', '#f07a32', '#ffe38a']);
      G.parts.push({ x:mx + rr(-3, 3), y:my + rr(-3, 3), vx:rr(10, 30), vy:-rr(20, 60), life:.3, max:.3, col:pick(f.cols ? [f.cols[1], f.cols[2], '#5a5054'] : ['#ffb040', '#ff6a2a', '#5a5054']), s:2 }); addLight(L, mx, my, 40, 1); }
    else if (f.k === 'rghost') { const sp = SPR[f.kind], w = sp.w, h = sp.h; ctx.globalAlpha = .45 * (1 - k); ctx.drawImage(f.flip ? sp.rf : sp.rn, snapF(f.x - w / 2), snapF(f.y + 2 - h), w, h); }
    else if (f.k === 'bghost') { const sp = SPR.boss, w = sp.w, h = sp.h; ctx.globalAlpha = .5 * (1 - k); ctx.drawImage(f.flip ? sp.rf : sp.rn, snapF(f.x - w / 2), snapF(f.y + 2 - h), w, h); }
    else if (f.k === 'flash') { ctx.globalAlpha = f.a * (1 - k); ctx.fillStyle = f.col; ctx.fillRect(cx, cy, LW, LH); }
    else if (f.k === 'arc') drawSmear({ x:f.x, y:f.y, a0:f.a - f.arc / 2, a1:f.a + f.arc / 2, r:f.r, w:Math.min(12, f.r * .3), sw:f.d * .35, hold:f.d * .65, t:f.t, cols:fxCols(f.col), sy:.8 });
    else if (f.k === 'ring') { drawWarp({ x:f.x, y:f.y, r0:f.r0, r1:f.r1, th:3, sy:.6, col:f.col }, k); if (f.col === '#f2c14e') addLight(L, f.x, f.y, 60 * (1 - k), 1); }
    else if (f.k === 'line') drawLance({ x:f.x, y:f.y, a:f.a, len:f.len, w:5, t:f.t, d:f.d, cols:fxCols(f.col) });
    else if (f.k === 'streak') drawRibbon(f, k, L);
    else if (f.k === 'rune') drawRune(f, k, L);
    else if (f.k === 'cres') drawCrescent(f, k);
    else if (f.k === 'aline') { const len = f.len * (.6 + .4 * k); artPath(); artLine(f.x, f.y, f.x + Math.cos(f.a) * len, f.y + Math.sin(f.a) * len, 1); ctx.fill(); }
    else if (f.k === 'slash') { const w = 3 * (1 - k) + 1, len = f.len * (.7 + .3 * k);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.fillRect(-len / 2, -w / 2, len, w); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  for (const p of G.parts) { ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5); ctx.fillStyle = p.col;
    if (p.star) drawStar(p.x, p.y, p.star * (.55 + .45 * Math.sin(G.time * 28 + p.max * 40)) * Math.min(1, p.life / p.max * 2), p.col);
    else { const z = (p.s || 1) * 2 * HK; ctx.fillRect(asn(p.x), asn(p.y), z, z); } }
  for (const m of G.motes) { const a = Math.min(1, m.t, m.life - m.t) * (m.glow ? (.5 + .5 * Math.sin(G.time * 4 + m.ph)) : .5); ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = m.col; const ms = m.glow ? 2 * HK : HK; ctx.fillRect(asn(m.x), asn(m.y), ms, ms); if (m.glow) { ctx.globalAlpha *= .35; ctx.fillRect(asn(m.x) - HK, asn(m.y) - HK, 4 * HK, 4 * HK); } }
  ctx.globalAlpha = 1;
  ctx.restore();

  const RG = REGIONS[regAt(G.me.x, G.me.y)];
  light.amb += (RG.amb - light.amb) * .03; for (let k = 0; k < 3; k++) light.t[k] += (RG.tint[k] - light.t[k]) * .03;
  if (G.region === 'forest' || light.amb > .25) {
    for (let i = 0; i < 5 && G.region === 'forest'; i++) { const span = LW + 160; const mx = ((i * 137 + G.time * (6 + i * 2) * (i % 2 ? 1 : -1) - cx * .3) % span + span) % span - 80, my = ((i * 61 - cy * .3) % LH + LH) % LH;
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 80); g.addColorStop(0, 'rgba(205,220,225,.1)'); g.addColorStop(1, 'rgba(205,220,225,0)'); ctx.fillStyle = g; ctx.fillRect(mx - 80, my - 80, 160, 160); }
  }
  if (light.amb > .02) {
    lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, LW, LH);
    lctx.fillStyle = 'rgba(' + (light.t[0] | 0) + ',' + (light.t[1] | 0) + ',' + (light.t[2] | 0) + ',' + light.amb + ')'; lctx.fillRect(0, 0, LW, LH);
    lctx.globalCompositeOperation = 'destination-out';
    for (const l of L) { const x = l.x - cx, y = l.y - cy; if (x < -l.r || y < -l.r || x > LW + l.r || y > LH + l.r) continue;
      const g = lctx.createRadialGradient(x, y, 0, x, y, l.r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.45, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2); }
    ctx.drawImage(lightC, 0, 0);
  }
  ctx.globalCompositeOperation = 'lighter';
  if (lavaT.length) { ctx.fillStyle = 'rgba(255,110,40,' + (.16 + .05 * Math.sin(G.time * 3)) + ')'; for (let k = 0; k < lavaT.length; k += 2) ctx.fillRect(lavaT[k] * TS - cx, lavaT[k + 1] * TS - cy, TS, TS); }
  const tint = ['', 'rgba(255,140,50,', 'rgba(90,240,220,', 'rgba(170,150,255,', 'rgba(255,215,90,', 'rgba(235,240,255,'];   // 4 = 金色（金箱）、5 = 白色（霧門）
  for (const l of L) { if (!l.warm) continue; const x = l.x - cx, y = l.y - cy, r = l.r * .7; if (x < -r || y < -r || x > LW + r || y > LH + r) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, tint[l.warm] + '.16)'); g.addColorStop(1, tint[l.warm] + '0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.globalCompositeOperation = 'source-over';
  if (G.region === 'wastes') { ctx.fillStyle = 'rgba(255,190,110,.06)'; ctx.fillRect(0, 0, LW, LH); }
  drawBlind(cx, cy, LW, LH);                                              // 目盲：周圍變暗
  for (const n of G.nums) {                                               // 傷害數字：彈出來 → 往上飄 → 淡掉（畫在光影上面，暗處也看得到）
    const k = n.t / n.d, rise = 1 - (1 - Math.min(1, k * 2.2)) ** 2, pop = k < .12 ? 1 + (1 - k / .12) * .6 : 1;
    const sc = (n.big ? 4 / 3 : 1) * (pop > 1.3 ? 4 / 3 : 1);           // 剛出來時大一號，再縮回來（只用 1/3 的倍數，像素才不會糊）
    ctx.globalAlpha = k > .7 ? Math.max(0, 1 - (k - .7) / .3) : 1;
    drawNum(n.txt, n.x - cx, n.y - cy - rise * 10, n.col, sc);
  }
  ctx.globalAlpha = 1;
  if (G.me.hurt > 0) { ctx.fillStyle = 'rgba(200,30,40,' + (G.me.hurt * .5) + ')'; ctx.fillRect(0, 0, LW, LH); }
  if (G.me.dead) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(.75, G.me.deathT * .4) + ')'; ctx.fillRect(0, 0, LW, LH); }
}
