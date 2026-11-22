/* ================= 開發用：刻印測試場 =================
   打開 http://localhost:5173/?lab 就直接進遊戲，不用從頭玩：
   · 主角打不死、體力 / 藥水無限
   · 跟 ?test 一樣全開：地圖、地名、營火（可以傳送）、背包有全部武器、星狼、4 格飾品欄
   · 畫面上方一排按鈕：換刻印、換武器、叫怪（一群小怪 / 精英 / 打不死的沙包 / 會打人的沙包）、傳送到任一隻 Boss 的結界外面（那隻 Boss 會復活、血補滿）、換流派飾品
   · **不會存檔**（G.lab = true 時 game/save.ts 的 save / clearSave 什麼都不做），你的存檔格完全不動
   只有開發模式（npm run dev）才會載入這個檔案（main.ts 用 import.meta.env.DEV 判斷），上線的版本裡沒有它。 */
import { G } from '../core/state';
import { rr } from '../core/util';
import { WT, makeWeapon } from '../data/items';
import { WFXD, fxOf } from '../game/weaponFx';
import { makeEnemy } from '../game/enemies';
import { recalc } from '../game/player';
import { RBDEF, rbs, reviveRB } from '../world/regionBoss';
import { resetBoss, reviveWolf } from '../game/boss';
import { makeUnique, makeUniqueGear } from '../data/items';
import { UG, UQ, UQSIG } from '../data/uniques';
import { effLines } from '../data/gear';
import { toast } from '../ui/hud';
import { openAll } from './test';
import { collides } from '../game/collision';
import { solidT, tileAt } from '../world/gen';
import { ARENA, TS } from '../world/map';

const SEALS: [string, string][] = [['bleed', '出血'], ['burn', '燃燒'], ['frost', '寒霜'], ['shock', '雷鳴'], ['soul', '噬魂'], ['', '無']];
const FOE = { alive: true, timer: 0 };                                  // 假的生怪點：死了不會在這裡重生

export function startLab(startGame: (cont: boolean) => void) {
  G.lab = true;                                                         // 先關掉存檔，startGame 裡的 clearSave / save 才不會動到存檔格
  startGame(false);
  G.me.x -= 150; G.me.y += 10;                                         // 離開營火（站在營火旁按攻擊會變成「休息」）
  setWeapon('sword', 'frost');
  openAll();                                                            // 地圖、營火、全部武器全開（跟 ?test 一樣）
  god();
  setTimeout(() => { pack(); sandbag(); toast('刻印測試場：地圖、武器、能力全開，不會存檔，主角打不死', '#c8a8ff'); }, 300);
  panel();
}

/* 打不死：每一幀補滿血、體力、藥水；真的倒下了（一擊超過最大生命）就馬上扶起來 */
function god() {
  const tick = () => { const pl = G.me; if (pl) { if (pl.dead) pl.dead = false; pl.hp = pl.maxHp; pl.st = pl.maxSt; pl.pot = Math.max(pl.pot, 3); } for (const e of bags) if (e.hp > 0) e.hp = e.maxHp; else bags.delete(e); requestAnimationFrame(tick); };
  tick();
}

function setWeapon(type: string, fx: string) {
  if (type.startsWith('uq:')) { const k = type.slice(3); G.me.weapon = makeUnique(k); recalc(G.me); G.me.skillCd = 0; refresh(); toast(UQ[k].name + '・' + UQSIG[k].n + '：' + UQSIG[k].d, UQSIG[k].cols[1], true); return; }   // 獨特武器（沒有刻印，有招牌）
  G.me.weapon = makeWeapon(type, 0, fx || undefined); recalc(G.me); G.me.skillCd = 0;
  refresh();
}
const near = (d: number) => { const a = rr(0, Math.PI * 2); return [G.me.x + Math.cos(a) * d, G.me.y + Math.sin(a) * d]; };
function add(kind: string, x: number, y: number, sp = FOE) { const e = makeEnemy(kind, 3, x, y, sp); G.enemies.push(e); return e; }
/* 一群小怪擠在一起：雷鳴要旁邊有別的怪才會跳電；噬魂要打死才看得到魂飛回來 */
function pack() { const [cx, cy] = near(70); for (let i = 0; i < 5; i++) add(i % 2 ? 'wolf' : 'slime', cx + rr(-14, 14), cy + rr(-14, 14)); }
function elite() { const [x, y] = near(70); add('skel', x, y, { ...FOE, elite: true } as any); }
/* 沙包：打不死（每一幀補滿血），用來看累積圖示慢慢變滿、爆發、凍成冰塊、身上一直燒 */
const bags = new Set<any>();
/* 流派：戴到第一格飾品（沒有就拿掉）。核心六件 + 原本就有的三件流派飾品 */
const BUILDS: [string, string][] = [['', '流派：無'], ['ghostveil', '閃避・殘影之紗'], ['ragethorn', '反傷・怒棘之心'], ['thirstfang', '吸血・渴血之牙'], ['plaguevial', '異常・瘟疫之瓶'],
  ['hawkplume', '暴擊・鷹隼之羽'], ['giantheart', '重擊・巨人的心臟'], ['shadowbell', '月影之鈴'], ['bloodpact', '血契之戒'], ['knightoath', '守光騎士的誓言']];
