import { G } from '../core/state';
import { $, onTap } from '../core/util';
import { AFFIX, ICON_URL, RAR, SLOTN, UP_MAX, WT, armorStats, attachSeal, detachSeal, effOf, gearValue, itemName, slotOf } from '../data/items';
import { ACLS, ARMORS, A_UP_MAX, MAIN_BOSSES, T_SLOTS_MAX, effLines } from '../data/gear';
import type { Item } from '../types';
import { MATS, MAT_KEYS } from '../data/forge';
import { UG, UQ } from '../data/uniques';
import { WFXD, fxOf } from '../game/weaponFx';
import { CAMPS, MW, REGIONS, reg } from '../world/map';
import { mini } from '../world/minimap';
import { calcStats, curEq, level, lvCost, recalc } from '../game/player';
import { initAudio, sfx } from '../core/audio';
import { placeAtCamp, restoreWorld } from '../game/playerUpdate';
import { burst } from '../game/worldUpdate';
import { centerMap, clearMapSel, mapPick, mv, onMapPick, renderBigMap, zoomAt, type MapPick } from '../render/map';
import { fightingRB, rbDead } from '../world/regionBoss';
import { openMenu, setMenu, toast } from './hud';
import { moveMerchant } from './shop';
import { restockSmiths } from '../world/towns';
import { save } from '../game/save';
import { ATTRS, ATTR_BASE, ATTR_NAME, atkSplit, grade, reqOf, scaleOf, unmet } from '../data/attrs';
import { HERO, HERO_W } from '../art/hero';
import { drawWeapon } from '../art/weapon';
import { navT, renderJournal, setNav } from '../game/quest';
import { TS } from '../world/map';

