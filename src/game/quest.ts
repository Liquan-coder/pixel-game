/* ---- 主線：永遠不強制。畫面左上角顯示「下一個建議目標」，地圖上有標記，角色旁邊有一個小箭頭指方向。
   完成條件全部從遊戲狀態判斷（打倒了哪隻 Boss、點了哪個營火…），所以順序亂打也沒關係。
   石碑：走近按 E 閱讀，內容收進地圖畫面的「旅程」分頁。文字都在 data/story.ts ---- */
import { G } from '../core/state';
import { $ } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { SH, sculpt } from '../art/monsters';
import { STEPS, TABLETS, PREMISE, type QuestCtx } from '../data/story';
import { CAMPS, GROUND, MW, ROAD, TS, WALKABLE, discovered, map } from '../world/map';
import { rbDead } from '../world/regionBoss';
import { DUNGEONS, dungeonAt, dungeonHooks } from '../world/dungeons';
import { CHESTS } from '../world/chests';
import { drawArtSprite } from '../world/chunks';
import { drawShadow } from '../render/player';
import { setMenu, showBanner, toast } from '../ui/hud';
import { sfx } from '../core/audio';
import { save } from './save';

export const flags = new Set<string>(), loreRead = new Set<string>();
dungeonHooks.cleared = d => flags.has('dgn:' + d.id);                   // 地城 Boss 倒下 → 大廳的傳送門打開
const qc: QuestCtx = { boss: id => rbDead.has(id), get wolf() { return G.bossDead; }, lit: id => !!CAMPS.find(c => c.id === id)?.lit, found: s => discovered.has(s), flag: f => flags.has(f) };
let doneBefore: Set<string> = null;                                     // 上一次檢查時已經完成的步驟（用來偵測「剛剛完成」）
export const cores = () => STEPS.filter(s => s.core && s.done(qc)).length, CORE_N = STEPS.filter(s => s.core).length;
export const current = () => STEPS.find(s => !s.done(qc)) || STEPS[STEPS.length - 1];
export function resetQuest() { flags.clear(); loreRead.clear(); doneBefore = null; }
let hudKey = '';
export function updateQuest() {
  if (!G.started) return;
  const done = new Set(STEPS.filter(s => s.done(qc)).map(s => s.id));
  if (doneBefore) for (const s of STEPS) if (done.has(s.id) && !doneBefore.has(s.id)) {      // 剛完成一步：播報 + 把這一步的記載收進旅程
    if (s.lore) loreRead.add('step:' + s.id);
    if (s.core) toast('取回星核（' + cores() + '/' + CORE_N + '）', '#ffe38a', true);
    const nx = current(); setTimeout(() => showBanner('旅程更新', nx.title, 2600), 3400); save();
  }
  doneBefore = done;
  const c = current();
  if (c.id !== lastCur) { if (lastCur) setFold(false, true); lastCur = c.id; }       // 接到新目標 → 展開一次讓你看到（不會自動導航）
  const k = c.id + '|' + fold + '|' + (navT ? navT.key : '') + '|' + cores();
  if (k !== hudKey) { hudKey = k; const Q = $('quest'); Q.classList.toggle('fold', fold); Q.classList.toggle('nav', !!navT);
    const navEl = navT ? '<em class="qnav">➤ ' + navT.name + '<button class="qnavx" type="button" title="取消導航">✕</button></em>' : '';
    Q.title = fold ? '展開目標' : '';
    Q.innerHTML = fold ? '<b>◆</b><i>' + STAR + cores() + '/' + CORE_N + '</i>' + navEl
      : '<div class="qh"><b>◆ ' + c.title + '</b><button class="qfold" type="button" title="收起">－</button></div><small>' + c.hint + '</small>'
      + '<div class="qrow"><i>' + STAR + cores() + '/' + CORE_N + '</i>' + (navEl || '<button class="qgo" type="button">➤ 導航</button>') + '</div>'; }
}
/* ---- 左上角的目標：可以收起來（不擋畫面），收起來的狀態記在這台裝置上 ---- */
const STAR = '<svg class="hi" viewBox="0 0 15 15" aria-hidden="true"><path d="M7 0h1v1h-1zM6 2h1v1h-1zM8 2h1v1h-1zM5 3h1v1h-1zM9 3h1v1h-1zM4 4h1v1h-1zM10 4h1v1h-1zM3 5h1v1h-1zM11 5h1v1h-1zM2 6h1v1h-1zM12 6h1v1h-1zM0 7h1v1h-1zM14 7h1v1h-1zM2 8h1v1h-1zM12 8h1v1h-1zM3 9h1v1h-1zM11 9h1v1h-1zM4 10h1v1h-1zM10 10h1v1h-1zM5 11h1v1h-1zM9 11h1v1h-1zM6 12h1v1h-1zM8 12h1v1h-1zM7 14h1v1h-1z" fill="#4a2a08"/><path d="M7 1h1v1h-1zM7 2h1v1h-1zM6 3h2v1h-2zM5 4h3v1h-3zM4 5h4v1h-4zM3 6h4v1h-4zM1 7h5v1h-5zM5 8h2v1h-2zM6 9h1v1h-1z" fill="#ffe38a"/><path d="M8 3h1v1h-1zM8 4h2v1h-2zM8 5h3v1h-3zM8 6h4v1h-4zM3 8h2v1h-2zM4 9h2v1h-2zM5 10h2v1h-2zM6 11h1v1h-1z" fill="#f2c14e"/><path d="M7 6h1v1h-1zM6 7h3v1h-3zM7 8h1v1h-1z" fill="#ffffff"/><path d="M9 7h5v1h-5zM8 8h4v1h-4zM7 9h4v1h-4zM7 10h3v1h-3zM7 11h2v1h-2zM7 12h1v1h-1zM7 13h1v1h-1z" fill="#c0862c"/></svg>';
let fold = (() => { try { return localStorage.getItem('pw-qfold') === '1'; } catch (e) { return false; } })(), lastCur = '';
function setFold(v: boolean, quiet = false) { fold = v; if (!quiet) { try { localStorage.setItem('pw-qfold', v ? '1' : '0'); } catch (e) { /* 私密模式 */ } } hudKey = ''; }
/* ---- 導航：平常沒有箭頭。在地圖上點一個地方（洞窟、營火、城鎮…）按「導航」，或按目標面板的「➤ 導航」，
   角色旁邊才會出現金色箭頭指過去；走到旁邊自動結束，也可以按 ✕ 取消 ---- */
