import { G } from '../core/state';
import { $, clamp } from '../core/util';
import { WT, slotOf } from '../data/items';
import { fightingRB, nearZone } from '../world/regionBoss';
import { curEq, held, level } from '../game/player';
import { nearCamp } from '../game/playerUpdate';
import { nearMerchant } from './shop';
import { nearChest } from '../world/chests';
import { nearSmith } from '../world/towns';
import { itemCard } from './menus';
import { SCALE } from '../core/canvas';
import { view } from '../render/render';

/* ================= HUD / UI ================= */
const hudCache: Record<string, unknown> = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setScale(id, v) { v = Math.round(clamp(v, 0, 1) * 200) / 200; if (hudCache[id] !== v) { hudCache[id] = v; $(id).style.transform = 'scaleX(' + v + ')'; } }
export function updateHUD() {
  setText('lvTxt', String(level(G.me))); setScale('hpBar', G.me.hp / G.me.maxHp); setScale('stBar', G.me.st / G.me.maxSt);
  setText('soulTxt', String(G.me.souls)); setText('potTxt', String(G.me.pot)); setText('potTxt2', G.me.pot + '/' + G.potMax);
  const cd = G.me.skillCd > 0 ? G.me.skillCd / (WT[G.me.weapon.type].scd * (1 - G.me.cdr)) : 0;
  const cdv = Math.round(cd * 50) / 50; if (hudCache.cd !== cdv) { hudCache.cd = cdv; $('bSkill').style.setProperty('--cd', String(cdv)); $('skillHud').style.setProperty('--cd', String(cdv)); }
  const sec = G.me.skillCd > 0 ? (G.me.skillCd >= 1 ? String(Math.ceil(G.me.skillCd)) : G.me.skillCd.toFixed(1)) : '';   // 剩幾秒
  if (hudCache.sec !== sec) { if (hudCache.sec && !sec) { const h = $('skillHud'); h.classList.remove('ready'); void h.offsetWidth; h.classList.add('ready'); }   // 冷卻好了閃一下
    hudCache.sec = sec; $('skillHud').classList.toggle('cool', !!sec); for (const id of ['skillHudSec', 'bSkillSec']) { $(id).hidden = !sec; $(id).textContent = sec; } }
  let show = !!((!G.paused && G.started) ? nearCamp(G.me) : null);
  const smith = !G.paused && G.started ? nearSmith() : null;
  let shop = !!(!G.paused && G.started && (smith || nearMerchant()));
  setText('shopBtn', smith ? '和鐵匠交易' : '和流浪商人交易');
  const pk = !G.paused && G.started ? G.pick : null, pkKey = pk ? pk.item.id + ':' + (curEq(G.me)[slotOf(pk.item)]?.id ?? '') : '';
  if (hudCache.pick !== pkKey) { hudCache.pick = pkKey; $('pickBox').hidden = !pk;
    if (pk) $('pickCard').innerHTML = itemCard(pk.item, curEq(G.me)[slotOf(pk.item)]); }   // 跟身上同部位的裝備比較（▲▼）
  if (pk) placePickBox(pk);
  const chest = !!(!G.paused && G.started && !pk && nearChest(G.me));
  if (hudCache.chest !== chest) { hudCache.chest = chest; $('chestBtn').hidden = !chest; }
  if (pk || chest) { show = false; shop = false; }                           // 腳邊有裝備時，E 和下方按鈕都是「撿起」
  if (hudCache.shop !== shop) { hudCache.shop = shop; $('shopBtn').hidden = !shop; }
  if (hudCache.rest !== (show && !shop)) { hudCache.rest = show && !shop; $('restBtn').hidden = !(show && !shop); }
  setText('goldTxt', String(G.me.gold));
  const zn = (!G.paused && G.started) ? nearZone() : null, zk = zn ? zn.id + (level(G.me) < zn.lv - 2 ? 'w' : '') : '';      // 靠近 boss 場地時的提示
  if (hudCache.zone !== zk) { hudCache.zone = zk; $('zoneHint').hidden = !zn;
    if (zn) $('zoneHint').innerHTML = zn.short + '的領域・建議等級 ' + zn.lv + (level(G.me) < zn.lv - 2 ? ' <span class="weak">（你目前偏弱）</span>' : '') + '<small>再往前走就會開打，打贏之前離不開結界</small>'; }
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
  openMenu = name; $('campMenu').hidden = name !== 'camp'; $('invMenu').hidden = name !== 'inv'; $('mapMenu').hidden = name !== 'map'; $('shopMenu').hidden = name !== 'shop'; $('veil').hidden = !name; document.body.classList.toggle('menu', !!name);
  G.paused = !!name || !G.started;
  for (const k in held) held[k] = false;
}
/* ---- 流浪商人：待在某個點燃的營火旁，每次休息就換到別的營火、商品也刷新 ---- */
