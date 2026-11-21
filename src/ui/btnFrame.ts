/* 手機右下角動作按鈕的外框：畫成「像素圓」（一格一格的圓，不是平滑的圓），
   深色外框 + 一圈顏色邊 + 半透明底，左上一圈亮、右下一圈暗 —— 跟遊戲裡其他像素圖同一套光影。
   做成 SVG 當背景圖，按鈕多大都一樣清楚。 */
import { $ } from '../core/util';

function frame(N: number, fill: string, rim: string, hi: string, sh: string) {
  const C = (N - 1) / 2, inside = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && Math.hypot(x - C, y - C) <= C + .3;
  // 每一格離圓的外面有幾層：0 = 最外圈（外框），1 = 顏色邊，2 = 內側光影，其他 = 底
  const layer: number[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!inside(x, y)) { layer.push(-1); continue; }
    let d = 9;
    for (let k = 1; k <= 3 && d === 9; k++) for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) if (Math.abs(i) + Math.abs(j) <= k && !inside(x + i, y + j)) d = Math.min(d, k - 1);
    layer.push(d);
  }
  const rows: Record<string, string[]> = {};
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const L = layer[y * N + x]; if (L < 0) continue;
    const dx = x - C, dy = y - C, lit = -(dx + dy) / (Math.hypot(dx, dy) || 1);   // 1 = 左上（亮），-1 = 右下（暗）
    const col = L === 0 ? '#100d16c0' : L === 1 ? (lit > .4 ? hi : lit < -.4 ? sh : rim) : L === 2 && lit > .5 ? '#ffffff16' : L === 2 && lit < -.5 ? '#00000030' : fill;
    (rows[col] ||= []).push(`M${x} ${y}h1v1h-1z`);
  }
  const body = Object.entries(rows).map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
//            底（半透明）     邊         亮邊        暗邊
const SKIN = {
  bAtk:   ['#3a2a1a8c', '#a87c44cc', '#e0b468d9', '#5a3c1cd9'],
  bSkill: ['#2420408c', '#7563b0cc', '#a894e8d9', '#3a2c6ad9'],
  bDodge: ['#1a28308c', '#4a90a0cc', '#7ac8d8d9', '#1e4a58d9'],
  bPot:   ['#2a14208c', '#9a3a4ccc', '#d86478d9', '#541a28d9'],
};
const PX = 3.6;                                             // 每格大概幾個螢幕像素：四顆按鈕一樣粗，看起來才是同一套
for (const [id, c] of Object.entries(SKIN)) { const el = $(id), w = parseFloat(getComputedStyle(el).width) || 60; el.style.backgroundImage = frame(Math.round(w / PX), c[0], c[1], c[2], c[3]); }
