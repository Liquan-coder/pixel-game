/* 斜視角 demo 的開關和鏡頭狀態（單獨一個小檔案：input.ts 很早就被 import，不能連帶載入地形模組，不然 import 順序會亂掉） */
export const iso = { on: new URLSearchParams(location.search).has('iso'), ox: 0, oy: 0, px: 0, py: 0, init: false };
