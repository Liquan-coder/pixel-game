/* ================= 「看到了」就記在地圖上 =================
   以前要走到那一格旁邊（reveal 的 12 格圓）地圖才會出現洞口、地標的圖示。
   現在：洞口、遺跡、地標、城鎮只要出現在畫面裡（加一點邊），就算「看到了」→ 那個點附近標成已探索，
   大地圖（render/map.ts 用 explored 判斷 seen）自然就會畫出圖示。高大的地標（城堡、要塞…）站得更遠也看得到。
   不標 Boss、不標寶箱。 */
import { G } from '../core/state';
import { LH, LW } from '../core/canvas';
import { MH, MW, TOWNS, TS, explored } from './map';
import { DUNGEONS, inDZone } from './dungeons';
import { POIS } from '../data/poi';
import { miniPix } from './minimap';

type Spot = { tx: number; ty: number; tall: number };                  // tall = 比畫面多看得到幾格（高的東西遠遠就看得到）
let spots: Spot[] | null = null;
const TALL: Record<string, number> = { castle: 14, caldera: 12, summit: 14, rotaltar: 10, mirror: 10, howl: 10, mist: 10, forge: 8, fort: 8 };
function list(): Spot[] {
  if (spots) return spots;
  spots = [];
  for (const d of DUNGEONS) if (!inDZone(d.ent[0], d.ent[1])) spots.push({ tx: d.ent[0], ty: d.ent[1], tall: d.stairs ? 0 : 4 });   // 洞口上面有尖岩：多 4 格
  for (const p of POIS) spots.push({ tx: p.tx, ty: p.ty, tall: TALL[p.id] || 3 });
  for (const t of TOWNS) spots.push({ tx: t.tx, ty: t.ty, tall: 6 });
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
  for (const s of list()) { if (explored[s.ty * MW + s.tx]) continue;
    if (Math.abs(s.tx - px) < hw + s.tall && Math.abs(s.ty - py) < hh + s.tall) mark(s.tx, s.ty); }
}
