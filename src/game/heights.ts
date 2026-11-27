/* 斜視角 demo：有高度的試驗場（出生營火東邊）。
   - 高台 28px，南邊有 3 階的階梯（每階 7px，走得上去）
   - 從邊緣走出去會掉下來；掉落時按攻擊 = 下落攻擊，落地打周圍一圈
   - 一次跨不上 8px 以上 → 底下的怪只能走階梯上來
   斜視角關掉時整個拆掉（elev 歸零），野外跟原本一樣 */
import { G } from '../core/state';
import { rr } from '../core/util';
import { CAMPS, GROUND, MW, ROAD, TS, map } from '../world/map';
import { STEP, elev, gZ, hill, stairs } from '../world/elev';
import { chunks, gChunks } from '../world/chunks';
import { iso } from '../render/isoState';
import { pressed } from './player';
import { damageEnemy } from './combat';
import { preUpdate, shake } from './worldUpdate';
import { dustPuff } from '../render/fx';
import { sfx } from '../core/audio';

const H = 28, saved: [number, number][] = [];
function build() {
  const c = CAMPS.find(c => c.id === 'start') || CAMPS[0], x0 = c.tx + 5, y0 = c.ty - 5, W = 9, Hh = 7;
  const set = (tx: number, ty: number, h: number, st = 0) => { const i = ty * MW + tx; elev[i] = h; stairs[i] = st; };
  for (let ty = y0 - 2; ty < y0 + Hh + 6; ty++) for (let tx = x0 - 2; tx < x0 + W + 2; tx++) {   // 整塊清成草地（樹、石頭搬走），拆掉時還原
    const i = ty * MW + tx; if (map[i] !== GROUND && map[i] !== ROAD) { saved.push([i, map[i]]); map[i] = GROUND; } }
  for (let ty = y0; ty < y0 + Hh; ty++) for (let tx = x0; tx < x0 + W; tx++) set(tx, ty, H);
  for (let tx = x0 + 1; tx < x0 + W - 1; tx++) set(tx, y0 + 2, H + 14);   // 高台上再一層矮牆（站不上去，要從旁邊繞）
  for (const tx of [x0 + 3, x0 + 4]) for (let k = 0; k < 3; k++) set(tx, y0 + Hh + k, H - 7 * (k + 1), 1);   // 階梯 21 / 14 / 7
  chunks.clear(); gChunks.clear(); hill.on = true;
}
function teardown() { elev.fill(0); stairs.fill(0); for (const [i, t] of saved) map[i] = t; saved.length = 0; chunks.clear(); gChunks.clear(); hill.on = false; }

function land(e, fell: number) {
  if (e !== G.me) return;
  dustPuff(e.x, e.y, 6 + Math.min(8, fell / 4), 30); shake(1.5, .12);
  if (e.plunge) {                                                       // 下落攻擊：落地震一圈
    e.plunge = false; shake(3.5, .25); sfx.boom();
    G.fx.push({ k: 'ring', x: e.x, y: e.y, r0: 4, r1: 40, t: 0, d: .35, col: '#e8dcff' });
    for (let i = 0; i < 10; i++) G.parts.push({ x: e.x + rr(-14, 14), y: e.y + rr(-6, 6), vx: rr(-60, 60), vy: rr(-50, -10), life: .4, max: .4, col: '#c8a8ff', star: rr(.6, 1.2), drag: 3 });
    for (const t of G.enemies) if (t.hp > 0 && Math.hypot(t.x - e.x, t.y - e.y) < 40 && Math.abs((t.z || 0) - e.z) < 14) damageEnemy(e, t, 2.4, e.x, e.y, { heavy: true, stun: .7, crit: true });
  }
}
preUpdate.push(dt => {
  if (iso.on && !hill.on && G.started) build(); else if (!iso.on && hill.on) teardown();
  if (!hill.on) return;
  for (const e of [...G.players, ...G.enemies] as any[]) {
    const g = gZ(e.x, e.y); if (e.z === undefined) e.z = g;
    if (e.z > g + .5) {                                                 // 在空中：重力往下掉
      if (e === G.me && pressed.atk && e.z > g + 6) e.plunge = true;
      e.vz = (e.vz || 0) + 700 * dt; e.z -= e.vz * dt; e.air = true;
      if (e.z <= g) { const fell = e.vz * .1; e.z = g; e.vz = 0; e.air = false; land(e, fell); }
    } else { e.z = Math.min(g, e.z + 160 * dt); if (e.z > g - .5) e.z = g; e.air = false; }   // 走上階梯：平滑地升上去
  }
});
/** 高度差太大 → 打不到（站在高台上，底下的近戰怪碰不到你） */
export { STEP };
