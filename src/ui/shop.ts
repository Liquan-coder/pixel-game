import { G } from '../core/state';
import { $, clamp, pick, ri } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { COIN_SP, DROP_WEAPONS, UP_MAX, ICON_URL, MERCH_SP, RAR, SLOTN, armorStats, gearValue, itemName, makeArmor, makeSeal, makeTrinket, makeWeapon, slotOf } from '../data/items';
import { A_UP_MAX, ARMOR_BASIC, ARMOR_BUILD, ARMOR_REGION, TRINKET_KEYS } from '../data/gear';
import { FX_KEYS } from '../game/weaponFx';
import { MATS, ORE_URL, PAGES, PAGE_URL, REGION_MAT, atkAt, canUpgrade, doUpgrade, hasPage, maxUp, upCost } from '../data/forge';
import type { MatKey } from '../data/forge';
import { recalc } from '../game/player';
import { atkSplit } from '../data/attrs';
import { CAMPS, MW, reg } from '../world/map';
import { drawArtSprite } from '../world/chunks';
import { collides } from '../game/collision';
import { sfx } from '../core/audio';
import { drawShadow } from '../render/player';
import { setMenu, toast } from './hud';
import { badge, itemCard, matLine } from './menus';
import { save } from '../game/save';
import type { Item } from '../types';

