/* ================= 符文石：野外零星立著的古老石碑，刻的符文會發光 =================
   純裝飾（不能互動），擋路（跟石頭一樣碰得到）。每個地區放幾塊，有時兩塊站在一起。
   只放在空曠的草地上：周圍 5×5 格都是一般地面、離路、營火、寶箱、石碑、神像都有一段距離 → 不會擋到路。
   石頭本身是一張圖；符文另外一張「發光層」疊上去，一亮一暗地呼吸，地上照一圈光，偶爾飄出一顆光點。 */
import { G } from '../core/state';
import { mulberry32, rr } from '../core/util';
import { ctx } from '../core/canvas';
import { RUNE_SLATE, runeStone } from '../art/stoneArt';
import { CAMPS, GROUND, MW, PROPS, ROAD, TS, WH, map, reg } from './map';
import { CHESTS } from './chests';
import { TAB } from '../game/quest';
import { drawArtSprite } from './chunks';
import { drawShadow } from '../render/player';

// 地區 → 符文的顏色 [光, 最亮的芯] + 地上那圈光的色調（render.ts 的 tint：1 橘、2 青、5 白、6 綠）
const COL: Record<number, { c: [string, string]; tint: number }> = {
  0: { c: ['#4ee8d2', '#e0fff8'], tint: 2 }, 1: { c: ['#4ee8d2', '#e0fff8'], tint: 2 }, 2: { c: ['#4ee8d2', '#e0fff8'], tint: 2 },
  3: { c: ['#ff8a3a', '#ffe0a0'], tint: 1 },                     // 熔岩高地：橘色
  4: { c: ['#4ee8d2', '#e0fff8'], tint: 2 },
  5: { c: ['#8ac8ff', '#f0f8ff'], tint: 5 },                     // 霜寒雪原：冰藍
  6: { c: ['#7aff9a', '#e8ffe8'], tint: 6 },                     // 幽影沼澤：綠
  8: { c: ['#9ad8ff', '#ffffff'], tint: 5 },                     // 精靈王國：銀藍
};
const PER_REGION = 6;

type Rune = { x: number; y: number; r: number; seed: number; ph: number; art?: { stone: HTMLCanvasElement; glow: HTMLCanvasElement } };
export const RUNES: Rune[] = [];

export function placeRunestones() {
  RUNES.length = 0;
  const R = mulberry32(9137), at = (x: number, y: number) => map[y * MW + x];
  const near = (tx: number, ty: number, list: { tx: number; ty: number }[], d: number) => list.some(p => Math.abs(p.tx - tx) < d && Math.abs(p.ty - ty) < d);
  const ok = (tx: number, ty: number, r: number) => {
    if (tx < 4 || ty < 4 || tx >= MW - 4 || ty >= WH - 4 || reg[ty * MW + tx] !== r) return false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (at(tx + dx, ty + dy) !== GROUND) return false;   // 周圍 5×5 都是空地
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (at(tx + dx, ty + dy) === ROAD) return false;     // 離路遠一點
    if (near(tx, ty, CAMPS, 8) || near(tx, ty, CHESTS, 5) || near(tx, ty, TAB, 6)) return false;
    if (PROPS.some(p => Math.hypot(p.x - (tx * TS + 8), p.y - (ty * TS + 12)) < 56)) return false;            // 神像、其他東西
    return !RUNES.some(s => Math.hypot(s.x - (tx * TS + 8), s.y - (ty * TS + 12)) < TS * 14);              // 符文石之間也要隔開
  };
  const add = (tx: number, ty: number, r: number) => { const s = { x: tx * TS + 8 + rr(-3, 3), y: ty * TS + 12, r, seed: 500 + RUNES.length * 13, ph: R() * 6.28 };
    RUNES.push(s); PROPS.push({ x: s.x, y: s.y, r: 5 }); };
  for (const r of Object.keys(COL).map(Number)) {
    let n = 0;
    for (let t = 0; t < 6000 && n < PER_REGION; t++) { const tx = (R() * MW) | 0, ty = (R() * WH) | 0; if (!ok(tx, ty, r)) continue;
      add(tx, ty, r); n++;
      if (R() < .35) { const dx = R() < .5 ? -2 : 2; if (at(tx + dx, ty) === GROUND && at(tx + dx, ty + 1) === GROUND) add(tx + dx, ty + (R() < .5 ? 1 : 0), r); }   // 有時兩塊站在一起
    }
  }
}

export function drawRunestones(vis, list, L, addLight) {
  for (const s of RUNES) { if (!vis(s.x, s.y, 40)) continue;
    const col = COL[s.r], p = .5 + .5 * Math.sin(G.time * 1.6 + s.ph);                 // 呼吸：每塊的節奏錯開
    if (!s.art) s.art = runeStone(s.seed, RUNE_SLATE, col.c);                               // 第一次看到才畫
    const art = s.art;
    list.push({ y: s.y, f: () => { drawShadow(s.x, s.y + 1, 9); drawArtSprite(art.stone, s.x, s.y + 2);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7 + .3 * p; drawArtSprite(art.glow, s.x, s.y + 2); drawArtSprite(art.glow, s.x, s.y + 2);   // 疊兩次：白天的草地上也看得清楚
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } });
    addLight(L, s.x, s.y - 8, 20 + 8 * p, col.tint);
    if (Math.random() < .025) G.parts.push({ x: s.x + rr(-3, 3), y: s.y - rr(4, 12), vx: rr(-2, 2), vy: -rr(5, 10), life: 1.4, max: 1.4, col: col.c[0], star: rr(.4, .9), drag: 1 });   // 偶爾飄出一顆光點
  }
}
