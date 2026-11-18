import './style.css';
import { G } from './core/state.js';
import { $ } from './core/util.js';
import { isTouch, resize } from './core/canvas.js';
import './art/sprite.js';
import './art/hero.js';
import { SPR } from './art/monsters.js';
import './art/weapon.js';
import { makeGear, makeItem } from './data/items.js';
import { ARENA, CAMPS, DOOR, SUBS, discovered, explored, map, reg, spawns } from './world/map.js';
import { RBDEF, rbDead, rbs } from './world/regionBoss.js';
import './world/bossAI.js';
import { genWorld } from './world/gen.js';
import './world/tileArt.js';
import { bakeChunk, bakeCount, chunks } from './world/chunks.js';
import { bakeFullMap, redrawMini, reveal } from './world/minimap.js';
import { calcStats, cam, curEq, held, input, keys, newPlayer, pressed, recalc } from './game/player.js';
import './game/collision.js';
import { initAudio } from './core/audio.js';
import { respawnAll } from './game/enemies.js';
import { resetBoss } from './game/boss.js';
import { hurtPlayer } from './game/combat.js';
import { placeAtCamp, restoreWorld } from './game/playerUpdate.js';
import { update, updateMotes } from './game/worldUpdate.js';
import './render/player.js';
import { drawSmear, drawWarp } from './render/fx.js';
import { teleCircle, teleLane, teleSector } from './render/enemy.js';
import { render } from './render/render.js';
import { renderMini } from './render/map.js';
import { setMenu, toast, updateHUD } from './ui/hud.js';
import { merchant, openShop, placeMerchant } from './ui/shop.js';
import { renderInv, restAt, toggleMap } from './ui/menus.js';
import { readInput } from './ui/input.js';
import { applySave, clearSave, loadSave, save, serialize } from './game/save.js';

/* ================= FLOW ================= */
export function startGame(cont) {
  initAudio();
  const d = cont ? loadSave() : null;
  if (d) applySave(d); else { clearSave(); newPlayer(); G.coins = []; rbDead.clear(); placeMerchant('start'); G.bossDead = false; G.lost = null; G.lastCamp = 'start'; explored.fill(0); discovered.clear(); redrawMini(); for (const c of CAMPS) c.lit = c.id === 'start'; }
  placeAtCamp(G.lastCamp); restoreWorld();
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
  genWorld(); bakeFullMap();
  newPlayer(); placeAtCamp('start'); respawnAll(); resetBoss();
  resize(); window.addEventListener('resize', resize);
  const s = loadSave(); $('btnContinue').hidden = !s; if (s) $('btnNew').textContent = '重新開始';
  if (data && data.save && data.started) { applySave(data.save); placeAtCamp(G.lastCamp); restoreWorld(); G.started = true; $('title').hidden = true; setMenu(null); }
  requestAnimationFrame(frame);
}
try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ save: G.started ? serialize() : null, started: G.started })); } catch (e) {}
const H = window.claude && window.claude.hot;
if (H && H.ready) H.ready(boot); else boot((H && H.data) || {});
window.__pw = { get P() { return G.P; }, get enemies() { return G.enemies; }, get B() { return G.B; }, get drops() { return G.drops; }, input, keys, held, pressed, update, startGame, setMenu, CAMPS, spawns, makeItem, recalc, hurtPlayer, get bossDead() { return G.bossDead; }, get lost() { return G.lost; }, map, reg, ARENA, DOOR, cam, SUBS, toggleMap, bakeChunk, get merchant() { return merchant; }, get coins() { return G.coins; }, makeGear, serialize, applySave, restAt, calcStats, curEq, openShop, setMenu, renderInv, get rbs() { return rbs; }, RBDEF, SPR, render, get fx() { return G.fx; }, get parts() { return G.parts; }, get bakeCount() { return bakeCount; }, get chunkN() { return chunks.size; }, drawSmear, drawWarp, teleCircle, teleSector, teleLane };