export let merchant = null, shopTab = 'buy', shopSel = null, vendor = null;   // vendor = 現在打開的店（流浪商人或鎮上的鐵匠）
const isW = it => slotOf(it) === 'weapon';
const itemPrice = it => Math.round(6 * gearValue(it));
const sellPrice = it => gearValue(it);                                  // 比分解換到的魂晶少一些
type Stock = { kind: string; price: number; left?: number; item?: Item; mat?: MatKey; sold?: boolean; pg?: number };
const oreRow = (mat: MatKey, price: number, left: number): Stock => ({ kind: 'ore', mat, price, left, pg: REGION_MAT.indexOf(mat) });   // pg = 要先打倒哪個地區的地城守護者才會賣
const shown = (o: Stock) => o.kind !== 'ore' || hasPage(o.pg);         // 素材：探索過那個地區的地城才擺出來（貨先產生好，打完地城回來就看得到）
function merchantSpot(c) { for (const [ox, oy] of [[42, 6], [-42, 6], [0, 42], [30, -30], [-30, -30]]) { const x = c.x + ox, y = c.y + oy; if (!collides(x, y, 7)) return [x, y]; } return [c.x + 20, c.y + 20]; }
const REG_KEYS = ['plains', 'forest', 'wastes', 'lava', 'den', 'snow', 'swamp', 'dungeon', 'elf'];   // reg 編號 → 地區（跟 world/map.ts 的 REGIONS 同順序）
function stockItem(it: Item, mul = 1): Stock { return { kind:'item', item:it, price:Math.round(itemPrice(it) * mul) }; }
function rollStock(c) {
  const R0 = reg[c.ty * MW + c.tx], deep = Math.min(4, [0, 1, 2, 3, 1, 4, 4, 0, 3][R0] ?? 0), rg = REG_KEYS[R0] || 'plains', st: Stock[] = [{ kind:'pot', price:25 }];
  if (G.potMax < 8) st.push({ kind:'potUp', price:250 * (G.potMax - 2), left:1 });
  st.push({ kind:'tear', price:1000, left:1 });                           // 重生水滴：每批一顆
  st.push(oreRow('mat1', 90, 4)); if (deep >= 1) st.push(oreRow('mat2', 220, 3));                   // 流浪商人：少量前期素材（後面的要自己去打）
  st.push(stockItem(makeWeapon(pick(DROP_WEAPONS))), stockItem(makeArmor(Math.random() < .2 ? pick(ARMOR_BUILD) : ARMOR_REGION[rg] && Math.random() < .6 ? ARMOR_REGION[rg] : pick(ARMOR_BASIC))));
  st.push(stockItem(makeTrinket(pick(TRINKET_KEYS))), stockItem(makeTrinket(pick(TRINKET_KEYS))));
  if (Math.random() < .5) st.push(stockItem(makeSeal(pick(FX_KEYS)), 1.5));
  return st;
}
export function placeMerchant(id, stock?) { const c = CAMPS.find(c => c.id === id) || CAMPS[0], [x, y] = merchantSpot(c); merchant = { camp:c.id, x, y, stock: stock || rollStock(c) }; }
/* 鐵匠：只賣武器和防具，貨比較好（稀有以上），每次休息換一批 */
export function rollSmith(lv) {
  const st: Stock[] = [{ kind:'pot', price:25 }];                     // 鐵匠的素材：打倒那個地區的地城守護者之後才賣，數量有限、休息才補
  ([[70, 8], [180, 6], [420, 5], [700, 4], [1000, 3], [1400, 3]] as const).forEach(([pr, n], i) => st.push(oreRow(REGION_MAT[i], pr, n)));
  for (let i = 0; i < 3; i++) st.push(stockItem(makeWeapon(pick(DROP_WEAPONS), 0, Math.random() < .2 ? pick(FX_KEYS) : undefined), 1.1));
  for (const k of ARMOR_BASIC) st.push(stockItem(makeArmor(k), 1.1));
  if (lv >= 50) st.push(stockItem(makeArmor(lv >= 62 ? 'fur' : 'ember'), 1.1));
  return st;
}
export function moveMerchant() {
  const lit = CAMPS.filter(c => c.lit && (!merchant || c.id !== merchant.camp)), c = lit.length ? pick(lit) : CAMPS.find(c => c.id === (merchant ? merchant.camp : 'start'));
  placeMerchant(c.id);
}
export const nearMerchant = () => merchant && !G.me.dead && Math.abs(merchant.x - G.me.x) < 26 && Math.hypot(merchant.x - G.me.x, merchant.y - G.me.y) < 26;
export function drawMerchant() {
  const m = merchant, bob = Math.floor(G.time * 2) % 2 ? HK : 0;
  drawShadow(m.x, m.y + 1, 14); drawArtSprite(MERCH_SP, m.x, m.y + 3 - bob);
  if (nearMerchant() || Math.floor(G.time * 1.5) % 3 === 0) { const sp = COIN_SP[Math.floor(G.time * 8) % 4]; ctx.drawImage(sp, snapF(m.x - sp.width * HK / 2), snapF(m.y - 24 + Math.sin(G.time * 4)), sp.width * HK, sp.height * HK); }
}
export function openShop(v?) { vendor = v || merchant; if (!vendor.stock) vendor.stock = rollSmith(vendor.lv); $('shopName').textContent = vendor.name || '流浪商人'; shopTab = vendor.smith ? 'forge' : 'buy'; shopSel = null; renderShop(); setMenu('shop'); }   // 鐵匠一打開就是「強化」（大多數人來找鐵匠就是要強化）
function shopRow(icon, name, sub, price, col, key, dis) {
  return '<button type="button" class="shoprow' + (shopSel === key ? ' sel' : '') + '" data-s="' + key + '"' + (dis ? ' disabled' : '') + '><img alt="" src="' + ICON_URL[icon] + '"><span style="color:' + (col || 'var(--text)') + '">' + name + '<small>' + sub + '</small></span><b class="pr">' + price + '</b></button>';
}
function setFoot(btn, name) { const f = $('shopFoot'); f.hidden = !btn; f.innerHTML = btn ? '<span class="lvfoot">' + (name || '') + '</span>' + btn : ''; }
function oreShopRow(o: Stock, i: number) {
  const M = MATS[o.mat];
  return '<button type="button" class="shoprow' + (shopSel === i ? ' sel' : '') + '" data-s="' + i + '"' + (o.left ? '' : ' disabled') + '><img alt="" src="' + ORE_URL[o.mat] + '"><span style="color:' + M.c + '">' + M.n + '<small>' + M.d + ' · 剩 ' + o.left + ' 個 · 身上 ' + (G.me.mats[o.mat] || 0) + '</small></span><b class="pr">' + o.price + '</b></button>';
}
/* ---- 鐵匠的「強化」分頁：先選一件裝備（清單）→ 點進去才是詳細頁：左右對照「現在 / 強化後」+ 下面列素材、還缺多少 ---- */
function forgeList() { return [G.me.weapon, G.me.armor, ...G.me.inv.filter(it => isW(it) || slotOf(it) === 'armor')].filter(Boolean); }
const COIN_URL = (() => { const c = COIN_SP[0], q = document.createElement('canvas'); q.width = q.height = 32; const g = q.getContext('2d');
  g.imageSmoothingEnabled = false; g.drawImage(c, 4, 4, 24, 24); try { return q.toDataURL(); } catch (e) { return ''; } })();
