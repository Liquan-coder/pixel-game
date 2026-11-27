/* 斜視角 demo 的開關和鏡頭狀態（單獨一個小檔案：input.ts 很早就被 import，不能連帶載入地形模組，不然 import 順序會亂掉）
   mode：'dia' = 45° 菱形（暗黑、Hades）；'front' = 正面斜俯視（寶可夢、星露谷、CrossCode：格子不轉，看得到牆的正面）
   網址：?iso = 45°，?iso=front = 正面 */
const q = new URLSearchParams(location.search).get('iso');
export const iso = { on: q !== null, mode: (q === 'front' ? 'front' : 'dia') as 'dia' | 'front', ox: 0, oy: 0, px: 0, py: 0, init: false };
export const perf = { render: 0, calls: 0, cap: 0, up: 0, gl: 0, ents: 0, f: { cap: 0, up: 0, gl: 0 }, worst: { ms: 0, cap: 0, up: 0, gl: 0, ents: 0, lights: 0 }, lights: 0 };   // f = 這一幀的原始值；worst = 最近 2 秒最卡的一幀   // cap = 擷取角色、up = 上傳貼圖、gl = 3D 繪圖（毫秒，平均）                                     // 畫一幀平均花幾毫秒（?lab 顯示）
export const three = { on: new URLSearchParams(location.search).has('three') };   // three.js 模式（render/three3d.ts）
