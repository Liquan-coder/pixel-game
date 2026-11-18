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
export function placeJoyIdle() { if (joy.active) return; joyBase.style.left = '90px'; joyBase.style.top = (window.innerHeight * .7 - 90) + 'px'; joyBase.classList.remove('on'); joyKnob.style.transform = ''; }
joyZone.addEventListener('pointerdown', e => {
  if (joy.active) return; e.preventDefault(); initAudio();
  joy.active = true; joy.id = e.pointerId; const r = joyZone.getBoundingClientRect();
  joy.bx = e.clientX; joy.by = e.clientY; joyBase.style.left = (e.clientX - r.left) + 'px'; joyBase.style.top = (e.clientY - r.top) + 'px'; joyBase.classList.add('on');
  try { joyZone.setPointerCapture(e.pointerId); } catch (err) {}
});
joyZone.addEventListener('pointermove', e => {
  if (!joy.active || e.pointerId !== joy.id) return; e.preventDefault();
  let dx = e.clientX - joy.bx, dy = e.clientY - joy.by; const d = Math.hypot(dx, dy), R = 44;
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joy.dx = dx / R; joy.dy = dy / R; joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
});
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
  if (pressed.rest && !openMenu) { if (G.pick) pickUp(G.me, G.pick); else if (nearMerchant()) openShop(); else { const c = nearCamp(G.me); if (c) restAt(c); } }
  if (pressed.enter && !G.started) startGame(!$('btnContinue').hidden);
}

