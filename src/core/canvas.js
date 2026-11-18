import { $ } from './util.js';
import { placeJoyIdle } from '../ui/input.js';

/* ================= CANVAS ================= */
export const cv = $('cv'), ctx = cv.getContext('2d');
export const lightC = document.createElement('canvas'), lctx = lightC.getContext('2d');
export let LW = 320, LH = 180, SCALE = 2, F = 2, HK = 1 / 3;
export const snapF = v => Math.round(v * F) / F;
export const isTouch = ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
if (isTouch) document.body.classList.add('touch');
export function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  F = 3 * Math.max(1, Math.round(Math.min(vh * dpr / 185, vw * dpr / 300) / 3));     // 每個世界像素 = F 個實體像素（3 的倍數）
  SCALE = F / dpr; HK = 1 / 3;                                                       // 細像素 = 世界像素的 1/3
  LW = Math.ceil(vw / SCALE); LH = Math.ceil(vh / SCALE);
  // draw at the screen's real resolution: F canvas pixels per world pixel; the heroine/weapons use HK world px per art pixel
  cv.width = LW * F; cv.height = LH * F; lightC.width = LW; lightC.height = LH;
  cv.style.width = LW * SCALE + 'px'; cv.style.height = LH * SCALE + 'px';
  ctx.imageSmoothingEnabled = false;
  $('rotate').hidden = !(isTouch && vh > vw);
  placeJoyIdle();
}