/** 某個強化等級的數值：武器 = 你拿起來的總攻擊（含能力值加成）+ 武器本身；防具 = 防禦、生命 */
function gearStats(w: Item, up: number): [string, number][] {
  if (isW(w)) { const base = atkAt(w, up); return [['攻擊力', atkSplit(G.me, w, base).total], ['武器本身', base]]; }
  const a = armorStats({ ...w, up }); return [['防禦', a.def], ['生命', a.hp]];
}
let justUp = 0;                                                          // 剛強化完的那一件：左邊（現在的等級）的卡片閃一下
/* 詳細頁：左 = 這件裝備（大圖示、+2 ▶ +3、數值 現在 → 之後）；右 = 強化需求（點一列看線索）+ 大按鈕（不能強化時寫原因） */
function forgeLeft(w: Item, up: number, next: boolean, flash: string) {
  const a = gearStats(w, up), b = next ? gearStats(w, up + 1) : null;
  return '<div class="fleft"><div class="fhead"><button type="button" class="sbtn" data-fback>‹ 換一件</button><span style="color:' + RAR[w.rarity].c + '">' + itemName(w) + '</span></div>' +
    '<div class="fbig' + flash + '"><img alt="" src="' + ICON_URL[w.type] + '"></div>' +
    '<div class="fpill">+' + up + (next ? '<i>▶</i><b>+' + (up + 1) + '</b>' : '<small>最高</small>') + '</div>' +
    '<div class="ftbl">' + a.map(([n, v], i) => '<div><span>' + n + '</span><b>' + v + (b ? '<i>→</i><em>' + b[i][1] + '</em><small>(+' + (b[i][1] - v) + ')</small>' : '') + '</b></div>').join('') + '</div></div>';
}
type Need = { k: string; icon: string; name: string; col: string; ok: boolean; val: string; clue: string };
function needs(w: Item, c): Need[] {
  const out: Need[] = [], M = MATS[c.mat], have = G.me.mats[c.mat] || 0;
  if (c.page >= 0) { const ok = hasPage(c.page); out.push({ k: 'page', icon: PAGE_URL, name: '古代鍛造圖・' + PAGES[c.page].n, col: '#e8d8b0', ok, val: ok ? '✓ 已取得' : '✗ 未取得', clue: ok ? '已經找到了，鐵匠看得懂上面寫的' : '還沒找到，據說藏在地城的深處' }); }
  const ri = REGION_MAT.indexOf(c.mat), sold = ri >= 0 && hasPage(ri);
  out.push({ k: 'mat', icon: ORE_URL[c.mat], name: M.n, col: M.c, ok: have >= c.n, val: have + ' / ' + c.n,
    clue: M.d.split(' · ')[0] + '會掉' + (c.mat === 'umat' ? '，買不到' : sold ? '，鐵匠這裡也有賣' : '') });
  out.push({ k: 'gold', icon: COIN_URL, name: '金幣', col: 'var(--gold)', ok: G.me.gold >= c.gold, val: G.me.gold + ' / ' + c.gold, clue: '打倒怪物、把用不到的東西賣給商人' });
  return out;
}
let clueK = '';                                                          // 右上角顯示哪一列的線索（點一列切換）
function renderForge(body: HTMLElement) {
  const list = forgeList(), sel = list.find(w => w.id === shopSel) || null;
  if (!sel) {                                                            // 第一層：選裝備
    shopSel = null;
    const rows = list.map(w => { const c = upCost(w.up || 0, w), [[n, v]] = gearStats(w, w.up || 0), ok = c && canUpgrade(G.me, w), locked = c && c.page >= 0 && !hasPage(c.page);
      return '<button type="button" class="shoprow" data-fw="' + w.id + '"><img alt="" src="' + ICON_URL[w.type] + '"><span style="color:' + RAR[w.rarity].c + '">' + itemName(w) + (w === G.me.weapon || w === G.me.armor ? ' <small style="display:inline">（裝備中）</small>' : '') +
        '<small>' + n + ' ' + v + '</small></span><b class="pr' + (ok ? ' fok' : ' fno') + '">' + (!c ? '最高' : ok ? '可以強化' : locked ? '需要鍛造圖' : '素材不足') + '</b></button>'; });
    body.innerHTML = '<div class="matline" style="margin:0 0 8px">' + matLine() + '</div><div class="shoplist">' + (rows.join('') || '<div class="empty">沒有可以強化的裝備。</div>') + '</div>' +
      '<p class="hintp">武器每 +1 攻擊多 32%，最高 +' + UP_MAX + '；防具每 +1 防禦和生命多 15%，最高 +' + A_UP_MAX + '。素材是各地區的怪物掉的；更高的強化要先找到古代的鍛造圖。獨特武器只能用黯星石強化。</p>';
    setFoot('', ''); return;
  }
  const up = sel.up || 0, c = upCost(up, sel), flash = justUp === sel.id ? ' flash' : ''; justUp = 0;   // 第二層：這一件的強化頁
  setFoot('', '');
  if (!c) { body.innerHTML = '<div class="fgrid one">' + forgeLeft(sel, up, false, flash) + '</div><p class="fmax">已經強化到最高（+' + maxUp(sel) + '）</p>'; return; }
  const N = needs(sel, c), lack = N.find(n => !n.ok), cur = N.find(n => n.k === clueK) || lack || N[0];
  const why = !lack ? '強化到 +' + (up + 1) : lack.k === 'page' ? '缺少古代鍛造圖' : lack.k === 'mat' ? MATS[c.mat].n + '不夠' : '金幣不夠';
  body.innerHTML = '<div class="fgrid">' + forgeLeft(sel, up, true, flash) +
    '<div class="fright"><div class="fneedh">強化需求<small>點一項看線索</small></div><div class="fclue">' + cur.clue + '</div><div class="fneeds">' +
    N.map(n => '<button type="button" class="fneed' + (n.ok ? '' : ' lack') + (n === cur ? ' on' : '') + '" data-clue="' + n.k + '"><img alt="" src="' + n.icon + '"><span style="color:' + n.col + '">' + n.name + '</span><b>' + n.val + '</b></button>').join('') +
    '</div><button type="button" class="pri fgo" data-forge="' + sel.id + '"' + (lack ? ' disabled' : '') + '>' + why + '</button></div></div>';
}
function renderShop() {
  $('shopGold').textContent = '金幣 ' + G.me.gold;
  $('forgeTab').hidden = !vendor.smith; if (!vendor.smith && shopTab === 'forge') shopTab = 'buy';
  if (shopTab === 'forge') { for (const b of document.querySelectorAll<HTMLElement>('#shopMenu .tabs button')) b.classList.toggle('on', b.dataset.stab === shopTab); renderForge($('shopBody')); return; }
  for (const b of document.querySelectorAll<HTMLElement>('#shopMenu .tabs button')) b.classList.toggle('on', b.dataset.stab === shopTab);
  const body = $('shopBody');
  if (shopTab === 'buy') {
    const rows = vendor.stock.map((o, i) => !shown(o) ? '' : o.kind === 'pot' ? shopRow('potion', '藥水', '補 1 瓶（目前 ' + G.me.pot + '/' + G.potMax + '）', o.price, null, i, G.me.pot >= G.potMax)
      : o.kind === 'potUp' ? shopRow('potUp', '藥水上限 +1', '剩 ' + o.left + ' 個 · 永久增加', o.price, '#f2c14e', i, !o.left || G.potMax >= 8)
      : o.kind === 'tear' ? shopRow('tear', '重生水滴', '剩 ' + o.left + ' 個 · 在營火重新分配能力值', o.price, '#9ae8ff', i, !o.left)
      : o.kind === 'ore' ? oreShopRow(o, i)
      : shopRow(o.item.type, itemName(o.item), SLOTN[slotOf(o.item)] + (o.item.fx && isW(o.item) ? ' · 帶刻印' : ''), o.sold ? '售出' : o.price, RAR[o.item.rarity].c, i, o.sold));
    const o = vendor.stock[shopSel] && shown(vendor.stock[shopSel]) ? vendor.stock[shopSel] : null;
    let det = '', act = '';                                             // det = 商品卡（在捲動區裡），act = 買下按鈕（固定在底部）
    if (o && o.kind === 'item' && !o.sold) { det = itemCard(o.item, slotOf(o.item) === 'trinket' || slotOf(o.item) === 'seal' ? null : G.me[slotOf(o.item)]); act = '<button type="button" class="pri" data-buy="' + shopSel + '"' + (G.me.gold < o.price || G.me.inv.length >= 24 ? ' disabled' : '') + '>買下（' + o.price + ' 金幣）</button>'; }
    else if (o && o.kind !== 'item') act = '<button type="button" class="pri" data-buy="' + shopSel + '"' + (G.me.gold < o.price ? ' disabled' : '') + '>買下（' + o.price + ' 金幣）</button>';
    body.innerHTML = '<div class="shoplist">' + rows.join('') + '</div><div id="shopDet" style="margin-top:8px">' + det + '</div><p class="hintp">商品會在你下次休息時刷新，商人也會走到別的營火。地區越深入，賣的裝備越好。</p>';
    setFoot(act, o && o.kind === 'item' && o.item.name);
  } else {
    const it = G.me.inv.find(x => x.id === shopSel);
    body.innerHTML = (G.me.inv.length ? '<div class="baggrid">' + G.me.inv.map(x => '<button type="button" class="slot' + (shopSel === x.id ? ' sel' : '') + '" data-sid="' + x.id + '" style="border-color:' + RAR[x.rarity].c + '"><img alt="" src="' + ICON_URL[x.type] + '"><i style="color:' + RAR[x.rarity].c + '">' + badge(x) + '</i></button>').join('') + '</div>'
      : '<div class="empty">背包是空的。</div>') + (it ? '<div style="margin-top:8px">' + itemCard(it, slotOf(it) === 'trinket' || slotOf(it) === 'seal' ? null : G.me[slotOf(it)]) + '</div>' : '') +
      '<p class="hintp">賣給商人拿金幣；在角色面板分解則是拿魂晶（數量比較多）。</p>';
    setFoot(it ? '<button type="button" class="pri" data-sell="' + it.id + '">賣出（+' + sellPrice(it) + ' 金幣）</button>' : '', it && it.name);
  }
}
$('shopMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button'); if (!t || (t as HTMLButtonElement).disabled) return;
  if (t.hasAttribute('data-close')) { setMenu(null); return; }
  if (t.dataset.stab) { shopTab = t.dataset.stab; shopSel = null; renderShop(); return; }
  if (t.dataset.s !== undefined) { shopSel = +t.dataset.s === shopSel ? null : +t.dataset.s; renderShop(); return; }
  if (t.dataset.sid) { shopSel = +t.dataset.sid === shopSel ? null : +t.dataset.sid; renderShop(); return; }
  if (t.dataset.fw) { shopSel = +t.dataset.fw; clueK = ''; renderShop(); $('shopBody').scrollTop = 0; return; }
  if (t.hasAttribute('data-fback')) { shopSel = null; clueK = ''; renderShop(); return; }
  if (t.dataset.clue) { clueK = t.dataset.clue; renderShop(); return; }
  if (t.dataset.forge) { const w = forgeList().find(w => w.id === +t.dataset.forge); if (!w || !doUpgrade(G.me, w)) return;
    if (w === G.me.weapon || w === G.me.armor) recalc(G.me); justUp = w.id; sfx.level(); toast('強化成功：' + itemName(w), '#f2c14e'); renderShop(); save(); return; }
  if (t.dataset.buy !== undefined) { const o = vendor.stock[+t.dataset.buy]; if (!o || G.me.gold < o.price) return; const price = o.price;   // 先記下價格：藥水上限買完會漲價，扣的要是買的那一刻的價格
    if (o.kind === 'pot') { if (G.me.pot >= G.potMax) return; G.me.pot++; }
    else if (o.kind === 'potUp') { if (!o.left || G.potMax >= 8) return; o.left--; G.potMax++; G.me.pot++; o.price = 250 * (G.potMax - 2); toast('藥水上限 +1（現在 ' + G.potMax + ' 瓶）', '#f2c14e'); }
    else if (o.kind === 'tear') { if (!o.left) return; o.left--; G.me.tears = (G.me.tears || 0) + 1; toast('重生水滴 +1（在營火的升級畫面使用）', '#9ae8ff'); }
    else if (o.kind === 'ore') { if (!o.left) return; o.left--; G.me.mats[o.mat] = (G.me.mats[o.mat] || 0) + 1; toast(MATS[o.mat].n + ' +1', MATS[o.mat].c); }
    else { if (o.sold || G.me.inv.length >= 24) return; o.sold = true; G.me.inv.push(o.item); toast('買到 ' + o.item.name, RAR[o.item.rarity].c); shopSel = null; }
    G.me.gold -= price; sfx.buy(); renderShop(); save(); return; }
  if (t.dataset.sell) { const i = G.me.inv.findIndex(x => x.id === +t.dataset.sell); if (i < 0) return; const it = G.me.inv.splice(i, 1)[0];
    G.me.gold += sellPrice(it); sfx.coin(); shopSel = null; renderShop(); save(); }
});
