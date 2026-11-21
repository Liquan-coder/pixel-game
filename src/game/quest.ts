/* ---- 主線（碎片化）：沒有任務清單。左上角只顯示「星核 n/7 · 地圖 k/5」和最近聽到的一則傳聞。
   故事從記憶碎片（星核）、傳聞、石碑、居民的話拼起來；全部收進地圖畫面的「旅程」分頁。文字在 data/story.ts。
   完成條件全部從遊戲狀態判斷（打倒了誰、點了哪個營火、讀過哪塊石碑…），順序亂打也沒關係 ---- */
import { G } from '../core/state';
import { $ } from '../core/util';
import { HK, ctx, snapF } from '../core/canvas';
import { SH, sculpt } from '../art/monsters';
import { CORES, MEM_N, PREMISE, RUMORS, TABLETS, type QuestCtx } from '../data/story';
import { CAMPS, GROUND, MW, ROAD, TS, WALKABLE, discovered, map } from '../world/map';
import { rbDead } from '../world/regionBoss';
import { DUNGEONS, dungeonAt, dungeonHooks } from '../world/dungeons';
import { CHESTS } from '../world/chests';
import { drawArtSprite } from '../world/chunks';
import { drawShadow } from '../render/player';
import { setMenu, showBanner, toast } from '../ui/hud';
import { sfx } from '../core/audio';
import { forgeFlags } from '../data/forge';
import { save } from './save';
import { fragCount, fragsHeld, updateStatues, ZONE_NAME } from '../world/statues';