export function restAt(c) {
  moveMerchant(); restockSmiths();
  G.lastCamp = c.id; restoreWorld(); save(); sfx.level();
  burst(G.me.x, G.me.y - 6, 14, '#f2c14e', 40); G.curCamp = c; G.campTab = 'lv'; clearPend(); renderCamp(); setMenu('camp');
}
/* 升級：先按 ＋／－ 分配（還沒花魂晶），按「確定」才一次扣掉。離開或切分頁就取消 */
const pend: Record<string, number> = {};
const clearPend = () => { for (const a of ATTRS) pend[a.k] = 0; };
clearPend();
const pendN = () => ATTRS.reduce((n, a) => n + pend[a.k], 0);
function pendCost(extra = 0) {                                          // 分配中的 n 點（再多 extra 點）總共要多少魂晶：每一級的價錢都不一樣，要一級一級加
  const tmp = { ...G.me }, n = pendN() + extra; let c = 0;
  for (let i = 0; i < n; i++) { if (tmp.freePts > 0) tmp.freePts--; else c += lvCost(tmp); tmp.vit++; }   // 重生水滴洗出來的點數先用（免費、等級不變）
  return c;
}
const withPend = () => { const p = { ...G.me }; for (const a of ATTRS) p[a.k] += pend[a.k]; p.freePts = Math.max(0, p.freePts - pendN()); return p; };
let tearArm = false;                                                     // 重生水滴要按兩次（第一次只是確認）
function renderCamp() {
  $('campName').textContent = G.curCamp ? G.curCamp.name : '營火';
  for (const b of document.querySelectorAll<HTMLElement>('#campMenu .tabs button')) b.classList.toggle('on', b.dataset.tab === G.campTab);
  const body = $('campBody'), foot = $('campFoot');
  foot.hidden = G.campTab !== 'lv';
  if (G.campTab === 'lv') {
    const nxtCost = pendCost(1), canAdd = G.me.souls >= nxtCost, after = withPend();
    const now = calcStats(after, curEq(G.me)), gain = k => { after[k]++; const nx = calcStats(after, curEq(G.me)); after[k]--;   // 再加這一點會變多少
      const p = []; if (nx.maxHp !== now.maxHp) p.push('生命 +' + (nx.maxHp - now.maxHp)); if (nx.maxSt !== now.maxSt) p.push('體力 +' + (nx.maxSt - now.maxSt));
      if (nx.atk !== now.atk) p.push('攻擊 +' + (nx.atk - now.atk)); if (nx.def !== now.def) p.push('防禦 +' + (nx.def - now.def)); if (nx.crit !== now.crit) p.push('暴擊 +' + (nx.crit - now.crit) + '%');
      if (Math.abs(nx.aspd - now.aspd) > 1e-6) p.push('攻速 +' + ((nx.aspd - now.aspd) * 100).toFixed(1) + '%'); if (Math.abs(nx.cdr - now.cdr) > 1e-6) p.push('冷卻 -' + ((nx.cdr - now.cdr) * 100).toFixed(1) + '%');
      return p.length ? p.join('、') : '目前的武器用不到'; };
    const keepY = body.scrollTop;                                       // 重畫時記住捲到哪裡（按 ＋ 不會跳回最上面）
    const free = Math.max(0, G.me.freePts - pendN());
    body.innerHTML = (G.me.tears > 0 ? '<div class="tearrow"><img alt="" src="' + ICON_URL.tear + '"><span>重生水滴 ×' + G.me.tears + '<small>把所有能力值洗回 5，點數全部還給你重新分配</small></span><button type="button" class="sec" data-tear>' + (tearArm ? '確定要洗？' : '使用') + '</button></div>' : '') +
      (free ? '<p class="freep">還有 <b>' + free + '</b> 點可以免費分配</p>' : '') +
      '<div class="lvgrid">' + ATTRS.map(a => '<div class="statrow' + (pend[a.k] ? ' pend' : '') + '"><div class="nm">' + a.n + '<small>' + a.d + '</small><small class="nx">下一點：' + gain(a.k) + '</small></div>' +
      '<button type="button" class="minus" data-dec="' + a.k + '"' + (pend[a.k] ? '' : ' disabled') + ' aria-label="減少' + a.n + '">−</button>' +
      '<div class="val">' + (G.me[a.k] + pend[a.k]) + (pend[a.k] ? '<small>+' + pend[a.k] + '</small>' : '') + '</div>' +
      '<button type="button" class="plus" data-stat="' + a.k + '"' + (canAdd ? '' : ' disabled') + ' aria-label="提升' + a.n + '">+</button></div>').join('') + '</div>' +
      '<p class="hintp">按 ＋／－ 分配，按「確定」才會花掉魂晶。休息時生命和藥水補滿，野外的怪物全部復活。</p>';
    body.scrollTop = keepY;
    const n = pendN(), cost = pendCost(), base = calcStats(G.me, curEq(G.me)), d = [];
    if (n) { if (now.maxHp !== base.maxHp) d.push('生命 +' + (now.maxHp - base.maxHp)); if (now.maxSt !== base.maxSt) d.push('體力 +' + (now.maxSt - base.maxSt)); if (now.atk !== base.atk) d.push('攻擊 +' + (now.atk - base.atk)); if (now.def !== base.def) d.push('防禦 +' + (now.def - base.def)); }
    foot.innerHTML = '<div class="lvfoot">魂晶 <b class="soulv">' + (G.me.souls - cost) + '</b>' + (n ? ' <small>(−' + cost + ')</small>' : '') + '<i>|</i>等級 <b class="lvv">' + (level(G.me) + n) + '</b>' + (n ? ' <small>(+' + n + ')</small>' : '') +
      '<i>|</i>' + (free ? '下一點 <b>免費</b>' : canAdd ? '下一點 <b>' + nxtCost + '</b>' : '下一點要 ' + nxtCost + '，魂晶不夠') + (d.length ? '<span class="gain">' + d.join('、') + '</span>' : '') + '</div>' +
      '<button type="button" class="sec" data-reset' + (n ? '' : ' disabled') + '>重設</button><button type="button" class="pri" data-confirm' + (n ? '' : ' disabled') + '>確定</button>';
  } else {
    body.innerHTML = '<div class="camplist">' + CAMPS.map(c => '<button type="button" data-tp="' + c.id + '"' + (c.lit && c !== G.curCamp ? '' : ' disabled') + '><span>' + c.name + '<small> · ' + REGIONS[reg[c.ty * MW + c.tx]].name + '</small></span><small>' +
      (c === G.curCamp ? '你在這裡' : c.lit ? '傳送' : '尚未點燃') + '</small></button>').join('') + '</div><p class="hintp">靠近營火就會點燃它，之後就能傳送過去。</p>';
  }
}
$('campMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button'); if (!t) return;
  if (t.dataset.tab) { G.campTab = t.dataset.tab; clearPend(); tearArm = false; renderCamp(); }
  else if (t.hasAttribute('data-tear')) { if (G.me.tears <= 0) return;
    if (!tearArm) { tearArm = true; renderCamp(); return; }
    tearArm = false; G.me.tears--; clearPend(); G.me.freePts = level(G.me) - 1; for (const a of ATTRS) G.me[a.k] = ATTR_BASE;   // 等級不變：洗掉的點數全部變成免費點數
    recalc(G.me); G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; sfx.level(); toast('能力值洗回去了，' + G.me.freePts + ' 點可以重新分配', '#9ae8ff'); renderCamp(); save(); }
  else if (t.dataset.stat) { if (G.me.souls < pendCost(1)) return; pend[t.dataset.stat]++; sfx.pick(); renderCamp(); }
  else if (t.dataset.dec) { if (pend[t.dataset.dec] > 0) pend[t.dataset.dec]--; renderCamp(); }
  else if (t.hasAttribute('data-reset')) { clearPend(); renderCamp(); }
  else if (t.hasAttribute('data-confirm')) { const cost = pendCost(); if (!pendN() || G.me.souls < cost) return;
    G.me.souls -= cost; G.me.freePts = Math.max(0, G.me.freePts - pendN()); for (const a of ATTRS) G.me[a.k] += pend[a.k]; clearPend(); recalc(G.me); G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; sfx.level(); renderCamp(); save(); }
  else if (t.dataset.tp) { const c = CAMPS.find(c => c.id === t.dataset.tp); G.lastCamp = c.id; placeAtCamp(G.me, c.id); restoreWorld(); save(); setMenu(null); G.region = ''; }
  else if (t.hasAttribute('data-close')) setMenu(null);
});
/* ---- 物品卡：名字、類型、主要數值、效果、需求、背景故事 ---- */
const effHtml = (e: Record<string, number>) => effLines(e).map(t => '<div class="aff">' + t + '</div>').join('');
export function itemCard(it, cmp?) {
  const R = RAR[it.rarity], sl = slotOf(it), c = cmp && cmp !== it ? cmp : null;
  const dv = (a, b) => { const d = a - b; return d > 0 ? ' <span class="up">▲' + d + '</span>' : d < 0 ? ' <span class="down">▼' + (-d) + '</span>' : ''; };
  let head = SLOTN[sl], main = '', tail = '';
  if (sl === 'weapon') { const W = WT[it.type], S = scaleOf(it), fx = fxOf(it), U = it.uq && UQ[it.uq];
    head += ' · 強化 +' + (it.up || 0) + '/' + UP_MAX + (U ? ' · 獨特' : '');
    const A = atkSplit(G.me, it), B = c && slotOf(c) === 'weapon' ? atkSplit(G.me, c) : null;            // 攻擊 = 武器本身 + 你的能力值給的；▲▼ 比總攻擊
    main = '攻擊 ' + A.base + ' <span class="bn">+ ' + A.bonus + '</span>' + (B ? dv(A.total, B.total) : '') + ' <small style="color:var(--muted)">· ' + W.trait + '</small>';
    tail = Object.keys(it.aff || {}).map(k => '<div class="aff">＋' + it.aff[k] + AFFIX[k].u + ' ' + AFFIX[k].n + '</div>').join('') +
      '<div class="scal">加成 ' + Object.keys(S).map(k => ATTR_NAME[k] + ' ' + grade(S[k])).join(' · ') + '</div>' +
      (fx ? '<div class="sk">刻印 <b style="color:' + WFXD[fx].c + '">' + WFXD[fx].n + '</b>：' + WFXD[fx].d + '</div>' : (U ? '' : '<div class="sk" style="color:var(--muted)">沒有刻印（可以從背包裝上）</div>')) +
      '<div class="sk">技能 <b>' + W.sn + '</b>：' + W.sd + '</div>' + (U ? '<div class="sk lore">' + U.lore + '<br><small>來源：' + U.from + '</small></div>' : ''); }
  else if (sl === 'armor') { const A = armorStats(it), C = ACLS[A.cls], B = c ? armorStats(c) : null;
    head += ' · ' + C.n + ' · 強化 +' + (it.up || 0) + '/' + A_UP_MAX;
    main = '防禦 ' + A.def + (B ? dv(A.def, B.def) : '') + ' · 生命 +' + A.hp + (B ? dv(A.hp, B.hp) : '');
    tail = '<div class="sk" style="color:var(--muted)">' + C.d + '</div>' + effHtml(effOf(it)); }
  else if (sl === 'trinket') { main = effLines(effOf(it))[0] || ''; tail = effHtml(Object.fromEntries(Object.entries(effOf(it)).slice(1))); }
  else { const F = WFXD[it.fx]; main = '<b style="color:' + F.c + '">' + F.n + '</b>：' + F.d; tail = '<div class="sk" style="color:var(--muted)">裝到一般武器上才有效果，可以隨時拆下來換到別把。獨特武器不能裝。</div>'; }
  const UGd = it.ug && UG[it.ug]; if (UGd) tail += '<div class="sk lore">' + UGd.lore + '<br><small>來源：' + UGd.from + '</small></div>';
  const A2 = sl === 'armor' && it.ak && ARMORS[it.ak]; if (A2 && A2.d) tail += '<div class="sk lore">' + A2.d + '</div>';
  return '<div class="card" style="border-color:' + R.c + '"><div class="iname" style="color:' + R.c + '"><img alt="" src="' + ICON_URL[it.type] + '">' + itemName(it) + '</div>' +
    '<div class="rar" style="color:' + R.c + '">' + head + '</div><div class="atk">' + main + '</div>' + reqLine(it) + tail + '</div>';
}
function reqLine(it) {                                                  // 需求：夠的白字、不夠的紅字
  const r = reqOf(it), ks = Object.keys(r); if (!ks.length || !G.me) return '';
  const bad = unmet(G.me, it);
  return '<div class="req">需求 ' + ks.map(k => '<b class="' + (bad.includes(k as any) ? 'no' : '') + '">' + ATTR_NAME[k] + ' ' + r[k] + '</b>').join('') + (bad.length ? '（能力值不夠，不能裝備）' : '') + '</div>';
}
function statRows(now, nxt) {                                           // 屬性表；有預覽時顯示「現在 → 換上後」
  const pct = v => Math.round(v * 100) + '%';
  const rows: [string, any, ((v: number) => string)?][] = [['體力', 'maxSt'],
    ['減傷', 'defRed', pct], ['暴擊', 'crit', v => v + '%'], ['吸血', 'ls', pct], ['攻速', 'aspd', v => '+' + Math.round((v - 1) * 100) + '%'], ['冷卻縮短', 'cdr', pct],
    ['金幣/魂晶', G.me.gold + '/' + G.me.souls]];
  return rows.map(([n, k, f]) => { if (typeof k !== 'string' || !(k in now)) return '<span>' + n + '</span><b>' + k + '</b>';
    const fmt = f || (v => String(v)), a = now[k], b = nxt ? nxt[k] : a, d = b - a;
    const pctK = k === 'ls' || k === 'aspd' || k === 'cdr' || k === 'defRed', dd = pctK ? Math.round(Math.abs(d) * 100) + '%' : Math.round(Math.abs(d));
    return '<span>' + n + '</span><b>' + fmt(b) + (nxt && Math.abs(d) > 1e-6 ? ' <span class="' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '▲' : '▼') + dd + '</span>' : '') + '</b>'; }).join('');
}
let bagFilter = 'all';
function keyTile(cls, name, k, now, nxt, fmt = v => String(v)) {        // 三個大數字（有預覽時顯示變化）
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
/** 飾品欄開放幾格：一開始 2 格，打倒 2 隻主線 Boss（含狼王）→ 3 格，4 隻 → 4 格 */
export function tSlots() { const n = MAIN_BOSSES.filter(id => rbDead.has(id)).length + (G.bossDead ? 1 : 0); return Math.min(T_SLOTS_MAX, 2 + (n >= 2 ? 1 : 0) + (n >= 4 ? 1 : 0)); }
type Sel = { where: 'bag' | 'eq'; it: Item; slot?: string; ti?: number } | null;
function selected(): Sel {
  const id = G.selItem; if (id == null) return null;
  const b = G.me.inv.find(x => x.id === id); if (b) return { where: 'bag', it: b };
  if (G.me.weapon && G.me.weapon.id === id) return { where: 'eq', it: G.me.weapon, slot: 'weapon' };
  if (G.me.armor && G.me.armor.id === id) return { where: 'eq', it: G.me.armor, slot: 'armor' };
  const ti = G.me.trinkets.findIndex(t => t && t.id === id); if (ti >= 0) return { where: 'eq', it: G.me.trinkets[ti], slot: 'trinket', ti };
  return null;
}
/** 換上這件之後的裝備（給預覽用）。飾品：放進第一個空格；滿了就換掉第一格 */
function eqWith(it: Item) {
  const e = curEq(G.me), sl = slotOf(it), out = { weapon: e.weapon, armor: e.armor, trinkets: e.trinkets.slice() };
  if (sl === 'weapon') out.weapon = it; else if (sl === 'armor') out.armor = it;
  else if (sl === 'trinket') { const n = tSlots(), k = out.trinkets.slice(0, n).findIndex(t => !t); out.trinkets[k >= 0 ? k : 0] = it; }
  return out;
}
export function renderInv() {
  $('invCount').textContent = G.me.inv.length + '/24'; $('matLine').innerHTML = matLine();
  const eq = curEq(G.me), sel = selected(), bagIt = sel && sel.where === 'bag' ? sel.it : null, nSlots = tSlots();
  // 左欄：沒選東西 → 角色屬性；選了 → 那件裝備的資料 + 按鈕（不用往下捲）
  const info = $('cInfo');
  if (!sel) {
    const now = calcStats(G.me, eq);
    info.innerHTML = '<div class="keystats">' + keyTile('hp', '生命', 'maxHp', now, null) + keyTile('atk', '攻擊', 'atk', now, null) + keyTile('df', '防禦', 'def', now, null) + '</div>' +
      '<div class="lbl">能力值<small class="lvhint">在營火用魂晶升級</small></div><div id="attrList">' + ATTRS.map(a => '<div class="attr" title="' + a.d + '"><span>' + a.n + '</span><div class="bar2"><i style="width:' + Math.min(100, G.me[a.k] / 40 * 100) + '%"></i></div><b>' + G.me[a.k] + '</b></div>').join('') + '</div>' +
      '<div class="lbl" style="margin-top:6px">詳細屬性</div><div class="stattbl">' + statRows(now, null) + '</div>' +
      '<p class="hintp">' + (G.me.inv.length ? '點一件裝備，這裡會顯示它的資料和比較。' : '還沒有撿到裝備。武器主要在寶箱、地城和 Boss 身上。') + '</p>';
  } else {
    const it = sel.it, sl = slotOf(it), cmp = sl === 'weapon' ? eq.weapon : sl === 'armor' ? eq.armor : null;
    const pv = bagIt && sl !== 'seal' ? calcStats(G.me, eqWith(bagIt)) : null, now = calcStats(G.me, eq);
    let acts = '';
    if (bagIt) { const bad = unmet(G.me, bagIt).length > 0, full = G.me.inv.length >= 24;
      if (sl === 'seal') { const w = G.me.weapon; acts = '<button type="button" class="pri" data-act="seal"' + (w.uq ? ' disabled' : '') + '>' + (w.uq ? '獨特武器不能裝刻印' : '裝到「' + itemName(w) + '」') + '</button>'; }
      else if (sl === 'trinket') { const free = eq.trinkets.slice(0, nSlots).findIndex(t => !t);
        acts = free >= 0 ? '<button type="button" class="pri" data-act="equip">裝備</button>' : eq.trinkets.slice(0, nSlots).map((t, i) => '<button type="button" class="pri" data-act="tswap" data-ti="' + i + '">換掉 ' + t.name + '</button>').join(''); }
      else acts = '<button type="button" class="pri" data-act="equip"' + (bad ? ' disabled' : '') + '>' + (bad ? '能力值不夠' : '裝備') + '</button>';
      acts += '<button type="button" class="warn" data-act="salv">分解（+' + salvValue(bagIt) + ' 魂晶）</button>'; if (full && sl === 'seal') acts += ''; }
    else if (sel.slot === 'weapon') { if (it.fx && !it.uq) acts = '<button type="button" data-act="unseal"' + (G.me.inv.length >= 24 ? ' disabled' : '') + '>拆下刻印</button>'; }
    else acts = '<button type="button" data-act="unequip"' + (G.me.inv.length >= 24 ? ' disabled' : '') + '>卸下</button>';
    info.innerHTML = '<div class="cscroll">' + itemCard(it, bagIt ? cmp : null) +
      (pv ? '<div class="keystats sm">' + keyTile('hp', '生命', 'maxHp', now, pv) + keyTile('atk', '攻擊', 'atk', now, pv) + keyTile('df', '防禦', 'def', now, pv) + '</div><div class="stattbl">' + statRows(now, pv) + '</div>' : '') +
      '</div><div class="acts">' + acts + '<button type="button" class="sec" data-act="back">返回</button></div>';
  }
  $('dollLv').textContent = 'Lv ' + level(G.me); drawDoll();
  // 中間：武器、防具、4 個飾品欄（還沒開放的鎖著）
  const slotBtn = (it: Item | null, key: string, label: string, locked = false) => locked
    ? '<div class="eqslot lock" title="打倒更多主線 Boss 解鎖"><div class="ph0">🔒</div><small>' + label + '</small><span>未開放</span></div>'
    : '<button type="button" class="eqslot' + (it && G.selItem === it.id ? ' sel' : '') + (it && unmet(G.me, it).length ? ' bad' : '') + '" data-eq="' + key + '"' + (it ? ' style="border-color:' + RAR[it.rarity].c + '"' : '') + '>' +
      (it ? '<img alt="" src="' + ICON_URL[it.type] + '">' : '<div class="ph0">＋</div>') + '<small>' + label + '</small><span' + (it ? ' style="color:' + RAR[it.rarity].c + '"' : '') + '>' + (it ? itemName(it) : '空') + '</span></button>';
  $('eqSlots').innerHTML = slotBtn(eq.weapon, 'weapon', '武器') + slotBtn(eq.armor, 'armor', '防具') + '<div class="eqgap"></div>' +
    [0, 1, 2, 3].map(i => slotBtn(eq.trinkets[i], 't' + i, '飾品 ' + (i + 1), i >= nSlots)).join('');
  // 右邊：背包
  for (const b of document.querySelectorAll<HTMLElement>('#bagTabs button')) b.classList.toggle('on', b.dataset.f === bagFilter);
  const list = G.me.inv.map((it, i) => ({ it, i })).filter(o => bagFilter === 'all' || slotOf(o.it) === bagFilter);
  const cells = list.map(({ it, i }) => '<button type="button" class="slot' + (G.selItem === it.id ? ' sel' : '') + (unmet(G.me, it).length ? ' bad' : '') + '" data-i="' + i + '" style="border-color:' + RAR[it.rarity].c + '" aria-label="' + it.name + '"><img alt="" src="' + ICON_URL[it.type] + '"><i style="color:' + RAR[it.rarity].c + '">' + badge(it) + '</i></button>');
  if (bagFilter === 'all') while (cells.length < 24) cells.push('<div class="slot blank"></div>');      // 空格子也畫出來，一眼看出背包還剩多少
  $('bagGrid').innerHTML = cells.length ? cells.join('') : '<div class="empty">這一類還沒有東西。</div>';
}
const salvValue = it => Math.round(3 * gearValue(it) * (slotOf(it) === 'weapon' ? .5 : 1));
export const badge = it => (slotOf(it) === 'weapon' || slotOf(it) === 'armor') && it.up ? '+' + it.up : '';    // 背包格子左上角的小字：強化等級
export const matLine = () => MAT_KEYS.map(k => '<span title="' + MATS[k].d + '" style="color:' + MATS[k].c + '">' + MATS[k].n + ' <b>' + (G.me.mats[k] || 0) + '</b></span>').join('');
$('invMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button'); if (!t || (t as HTMLButtonElement).disabled) return;
  if (t.hasAttribute('data-close')) { setMenu(null); return; }
  if (t.dataset.i !== undefined) { const it = G.me.inv[+t.dataset.i]; G.selItem = it && G.selItem !== it.id ? it.id : null; renderInv(); return; }
  if (t.dataset.f) { bagFilter = t.dataset.f; renderInv(); return; }
  if (t.dataset.eq) { const k = t.dataset.eq, it = k === 'weapon' ? G.me.weapon : k === 'armor' ? G.me.armor : G.me.trinkets[+k.slice(1)];
    G.selItem = it && G.selItem !== it.id ? it.id : null; renderInv(); return; }
  const sel = selected(), act = t.dataset.act, done = () => { recalc(G.me); G.selItem = null; sfx.pick(); renderInv(); save(); };
  if (act === 'back') { G.selItem = null; renderInv(); return; }
  if (!sel) return;
  const idx = G.me.inv.indexOf(sel.it);
  if (act === 'equip' && idx >= 0) { const it = sel.it, sl = slotOf(it);
    if (sl !== 'trinket' && unmet(G.me, it).length) { toast('能力值不夠，還不能裝備', '#ff8a8a'); return; }
    G.me.inv.splice(idx, 1);
    if (sl === 'trinket') { const k = G.me.trinkets.slice(0, tSlots()).findIndex(x => !x); if (k < 0) { G.me.inv.push(it); return; } G.me.trinkets[k] = it; }
    else { if (G.me[sl]) G.me.inv.push(G.me[sl]); G.me[sl] = it; }
    done(); }
  else if (act === 'tswap' && idx >= 0) { const k = +t.dataset.ti, old = G.me.trinkets[k]; G.me.inv.splice(idx, 1, ...(old ? [old] : [])); G.me.trinkets[k] = sel.it; done(); }
  else if (act === 'seal' && idx >= 0) { const w = G.me.weapon; if (w.uq) return; G.me.inv.splice(idx, 1); const old = attachSeal(w, sel.it); if (old) G.me.inv.push(old);
    toast('「' + itemName(w) + '」裝上了' + sel.it.name, '#c475ff'); done(); }
  else if (act === 'unseal' && sel.slot === 'weapon' && G.me.inv.length < 24) { const s2 = detachSeal(sel.it); if (s2) G.me.inv.push(s2); done(); }
  else if (act === 'unequip' && G.me.inv.length < 24) { if (sel.slot === 'armor') G.me.armor = null; else if (sel.slot === 'trinket') G.me.trinkets[sel.ti] = null; else return; G.me.inv.push(sel.it); done(); }
  else if (act === 'salv' && idx >= 0) { G.me.inv.splice(idx, 1); G.me.souls += salvValue(sel.it); done(); }
});
$('salvAll').addEventListener('click', () => { let s = 0;                                  // 分解所有「沒強化、沒刻印的一般武器 / 防具」
  G.me.inv = G.me.inv.filter(it => { const sl = slotOf(it); if ((sl === 'weapon' || sl === 'armor') && it.rarity === 0 && !it.up) { s += salvValue(it); return false; } return true; });
  G.me.souls += s; if (s) { toast('分解獲得 ' + s + ' 魂晶', '#b49cff'); sfx.pick(); } G.selItem = null; renderInv(); save(); });