export let navT: { x: number; y: number; name: string; key: string } | null = null;
export function setNav(t: typeof navT) { navT = t; hudKey = ''; if (t) sfx.pick(); updateQuest(); }
$('quest').addEventListener('click', e => {
  const el = e.target as HTMLElement, c = current();
  if (el.closest('.qnavx')) setNav(null);
  else if (el.closest('.qgo')) setNav({ x: c.tx * TS + 8, y: c.ty * TS + 8, name: c.title, key: 'quest:' + c.id });
  else if (el.closest('.qfold')) setFold(true);
  else if (fold) setFold(false);
  updateQuest();
});
/* 角色旁邊的金色小箭頭：只有在導航時出現。走到目標旁邊就結束導航；在地城裡面不顯示（入口在外面） */
export function drawQuestArrow() {
  if (!G.started || G.me.dead || !navT || dungeonAt(G.me.x, G.me.y)) return;
  const x = navT.x, y = navT.y, dx = x - G.me.x, dy = y - G.me.y, d = Math.hypot(dx, dy);
  if (d < 40) { toast('抵達 ' + navT.name, '#ffe38a'); setNav(null); return; }
  const a = Math.atan2(dy, dx), r = 20 + Math.sin(G.time * 4) * 1.5, cx = G.me.x + Math.cos(a) * r, cy = G.me.y - 8 + Math.sin(a) * r * .8;
  ctx.save(); ctx.translate(snapF(cx), snapF(cy)); ctx.rotate(a); ctx.globalAlpha = .85;
  ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -4); ctx.lineTo(-1, 0); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd04a'; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-2, -3); ctx.lineTo(-.5, 0); ctx.lineTo(-2, 3); ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}
/* 地圖上的目標標記（大地圖、小地圖共用）：s = 每格幾個像素，ox/oy = 地圖偏移 */
export function mapMarker(g, s, ox = 0, oy = 0) {
  const c = current(), x = (c.tx - ox) * s, y = (c.ty - oy) * s, p = 3 + Math.sin(G.time * 5) * 1;
  g.fillStyle = '#1a1020'; g.beginPath(); g.moveTo(x, y - p - 3); g.lineTo(x + p + 3, y); g.lineTo(x, y + p + 3); g.lineTo(x - p - 3, y); g.closePath(); g.fill();
  g.fillStyle = '#ffd04a'; g.beginPath(); g.moveTo(x, y - p - 1); g.lineTo(x + p + 1, y); g.lineTo(x, y + p + 1); g.lineTo(x - p - 1, y); g.closePath(); g.fill();
}

