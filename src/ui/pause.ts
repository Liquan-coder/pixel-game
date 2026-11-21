/* ================= 暫停選單 =================
   右上角的「暫停」（或鍵盤 Esc / P）→ 遊戲停住，打開這個面板：
     選單：繼續遊戲 / 設定 / 操作說明 / 回到標題畫面（會先自動存檔）
     設定：音效開關、音量、畫面震動、傷害數字、按鈕大小（手機）。設定存在這台裝置上（localStorage），跟存檔無關 */
import { G } from '../core/state';
import { $ } from '../core/util';
import { initAudio, sfx } from '../core/audio';
import { isTouch } from '../core/canvas';
import { openMenu, setMenu } from './hud';
import { save } from '../game/save';
import { initTitle } from './title';

export const SET = { sound: true, vol: 70, shake: true, nums: true, btn: 1 };
const KEY = 'pw_settings';
try { Object.assign(SET, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
export function applySettings() {
  G.muted = !SET.sound; G.vol = SET.vol / 100;
  document.documentElement.style.setProperty('--bs', String(SET.btn));   // 手機按鈕大小（style.css 的 #btns）
  try { localStorage.setItem(KEY, JSON.stringify(SET)); } catch (e) {}
}
applySettings();

let tab = 'main';
const BTN_SIZES: [number, string][] = [[.85, '小'], [1, '中'], [1.18, '大']];
function render() {
  for (const b of document.querySelectorAll<HTMLElement>('#pauseMenu [data-ptab]')) b.classList.toggle('on', b.dataset.ptab === tab);
  const body = $('pauseBody');
  if (tab === 'main') body.innerHTML = '<div class="pmain">' +
    '<button type="button" class="pri" data-pa="resume">繼續遊戲</button>' +
    '<button type="button" data-pa="set">設定</button>' +
    '<button type="button" data-pa="help">操作說明</button>' +
    '<button type="button" class="warn" data-pa="title">回到標題畫面<small>進度會自動存檔</small></button></div>';
  else if (tab === 'set') {
    const tog = (k: string, label: string, on: boolean) => '<div class="prow"><span>' + label + '</span><button type="button" class="tog' + (on ? ' on' : '') + '" data-tog="' + k + '">' + (on ? '開' : '關') + '</button></div>';
    body.innerHTML = tog('sound', '音效', SET.sound) +
      '<div class="prow"><span>音量</span><input type="range" min="0" max="100" step="5" value="' + SET.vol + '" id="volIn"' + (SET.sound ? '' : ' disabled') + '><b id="volTxt">' + SET.vol + '</b></div>' +
      tog('shake', '畫面震動', SET.shake) + tog('nums', '傷害數字', SET.nums) +
      '<div class="prow"><span>按鈕大小<small>手機的攻擊、技能、瞬移按鈕</small></span><div class="seg">' +
      BTN_SIZES.map(([v, n]) => '<button type="button" data-bs="' + v + '"' + (SET.btn === v ? ' class="on"' : '') + '>' + n + '</button>').join('') + '</div></div>';
  } else body.innerHTML = '<div class="phelp">' + (isTouch
    ? '<p><b>移動</b>左下角搖桿</p><p><b>攻擊</b>右下最大的按鈕。按住 = 蓄力，放開放出蓄力攻擊</p><p><b>互動</b>靠近寶箱、營火、門、掉在地上的裝備時，攻擊鈕會變成「打開 / 休息 / 進入 / 撿起」</p><p><b>瞬移</b>瞬間閃開，閃的時候不會受傷；也能把身上的火滾掉</p><p><b>技能</b>每種武器不一樣，有冷卻時間</p><p><b>藥水</b>回血，回營火休息會補滿</p><p><b>被冰住 / 纏住</b>狂按攻擊或瞬移可以早一點掙脫</p><p><b>地圖 / 角色</b>右上角，點小地圖也能打開地圖</p>'
    : '<p><b>WASD / 方向鍵</b>移動</p><p><b>J / 空白鍵</b>攻擊（按住蓄力）；靠近東西時變成撿起 / 打開 / 休息 / 進入</p><p><b>K / Shift</b>瞬移（無敵、能滾掉身上的火）</p><p><b>L</b>技能</p><p><b>H</b>喝藥水</p><p><b>C / I / Tab</b>角色</p><p><b>M</b>地圖</p><p><b>Esc / P</b>暫停</p><p><b>被冰住 / 纏住</b>狂按攻擊或瞬移可以早一點掙脫</p>') + '</div>';
}
export function openPause() { if (openMenu || !G.started) return; tab = 'main'; render(); setMenu('pause'); }
export function togglePause() { if (openMenu === 'pause') setMenu(null); else openPause(); }
export function backToTitle() {
  save(); G.started = false; setMenu(null); $('title').hidden = false; $('bossBar').hidden = true; initTitle();
}
$('pauseBtn').addEventListener('click', () => { initAudio(); openPause(); });
$('pauseMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button') as HTMLElement | null; if (!t) return;
  if (t.hasAttribute('data-close')) { setMenu(null); return; }
  if (t.dataset.ptab) { tab = t.dataset.ptab; render(); return; }
  const a = t.dataset.pa;
  if (a === 'resume') setMenu(null);
  else if (a === 'set' || a === 'help') { tab = a; render(); }
  else if (a === 'title') backToTitle();
  else if (t.dataset.tog) { const k = t.dataset.tog as 'sound' | 'shake' | 'nums'; SET[k] = !SET[k]; applySettings(); if (k === 'sound' && SET.sound) { initAudio(); sfx.pick(); } render(); }
  else if (t.dataset.bs) { SET.btn = +t.dataset.bs; applySettings(); render(); }
});
$('pauseMenu').addEventListener('input', e => {
  const t = e.target as HTMLInputElement; if (t.id !== 'volIn') return;
  SET.vol = +t.value; $('volTxt').textContent = t.value; applySettings();
});
$('pauseMenu').addEventListener('change', e => { if ((e.target as HTMLElement).id === 'volIn') { initAudio(); sfx.pick(); } });   // 放開滑桿時響一聲，聽聽看多大聲