function setBuild(k: string) { G.me.trinkets[0] = k && UG[k] ? makeUniqueGear(k) : null; recalc(G.me); if (k) toast(UG[k].name + '：' + effLines(UG[k].eff).join('；'), '#c8a8ff', true); }
/* 會打人的沙包：練完美閃避（攻擊打到前一瞬間瞬移）、存怒氣 */
function brute() { const [x, y] = near(50); const e = add('skel', x, y); e.maxHp = e.hp = 300; e.dmg = 6; bags.add(e); }
function sandbag() { const [x, y] = near(55); const e = add('golem', x, y); e.maxHp = e.hp = 300; e.dmg = 1; bags.add(e); }   // 血量正常（出血爆的 15% 才是真的大小），每一幀補滿
function clearFoes() { G.enemies = []; }                              // 全部清掉（野外的怪走遠再回來會自己長回來）
/* ---- 去 Boss 前：選一隻 Boss → 牠復活（打倒過也會回來、血補滿）→ 傳送到牠的結界外面（不會直接開打） ----
   從 Boss 站的位置沿著能走的地板往外找（廣度優先），第一個走出結界的位置就是落點
   → 一定跟 Boss 是連通的（地城 Boss = 停在 Boss 房的門外），不會掉進牆裡或隔壁房間 */
type BossPick = { id: string; name: string; lv: number; group: string; x: number; y: number; inside: (x: number, y: number) => boolean };
function bossList(): BossPick[] {
  const out: BossPick[] = [];
  for (const d of Object.values(RBDEF) as any[]) out.push({ id: d.id, name: d.name || d.id, lv: d.lv, group: d.dg ? '地城 Boss' : d.region ? '區域 Boss' : '主線 Boss',
    x: d.x, y: d.y, inside: (x, y) => Math.hypot(x - d.x, y - d.y) < d.R + 28 });   // 結界 = 半徑 R（Boss 區多算 8 px），再多留一點距離
  const ax = (ARENA.x0 + ARENA.x1 + 1) / 2 * TS, ay = (ARENA.y0 + ARENA.y1 + 1) / 2 * TS;   // 狼王：巢穴是一整塊方形
  out.push({ id: 'wolf', name: '狼王', lv: 0, group: '主線 Boss', x: ax, y: ay,
    inside: (x, y) => x > (ARENA.x0 - 2) * TS && x < (ARENA.x1 + 3) * TS && y > (ARENA.y0 - 2) * TS && y < (ARENA.y1 + 3) * TS });
  return out.sort((p, q) => p.lv - q.lv);
}
function outsideOf(b: BossPick): [number, number] | null {
  const sx = Math.floor(b.x / TS), sy = Math.floor(b.y / TS), seen = new Set<number>([sy * 4096 + sx]), q: number[][] = [[sx, sy]];
  for (let i = 0; i < q.length && i < 60000; i++) { const [tx, ty] = q[i], x = tx * TS + 8, y = ty * TS + 8;
    if (!b.inside(x, y) && !collides(x, y, 7)) return [x, y];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = tx + dx, ny = ty + dy, k = ny * 4096 + nx;
      if (seen.has(k) || solidT(tileAt(nx, ny))) continue; seen.add(k); q.push([nx, ny]); } }
  return null;
}
function toBoss(id: string) {
  const b = bossList().find(b => b.id === id); if (!b) return;
  const at = outsideOf(b); if (!at) { toast('找不到 ' + b.name + ' 外面能站的地方', '#ff8a8a'); return; }
  if (id === 'wolf') reviveWolf(); else { reviveRB(id); if (G.B && !G.bossDead && G.B.state !== 'sleep') resetBoss(); }   // 狼王打到一半就跑去別隻：狼王也回去睡
  const pl = G.me; pl.x = at[0]; pl.y = at[1]; pl.kx = pl.ky = 0; pl.face = Math.atan2(b.y - pl.y, b.x - pl.x); pl.flip = b.x < pl.x;
  G.enemies = G.enemies.filter(e => e.rb || e.boss);                    // 原本身邊叫出來的怪清掉
  toast(b.name + '復活了，你在結界外面，往前走就會開打', '#c8a8ff');
}

