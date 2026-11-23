/* 用一粒一粒的沙子畫的特效（不用半透明色塊、不用發光的球）：
   - drawSandstorm：沙王的月牙刀的沙暴（game/signatures.ts）：一團往上捲的沙子漏斗 + 地上繞圈的沙
   - drawSandSpout：沙王 / 沙巨人的「落沙」：從地上噴起來再落回去的沙泉（world/bossAI3.ts 的 strike）
   沙粒一顆 2~3 個美術像素；同一種顏色先收集起來一次 fill（幾百顆也不會慢） */
import { G } from '../core/state';
import { TAU } from '../core/util';
import { ctx } from '../core/canvas';
import { artDot, artPath } from './fx';
import { addLight } from './enemy';

const SAND = ['#6a4a20', '#a07a3a', '#c8a060', '#e8d098', '#fff4d8'];   // 暗 → 亮
const hash = (n: number) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };   // 每顆沙固定的亂數（不會每幀亂跳）

/* 收集沙粒：B[顏色][透明度 0~2] = [x, y, 大小, ...] */
type Bins = number[][][];
const newBins = (): Bins => SAND.map(() => [[], [], []]);
function grain(B: Bins, c: number, al: number, x: number, y: number, s: number) { B[c][al].push(x, y, s); }
function flush(B: Bins, q: number) {
  const AL = [.35, .7, 1];
  for (let c = 0; c < SAND.length; c++) for (let a = 0; a < 3; a++) { const P = B[c][a]; if (!P.length) continue;
    ctx.globalAlpha = q * AL[a]; ctx.fillStyle = SAND[c]; artPath(); for (let i = 0; i < P.length; i += 3) artDot(P[i], P[i + 1], P[i + 2]); ctx.fill(); }
}

/** 沙暴：o = { x, y, age, t }（t = 剩下幾秒）。漏斗高 H、底部半寬 W0、頂部半寬 W1 */
export function drawSandstorm(o, _L?) {
  const q = Math.min(1, o.age / .2, o.t / .35), H = 38, W0 = 4, W1 = 22, T = G.time, B = newBins();
  for (let k = 0; k < 50; k++) {                                         // 地上：一圈被風掃著跑的沙（扁扁的橢圓，每顆拖一條尾巴）
    const r = 6 + hash(k + 300) * 22, a = T * (3 - r * .035) + hash(k + 310) * TAU, c = hash(k + 320) < .5 ? 0 : 1;
    for (let j = 0; j < 3; j++) { const aj = a - j * .1; grain(B, Math.max(0, c - (j > 1 ? 1 : 0)), r > 24 || j ? 0 : 1, o.x + Math.cos(aj) * r, o.y + Math.sin(aj) * r * .32, 2); } }
  for (let k = 0; k < 240; k++) {                                        // 漏斗：每顆沙從底部繞著轉、一路往上捲，越高圈越大
    const u = (hash(k) + T * (.55 + hash(k + 50) * .35)) % 1, h = u * H;
    const edge = 1 - .4 * hash(k + 90) ** 2;                             // 大部分貼在漏斗外緣（輪廓才清楚），少數在裡面
    let rad = (W0 + (W1 - W0) * u ** .8) * edge; if (u > .85) rad *= 1 + (u - .85) * 3;   // 到頂了往外甩出去
    const a = T * (8 - u * 3) + hash(k + 20) * TAU, fade = Math.min(1, (1 - u) * 5, u * 10);   // 頂端散掉、底部剛捲起來
    if (fade < .15) continue;
    const at = (aa: number) => [o.x + Math.cos(aa) * rad, o.y - h + Math.sin(aa) * rad * .3];
    const front = Math.sin(a), c = front > .35 ? (hash(k + 7) < .3 ? 4 : 3) : front > -.35 ? 2 : (hash(k + 7) < .5 ? 0 : 1);   // 前面亮、後面暗 → 看得出是一個會轉的立體漏斗
    const al = fade < .5 ? 0 : front > -.35 ? 2 : 1, s = hash(k + 33) < .35 ? 3 : 2;
    const [x, y] = at(a); grain(B, c, al, x, y, s);
    for (let j = 1; j <= 2; j++) { const [tx, ty] = at(a - j * .13); grain(B, Math.max(0, c - j), Math.max(0, al - j), tx, ty, Math.max(1, s - 1)); }   // 後面拖兩顆、越來越淡 → 一條條被風捲著跑的沙線
  }
  flush(B, q * .8); ctx.globalAlpha = 1;   // 整體淡一點：月牙刀的招牌是配角，不要蓋過打擊感
}

/** 沙泉：f = { x, y, r }，k = 0 → 1（約 0.6 秒）。沙從中間噴上去、往外散、落回地上變成一圈沙 */
export function drawSandSpout(f, k: number, L) {
  const D = .6, t = k * D, g = 520, R = f.r, B = newBins(), q = k > .7 ? (1 - k) / .3 : 1;
  for (let i = 0; i < 240; i++) {
    const t0 = hash(i + 11) * .16, tt = t - t0; if (tt < 0) continue;  // 一顆一顆陸續噴出來（看起來是一條連續的沙柱）
    const vy = 150 + hash(i + 12) * 130, ang = hash(i + 13) * TAU, out = (.15 + hash(i + 14) * .85) * R * 1.6;   // 往上的速度 / 往外散的方向和速度
    let z = vy * tt - g * tt * tt / 2, landed = false; if (z < 0) { z = 0; landed = true; }
    const spread = Math.min(tt, landed ? 2 * vy / g : tt);             // 落地之後就不再往外滑
    const x = f.x + Math.cos(ang) * out * spread, gy = f.y + Math.sin(ang) * out * spread * .5, y = gy - z;
    const c = landed ? (hash(i + 15) < .5 ? 0 : 1) : z > 40 ? (hash(i + 16) < .4 ? 4 : 3) : 2 + Math.round(hash(i + 16));   // 高處被照亮、落地變暗
    grain(B, c, landed ? 1 : 2, x, y, hash(i + 17) < .3 ? 3 : 2);
  }
  for (let i = 0; i < 40; i++) {                                         // 地上往外噴開的一圈沙
    const a = hash(i + 400) * TAU, r = Math.min(1, k * 3) * R * (.6 + hash(i + 401) * .5);
    grain(B, hash(i + 402) < .5 ? 1 : 2, 1, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * .5, 2); }
  flush(B, q); ctx.globalAlpha = 1;
  if (L) addLight(L, f.x, f.y - 20, R * 1.4 * q, 2);
}
