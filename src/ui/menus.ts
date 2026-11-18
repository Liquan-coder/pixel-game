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
import { save } from '../game/save';

export function restAt(c) {
  moveMerchant();
  G.lastCamp = c.id; restoreWorld(); save(); sfx.level();
  burst(G.me.x, G.me.y - 6, 14, '#f2c14e', 40); G.curCamp = c; G.campTab = 'lv'; renderCamp(); setMenu('camp');
}
function renderCamp() {
  $('campName').textContent = G.curCamp ? G.curCamp.name : '營火';
  for (const b of document.querySelectorAll<HTMLElement>('#campMenu .tabs button')) b.classList.toggle('on', b.dataset.tab === G.campTab);
  const body = $('campBody');
  if (G.campTab === 'lv') {
    const cost = lvCost(G.me), can = G.me.souls >= cost;
    const rows = [['vit', '體魄', '生命上限 +20', G.me.vit], ['str', '力量', '攻擊傷害 +10%', G.me.str], ['end', '耐力', '體力值 +10（翻滾、攻擊更持久）', G.me.end]];
    body.innerHTML = '<div class="soulline"><span>持有魂晶 <b>' + G.me.souls + '</b></span><span>升到 Lv ' + (level(G.me) + 1) + ' 需要 <b>' + cost + '</b></span></div>' +
      rows.map(r => '<div class="statrow"><div class="nm">' + r[1] + '<small>' + r[2] + '</small></div><div class="val">' + r[3] + '</div><button type="button" class="plus" data-stat="' + r[0] + '"' + (can ? '' : ' disabled') + ' aria-label="提升' + r[1] + '">+</button></div>').join('') +
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
  if (sl === 'weapon') { const W = WT[it.type]; head = W.trait; main = '攻擊 ' + it.atk + (c ? dv(it.atk, c.atk) : ''); tail = '<div class="sk">技能 <b>' + W.sn + '</b>：' + W.sd + '</div>'; }
  else if (sl === 'armor') { head = AT[it.type].d; main = '防禦 ' + it.def + (c ? dv(it.def, c.def || 0) : '') + (it.hp ? ' · 生命 +' + it.hp : ''); }
  else { head = TT[it.type].d; main = TT[it.type].name; }
  return '<div class="card" style="border-color:' + R.c + '"><div class="iname" style="color:' + R.c + '"><img alt="" src="' + ICON_URL[it.type] + '">' + it.name + '</div>' +
    '<div class="rar" style="color:' + R.c + '">' + R.n + ' · ' + SLOTN[sl] + ' · 物品等級 ' + it.ilvl + ' · ' + head + '</div>' +
    '<div class="atk">' + main + '</div>' + aff + tail + '</div>';
}
function statRows(now, nxt) {                                           // 屬性表；有預覽時顯示「現在 → 換上後」
  const pct = v => Math.round(v * 100) + '%';
  const rows: [string, any, ((v: number) => string)?][] = [['等級', level(G.me)], ['體魄/力量/耐力', G.me.vit + '/' + G.me.str + '/' + G.me.end], ['生命', 'maxHp'], ['體力', 'maxSt'], ['攻擊', 'atk'],
    ['防禦', 'def', v => v + '（減傷 ' + pct(v / (v + 60)) + '）'], ['暴擊', 'crit', v => v + '%'], ['吸血', 'ls', pct], ['攻速', 'aspd', v => '+' + Math.round((v - 1) * 100) + '%'], ['冷卻縮短', 'cdr', pct],
    ['金幣/魂晶', G.me.gold + '/' + G.me.souls]];
  return rows.map(([n, k, f]) => { if (typeof k !== 'string' || !(k in now)) return '<span>' + n + '</span><b>' + k + '</b>';
    const fmt = f || (v => String(v)), a = now[k], b = nxt ? nxt[k] : a, d = b - a;
    const pctK = k === 'ls' || k === 'aspd' || k === 'cdr', dd = pctK ? Math.round(Math.abs(d) * 100) + '%' : Math.round(Math.abs(d));
    return '<span>' + n + '</span><b>' + fmt(b) + (nxt && Math.abs(d) > 1e-6 ? ' <span class="' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '▲' : '▼') + dd + '</span>' : '') + '</b>'; }).join('');
}
export function renderInv() {
  $('invCount').textContent = G.me.inv.length + '/24';
  const eq = curEq(G.me);
  $('eqSlots').innerHTML = ['weapon', 'armor', 'trinket'].map(sl => { const it = eq[sl];
    return '<button type="button" class="eqslot' + (it && G.selItem === it.id ? ' sel' : '') + '" data-eq="' + sl + '">' + (it ? '<img alt="" src="' + ICON_URL[it.type] + '">' : '<div class="ph0">＋</div>') +
      '<span' + (it ? ' style="color:' + RAR[it.rarity].c + '"' : '') + '><small>' + SLOTN[sl] + '</small>' + (it ? it.name : '（空）') + '</span></button>'; }).join('');
  const bagIt = G.me.inv.find(x => x.id === G.selItem), eqIt = [eq.weapon, eq.armor, eq.trinket].find(x => x && x.id === G.selItem);
  let preview = null;
  if (bagIt) { const e2 = curEq(G.me); e2[slotOf(bagIt)] = bagIt; preview = calcStats(G.me, e2); }
  $('pStats').innerHTML = statRows(calcStats(G.me, eq), preview);
  $('cmpNote').textContent = preview ? '（▲▼ = 換上選取的裝備後）' : '';
  const grid = $('bagGrid');
  if (!G.me.inv.length) grid.innerHTML = '<div class="empty">還沒有撿到裝備。打倒怪物有機會掉落，光柱顏色越亮越稀有。</div>';
  else grid.innerHTML = G.me.inv.map((it, i) => '<button type="button" class="slot' + (G.selItem === it.id ? ' sel' : '') + '" data-i="' + i + '" style="border-color:' + RAR[it.rarity].c + '" aria-label="' + it.name + '"><img alt="" src="' + ICON_URL[it.type] + '"><i style="color:' + RAR[it.rarity].c + '">' + it.ilvl + '</i></button>').join('');
  if (bagIt) $('detail').innerHTML = itemCard(bagIt, eq[slotOf(bagIt)]) + '<div class="acts"><button type="button" class="pri" data-act="equip">裝備</button><button type="button" class="warn" data-act="salv">分解（+' + salvValue(bagIt) + ' 魂晶）</button></div>';
  else if (eqIt) $('detail').innerHTML = itemCard(eqIt) + (slotOf(eqIt) !== 'weapon' ? '<div class="acts"><button type="button" data-act="unequip"' + (G.me.inv.length >= 24 ? ' disabled' : '') + '>卸下</button></div>' : '');
  else $('detail').innerHTML = '';
}
const salvValue = it => 3 * it.ilvl * (it.rarity + 1);
$('invMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button'); if (!t) return;
  if (t.hasAttribute('data-close')) { setMenu(null); return; }
  if (t.dataset.i !== undefined) { const it = G.me.inv[+t.dataset.i]; G.selItem = it && G.selItem !== it.id ? it.id : null; renderInv(); return; }
  if (t.dataset.eq) { const it = G.me[t.dataset.eq]; G.selItem = it && G.selItem !== it.id ? it.id : null; renderInv(); return; }
  const idx = G.me.inv.findIndex(x => x.id === G.selItem);
  if (t.dataset.act === 'equip' && idx >= 0) { const it = G.me.inv.splice(idx, 1)[0], sl = slotOf(it); if (G.me[sl]) G.me.inv.push(G.me[sl]); G.me[sl] = it; recalc(G.me); G.selItem = null; sfx.pick(); renderInv(); save(); }
  else if (t.dataset.act === 'unequip') { for (const sl of ['armor', 'trinket']) if (G.me[sl] && G.me[sl].id === G.selItem && G.me.inv.length < 24) { G.me.inv.push(G.me[sl]); G.me[sl] = null; } recalc(G.me); G.selItem = null; sfx.pick(); renderInv(); save(); }
  else if (t.dataset.act === 'salv' && idx >= 0) { const it = G.me.inv.splice(idx, 1)[0]; G.me.souls += salvValue(it); G.selItem = null; sfx.pick(); renderInv(); save(); }
  else if (t.id === 'salvAll') { let s = 0; G.me.inv = G.me.inv.filter(it => { if (it.rarity === 0) { s += salvValue(it); return false; } return true; }); G.me.souls += s; if (s) { toast('分解獲得 ' + s + ' 魂晶', '#b49cff'); sfx.pick(); } G.selItem = null; renderInv(); save(); }
});
$('mapMenu').addEventListener('click', e => { const t = (e.target as HTMLElement).closest('button'); if (t && t.hasAttribute('data-close')) setMenu(null); });
export function toggleInv() { if (openMenu === 'inv') setMenu(null); else if (!openMenu && G.started && !G.me.dead) { G.selItem = null; renderInv(); setMenu('inv'); } }
export function toggleMap() { if (openMenu === 'map') setMenu(null); else if (!openMenu && G.started && !G.me.dead) { renderBigMap(); setMenu('map'); } }
$('bagBtn').addEventListener('click', toggleInv);
$('mapBtn').addEventListener('click', toggleMap);
mini.addEventListener('click', toggleMap);
$('restBtn').addEventListener('click', () => { const c = nearCamp(G.me); if (c) restAt(c); });
$('veil').addEventListener('click', () => setMenu(null));
$('muteBtn').addEventListener('click', () => { G.muted = !G.muted; $('muteBtn').textContent = G.muted ? '音效 關' : '音效 開'; initAudio(); });