let bar: HTMLDivElement;
function refresh() {
  if (!bar) return; const fx = fxOf(G.me.weapon) || '';
  bar.querySelectorAll<HTMLButtonElement>('[data-fx]').forEach(b => b.classList.toggle('on', b.dataset.fx === fx));
  const sel = bar.querySelector<HTMLSelectElement>('select.w'); if (sel) sel.value = G.me.weapon.uq ? 'uq:' + G.me.weapon.uq : G.me.weapon.type;
}
function panel() {
  bar = document.createElement('div'); bar.id = 'labBar';
  bar.innerHTML = `<style>
    #labBar{position:fixed;top:6px;left:0;right:0;margin:0 auto;width:fit-content;z-index:50;display:flex;flex-wrap:wrap;gap:4px;justify-content:center;align-items:center;
      max-width:min(820px,calc(100vw - 32px));padding:6px;border-radius:8px;background:rgba(14,11,20,.86);border:1px solid #6a4ad0;font:12px system-ui,sans-serif;color:#f1e7d0}
    #labBar button,#labBar select{font:inherit;color:inherit;background:#2a2040;border:1px solid #4a3a70;border-radius:5px;padding:4px 7px;cursor:pointer}
    #labBar button.on{background:#6a4ad0;border-color:#c8a8ff}
    #labBar .sep{width:1px;height:18px;background:#4a3a70}
    #labBar.min > :not(.keep){display:none}
  </style>
  <b class="keep" style="color:#c8a8ff">刻印</b>
  ${SEALS.map(([k, n]) => `<button type="button" tabindex="-1" data-fx="${k}" style="${k ? 'color:' + WFXD[k].c : ''}">${n}</button>`).join('')}
  <span class="sep"></span>
  <select class="w" tabindex="-1">${Object.keys(WT).map(k => `<option value="${k}">${WT[k].name}</option>`).join('')}<optgroup label="獨特武器">${Object.keys(UQSIG).map(k => `<option value="uq:${k}">${UQ[k].name}・${UQSIG[k].n}</option>`).join('')}</optgroup></select>
  <span class="sep"></span>
  <button type="button" tabindex="-1" data-a="pack">一群小怪</button>
  <button type="button" tabindex="-1" data-a="elite">精英</button>
  <button type="button" tabindex="-1" data-a="bag">沙包</button>
  <button type="button" tabindex="-1" data-a="brute">會打人的沙包</button>
  <button type="button" tabindex="-1" data-a="clear">清掉怪</button>
  <span class="sep"></span>
  <select class="b" tabindex="-1">${BUILDS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
  <select tabindex="-1" class="boss"><option value="">去 Boss 前…</option>${(() => { const L = bossList(), G2 = ['主線 Boss', '區域 Boss', '地城 Boss'];
    return G2.map(g => `<optgroup label="${g}">` + L.filter(b => b.group === g).map(b => `<option value="${b.id}">${b.name}</option>`).join('') + '</optgroup>').join(''); })()}</select>
  <button type="button" tabindex="-1" data-a="min" class="keep">－</button>`;
  document.body.appendChild(bar);
  const stop = (ev: Event) => ev.stopPropagation();                    // 點按鈕不要變成搖桿 / 攻擊
  for (const t of ['pointerdown', 'touchstart', 'mousedown']) bar.addEventListener(t, stop);
  bar.addEventListener('click', ev => {
    const b = (ev.target as HTMLElement).closest('button'); if (!b) return; b.blur();
    if (b.dataset.fx !== undefined && !G.me.weapon.uq) setWeapon(G.me.weapon.type, b.dataset.fx);   // 獨特武器不能裝刻印
    const a = b.dataset.a;
    if (a === 'pack') pack(); else if (a === 'elite') elite(); else if (a === 'bag') sandbag(); else if (a === 'brute') brute(); else if (a === 'clear') clearFoes();
    else if (a === 'min') { bar.classList.toggle('min'); b.textContent = bar.classList.contains('min') ? '＋' : '－'; }
  });
  const sel = bar.querySelector<HTMLSelectElement>('select.w'); sel.addEventListener('change', () => { setWeapon(sel.value, fxOf(G.me.weapon) || ''); sel.blur(); });
  const bs = bar.querySelector<HTMLSelectElement>('select.b'); bs.addEventListener('change', () => { setBuild(bs.value); bs.blur(); });
  const bo = bar.querySelector<HTMLSelectElement>('select.boss'); bo.addEventListener('change', () => { if (bo.value) toBoss(bo.value); bo.value = ''; bo.blur(); });   // 選完回到「去 Boss 前…」，同一隻可以再選一次
  refresh();
}
