/* ================= 「親眼看到了」才標在地圖上 =================
   地圖分兩層：
   · 地形（explored）：自己走過的路 + 星之神像點亮的整塊地區
   · 圖示（這個檔案）：營火、洞口、遺跡、地標、城鎮 —— **只有自己在畫面上看到過**才會出現。
     神像只會把地形畫出來，不會告訴你營火、地城在哪（要靠地形、遠景自己去找）。
   看到的時候會記一個 flag（'saw:' + 種類 + id），存檔一起存；那個點附近也順便標成已探索。
   高大的地標（城堡、要塞…）站得更遠也看得到。不標 Boss、不標寶箱。 */
import { G } from '../core/state';
import { LH, LW } from '../core/canvas';
import { CAMPS, MH, MW, TOWNS, TS, explored } from './map';
import { DUNGEONS, inDZone } from './dungeons';
import { POIS } from '../data/poi';
import { miniPix } from './minimap';
import { flags } from '../game/quest';

type Spot = { key: string; tx: number; ty: number; tall: number };     // tall = 比畫面多看得到幾格（高的東西遠遠就看得到）
let spots: Spot[] | null = null;
const TALL: Record<string, number> = { castle: 14, caldera: 12, summit: 14, rotaltar: 10, mirror: 10, howl: 10, mist: 10, forge: 8, fort: 8 };
/* 每一種圖示的 key：地圖畫圖示前用 saw(key) 問「看過了嗎」 */
export const campKey = (id: string) => 'c:' + id, dgKey = (id: string) => 'd:' + id, poiKey = (id: string) => 'p:' + id, townKey = (id: string) => 't:' + id;
export const saw = (key: string) => flags.has('saw:' + key);
function list(): Spot[] {
  if (spots) return spots;
  spots = [];
  for (const d of DUNGEONS) if (!inDZone(d.ent[0], d.ent[1])) spots.push({ key: dgKey(d.id), tx: d.ent[0], ty: d.ent[1], tall: d.stairs ? 0 : 4 });   // 洞口上面有尖岩：多 4 格
  for (const p of POIS) spots.push({ key: poiKey(p.id), tx: p.tx, ty: p.ty, tall: TALL[p.id] || 3 });
  for (const t of TOWNS) spots.push({ key: townKey(t.id), tx: t.tx, ty: t.ty, tall: 6 });
  for (const c of CAMPS) if (!c.dg) spots.push({ key: campKey(c.id), tx: c.tx, ty: c.ty, tall: 2 });   // 營火會發光：多 2 格
  return spots;
}
function mark(tx: number, ty: number) {                                // 那個點 + 周圍一小圈
  for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue; const i = y * MW + x; if (!explored[i]) { explored[i] = 1; miniPix(i); } }
}
export function sightReveal() {
  if (!G.me) return;
  const px = G.me.x / TS, py = G.me.y / TS; if (inDZone(Math.floor(px), Math.floor(py))) return;   // 在地城裡看不到外面
  const hw = LW / 2 / TS + 1, hh = LH / 2 / TS + 1;
  for (const s of list()) { if (saw(s.key)) continue;
    if (Math.abs(s.tx - px) < hw + s.tall && Math.abs(s.ty - py) < hh + s.tall) { flags.add('saw:' + s.key); mark(s.tx, s.ty); } }
}
/** 舊存檔（v13 以前）：那時候「地形亮了 = 圖示也顯示」→ 地形已經亮的點，全部算看過，舊玩家的地圖不會突然少東西 */
export function sawFromExplored() {
  for (const s of list()) if (explored[s.ty * MW + s.tx]) flags.add('saw:' + s.key);
}
