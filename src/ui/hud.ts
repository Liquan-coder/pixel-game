import { G } from '../core/state';
import { $, clamp } from '../core/util';
import { WT, slotOf } from '../data/items';
import { fightingRB, nearZone } from '../world/regionBoss';
import { curEq, held, level } from '../game/player';
import { itemCard } from './menus';
import { interactTarget, type IKind } from './interact';
import { SCALE } from '../core/canvas';
import { view } from '../render/render';

/* ================= HUD / UI ================= */
const hudCache: Record<string, unknown> = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setScale(id, v) { v = Math.round(clamp(v, 0, 1) * 200) / 200; if (hudCache[id] !== v) { hudCache[id] = v; $(id).style.transform = 'scaleX(' + v + ')'; } }
/* 條的長度：上限 100 生命 = 96px，每多 1 點生命 +0.25px；體力 80 = 84px，每多 1 點 +0.5px（最長由 CSS 限制） */
export const hpBarW = (maxHp: number) => Math.round(96 + Math.max(0, maxHp - 100) * .25);
export const stBarW = (maxSt: number) => Math.round(84 + Math.max(0, maxSt - 80) * .5);
function setW(id, px) { const k = id + 'W'; if (hudCache[k] !== px) { hudCache[k] = px; $(id).parentElement.style.setProperty('--w', px + 'px'); } }
const PROMPTS: [IKind, string][] = [['pick', 'pickBtn'], ['chest', 'chestBtn'], ['read', 'readBtn'], ['door', 'doorBtn'], ['shop', 'shopBtn'], ['rest', 'restBtn']];
export function updateHUD() {
  setW('hpBar', hpBarW(G.me.maxHp)); setW('stBar', stBarW(G.me.maxSt));
  setText('lvTxt', String(level(G.me))); setScale('hpBar', G.me.hp / G.me.maxHp); setScale('stBar', G.me.st / G.me.maxSt);
  setText('soulTxt', String(G.me.souls)); setText('potTxt', String(G.me.pot)); setText('potTxt2', G.me.pot + '/' + G.potMax);
  const cd = G.me.skillCd > 0 ? G.me.skillCd / (WT[G.me.weapon.type].scd * (1 - G.me.cdr)) : 0;
  const cdv = Math.round(cd * 50) / 50; if (hudCache.cd !== cdv) { hudCache.cd = cdv; $('bSkill').style.setProperty('--cd', String(cdv)); $('skillHud').style.setProperty('--cd', String(cdv)); }
  const sec = G.me.skillCd > 0 ? (G.me.skillCd >= 1 ? String(Math.ceil(G.me.skillCd)) : G.me.skillCd.toFixed(1)) : '';   // 剩幾秒
  if (hudCache.sec !== sec) { if (hudCache.sec && !sec) { const h = $('skillHud'); h.classList.remove('ready'); void h.offsetWidth; h.classList.add('ready'); }   // 冷卻好了閃一下
    hudCache.sec = sec; $('skillHud').classList.toggle('cool', !!sec); for (const id of ['skillHudSec', 'bSkillSec']) { $(id).hidden = !sec; $(id).textContent = sec; } }
  const pk = !G.paused && G.started ? G.pick : null, pkKey = pk ? pk.item.id + ':' + (curEq(G.me)[slotOf(pk.item)]?.id ?? '') : '';
  if (hudCache.pick !== pkKey) { hudCache.pick = pkKey; $('pickBox').hidden = !pk;
    if (pk) $('pickCard').innerHTML = itemCard(pk.item, curEq(G.me)[slotOf(pk.item)]); }   // 跟身上同部位的裝備比較（▲▼）
  if (pk) placePickBox(pk);
  const it = interactTarget(), ik = it ? it.kind + ':' + (it.text || '') : '';             // 攻擊鍵現在會做什麼：撿起 / 休息 / 打開…
  if (hudCache.act !== ik) { hudCache.act = ik;
    for (const [k, id] of PROMPTS) $(id).hidden = !it || it.kind !== k;
    if (it?.text) $(it.kind === 'door' ? 'doorTxt' : 'shopTxt').textContent = it.text;
    $('bAtk').textContent = it ? it.btn : '攻擊'; $('bAtk').classList.toggle('act', !!it); }
  setText('goldTxt', String(G.me.gold));
  const zn = (!G.paused && G.started) ? nearZone() : null, zk = zn ? zn.id : '';      // 靠近 boss 場地時的提示（不寫等級、不說你打不打得過）
  if (hudCache.zone !== zk) { hudCache.zone = zk; $('zoneHint').hidden = !zn;
    if (zn) $('zoneHint').innerHTML = zn.short + '的領域' + '<small>再往前走就會開打，打贏之前離不開結界</small>'; }
  if (G.B && !G.bossDead && G.B.state !== 'sleep') setScale('bossHp', G.B.hp / G.B.maxHp);
  const frb = fightingRB(); if (frb) setScale('bossHp', frb.hp / frb.maxHp);
}
/* ---- 畫面上方的播報：最多疊 5 行，每行 2 秒後消失；金幣、魂晶短時間內連續撿到會合併成一行一直往上加 ---- */
const TOAST_MAX = 5, TOAST_MS = 2000;
function pushToast(el, col) {
  const box = $('toasts'); if (col) el.style.color = col;
  box.appendChild(el); while (box.children.length > TOAST_MAX) box.removeChild(box.firstChild);
  restartTimer(el);
}
function restartTimer(el) { clearTimeout(el._t); el._t = setTimeout(() => el.remove(), TOAST_MS); }
function placePickBox(d) {
  const box = $('pickBox'), w = box.offsetWidth, h = box.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
  const sx = (d.x - view.x) * SCALE, sy = (d.y - 8 - view.y) * SCALE, gap = 12 * SCALE;   // 裝備在螢幕上的位置（CSS 像素）
  const left = G.me.x > d.x ? sx - gap - w : sx + gap;                 // 角色在右 → 卡片放左
  const x = Math.round(clamp(left, 8, vw - w - 8)), y = Math.round(clamp(sy - h / 2, 8, vh - h - 8));
  const k = x + ',' + y; if (hudCache.pickPos !== k) { hudCache.pickPos = k; box.style.left = x + 'px'; box.style.top = y + 'px'; }
}
// loot = 撿到東西的提示（武器、金幣、魂晶）：黑底、字大一點；其他提示只有字
export function toast(msg, col?, loot = false) { const el = document.createElement('div'); el.className = loot ? 'toast loot' : 'toast'; el.textContent = msg; pushToast(el, col); }
const gains: Record<string, { el: HTMLElement & { _t?: any }, n: number }> = {};
export function gain(key, label, n, col) {                          // 例：gain('gold', '金幣', 3, '#f2c14e') → 「金幣 +3」，再撿到就變「金幣 +6」
  let g = gains[key];
  if (g && g.el.isConnected) { g.n += n; $('toasts').appendChild(g.el); g.el.classList.remove('bump'); void g.el.offsetWidth; g.el.classList.add('bump'); restartTimer(g.el); }
  else { g = gains[key] = { el: document.createElement('div'), n }; g.el.className = 'toast loot'; pushToast(g.el, col); }
  g.el.innerHTML = label + ' <b>+' + g.n + '</b>';
}
let areaTimer = 0, bannerTimer = 0;
export function showArea(n, s) {
  const el = $('areaToast');
  el.innerHTML = '<b>' + n + '</b><span>' + s + '</span>'; el.classList.add('show');
  clearTimeout(areaTimer); areaTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
export function showBanner(t, sub, ms) {
  $('areaToast').classList.remove('show');                          // 同時出現會疊在一起，大標題優先
  const el = $('banner'); el.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); el.classList.add('show');
  el.style.color = t === '力竭倒下' ? '#d8434e' : '#f2c14e';
  clearTimeout(bannerTimer); bannerTimer = setTimeout(hideBanner, ms);
}
export function hideBanner() { $('banner').classList.remove('show'); }

export let openMenu = null;
export function setMenu(name) {
  openMenu = name; $('campMenu').hidden = name !== 'camp'; $('invMenu').hidden = name !== 'inv'; $('mapMenu').hidden = name !== 'map'; $('shopMenu').hidden = name !== 'shop'; $('loreMenu').hidden = name !== 'lore'; $('veil').hidden = !name; document.body.classList.toggle('menu', !!name);
  G.paused = !!name || !G.started;
  for (const k in held) held[k] = false;
}
/* ---- 流浪商人：待在某個點燃的營火旁，每次休息就換到別的營火、商品也刷新 ---- */
