import { G } from '../core/state';
import { $, clamp, pick, ri } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { AT, COIN_SP, ICON_URL, MERCH_SP, RAR, SLOTN, TT, makeGear, slotOf } from '../data/items';
import { CAMPS, MW, reg } from '../world/map';
import { drawArtSprite } from '../world/chunks';
import { collides } from '../game/collision';
import { sfx } from '../core/audio';
import { drawShadow } from '../render/player';
import { setMenu, toast } from './hud';
import { itemCard } from './menus';
import { save } from '../game/save';
import type { Item } from '../types';

export let merchant = null, shopTab = 'buy', shopSel = null;
const itemPrice = it => Math.round(15 * it.ilvl * Math.pow(it.rarity + 1, 1.5));
const sellPrice = it => 2 * it.ilvl * (it.rarity + 1);                 // 比分解換到的魂晶（3×等級×稀有度）少一些
function merchantSpot(c) { for (const [ox, oy] of [[42, 6], [-42, 6], [0, 42], [30, -30], [-30, -30]]) { const x = c.x + ox, y = c.y + oy; if (!collides(x, y, 7)) return [x, y]; } return [c.x + 20, c.y + 20]; }
function rollStock(c) {
  const r = reg[c.ty * MW + c.tx] % 4, base = [3, 8, 13, 18][r], st: { kind: string; price: number; left?: number; item?: Item }[] = [{ kind:'pot', price:25 }];
  if (G.potMax < 8) st.push({ kind:'potUp', price:250 * (G.potMax - 2), left:1 });
  for (let i = 0; i < 5; i++) { const q = Math.random(), rar = q < .03 + r * .04 ? 3 : q < .2 + r * .08 ? 2 : q < .62 ? 1 : 0;
    const type = i < 2 ? pick(['sword', 'dagger', 'axe', 'spear', 'staff']) : i < 4 ? pick(Object.keys(AT).concat(Object.keys(TT))) : pick(['sword', 'robe', 'leather', 'mail', 'ring', 'amulet']);
    const it = makeGear(type, clamp(base + ri(-1, 1), 1, 22), rar); st.push({ kind:'item', item:it, price:itemPrice(it) }); }
  return st;
}
export function placeMerchant(id, stock?) { const c = CAMPS.find(c => c.id === id) || CAMPS[0], [x, y] = merchantSpot(c); merchant = { camp:c.id, x, y, stock: stock || rollStock(c) }; }
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
export function openShop() { shopTab = 'buy'; shopSel = null; renderShop(); setMenu('shop'); }
function shopRow(icon, name, sub, price, col, key, dis) {
  return '<button type="button" class="shoprow' + (shopSel === key ? ' sel' : '') + '" data-s="' + key + '"' + (dis ? ' disabled' : '') + '><img alt="" src="' + ICON_URL[icon] + '"><span style="color:' + (col || 'var(--text)') + '">' + name + '<small>' + sub + '</small></span><b class="pr">' + price + '</b></button>';
}
function renderShop() {
  $('shopGold').textContent = '金幣 ' + G.me.gold;
  for (const b of document.querySelectorAll<HTMLElement>('#shopMenu .tabs button')) b.classList.toggle('on', b.dataset.stab === shopTab);
  const body = $('shopBody');
  if (shopTab === 'buy') {
    const rows = merchant.stock.map((o, i) => o.kind === 'pot' ? shopRow('potion', '藥水', '補 1 瓶（目前 ' + G.me.pot + '/' + G.potMax + '）', o.price, null, i, G.me.pot >= G.potMax)
      : o.kind === 'potUp' ? shopRow('potUp', '藥水上限 +1', '剩 ' + o.left + ' 個 · 永久增加', o.price, '#f2c14e', i, !o.left || G.potMax >= 8)
      : shopRow(o.item.type, o.item.name, RAR[o.item.rarity].n + ' · ' + SLOTN[slotOf(o.item)] + ' · 等級 ' + o.item.ilvl, o.sold ? '售出' : o.price, RAR[o.item.rarity].c, i, o.sold));
    const o = merchant.stock[shopSel];
    let det = '';
    if (o && o.kind === 'item' && !o.sold) det = itemCard(o.item, G.me[slotOf(o.item)]) + '<div class="acts"><button type="button" class="pri" data-buy="' + shopSel + '"' + (G.me.gold < o.price || G.me.inv.length >= 24 ? ' disabled' : '') + '>買下（' + o.price + ' 金幣）</button></div>';
    else if (o && o.kind !== 'item') det = '<div class="acts"><button type="button" class="pri" data-buy="' + shopSel + '"' + (G.me.gold < o.price ? ' disabled' : '') + '>買下（' + o.price + ' 金幣）</button></div>';
    body.innerHTML = '<div class="shoplist">' + rows.join('') + '</div><div id="shopDet" style="margin-top:8px">' + det + '</div><p class="hintp">商品會在你下次休息時刷新，商人也會走到別的營火。地區越深入，賣的裝備越好。</p>';
  } else {
    const it = G.me.inv.find(x => x.id === shopSel);
    body.innerHTML = (G.me.inv.length ? '<div class="baggrid">' + G.me.inv.map(x => '<button type="button" class="slot' + (shopSel === x.id ? ' sel' : '') + '" data-sid="' + x.id + '" style="border-color:' + RAR[x.rarity].c + '"><img alt="" src="' + ICON_URL[x.type] + '"><i style="color:' + RAR[x.rarity].c + '">' + x.ilvl + '</i></button>').join('') + '</div>'
      : '<div class="empty">背包是空的。</div>') + (it ? '<div style="margin-top:8px">' + itemCard(it, G.me[slotOf(it)]) + '<div class="acts"><button type="button" class="pri" data-sell="' + it.id + '">賣出（+' + sellPrice(it) + ' 金幣）</button></div></div>' : '') +
      '<p class="hintp">賣給商人拿金幣；在角色面板分解則是拿魂晶（數量比較多）。</p>';
  }
}
$('shopMenu').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button'); if (!t) return;
  if (t.hasAttribute('data-close')) { setMenu(null); return; }
  if (t.dataset.stab) { shopTab = t.dataset.stab; shopSel = null; renderShop(); return; }
  if (t.dataset.s !== undefined) { shopSel = +t.dataset.s === shopSel ? null : +t.dataset.s; renderShop(); return; }
  if (t.dataset.sid) { shopSel = +t.dataset.sid === shopSel ? null : +t.dataset.sid; renderShop(); return; }
  if (t.dataset.buy !== undefined) { const o = merchant.stock[+t.dataset.buy]; if (!o || G.me.gold < o.price) return;
    if (o.kind === 'pot') { if (G.me.pot >= G.potMax) return; G.me.pot++; }
    else if (o.kind === 'potUp') { if (!o.left || G.potMax >= 8) return; o.left--; G.potMax++; G.me.pot++; o.price = 250 * (G.potMax - 2); toast('藥水上限 +1（現在 ' + G.potMax + ' 瓶）', '#f2c14e'); }
    else { if (o.sold || G.me.inv.length >= 24) return; o.sold = true; G.me.inv.push(o.item); toast('買到 ' + o.item.name, RAR[o.item.rarity].c); shopSel = null; }
    G.me.gold -= o.price; sfx.buy(); renderShop(); save(); return; }
  if (t.dataset.sell) { const i = G.me.inv.findIndex(x => x.id === +t.dataset.sell); if (i < 0) return; const it = G.me.inv.splice(i, 1)[0];
    G.me.gold += sellPrice(it); sfx.coin(); shopSel = null; renderShop(); save(); }
});
$('shopBtn').addEventListener('click', () => { if (nearMerchant()) openShop(); });
