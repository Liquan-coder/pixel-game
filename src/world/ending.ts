/* ================= 結局：沉沒遺跡（觀星台）中間的觀星儀 =================
   · 觀星儀上有七個凹槽：拿到幾顆星核就亮幾個（還沒拿齊也看得到 → 玩家知道這裡很重要）
   · 七顆都拿到 + 最後的看守者倒下（data/story.ts 的 FINAL_GATE）→ 一道金色光柱，遠遠就看得到
   · 走過去按「仰望」→ 選結局 → 一句一句出現的結局文字 → 回到荒野（可以再回來選別的結局）
   文字都在 data/story.ts 的 ENDINGS。 */
import { G } from '../core/state';
import { TAU, pick, rr } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { sfx } from '../core/audio';
import { SH, sculpt } from '../art/monsters';
import { MW, PROPS, TS, WALKABLE, map } from './map';
import { drawArtSprite } from './chunks';
import { CHESTS } from './chests';
import { drawShadow } from '../render/player';
import { CORE_N, cores, flags, qctx } from '../game/quest';
import { ENDINGS, FINAL_GATE } from '../data/story';
import { openMenu, setMenu, toast } from '../ui/hud';
import { save } from '../game/save';
import type { Player } from '../types';

const AT = [160, 61];                                                   // 觀星台內室的中間（world/landmarks.ts 的 sunken）
export const ALTAR = { x: 0, y: 0, placed: false };
/* main.ts 呼叫 placeStatues() 的時候順便放（statues.ts 會呼叫這裡）：找內室中間最近、四周都走得到、離寶箱 4 格以上的那一格（不然攻擊鍵會變成「打開」） */
export function placeAltar() {
  let best: number[] | null = null;
  const farChest = (x: number, y: number) => !CHESTS.some(c => Math.abs(c.tx - x) + Math.abs(c.ty - y) < 5);
  for (let r = 0; r < 8 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) { const x = AT[0] + dx, y = AT[1] + dy;
    if (farChest(x, y) && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 2]].every(([a, b]) => WALKABLE(map[(y + b) * MW + x + a]))) { best = [x, y]; break; } }
  const [tx, ty] = best || AT; ALTAR.x = tx * TS + 8; ALTAR.y = ty * TS + 10; ALTAR.placed = true;
  PROPS.push({ x: ALTAR.x, y: ALTAR.y, r: 7 });
}
export const endingReady = () => cores() >= CORE_N && FINAL_GATE(qctx);
export const endingsSeen = () => ENDINGS.filter(e => flags.has('end:' + e.id));

/* ---- 互動（ui/interact.ts） ---- */
export function altarTarget(pl: Player): { btn: string; text: string; run: () => void } | null {
  if (!ALTAR.placed || Math.hypot(ALTAR.x - pl.x, ALTAR.y + 6 - pl.y) > 26) return null;
  if (endingReady()) return { btn: '仰望', text: '把七顆星核放上觀星儀', run: openChoice };
  return { btn: '調查', text: '一座古老的觀星儀', run: () => { sfx.pick();
    const n = cores();
    toast(n >= CORE_N ? '七個凹槽都亮了。可是星核還在發燙，好像有什麼東西還拉著它們——在很深、很濕的地方。'
      : n ? '觀星儀上有七個凹槽，其中 ' + n + ' 個隨著你帽子上的星星一起發光。' : '觀星儀上有七個空的凹槽。指針指著天上，一動也不動。', '#e8d8b0'); } };
}

/* ---- 結局畫面（自己建 DOM，不佔 index.html） ---- */
let el: HTMLDivElement | null = null;
function screen() {
  if (el) return el;
  el = document.createElement('div'); el.id = 'endScreen'; el.hidden = true; document.body.appendChild(el);
  el.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button');
    if (!b) { el.querySelectorAll('.endl').forEach(n => n.classList.add('now')); return; }   // 點空白：文字一次全部出現
    if (b.dataset.end) play(b.dataset.end); else close(); });
  return el;
}
function openChoice() {
  const s = screen(), opts = ENDINGS.filter(e => !e.need || e.need(qctx)), seen = endingsSeen();
  sfx.epic(); setMenu('end');
  s.innerHTML = '<div class="endbox"><h2>觀星儀</h2><p class="endl now">七顆星核在凹槽裡慢慢轉動，發出細細的歌聲。<br>它們在等你決定。</p>'
    + '<div class="endopts">' + opts.map(e => '<button type="button" class="endopt" data-end="' + e.id + '"><b>' + e.pick + '</b><small>' + e.hint + (flags.has('end:' + e.id) ? '・看過了' : '') + '</small></button>').join('') + '</div>'
    + (seen.length ? '<p class="endseen">見過的結局 ' + seen.length + ' / ' + ENDINGS.length + '</p>' : '')
    + '<button type="button" class="sbtn endback">還沒準備好</button></div>';
  s.hidden = false;
}
function play(id: string) {
  const e = ENDINGS.find(x => x.id === id); if (!e) return;
  const first = !flags.has('end:' + id); flags.add('end:' + id); save(); sfx.level();
  const s = screen(), n = e.lines.length, D = 2.6;                     // 每句隔 2.6 秒
  s.innerHTML = '<div class="endbox">' + e.lines.map((t, i) => '<p class="endl" style="animation-delay:' + (i * D + .4) + 's">' + t + '</p>').join('')
    + '<h2 class="endl endtitle" style="animation-delay:' + (n * D + .6) + 's">— ' + e.title + ' —</h2>'
    + '<p class="endl endseen" style="animation-delay:' + (n * D + 1.4) + 's">見過的結局 ' + endingsSeen().length + ' / ' + ENDINGS.length + (first ? '' : '（看過了）') + '</p>'
    + '<button type="button" class="sbtn endl endback" style="animation-delay:' + (n * D + 1.8) + 's">回到荒野</button></div>';
  for (let i = 0; i < 60; i++) { const a = rr(0, TAU), v = rr(40, 200); G.parts.push({ x: ALTAR.x, y: ALTAR.y - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rr(1, 2.2), max: 2.2, col: pick(['#ffe38a', '#fff6d0', '#c8a8ff', '#ffffff']), star: rr(1, 3), drag: 1.5 }); }
}
function close() { if (el) el.hidden = true; setMenu(null); }
export const endingOpen = () => !!el && !el.hidden;

