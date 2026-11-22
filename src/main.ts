import './style.css';
import { G } from './core/state';
import { $ } from './core/util';
import { isTouch, resize, ECO } from './core/canvas';
import './art/sprite';
import './art/hero';
import { SPR } from './art/monsters';
import './art/weapon';
import { makeGear, makeItem } from './data/items';
import { ARENA, CAMPS, DOOR, SUBS, discovered, explored, map, reg, spawns } from './world/map';
import { RBDEF, rbDead, rbs } from './world/regionBoss';
import './world/bossAI';
import './world/bossAI3';
import './art/dungeonMonsters';
import './art/elfMonsters';
import './art/dungeonBosses';
import { genWorld, reachable } from './world/gen';
import './world/tileArt';
import { bakeChunk, bakeCount, chunks } from './world/chunks';
import { bakeFullMap, redrawMini, reveal } from './world/minimap';
import { sightReveal } from './world/sight';
import { calcStats, cam, curEq, held, input, keys, resetPlayers, pressed, recalc } from './game/player';
import './game/collision';
import { initAudio } from './core/audio';
import { respawnAll } from './game/enemies';
import { resetBoss } from './game/boss';
import { dressEntrances } from './world/dungeons';
import { setupPuzzles } from './world/puzzles';
import './world/puz2'; import './world/puz3'; import './world/puz4'; import './world/puz5';                        // 各地城的招牌機關（要在 setupPuzzles 之前登記好）
import { placeStatues } from './world/statues';
import { placeRunestones } from './world/runestones';
import { hurtPlayer } from './game/combat';
import { placeAtCamp, restoreWorld } from './game/playerUpdate';
import { update, updateMotes } from './game/worldUpdate';
import './render/player';
import { drawSmear, drawWarp } from './render/fx';
import { teleCircle, teleLane, teleSector } from './render/enemy';
import { render } from './render/render';
import { renderBigMap, renderMini } from './render/map';
import { openMenu, setMenu, toast, updateHUD } from './ui/hud';
import { merchant, openShop, placeMerchant } from './ui/shop';
import { mapTab, renderInv, restAt, toggleMap } from './ui/menus';
import { readInput } from './ui/input';
import './ui/pause';
import { CHESTS, genChests } from './world/chests';
import { placeTablets, resetQuest } from './game/quest';
import { applySave, clearSave, loadSave, placeFromSave, save, serialize, setSlot, slot } from './game/save';
import { initTitle } from './ui/title';

/* ================= FLOW ================= */
export function startGame(cont) {
  initAudio();
  const d = cont ? loadSave() : null;
  if (d) applySave(d); else { clearSave(); resetPlayers(); G.coins = []; rbDead.clear(); placeMerchant('start'); G.bossDead = false; G.lost = null; G.lastCamp = 'start'; explored.fill(0); discovered.clear(); redrawMini(); for (const c of CAMPS) c.lit = c.id === 'start'; for (const c of CHESTS) { c.opened = false; c.foe = null; } resetQuest(); }
  if (d) placeFromSave(d); else placeAtCamp(G.me, G.lastCamp); restoreWorld();   // 繼續 → 回到上次站的地方
  G.started = true; $('title').hidden = true; setMenu(null); G.region = ''; save();
  $('keyHint').hidden = false; setTimeout(() => { $('keyHint').hidden = true; }, 15000);
  if (!cont) setTimeout(() => toast(isTouch ? '左下角搖桿移動，右手按攻擊。點小地圖看世界地圖' : 'WASD 移動，J 攻擊，K 翻滾，M 看地圖', '#f1e7d0'), 2800);
}
if (isTouch) $('tkeys').hidden = true;

export let lastT = 0, camDt = 1 / 60;
let lastTs = 0, ecoAcc = 0, menuDrawT = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  // 省電：120Hz / 90Hz 的手機也只畫每秒 60 格（多畫的那些格眼睛幾乎看不出來，但會讓手機發燙）
  if (ECO) { ecoAcc += ts - lastTs; lastTs = ts; if (ecoAcc < 1000 / 60 - 4) return; ecoAcc = Math.min(1000 / 60, Math.max(0, ecoAcc - 1000 / 60)); }
  const t = ts / 1000; const dt = Math.min(.05, Math.max(0, t - lastT)); lastT = t; camDt = dt;
  readInput();
  if (!G.paused) { if (G.hitStop > 0) { G.hitStop -= dt; G.time += dt * .2; } else update(dt); } else G.time += dt;   // 重擊時停頓一下（hit-stop）
  updateMotes(dt);
  // 選單開著時（營火、背包、商店、地圖、暫停）遊戲停住，後面的畫面幾乎不會變 → 每秒只重畫 5 次（換裝備還是看得到），手機可以休息
  if (G.started && openMenu) { menuDrawT -= dt; if (menuDrawT <= 0) { render(); menuDrawT = .2; } } else { render(); menuDrawT = 0; }
  updateHUD();
  G.miniT -= dt; if (G.miniT <= 0) { if (G.started) { reveal(); sightReveal(); } renderMini(); if (openMenu === 'map' && mapTab === 'map') renderBigMap(); G.miniT = .2; }   // 地圖開著時也一直更新（主線菱形會閃）
  for (const k in pressed) pressed[k] = false;
}

function boot(data) {
  genWorld(); genChests(reachable); placeTablets(); dressEntrances(CHESTS); setupPuzzles(); placeStatues(); placeRunestones(); bakeFullMap();   // dressEntrances 要在寶箱之後：只清前院的樹，其他東西的位置不變
  resetPlayers(); placeAtCamp(G.me, 'start'); respawnAll(); resetBoss();
  resize(); window.addEventListener('resize', resize);
  initTitle();                                                          // 標題畫面：三格存檔（ui/title.ts）
  if (data && data.save && data.started) { if (data.slot >= 0) setSlot(data.slot); applySave(data.save); placeFromSave(data.save); restoreWorld(); G.started = true; $('title').hidden = true; setMenu(null); }
  requestAnimationFrame(frame);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('lab')) import('./dev/lab').then(m => m.startLab(startGame));   // 開發用：?lab = 刻印測試場（不存檔）
}
try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ save: G.started ? serialize() : null, started: G.started, slot })); } catch (e) {}
const H = window.claude && window.claude.hot;
if (H && H.ready) H.ready(boot); else boot((H && H.data) || {});
window.__pw = { get P() { return G.me; }, get players() { return G.players; }, get enemies() { return G.enemies; }, get B() { return G.B; }, get drops() { return G.drops; }, input, keys, held, pressed, update, startGame, setMenu, CAMPS, spawns, makeItem, recalc, hurtPlayer, get bossDead() { return G.bossDead; }, get lost() { return G.lost; }, map, reg, ARENA, DOOR, cam, SUBS, toggleMap, bakeChunk, get merchant() { return merchant; }, get coins() { return G.coins; }, makeGear, serialize, applySave, restAt, calcStats, curEq, openShop, renderInv, get rbs() { return rbs; }, RBDEF, SPR, render, get fx() { return G.fx; }, get parts() { return G.parts; }, get bakeCount() { return bakeCount; }, get chunkN() { return chunks.size; }, drawSmear, drawWarp, teleCircle, teleSector, teleLane };
