import { G } from '../core/state';
import { $ } from '../core/util';
import { AFFIX, AT, ICON_URL, RAR, SLOTN, TT, WT, slotOf } from '../data/items';
import { CAMPS, MW, REGIONS, reg } from '../world/map';
import { mini } from '../world/minimap';
import { calcStats, curEq, level, lvCost, recalc } from '../game/player';
import { initAudio, sfx } from '../core/audio';
import { nearCamp, placeAtCamp, restoreWorld } from '../game/playerUpdate';
import { burst } from '../game/worldUpdate';
import { renderBigMap } from '../render/map';
import { openMenu, setMenu, toast } from './hud';
import { moveMerchant } from './shop';
import { restockSmiths } from '../world/towns';
import { save } from '../game/save';
import { ATTRS, ATTR_NAME, WSCALE, grade, reqOf, unmet } from '../data/attrs';
import { HERO, HERO_W } from '../art/hero';
import { drawWeapon } from '../art/weapon';
import { renderJournal } from '../game/quest';
import { pickUp } from '../game/worldUpdate';

export function restAt(c) {
  moveMerchant(); restockSmiths();
  G.lastCamp = c.id; restoreWorld(); save(); sfx.level();
  burst(G.me.x, G.me.y - 6, 14, '#f2c14e', 40); G.curCamp = c; G.campTab = 'lv'; renderCamp(); setMenu('camp');
}
function renderCamp() {
  $('campName').textContent = G.curCamp ? G.curCamp.name : '營火';
  for (const b of document.querySelectorAll<HTMLElement>('#campMenu .tabs button')) b.classList.toggle('on', b.dataset.tab === G.campTab);
  const body = $('campBody');
  if (G.campTab === 'lv') {
    const cost = lvCost(G.me), can = G.me.souls >= cost;
    const now = calcStats(G.me, curEq(G.me)), gain = k => { G.me[k]++; const nx = calcStats(G.me, curEq(G.me)); G.me[k]--;   // 這一點加下去會變多少
      const p = []; if (nx.maxHp !== now.maxHp) p.push('生命 +' + (nx.maxHp - now.maxHp)); if (nx.maxSt !== now.maxSt) p.push('體力 +' + (nx.maxSt - now.maxSt));
      if (nx.atk !== now.atk) p.push('攻擊 +' + (nx.atk - now.atk)); if (nx.def !== now.def) p.push('防禦 +' + (nx.def - now.def)); if (nx.crit !== now.crit) p.push('暴擊 +' + (nx.crit - now.crit) + '%');
      if (Math.abs(nx.aspd - now.aspd) > 1e-6) p.push('攻速 +' + ((nx.aspd - now.aspd) * 100).toFixed(1) + '%'); if (Math.abs(nx.cdr - now.cdr) > 1e-6) p.push('冷卻 -' + ((nx.cdr - now.cdr) * 100).toFixed(1) + '%');
      return p.length ? p.join('、') : '目前的武器用不到'; };
    body.innerHTML = '<div class="soulline"><span>持有魂晶 <b>' + G.me.souls + '</b></span><span>升到 Lv ' + (level(G.me) + 1) + ' 需要 <b>' + cost + '</b></span></div>' +
      ATTRS.map(a => '<div class="statrow"><div class="nm">' + a.n + '<small>' + a.d + ' · 下一點：' + gain(a.k) + '</small></div><div class="val">' + G.me[a.k] + '</div><button type="button" class="plus" data-stat="' + a.k + '"' + (can ? '' : ' disabled') + ' aria-label="提升' + a.n + '">+</button></div>').join('') +
      '<p class="hintp">休息時：生命和藥水補滿，野外的怪物全部復活（精英怪也會）。死掉會從最後休息的營火重來。</p>';
  } else {
    body.innerHTML = '<div class="camplist">' + CAMPS.map(c => '<button type="button" data-tp="' + c.id + '"' + (c.lit && c !== G.curCamp ? '' : ' disabled') + '><span>' + c.name + '<small> · ' + REGIONS[reg[c.ty * MW + c.tx]].name + '</small></span><small>' +
      (c === G.curCamp ? '你在這裡' : c.lit ? '傳送' : '尚未點燃') + '</small></button>').join('') + '</div><p class="hintp">靠近營火就會點燃它，之後就能傳送過去。</p>';
  }
}
$('campMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button'); if (!t) return;
  if (t.dataset.tab) { G.campTab = t.dataset.tab; renderCamp(); }
  else if (t.dataset.stat) { const cost = lvCost(G.me); if (G.me.souls < cost) return; G.me.souls -= cost; G.me[t.dataset.stat]++; recalc(G.me); G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; sfx.level(); renderCamp(); save(); }
  else if (t.dataset.tp) { const c = CAMPS.find(c => c.id === t.dataset.tp); G.lastCamp = c.id; placeAtCamp(G.me, c.id); restoreWorld(); save(); setMenu(null); G.region = ''; }
  else if (t.hasAttribute('data-close')) setMenu(null);
});
export function itemCard(it, cmp?) {
  const R = RAR[it.rarity], sl = slotOf(it);
  const dv = (a, b) => { const d = a - b; return d > 0 ? ' <span class="up">▲' + d + '</span>' : d < 0 ? ' <span class="down">▼' + (-d) + '</span>' : ''; };
  const c = cmp && cmp !== it ? cmp : null;
  const aff = Object.keys(it.aff).map(k => '<div class="aff">＋' + it.aff[k] + AFFIX[k].u + ' ' + AFFIX[k].n + '</div>').join('');
  let head, main, tail = '';
  if (sl === 'weapon') { const W = WT[it.type], S = WSCALE[it.type] || {}; head = W.trait; main = '攻擊 ' + it.atk + (c ? dv(it.atk, c.atk) : '');
    tail = '<div class="scal">加成 ' + Object.keys(S).map(k => ATTR_NAME[k] + ' ' + grade(S[k])).join(' · ') + '</div><div class="sk">技能 <b>' + W.sn + '</b>：' + W.sd + '</div>'; }
  else if (sl === 'armor') { head = AT[it.type].d; main = '防禦 ' + it.def + (c ? dv(it.def, c.def || 0) : '') + (it.hp ? ' · 生命 +' + it.hp : ''); }
  else { head = TT[it.type].d; main = TT[it.type].name; }
  return '<div class="card" style="border-color:' + R.c + '"><div class="iname" style="color:' + R.c + '"><img alt="" src="' + ICON_URL[it.type] + '">' + it.name + '</div>' +
    '<div class="rar" style="color:' + R.c + '">' + R.n + ' · ' + SLOTN[sl] + ' · 物品等級 ' + it.ilvl + ' · ' + head + '</div>' +
    '<div class="atk">' + main + '</div>' + aff + reqLine(it) + tail + '</div>';
}
function reqLine(it) {                                                  // 需求：夠的白字、不夠的紅字
  const r = reqOf(it), ks = Object.keys(r); if (!ks.length || !G.me) return '';
  const bad = unmet(G.me, it);
  return '<div class="req">需求 ' + ks.map(k => '<b class="' + (bad.includes(k as any) ? 'no' : '') + '">' + ATTR_NAME[k] + ' ' + r[k] + '</b>').join('') + (bad.length ? '（能力值不夠，不能裝備）' : '') + '</div>';
}
function statRows(now, nxt) {                                           // 屬性表；有預覽時顯示「現在 → 換上後」
  const pct = v => Math.round(v * 100) + '%';
  const rows: [string, any, ((v: number) => string)?][] = [['體力', 'maxSt'],
    ['減傷', 'def', v => pct(v / (v + 60))], ['暴擊', 'crit', v => v + '%'], ['吸血', 'ls', pct], ['攻速', 'aspd', v => '+' + Math.round((v - 1) * 100) + '%'], ['冷卻縮短', 'cdr', pct],
    ['金幣/魂晶', G.me.gold + '/' + G.me.souls]];
  return rows.map(([n, k, f]) => { if (typeof k !== 'string' || !(k in now)) return '<span>' + n + '</span><b>' + k + '</b>';
    const fmt = f || (v => String(v)), a = now[k], b = nxt ? nxt[k] : a, d = b - a;
    const pctK = k === 'ls' || k === 'aspd' || k === 'cdr', dd = pctK ? Math.round(Math.abs(d) * 100) + '%' : Math.round(Math.abs(d));
    return '<span>' + n + '</span><b>' + fmt(b) + (nxt && Math.abs(d) > 1e-6 ? ' <span class="' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '▲' : '▼') + dd + '</span>' : '') + '</b>'; }).join('');
}
let bagFilter = 'all';
function keyTile(cls, name, k, now, nxt, fmt = v => String(v)) {        // 左上角的三個大數字（有預覽時顯示變化）
  const d = nxt ? nxt[k] - now[k] : 0;
  return '<div class="' + cls + '"><small>' + name + '</small><b>' + fmt(nxt ? nxt[k] : now[k]) + '</b>' + (d ? '<span class="' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '▲' : '▼') + Math.abs(d) + '</span>' : '') + '</div>';
}
function drawDoll() {                                                   // 中間的角色：站姿 + 拿著現在的武器（3 倍大）
  const cv = $<HTMLCanvasElement>('doll'), g = cv.getContext('2d'), S = 3; g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(26 * S, 64 * S, 13 * S, 3 * S, 0, 0, Math.PI * 2); g.fill();
  const body = HERO.walk[0]; g.drawImage(body.n, 0, 0, HERO_W * S, body.h / (body.w / HERO_W) * S);
  const type = G.me.weapon.type, ranged = WT[type].ranged, ang = ranged ? -Math.PI / 2 + .35 : -.9, hx = 41 * S, hy = 44.5 * S;
  if (type === 'wolfblade') drawWeapon(g, 'wolfblade', 11.5 * S, 48.5 * S, ang + .5, S);
  drawWeapon(g, type, hx, hy, ang, S);
  const hs = HERO.hand; g.drawImage(hs.n, 39, 38, 5, 6, hx - 2.5 * S, hy - 2.5 * S, 5 * S, 6 * S);
}
export function renderInv() {
  $('invCount').textContent = G.me.inv.length + '/24';
  const eq = curEq(G.me);
  const bagIt = G.me.inv.find(x => x.id === G.selItem), eqIt = [eq.weapon, eq.armor, eq.trinket].find(x => x && x.id === G.selItem);
  let preview = null;
  if (bagIt) { const e2 = curEq(G.me); e2[slotOf(bagIt)] = bagIt; preview = calcStats(G.me, e2); }
  const now = calcStats(G.me, eq);
  $('keyStats').innerHTML = keyTile('hp', '生命', 'maxHp', now, preview) + keyTile('atk', '攻擊', 'atk', now, preview) + keyTile('df', '防禦', 'def', now, preview);
  const need = bagIt ? unmet(G.me, bagIt) : [], R = bagIt ? reqOf(bagIt) : {};
  $('attrList').innerHTML = ATTRS.map(a => { const v = G.me[a.k], miss = need.includes(a.k);
    return '<div class="attr' + (miss ? ' need' : '') + '" title="' + a.d + '"><span>' + a.n + '</span><div class="bar2"><i style="width:' + Math.min(100, v / 40 * 100) + '%"></i></div><b>' + v + (miss ? '/' + R[a.k] : '') + '</b></div>'; }).join('');
  $('pStats').innerHTML = statRows(now, preview);
  $('cmpNote').textContent = preview ? '▲▼ = 換上選取的裝備後' : '';
  $('dollLv').textContent = 'Lv ' + level(G.me); drawDoll();
  $('eqSlots').innerHTML = ['weapon', 'armor', 'trinket'].map(sl => { const it = eq[sl];
    return '<button type="button" class="eqslot' + (it && G.selItem === it.id ? ' sel' : '') + (it && unmet(G.me, it).length ? ' bad' : '') + '" data-eq="' + sl + '"' + (it ? ' style="border-color:' + RAR[it.rarity].c + '"' : '') + '>' +
      (it ? '<img alt="" src="' + ICON_URL[it.type] + '">' : '<div class="ph0">＋</div>') + '<small>' + SLOTN[sl] + '</small><span' + (it ? ' style="color:' + RAR[it.rarity].c + '"' : '') + '>' + (it ? it.name : '空') + '</span></button>'; }).join('');
  for (const b of document.querySelectorAll<HTMLElement>('#bagTabs button')) b.classList.toggle('on', b.dataset.f === bagFilter);
  const list = G.me.inv.map((it, i) => ({ it, i })).filter(o => bagFilter === 'all' || slotOf(o.it) === bagFilter);
  const cells = list.map(({ it, i }) => '<button type="button" class="slot' + (G.selItem === it.id ? ' sel' : '') + (unmet(G.me, it).length ? ' bad' : '') + '" data-i="' + i + '" style="border-color:' + RAR[it.rarity].c + '" aria-label="' + it.name + '"><img alt="" src="' + ICON_URL[it.type] + '"><i style="color:' + RAR[it.rarity].c + '">' + it.ilvl + '</i></button>');
  if (bagFilter === 'all') while (cells.length < 24) cells.push('<div class="slot blank"></div>');      // 空格子也畫出來，一眼看出背包還剩多少
  $('bagGrid').innerHTML = cells.length ? cells.join('') : '<div class="empty">這一類還沒有裝備。</div>';
  if (bagIt) { const bad = unmet(G.me, bagIt).length > 0;
    $('detail').innerHTML = itemCard(bagIt, eq[slotOf(bagIt)]) + '<div class="acts"><button type="button" class="pri" data-act="equip"' + (bad ? ' disabled' : '') + '>' + (bad ? '能力值不夠' : '裝備') + '</button><button type="button" class="warn" data-act="salv">分解（+' + salvValue(bagIt) + ' 魂晶）</button></div>'; }
  else if (eqIt) $('detail').innerHTML = itemCard(eqIt) + (slotOf(eqIt) !== 'weapon' ? '<div class="acts"><button type="button" data-act="unequip"' + (G.me.inv.length >= 24 ? ' disabled' : '') + '>卸下</button></div>' : '');
  else $('detail').innerHTML = G.me.inv.length ? '<p class="hintp">點一件裝備看詳細資料、能力值需求，以及跟身上那件的比較。</p>' : '<p class="hintp">還沒有撿到裝備。打倒怪物、打開寶箱都有機會拿到，光柱顏色越亮越稀有。</p>';
}
const salvValue = it => 3 * it.ilvl * (it.rarity + 1);
$('invMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button'); if (!t) return;
  if (t.hasAttribute('data-close')) { setMenu(null); return; }
  if (t.dataset.i !== undefined) { const it = G.me.inv[+t.dataset.i]; G.selItem = it && G.selItem !== it.id ? it.id : null; renderInv(); return; }
  if (t.dataset.f) { bagFilter = t.dataset.f; renderInv(); return; }
  if (t.dataset.eq) { const it = G.me[t.dataset.eq]; G.selItem = it && G.selItem !== it.id ? it.id : null; renderInv(); return; }
  const idx = G.me.inv.findIndex(x => x.id === G.selItem);
  if (t.dataset.act === 'equip' && idx >= 0) { if (unmet(G.me, G.me.inv[idx]).length) { toast('能力值不夠，還不能裝備', '#ff8a8a'); return; } const it = G.me.inv.splice(idx, 1)[0], sl = slotOf(it); if (G.me[sl]) G.me.inv.push(G.me[sl]); G.me[sl] = it; recalc(G.me); G.selItem = null; sfx.pick(); renderInv(); save(); }
  else if (t.dataset.act === 'unequip') { for (const sl of ['armor', 'trinket']) if (G.me[sl] && G.me[sl].id === G.selItem && G.me.inv.length < 24) { G.me.inv.push(G.me[sl]); G.me[sl] = null; } recalc(G.me); G.selItem = null; sfx.pick(); renderInv(); save(); }
  else if (t.dataset.act === 'salv' && idx >= 0) { const it = G.me.inv.splice(idx, 1)[0]; G.me.souls += salvValue(it); G.selItem = null; sfx.pick(); renderInv(); save(); }
  else if (t.id === 'salvAll') { let s = 0; G.me.inv = G.me.inv.filter(it => { if (it.rarity === 0) { s += salvValue(it); return false; } return true; }); G.me.souls += s; if (s) { toast('分解獲得 ' + s + ' 魂晶', '#b49cff'); sfx.pick(); } G.selItem = null; renderInv(); save(); }
});
let mapTab = 'map';
function showMapTab() { for (const b of document.querySelectorAll<HTMLElement>('#mapTabs button')) b.classList.toggle('on', b.dataset.mt === mapTab);
  $('mapPane').hidden = mapTab !== 'map'; $('journal').hidden = mapTab !== 'journal'; if (mapTab === 'journal') renderJournal(); else renderBigMap(); }
$('mapMenu').addEventListener('click', e => { const t = (e.target as HTMLElement).closest('button'); if (!t) return; if (t.hasAttribute('data-close')) setMenu(null); else if (t.dataset.mt) { mapTab = t.dataset.mt; showMapTab(); } });
export function toggleInv() { if (openMenu === 'inv') setMenu(null); else if (!openMenu && G.started && !G.me.dead) { G.selItem = null; renderInv(); setMenu('inv'); } }
export function toggleMap() { if (openMenu === 'map') setMenu(null); else if (!openMenu && G.started && !G.me.dead) { showMapTab(); setMenu('map'); } }
$('bagBtn').addEventListener('click', toggleInv);
$('mapBtn').addEventListener('click', toggleMap);
mini.addEventListener('click', toggleMap);
$('pickBtn').addEventListener('click', () => { if (G.pick) pickUp(G.me, G.pick); });
$('restBtn').addEventListener('click', () => { const c = nearCamp(G.me); if (c) restAt(c); });
$('veil').addEventListener('click', () => setMenu(null));
$('muteBtn').addEventListener('click', () => { G.muted = !G.muted; $('muteBtn').textContent = G.muted ? '音效 關' : '音效 開'; initAudio(); });