/* ---- 畫：石座 + 支柱 + 托盤；上面一圈渾天儀（會轉），七個凹槽排成弧形 ---- */
const STONE = ['#2a2632', '#46404f', '#625a6e', '#857c92', '#aaa2b8'];
const ART = sculpt(42, 72, [{ sh: SH.box(21, 64, 18, 7, 4), ramp: STONE, tex: .3, grp: 1 }, { sh: SH.box(21, 54, 12, 4, 5), ramp: STONE, bias: .1, grp: 2 },
  { sh: SH.poly([[16, 52], [26, 52], [24, 30], [18, 30]]), ramp: STONE, tex: .2, grp: 3 }, { sh: SH.ell(21, 28, 13, 4), ramp: STONE, bias: .15, grp: 4 }], a => {
  for (let k = 0; k < 18; k++) { const x = 5 + ((k * 29) % 32), y = 58 + ((k * 13) % 12); if (a.get(x, y)) a.set(x, y, k % 2 ? STONE[0] : '#8a7a50'); }   // 沙子、裂痕
  a.line(17, 40, 25, 40, '#c0862c'); a.line(17, 44, 25, 44, '#8a6a2a'); });
const CORE_COL = ['#d8d0c0', '#c86ae0', '#9ae0ff', '#5ae08a', '#ff8a3a', '#e8c0a0', '#a080ff'];   // 骨、菌、霜、翠、焰、牙、影
export function drawAltar(vis, list, L, addLight) {
  if (el && !el.hidden && openMenu !== 'end') el.hidden = true;          // 按 Esc / 開別的選單 → 結局畫面跟著關掉
  if (!ALTAR.placed || !vis(ALTAR.x, ALTAR.y, 260)) return;
  const n = cores(), ready = endingReady(), done = endingsSeen().length > 0, x = ALTAR.x, y = ALTAR.y, top = y + 2 - 72 * HK + 26 * HK;
  list.push({ y, f: () => { drawShadow(x, y + 1, 18); drawArtSprite(ART, x, y + 2);
    const t = G.time * (ready ? .9 : .25), cy = top - 7;
    ctx.globalAlpha = .85; ctx.strokeStyle = ready ? '#f2c14e' : '#8a7a5a'; ctx.lineWidth = HK * 2;
    for (const [rx, ry, ph] of [[8, 3, 0], [7, 7, t], [3.5, 8, -t]] as const) { ctx.beginPath(); ctx.ellipse(x, cy, Math.abs(rx * Math.cos(ph)) + 1, ry, 0, 0, TAU); ctx.stroke(); }   // 渾天儀的三個環
    for (let i = 0; i < CORE_N; i++) { const a = Math.PI * (1.1 + .8 * i / (CORE_N - 1)), sx = x + Math.cos(a) * 11, sy = top + 3 + Math.sin(a) * -3.5 - 1, on = i < n;   // 七個凹槽
      ctx.globalAlpha = 1; ctx.fillStyle = '#120d1c'; ctx.fillRect(snapF(sx - 1), snapF(sy - 1), 2, 2);
      if (on) { const p = .7 + .3 * Math.sin(G.time * 3 + i); ctx.globalAlpha = p; ctx.fillStyle = CORE_COL[i]; ctx.fillRect(snapF(sx - 2 * HK), snapF(sy - 2 * HK), 4 * HK, 4 * HK); } }
    ctx.globalAlpha = 1;
    if (ready) { const p = .7 + .3 * Math.sin(G.time * 2.2), H = done ? 90 : 260, g = ctx.createLinearGradient(0, cy - H, 0, cy);   // 光柱：可以選結局了 → 很高的金柱
      g.addColorStop(0, 'rgba(255,226,140,0)'); g.addColorStop(1, 'rgba(255,236,170,' + (.28 * p) + ')'); ctx.fillStyle = g; ctx.fillRect(snapF(x - 5), snapF(cy - H), 10, H); } } });
  addLight(L, x, top, ready ? 70 : 18 + n * 4, ready ? 4 : 2);
  if (ready && Math.random() < .2) G.parts.push({ x: x + rr(-8, 8), y: top, vx: rr(-4, 4), vy: -rr(10, 24), life: 1.4, max: 1.4, col: pick(['#ffe38a', '#fff6d0']), star: rr(.6, 1.3), drag: 1 });
}
