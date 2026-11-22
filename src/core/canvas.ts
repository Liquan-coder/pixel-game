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
// 省電模式（暫停選單 → 設定，預設開）：高解析螢幕上，畫布最多用「1 個美術像素 = 1 個畫布像素」（F = 3）來畫，
// 再由瀏覽器放大到螢幕上。iPhone 橫拿時要畫的像素從大約 300 萬降到 55 萬，GPU 輕鬆很多，比較不會燙
export let ECO = (() => { try { return JSON.parse(localStorage.getItem('pw_settings') || '{}').eco !== false; } catch (e) { return true; } })();   // 自己讀設定（pause.ts 會比這個檔案先跑，不能等它來設）
let sized = false;                                                                  // 遊戲開始前（設定剛讀進來時）只記下來，等 boot() 自己 resize
export function setEco(on: boolean) { if (ECO === on) return; ECO = on; if (sized) resize(); }
export function resize() {
  sized = true;
  const vw = window.innerWidth, vh = window.innerHeight, VIEW_H = viewH(vw, vh);
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  // F = 每個遊戲像素要畫成幾個螢幕實體像素。
  // 普通螢幕（dpr 1）：F 要是 3 的倍數，女巫的細像素（1/3 格）才會整齊。
  // 高解析螢幕（手機、Mac）：實體像素很小，細像素寬度差 1 個實體像素看不出來，F 可以是任何整數，縮放就能調得比較細。
  const step = dpr >= 2 ? 1 : 3;
  const full = step * Math.max(1, Math.round(Math.min(vh * dpr / VIEW_H, vw * dpr / (VIEW_H * 1.6)) / step));
  SCALE = full / dpr; HK = 1 / 3;                                                    // 鏡頭範圍照原本的算法（省電不會讓鏡頭變遠）；細像素 = 世界像素的 1/3
  LW = Math.ceil(vw / SCALE); LH = Math.ceil(vh / SCALE);
  F = ECO && dpr >= 2 ? Math.min(full, 3) : full;                                    // 省電：畫布用比較少的像素畫，放大交給瀏覽器（#cv 是 pixelated，邊緣還是銳利）
  // F = 每個世界像素用幾個畫布像素畫；女巫、武器用 HK 世界像素 = 1 個美術像素
  cv.width = LW * F; cv.height = LH * F; lightC.width = LW; lightC.height = LH;
  cv.style.width = LW * SCALE + 'px'; cv.style.height = LH * SCALE + 'px';
  ctx.imageSmoothingEnabled = false;
  $('rotate').hidden = !(isTouch && vh > vw);
  placeJoyIdle();
}

