import { $ } from './util';
import { placeJoyIdle } from '../ui/input';

/* ================= CANVAS ================= */
export const cv = $<HTMLCanvasElement>('cv'), ctx = cv.getContext('2d');
export const lightC = document.createElement('canvas'), lctx = lightC.getContext('2d');
export let LW = 320, LH = 180, SCALE = 2, F = 2, HK = 1 / 3;
export const snapF = v => Math.round(v * F) / F;
export const isTouch = ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
if (isTouch) document.body.classList.add('touch');
// 畫面大約要看得到多少「遊戲像素」高。數字越大 = 鏡頭越遠、角色和特效看起來越小
// 手機螢幕實際只有筆電的 1/3 高，用同一個數字角色會小到看不清，所以手機鏡頭拉近一點
const VIEW_H = isTouch ? 160 : 240;
export function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  // F = 每個遊戲像素要畫成幾個螢幕實體像素。
  // 普通螢幕（dpr 1）：F 要是 3 的倍數，女巫的細像素（1/3 格）才會整齊。
  // 高解析螢幕（手機、Mac）：實體像素很小，細像素寬度差 1 個實體像素看不出來，F 可以是任何整數，縮放就能調得比較細。
  const step = dpr >= 2 ? 1 : 3;
  F = step * Math.max(1, Math.round(Math.min(vh * dpr / VIEW_H, vw * dpr / (VIEW_H * 1.6)) / step));
  SCALE = F / dpr; HK = 1 / 3;                                                       // 細像素 = 世界像素的 1/3
  LW = Math.ceil(vw / SCALE); LH = Math.ceil(vh / SCALE);
  // draw at the screen's real resolution: F canvas pixels per world pixel; the heroine/weapons use HK world px per art pixel
  cv.width = LW * F; cv.height = LH * F; lightC.width = LW; lightC.height = LH;
  cv.style.width = LW * SCALE + 'px'; cv.style.height = LH * SCALE + 'px';
  ctx.imageSmoothingEnabled = false;
  $('rotate').hidden = !(isTouch && vh > vw);
  placeJoyIdle();
}

