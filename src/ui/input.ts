import { G } from '../core/state';
import { $ } from '../core/util';
import { held, input, joy, keys, pressed } from '../game/player';
import { initAudio } from '../core/audio';
import { nearCamp } from '../game/playerUpdate';
import { openMenu, setMenu } from './hud';
import { nearMerchant, openShop } from './shop';
import { restAt, toggleInv, toggleMap } from './menus';
import { startGame } from '../main';
import { pickUp } from '../game/worldUpdate';
import { nearChest, openChest } from '../world/chests';
import { nearSmith } from '../world/towns';
import { nearTablet, readTablet } from '../game/quest';
import { nearDoor, useDoor } from '../world/dungeons';
import { cam } from '../game/player';
import { LH, LW } from '../core/canvas';
export function enterDoor() { const d = nearDoor(G.me); if (!d) return; useDoor(G.me, d, pl => { cam.x = pl.x - LW / 2; cam.y = pl.y - LH / 2; }); G.region = ''; }
$('doorBtn').addEventListener('click', enterDoor);

/* ================= INPUT ================= */
const KEYMAP = { KeyW:'up', ArrowUp:'up', KeyS:'down', ArrowDown:'down', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right',
  KeyJ:'atk', Space:'atk', KeyK:'dodge', ShiftLeft:'dodge', ShiftRight:'dodge', KeyL:'skill', KeyH:'pot', KeyE:'rest', KeyI:'inv', KeyC:'inv', Tab:'inv', KeyM:'map', Escape:'esc', Enter:'enter' };
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.code]; if (!k) return;
  if (e.target instanceof HTMLElement && e.target.tagName === 'BUTTON' && (k === 'atk' || k === 'enter')) return;
  e.preventDefault(); if (!keys[k]) pressed[k] = true; keys[k] = true;
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in held) held[k] = false; });
const joyZone = $('joyZone'), joyBase = $('joyBase'), joyKnob = $('joyKnob');
// 固定搖桿：底座永遠在左下角（位置寫在 CSS），手指按在左下區域任何地方，方向都從底座中心算
export function placeJoyIdle() { if (joy.active) return; joyBase.classList.remove('on'); joyKnob.style.transform = ''; }
function joyMove(e: PointerEvent) {
  let dx = e.clientX - joy.bx, dy = e.clientY - joy.by; const d = Math.hypot(dx, dy), R = 46;
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joy.dx = dx / R; joy.dy = dy / R; joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
}
joyZone.addEventListener('pointerdown', e => {
  if (joy.active) return; e.preventDefault(); initAudio();
  const r = joyBase.getBoundingClientRect();
  joy.active = true; joy.id = e.pointerId; joy.bx = r.left + r.width / 2; joy.by = r.top + r.height / 2; joyBase.classList.add('on'); joyMove(e);
  try { joyZone.setPointerCapture(e.pointerId); } catch (err) {}
});
joyZone.addEventListener('pointermove', e => { if (!joy.active || e.pointerId !== joy.id) return; e.preventDefault(); joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.active = false; joy.id = null; joy.dx = joy.dy = 0; placeJoyIdle(); };
joyZone.addEventListener('pointerup', joyEnd); joyZone.addEventListener('pointercancel', joyEnd);
function bindBtn(id, key) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); held[key] = true; pressed[key] = true; el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (err) {} });
  const up = () => { held[key] = false; el.classList.remove('down'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindBtn('bAtk', 'atk'); bindBtn('bSkill', 'skill'); bindBtn('bDodge', 'dodge'); bindBtn('bPot', 'pot');
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => { const t = e.target as HTMLElement; if (!t.closest || !t.closest('.panel')) e.preventDefault(); }, { passive:false });
export function readInput() {
  let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const jm = Math.hypot(joy.dx, joy.dy); if (jm > .18) { mx += joy.dx; my += joy.dy; }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  input.mx = mx; input.my = my;
  if (pressed.inv) toggleInv();
  if (pressed.map) toggleMap();
  if (pressed.esc && openMenu) setMenu(null);
  if (pressed.rest && !openMenu) { if (G.pick) pickUp(G.me, G.pick); else if (nearChest(G.me)) openChest(G.me, nearChest(G.me)); else if (nearTablet()) readTablet(nearTablet()); else if (nearDoor(G.me)) enterDoor(); else if (nearSmith()) openShop(nearSmith()); else if (nearMerchant()) openShop(); else { const c = nearCamp(G.me); if (c) restAt(c); } }
  if (pressed.enter && !G.started) startGame(!$('btnContinue').hidden);
}

