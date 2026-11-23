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

/** 沙暴：o = { x, y, age, t }（t = 剩下幾秒）。貼著地面的一大片旋轉的沙（不是龍捲風）：
    沙粒排成 3 條往中間捲的旋臂（像漩渦），從外圈一路被吸到中間（越裡面轉越快），只微微離地 → 看得出「把東西往中間吸」。
    R = 半徑（吸的範圍是 56，畫面上小一點） */
export function drawSandstorm(o, _L?) {
  const q = Math.min(1, o.age / .2, o.t / .35), R = 46, T = G.time, B = newBins(), ARMS = 3;
  for (let k = 0; k < 480; k++) {
    const u = (hash(k) + T * (.4 + hash(k + 50) * .25)) % 1;            // 0 = 剛從外圈進來，1 = 被吸到中間
    const rr0 = (1 - u) ** .85, r = R * rr0 * (.9 + hash(k + 90) * .2);
    const arm = k % ARMS, a = arm * TAU / ARMS + (1 - rr0) * 2.6 + T * 3 + (hash(k + 20) - .5) * .7;   // 旋臂：越往裡面扭得越多；同一條臂上有一點寬度
    const x0 = Math.cos(a), y0 = Math.sin(a), h = u * u * 6 * (.5 + hash(k + 60));   // 越靠近中間捲得越高一點（最多離地幾個像素）
    const fade = Math.min(1, u * 6, (1 - u) * 4); if (fade < .15) continue;   // 外圈剛出現、中間消失
    const x = o.x + x0 * r, y = o.y - h + y0 * r * .34;
    const c = y0 > .3 ? (hash(k + 7) < .35 ? 3 : 2) : y0 > -.3 ? (hash(k + 7) < .5 ? 2 : 1) : (hash(k + 7) < .5 ? 0 : 1);   // 前面（靠近鏡頭）亮、後面暗
    const al = fade < .45 ? 1 : 2;
    grain(B, c, al, x, y, hash(k + 33) < .35 ? 3 : 2);
    const a2 = a - .14; grain(B, Math.max(0, c - 1), 1, o.x + Math.cos(a2) * r, o.y - h + Math.sin(a2) * r * .34, 2);   // 拖一顆淡的 → 一條條被風掃過的沙線
  }
  flush(B, q * .9); ctx.globalAlpha = 1;
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
