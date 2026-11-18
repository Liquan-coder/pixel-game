import { G } from '../core/state';
import { $, clamp } from '../core/util';
import { WT } from '../data/items';
import { fightingRB, nearZone } from '../world/regionBoss';
import { held, level } from '../game/player';
import { nearCamp } from '../game/playerUpdate';
import { nearMerchant } from './shop';

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
  const show = !!((!G.paused && G.started) ? nearCamp(G.me) : null);
  const shop = !!(!G.paused && G.started && nearMerchant());
  if (hudCache.shop !== shop) { hudCache.shop = shop; $('shopBtn').hidden = !shop; }
  if (hudCache.rest !== (show && !shop)) { hudCache.rest = show && !shop; $('restBtn').hidden = !(show && !shop); }
  setText('goldTxt', String(G.me.gold));
  const zn = (!G.paused && G.started) ? nearZone() : null, zk = zn ? zn.id + (level(G.me) < zn.lv - 2 ? 'w' : '') : '';      // 靠近 boss 場地時的提示
  if (hudCache.zone !== zk) { hudCache.zone = zk; $('zoneHint').hidden = !zn;
    if (zn) $('zoneHint').innerHTML = zn.short + '的領域・建議等級 ' + zn.lv + (level(G.me) < zn.lv - 2 ? ' <span class="weak">（你目前偏弱）</span>' : '') + '<small>再往前走就會開打，打贏之前離不開結界</small>'; }
  if (G.B && !G.bossDead && G.B.state !== 'sleep') setScale('bossHp', G.B.hp / G.B.maxHp);
  const frb = fightingRB(); if (frb) setScale('bossHp', frb.hp / frb.maxHp);
}
export function toast(msg, col) {
  const box = $('toasts'); const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; if (col) el.style.color = col;
  box.appendChild(el); while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
}
let areaTimer = 0, bannerTimer = 0;
export function showArea(n, s) {
  const el = $('areaToast');
  el.innerHTML = '<b>' + n + '</b><span>' + s + '</span>'; el.classList.add('show');
  clearTimeout(areaTimer); areaTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
export function showBanner(t, sub, ms) {
  const el = $('banner'); el.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); el.classList.add('show');
  el.style.color = t === '力竭倒下' ? '#d8434e' : '#f2c14e';
  clearTimeout(bannerTimer); bannerTimer = setTimeout(hideBanner, ms);
}
export function hideBanner() { $('banner').classList.remove('show'); }

export let openMenu = null;
export function setMenu(name) {
  openMenu = name; $('campMenu').hidden = name !== 'camp'; $('invMenu').hidden = name !== 'inv'; $('mapMenu').hidden = name !== 'map'; $('shopMenu').hidden = name !== 'shop'; $('veil').hidden = !name;
  G.paused = !!name || !G.started;
  for (const k in held) held[k] = false;
}
/* ---- 流浪商人：待在某個點燃的營火旁，每次休息就換到別的營火、商品也刷新 ---- */
