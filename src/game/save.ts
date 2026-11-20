import { G } from '../core/state';
import { AT, TT, WT, fixWeapon, slotOf } from '../data/items';
import { migrateAttrs } from '../data/attrs';
import { MAT_KEYS, migrateWeapon } from '../data/forge';
import { CAMPS, MH, MW, PY, TS, discovered, explored } from '../world/map';
import { rbDead } from '../world/regionBoss';
import { packExplored, redrawMini, unpackExplored } from '../world/minimap';
import { resetPlayers, recalc } from './player';
import { openDoor } from './boss';
import { merchant, placeMerchant } from '../ui/shop';
import { CHESTS } from '../world/chests';
import { flags, loreRead, resetQuest } from './quest';

/* ================= SAVE ================= */
/* 三個存檔欄位。存檔 1 沿用以前唯一那個存檔的 key → 舊玩家的進度自動變成「存檔 1」 */
export const SLOTS = 3;
const SLOT_KEYS = ['pixel-wilds-save-v3', 'pixel-wilds-save-v3-s2', 'pixel-wilds-save-v3-s3'];
const LAST_KEY = 'pixel-wilds-last-slot';                               // 上次玩的是哪一格（標題畫面預設選它）
export let slot = 0;                                                     // 現在在玩哪一格：save() / loadSave() 都對它
export function setSlot(n: number) { slot = n; try { localStorage.setItem(LAST_KEY, String(n)); } catch (e) {} }
export function lastSlot() { try { const n = Number(localStorage.getItem(LAST_KEY)); return n >= 0 && n < SLOTS ? n : 0; } catch (e) { return 0; } }
export function serialize() {
  return { v:8, at:Date.now(), mats:G.me.mats, vit:G.me.vit, str:G.me.str, end:G.me.end, dex:G.me.dex, int:G.me.int, luk:G.me.luk, souls:G.me.souls, gold:G.me.gold, inv:G.me.inv, weapon:G.me.weapon, armor:G.me.armor, trinket:G.me.trinket,
    merchant: merchant ? { camp:merchant.camp, stock:merchant.stock } : null, rbDead: [...rbDead], potMax: G.potMax, bossDead: G.bossDead,
    camps: CAMPS.filter(c => c.lit).map(c => c.id), lastCamp: G.lastCamp, lost: G.lost, uid: G.uid, map: packExplored(), mw: MW, chests: CHESTS.filter(c => c.opened).map(c => c.id), flags: [...flags], lore: [...loreRead], disc: [...discovered] };
}
export function save() { if (!G.started) return; try { localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(serialize())); } catch (e) {} }
export function loadSave(n = slot) { try { const s = localStorage.getItem(SLOT_KEYS[n]); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function clearSave(n = slot) { try { localStorage.removeItem(SLOT_KEYS[n]); } catch (e) {} }
export function applySave(d) {
  resetPlayers();
  Object.assign(G.me, migrateAttrs(d)); G.me.souls = d.souls || 0;   // 舊存檔的三種能力值會換算成新的六種
  G.me.inv = (Array.isArray(d.inv) ? d.inv : []).filter(it => it && (WT[it.type] || AT[it.type] || TT[it.type]));   // 舊存檔：補上欄位預設值
  for (const it of G.me.inv) { it.slot = slotOf(it); it.aff = it.aff || {}; migrateWeapon(it); fixWeapon(it); }
  if (d.weapon && WT[d.weapon.type]) { G.me.weapon = d.weapon; G.me.weapon.slot = 'weapon'; G.me.weapon.aff = G.me.weapon.aff || {}; migrateWeapon(G.me.weapon); fixWeapon(G.me.weapon); }
  G.me.mats = {}; for (const k of MAT_KEYS) if (d.mats && d.mats[k] > 0) G.me.mats[k] = d.mats[k] | 0;
  rbDead.clear(); for (const id of d.rbDead || []) rbDead.add(id);
  G.me.gold = d.gold || 0; G.me.armor = d.armor && AT[d.armor.type] ? d.armor : null; G.me.trinket = d.trinket && TT[d.trinket.type] ? d.trinket : null;
  G.potMax = d.potMax || 3; G.bossDead = !!d.bossDead; G.uid = Math.max(G.uid, d.uid || 1);
  /* v7：地圖往南擴大，「起始營火」搬到新平原的最南邊；舊存檔裡的 start 其實是現在的 west（西丘營火） */
  const camp = (id: string) => d.v < 7 && id === 'start' ? 'west' : id;
  if (d.v < 7 && d.merchant) d.merchant.camp = camp(d.merchant.camp);
  for (const c of CAMPS) c.lit = c.id === 'start' || (d.camps || []).map(camp).includes(c.id);
  G.lastCamp = camp(d.lastCamp || 'start'); G.lost = d.lost || null;
  discovered.clear(); for (const s of d.disc || []) discovered.add(s);
  if (d.map) unpackExplored(d.map, d.mw || 256);
  /* v8：地圖重排。舊的平原整塊往南移 PY 格；其他地區是重新蓋的，舊座標對不上 → 探索紀錄只留平原的，掉在別處的魂晶移到最後休息的營火 */
  if (d.v < 8) {
    const plainsOld = (x: number, y: number) => (y > 206 && x < 262) || (y >= 96 && y <= 206 && x < 128);
    if (G.lost) { const tx = Math.floor(G.lost.x / TS), ty = Math.floor(G.lost.y / TS), c = CAMPS.find(c => c.id === G.lastCamp) || CAMPS[0];
      if (plainsOld(tx, ty)) G.lost.y += PY * TS; else { G.lost.x = c.x + 12; G.lost.y = c.y + 6; } }
    const old = explored.slice(); explored.fill(0);
    for (let y = 0; y + PY < MH; y++) for (let x = 0; x < MW; x++) if (old[y * MW + x] && plainsOld(x, y)) explored[(y + PY) * MW + x] = 1;
    redrawMini();
    d.chests = (d.chests || []).map((id: string) => { const m = /^c(\d+)_(\d+)$/.exec(id); return m && plainsOld(+m[1], +m[2]) ? 'c' + m[1] + '_' + (+m[2] + PY) : id; });
  }
  resetQuest(); for (const f of d.flags || []) flags.add(f); for (const l of d.lore || []) loreRead.add(l);
  const opened = new Set(d.chests || []); for (const c of CHESTS) { c.opened = opened.has(c.id); c.foe = null; c.t = 2; }
  if (G.bossDead) openDoor();
  if (d.merchant && CAMPS.some(c => c.id === d.merchant.camp && c.lit) && Array.isArray(d.merchant.stock) && d.v >= 6) placeMerchant(d.merchant.camp, d.merchant.stock);   // v6 以前的貨是舊武器 → 重新進貨
  else placeMerchant(d.merchant && CAMPS.some(c => c.id === d.merchant.camp && c.lit) ? d.merchant.camp : G.lastCamp);
  recalc(G.me); G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; G.me.pot = G.potMax;
}
setInterval(() => { if (G.started && !G.me.dead) save(); }, 15000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

