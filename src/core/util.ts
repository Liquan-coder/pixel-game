// $<HTMLCanvasElement>('cv') 這樣可以指定拿到的是哪種元素（預設 HTMLElement）
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const rr = (a, b) => a + Math.random() * (b - a);
export const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return Math.abs(d); };
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function makeNoise(seed, cell) {
  const R = mulberry32(seed), N = 64, grid = new Float32Array(N * N); for (let i = 0; i < grid.length; i++) grid[i] = R();
  const g = (a, b) => grid[(((b % N) + N) % N) * N + (((a % N) + N) % N)], sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = sm(gx - x0), fy = sm(gy - y0);
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * fx, b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * fx; return a + (b - a) * fy; };
}

/* 手指一放開就算按到（不等瀏覽器的 click）。
   iPhone 上「另一隻手指還按著搖桿」或手指稍微滑一下時，click 常常不會來 → 要按第二下才有反應。
   touchend 擋掉之後，瀏覽器就不會再補一個 click 進來（不然會開了又被關掉）。滑鼠一樣靠 pointerup；鍵盤 Enter/空白鍵 還是走 click。 */
export function onTap(el: HTMLElement, fn: () => void) {
  let id = -1;
  el.addEventListener('pointerdown', e => { id = e.pointerId; });
  el.addEventListener('pointerup', e => {
    if (e.pointerId !== id) return; id = -1;
    const r = el.getBoundingClientRect(), pad = 12;                          // 放開的位置還在按鈕上（多留一點邊）才算
    if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) return;
    fn();
  });
  el.addEventListener('pointercancel', () => { id = -1; });
  el.addEventListener('touchend', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  el.addEventListener('click', e => { if (e.detail === 0) fn(); });          // detail 0 = 鍵盤按的；滑鼠點的已經在 pointerup 處理過
}
