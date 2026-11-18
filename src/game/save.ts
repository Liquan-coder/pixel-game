import { G } from '../core/state';
import { AT, TT, WT, slotOf } from '../data/items';
import { migrateAttrs } from '../data/attrs';
import { CAMPS, MW, discovered } from '../world/map';
import { rbDead } from '../world/regionBoss';
import { packExplored, unpackExplored } from '../world/minimap';
import { resetPlayers, recalc } from './player';
import { openDoor } from './boss';
import { merchant, placeMerchant } from '../ui/shop';
import { CHESTS } from '../world/chests';

/* ================= SAVE ================= */
const SAVE_KEY = 'pixel-wilds-save-v3';
export function serialize() {
  return { v:5, vit:G.me.vit, str:G.me.str, end:G.me.end, dex:G.me.dex, int:G.me.int, luk:G.me.luk, souls:G.me.souls, gold:G.me.gold, inv:G.me.inv, weapon:G.me.weapon, armor:G.me.armor, trinket:G.me.trinket,
    merchant: merchant ? { camp:merchant.camp, stock:merchant.stock } : null, rbDead: [...rbDead], potMax: G.potMax, bossDead: G.bossDead,
    camps: CAMPS.filter(c => c.lit).map(c => c.id), lastCamp: G.lastCamp, lost: G.lost, uid: G.uid, map: packExplored(), mw: MW, chests: CHESTS.filter(c => c.opened).map(c => c.id), disc: [...discovered] };
}
export function save() { if (!G.started) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (e) {} }
export function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
export function applySave(d) {
  resetPlayers();
  Object.assign(G.me, migrateAttrs(d)); G.me.souls = d.souls || 0;   // 舊存檔的三種能力值會換算成新的六種
  G.me.inv = (Array.isArray(d.inv) ? d.inv : []).filter(it => it && (WT[it.type] || AT[it.type] || TT[it.type]));   // 舊存檔：補上欄位預設值
  for (const it of G.me.inv) { it.slot = slotOf(it); it.aff = it.aff || {}; }
  if (d.weapon && WT[d.weapon.type]) { G.me.weapon = d.weapon; G.me.weapon.slot = 'weapon'; G.me.weapon.aff = G.me.weapon.aff || {}; }
  rbDead.clear(); for (const id of d.rbDead || []) rbDead.add(id);
  G.me.gold = d.gold || 0; G.me.armor = d.armor && AT[d.armor.type] ? d.armor : null; G.me.trinket = d.trinket && TT[d.trinket.type] ? d.trinket : null;
  G.potMax = d.potMax || 3; G.bossDead = !!d.bossDead; G.uid = Math.max(G.uid, d.uid || 1);
  for (const c of CAMPS) c.lit = c.id === 'start' || (d.camps || []).includes(c.id);
  G.lastCamp = d.lastCamp || 'start'; G.lost = d.lost || null;
  discovered.clear(); for (const s of d.disc || []) discovered.add(s);
  if (d.map) unpackExplored(d.map, d.mw || 256);
  const opened = new Set(d.chests || []); for (const c of CHESTS) { c.opened = opened.has(c.id); c.foe = null; c.t = 2; }
  if (G.bossDead) openDoor();
  if (d.merchant && CAMPS.some(c => c.id === d.merchant.camp && c.lit) && Array.isArray(d.merchant.stock)) placeMerchant(d.merchant.camp, d.merchant.stock); else placeMerchant(G.lastCamp);
  recalc(G.me); G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; G.me.pot = G.potMax;
}
setInterval(() => { if (G.started && !G.me.dead) save(); }, 15000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

