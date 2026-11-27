import { G } from '../core/state';
import { iso } from '../render/isoState';
import { $ } from '../core/util';
import { held, input, joy, keys, pressed } from '../game/player';
import { initAudio } from '../core/audio';
import { openMenu, setMenu } from './hud';
import { toggleInv, toggleMap } from './menus';
import { moveSlot, pickSlot } from './title';
import { interactTarget } from './interact';
import { openPause } from './pause';

/* ================= INPUT ================= */
const KEYMAP = { KeyW:'up', ArrowUp:'up', KeyS:'down', ArrowDown:'down', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right',
  KeyJ:'atk', Space:'atk', KeyK:'dodge', ShiftLeft:'dodge', ShiftRight:'dodge', KeyL:'skill', KeyH:'pot', KeyI:'inv', KeyC:'inv', Tab:'inv', KeyM:'map', KeyR:'mount', KeyP:'pause', Escape:'esc', Enter:'enter' };
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) return;                                    // ⌘ / Ctrl 快捷鍵不算按鍵（Mac 按著 ⌘ 時放開別的鍵不會有 keyup → 會卡住）
  const k = KEYMAP[e.code]; if (!k) return;
  if (e.target instanceof HTMLElement && e.target.tagName === 'BUTTON' && (k === 'atk' || k === 'enter')) return;
  e.preventDefault(); if (!keys[k]) pressed[k] = true; keys[k] = true;
});
window.addEventListener('keyup', e => { if (e.key === 'Meta' || e.key === 'Control') releaseAll(); const k = KEYMAP[e.code]; if (k) keys[k] = false; });
/* 「放開」的事件沒收到就會一直按著（方向卡住、搖桿點不動）：切到別的 App、拉下通知、來電、⌘ 組合鍵… → 全部放開 */
export function releaseAll() { for (const k in keys) keys[k] = false; for (const k in held) held[k] = false; resetJoy(); for (const b of BTNS) $(b).classList.remove('down'); }
window.addEventListener('blur', releaseAll); window.addEventListener('pagehide', releaseAll);
window.addEventListener('contextmenu', releaseAll);                       // 右鍵 / 觸控板雙指點：跳出選單時放開的鍵收不到
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
/* 手機：用「螢幕上現在真的有哪些手指」對帳。每根手指的 target 是它一開始按下去的元素，
   所以搖桿還以為有人按著、可是沒有任何一根手指是從搖桿區按下去的 → 那根手指早就離開了（放開的事件被吃掉）→ 放開 */
const BTNS = ['bAtk', 'bSkill', 'bDodge', 'bPot'], BTN_KEY = { bAtk: 'atk', bSkill: 'skill', bDodge: 'dodge', bPot: 'pot' };
function syncTouches(e: TouchEvent) {
  const on = (el: HTMLElement) => { for (let i = 0; i < e.touches.length; i++) { const t = e.touches[i].target; if (t instanceof Node && el.contains(t)) return true; } return false; };
  if (joy.active && !on(joyZone)) resetJoy();
  for (const id of BTNS) { const k = BTN_KEY[id]; if (held[k] && !on($(id))) { held[k] = false; $(id).classList.remove('down'); } }
}
for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) document.addEventListener(t, syncTouches as EventListener, { capture: true, passive: true });
const joyZone = $('joyZone'), joyBase = $('joyBase'), joyKnob = $('joyKnob');
function resetJoy() { joy.active = false; joy.id = null; joy.dx = joy.dy = 0; placeJoyIdle(); }
// 固定搖桿：底座永遠在左下角（位置寫在 CSS），手指按在左下區域任何地方，方向都從底座中心算
export function placeJoyIdle() { if (joy.active) return; joyBase.classList.remove('on'); joyKnob.style.transform = ''; }
function joyMove(e: PointerEvent) {
  let dx = e.clientX - joy.bx, dy = e.clientY - joy.by; const d = Math.hypot(dx, dy), R = 46;
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joy.dx = dx / R; joy.dy = dy / R; joyKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
}
joyZone.addEventListener('pointerdown', e => {
  e.preventDefault(); initAudio();                                       // 搖桿還以為有手指按著（放開沒收到）→ 直接換成這隻手指，不會卡死（手機可能重複用同一個編號，所以編號一樣也要重新接手）
  const r = joyBase.getBoundingClientRect();
  joy.active = true; joy.id = e.pointerId; joy.bx = r.left + r.width / 2; joy.by = r.top + r.height / 2; joyBase.classList.add('on'); joyMove(e);
  try { joyZone.setPointerCapture(e.pointerId); } catch (err) {}
});
joyZone.addEventListener('pointermove', e => { if (!joy.active || e.pointerId !== joy.id) return; e.preventDefault(); joyMove(e); });
const joyEnd = e => { if (e.pointerId === joy.id) resetJoy(); };
joyZone.addEventListener('pointerup', joyEnd); joyZone.addEventListener('pointercancel', joyEnd); joyZone.addEventListener('lostpointercapture', joyEnd);
function bindBtn(id, key) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); held[key] = true; pressed[key] = true; el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (err) {} });
  const up = () => { held[key] = false; el.classList.remove('down'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindBtn('bAtk', 'atk'); bindBtn('bSkill', 'skill'); bindBtn('bDodge', 'dodge'); bindBtn('bPot', 'pot');
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => { const t = e.target as HTMLElement; if (!t.closest || !t.closest('.panel, #endScreen')) e.preventDefault(); }, { passive:false });   // 選單和結局畫面可以用手指捲
let lastMenu = null;
export function readInput() {
  if (openMenu !== lastMenu) { lastMenu = openMenu; releaseAll(); }    // 開 / 關選單：全部放開（選單開著的時候放開的鍵、手指，有時候收不到）。還按著的鍵會自動連發，馬上又會算按著
  let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const jm = Math.hypot(joy.dx, joy.dy); if (jm > .18) { mx += joy.dx; my += joy.dy; }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  if (iso.on && iso.mode === 'dia') { const r = Math.SQRT1_2, wx = (mx + my) * r, wy = (my - mx) * r; mx = wx; my = wy; }   // 斜視角 demo：推「上」= 往畫面上方走（世界的左上）
  input.mx = mx; input.my = my;
  if (pressed.inv) toggleInv();
  if (pressed.map) toggleMap();
  if (pressed.esc && openMenu) setMenu(null);
  else if ((pressed.esc || pressed.pause) && G.started) openPause();   // 沒開選單時 Esc / P = 暫停
  else if (pressed.pause && openMenu === 'pause') setMenu(null);
  if (pressed.atk && !openMenu) { const it = interactTarget(); if (it) { it.run(); pressed.atk = false; } }   // 靠近東西：攻擊鍵 = 互動，這一下不揮刀（也不會開始蓄力）
  if (!G.started) { if (pressed.up) moveSlot(-1); if (pressed.down) moveSlot(1); if (pressed.enter) pickSlot(); if (pressed.esc) $('btnNewNo').click(); }
}

