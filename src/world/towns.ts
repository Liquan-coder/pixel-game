/* ---- 城鎮的居民：走近就會說話（每次走近換一句），鐵匠可以交易 ----
   台詞都放在這裡，之後寫劇情時直接改這個表就好 */
import { G } from '../core/state';
import { $ } from '../core/util';
import { HK, ctx } from '../core/canvas';
import { SH, sculpt } from '../art/monsters';
import { TOWNS, TS } from './map';
import { drawArtSprite } from './chunks';
import { drawShadow } from '../render/player';
import { moveEnt } from '../game/collision';
import { flags, qctx } from '../game/quest';
import { REACTS } from '../data/story';
import { cartoHint, fragsHeld } from './statues';
import { respec } from '../game/player';
import { save } from '../game/save';
import { sfx } from '../core/audio';
import { showBanner } from '../ui/hud';
import type { Player } from '../types';

type Look = { robe: string[]; hair: string[]; skin?: string[]; beard?: boolean; helm?: boolean; apron?: boolean; hood?: boolean; spear?: boolean; small?: boolean; ears?: boolean };   // ears = 精靈的尖耳朵
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
    if (L.ears) for (const [sx, d] of [[X(6.5), -1], [X(23.5), 1]] as const) for (let k = 0; k < 4; k++) { a.set(sx + d * k, Y(11 - k * .8), S[2]); a.set(sx + d * k, Y(12 - k * .8), S[1]); }   // 尖耳朵往兩邊斜上
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
  carto: { robe: ['#2a2414', '#4a3e24', '#6a5a36', '#8a784c'], hair: ['#6a6660', '#9a968c', '#c8c4b8'], beard: true },   // 製圖師
  elfElder: { robe: ['#0e2a2a', '#1a4442', '#2a6460', '#40867a'], hair: ['#8a92a8', '#c8d0e0', '#f4f8fc'], ears: true },   // 精靈（銀葉城）
  elfGuard: { robe: ['#141632', '#22264e', '#32386e', '#464e90'], hair: [], helm: true, spear: true, ears: true },
  elfSmith: { robe: ['#1a2a24', '#2a3e36', '#3e5a4e', '#567a6a'], hair: ['#7a5a20', '#b08a34', '#dcbc58'], apron: true, ears: true },
  elfGirl: { robe: ['#2a2a5a', '#3e3e86', '#5a5ab0', '#8a8ad8'], hair: ['#b08a34', '#dcbc58', '#fff0a8'], ears: true },
  elfPriest: { robe: ['#5a6a8a', '#8a9ab8', '#c4d0e4', '#eef4fa'], hair: ['#8a92a8', '#c8d0e0', '#f4f8fc'], hood: true, ears: true },   // 月之祭司（洗點）
};
const ART: Record<string, HTMLCanvasElement> = {}; for (const k in LOOK) ART[k] = hdVillager(LOOK[k]);

