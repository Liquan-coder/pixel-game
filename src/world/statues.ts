/* ================= 星之神像：把地圖一大片一大片點亮 =================
   地圖分成 6 塊：一開始只有翠風平原（起點 + 第一隻 Boss）是亮的，其他 5 塊各有一座「星之神像」。
   流程：打倒 Boss → 掉「地圖殘頁」→ 拿給城鎮的製圖師 → 他在地圖上標出神像的位置 → 走過去祈禱 → 那一整塊地區亮起來
   （地形、營火、地城、地標全部顯示）。沒點亮的地方只看得到自己走過的路，也看不到營火和地城在哪。
   神像放在地區的交界處（從前一個地區走過去就會碰到）。不拿殘頁、自己找到神像也可以直接祈禱。

   殘頁：frag:1～5（史萊姆女王、蘑菇王、骸骨將軍、熔岩巨龍、雪原巨人）；交給製圖師：given:k；祈禱過：statue:k；一開始的平原：chart:0 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { SH, sculpt } from '../art/monsters';
import { MH, MW, PROPS, REGIONS, ROAD, TS, WALKABLE, explored, map, reg } from './map';
import { drawArtSprite } from './chunks';
import { redrawMini } from './minimap';
import { flags, setNav } from '../game/quest';
import { showBanner, toast } from '../ui/hud';
import { save } from '../game/save';
import { drawShadow } from '../render/player';
import type { Player } from '../types';

/* 地區 → 第幾塊地圖（0 = 一開始就亮的平原；4 = 狼王巢穴跟森林一起；7 = 地城，不算） */
const ZONE_OF_REG = [0, 1, 2, 3, 1, 4, 5, -1, 6];                 // 8 = 精靈王國 → 第 6 塊
export const ZONE_NAME = ['翠風平原', '迷霧森林', '骸骨荒地', '熔岩高地', '霜寒雪原', '幽影沼澤', '精靈王國'];
/* 神像 k（1～5）：放在 a、b 兩個地區的交界，越靠近 hint 越好；frag = 哪隻 Boss 掉這張殘頁 */
const DEF = [
  { k: 1, a: 0, b: 1, hint: [190, 410], frag: 'queen' },
  { k: 2, a: 0, b: 2, hint: [70, 296], frag: 'mushking' },
  { k: 3, a: 1, b: 3, hint: [250, 220], frag: 'general' },
  { k: 4, a: 3, b: 5, hint: [430, 110], frag: 'dragon' },
  { k: 5, a: 5, b: 6, hint: [480, 225], frag: 'yeti' },
  { k: 6, a: 8, b: 1, hint: [347, 422], frag: 'mistwitch' },            // 精靈王國：林間渡口（從森林過橋上島的地方）；殘頁 = 霧林女妖
];
export const STATUE_N = DEF.length;
export interface Statue { k: number; x: number; y: number; tx: number; ty: number; frag: string; prop: { x: number; y: number; r: number } }
export const STATUES: Statue[] = [];
export const fragBoss = (k: number) => DEF[k - 1].frag;

/* 生成：main.ts 在 dressEntrances / setupPuzzles 之後呼叫 */
export function placeStatues() {
  STATUES.length = 0;
  const I = (x: number, y: number) => y * MW + x, near = (x: number, y: number, r: number, R: number) => { for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < MW && Y < MH && reg[I(X, Y)] === r) return true; } return false; };
  for (const D of DEF) { let best: number[] | null = null, bd = Infinity;
    for (let y = D.hint[1] - 60; y <= D.hint[1] + 60; y++) for (let x = D.hint[0] - 60; x <= D.hint[0] + 60; x++) {
      if (x < 3 || y < 3 || x >= MW - 3 || y >= MH - 3) continue; const t = map[I(x, y)];
      if (!WALKABLE(t) || t === ROAD || ![[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].every(([a, b]) => WALKABLE(map[I(x + a, y + b)]))) continue;
      if (reg[I(x, y)] !== D.a && reg[I(x, y)] !== D.b) continue;
      const border = near(x, y, D.a, 5) && near(x, y, D.b, 5), road = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0]].some(([a, b]) => map[I(x + a, y + b)] === ROAD);
      const d = Math.hypot(x - D.hint[0], y - D.hint[1]) + (border ? 0 : 80) + (road ? 0 : 12);   // 交界、路邊（從路上看得到）優先
      if (d < bd) { bd = d; best = [x, y]; } }
    if (!best) continue; const [tx, ty] = best, x = tx * TS + 8, y = ty * TS + 12, prop = { x, y, r: 7 };
    PROPS.push(prop); STATUES.push({ k: D.k, x, y, tx, ty, frag: D.frag, prop }); }
}

