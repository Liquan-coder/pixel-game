/* ================= 冰晶（寒霜刻印凍住怪物、主角被冰凍）=================
   照使用者給的參考圖（一根高的六角冰晶 + 旁邊幾顆小晶體）描成調色盤格子，41 × 56 美術像素（1 格 = 1 美術像素 ≈ 14 × 19 世界像素，剛好罩住一隻怪 / 主角）。
   畫成兩層：外框（a）和亮面（i、j）不透明；其他半透明，裡面被凍住的東西隱約看得到。
   用法：drawIceCrystal(x, 腳底 y, 凍住多久了, 還剩幾秒)；解凍時呼叫 iceShatter(x, y) 碎成冰片。 */
import { G } from '../core/state';
import { HK, ctx, snapF } from '../core/canvas';
import { TAU, pick, rr } from '../core/util';

const PAL: Record<string, string> = { a:'#1d1e3f', b:'#223c85', c:'#6b287f', d:'#2e60b1', e:'#397bbd', f:'#4ba0b7', g:'#66b5e0', h:'#9bc9e8', i:'#b0def0', j:'#d2f1f9' };
const ROWS = [
  '.....................aa..................',
  '....................agga.................',
  '...................agihfa................',
  '..................aghjhhfa...............',
  '.................agjhjfhhfa..............',
  '................ahjhhjfffhfa.............',
  '...............ahjhhhjfffffda............',
  '..............ahjhhhhjffffddda...........',
  '.............ahjjhhhhjfffffddda..........',
  '............agjjhhhhhjffffffddea.........',
  '...........aijjhhhhhjjfffffffddba........',
  '...........agihhhhhjjjgggfffffbba........',
  '...........ahgihhhhjhjgggggggbbba........',
  '...........ahjjggghhhjgggffbbbbba........',
  '...........ahjjhhhggijgbbbbbbebba........',
  '...........ahjjihhhhggddeeeddebba........',
  '...........ahjjihhhhjhdeeeeedebba........',
  '...........ahjjihhhhjhdeeeeedebba........',
  '...........aiijighhhjheeeeeeeebba.aaaa...',
  '...........aiijighghjheeeeeeeeebaaahifa..',
  '...........ahijiggghjheeeeeeeeebaahiifa..',
  '...........ahiiggggijheeeeeeeffbbhhiidba.',
  '...........ahiigffggjheeeeeeeffbgjhhjdgba',
  '...........ahiigfffgjheeeeeeeffbgjhhbdgga',
  '...........ahhigffffjheeeeeeeffbhbbbbdbga',
  '...........ahhggefffjheeeeeeeffbhfffjbbba',
  '...........ahhgeefffjheeeeeeeffbhffhjeeba',
  '....aaaaa..ahhgeeeeejheeeeeeefebhffhhdeba',
  '...aaegfda.ahhgeeeeeeheeeeeeefebhffhbeeba',
  '..affjjfieaahhgeeeeedieeeeeeefebhffgbdeaa',
  '.affjiifdddahhgeeededieeeeeeefebhffbbdea.',
  'affjiijfddeahhgeeddedieeeeeeefdbhffbdeea.',
  'afjiijjfdeeahhgdeddddieeeedeeedbfffbddea.',
  'afjiihjdeeebhhgddddddieedddddddbffbdddaa.',
  'afjihhhheeebhhgddddddieedddddddbffbcdda..',
  'afjihhhgbeebhhgddddddieddddbbbbbbbbccea..',
  'afiihheebbebhggddddddiedddbgjjjjfbbbcaa..',
  'afiiheehdbbbhggddddcdidddbgjjhhhffbbcaa..',
  'afigeeeehbbbhggdddcccidddbjhjhhdffbbcaa..',
  'afieeddeehbbhggdddccciddbeghhhedffbbbaa..',
  'afdeeddddgdbbggdddcccidcbgghhhhbhhbddda..',
  'aaccedddddgbbggdddcccidcbggghhddhhbgggba.',
  '.acccddddddgbbgdccbbbbbbbggggdbdebfggggba',
  '..acccddddddbbbdbbjjjggfbbggdbbbbeffigdea',
  '...acccdddddbbbbgjjjjggffbddbbbbbeefiddea',
  '...aacccddddbbbejjjjggfffbbddbbbeeeedddea',
  '....aacccdddbbbeigjggffffbbdbbbeeeebdddea',
  '.....aacbbbbbbbeiggggfffbbbbbbdeeebbdddba',
  '......aabiiigibbiiggiffbbbbbadddeccbddba.',
  '......aijhhggggbbhihibbbbbbabbddcccceba..',
  '......aighffffbbbdbddbbbbbbbbddccccbaa...',
  '......aagffffbbbbbbddbbbbbbbddccccaa.....',
  '.......aabbbbccbbbbddbbbbbbbbbccaaa......',
  '........aaabdccccbbbbdbbbbbbbaaaa........',
  '...........aaaabbbbbbdbbbbaaaa...........',
  '..............aaaaaaaaaaaaa..............',
];
const CW = ROWS[0].length, CH = ROWS.length;
const SOLID = 'aij';                                                      // 這些顏色不透明（外框、亮面）
let body: HTMLCanvasElement, edge: HTMLCanvasElement;
function bake() {                                                         // 第一次用到才畫
  const mk = (keep: (ch: string) => boolean) => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
    ROWS.forEach((r, y) => { for (let x = 0; x < CW; x++) { const ch = r[x]; if (ch !== '.' && keep(ch)) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } } }); return c; };
  body = mk(ch => !SOLID.includes(ch)); edge = mk(ch => SOLID.includes(ch));
}
/* 冰晶頂端離腳底多高（世界像素）：被凍住的怪，血條和圖示要往上移到這上面 */
export const iceTop = () => CH * HK - HK * 3;
const GROW = .14;                                                         // 從地上長出來要幾秒
export function drawIceCrystal(x: number, feetY: number, age: number, left: number) {
  if (!body) bake();
  const q = Math.min(1, Math.max(0, age) / GROW), hh = Math.max(1, Math.round(CH * q));   // 長到第幾列（從下往上）
  const X = snapF(x - CW * HK / 2), Y = snapF(feetY - CH * HK + HK * 3), sy = CH - hh;
  const a0 = ctx.globalAlpha, blink = left < .25 && Math.floor(G.time * 20) % 2 === 0;  // 快解凍了：一閃一閃
  ctx.globalAlpha = a0 * (blink ? .55 : .85); ctx.drawImage(body, 0, sy, CW, hh, X, Y + sy * HK, CW * HK, hh * HK);
  ctx.globalAlpha = a0 * (blink ? .7 : 1);    ctx.drawImage(edge, 0, sy, CW, hh, X, Y + sy * HK, CW * HK, hh * HK);
  ctx.globalAlpha = a0;
  if (q >= 1 && Math.random() < .06) G.parts.push({ x: x + rr(-6, 6), y: feetY - rr(4, 17), vx: 0, vy: 0, life: .3, max: .3, col: '#ffffff', star: rr(1, 1.8) });   // 晶面偶爾閃一下
}
/* 碎掉：冰晶顏色的碎片往四周噴、掉到地上 */
export function iceShatter(x: number, feetY: number) {
  for (let i = 0; i < 22; i++) { const a = rr(0, TAU), v = rr(40, 120);
    G.parts.push({ x: x + rr(-5, 5), y: feetY - rr(2, 17), vx: Math.cos(a) * v, vy: Math.sin(a) * v * .6 - 40, life: rr(.35, .7), max: .7, col: pick([PAL.j, PAL.i, PAL.h, PAL.g, PAL.e, PAL.d]), s: Math.random() < .4 ? 2 : 1, g: 260 }); }
  G.fx.push({ k: 'ring', x, y: feetY - 6, r0: 4, r1: 20, t: 0, d: .22, col: PAL.i });
}