/* 居民：town = 哪個鎮，dx/dy = 離鎮中心幾格，lines = 會說的話（依序輪流） */
const DEF = [
  { town: 'dawn', look: 'elder', name: '村長', dx: -2, dy: -3, lines: [
    '歡迎來到晨風鎮，旅人。最近森林深處的狼王越來越兇了……',
    '鎮的西邊有一座鏡湖。晴朗的夜裡……別盯著湖面看太久。',
    '營火可以休息、升級，還能傳送到點燃過的營火。',
    '荒野的盡頭還有雪原和沼澤……聽說星星的碎片，最後都落在那些地方。'] },
  { town: 'dawn', look: 'guard', name: '衛兵', dx: 6, dy: 1, lines: [
    '長按攻擊可以蓄力，放開會放出大招。',
    '地上出現紅色範圍就快閃開！翻滾的那一下不會受傷。',
    '每把武器的技能都不一樣，多換幾把試試看。'] },
  { town: 'dawn', look: 'girl', name: '少女', dx: -6, dy: 2, lines: [
    '聽說荒野裡藏著寶箱，閃閃發光的那種！',
    '有些寶箱會咬人……要小心喔。',
    '地圖上的小黃點，就是還沒打開的寶箱。'] },
  { town: 'dawn', look: 'carto', name: '製圖師', dx: -7, dy: -4, lines: [
    '我在畫荒野的地圖，可是星墜之夜以後，很多地方都畫不出來了。',
    '如果你撿到舊地圖的殘頁，拿來給我看看。上面常常畫著神像——向神像祈禱的人，就看得見那一整片土地。',
    '平原我畫完了。剩下的……就靠你的腳了。'] },
  { town: 'dawn', look: 'smith', name: '鐵匠', dx: 6, dy: 8, smith: true, lines: ['要武器嗎？我這裡的貨比流浪商人好。'] },
  { town: 'dawn', look: 'kid', name: '小孩', dx: 2, dy: 6, lines: ['我長大要當冒險者！', '你的帽子好大喔。'] },
  { town: 'dawn', look: 'nun', name: '修女', dx: 0, dy: -6, respec: true, lines: [
    '帶著重生水滴來找我。我可以讓你的身體忘掉它學過的東西。',
    '洗掉的力氣不會消失。回到營火，再重新分配一次就好。'] },
  { town: 'frost', look: 'hunter', name: '獵人', dx: -3, dy: -3, lines: [
    '雪原的狼總是成群出沒。聽見狼嚎的時候，牠們已經看見你了。',
    '東北邊的山頂有一座祭壇……我在那裡看過一個巨大的白色身影。',
    '能走到這裡，代表你已經不是普通的旅人了。'] },
  { town: 'frost', look: 'nun', name: '修女', dx: 4, dy: -2, respec: true, lines: [
    '帶著重生水滴來吧。洗掉的點數，回到營火再分配。',
    '南邊的沼澤被詛咒了。據說最深處祭壇上的巫妖，會把整片地變成毒沼。',
    '站在綠色的毒沼上會一直扣血，記得快點離開。',
    '願營火的光守護你。'] },
  { town: 'frost', look: 'carto', name: '製圖師', dx: 2, dy: -5, lines: ['晨風鎮的老傢伙是我師父。殘頁拿給我也一樣。', '雪原的神像在山口那邊……大概吧。'] },
  { town: 'frost', look: 'smith', name: '鐵匠', dx: 6, dy: 8, smith: true, lines: ['在這種冷天打鐵最舒服了。看看吧。'] },
  { town: 'frost', look: 'kid', name: '小孩', dx: -5, dy: 2, lines: ['下雪了！你看，雪花！', '媽媽說不可以去冰封湖玩。'] },
  { town: 'elf', look: 'elfElder', name: '精靈長老', dx: -2, dy: -3, lines: [
    '人類的魔女？……不，你的帽子上，有和她一樣的星星。',
    '星星掉下來的那一夜，我們的王下令關上城門、閉上眼睛。我們活了下來——可是月光再也沒有落下。',
    '王城在島的東邊。王在王座上坐了很多年，一句話也沒有說過。'] },
  { town: 'elf', look: 'elfGuard', name: '精靈衛兵', dx: 6, dy: 1, lines: [
    '月泉的湖心島上插著一把劍。守著它的劍聖，誰靠近都會拔劍。',
    '螢火林的岩壁上有一個洞，王命禁止進入。裡面的月蛾……會把光吃掉。',
    '島上的弓手看得見你，在你看見他們以前。',
    '王城的城門從裡面放下來了。東邊的城牆上次地震塌了一角……我什麼也沒說。'] },
  { town: 'elf', look: 'elfGirl', name: '精靈少女', dx: -6, dy: 2, lines: ['妳是從海的那一邊來的嗎？那邊的天空，晚上也有星星嗎？', '白樹之丘的那棵樹，以前是綠色的喔。'] },
  { town: 'elf', look: 'carto', name: '製圖師', dx: 2, dy: -5, lines: ['我師父在晨風鎮。殘頁拿給我也一樣。', '這座島的神像在北邊的渡口。從森林過橋來的人，第一眼就會看到它。'] },
  { town: 'elf', look: 'elfPriest', name: '月之祭司', dx: 0, dy: -6, respec: true, lines: ['重生水滴是月泉的眼淚。拿來給我，我替你洗去身上的痕跡——之後到營火，重新選一次。'] },
  { town: 'elf', look: 'elfSmith', name: '精靈鐵匠', dx: 6, dy: 8, smith: true, lines: ['精靈打的刀，比月光還薄。看看吧。'] },
];
export const NPCS = DEF.map(d => { const T = TOWNS.find(t => t.id === d.town);
  return { ...d, lv: T.lv, x: (T.tx + d.dx) * TS + 8, y: (T.ty + d.dy) * TS + 10, line: -1, say: '', near: false, flip: d.dx > 0, stock: null as any }; });