export const flags = new Set<string>(), loreRead = new Set<string>();
dungeonHooks.cleared = d => flags.has('dgn:' + d.id);
forgeFlags.has = f => flags.has(f);                                 // 鍛造圖看地城有沒有打過（data/forge.ts）                   // 地城 Boss 倒下 → 大廳的傳送門打開
const qc: QuestCtx = { boss: id => rbDead.has(id), get wolf() { return G.bossDead; }, lit: id => !!CAMPS.find(c => c.id === id)?.lit, found: s => discovered.has(s), flag: f => flags.has(f), read: t => loreRead.has(t) };
export const cores = () => CORES.filter(c => c.done(qc)).length, CORE_N = CORES.length;
export const rumorsKnown = () => RUMORS.filter(r => flags.has('rumor:' + r.id));
export const rumorsOpen = () => rumorsKnown().filter(r => !r.done(qc));
export function resetQuest() { flags.clear(); loreRead.clear(); coresBefore = null; }
let hudKey = '', coresBefore: Set<string> | null = null;
export function updateQuest() {
  if (!G.started) return;
  updateStatues(id => rbDead.has(id));                                   // 地圖殘頁、一開始亮的平原（world/statues.ts）
  const got = new Set(CORES.filter(c => c.done(qc)).map(c => c.id));
  if (coresBefore) for (const c of CORES) if (got.has(c.id) && !coresBefore.has(c.id)) {   // 剛拿到一顆星核：記憶碎片收進旅程
    loreRead.add('mem:' + c.id); toast('取回' + c.name + '（' + cores() + '/' + CORE_N + '）', '#ffe38a', true);
    setTimeout(() => showBanner('記憶碎片 ' + MEM_N[c.mem - 1], '在地圖的「旅程」裡閱讀', 2800), 3400); save(); }
  coresBefore = got;
  for (const r of RUMORS) if (!flags.has('rumor:' + r.id) && r.learn(qc)) {                  // 聽到新的傳聞
    flags.add('rumor:' + r.id); if (r.id !== 'town') toast('傳聞：「' + r.text + '」', '#e8d8b0'); hudKey = ''; }
  const top = rumorsOpen().slice(-1)[0], held = fragsHeld().length;
  const k = (top ? top.id : '') + '|' + fold + '|' + (navT ? navT.key : '') + '|' + cores() + '|' + fragCount() + '|' + held;
  if (k !== hudKey) { hudKey = k; const Q = $('quest'); Q.classList.toggle('fold', fold); Q.classList.toggle('nav', !!navT);
    const navEl = navT ? '<em class="qnav">➤ ' + navT.name + '<button class="qnavx" type="button" title="取消導航">✕</button></em>' : '';
    const stat = '<i>' + STAR + cores() + '/' + CORE_N + '</i><i class="qmap">地圖 ' + fragCount() + '/5' + (held ? ' · <span class="qfrag">殘頁 ' + held + ' → 製圖師</span>' : '') + '</i>';
    Q.title = fold ? '展開' : '';
    Q.innerHTML = fold ? '<b>◆</b>' + stat + navEl
      : '<div class="qh"><b>◆ 旅程</b><button class="qfold" type="button" title="收起">－</button></div>'
      + (top ? '<small>「' + top.text + '」</small><i class="qsrc">——' + top.src + '</i>' : '<small>沒有新的傳聞。也許該到處走走，和人說說話。</small>')
      + '<div class="qrow">' + stat + navEl + '</div>'; }
}
/* ---- 左上角：可以收起來（不擋畫面），收起來的狀態記在這台裝置上 ---- */
const STAR = '<svg class="hi" viewBox="0 0 15 15" aria-hidden="true"><path d="M7 0h1v1h-1zM6 2h1v1h-1zM8 2h1v1h-1zM5 3h1v1h-1zM9 3h1v1h-1zM4 4h1v1h-1zM10 4h1v1h-1zM3 5h1v1h-1zM11 5h1v1h-1zM2 6h1v1h-1zM12 6h1v1h-1zM0 7h1v1h-1zM14 7h1v1h-1zM2 8h1v1h-1zM12 8h1v1h-1zM3 9h1v1h-1zM11 9h1v1h-1zM4 10h1v1h-1zM10 10h1v1h-1zM5 11h1v1h-1zM9 11h1v1h-1zM6 12h1v1h-1zM8 12h1v1h-1zM7 14h1v1h-1z" fill="#4a2a08"/><path d="M7 1h1v1h-1zM7 2h1v1h-1zM6 3h2v1h-2zM5 4h3v1h-3zM4 5h4v1h-4zM3 6h4v1h-4zM1 7h5v1h-5zM5 8h2v1h-2zM6 9h1v1h-1z" fill="#ffe38a"/><path d="M8 3h1v1h-1zM8 4h2v1h-2zM8 5h3v1h-3zM8 6h4v1h-4zM3 8h2v1h-2zM4 9h2v1h-2zM5 10h2v1h-2zM6 11h1v1h-1z" fill="#f2c14e"/><path d="M7 6h1v1h-1zM6 7h3v1h-3zM7 8h1v1h-1z" fill="#ffffff"/><path d="M9 7h5v1h-5zM8 8h4v1h-4zM7 9h4v1h-4zM7 10h3v1h-3zM7 11h2v1h-2zM7 12h1v1h-1zM7 13h1v1h-1z" fill="#c0862c"/></svg>';
let fold = (() => { try { return localStorage.getItem('pw-qfold') === '1'; } catch (e) { return false; } })();
function setFold(v: boolean) { fold = v; try { localStorage.setItem('pw-qfold', v ? '1' : '0'); } catch (e) { /* 私密模式 */ } hudKey = ''; }
/* ---- 導航：在地圖上點一個地方（營火、城鎮、傳聞的圈…）按「導航」，角色旁邊才會出現金色箭頭；走到旁邊自動結束 ---- */
export let navT: { x: number; y: number; name: string; key: string } | null = null;
export function setNav(t: typeof navT) { navT = t; hudKey = ''; if (t) sfx.pick(); updateQuest(); }
$('quest').addEventListener('click', e => {
  const el = e.target as HTMLElement;
  if (el.closest('.qnavx')) setNav(null);
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
/* 地圖上的傳聞：一個模糊的虛線圈（不給精確位置）。s = 每格幾個像素，ox/oy = 地圖偏移 */
export function drawRumors(g, s, ox = 0, oy = 0) {
  for (const r of rumorsOpen()) { const x = (r.tx - ox) * s, y = (r.ty - oy) * s, R = r.r * s;
    g.save(); g.setLineDash([Math.max(2, s * 2), Math.max(2, s * 2)]); g.lineDashOffset = -G.time * 6; g.lineWidth = Math.max(1, s * .5);
    g.strokeStyle = 'rgba(232,216,176,.75)'; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke(); g.restore();
    g.fillStyle = 'rgba(232,216,176,.08)'; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
    if (s >= 2) { g.font = Math.round(Math.min(16, 6 + s * 2)) + 'px "DotGothic16", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#e8d8b0'; g.fillText('?', x, y + 5); } }
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

/* ---- 旅程分頁（地圖畫面裡）：記憶碎片（照 I～VII 排，沒拿到的是 ？？？）、傳聞、碑文 ---- */
export function renderJournal() {
  const mem = [...CORES].sort((a, b) => a.mem - b.mem).map(c => c.done(qc)
    ? '<details><summary>記憶碎片 ' + MEM_N[c.mem - 1] + '<small>' + c.name + '</small></summary><p>' + c.text + '</p></details>'
    : '<div class="memx">記憶碎片 ' + MEM_N[c.mem - 1] + '<small>？？？</small></div>').join('');
  const rum = rumorsKnown().map(r => { const d = r.done(qc); return '<li class="' + (d ? 'done' : 'cur') + '"><span>' + (d ? '✓' : '?') + '</span>「' + r.text + '」<small>——' + r.src + '</small></li>'; }).reverse().join('');
  const tabs = TAB.filter(t => loreRead.has(t.id)).map(t => '<details><summary>' + t.title + '</summary><p>' + t.text + '</p></details>').join('');
  const lit = ZONE_NAME.filter((_, z) => flags.has('chart:' + z)).join('、');
  $('journal').innerHTML = '<p class="premise">' + PREMISE + '</p>' +
    '<div class="lbl">記憶碎片・' + cores() + '/' + CORE_N + '</div>' + mem +
    '<div class="lbl" style="margin-top:10px">傳聞</div><ol class="qsteps">' + (rum || '<li>還沒有聽到什麼。</li>') + '</ol>' +
    '<div class="lbl" style="margin-top:10px">地圖・' + fragCount() + '/5 座神像</div><p class="hintp">已經點亮：' + (lit || '—') + (fragsHeld().length ? '。身上有 ' + fragsHeld().length + ' 張還沒交出去的地圖殘頁' : '') + '</p>' +
    '<div class="lbl" style="margin-top:10px">碑文・' + TAB.filter(t => loreRead.has(t.id)).length + ' 則</div>' + (tabs || '<p class="hintp">荒野各處的石碑上刻著當年的事。</p>');
}
