import { drawMechs } from '../world/bossMech';
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
import { drawWolf } from '../art/starWolf';
import { drawBlind, drawStatus } from '../game/status';
import { SET } from '../ui/pause';
import { artLine, artPath, asn, drawArrow, drawWoodArrow, drawCrescent, drawLance, drawOrb, drawQuake, drawRibbon, drawRune, drawSmear, drawSpikes, drawStar, drawWarp, drawWaveP, fxCols } from './fx';
import { addLight, drawCamp, drawDrop, drawEnemy, drawTelegraph } from './enemy';
import { rigOf } from '../art/bossRig';
import { drawMerchant, merchant } from '../ui/shop';
import { drawChests } from '../world/chests';
import { drawNPCs } from '../world/towns';
import { drawQuestArrow, drawTablets, regionLook } from '../game/quest';
import { drawDoors } from '../world/dungeonArt';
import { drawPuzzles, puzzleDark } from '../world/puzzles';
import { drawStatues } from '../world/statues';
import { drawAltar } from '../world/ending';
import { drawSecrets } from '../world/secrets';
import { camDt } from '../main';
import { drawPfx } from './pfx';
import { drawSandstorm } from './sand';
import { drawLost, drawLostBeam } from './lostMark';
import { gZ } from '../world/elev';
import { drawIsoGround, flat, iso, isoCam, isoWorldList, scrAng, sX, sY, upright } from './iso';