/* ---- 點亮一塊地圖：那一塊的每一格都算「看過了」→ 小地圖 / 大地圖都會畫出來 ---- */
export function chartZone(z: number) {
  for (let i = 0; i < MW * MH; i++) if (!explored[i] && ZONE_OF_REG[reg[i]] === z) explored[i] = 1;
  flags.add('chart:' + z); redrawMini();
}
export const charted = (z: number) => flags.has('chart:' + z);
export const zoneAt = (tx: number, ty: number) => ZONE_OF_REG[reg[Math.floor(ty) * MW + Math.floor(tx)]] ?? -1;
/** 地圖上看得到神像嗎：製圖師標過、祈禱過、或自己在畫面上看到過（點亮地區不會順便標出神像） */
export const zoneOfReg = (r: number) => ZONE_OF_REG[r] ?? -1;
export const statueKnown = (s: Statue) => flags.has('given:' + s.k) || flags.has('statue:' + s.k) || flags.has('seen:s' + s.k);
export const statueLit = (s: Statue) => flags.has('statue:' + s.k);
export const fragsHeld = () => DEF.filter(D => flags.has('frag:' + D.k) && !flags.has('given:' + D.k)).map(D => D.k);
export const fragCount = () => DEF.filter(D => flags.has('statue:' + D.k)).length;

/* ---- 每幀（game/quest.ts 的 updateQuest 呼叫）：打倒 Boss → 拿到殘頁；開新遊戲 / 舊存檔 → 平原一定是亮的 ---- */
export function updateStatues(bossDead: (id: string) => boolean) {
  if (!charted(0)) chartZone(0);
  for (const D of DEF) if (!flags.has('frag:' + D.k) && bossDead(D.frag)) { flags.add('frag:' + D.k);
    setTimeout(() => { showBanner('得到 地圖殘頁', '上面畫著一座神像……城鎮的製圖師也許看得懂', 3200);
      toast('地圖殘頁：拿給晨風鎮或霜寒鎮的製圖師', '#e8d8b0', true); }, 6400); save(); }
}

/* ---- 互動（ui/interact.ts）：神像 = 祈禱；製圖師 = 交出殘頁 ---- */
export function statueTarget(pl: Player): { btn: string; text: string; run: () => void } | null {
  for (const s of STATUES) if (!statueLit(s) && Math.hypot(s.x - pl.x, s.y - pl.y) < 26) return { btn: '祈禱', text: '向星之神像祈禱', run: () => pray(s) };
  return null;
}
function pray(s: Statue) {
  flags.add('statue:' + s.k); chartZone(s.k); sfx.level(); sfx.epic();
  for (const dl of [0, .15, .3]) G.fx.push({ k: 'warp', x: s.x, y: s.y - 20, r0: 6, r1: 120, th: 5, delay: dl, t: 0, d: .8 + dl, col: dl ? '#ffe38a' : '#c8a8ff' });
  for (let i = 0; i < 40; i++) { const a = rr(0, TAU), v = rr(40, 160); G.parts.push({ x: s.x, y: s.y - 34, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rr(.6, 1.4), max: 1.4, col: pick(['#ffe38a', '#fff6d0', '#c8a8ff', '#ffffff']), star: rr(1, 3), drag: 2 }); }
  const all = fragCount() >= STATUE_N;
  showBanner(all ? '整片荒野都在地圖上了' : '地圖亮了起來', ZONE_NAME[s.k] + (all ? '' : ' · 打開地圖看看'), 3200); save();
}
export function cartoTarget(pl: Player, npc: { name: string; x: number; y: number } | null): { btn: string; text: string; run: () => void } | null {
  if (!npc || npc.name !== '製圖師' || !fragsHeld().length) return null;
  return { btn: '交出', text: '把地圖殘頁交給製圖師', run: () => { const ks = fragsHeld(); for (const k of ks) flags.add('given:' + k);
    sfx.pick(); toast('製圖師把殘頁拼好，在你的地圖上畫了' + (ks.length > 1 ? ' ' + ks.length + ' 個' : '一個') + '記號：「星之神像。去那裡祈禱，地圖就會亮起來。」', '#e8d8b0');
    let to: Statue | null = null, bd = Infinity;                       // 自動導航到最近的那座（角色旁邊出現金色箭頭）
    for (const s of STATUES) if (ks.includes(s.k) && !statueLit(s)) { const d = Math.hypot(s.x - pl.x, s.y - pl.y); if (d < bd) { bd = d; to = s; } }
    if (to) setNav({ x: to.x, y: to.y, name: '星之神像', key: 'statue:' + to.k });
    save(); } };
}

