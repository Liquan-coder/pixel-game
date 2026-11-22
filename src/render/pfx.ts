/* ---- pixelfx 特效（src/vendor/pixelfx，MIT）接到遊戲畫面 ----
   pixelfx 把每一格畫進自己的小畫布（1 格 = 1 個細像素 = HK 世界像素），
   這裡把那張小畫布縮放貼到主畫面上，跟女巫的像素格對齊。

   倒下：disintegrate —— 身體邊緣閃光、整個閃白，然後從頭往下一顆一顆碎成光點被風吹走 */
import { createFrame, clearFrame, createFx, composite } from '../vendor/pixelfx/core/index.js';
import * as DISINTEGRATE from '../vendor/pixelfx/fx/spawn/disintegrate.js';
import { HK, ctx } from '../core/canvas';
import type { Player } from '../types';

// 顏色：暗 → 亮，跟魂晶同一組紫色
const PAL = ['#100820', '#22124a', '#3a2380', '#5a3ab8', '#8a6ae0', '#b49cff', '#e8dcff', '#ffffff'];
const SPEED = 3.4 / 2.5;                          // 原本 3.4 秒；加速到 2.5 秒內播完（2.6 秒就重生了）
// 小畫布的大小（細像素），腳在 (FX0, FY0)：要裝得下女巫 + 被風吹出去的光點
const FW = 340, FH = 200, FX0 = 170, FY0 = 175;

type Live = { pl: Player; fx: any; frame: any; img: ImageData; cv: HTMLCanvasElement; g: CanvasRenderingContext2D; X: number; Y: number; ax: number; ay: number };
const live: Live[] = [];                          // 倒下到重生之間一直留著（播完就不畫，但身體要繼續藏起來）

/* 把女巫倒下那一格的 sprite（細像素畫布）變成 pixelfx 的 actor：每一格有沒有身體、是什麼顏色 */
function actorFrom(sp: HTMLCanvasElement, ax: number, ay: number) {
  const w = sp.width, h = sp.height, d = sp.getContext('2d').getImageData(0, 0, w, h).data;
  const data = new Uint8Array(w * h), pixels: (string | null)[] = new Array(w * h).fill(null);
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 0) {
    data[i] = 1;
    pixels[i] = '#' + [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  return { mask: { w, h, data }, pixels, x: ax, y: ay, w, h, k: 1, head: [0, ay], chest: [0, Math.round(ay * .6)] };
}

/* drawPlayer 每幀呼叫：倒下的第一幀開始碎裂。
   sp = 當下畫出來的那張 sprite 畫布，(X, Y) = 它左上角的世界座標，(fx, fy) = 腳底，flip = 面向左 */
export function deathFx(pl: Player, sp: HTMLCanvasElement, X: number, Y: number, fx: number, fy: number, flip: boolean) {
  if (!pl.dead || live.some(l => l.pl === pl)) return;
  const ax = Math.round((X - fx) / HK), ay = Math.round((Y - fy) / HK);     // sprite 左上角在「腳底為原點」的座標（細像素）
  const cv = document.createElement('canvas'); cv.width = FW; cv.height = FH;
  const fxi = createFx(DISINTEGRATE, { x: 0, y: 0, palette: PAL, wind: flip ? .7 : -.7, density: .25, actor: actorFrom(sp, ax, ay), seed: 5 });   // 風往背後吹
  live.push({ pl, fx: fxi, frame: createFrame(FW, FH, -FX0, -FY0), img: new ImageData(FW, FH), cv, g: cv.getContext('2d'), X, Y, ax, ay });
}
/* 身體該不該藏起來：特效開始自己畫身體（閃白、碎裂）之後，遊戲就不畫女巫了 */
export function bodyGone(pl: Player) {
  const l = live.find(l => l.pl === pl);
  return l ? DISINTEGRATE.actorAlpha(l.fx.t) === 0 : pl.deathT > 1;
}

/* 每一幀畫在最上層（螢幕座標，cx/cy = 鏡頭左上角）。在死亡變暗的黑幕之後畫，光點在黑暗裡發亮 */
export function drawPfx(cx: number, cy: number, dt: number) {
  for (let i = live.length - 1; i >= 0; i--) {
    const l = live[i];
    if (!l.pl.dead) { live.splice(i, 1); continue; }   // 重生了
    if (l.fx.done()) continue;
    l.fx.update(dt * SPEED);
    clearFrame(l.frame); l.fx.draw(l.frame);
    composite(l.frame, l.img.data, null);
    l.g.putImageData(l.img, 0, 0);
    // 小畫布左上角 = 女巫 sprite 左上角再往左上推 (FX0 + ax, FY0 + ay) 個細像素：用同一個起點，格子才會完全對齊
    ctx.drawImage(l.cv, l.X - cx - (FX0 + l.ax) * HK, l.Y - cy - (FY0 + l.ay) * HK, FW * HK, FH * HK);
  }
}