export const view = { x: 0, y: 0 };                                  // 畫面左上角在世界的哪裡（給 HTML 介面對齊用）
export function render() {
  G.frameNo++;
  ctx.setTransform(F, 0, 0, F, 0, 0); ctx.imageSmoothingEnabled = false;
  const shk = G.shakeT > 0 && !G.paused && SET.shake;                  // 暫停（地圖、選單開著）時不震：震動的倒數只在遊戲進行時才會減少
  const sx = shk ? rr(-G.shakeMag, G.shakeMag) : 0, sy = shk ? rr(-G.shakeMag, G.shakeMag) : 0;
  const tx = G.me.x - LW / 2, ty = G.me.y - 8 - LH / 2, ck = 1 - Math.pow(.8, Math.min(3, camDt * 60));   // 跟隨速度跟幀率無關（120Hz 手機不會忽快忽慢）
  cam.x += (tx - cam.x) * ck; cam.y += (ty - cam.y) * ck;
  const maxX = Math.max(0, MW * TS - LW), maxY = Math.max(0, MH * TS - LH);
  view.x = clamp(cam.x, 0, maxX); view.y = clamp(cam.y, 0, maxY);
  const cx = snapF(clamp(cam.x + sx, 0, maxX)), cy = snapF(clamp(cam.y + sy, 0, maxY));   // 對齊實體像素，跟角色同一個格子，畫面不會一格一格跳
  ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, LW, LH);
  if (iso.on) { isoCam(sx, sy, ck); drawIsoGround(); ctx.setTransform(F, 0, 0, F, 0, 0); }   // 斜視角 demo（render/iso.ts）
  else for (let gy = Math.floor(cy / CPX); gy <= Math.floor((cy + LH) / CPX); gy++) for (let gx = Math.floor(cx / CPX); gx <= Math.floor((cx + LW) / CPX); gx++) {
    if (gx < 0 || gy < 0 || gx * CH >= MW || gy * CH >= MH) continue;
    ctx.drawImage(getChunk(gx, gy), gx * CPX - cx, gy * CPX - cy, CPX, CPX);
  }
  if (!iso.on) prefetchChunks(cx, cy);
  ctx.save(); if (iso.on) flat(); else ctx.translate(-cx, -cy);
  const vis = iso.on ? (x, y, m = 40) => { const px = sX(x, y), py = sY(x, y); return px > -m && px < LW + m && py > -m && py < LH + m * 2; }
    : (x, y, m = 40) => x > cx - m && x < cx + LW + m && y > cy - m && y < cy + LH + m;
  const L = [];
  addLight(L, G.me.x, G.me.y - 8, 112 + Math.sin(G.time * 9) * 2, 0);
  const tx0 = Math.max(0, Math.floor(cx / TS)), tx1 = Math.min(MW - 1, Math.floor((cx + LW) / TS)), ty0 = Math.max(0, Math.floor(cy / TS)), ty1 = Math.min(MH - 1, Math.floor((cy + LH) / TS));
  const lavaT = [];
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const t = map[y * MW + x];
    if (t === WATER) { const ph = (x * 7 + y * 13) % 20, k = Math.floor(G.time * 3 + ph) % 20; if (k < 3) { const q = HK; ctx.fillStyle = '#b8dcff'; ctx.fillRect(x * TS + (ph % 11) + k, y * TS + 5 + (ph % 7), 7 * q, q); ctx.fillStyle = '#ffffff'; ctx.fillRect(x * TS + (ph % 11) + k + 2 * q, y * TS + 5 + (ph % 7), 2 * q, q); } }
    else if (t === LAVA) { lavaT.push(x, y); const ph = (x * 5 + y * 11) % 17, k = Math.floor(G.time * 2 + ph) % 17; if (k < 2) { const q = HK, bx = x * TS + 4 + (ph % 7), by = y * TS + 6 + (ph % 5) - k; ctx.fillStyle = '#ffd27a'; ctx.fillRect(bx, by, 5 * q, 4 * q); ctx.fillStyle = '#fff4c0'; ctx.fillRect(bx + q, by + q, 2 * q, q); ctx.fillStyle = '#b03c18'; ctx.fillRect(bx + 2 * q, by + 2 * q, 2 * q, q); } }
  }
  for (const t of torches) if (vis(t.x, t.y, 80)) { if (iso.on) upright(t.x, t.y); flame(t.x, t.y, 4, t.ph); addLight(L, t.x, t.y + 4, 74 + Math.sin(G.time * 11 + t.ph) * 3, 1); }
  for (const s of glows) if (vis(s.x, s.y, 50)) {
    const p = .5 + .5 * Math.sin(G.time * 2 + s.ph), x = Math.round(s.x), y = Math.round(s.y);
    if (iso.on) upright(s.x, s.y); drawArtSprite(GLOW_SP[p > .5 ? 1 : 0], s.x, s.y + 1);
    addLight(L, s.x, s.y - 2, 34 + p * 6, 2);
  }
  for (const b of braziers) if (vis(b.x, b.y, 80)) {
    const x = Math.round(b.x), y = Math.round(b.y);
    if (iso.on) upright(x, y); drawShadow(x, y + 1, 12); drawArtSprite(BRAZ_SP, x, y + 1);
    flame(x - 2.5, y - 6, 5, 4); flame(x + 2.5, y - 6, 6, 5); flame(x, y - 6.5, 9, 6);
    addLight(L, b.x, b.y - 8, 68 + Math.sin(G.time * 10 + b.x) * 3, 1);
  }
  if (iso.on) flat();
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
  drawLost(L, vis);                                                     // 倒下掉的魂晶：大顆魂晶 + 光環（光柱在後面畫，render/lostMark.ts）
  for (const e of G.enemies) if (vis(e.x, e.y)) drawTelegraph(e);
  if (G.B) drawTelegraph(G.B);
  G.RB_L = L; for (const e of rbs) { if (e.dead) continue; if (e.state !== 'sleep') { drawBarrier(e); drawRBTele(e); } else if (Math.hypot(G.me.x - e.def.x, G.me.y - e.def.y) < e.def.R + 120) drawBarrier(e, true); }
  const list = [];
  for (const e of G.enemies) if (vis(e.x, e.y)) list.push({ x:e.x, y:e.y, o:e, f:() => drawEnemy(e) });
  if (G.B && vis(G.B.x, G.B.y, 60)) list.push({ x:G.B.x, y:G.B.y, o:G.B, f:() => drawEnemy(G.B) });
  for (const e of rbs) if (!e.dead && !e.hidden && vis(e.x, e.y, 80)) list.push({ x:e.x, y:e.y, o:e, f:() => drawEnemy(e) });   // hidden = 鑽進地底 / 飛上天
  drawMechs(rbs, vis, list, L, addLight);                               // Boss 機制：裂口、水晶、護盾、土丘、影子（world/bossMech.ts）
  for (const c of CAMPS) if (vis(c.x, c.y)) list.push({ x:c.x, y:c.y, f:() => drawCamp(c) });
  for (const d of G.drops) if (vis(d.x, d.y)) { list.push({ x:d.x, y:d.y - 1, f:() => drawDrop(d) }); addLight(L, d.x, d.y - 8, 16 + d.item.rarity * 7, 3); }
  for (const c of G.coins) if (vis(c.x, c.y)) list.push({ x:c.x, y:c.y, f:() => drawCoin(c) });
  drawChests(L, vis, addLight, list); drawNPCs(vis, list); drawTablets(vis, list, L, addLight); drawDoors(vis, list, L, addLight); drawPuzzles(vis, list, L, addLight); drawStatues(vis, list, L, addLight); drawAltar(vis, list, L, addLight); drawSecrets(vis, list, L, addLight);
  if (merchant && vis(merchant.x, merchant.y, 60)) { list.push({ x:merchant.x, y:merchant.y, f:drawMerchant }); addLight(L, merchant.x - 5, merchant.y - 10, 46 + Math.sin(G.time * 6) * 2, 1); }
  // 殘影：衝刺是紫色剪影（最新的疊白光），翻滾是會跟著轉的縮成一團紫白剪影
  for (const g of G.ghosts) { if (iso.on) upright(g.x, g.y); const k = g.life / g.max, sp = HERO.walk[0], w = sp.w * HK, h = sp.h * HK;
    if (g.col === 'wolf') { ctx.globalAlpha = .55 * k; drawWolf(g.x, g.y + 2, g.flip, g.run ?? 0, 'p'); continue; }   // 騎著星狼衝刺：紫色的狼殘影（跟狼停在同一格）
    if (g.col === 'roll') { const rs = HERO.roll[g.fi ?? 2], rw = rs.w * HK, rh = rs.h * HK, rx = snapF(g.x - rw / 2), ry = snapF(g.y - rh);
      ctx.globalAlpha = .28 * k; ctx.drawImage(g.flip ? rs.f : rs.n, rx, ry, rw, rh);
      ctx.globalAlpha = .16 * k; ctx.drawImage(g.flip ? rs.pf : rs.pn, rx, ry, rw, rh);
      continue; }
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
    list.push({ x:pl.x, y:pl.y, o:pl, f:() => { drawPlayer(pl); drawStatus(pl); } });   // 身上的冰塊、星星、藤蔓、累積條（game/status.ts）
  }
  if (iso.on) {                                                          // 斜視角：依 x + y 排前後；有腳底座標的站著畫，沒有的貼在地上
    for (const it of list) it.k = it.x !== undefined ? it.x + it.y + (it.o?.z || gZ(it.x, it.y)) + 2 : G.me.x + it.y;   // 站在高台上 → 排在高台那幾格後面（腳才不會被地面蓋住）
    isoWorldList(list); list.sort((a, b) => a.k - b.k);
    for (const it of list) { if (it.y === undefined) { it.f(); continue; } if (it.x === undefined) { flat(); it.f(); continue; } isoUp(it); }
    flat();
  } else { list.sort((a, b) => a.y - b.y); for (const it of list) it.f(); }
  drawQuestArrow();
  for (const p of G.projs) {
    if (iso.on) upright(p.x, p.y);
    if (drawBossProj(p, L)) continue;                                  // Boss 專屬的子彈（render/bossFx.ts）
    if (p.kind === 'spore' && p.cols) { drawOrb(p.x, p.y, 3.4, p.cols); continue; }
    if (p.kind === 'spore') { ctx.fillStyle = OL; ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 3), 6, 6); ctx.fillStyle = '#c46ad8'; ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 4, 4); ctx.fillStyle = '#f0c8ff'; ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 1, 1); addLight(L, p.x, p.y, 20, 2); }
    else if (p.kind === 'bolt') { drawOrb(p.x, p.y, 3.2, p.cols || ['#6a4ad0', '#b49cff', '#ffffff']); addLight(L, p.x, p.y, 28, 3); }
    else if (p.kind === 'orb') { const pr = p.big + Math.sin(G.time * 20) * .8; drawOrb(p.x, p.y, pr, ['#4a2a9a', '#9a7cff', '#ffffff']);
      for (let i = 0; i < 4; i++) { const a = G.time * 6 + i * TAU / 4; drawStar(p.x + Math.cos(a) * (pr + 4), p.y + Math.sin(a) * (pr + 4) * .7, 1.5, '#e8dcff'); } addLight(L, p.x, p.y, 50, 3); }
    else if (p.kind === 'wave') { drawWaveP(p); addLight(L, p.x, p.y, 40, 3); }
    else if (p.kind === 'boom') { const a = G.time * 16; if (p.seek) { const g = ctx.globalAlpha; ctx.globalAlpha = .18 + .06 * Math.sin(G.time * 9); drawOrb(p.x, p.y, p.R * 1.05, p.cols ? [p.cols[0], p.cols[1], p.cols[2], p.cols[2]] : ['#2c3a8a', '#6a86e0', '#a8c4ff', '#d8e4ff']); ctx.globalAlpha = g; }   // 月牙：邊飛邊轉；月牙刀的外面一圈淡淡的月暈   // 月暈跟著刀光的顏色（沙王的月牙刀是沙色）
      drawWaveP({ x:p.x, y:p.y, vx:Math.cos(a), vy:Math.sin(a), R:p.R, th:p.th, half:p.half, cols:p.cols }); addLight(L, p.x, p.y, p.seek ? 60 : 36, p.seek ? 5 : 3); }
    else if (p.kind === 'arrow' && p.wood) drawWoodArrow(p.x, p.y, Math.atan2(p.vy, p.vx), p.big ? 13 : 10);   // 長弓：一般的木箭
    else if (p.kind === 'arrow') { drawArrow(p.x, p.y, Math.atan2(p.vy, p.vx), p.big ? 16 : 11, p.cols, p.big); addLight(L, p.x, p.y, p.big ? 34 : 24, 6); }   // 綠光（箭都是綠色魔法劍）
    else if (p.kind === 'rain') { const q = p.life / .14; if (q < 1) { if (p.wood) drawWoodArrow(p.x, p.y - q * 70, Math.PI / 2, 10); else drawArrow(p.x, p.y - q * 70, Math.PI / 2, 11, p.cols, false); } }   // 箭雨：最後 0.14 秒從天上掉下來
    else if (p.kind === 'claw') { drawWaveP(p); addLight(L, p.x, p.y, 34, 1); }
    else if (p.kind === 'ember') { drawOrb(p.x, p.y, 4.5, p.cols || FIREC); addLight(L, p.x, p.y, 30, 1); }
    else if (p.kind === 'snowball') { ctx.globalAlpha = .3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r + 3, p.r, p.r * .35, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;   // 會反彈的大雪球（雪原巨人）
      drawOrb(p.x, p.y, p.r, p.cols || ['#5e86ba', '#dce8f4', '#ffffff']); addLight(L, p.x, p.y, 34, 1); }
    else if (p.kind === 'shot') { drawOrb(p.x, p.y, 4, p.cols); addLight(L, p.x, p.y, 24, 2); }
    else if (p.kind === 'glob') { drawOrb(p.x, p.y, 4.5, p.cols || ['#1d5a32', '#4fbf5a', '#c8ffc0']); addLight(L, p.x, p.y, 22, 2); }
    else { ctx.fillStyle = '#e8743b'; ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 3), 6, 6); ctx.fillStyle = '#ffe38a'; ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 3, 3); addLight(L, p.x, p.y, 44, 1); }
  }
  if (iso.on) flat();
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
    else if (f.k === 'rghost') { const rg = rigOf(f.kind), sp = rg ? rg.body : SPR[f.kind], w = sp.w, h = sp.h, fl = rg?.spec.mirror ? !f.flip : f.flip; /* 有骨架的 Boss：殘影只畫身體 */ ctx.globalAlpha = .45 * (1 - k); ctx.drawImage(fl ? sp.rf : sp.rn, snapF(f.x - w / 2), snapF(f.y + 2 - h), w, h); }
    else if (f.k === 'bghost') { const sp = SPR.boss, w = sp.w, h = sp.h; ctx.globalAlpha = .5 * (1 - k); ctx.drawImage(f.flip ? sp.rf : sp.rn, snapF(f.x - w / 2), snapF(f.y + 2 - h), w, h); }
    else if (f.k === 'flash') { ctx.globalAlpha = f.a * (1 - k); ctx.fillStyle = f.col; if (iso.on) { ctx.setTransform(F, 0, 0, F, 0, 0); ctx.fillRect(0, 0, LW, LH); flat(); } else ctx.fillRect(cx, cy, LW, LH); }
    else if (f.k === 'arc') drawSmear({ x:f.x, y:f.y, a0:f.a - f.arc / 2, a1:f.a + f.arc / 2, r:f.r, w:Math.min(12, f.r * .3), sw:f.d * .35, hold:f.d * .65, t:f.t, cols:fxCols(f.col), sy:.8 });
    else if (f.k === 'ring') { if (f.delay) ctx.globalAlpha = 1; drawWarp({ x:f.x, y:f.y, r0:f.r0, r1:f.r1, th:3, sy:.6, col:f.col, t:f.t, d:f.d, delay:f.delay }, k);
      if (f.col === '#f2c14e') addLight(L, f.x, f.y, 60 * (1 - k), 1); else if (f.col === '#7dff8a') addLight(L, f.x, f.y - 6, 64 * (1 - k), 6); }   // 金 = 升級，綠 = 喝藥水
    else if (f.k === 'line') drawLance({ x:f.x, y:f.y, a:f.a, len:f.len, w:5, t:f.t, d:f.d, cols:fxCols(f.col) });
    else if (f.k === 'streak') drawRibbon(f, k, L);
    else if (f.k === 'rune') drawRune(f, k, L);
    else if (f.k === 'cres') drawCrescent(f, k);
    else if (f.k === 'sorb') { if (f.o.done) { f.t = f.d; continue; } const o = f.o, p = 1 + .15 * Math.sin(G.time * 20);   // 噬魂的魂（game/weaponFx.ts）：紅色光球（紫色會跟魂晶搞混）
      ctx.globalAlpha = 1; drawOrb(o.x, o.y, (f.r || 4) * p, f.cols || ['#4a0a14', '#e0283a', '#ff9aa4', '#ffffff']); addLight(L, o.x, o.y, f.lr || 40, f.lw || 1); }   // 也用來畫燈魂、螢火蟲（game/signatures.ts：cols / r / 光的顏色）
    else if (f.k === 'sstorm') { if (f.o.done) { f.t = f.d; continue; } drawSandstorm(f.o); }   // 沙王的月牙刀的沙暴（game/signatures.ts）：一粒粒沙子捲成的漏斗（render/sand.ts）
    else if (f.k === 'wghost') { const sp = SPR[f.kind]; if (sp && sp.wn) { const w = sp.w, h = sp.h; ctx.globalAlpha = .5 * (1 - k); ctx.drawImage(f.flip ? sp.wf : sp.wn, snapF(f.x - w / 2), snapF(f.y + 2 - h), w, h); } }   // 白色半透明的殘影（狼牙雙刃的狼影）
    else if (f.k === 'zap') { const fl = Math.floor(G.time * 30) % 2 ? 1 : .8, th = f.thin ? .55 : 1;   // 閃電（game/weaponFx.ts 的雷鳴）：淡黃光暈 + 黃 + 白芯，一閃一閃；f.br = 分岔
      const line = (P, s) => { artPath(); for (let i = 1; i < P.length; i++) artLine(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], Math.max(1, Math.round(s))); ctx.fill(); };
      for (const [P, w] of [[f.pts, 1], ...(f.br || []).map(b => [b, .5])]) {
        ctx.globalAlpha = (1 - k) * .3 * fl; ctx.fillStyle = f.col; line(P, 11 * th * w);
        ctx.globalAlpha = (1 - k * .8) * .95 * fl; line(P, 5 * th * w);
        ctx.globalAlpha = (1 - k * .5) * fl; ctx.fillStyle = '#ffffff'; line(P, 2 * th * w); }
      if (!f.thin) addLight(L, f.pts[f.pts.length - 1][0], f.pts[f.pts.length - 1][1], 80 * (1 - k), 4); }
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
  // 斜視角：光源換成畫面座標；跟著玩家的效果（目盲、黑暗迷宮、倒下碎光）用「玩家在畫面上的位置」反推 cx / cy
  const lcx = iso.on ? 0 : cx, lcy = iso.on ? 0 : cy, mcx = iso.on ? G.me.x - sX(G.me.x, G.me.y) : cx, mcy = iso.on ? G.me.y - sY(G.me.x, G.me.y) : cy;
  if (iso.on) for (const l of L) { const x = sX(l.x, l.y); l.y = sY(l.x, l.y) - gZ(l.x, l.y + 8); l.x = x; }   // 高台上的光跟著抬高

  const RG = regionLook(regAt(G.me.x, G.me.y));                       // 主線 Boss 倒下的地區，天色亮一點（game/quest.ts）
  light.amb += (RG.amb - light.amb) * .03; for (let k = 0; k < 3; k++) light.t[k] += (RG.tint[k] - light.t[k]) * .03;
  if (G.region === 'forest' || light.amb > .25) {
    for (let i = 0; i < 5 && G.region === 'forest'; i++) { const span = LW + 160; const mx = ((i * 137 + G.time * (6 + i * 2) * (i % 2 ? 1 : -1) - cx * .3) % span + span) % span - 80, my = ((i * 61 - cy * .3) % LH + LH) % LH;
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 80); g.addColorStop(0, 'rgba(205,220,225,.1)'); g.addColorStop(1, 'rgba(205,220,225,0)'); ctx.fillStyle = g; ctx.fillRect(mx - 80, my - 80, 160, 160); }
  }
  if (light.amb > .02) {
    lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, LW, LH);
    lctx.fillStyle = 'rgba(' + (light.t[0] | 0) + ',' + (light.t[1] | 0) + ',' + (light.t[2] | 0) + ',' + light.amb + ')'; lctx.fillRect(0, 0, LW, LH);
    lctx.globalCompositeOperation = 'destination-out';
    for (const l of L) { const x = l.x - lcx, y = l.y - lcy; if (x < -l.r || y < -l.r || x > LW + l.r || y > LH + l.r) continue;
      const g = lctx.createRadialGradient(x, y, 0, x, y, l.r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.45, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2); }
    ctx.drawImage(lightC, 0, 0);
  }
  ctx.globalCompositeOperation = 'lighter';
  if (lavaT.length && !iso.on) { ctx.fillStyle = 'rgba(255,110,40,' + (.16 + .05 * Math.sin(G.time * 3)) + ')'; for (let k = 0; k < lavaT.length; k += 2) ctx.fillRect(lavaT[k] * TS - cx, lavaT[k + 1] * TS - cy, TS, TS); }
  const tint = ['', 'rgba(255,140,50,', 'rgba(90,240,220,', 'rgba(170,150,255,', 'rgba(255,215,90,', 'rgba(235,240,255,', 'rgba(110,255,140,'];   // 4 = 金色（金箱）、5 = 白色（霧門）、6 = 綠色（喝藥水）
  for (const l of L) { if (!l.warm) continue; const x = l.x - lcx, y = l.y - lcy, r = l.r * .7; if (x < -r || y < -r || x > LW + r || y > LH + r) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, tint[l.warm] + '.16)'); g.addColorStop(1, tint[l.warm] + '0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.globalCompositeOperation = 'source-over';
  if (G.region === 'wastes') { ctx.fillStyle = 'rgba(255,190,110,.06)'; ctx.fillRect(0, 0, LW, LH); }
  drawBlind(mcx, mcy, LW, LH);                                              // 目盲：周圍變暗
  { const dr = G.started && !G.me.dead ? puzzleDark(G.me) : 0; if (dr) { const x = G.me.x - mcx, y = G.me.y - 10 - mcy, g = ctx.createRadialGradient(x, y, dr * .5, x, y, dr * 2.2);   // 黑暗迷宮：只看得到身邊
    g.addColorStop(0, 'rgba(4,4,10,0)'); g.addColorStop(1, 'rgba(4,4,10,.97)'); ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH); } }
  if (!iso.on) drawLostBeam(cx, cy); else if (G.lost) drawLostBeam(G.lost.x - sX(G.lost.x, G.lost.y), G.lost.y - sY(G.lost.x, G.lost.y));                                                 // 掉落魂晶的光柱：畫在光影上面，暗處、遠處都看得到
  if (SET.nums) for (const n of G.nums) {                                 // 傷害數字（設定可以關掉）：彈出來 → 往上飄 → 淡掉（畫在光影上面，暗處也看得到）
    const k = n.t / n.d, rise = 1 - (1 - Math.min(1, k * 2.2)) ** 2, pop = k < .12 ? 1 + (1 - k / .12) * .6 : 1;
    const sc = (n.big ? 4 / 3 : 1) * (pop > 1.3 ? 4 / 3 : 1);           // 剛出來時大一號，再縮回來（只用 1/3 的倍數，像素才不會糊）
    ctx.globalAlpha = k > .7 ? Math.max(0, 1 - (k - .7) / .3) : 1;
    drawNum(n.txt, iso.on ? sX(n.x, n.y) : n.x - cx, (iso.on ? sY(n.x, n.y) - gZ(n.x, n.y + 8) : n.y - cy) - rise * 10, n.col, sc);
  }
  ctx.globalAlpha = 1;
  if (G.me.healGlow > 0) { const a = Math.min(1, G.me.healGlow / .7) * .32, g = ctx.createRadialGradient(LW / 2, LH / 2, Math.min(LW, LH) * .35, LW / 2, LH / 2, Math.max(LW, LH) * .7);   // 回血：畫面四周亮一圈綠
    g.addColorStop(0, 'rgba(90,255,130,0)'); g.addColorStop(1, 'rgba(90,255,130,' + a + ')'); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH); ctx.globalCompositeOperation = 'source-over'; }
  if (G.me.hurt > 0) { ctx.fillStyle = 'rgba(200,30,40,' + (G.me.hurt * .5) + ')'; ctx.fillRect(0, 0, LW, LH); }
  if (G.me.dead) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(.75, G.me.deathT * .4) + ')'; ctx.fillRect(0, 0, LW, LH); }
  drawPfx(mcx, mcy, G.paused ? 0 : camDt);                                // pixelfx 特效（倒下時碎成光點）畫在黑幕上面
}

/* 斜視角：角色站著畫。面向角度 / 左右翻面先換成「畫面上的方向」，畫完換回來（遊戲邏輯還是用世界方向） */
function isoUp(it) {
  const o = it.o, g = gZ(it.x, it.y);
  if (o && (o.z ?? g) > g + 1) { upright(it.x, it.y, g); ctx.globalAlpha = .35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(it.x, it.y, 7, 3, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }   // 在空中：地上留一個影子
  upright(it.x, it.y, o?.z ?? g); if (!o) { it.f(); return; }
  const f0 = o.face, fl0 = o.flip;
  if (typeof f0 === 'number') o.face = scrAng(f0);
  if (G.players.includes(o)) { const c = Math.cos(o.face); if (c < -.1) o.flip = true; else if (c > .1) o.flip = false; }
  else { const wd = G.me.x - o.x, sd = (G.me.x - G.me.y) - (o.x - o.y); if (wd * sd < 0) o.flip = !o.flip; }   // 怪：世界上面向玩家 → 畫面上也面向玩家
  it.f(); o.face = f0; o.flip = fl0;
}
