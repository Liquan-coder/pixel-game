import { G } from '../core/state';
import { AT, TT, WT, fixGear, fixWeapon, makeUnique, slotOf } from '../data/items';
import { migrateAttrs } from '../data/attrs';
import { MAT_KEYS, ORE_TO_MAT, migrateWeapon } from '../data/forge';
import { CAMPS, MH, MW, PY, TS, discovered, explored } from '../world/map';
import { rbDead } from '../world/regionBoss';
import { reachable } from '../world/gen';
import { packExplored, redrawMini, unpackExplored } from '../world/minimap';
import { resetPlayers, recalc } from './player';
import { openDoor } from './boss';
import { merchant, placeMerchant } from '../ui/shop';
import { CHESTS } from '../world/chests';
import { DUNGEONS } from '../world/dungeons';
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
  return { v:11, at:Date.now(), mats:G.me.mats, vit:G.me.vit, str:G.me.str, end:G.me.end, dex:G.me.dex, int:G.me.int, luk:G.me.luk, souls:G.me.souls, gold:G.me.gold, tears:G.me.tears, freePts:G.me.freePts, inv:G.me.inv, weapon:G.me.weapon, armor:G.me.armor, trinkets:G.me.trinkets,
    merchant: merchant ? { camp:merchant.camp, stock:merchant.stock } : null, rbDead: [...rbDead], potMax: G.potMax, bossDead: G.bossDead,
    camps: CAMPS.filter(c => c.lit).map(c => c.id), lastCamp: G.lastCamp, lost: G.lost, uid: G.uid, map: packExplored(), mw: MW, chests: CHESTS.filter(c => c.opened).map(c => c.id), flags: [...flags], lore: [...loreRead], disc: [...discovered] };
}
export function save() { if (!G.started) return; try { localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(serialize())); } catch (e) {} }
export function loadSave(n = slot) { try { const s = localStorage.getItem(SLOT_KEYS[n]); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function clearSave(n = slot) { try { localStorage.removeItem(SLOT_KEYS[n]); } catch (e) {} }
export function applySave(d) {
  resetPlayers();
  Object.assign(G.me, migrateAttrs(d)); G.me.souls = d.souls || 0;   // 舊存檔的三種能力值會換算成新的六種
  // 裝備：舊存檔的武器換算強化等級、拿掉隨機詞綴；舊的防具 / 飾品（物品等級 + 詞綴）換成新制（fixGear）
  const fix = (it) => { if (!it) return null; it.slot = slotOf(it); it.aff = it.aff || {}; if (WT[it.type]) { migrateWeapon(it); return fixWeapon(it); } return fixGear(it); };
  G.me.inv = (Array.isArray(d.inv) ? d.inv : []).map(fix).filter(Boolean);
  if (d.weapon && WT[d.weapon.type]) { G.me.weapon = d.weapon; G.me.weapon.slot = 'weapon'; G.me.weapon.aff = G.me.weapon.aff || {}; migrateWeapon(G.me.weapon); fixWeapon(G.me.weapon); }
  G.me.mats = {}; for (const k in d.mats || {}) { const m = (ORE_TO_MAT[k] || k) as any; if (MAT_KEYS.includes(m) && d.mats[k] > 0) G.me.mats[m] = (G.me.mats[m] || 0) + (d.mats[k] | 0); }   // 舊的礦石 → 新素材
  rbDead.clear(); for (const id of d.rbDead || []) rbDead.add(id);
  if ((d.v || 0) < 10) { const n = rbDead.size + (d.bossDead ? 1 : 0); if (n) G.me.mats.umat = (G.me.mats.umat || 0) + n; }   // v10：舊存檔打過的 Boss 補發黯星石（每隻一顆）
  G.me.gold = Math.max(0, d.gold || 0); G.me.tears = d.tears | 0; G.me.freePts = d.freePts | 0; G.me.armor = d.armor && AT[d.armor.type] ? fix(d.armor) : null;
  const ts = Array.isArray(d.trinkets) ? d.trinkets : [d.trinket];       // 舊存檔只有一個飾品欄
  G.me.trinkets = [0, 1, 2, 3].map(i => ts[i] && TT[ts[i].type] ? fix(ts[i]) : null);
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
  /* v10：地形改過（山、零散的樹和石頭），掉在地上的魂晶可能剛好被蓋住 → 移到旁邊最近走得到的地方 */
  if (G.lost && reachable) { const tx = Math.floor(G.lost.x / TS), ty = Math.floor(G.lost.y / TS);
    if (!reachable[ty * MW + tx]) { let best: number[] | null = null;
      for (let r = 1; r < 40 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) { const x = tx + dx, y = ty + dy;
        if (x > 0 && y > 0 && x < MW && y < MH && reachable[y * MW + x]) { best = [x, y]; break; } }
      if (best) { G.lost.x = best[0] * TS + 8; G.lost.y = best[1] * TS + 8; } } }
  resetQuest(); for (const f of d.flags || []) flags.add(f); for (const l of d.lore || []) loreRead.add(l);
  const opened = new Set(d.chests || []); for (const c of CHESTS) { c.opened = opened.has(c.id); c.foe = null; c.t = 2; }
  if ((d.v || 0) < 11) for (const dg of DUNGEONS) if (['silktwin', 'sandcrescent', 'darkmoon'].includes(dg.uq) && opened.has('d_' + dg.id) && !G.me.inv.some(it => it.uq === dg.uq) && G.me.weapon?.uq !== dg.uq)   // v11：蛛巢 / 沙埋神殿 / 霜墓的金箱多了獨特武器 → 已經開過的直接補進背包
    G.me.inv.push(makeUnique(dg.uq));
  if (G.bossDead) openDoor();
  if (d.merchant && CAMPS.some(c => c.id === d.merchant.camp && c.lit) && Array.isArray(d.merchant.stock) && d.v >= 6) placeMerchant(d.merchant.camp, d.merchant.stock);   // v6 以前的貨是舊武器 → 重新進貨
  else placeMerchant(d.merchant && CAMPS.some(c => c.id === d.merchant.camp && c.lit) ? d.merchant.camp : G.lastCamp);
  recalc(G.me); G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; G.me.pot = G.potMax;
}
setInterval(() => { if (G.started && !G.me.dead) save(); }, 15000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

