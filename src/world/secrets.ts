/* ================= 精靈王城 = 一座小小的「傳說城堡」+ 藏起來的流派飾品 =================
   以前精靈王城（world/elfland.ts 蓋的白石城）城門一進去就是王座中庭。現在像艾爾登法環的城堡：
   1. 南邊的城門是放下來的鐵柵門，從外面打不開（走近按「調查」會給一句提示）
   2. 東邊的城牆塌了一個破口：從王城門前營火繞到城的東邊 → 從破口進去 → 沿著東邊的柱廊往南走
      （一路都在精靈王的範圍外面；城牆外有弓手、破口有守衛）
   3. 城門內側有一根拉桿：拉起 → 城門打開 = 捷徑。之後死了，從營火直接走進去打王
   4. 王座右後方的城牆有裂痕：砍一下就碎 → 後面的密室有黃金寶箱（月影之鈴）
   野外另外的寶箱：黑曜石林（血契之戒）、骸骨墓地（守光騎士的誓言），還有六個流派核心（見 FIELD）。
   旗標：'elf:gate'（城門開了）、'elf:wall'（密室的牆碎了）。打倒過精靈王的舊存檔：城門直接算開著。
   setupSecrets() 在 world/statues.ts 的 placeStatues() 最後呼叫（地圖烘焙之前）；updateSecrets() 每幀（game/worldUpdate.ts）。 */
