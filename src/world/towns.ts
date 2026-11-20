/* ---- 城鎮的居民：走近就會說話（每次走近換一句），鐵匠可以交易 ----
   台詞都放在這裡，之後寫劇情時直接改這個表就好 */
import { G } from '../core/state';
import { $ } from '../core/util';
import { HK } from '../core/canvas';
import { SH, sculpt } from '../art/monsters';
import { TOWNS, TS } from './map';
import { drawArtSprite } from './chunks';
import { drawShadow } from '../render/player';
import { moveEnt } from '../game/collision';
import { flags } from '../game/quest';

type Look = { robe: string[]; hair: string[]; skin?: string[]; beard?: boolean; helm?: boolean; apron?: boolean; hood?: boolean; spear?: boolean; small?: boolean };
const SKIN = ['#8a5a44', '#c8907a', '#ecc0a4', '#fadcc8'];
function hdVillager(L: Look) {                                       // Q 版村民：大頭、袍子、兩顆眼睛；用參數換衣服、頭髮、配件
  const S = L.skin || SKIN, s = L.small ? .82 : 1, X = v => 15 + (v - 15) * s, Y = v => 40 - (40 - v) * s;
  const parts: Record<string, any>[] = [
    { sh: SH.poly([[X(9), Y(19)], [X(21), Y(19)], [X(24), Y(38)], [X(6), Y(38)]]), ramp: L.robe, tex: .15, grp: 1 },
    { sh: SH.cap(X(8), Y(21), X(6), Y(30), 2.2 * s, 2 * s), ramp: L.robe, grp: 2 }, { sh: SH.cap(X(22), Y(21), X(24), Y(30), 2.2 * s, 2 * s), ramp: L.robe, grp: 3 },
    { sh: SH.ell(X(15), Y(12), 8 * s, 7.5 * s), ramp: S, grp: 4 },
    { sh: L.helm ? SH.ell(X(15), Y(9), 8.8 * s, 6.5 * s, (x, y) => y < Y(11)) : L.hood ? SH.ell(X(15), Y(11), 9.5 * s, 9 * s, (x, y) => y < Y(9) || Math.abs(x - X(15)) > 6.5 * s) : SH.ell(X(15), Y(8.5), 8.6 * s, 6 * s, (x, y) => y < Y(10.5) || Math.abs(x - X(15)) > 6 * s),
      ramp: L.helm ? ['#2a2834', '#4a4858', '#7a788a', '#aaa8ba'] : L.hair, grp: 5 },
  ];
  if (L.apron) parts.push({ sh: SH.box(X(15), Y(30), 5 * s, 7 * s, 4), ramp: ['#3a2414', '#5a3c26', '#7a5434'], grp: 6 });
  return sculpt(30, 40, parts, a => {
    for (const ex of [12, 18]) { a.rect(X(ex), Y(12), 1, 2, '#1a1012'); }
    a.set(X(11), Y(14.5), '#e88a8a'); a.set(X(19), Y(14.5), '#e88a8a');
    if (L.beard) { a.ell(X(15), Y(17), 5 * s, 3.5 * s, '#e8e4dc'); a.ell(X(15), Y(19), 3 * s, 2.5 * s, '#ffffff'); }
    if (L.spear) { a.line(X(26), Y(38), X(26), Y(2), '#7a5434'); a.line(X(25), Y(5), X(26), Y(0), '#c8c6dc'); a.line(X(27), Y(5), X(26), Y(0), '#9a98b0'); }
    if (L.apron) { a.rect(X(23), Y(26), 2, 6, '#7a788a'); a.rect(X(22), Y(25), 4, 2, '#4a4858'); }      // 手上的小鐵鎚
  });
}
const LOOK: Record<string, Look> = {
  elder: { robe: ['#2a2040', '#40306a', '#5a4690', '#7a64b0'], hair: ['#8a8680', '#b8b4ac', '#e8e4dc'], beard: true },
  guard: { robe: ['#2a2834', '#4a4858', '#6e6c86', '#9a98b0'], hair: [], helm: true, spear: true },
  girl: { robe: ['#5a1a30', '#8a2a48', '#c04a6a', '#e88aa0'], hair: ['#3a1a0a', '#6a3a1a', '#9a5a2a'] },
  smith: { robe: ['#1a1a20', '#2e2e38', '#4a4a58', '#646474'], hair: ['#1a1010', '#3a2420', '#5a3a30'], apron: true },
  hunter: { robe: ['#3a2a18', '#5a4226', '#7a5c38', '#9a784c'], hair: ['#a8b4c8', '#dce4f0', '#ffffff'], hood: true },
  nun: { robe: ['#141a2a', '#222c44', '#344262', '#4a5a80'], hair: ['#c8d0e0', '#e8ecf4', '#ffffff'], hood: true },
  kid: { robe: ['#1a4a2a', '#2a6a3a', '#3a8a4a', '#5aaa62'], hair: ['#5a3a1a', '#8a5a2a', '#b07a3a'], small: true },
};
const ART: Record<string, HTMLCanvasElement> = {}; for (const k in LOOK) ART[k] = hdVillager(LOOK[k]);

