/* ================= 精靈王國：平原東邊海灣裡的一座白森林島（地區編號 8） =================
   三座橋：平原的東岸營火 → 銀橋、森林南岸（古樹營火）→ 林間渡口、沼澤西岸 → 東渡口。
   等級 40～55（跟熔岩、雪原差不多），是一條「中期支線」：不打也能破關，但三把精靈武器都在這裡。

   島上的東西：
     銀葉城（城鎮，精靈的商人和鐵匠）、月泉（湖心的小島上有一個金箱：精靈細劍）、白樹之丘（巨大的白樹）、
     精靈王城（王座中庭 = 精靈王・艾瑟蘭，掉精靈弓）、螢火林（地城「螢月禁林」的洞口，最深處的金箱 = 精靈雙刀）。

   生成的順序（gen.ts）：海畫完 → buildElfIsland() 把島挖出來 → 其他地區的地形照舊 → buildElfLandmarks() → 道路、城鎮……
   這個檔案只用自己的亂數（mulberry32(8xxx)）和雜訊，不會讓其他地區的樹、怪、寶箱跑掉（舊存檔照樣對得上）。 */
import { makeNoise, mulberry32 } from '../core/util';
import { BIGT, CLIFF, ELF, GROUND, MW, PILLAR, RFLOOR, ROCK, RWALL, TREE, TS, WATER, braziers, map, reg } from './map';
import { I, clearDisk, inb, wallRect } from './gen';
import { POIS } from '../data/poi';

export const ELF_BOX = { x0: 266, y0: 404, x1: 402, y1: 494 };          // 島一定在這個框裡（南邊 498 開始是地城區塊）
const CX = 334, CY = 452, RX = 60, RY = 40;

/* 1. 把島挖出來：雜訊扭曲的橢圓，只蓋在「海」上，而且離其他陸地至少 5 格（中間留一條海峽，靠橋過去） */
export function buildElfIsland() {
  const n = makeNoise(8101, 9), { x0, y0, x1, y1 } = ELF_BOX, W = x1 - x0 + 1, H = y1 - y0 + 1;
  const dist = new Int16Array(W * H).fill(999), q: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (map[I(x, y)] !== WATER) { dist[(y - y0) * W + x - x0] = 0; q.push((y - y0) * W + x - x0); }
  for (let h = 0; h < q.length; h++) { const j = q[h], jx = j % W, jy = (j / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = jx + dx, Y = jy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const k = Y * W + X; if (dist[k] > dist[j] + 1) { dist[k] = dist[j] + 1; q.push(k); } } }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const e = Math.abs((x - CX) / RX) ** 4 + Math.abs((y - CY) / RY) ** 4 + (n(x, y) - .5) * .35;   // 圓角方形（四次方）：島比較飽滿，角落也放得下東西
    if (e < 1 && dist[(y - y0) * W + x - x0] >= 5 && y < 493) { map[I(x, y)] = GROUND; reg[I(x, y)] = ELF; }
  }
}
export const isElf = (x: number, y: number) => reg[I(x, y)] === ELF;

/* 2. 地形：北邊一道白岩（白樹之丘的背面）、東南的螢火林岩壁（地城洞口）、一個小湖。樹林在 terrain.ts 的 vegetation 用雜訊長 */
export function elfFormations() {
  const n = makeNoise(8102, 5), only = (x: number, y: number) => map[I(x, y)] === GROUND && isElf(x, y);
  const blob = (cx: number, cy: number, rx: number, ry: number, t: number, jag = .25) => {
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
      if (!inb(x, y) || !only(x, y)) continue; const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (e < 1 + (n(x * 1.7, y * 1.7) - .5) * jag * 2) map[I(x, y)] = t; } };
  blob(300, 424, 9, 4, CLIFF);                                          // 白樹之丘北邊的白岩
  blob(392, 470, 4, 6, CLIFF);                                          // 螢火林東邊的岩壁
  blob(292, 474, 5, 3.5, WATER, .3);                                     // 西南的小湖
}

