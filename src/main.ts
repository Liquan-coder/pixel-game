import './style.css';
import { G } from './core/state';
import { $ } from './core/util';
import { isTouch, resize } from './core/canvas';
import './art/sprite';
import './art/hero';
import { SPR } from './art/monsters';
import './art/weapon';
import { makeGear, makeItem } from './data/items';
import { ARENA, CAMPS, DOOR, SUBS, discovered, explored, map, reg, spawns } from './world/map';
import { RBDEF, rbDead, rbs } from './world/regionBoss';
import './world/bossAI';
import { genWorld, reachable } from './world/gen';
import './world/tileArt';
import { bakeChunk, bakeCount, chunks } from './world/chunks';
import { bakeFullMap, redrawMini, reveal } from './world/minimap';
import { calcStats, cam, curEq, held, input, keys, resetPlayers, pressed, recalc } from './game/player';
import './game/collision';
import { initAudio } from './core/audio';
import { respawnAll } from './game/enemies';
import { resetBoss } from './game/boss';
import { hurtPlayer } from './game/combat';
import { placeAtCamp, restoreWorld } from './game/playerUpdate';
import { update, updateMotes } from './game/worldUpdate';
import './render/player';
import { drawSmear, drawWarp } from './render/fx';
import { teleCircle, teleLane, teleSector } from './render/enemy';
import { render } from './render/render';
import { renderMini } from './render/map';
import { setMenu, toast, updateHUD } from './ui/hud';
import { merchant, openShop, placeMerchant } from './ui/shop';
import { renderInv, restAt, toggleMap } from './ui/menus';
import { readInput } from './ui/input';
import { CHESTS, genChests } from './world/chests';
import { placeTablets, resetQuest } from './game/quest';
import { applySave, clearSave, loadSave, save, serialize } from './game/save';

/* ================= FLOW ================= */
export function startGame(cont) {
  initAudio();
  const d = cont ? loadSave() : null;
  if (d) applySave(d); else { clearSave(); resetPlayers(); G.coins = []; rbDead.clear(); placeMerchant('start'); G.bossDead = false; G.lost = null; G.lastCamp = 'start'; explored.fill(0); discovered.clear(); redrawMini(); for (const c of CAMPS) c.lit = c.id === 'start'; for (const c of CHESTS) { c.opened = false; c.foe = null; } resetQuest(); }
  placeAtCamp(G.me, G.lastCamp); restoreWorld();
  G.started = true; $('title').hidden = true; setMenu(null); G.region = ''; save();
  $('keyHint').hidden = false; setTimeout(() => { $('keyHint').hidden = true; }, 15000);
  if (!cont) setTimeout(() => toast(isTouch ? '左手拖曳移動，右手按攻擊。點小地圖看世界地圖' : 'WASD 移動，J 攻擊，K 翻滾，M 看地圖', '#f1e7d0'), 2800);
}
$('btnContinue').addEventListener('click', () => startGame(true));
$('btnNew').addEventListener('click', () => { if (!$('btnContinue').hidden) { $('confirmNew').hidden = false; return; } startGame(false); });
$('btnNewYes').addEventListener('click', () => { $('confirmNew').hidden = true; startGame(false); });
$('btnNewNo').addEventListener('click', () => { $('confirmNew').hidden = true; });
if (isTouch) $('tkeys').hidden = true;

export let lastT = 0, camDt = 1 / 60;
function frame(ts) {
  requestAnimationFrame(frame);
  const t = ts / 1000; const dt = Math.min(.05, Math.max(0, t - lastT)); lastT = t; camDt = dt;
  readInput();
  if (!G.paused) { if (G.hitStop > 0) { G.hitStop -= dt; G.time += dt * .2; } else update(dt); } else G.time += dt;   // 重擊時停頓一下（hit-stop）
  updateMotes(dt);
  render(); updateHUD();
  G.miniT -= dt; if (G.miniT <= 0) { if (G.started) reveal(); renderMini(); G.miniT = .2; }
  for (const k in pressed) pressed[k] = false;
}

function boot(data) {
  genWorld(); genChests(reachable); placeTablets(); bakeFullMap();
  resetPlayers(); placeAtCamp(G.me, 'start'); respawnAll(); resetBoss();
  resize(); window.addEventListener('resize', resize);
  const s = loadSave(); $('btnContinue').hidden = !s; if (s) $('btnNew').textContent = '重新開始';
  if (data && data.save && data.started) { applySave(data.save); placeAtCamp(G.me, G.lastCamp); restoreWorld(); G.started = true; $('title').hidden = true; setMenu(null); }
  requestAnimationFrame(frame);
}
try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ save: G.started ? serialize() : null, started: G.started })); } catch (e) {}
const H = window.claude && window.claude.hot;
if (H && H.ready) H.ready(boot); else boot((H && H.data) || {});
window.__pw = { get P() { return G.me; }, get players() { return G.players; }, get enemies() { return G.enemies; }, get B() { return G.B; }, get drops() { return G.drops; }, input, keys, held, pressed, update, startGame, setMenu, CAMPS, spawns, makeItem, recalc, hurtPlayer, get bossDead() { return G.bossDead; }, get lost() { return G.lost; }, map, reg, ARENA, DOOR, cam, SUBS, toggleMap, bakeChunk, get merchant() { return merchant; }, get coins() { return G.coins; }, makeGear, serialize, applySave, restAt, calcStats, curEq, openShop, renderInv, get rbs() { return rbs; }, RBDEF, SPR, render, get fx() { return G.fx; }, get parts() { return G.parts; }, get bakeCount() { return bakeCount; }, get chunkN() { return chunks.size; }, drawSmear, drawWarp, teleCircle, teleSector, teleLane };
