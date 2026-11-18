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
// 電腦固定 240。觸控裝置看螢幕「短邊」有多長（CSS px 大約對應實際公分）：
//   手機短邊 ≈ 375–430 → 160（鏡頭拉近，角色才不會小到看不清）
//   平板短邊 ≈ 768–1024 → 240（螢幕夠大，跟電腦一樣）
export function viewH(vw: number, vh: number) { return isTouch ? Math.round(Math.max(160, Math.min(240, Math.min(vw, vh) * .4))) : 240; }
export function resize() {
  const vw = window.innerWidth, vh = window.innerHeight, VIEW_H = viewH(vw, vh);
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

