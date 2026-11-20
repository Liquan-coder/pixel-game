/* ================= 標題畫面：選存檔 =================
   三格存檔。點有存檔的那格 = 繼續；點空的那格 = 開新遊戲；✕ = 刪掉那一格（會先問一次）。
   鍵盤：W/S（↑↓）選格子，Enter 開始。 */
import { $ } from '../core/util';
import { CAMPS } from '../world/map';
import { itemName } from '../data/items';
import { SLOTS, clearSave, lastSlot, loadSave, setSlot } from '../game/save';
import { startGame } from '../main';

let sel = 0, delSlot = -1;

/* 一格存檔的摘要：最後休息的營火、拿著的武器、打倒幾個強敵、上次存檔時間（不顯示等級） */
function summary(d): string {
  const camp = CAMPS.find(c => c.id === d.lastCamp)?.name || '起始營火';
  const foes = (d.rbDead || []).length + (d.flags || []).filter((f: string) => f.startsWith('dgn:')).length + (d.bossDead ? 1 : 0);
  const wpn = d.weapon ? itemName(d.weapon) : '赤手空拳';
  let when = '';
  if (d.at) { const t = new Date(d.at), p = (n: number) => String(n).padStart(2, '0'); when = `${t.getMonth() + 1}/${t.getDate()} ${p(t.getHours())}:${p(t.getMinutes())}`; }
  return `<span>${camp} · ${wpn}</span><small>擊敗強敵 ${foes}${when ? ' · ' + when : ''}</small>`;
}

export function renderSlots() {
  const box = $('slots'); box.innerHTML = '';
  for (let i = 0; i < SLOTS; i++) {
    const d = loadSave(i), row = document.createElement('div');
    row.className = 'save' + (i === sel ? ' on' : '') + (d ? '' : ' empty');
    const main = document.createElement('button'); main.type = 'button'; main.className = 'slotMain';
    main.innerHTML = `<b>存檔 ${i + 1}</b>` + (d ? summary(d) : '<span>空的</span><small>開始新的冒險</small>');
    main.addEventListener('click', () => pickSlot(i));
    row.appendChild(main);
    if (d) { const del = document.createElement('button'); del.type = 'button'; del.className = 'slotDel'; del.title = '刪除這個存檔'; del.textContent = '✕';
      del.addEventListener('click', () => askDelete(i)); row.appendChild(del); }
    box.appendChild(row);
  }
}
export function initTitle() { sel = lastSlot(); renderSlots(); }

export function pickSlot(i = sel) {
  if (!$('confirmNew').hidden) return;                                   // 正在問要不要刪除 → 先回答
  setSlot(i); startGame(!!loadSave(i));
}
export function moveSlot(dir: number) {
  if (!$('confirmNew').hidden) return;
  sel = (sel + dir + SLOTS) % SLOTS; renderSlots();
}
function askDelete(i: number) {
  delSlot = i; $('confirmTxt').textContent = `刪除存檔 ${i + 1}？刪掉就回不來了。`; $('confirmNew').hidden = false;
}
$('btnNewYes').addEventListener('click', () => { if (delSlot >= 0) clearSave(delSlot); delSlot = -1; $('confirmNew').hidden = true; renderSlots(); });
$('btnNewNo').addEventListener('click', () => { delSlot = -1; $('confirmNew').hidden = true; });