/* ---- 石碑 ---- */
export const TAB = TABLETS.map(t => ({ ...t, x: 0, y: 0 }));
export function placeTablets() {                                       // 地圖生成後：把石碑放到附近走得到的空地
  for (const d of DUNGEONS) { const p = (d as any).tablet; if (p && !TAB.some(t => t.id === 'd_' + d.id)) TAB.push({ id: 'd_' + d.id, tx: p[0], ty: p[1], title: d.lore.title, text: d.lore.text, x: 0, y: 0 }); }   // 地城裡的石碑
  const I = (x, y) => y * MW + x, ok = (x, y) => (map[I(x, y)] === GROUND || map[I(x, y)] === ROAD) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => WALKABLE(map[I(x + a, y + b)])) && !CHESTS.some(c => Math.abs(c.tx - x) + Math.abs(c.ty - y) < 3);
  for (const t of TAB) { let best = null; for (let r = 0; r < 10 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(t.tx + dx, t.ty + dy)) { best = [t.tx + dx, t.ty + dy]; break; }
    if (best) { t.tx = best[0]; t.ty = best[1]; } t.x = t.tx * TS + 8; t.y = t.ty * TS + 10; }
}
const STONE = sculpt(26, 34, [{ sh: SH.box(13, 19, 10, 14, 5), ramp: ['#2a2834', '#4a4858', '#6e6c86', '#8e8ca6', '#aeacc4'], tex: .25, grp: 1 },
  { sh: SH.ell(13, 7, 10, 6, (x, y) => y < 8), ramp: ['#2a2834', '#4a4858', '#6e6c86', '#8e8ca6'], tex: .2, grp: 1 }], a => {
  for (const [x0, y0, x1, y1] of [[8, 12, 18, 12], [8, 16, 15, 16], [8, 20, 17, 20], [8, 24, 13, 24]]) a.line(x0, y0, x1, y1, '#7ab8e8');
  a.set(13, 6, '#dcecff'); a.set(12, 7, '#7ab8e8'); a.set(14, 7, '#7ab8e8'); a.set(13, 8, '#7ab8e8');
  for (let x = 2; x < 24; x++) if (a.get(x, 31)) a.set(x, 31, '#3a6a2e'); });
export const nearTablet = () => { if (!G.me || G.me.dead) return null; for (const t of TAB) if (Math.abs(t.x - G.me.x) < 20 && Math.hypot(t.x - G.me.x, t.y - G.me.y) < 20) return t; return null; };
export function readTablet(t) {
  $('loreTitle').textContent = t.title; $('loreText').textContent = t.text;
  if (!loreRead.has(t.id)) { loreRead.add(t.id); toast('記下了「' + t.title + '」', '#9ac8ff'); save(); }
  sfx.pick(); setMenu('lore');
}
$('loreMenu').addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (b && b.hasAttribute('data-close')) setMenu(null); });
export function drawTablets(vis, list, L, addLight) {
  for (const t of TAB) { if (!vis(t.x, t.y)) continue;
    list.push({ y: t.y, f: () => { drawShadow(t.x, t.y + 1, 9); drawArtSprite(STONE, t.x, t.y + 3);
      if (!loreRead.has(t.id)) { const k = (G.time * .8 + t.tx) % 1; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#9ac8ff'; ctx.fillRect(snapF(t.x - HK), snapF(t.y - 14 - k * 8), HK * 2, HK * 2); ctx.globalAlpha = 1; } } });
    addLight(L, t.x, t.y - 6, loreRead.has(t.id) ? 14 : 22, 2); }
}

/* ---- 旅程分頁（地圖畫面裡） ---- */
export function renderJournal() {
  const c = current();
  const steps = STEPS.map(s => { const d = s.done(qc), cur = s === c; return '<li class="' + (d ? 'done' : cur ? 'cur' : '') + '"><span>' + (d ? '✓' : cur ? '◆' : '·') + '</span>' + s.title + (cur ? '<small>' + s.hint + '</small>' : '') + '</li>'; }).join('');
  const lore = STEPS.filter(s => s.lore && loreRead.has('step:' + s.id)).map(s => '<details><summary>' + s.title + '</summary><p>' + s.lore + '</p></details>')
    .concat(TAB.filter(t => loreRead.has(t.id)).map(t => '<details><summary>' + t.title + '</summary><p>' + t.text + '</p></details>')).join('');
  $('journal').innerHTML = '<p class="premise">' + PREMISE + '</p><div class="lbl">主線（照自己的步調走，順序可以打亂）・星核 ' + cores() + '/' + CORE_N + '</div><ol class="qsteps">' + steps + '</ol>' +
    '<div class="lbl" style="margin-top:10px">記載・' + (loreRead.size) + ' 則</div>' + (lore || '<p class="hintp">完成主線目標、閱讀各地的石碑，會一點一點拼出星墜之夜的真相。</p>');
}