/* ---- 畫：石座上的女神像，雙手捧著一顆星。祈禱過 = 星星發光、頭上一道淡淡的光柱 ---- */
const STONE = ['#2e2a36', '#4a4558', '#6a6478', '#8e88a0', '#b8b2c8'];
const ART = sculpt(54, 140, [{ sh: SH.box(27, 128, 24, 11, 4), ramp: STONE, tex: .3, grp: 1 }, { sh: SH.box(27, 114, 26, 4, 6), ramp: STONE, bias: .15, grp: 2 },
  { sh: SH.poly([[12, 112], [42, 112], [35, 56], [19, 56]]), ramp: STONE, tex: .25, grp: 3 }, { sh: SH.ell(27, 56, 11, 7), ramp: STONE, grp: 4 },
  { sh: SH.ell(27, 42, 8, 10), ramp: STONE, grp: 5 }, { sh: SH.poly([[17, 40], [27, 18], [37, 40]]), ramp: STONE, tex: .2, grp: 6 },   // 頭 + 尖帽
  { sh: SH.cap(18, 60, 27, 32, 3, 3), ramp: STONE, grp: 7 }, { sh: SH.cap(36, 60, 27, 32, 3, 3), ramp: STONE, grp: 7 }], a => {
  for (let k = 0; k < 30; k++) { const x = 8 + ((k * 37) % 40), y = 40 + ((k * 53) % 96); if (a.get(x, y)) a.set(x, y, k % 3 ? STONE[0] : '#3e5a3a'); }
  a.rect(23, 44, 8, 2, '#1e1a24'); });
export function drawStatues(vis, list, L, addLight) {
  for (const s of STATUES) { if (!vis(s.x, s.y, 240)) continue; const lit = statueLit(s), orbY = s.y + 2 - 140 * HK + 29 * HK;
    if (!flags.has('seen:s' + s.k) && vis(s.x, s.y, -20)) flags.add('seen:s' + s.k);                     // 在畫面上看到了 → 地圖上記下來
    list.push({ y: s.y, f: () => { drawShadow(s.x, s.y + 1, 22); drawArtSprite(ART, s.x, s.y + 2);
      const p = .6 + .4 * Math.sin(G.time * 3 + s.k);
      ctx.globalAlpha = lit ? 1 : .35 + .25 * p; ctx.fillStyle = lit ? '#ffe38a' : '#8a84a0';                       // 捧著的星星
      for (const [dx, dy, w, h] of [[-1, -3, 2, 6], [-3, -1, 6, 2], [-.5, -.5, 1, 1]]) ctx.fillRect(snapF(s.x + dx), snapF(orbY + dy), w, h);
      ctx.globalAlpha = 1;
      const H = lit ? 80 : 220, g = ctx.createLinearGradient(0, orbY - H, 0, orbY);   // 光柱：點亮 = 金色短柱；還沒祈禱 = 很高的紫柱（遠遠就看得到）
      g.addColorStop(0, lit ? 'rgba(255,226,140,0)' : 'rgba(200,168,255,0)'); g.addColorStop(1, lit ? 'rgba(255,236,170,' + (.22 * p) + ')' : 'rgba(200,168,255,' + (.18 + .12 * p) + ')');
      ctx.fillStyle = g; ctx.fillRect(snapF(s.x - (lit ? 3 : 4)), snapF(orbY - H), lit ? 6 : 8, H); } });
    addLight(L, s.x, orbY, lit ? 54 : 26, lit ? 4 : 3);
    if (!lit && Math.random() < .08) G.parts.push({ x: s.x + rr(-4, 4), y: orbY, vx: rr(-3, 3), vy: -rr(6, 14), life: 1.2, max: 1.2, col: '#c8a8ff', star: rr(.5, 1.1), drag: 1 }); }
}
