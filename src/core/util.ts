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

