import { G } from '../core/state.js';
import { AT, TT, WT, slotOf } from '../data/items.js';
import { CAMPS, discovered } from '../world/map.js';
import { rbDead } from '../world/regionBoss.js';
import { packExplored, unpackExplored } from '../world/minimap.js';
import { resetPlayers, recalc } from './player.js';
import { openDoor } from './boss.js';
import { merchant, placeMerchant } from '../ui/shop.js';

/* ================= SAVE ================= */
const SAVE_KEY = 'pixel-wilds-save-v3';
export function serialize() {
  return { v:4, vit:G.me.vit, str:G.me.str, end:G.me.end, souls:G.me.souls, gold:G.me.gold, inv:G.me.inv, weapon:G.me.weapon, armor:G.me.armor, trinket:G.me.trinket,
    merchant: merchant ? { camp:merchant.camp, stock:merchant.stock } : null, rbDead: [...rbDead], potMax: G.potMax, bossDead: G.bossDead,
    camps: CAMPS.filter(c => c.lit).map(c => c.id), lastCamp: G.lastCamp, lost: G.lost, uid: G.uid, map: packExplored(), disc: [...discovered] };
}
export function save() { if (!G.started) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (e) {} }
export function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
export function applySave(d) {
  resetPlayers();
  G.me.vit = d.vit || 1; G.me.str = d.str || 1; G.me.end = d.end || 1; G.me.souls = d.souls || 0;
  G.me.inv = (Array.isArray(d.inv) ? d.inv : []).filter(it => it && (WT[it.type] || AT[it.type] || TT[it.type]));   // 舊存檔：補上欄位預設值
  for (const it of G.me.inv) { it.slot = slotOf(it); it.aff = it.aff || {}; }
  if (d.weapon && WT[d.weapon.type]) { G.me.weapon = d.weapon; G.me.weapon.slot = 'weapon'; G.me.weapon.aff = G.me.weapon.aff || {}; }
  rbDead.clear(); for (const id of d.rbDead || []) rbDead.add(id);
  G.me.gold = d.gold || 0; G.me.armor = d.armor && AT[d.armor.type] ? d.armor : null; G.me.trinket = d.trinket && TT[d.trinket.type] ? d.trinket : null;
  G.potMax = d.potMax || 3; G.bossDead = !!d.bossDead; G.uid = Math.max(G.uid, d.uid || 1);
  for (const c of CAMPS) c.lit = c.id === 'start' || (d.camps || []).includes(c.id);
  G.lastCamp = d.lastCamp || 'start'; G.lost = d.lost || null;
  discovered.clear(); for (const s of d.disc || []) discovered.add(s);
  if (d.map) unpackExplored(d.map);
  if (G.bossDead) openDoor();
  if (d.merchant && CAMPS.some(c => c.id === d.merchant.camp && c.lit) && Array.isArray(d.merchant.stock)) placeMerchant(d.merchant.camp, d.merchant.stock); else placeMerchant(G.lastCamp);
  recalc(G.me); G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; G.me.pot = G.potMax;
}
setInterval(() => { if (G.started && !G.me.dead) save(); }, 15000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