/* 居民：town = 哪個鎮，dx/dy = 離鎮中心幾格，lines = 會說的話（依序輪流） */
const DEF = [
  { town: 'dawn', look: 'elder', name: '村長', dx: -2, dy: -3, lines: [
    '歡迎來到晨風鎮，旅人。最近森林深處的狼王越來越兇了……',
    '鎮的西邊有一座鏡湖，湖心的島上住著一隻史萊姆女王。先拿她練練身手吧。',
    '營火可以休息、升級，還能傳送到點燃過的營火。',
    '荒野的盡頭還有雪原和沼澤……聽說星星的碎片，最後都落在那些地方。'] },
  { town: 'dawn', look: 'guard', name: '衛兵', dx: 6, dy: 1, lines: [
    '長按攻擊可以蓄力，放開會放出大招。',
    '地上出現紅色範圍就快閃開！瞬移的那一下不會受傷。',
    '每把武器的技能都不一樣，多換幾把試試看。'] },
  { town: 'dawn', look: 'girl', name: '少女', dx: -6, dy: 2, lines: [
    '聽說荒野裡藏著寶箱，閃閃發光的那種！',
    '有些寶箱會咬人……要小心喔。',
    '地圖上的小黃點，就是還沒打開的寶箱。'] },
  { town: 'dawn', look: 'smith', name: '鐵匠', dx: 6, dy: 8, smith: true, lines: ['要武器嗎？我這裡的貨比流浪商人好。'] },
  { town: 'dawn', look: 'kid', name: '小孩', dx: 2, dy: 6, lines: ['我長大要當冒險者！', '你的帽子好大喔。'] },
  { town: 'frost', look: 'hunter', name: '獵人', dx: -3, dy: -3, lines: [
    '雪原的狼總是成群出沒。聽見狼嚎的時候，牠們已經看見你了。',
    '東北邊的山頂有一座祭壇……我在那裡看過一個巨大的白色身影。',
    '能走到這裡，代表你已經不是普通的旅人了。'] },
  { town: 'frost', look: 'nun', name: '修女', dx: 4, dy: -2, lines: [
    '南邊的沼澤被詛咒了。據說最深處祭壇上的巫妖，會把整片地變成毒沼。',
    '站在綠色的毒沼上會一直扣血，記得快點離開。',
    '願營火的光守護你。'] },
  { town: 'frost', look: 'smith', name: '鐵匠', dx: 6, dy: 8, smith: true, lines: ['在這種冷天打鐵最舒服了。看看吧。'] },
  { town: 'frost', look: 'kid', name: '小孩', dx: -5, dy: 2, lines: ['下雪了！你看，雪花！', '媽媽說不可以去冰封湖玩。'] },
];
export const NPCS = DEF.map(d => { const T = TOWNS.find(t => t.id === d.town);
  return { ...d, lv: T.lv, x: (T.tx + d.dx) * TS + 8, y: (T.ty + d.dy) * TS + 10, line: -1, near: false, flip: d.dx > 0, stock: null as any }; });
export function restockSmiths() { for (const n of NPCS) if (n.smith) n.stock = null; }   // 下次打開店時才產生新貨（ui/shop.ts 的 openShop）
export const nearNPC = (R = 26) => { if (!G.me || G.me.dead) return null; let best = null, bd = R;
  for (const n of NPCS) { if (Math.abs(n.x - G.me.x) > R) continue; const d = Math.hypot(n.x - G.me.x, n.y - G.me.y); if (d < bd) { bd = d; best = n; } } return best; };
export const nearSmith = () => { const n = nearNPC(); return n && n.smith ? n : null; };
/* 每幀：走近的居民轉頭看你、說下一句話（顯示在畫面下方） */
let talking = null;
export function updateNPCs() {
  // 走到 34 以內開始說話，離開 44 才結束（站在邊界上不會一直出現、消失、換下一句）
  const keep = talking && G.me && !G.me.dead && Math.hypot(talking.x - G.me.x, talking.y - G.me.y) < 44 ? talking : null;
  const n = G.started && !G.paused ? keep || nearNPC(34) : null;
  for (const m of NPCS) { const was = m.near; m.near = m === n; if (m.near && !was) { m.line = (m.line + 1) % m.lines.length; flags.add('talk:' + m.town + ':' + m.name); } }
  if (n) n.flip = G.me.x < n.x;
  for (const pl of G.players) for (const m of NPCS) { const dx = pl.x - m.x, dy = pl.y - m.y, d = Math.hypot(dx, dy), R = 9;   // 居民有體積：走過去會被輕輕推開
    if (d < R && d > .01) { const o = { x: pl.x, y: pl.y, r: pl.r }; moveEnt(o, dx / d * (R - d), dy / d * (R - d)); pl.x = o.x; pl.y = o.y; } }
  if (n !== talking) { talking = n; const el = $('talk'); el.hidden = !n;
    if (n) el.innerHTML = '<b>' + n.name + '</b>' + n.lines[n.line] + (n.smith ? '<small>按 E 或下方按鈕交易</small>' : ''); }
}
export function drawNPCs(vis, list) {
  for (const n of NPCS) { if (!vis(n.x, n.y)) continue;
    list.push({ y: n.y, f: () => { const bob = Math.floor(G.time * 2 + n.dx) % 2 ? HK : 0, c = ART[n.look];
      drawShadow(n.x, n.y + 1, 10);
      drawFlip(c, n.x, n.y + 3 - bob, n.flip); } }); }
}
const FLIP = new Map();
function drawFlip(c, x, y, flip) { if (!flip) return drawArtSprite(c, x, y);
  let f = FLIP.get(c); if (!f) { f = document.createElement('canvas'); f.width = c.width; f.height = c.height; const g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); FLIP.set(c, f); }
  drawArtSprite(f, x, y); }