export let mapTab = 'map';
function showMapTab() { for (const b of document.querySelectorAll<HTMLElement>('#mapTabs button')) b.classList.toggle('on', b.dataset.mt === mapTab);
  $('mapPane').hidden = mapTab !== 'map'; $('journal').hidden = mapTab !== 'journal'; renderMapFoot(mapTab === 'map' ? mapPick() : null); if (mapTab === 'journal') renderJournal(); else renderBigMap(); }
/* 地圖快速傳送：點營火 → 底部出現「傳送」。跟強敵戰鬥中、或附近有正在追你的敵人時不能傳 */
function travelBlock() {
  if (fightingRB() || (G.B && !G.bossDead && G.B.state !== 'sleep')) return '正在和強敵戰鬥，不能傳送';
  if (G.enemies.some(e => !e.dead && e.state !== 'idle' && e.state !== 'return' && Math.hypot(e.x - G.me.x, e.y - G.me.y) < 160)) return '附近有敵人在追你，不能傳送';
  return '';
}
function renderMapFoot(p: MapPick | null) {                              // 點了地圖上的圖示：營火 → 名字 + 傳送；其他 → 名字 + 說明
  const f = $('mapFoot'); f.hidden = !p; if (!p) return;
  const rg = REGIONS[reg[Math.floor(p.ty) * MW + Math.floor(p.tx)]];
  const navOn = navT && navT.key === p.kind + ':' + p.id, navB = p.kind === 'me' ? '' : '<button type="button" class="sec" data-nav>' + (navOn ? '取消導航' : '導航') + '</button>';   // 導航：角色旁邊出現箭頭指過去
  if (p.kind !== 'camp') { f.innerHTML = '<span class="lvfoot"><b>' + p.name + '</b>' + (rg && p.kind !== 'quest' ? ' · ' + rg.name : '') + (p.desc ? '<span class="gain">' + p.desc + '</span>' : '') + '</span><button type="button" class="sec" data-mapx>關閉</button>' + navB; return; }
  const c = CAMPS.find(c => c.id === p.id); if (!c) { f.hidden = true; return; }
  const blk = !c.lit ? '還沒點燃：走到那裡點燃後才能傳送' : travelBlock();
  f.innerHTML = '<span class="lvfoot"><b>' + p.name + '</b> · ' + REGIONS[reg[c.ty * MW + c.tx]].name + (blk ? '<span class="gain" style="color:#ff8a7a">' + blk + '</span>' : '<span class="gain">傳送後會在營火休息（補滿、怪物復活）</span>') + '</span>' +
    '<button type="button" class="sec" data-mapx>取消</button>' + navB + '<button type="button" class="pri" data-travel="' + c.id + '"' + (blk ? ' disabled' : '') + '>傳送</button>';
}
onMapPick(renderMapFoot);
$('mapMenu').addEventListener('click', e => { const t = (e.target as HTMLElement).closest('button'); if (!t || (t as HTMLButtonElement).disabled) return;
  if (t.hasAttribute('data-close')) setMenu(null);
  else if (t.dataset.mt) { mapTab = t.dataset.mt; showMapTab(); }
  else if (t.dataset.mz) { if (t.dataset.mz === 'me') centerMap(); else zoomAt(mv.w / 2, mv.h / 2, mv.z * (t.dataset.mz === 'in' ? 1.5 : 1 / 1.5)); renderBigMap(); }
  else if (t.hasAttribute('data-mapx')) { clearMapSel(); renderMapFoot(null); renderBigMap(); }
  else if (t.hasAttribute('data-nav')) { const p = mapPick(); if (!p) return; const key = p.kind + ':' + p.id;
    if (navT && navT.key === key) { setNav(null); renderMapFoot(p); return; }
    setNav({ x: (p.tx + .5) * TS, y: (p.ty + .5) * TS, name: p.kind === 'rumor' ? '傳聞的地方' : p.name, key }); clearMapSel(); setMenu(null); }
  else if (t.dataset.travel) { const c = CAMPS.find(c => c.id === t.dataset.travel); if (!c || !c.lit || travelBlock()) return;
    clearMapSel(); G.lastCamp = c.id; placeAtCamp(G.me, c.id); restoreWorld(); save(); setMenu(null); G.region = ''; sfx.level(); burst(G.me.x, G.me.y - 6, 14, '#f2c14e', 40); }
});
export function toggleInv() { if (openMenu === 'inv') setMenu(null); else if (!openMenu && G.started && !G.me.dead) { G.selItem = null; renderInv(); setMenu('inv'); } }
export function toggleMap() { if (openMenu === 'map') setMenu(null); else if (!openMenu && G.started && !G.me.dead) { clearMapSel(); mapTab = 'map'; setMenu('map'); showMapTab(); centerMap(); renderBigMap(); } }
onTap($('bagBtn'), toggleInv);
onTap($('mapBtn'), toggleMap);
onTap(mini, toggleMap);
$('veil').addEventListener('click', () => setMenu(null));