/* 走近時要說哪一句：打倒 Boss 之後的新台詞（data/story.ts 的 REACTS）第一次一定先說，之後混進平常的話裡輪流 */
function nextLine(m: typeof NPCS[number]) {
  const rs = REACTS.filter(r => r.npc === m.town + ':' + m.name && r.when(qctx)), fresh = rs.find(r => !flags.has('heard:' + r.id));
  if (fresh) { flags.add('heard:' + fresh.id); return fresh.line; }
  const hint = m.look === 'carto' ? cartoHint() : null;               // 製圖師：照進度暗示下一張殘頁在哪（新的提示第一次一定先說）
  if (hint && !flags.has('heard:carto:' + hint.key)) { flags.add('heard:carto:' + hint.key); return hint.line; }
  const pool = [...m.lines, ...rs.map(r => r.line), ...(hint ? [hint.line] : [])]; m.line = (m.line + 1) % pool.length; return pool[m.line];
}
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
  for (const m of NPCS) { const was = m.near; m.near = m === n; if (m.near && !was) { m.say = nextLine(m); flags.add('talk:' + m.town + ':' + m.name); } }
  if (n) n.flip = G.me.x < n.x;
  for (const pl of G.players) for (const m of NPCS) { const dx = pl.x - m.x, dy = pl.y - m.y, d = Math.hypot(dx, dy), R = 9;   // 居民有體積：走過去會被輕輕推開
    if (d < R && d > .01) { const o = { x: pl.x, y: pl.y, r: pl.r }; moveEnt(o, dx / d * (R - d), dy / d * (R - d)); pl.x = o.x; pl.y = o.y; } }
  if (n !== talking) { talking = n; const el = $('talk'); el.hidden = !n;
    if (n) el.innerHTML = '<b>' + n.name + '</b>' + n.say + (n.smith ? '<small>按 E 或下方按鈕交易</small>' : ''); }
}
export function drawNPCs(vis, list) {
  for (const n of NPCS) { if (!vis(n.x, n.y)) continue;
    list.push({ y: n.y, f: () => { const bob = Math.floor(G.time * 2 + n.dx) % 2 ? HK : 0, c = ART[n.look];
      drawShadow(n.x, n.y + 1, 10);
      drawFlip(c, n.x, n.y + 3 - bob, n.flip);
      if (n.look === 'carto' && fragsHeld().length) drawScroll(n.x, n.y - 30 + Math.sin(G.time * 4) * 1.5); } }); }   // 身上有殘頁：製圖師頭上浮一張小地圖
}
/* 小小的捲軸（像素）：米色紙 + 深色框 + 一個紅點，微微發光閃爍 */
function drawScroll(x, y) {
  const X = Math.round(x / HK) * HK, Y = Math.round(y / HK) * HK, P = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + a * HK, Y + b * HK, w * HK, h * HK); };
  ctx.globalAlpha = .75 + .25 * Math.sin(G.time * 6);
  P(-5, -4, 10, 8, '#2a1e10'); P(-4, -3, 8, 6, '#e8d8b0'); P(-4, -3, 8, 1, '#fff6e0'); P(-5, -4, 1, 8, '#8a6a3a'); P(4, -4, 1, 8, '#8a6a3a');
  P(-2, -1, 3, 1, '#8a7e64'); P(-3, 1, 2, 1, '#8a7e64'); P(1, 0, 1, 1, '#d8434e');
  ctx.globalAlpha = 1;
}
const FLIP = new Map();
function drawFlip(c, x, y, flip) { if (!flip) return drawArtSprite(c, x, y);
  let f = FLIP.get(c); if (!f) { f = document.createElement('canvas'); f.width = c.width; f.height = c.height; const g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); FLIP.set(c, f); }
  drawArtSprite(f, x, y); }

/* ---- 洗點：站在修女 / 月之祭司旁邊按攻擊鍵 → 先確認一次 → 用掉一顆重生水滴，能力值洗回 5，點數到營火分配（ui/interact.ts） ---- */
let respecArm = null;
export function respecTarget(pl: Player, npc): { btn: string; text: string; run: () => void } | null {
  if (!npc || !npc.respec) { respecArm = null; return null; }
  if (!(pl.tears > 0)) return null;
  if (respecArm !== npc) return { btn: '洗點', text: '交出重生水滴（還有 ' + pl.tears + ' 顆）', run: () => { respecArm = npc; } };
  return { btn: '確定', text: '能力值全部洗回 5，點數到營火重新分配（等級不變）', run: () => { respecArm = null;
    const n = respec(pl); sfx.level(); showBanner('能力值洗回去了', n + ' 點可以在營火重新分配', 2600); save(); } };
}
