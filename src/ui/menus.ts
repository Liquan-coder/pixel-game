import { G } from '../core/state';
import { $, onTap } from '../core/util';
import { AFFIX, ICON_URL, RAR, SLOTN, UP_MAX, WT, armorStats, attachSeal, detachSeal, effOf, gearValue, itemName, slotOf } from '../data/items';
import { ACLS, ARMORS, A_UP_MAX, MAIN_BOSSES, T_SLOTS_MAX, effLines } from '../data/gear';
import type { Item } from '../types';
import { MATS, MAT_KEYS, ORE_URL } from '../data/forge';
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
import { coinChip, openMenu, setMenu, soulChip, toast } from './hud';
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
  toast('生命和藥水補滿了，野外的怪物也全部復活', '#f2c14e');
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
    body.innerHTML = '<div class="lvgrid">' + ATTRS.map(a => '<div class="statrow' + (pend[a.k] ? ' pend' : '') + '"><div class="nm">' + a.n + '</div>' +   // 一格：名字＋－數字＋ / 說明 / 下一點
      '<button type="button" class="minus" data-dec="' + a.k + '"' + (pend[a.k] ? '' : ' disabled') + ' aria-label="減少' + a.n + '">−</button>' +
      '<div class="val">' + (G.me[a.k] + pend[a.k]) + (pend[a.k] ? '<small>+' + pend[a.k] + '</small>' : '') + '</div>' +
      '<button type="button" class="plus" data-stat="' + a.k + '"' + (canAdd ? '' : ' disabled') + ' aria-label="提升' + a.n + '">+</button>' +
      '<small class="ds">' + a.d + '</small><small class="nx">下一點：' + gain(a.k) + '</small></div>').join('') + '</div>';
    body.scrollTop = keepY;
    const n = pendN(), cost = pendCost(), base = calcStats(G.me, curEq(G.me)), d = [];
    if (n) { if (now.maxHp !== base.maxHp) d.push('生命 +' + (now.maxHp - base.maxHp)); if (now.maxSt !== base.maxSt) d.push('體力 +' + (now.maxSt - base.maxSt)); if (now.atk !== base.atk) d.push('攻擊 +' + (now.atk - base.atk)); if (now.def !== base.def) d.push('防禦 +' + (now.def - base.def)); }
    foot.innerHTML = ('<div class="lvfoot">魂晶 <b class="soulv">' + (G.me.souls - cost) + '</b>' + (n ? ' <small>(−' + cost + ')</small>' : '') + '<i>|</i>等級 <b class="lvv">' + (level(G.me) + n) + '</b>' + (n ? ' <small>(+' + n + ')</small>' : '') +
      '<i>|</i>' + (free ? '免費點數 <b>' + free + '</b>' : canAdd ? '下一點 <b>' + nxtCost + '</b>' : '下一點要 ' + nxtCost + '，魂晶不夠') + (d.length ? '<span class="gain">' + d.join('、') + '</span>' : '') + '</div>') +
      '<button type="button" class="sec" data-reset' + (n ? '' : ' disabled') + '>重設</button><button type="button" class="pri" data-confirm' + (n ? '' : ' disabled') + '>確定</button>';
  } else {
    body.innerHTML = '<div class="camplist">' + CAMPS.map(c => '<button type="button" data-tp="' + c.id + '"' + (c.lit && c !== G.curCamp ? '' : ' disabled') + '><span>' + c.name + '<small> · ' + REGIONS[reg[c.ty * MW + c.tx]].name + '</small></span><small>' +
      (c === G.curCamp ? '你在這裡' : c.lit ? '傳送' : '尚未點燃') + '</small></button>').join('') + '</div><p class="hintp">靠近營火就會點燃它，之後就能傳送過去。</p>';
  }
}
$('campMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button'); if (!t) return;
  if (t.dataset.tab) { G.campTab = t.dataset.tab; clearPend(); renderCamp(); }
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
export function itemCard(it, cmp?, cls = '') {
  const R = RAR[it.rarity], sl = slotOf(it), c = cmp && cmp !== it ? cmp : null;
  const dv = (a, b) => { const d = a - b; return d > 0 ? ' <span class="up">▲' + d + '</span>' : d < 0 ? ' <span class="down">▼' + (-d) + '</span>' : ''; };
  let head = SLOTN[sl], main = '', tail = '';
  if (sl === 'weapon') { const W = WT[it.type], S = scaleOf(it), fx = fxOf(it), U = it.uq && UQ[it.uq];
    head += ' · 強化 +' + (it.up || 0) + '/' + UP_MAX + (U ? ' · 獨特' : '');
    const A = atkSplit(G.me, it), B = c && slotOf(c) === 'weapon' ? atkSplit(G.me, c) : null;            // 攻擊 = 武器本身 + 你的能力值給的；▲▼ 比總攻擊
    main = '攻擊 ' + A.base + ' <span class="bn">+ ' + A.bonus + '</span>' + (B ? dv(A.total, B.total) : '') + ' <small style="color:var(--muted)">· ' + W.trait + '</small>';
    const affs = Object.keys(it.aff || {}).map(k => '＋' + it.aff[k] + AFFIX[k].u + ' ' + AFFIX[k].n);
    tail = (affs.length ? '<div class="aff">' + affs.join('　') + '</div>' : '') +
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
  return '<div class="card' + (cls ? ' ' + cls : '') + '" style="border-color:' + R.c + '"><div class="iname" style="color:' + R.c + '"><img alt="" src="' + ICON_URL[it.type] + '">' + itemName(it) + '</div>' +
    '<div class="rar" style="color:' + R.c + '">' + head + '</div><div class="atk">' + main + '</div>' + reqLine(it) + tail + '</div>';
}
function reqLine(it) {                                                  // 需求：夠的白字、不夠的紅字
  const r = reqOf(it), ks = Object.keys(r); if (!ks.length || !G.me) return '';
  const bad = unmet(G.me, it);
  return '<div class="req">需求 ' + ks.map(k => '<b class="' + (bad.includes(k as any) ? 'no' : '') + '">' + ATTR_NAME[k] + ' ' + r[k] + '</b>').join('') + (bad.length ? '<small class="reqno">（能力值不夠，不能裝備）</small>' : '') + '</div>';
}
function statRows(now, nxt) {                                           // 屬性表；有預覽時顯示「現在 → 換上後」
  const pct = v => Math.round(v * 100) + '%';
  const rows: [string, any, ((v: number) => string)?][] = [['體力', 'maxSt'],
    ['減傷', 'defRed', pct], ['暴擊', 'crit', v => v + '%'], ['吸血', 'ls', pct], ['攻速', 'aspd', v => '+' + Math.round((v - 1) * 100) + '%'], ['冷卻縮短', 'cdr', pct]];   // 兩欄：左 體力 / 暴擊 / 攻速，右 減傷 / 吸血 / 冷卻
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
  const type = G.me.weapon.type, ranged = WT[type].ranged, ang = type === 'bow' || type === 'elfbow' ? .5 : ranged ? -Math.PI / 2 + .35 : -.9, hx = 41 * S, hy = 44.5 * S;
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
/* 左上的「選中物品」卡：圖示、名字、一行重點（換上後的變化），右邊是這件能做的事（裝備、分解、拆下刻印、卸下） */
function statDiff(now, nx) {                                            // 換上後變了什麼：攻擊 +5、暴擊 +3%
  const out = [], pct = (k: string) => k === 'ls' || k === 'aspd' || k === 'cdr' || k === 'defRed';
  for (const [n, k] of [['生命', 'maxHp'], ['攻擊', 'atk'], ['防禦', 'def'], ['體力', 'maxSt'], ['暴擊', 'crit'], ['減傷', 'defRed'], ['吸血', 'ls'], ['攻速', 'aspd'], ['冷卻', 'cdr']]) {
    const d = nx[k] - now[k]; if (Math.abs(d) < 1e-6) continue;
    const v = pct(k) ? Math.round(Math.abs(d) * 100) + '%' : k === 'crit' ? Math.abs(d) + '%' : String(Math.round(Math.abs(d)));
    out.push('<span class="' + (d > 0 ? 'up' : 'down') + '">' + n + ' ' + (d > 0 ? '+' : '−') + v + '</span>'); }
  return out.length ? out.join('，') : '<span>數值沒有變化</span>';
}
function selSummary(sel, now, pv) {
  const it = sel.it, sl = slotOf(it), r = reqOf(it), bad = sl === 'weapon' || sl === 'armor' ? unmet(G.me, it) : [];
  if (bad.length) {                                                     // 裝不上 → 不做換裝預覽：秀能力夠了之後的數值（跟身上那件比），再說差多少
    const d = (a: number, b: number) => a > b ? ' <span class="up">▲' + (a - b) + '</span>' : a < b ? ' <span class="down">▼' + (b - a) + '</span>' : '';
    const head = sl === 'weapon' ? (A => '攻擊 ' + A.total + d(A.total, atkSplit(G.me, G.me.weapon).total))(atkSplit(G.me, it)) : (A => '防禦 ' + A.def + d(A.def, armorStats(G.me.armor)?.def || 0))(armorStats(it));
    return head + ' · ' + bad.map(k => '<span class="down">' + ATTR_NAME[k] + '還差 ' + (r[k] - (G.me[k] ?? ATTR_BASE)) + ' 點</span>').join('，');
  }
  if (pv) return statDiff(now, pv);
  if (sl === 'weapon') { const A = atkSplit(G.me, it), fx = fxOf(it); return '攻擊 ' + A.total + (fx ? ' · <b style="color:' + WFXD[fx].c + '">' + WFXD[fx].n + '</b>' : '') + ' · ' + WT[it.type].trait; }
  if (sl === 'armor') { const A = armorStats(it); return '防禦 ' + A.def + ' · 生命 +' + A.hp; }
  if (sl === 'trinket') return effLines(effOf(it))[0] || '';
  return '<b style="color:' + WFXD[it.fx].c + '">' + WFXD[it.fx].n + '</b>：' + (G.me.weapon.uq ? '獨特武器不能裝刻印' : '裝到武器上');
}
let salvArm = 0, salvAllArm = false;                                     // 分解要按兩次（強化過 / 刻印 / 獨特的那種）
function selActs(sel) {
  const it = sel.it, sl = slotOf(it), b = (act: string, label: string, cls = '', dis = false) => '<button type="button" class="sact ' + cls + '" data-act="' + act + '"' + (dis ? ' disabled' : '') + '>' + label + '</button>';
  const full = G.me.inv.length >= 24, out = [];
  if (sel.where === 'bag') {
    if (sl === 'seal') out.push(b('equip', '裝上', 'pri', !!G.me.weapon.uq));
    else out.push(b('equip', sl !== 'trinket' && unmet(G.me, it).length ? '能力不夠' : '裝備', 'pri', sl !== 'trinket' && unmet(G.me, it).length > 0));
    out.push(b('salv', salvArm === it.id ? '確定分解？' : '分解 +' + salvValue(it), 'warn'));
  } else if (sl === 'weapon') { if (sealOn(it)) out.push(b('unseal', full ? '背包滿了' : '拆下刻印', 'warn', full)); }
  else out.push(b('uneq', full ? '背包滿了' : '卸下', '', full));
  out.push(b('cancel', '取消'));
  return '<div class="sacts">' + out.join('') + '</div>';
}
export function renderInv() {
  $('invCount').textContent = G.me.inv.length + '/24'; $('invGold').innerHTML = coinChip(G.me.gold); $('invSouls').innerHTML = soulChip(G.me.souls);
  const eq = curEq(G.me), sel = selected(), bagIt = sel && sel.where === 'bag' ? sel.it : null, nSlots = tSlots();
  // 左欄：上面是選中的物品（有選才出現）＋ 按鈕；下面一直是角色數值（選了背包的東西 → 顯示換上後的變化）
  const info = $('cInfo'), keepY = info.querySelector('.cscroll')?.scrollTop || 0;
  const now = calcStats(G.me, eq), sl = sel ? slotOf(sel.it) : '', pv = bagIt && sl !== 'seal' && !(sl !== 'trinket' && unmet(G.me, bagIt).length) ? calcStats(G.me, eqWith(bagIt)) : null;
  if (sel && salvArm && salvArm !== sel.it.id) salvArm = 0;
  if (!sel || sel.it.id !== lastSelId) infoMode = false;                  // 換選別件 → 回到數值
  const R = sel ? RAR[sel.it.rarity] : null, U = sel && sel.it.uq;
  const head = sel ? '<div class="selcard" style="border-color:' + R.c + '"><button type="button" class="sico' + (infoMode ? ' on' : '') + '" data-act="info" aria-label="說明"><img alt="" src="' + ICON_URL[sel.it.type] + '"><i>' + (infoMode ? '↩' : '?') + '</i></button><div class="selmid"><div class="selname"><b style="color:' + R.c + '">' + itemName(sel.it) + '</b><i>' + (U ? '獨特' : SLOTN[sl]) + '</i></div>' +
    '<div class="selsum">' + selSummary(sel, now, pv) + '</div>' + (infoMode ? '' : reqLine(sel.it)) + '</div>' + selActs(sel) + '</div>' : '';
  info.innerHTML = head + '<div class="cscroll">' + (sel && infoMode ? itemCard(sel.it, null, 'det') :   // 「說明」：這件的刻印、技能、需求、背景故事（取代下面的數值，不用往下捲）
    '<div class="keystats">' + keyTile('hp', '生命', 'maxHp', now, pv) + keyTile('atk', '攻擊', 'atk', now, pv) + keyTile('df', '防禦', 'def', now, pv) + '</div>' +
    '<div class="cbox"><div class="lbl">詳細屬性</div><div class="stattbl">' + statRows(now, pv) + '</div></div>' +
    '<div class="cbox"><div class="lbl">能力值<small class="lvhint">在營火用魂晶升級</small></div><div id="attrList">' + ATTRS.map(a => '<div class="attr" title="' + a.d + '"><span>' + a.n + '</span><div class="bar2"><i style="width:' + Math.min(100, G.me[a.k] / 40 * 100) + '%"></i></div><b>' + G.me[a.k] + '</b></div>').join('') + '</div></div>') + '</div>';
  const sc = info.querySelector('.cscroll'); if (sc && sel && sel.it.id === lastSelId) sc.scrollTop = keepY; lastSelId = sel ? sel.it.id : null;
  $('dollLv').textContent = 'Lv ' + level(G.me); drawDoll();
  // 中間：武器、防具、4 個飾品欄（還沒開放的鎖著）
  const drop = dropTargets(sel, nSlots);
  const slotBtn = (it: Item | null, key: string, label: string, locked = false) => locked
    ? '<div class="eqslot lock" title="打倒更多主線 Boss 解鎖"><div class="ph0">🔒</div><small>' + label + '</small><span>未開放</span></div>'
    : '<button type="button" class="eqslot' + (it && G.selItem === it.id ? ' sel' : '') + (drop.has(key) ? ' drop' : '') + (sealOn(it) ? ' sl' : '') + (it && unmet(G.me, it).length ? ' bad' : '') + '" data-eq="' + key + '"' + (it ? ' style="border-color:' + RAR[it.rarity].c + '"' : '') + '>' +
      (it ? '<img alt="" src="' + ICON_URL[it.type] + '">' + sealBadge(it) : '<div class="ph0">＋</div>') + '<small>' + label + '</small><span' + (it ? ' style="color:' + RAR[it.rarity].c + '"' : '') + '>' + (it ? itemName(it) : '空') + '</span></button>';
  $('eqSlots').innerHTML = slotBtn(eq.weapon, 'weapon', '武器') + slotBtn(eq.armor, 'armor', '防具') + '<div class="eqgap"></div>' +
    [0, 1, 2, 3].map(i => slotBtn(eq.trinkets[i], 't' + i, '飾品 ' + (i + 1), i >= nSlots)).join('');
  // 右邊：背包（或素材清單）
  for (const b of document.querySelectorAll<HTMLElement>('#bagTabs button')) b.classList.toggle('on', b.dataset.f === bagFilter);
  const n = salvAllN(), sb = $('salvAll') as HTMLButtonElement; sb.hidden = !n; sb.classList.toggle('arm', salvAllArm);   // 一鍵分解：右上角，有東西可分解才出現
  sb.textContent = salvAllArm ? '確定分解 ' + n + ' 件？' : '一鍵分解 ' + n;
  if (bagFilter === 'mat') { $('bagGrid').innerHTML = '<div class="matlist">' + MAT_KEYS.map(k => '<div class="matrow"><img alt="" src="' + ORE_URL[k] + '"><span style="color:' + MATS[k].c + '">' + MATS[k].n + '<small>' + MATS[k].d + '</small></span><b>' + (G.me.mats[k] || 0) + '</b></div>').join('') + '</div>'; return; }
  const list = G.me.inv.map((it, i) => ({ it, i })).filter(o => bagFilter === 'all' || slotOf(o.it) === bagFilter);
  const cells = list.map(({ it, i }) => '<button type="button" class="slot' + (G.selItem === it.id ? ' sel' : '') + (unmet(G.me, it).length ? ' bad' : '') + (sealOn(it) ? ' sl' : '') + '" data-i="' + i + '" style="border-color:' + RAR[it.rarity].c + '" aria-label="' + it.name + '"><img alt="" src="' + ICON_URL[it.type] + '">' + sealBadge(it) + '<i style="color:' + RAR[it.rarity].c + '">' + badge(it) + '</i></button>');
  const blank = drop.has('bag') ? '<button type="button" class="slot blank drop" data-drop="1" aria-label="卸下"></button>' : '<div class="slot blank"></div>';
  if (bagFilter === 'all') while (cells.length < 24) cells.push(blank);   // 空格子也畫出來，一眼看出背包還剩多少
  else if (drop.has('bag')) cells.push(blank);                                // 篩選中：多放一個空格讓你卸下
  $('bagGrid').innerHTML = cells.length ? cells.join('') : '<div class="empty">這一類還沒有東西。</div>';
}
let lastSelId = null, infoMode = false;                                 // infoMode = 左欄顯示物品說明（不是數值）
/* 點一下選、再點目標放進去：選了背包裡的東西 → 能放的欄位發亮；選了身上的防具 / 飾品 → 背包空格發亮（卸下） */
const canUnequip = (sel) => !!sel && sel.where === 'eq' && sel.slot !== 'weapon' && G.me.inv.length < 24;   // 武器不能空手
function dropTargets(sel, nSlots: number) {
  const out = new Set<string>(); if (!sel) return out;
  if (sel.where === 'bag') { const sl = slotOf(sel.it);
    if (sl === 'weapon' || sl === 'armor') out.add(sl);
    else if (sl === 'trinket') for (let i = 0; i < nSlots; i++) out.add('t' + i);
    else if (sl === 'seal' && !G.me.weapon.uq) out.add('weapon'); }
  else if (canUnequip(sel)) out.add('bag');
  return out;
}
/* 武器右上角的小刻印：裝了哪種刻印（外框是那種刻印的顏色）。獨特武器的效果是本身的，不算 */
const sealOn = (it: Item | null) => !!it && slotOf(it) === 'weapon' && !!it.fx && !it.uq;
const sealBadge = (it: Item) => sealOn(it) ? '<img class="sealb" alt="" title="' + WFXD[it.fx].n + '刻印" src="' + ICON_URL.seal + '" style="border-color:' + WFXD[it.fx].c + '">' : '';
const salvValue = it => Math.round(3 * gearValue(it) * (slotOf(it) === 'weapon' ? .5 : 1));
const junk = (it: Item) => { const sl = slotOf(it); return (sl === 'weapon' || sl === 'armor') && it.rarity === 0 && !it.up; };   // 一鍵分解的對象：沒強化、沒刻印的一般武器 / 防具
const salvAllN = () => G.me.inv.filter(junk).length;
const precious = (it: Item) => !!(it.up || it.uq || it.ug || it.rarity >= 3);   // 分解前要再按一次確認
export const badge = it => (slotOf(it) === 'weapon' || slotOf(it) === 'armor') && it.up ? '+' + it.up : '';    // 背包格子左上角的小字：強化等級
export const matLine = () => MAT_KEYS.map(k => '<span title="' + MATS[k].d + '" style="color:' + MATS[k].c + '">' + MATS[k].n + ' <b>' + (G.me.mats[k] || 0) + '</b></span>').join('');
$('invMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button'); if (!t || (t as HTMLButtonElement).disabled) return;
  if (t.id !== 'salvAll') salvAllArm = false;
  if (t.hasAttribute('data-close')) { setMenu(null); return; }
  if (t.dataset.i !== undefined) { const it = G.me.inv[+t.dataset.i]; G.selItem = it && G.selItem !== it.id ? it.id : null; salvArm = 0; renderInv(); return; }
  if (t.dataset.f) { bagFilter = t.dataset.f; renderInv(); return; }
  const sel = selected(), done = () => { recalc(G.me); G.selItem = null; salvArm = 0; sfx.pick(); renderInv(); save(); };
  const put = (k: string) => {                                                         // 把選著的背包物品放進欄位 k
    const it = sel.it, sl = slotOf(it), idx = G.me.inv.indexOf(it);
    if (sl === 'seal') { const w = G.me.weapon; if (w.uq) return; G.me.inv.splice(idx, 1); const old = attachSeal(w, it); if (old) G.me.inv.push(old); toast('「' + itemName(w) + '」裝上了' + it.name, '#c475ff'); return done(); }
    if (sl !== 'trinket' && unmet(G.me, it).length) { toast('能力值不夠，還不能裝備', '#ff8a8a'); return; }
    if (sl === 'trinket') { const ti = +k.slice(1), old = G.me.trinkets[ti]; G.me.inv.splice(idx, 1, ...(old ? [old] : [])); G.me.trinkets[ti] = it; }
    else { const old = G.me[sl]; G.me.inv.splice(idx, 1, ...(old ? [old] : [])); G.me[sl] = it; }   // 換下來的放回原本那一格
    return done(); };
  if (t.dataset.act && sel) { const a = t.dataset.act, it = sel.it;
    if (a === 'cancel') { G.selItem = null; salvArm = 0; renderInv(); return; }
    if (a === 'info') { infoMode = !infoMode; renderInv(); return; }
    if (a === 'equip' && sel.where === 'bag') { const sl = slotOf(it);                // 「裝備」按鈕：飾品放第一個空的欄位（都滿了就換掉第 1 格）
      if (sl === 'trinket') { const n = tSlots(), k = G.me.trinkets.slice(0, n).findIndex(x => !x); return put('t' + (k >= 0 ? k : 0)); }
      return put(sl === 'seal' ? 'weapon' : sl); }
    if (a === 'salv' && sel.where === 'bag') { if (precious(it) && salvArm !== it.id) { salvArm = it.id; renderInv(); return; }
      G.me.inv.splice(G.me.inv.indexOf(it), 1); G.me.souls += salvValue(it); toast('分解獲得 ' + salvValue(it) + ' 魂晶', '#b49cff'); return done(); }
    if (a === 'unseal' && sealOn(it) && G.me.inv.length < 24) { const s2 = detachSeal(it); if (s2) G.me.inv.push(s2); toast('拆下了' + (s2 ? s2.name : '刻印'), '#c475ff'); return done(); }
    if (a === 'uneq' && canUnequip(sel)) { if (sel.slot === 'armor') G.me.armor = null; else G.me.trinkets[sel.ti] = null; G.me.inv.push(it); return done(); }
    return; }
  if (t.dataset.eq) { const k = t.dataset.eq;
    if (sel && sel.where === 'bag' && dropTargets(sel, tSlots()).has(k)) return put(k);   // 選著背包裡的東西 → 放進這一格
    const it = k === 'weapon' ? G.me.weapon : k === 'armor' ? G.me.armor : G.me.trinkets[+k.slice(1)];
    G.selItem = it && G.selItem !== it.id ? it.id : null; salvArm = 0; renderInv(); return; }
  if (t.dataset.drop && canUnequip(sel)) {                                            // 選著身上的防具 / 飾品 → 點背包空格 = 卸下
    if (sel.slot === 'armor') G.me.armor = null; else G.me.trinkets[sel.ti] = null; G.me.inv.push(sel.it); return done(); }
  if (t.id === 'salvAll') {                                                           // 一鍵分解（按兩次）：沒強化、沒刻印的一般武器 / 防具
    if (!salvAllArm) { salvAllArm = true; renderInv(); return; }
    salvAllArm = false; let s = 0; G.me.inv = G.me.inv.filter(it => { if (junk(it)) { s += salvValue(it); return false; } return true; });
    G.me.souls += s; if (s) { toast('分解獲得 ' + s + ' 魂晶', '#b49cff'); sfx.pick(); } G.selItem = null; renderInv(); save(); }
});
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
onTap(mini, toggleMap);
$('veil').addEventListener('click', () => setMenu(null));