/* 3. 地標：月泉、白樹、精靈王城、螢火林。clearDisk / wallRect 跟其他地標一樣 */
const LANDMARKS: [string, string, number, number, string][] = [
  ['elfspring', '月泉', 334, 432, '月光永遠照在這一池水上。湖心的小島上，好像放著什麼'],
  ['elftree', '白樹之丘', 302, 434, '一棵比城牆還高的白樹。精靈說，星星掉下來的那一夜，它一夜之間白了頭'],
  ['elfcastle', '精靈王城', 366, 438, '白石砌成的王城。王座在中庭的最深處，城門朝南'],
  ['firefly', '螢火林', 380, 478, '螢火蟲多到像在下雪。岩壁上有一個往下的洞口'],
];
export function buildElfLandmarks() {
  const R = mulberry32(8103), n = makeNoise(8104, 4);
  for (const [id, name, tx, ty, desc] of LANDMARKS) POIS.push({ id, name, tx, ty, kind: 'landmark', desc });
  const fire = (tx: number, ty: number) => braziers.push({ x: tx * TS + 8, y: ty * TS + 12 });
  const disk = (cx: number, cy: number, r: number, f: (i: number, d: number, x: number, y: number) => void) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { if (!inb(x, y) || !isElf(x, y)) continue; const d = Math.hypot(x - cx, y - cy); if (d <= r) f(I(x, y), d, x, y); } };
  // 月泉：圓形的湖 + 湖心的小島（島上四根白色石柱）；從南岸一條小石橋過去（道路那一步會把水變成橋）
  disk(334, 432, 11, (i, d, x, y) => { const e = ((x - 334) / 9.5) ** 2 + ((y - 432) / 7) ** 2;
    if (d < 3.2) map[i] = GROUND; else if (e < 1 + (n(x, y) - .5) * .3) map[i] = WATER; else if (map[i] === TREE || map[i] === ROCK) map[i] = GROUND; });
  for (const [x, y] of [[332, 430], [336, 430], [332, 434], [336, 434]]) map[I(x, y)] = PILLAR;
  // 白樹之丘：一棵巨大的白樹（2×2 的 BIGT），周圍清空
  clearDisk(302, 435, 8, true);
  for (const [x, y] of [[302, 434], [303, 434], [302, 433], [303, 433]]) map[I(x, y)] = BIGT;
  // 精靈王城：白石外牆（城門朝南）+ 四角的塔 + 王座中庭（精靈王在中間）+ 兩排柱廊 + 王座的高台
  clearDisk(366, 439, 19, false);
  disk(366, 439, 19, i => { if (map[i] === WATER) map[i] = GROUND; });
  wallRect(R, 351, 424, 31, 31, 0, 's');
  const tower = (x0: number, y0: number) => { for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) if (inb(x, y)) map[I(x, y)] = RWALL; };
  for (const [x, y] of [[349, 422], [378, 422], [349, 452], [378, 452]]) tower(x, y);
  for (let x = 365; x <= 367; x++) for (let y = 452; y <= 455; y++) map[I(x, y)] = RFLOOR;   // 城門不要被塔擋住
  for (const y of [429, 433, 437, 441, 445, 449]) for (const x of [355, 377]) map[I(x, y)] = PILLAR;
  for (let x = 362; x <= 370; x++) map[I(x, 425)] = RWALL;                                  // 王座的高台
  for (const x of [362, 370]) map[I(x, 426)] = PILLAR;
  for (let y = 425; y < 454; y++) for (let x = 352; x < 381; x++) if (map[I(x, y)] === RFLOOR && R() < .12 && Math.abs(x - 366) > 2) map[I(x, y)] = GROUND;   // 石板縫裡長出青草
  fire(364, 457); fire(368, 457); fire(363, 427); fire(369, 427);
  // 螢火林：洞口前清出一塊空地（洞口的小山在 dungeons.ts 的 stampEntrances 蓋）
  clearDisk(380, 482, 5, true);
  void ROCK; void MW;
}

/* 4. 怪物：等級從銀橋（西邊）40 → 王城（東邊）55 */
export const ELF_SPAWN = { n: 150, lv: [40, 55] as [number, number], anchor: [286, 452] as [number, number], span: 90,
  kinds: (q: number) => q < .3 ? 'elfHound' : q < .58 ? 'elfArcher' : q < .85 ? 'elfBlade' : 'elfTreant' };
/* 精英怪：[種類, 等級, x, y, 名字] */
export const ELF_ELITES: [string, number, number, number, string][] = [
  ['elfBlade', 52, 340, 443, '月泉的劍聖'], ['elfTreant', 52, 300, 441, '白樹的守衛'], ['elfArcher', 50, 360, 470, '王城弓兵長'], ['elfHound', 46, 294, 466, '銀月獵犬'],
  ['elfArcher', 52, 385, 437, '城牆外的弓手'], ['elfBlade', 53, 379, 433, '破口的守衛'],   // 王城的繞路（world/secrets.ts）
];
