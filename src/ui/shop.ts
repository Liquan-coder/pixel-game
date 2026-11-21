import { G } from '../core/state';
import { $, clamp, pick, ri } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { COIN_SP, DROP_WEAPONS, ICON_URL, MERCH_SP, RAR, SLOTN, armorStats, gearValue, itemName, makeArmor, makeSeal, makeTrinket, makeWeapon, slotOf } from '../data/items';
import { ARMOR_BASIC, ARMOR_BUILD, ARMOR_REGION, TRINKET_KEYS } from '../data/gear';
import { FX_KEYS } from '../game/weaponFx';
import { MATS, ORE_URL, atkAt, canUpgrade, doUpgrade, maxUp, upCost } from '../data/forge';
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
type Stock = { kind: string; price: number; left?: number; item?: Item; mat?: MatKey; sold?: boolean };
const oreRow = (mat: MatKey, price: number, left: number): Stock => ({ kind: 'ore', mat, price, left });
function merchantSpot(c) { for (const [ox, oy] of [[42, 6], [-42, 6], [0, 42], [30, -30], [-30, -30]]) { const x = c.x + ox, y = c.y + oy; if (!collides(x, y, 7)) return [x, y]; } return [c.x + 20, c.y + 20]; }
const REG_KEYS = ['plains', 'forest', 'wastes', 'lava', 'den', 'snow', 'swamp'];   // reg 編號 → 地區（跟 world/map.ts 的 REGIONS 同順序）
function stockItem(it: Item, mul = 1): Stock { return { kind:'item', item:it, price:Math.round(itemPrice(it) * mul) }; }
function rollStock(c) {
  const R0 = reg[c.ty * MW + c.tx], deep = Math.min(4, [0, 1, 2, 3, 1, 4, 4][R0] ?? 0), rg = REG_KEYS[R0] || 'plains', st: Stock[] = [{ kind:'pot', price:25 }];
  if (G.potMax < 8) st.push({ kind:'potUp', price:250 * (G.potMax - 2), left:1 });
  st.push({ kind:'tear', price:1000, left:1 });                           // 重生水滴：每批一顆
  st.push(oreRow('mat1', 80, 5)); if (deep >= 1) st.push(oreRow('mat2', 200, 3));                   // 流浪商人：少量前期素材（後面的要自己去打）
  st.push(stockItem(makeWeapon(pick(DROP_WEAPONS))), stockItem(makeArmor(Math.random() < .2 ? pick(ARMOR_BUILD) : ARMOR_REGION[rg] && Math.random() < .6 ? ARMOR_REGION[rg] : pick(ARMOR_BASIC))));
  st.push(stockItem(makeTrinket(pick(TRINKET_KEYS))), stockItem(makeTrinket(pick(TRINKET_KEYS))));
  if (Math.random() < .5) st.push(stockItem(makeSeal(pick(FX_KEYS)), 1.5));
  return st;
}
export function placeMerchant(id, stock?) { const c = CAMPS.find(c => c.id === id) || CAMPS[0], [x, y] = merchantSpot(c); merchant = { camp:c.id, x, y, stock: stock || rollStock(c) }; }
/* 鐵匠：只賣武器和防具，貨比較好（稀有以上），每次休息換一批 */
export function rollSmith(lv) {
  const st: Stock[] = [{ kind:'pot', price:25 }, oreRow('mat1', 70, 12)];                            // 鐵匠：前期素材比較便宜、比較多
  if (lv >= 25) st.push(oreRow('mat2', 180, 6)); if (lv >= 50) st.push(oreRow('mat3', 420, 3));
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
export function openShop(v?) { vendor = v || merchant; if (!vendor.stock) vendor.stock = rollSmith(vendor.lv); $('shopName').textContent = vendor.name || '流浪商人'; shopTab = 'buy'; shopSel = null; renderShop(); setMenu('shop'); }
function shopRow(icon, name, sub, price, col, key, dis) {
  return '<button type="button" class="shoprow' + (shopSel === key ? ' sel' : '') + '" data-s="' + key + '"' + (dis ? ' disabled' : '') + '><img alt="" src="' + ICON_URL[icon] + '"><span style="color:' + (col || 'var(--text)') + '">' + name + '<small>' + sub + '</small></span><b class="pr">' + price + '</b></button>';
}
function setFoot(btn, name) { const f = $('shopFoot'); f.hidden = !btn; f.innerHTML = btn ? '<span class="lvfoot">' + (name || '') + '</span>' + btn : ''; }
function oreShopRow(o: Stock, i: number) {
  const M = MATS[o.mat];
  return '<button type="button" class="shoprow' + (shopSel === i ? ' sel' : '') + '" data-s="' + i + '"' + (o.left ? '' : ' disabled') + '><img alt="" src="' + ORE_URL[o.mat] + '"><span style="color:' + M.c + '">' + M.n + '<small>' + M.d + ' · 剩 ' + o.left + ' 個 · 身上 ' + (G.me.mats[o.mat] || 0) + '</small></span><b class="pr">' + o.price + '</b></button>';
}
/* ---- 鐵匠的「強化」分頁：選一把武器 → 底部顯示要多少礦石和金幣 → 按強化 ---- */
function forgeList() { return [G.me.weapon, G.me.armor, ...G.me.inv.filter(it => isW(it) || slotOf(it) === 'armor')].filter(Boolean); }
const upInfo = (w: Item, up: number) => isW(w) ? '攻擊 ' + atkSplit(G.me, w, atkAt(w, up)).total + ' → ' + atkSplit(G.me, w, atkAt(w, up + 1)).total :   // 你拿起來的總攻擊（含能力值加成）
   (() => { const a = armorStats({ ...w, up }), b = armorStats({ ...w, up: up + 1 }); return '防禦 ' + a.def + ' → ' + b.def + ' · 生命 ' + a.hp + ' → ' + b.hp; })();
function renderForge(body: HTMLElement) {
  const list = forgeList(), sel = list.find(w => w.id === shopSel) || null;
  const rows = list.map(w => { const c = upCost(w.up || 0, w), up = w.up || 0;
    const sub = c ? upInfo(w, up) + ' · ' + MATS[c.mat].n + ' ×' + c.n + '（有 ' + (G.me.mats[c.mat] || 0) + '）' : '已經強化到最高';
    return '<button type="button" class="shoprow' + (shopSel === w.id ? ' sel' : '') + '" data-fw="' + w.id + '"><img alt="" src="' + ICON_URL[w.type] + '"><span style="color:' + RAR[w.rarity].c + '">' + itemName(w) + (w === G.me.weapon || w === G.me.armor ? ' <small style="display:inline">（裝備中）</small>' : '') + '<small>' + sub + '</small></span><b class="pr">' + (c ? c.gold : '—') + '</b></button>'; });
  body.innerHTML = '<div class="matline" style="margin:0 0 8px">' + matLine() + '</div><div class="shoplist">' + rows.join('') + '</div>' + (sel ? '<div style="margin-top:8px">' + itemCard(sel) + '</div>' : '') +
    '<p class="hintp">武器每 +1 攻擊多 32%，最高 +10；防具每 +1 防禦和生命多 15%，最高 +5。素材是各地區的怪物掉的：狼牙（平原）、菌絲（森林）、骨片（荒地）、熔岩核、冰晶、腐沼珠，武器 +10 要 Boss 的魂核。</p>';
  const c = sel && upCost(sel.up || 0, sel);
  setFoot(sel ? (c ? '<button type="button" class="pri" data-forge="' + sel.id + '"' + (canUpgrade(G.me, sel) ? '' : ' disabled') + '>強化到 +' + ((sel.up || 0) + 1) + '（' + c.gold + ' 金幣）</button>' : '<button type="button" class="pri" disabled>已經 +' + maxUp(sel) + '</button>') : '',
    sel && c ? MATS[c.mat].n + ' ' + (G.me.mats[c.mat] || 0) + '/' + c.n + ' · 金幣 ' + G.me.gold + '/' + c.gold : '');
}
function renderShop() {
  $('shopGold').textContent = '金幣 ' + G.me.gold;
  $('forgeTab').hidden = !vendor.smith; if (!vendor.smith && shopTab === 'forge') shopTab = 'buy';
  if (shopTab === 'forge') { for (const b of document.querySelectorAll<HTMLElement>('#shopMenu .tabs button')) b.classList.toggle('on', b.dataset.stab === shopTab); renderForge($('shopBody')); return; }
  for (const b of document.querySelectorAll<HTMLElement>('#shopMenu .tabs button')) b.classList.toggle('on', b.dataset.stab === shopTab);
  const body = $('shopBody');
  if (shopTab === 'buy') {
    const rows = vendor.stock.map((o, i) => o.kind === 'pot' ? shopRow('potion', '藥水', '補 1 瓶（目前 ' + G.me.pot + '/' + G.potMax + '）', o.price, null, i, G.me.pot >= G.potMax)
      : o.kind === 'potUp' ? shopRow('potUp', '藥水上限 +1', '剩 ' + o.left + ' 個 · 永久增加', o.price, '#f2c14e', i, !o.left || G.potMax >= 8)
      : o.kind === 'tear' ? shopRow('tear', '重生水滴', '剩 ' + o.left + ' 個 · 在營火重新分配能力值', o.price, '#9ae8ff', i, !o.left)
      : o.kind === 'ore' ? oreShopRow(o, i)
      : shopRow(o.item.type, itemName(o.item), SLOTN[slotOf(o.item)] + (o.item.fx && isW(o.item) ? ' · 帶刻印' : ''), o.sold ? '售出' : o.price, RAR[o.item.rarity].c, i, o.sold));
    const o = vendor.stock[shopSel];
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
  if (t.dataset.fw) { shopSel = +t.dataset.fw === shopSel ? null : +t.dataset.fw; renderShop(); return; }
  if (t.dataset.forge) { const w = forgeList().find(w => w.id === +t.dataset.forge); if (!w || !doUpgrade(G.me, w)) return;
    if (w === G.me.weapon || w === G.me.armor) recalc(G.me); sfx.level(); toast('強化成功：' + itemName(w), '#f2c14e'); renderShop(); save(); return; }
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