import { G } from '../core/state';
import { pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { MW, PROPS, RFLOOR, RWALL, TS, WALKABLE, map } from './map';
import { CHESTS } from './chests';
import { reachable } from './gen';
import { setTile, swingFace } from './puzzles';
import { rbDead } from './regionBoss';
import { flags } from '../game/quest';
import { burst, shake } from '../game/worldUpdate';
import { showBanner, toast } from '../ui/hud';
import { save } from '../game/save';
import type { Player } from '../types';

export const GATE = { x0: 364, x1: 367, y: 454 };                       // 南城門（4 格寬）
export const LEVER = { tx: 362, ty: 452 };                               // 城門內側的拉桿
export const BREACH = { x: 381, y0: 428, y1: 430 };                      // 東牆的破口
export const CRACK = { tx: 371, ty: 424 };                               // 密室的牆（北牆，王座右後方）
const VAULT = { x0: 370, x1: 372, y0: 420, y1: 423 };                    // 密室（城牆外面另外砌的小房間）
/* 寶箱：[ug, 地標中心 tx, ty, 等級] */
const FIELD: [string, number, number, number][] = [['bloodpact', 304, 168, 45], ['knightoath', 38, 48, 32],
  // 流派核心（game/builds.ts）：每個流派一件，放在不同地區、沒有 Boss 的小地標旁
  ['hawkplume', 88, 366, 6], ['ghostveil', 366, 378, 18], ['plaguevial', 282, 346, 20], ['ragethorn', 170, 172, 35], ['giantheart', 252, 108, 48], ['thirstfang', 455, 355, 68]];

const S = { gate: false, gateT: 1, props: [] as { x: number; y: number; r: number }[], lever: { x: 0, y: 0 }, last: null as any, ready: false };
const gateWanted = () => flags.has('elf:gate') || rbDead.has('elfking');
const I = (x: number, y: number) => y * MW + x;

export function setupSecrets() {
  for (let y = BREACH.y0; y <= BREACH.y1; y++) map[I(BREACH.x, y)] = RFLOOR;                       // 破口
  for (let y = VAULT.y0 - 1; y <= VAULT.y1 + 1; y++) for (let x = VAULT.x0 - 1; x <= VAULT.x1 + 1; x++)   // 密室：一圈牆 + 裡面的地板
    map[I(x, y)] = x >= VAULT.x0 && x <= VAULT.x1 && y >= VAULT.y0 && y <= VAULT.y1 ? RFLOOR : RWALL;
  map[I(CRACK.tx, CRACK.ty)] = RWALL;
  const vx = (VAULT.x0 + VAULT.x1) >> 1, vy = VAULT.y0 + 1;
  addChest('shadowbell', vx, vy, 54);
  S.props = []; for (let x = GATE.x0; x <= GATE.x1; x++) { const p = { x: x * TS + 8, y: GATE.y * TS + 8, r: 9 }; PROPS.push(p); S.props.push(p); }
  S.lever = { x: LEVER.tx * TS + 8, y: LEVER.ty * TS + 12 }; PROPS.push({ x: S.lever.x, y: S.lever.y, r: 5 });
  for (const [ug, cx, cy, lv] of FIELD) { const t = fieldSpot(cx, cy); if (t) addChest(ug, t[0], t[1], lv); }
  S.gate = false; S.gateT = 1; S.ready = true;
}
function addChest(ug: string, tx: number, ty: number, lv: number) {
  const id = 'ug_' + ug; if (CHESTS.some(c => c.id === id)) return;
  CHESTS.push({ id, tx, ty, x: tx * TS + 8, y: ty * TS + 10, tier: 2, lv, mimic: false, opened: false, t: 0, ug });
}
/* 地標旁邊：走得到、四周空著、離別的寶箱 5 格以上 */
function fieldSpot(cx: number, cy: number) {
  for (let r = 2; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = cx + dx, y = cy + dy;
    if (!reachable || !reachable[I(x, y)] || ![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => WALKABLE(map[I(x + a, y + b)]))) continue;
    if (CHESTS.some(c => Math.abs(c.tx - x) + Math.abs(c.ty - y) < 5)) continue; return [x, y]; }
  return null;
}

/* ---- 每幀：城門跟著旗標（讀檔 / 新遊戲也對）、密室的牆、揮刀砍牆 ---- */
export function updateSecrets(dt: number) {
  if (!S.ready) return;
  const want = gateWanted(); if (want !== S.gate) { S.gate = want; S.gateT = 1; }      // 讀檔：直接是開好的樣子（拉拉桿的時候 pull() 會把 gateT 設成 0）
  if (S.gate && S.gateT < 1) S.gateT = Math.min(1, S.gateT + dt / 1.2);
  for (const p of S.props) p.r = S.gate && S.gateT > .6 ? 0 : 9;                  // 升到一半以上就走得過去
  const wallOpen = flags.has('elf:wall'), t = wallOpen ? RFLOOR : RWALL; if (map[I(CRACK.tx, CRACK.ty)] !== t) setTile(CRACK.tx, CRACK.ty, t);
  const pl = G.me; if (!pl || pl.dead || wallOpen || !pl.swing || pl.swing === S.last) return; S.last = pl.swing;
  const hx = CRACK.tx * TS + 8, hy = CRACK.ty * TS + 8;
  if (Math.hypot(pl.x - hx, pl.y - hy) < 32 && swingFace(pl, hx, hy)) {
    flags.add('elf:wall'); setTile(CRACK.tx, CRACK.ty, RFLOOR); sfx.boom(); shake(5, .3); burst(hx, hy, 18, '#c8ccd8', 90);
    toast('牆碎掉了……王座後面藏著一間密室', '#c8a8ff'); save(); }
}
function pull() { flags.add('elf:gate'); S.gate = true; S.gateT = 0; sfx.boom(); sfx.level(); shake(4, .5); showBanner('城門升起來了', '從王城門前的營火，可以直接走進來了', 2600); save(); }

/* ---- 互動（ui/interact.ts）：拉桿 = 拉起；城門外面 = 調查（給提示） ---- */
export function secretTarget(pl: Player): { btn: string; text: string; run: () => void } | null {
  if (!S.ready || S.gate) return null;
  if (Math.hypot(S.lever.x - pl.x, S.lever.y - pl.y) < 22) return { btn: '拉起', text: '拉起城門的拉桿', run: pull };
  const gx = (GATE.x0 + GATE.x1 + 1) / 2 * TS, gy = GATE.y * TS + 8;
  if (pl.y > gy && Math.abs(pl.x - gx) < 34 && pl.y - gy < 26) return { btn: '調查', text: '緊閉的城門', run: () => { sfx.pick();
    toast('鐵柵門是從裡面放下來的，外面推不動。……城牆的東邊，好像有一角塌了。', '#e8d8b0'); } };
  return null;
}

/* ---- 畫：城門的鐵柵（打開時往上收）、拉桿、牆上的裂痕 ---- */
export function drawSecrets(vis, list, L, addLight) {
  if (!S.ready) return;
  const g0 = S.props[0], g1 = S.props[S.props.length - 1];
  if (vis(g0.x, g0.y, 80)) { const lift = S.gate ? S.gateT * 22 : 0;
    list.push({ y: g0.y + 7, f: () => { const L0 = g0.x - 8, W = g1.x - g0.x + 16, top = g0.y - 24, H = 32 - lift;
      if (H > 1) { for (let x = L0 + 1; x < L0 + W; x += 4) { ctx.fillStyle = '#2a2632'; ctx.fillRect(snapF(x), snapF(top), 2, H); ctx.fillStyle = '#8a8aa0'; ctx.fillRect(snapF(x), snapF(top), HK, H); }
        ctx.fillStyle = '#3a3646'; for (const yy of [top + 4, top + H - 4]) ctx.fillRect(snapF(L0), snapF(yy), W, 2); }
      ctx.fillStyle = '#d8dce8'; ctx.fillRect(snapF(L0 - 2), snapF(top - 3), W + 4, 4); } });   // 白石的門楣
    const lv = S.lever, down = S.gate;
    list.push({ y: lv.y, f: () => { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(snapF(lv.x - 6), snapF(lv.y - 1), 12, 3);
      ctx.fillStyle = '#8e92a6'; ctx.fillRect(snapF(lv.x - 4), snapF(lv.y - 7), 8, 7); ctx.fillStyle = '#c8ccd8'; ctx.fillRect(snapF(lv.x - 4), snapF(lv.y - 7), 8, 2);
      ctx.save(); ctx.translate(snapF(lv.x), snapF(lv.y - 7)); ctx.rotate(down ? -.9 : .9);
      ctx.fillStyle = '#4a3018'; ctx.fillRect(-1, -12, 2, 12); ctx.fillStyle = down ? '#7ae07a' : '#e0c060'; ctx.fillRect(-2.5, -14, 5, 4); ctx.restore(); } });
    if (!S.gate) addLight(L, lv.x, lv.y - 10, 18 + Math.sin(G.time * 3) * 2, 2); }
  const hx = CRACK.tx * TS + 8, hy = CRACK.ty * TS + 8;
  if (!flags.has('elf:wall') && vis(hx, hy, 30)) {                       // 裂痕 + 偶爾從縫裡吹出來的灰（跟地城的隱藏牆一樣）
    list.push({ y: hy + 9, f: () => { ctx.fillStyle = '#5a5e70';
      for (const [ax, ay, bx, by] of [[-10, -4, -4, 2], [-4, 2, -7, 8], [-4, 2, 3, 0], [3, 0, 9, -5], [3, 0, 5, 8]]) {
        const n = 6; for (let i = 0; i <= n; i++) ctx.fillRect(snapF(hx + ax + (bx - ax) * i / n), snapF(hy + ay + (by - ay) * i / n), HK * 2, HK * 2); } } });
    if (Math.random() < .04) G.parts.push({ x: hx + rr(-8, 8), y: hy + rr(0, 8), vx: rr(-4, 4), vy: rr(4, 12), life: 1, max: 1, col: pick(['#c8ccd8', '#9a9eb0']), s: 1, drag: 1 }); }
}
