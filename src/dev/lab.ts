/* ================= 開發用：刻印測試場 =================
   打開 http://localhost:5173/?lab 就直接進遊戲，不用從頭玩：
   · 主角打不死、體力 / 藥水無限
   · 畫面上方一排按鈕：換刻印、換武器、叫怪（一群小怪 / 精英 / 打不死的沙包）、傳送到 Boss 前
   · **不會存檔**（G.lab = true 時 game/save.ts 的 save / clearSave 什麼都不做），你的存檔格完全不動
   只有開發模式（npm run dev）才會載入這個檔案（main.ts 用 import.meta.env.DEV 判斷），上線的版本裡沒有它。 */
import { G } from '../core/state';
import { rr } from '../core/util';
import { WT, makeWeapon } from '../data/items';
import { WFXD, fxOf } from '../game/weaponFx';
import { makeEnemy } from '../game/enemies';
import { recalc } from '../game/player';
import { RBDEF, rbs } from '../world/regionBoss';
import { toast } from '../ui/hud';

const SEALS: [string, string][] = [['bleed', '出血'], ['burn', '燃燒'], ['frost', '寒霜'], ['shock', '雷鳴'], ['soul', '噬魂'], ['', '無']];
const FOE = { alive: true, timer: 0 };                                  // 假的生怪點：死了不會在這裡重生

export function startLab(startGame: (cont: boolean) => void) {
  G.lab = true;                                                         // 先關掉存檔，startGame 裡的 clearSave / save 才不會動到存檔格
  startGame(false);
  G.me.x -= 150; G.me.y += 10;                                         // 離開營火（站在營火旁按攻擊會變成「休息」）
  setWeapon('sword', 'frost');
  god();
  setTimeout(() => { pack(); sandbag(); toast('刻印測試場：不會存檔，主角打不死', '#c8a8ff'); }, 300);
  panel();
}

/* 打不死：每一幀補滿血、體力、藥水；真的倒下了（一擊超過最大生命）就馬上扶起來 */
function god() {
  const tick = () => { const pl = G.me; if (pl) { if (pl.dead) pl.dead = false; pl.hp = pl.maxHp; pl.st = pl.maxSt; pl.pot = Math.max(pl.pot, 3); } for (const e of bags) if (e.hp > 0) e.hp = e.maxHp; else bags.delete(e); requestAnimationFrame(tick); };
  tick();
}

function setWeapon(type: string, fx: string) {
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
function sandbag() { const [x, y] = near(55); const e = add('golem', x, y); e.maxHp = e.hp = 300; e.dmg = 1; bags.add(e); }   // 血量正常（出血爆的 15% 才是真的大小），每一幀補滿
function clearFoes() { G.enemies = []; }                              // 全部清掉（野外的怪走遠再回來會自己長回來）
/* 傳送到等級最低的野外 Boss 前面：看 Boss 身上的累積圖示 */
function toBoss() {
  const d = (Object.values(RBDEF) as any[]).filter(d => !d.dg && rbs.some(e => e.id === d.id && !e.dead)).sort((a, b) => a.lv - b.lv)[0];
  if (!d) { toast('附近沒有還活著的 Boss', '#ff8a8a'); return; }
  G.me.x = d.x; G.me.y = d.y + 60; toast('往上走就會開打：' + (d.name || d.id), '#c8a8ff');
}

let bar: HTMLDivElement;
function refresh() {
  if (!bar) return; const fx = fxOf(G.me.weapon) || '';
  bar.querySelectorAll<HTMLButtonElement>('[data-fx]').forEach(b => b.classList.toggle('on', b.dataset.fx === fx));
  const sel = bar.querySelector<HTMLSelectElement>('select'); if (sel) sel.value = G.me.weapon.type;
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
  <select tabindex="-1">${Object.keys(WT).map(k => `<option value="${k}">${WT[k].name}</option>`).join('')}</select>
  <span class="sep"></span>
  <button type="button" tabindex="-1" data-a="pack">一群小怪</button>
  <button type="button" tabindex="-1" data-a="elite">精英</button>
  <button type="button" tabindex="-1" data-a="bag">沙包</button>
  <button type="button" tabindex="-1" data-a="clear">清掉怪</button>
  <button type="button" tabindex="-1" data-a="boss">去 Boss 前</button>
  <button type="button" tabindex="-1" data-a="min" class="keep">－</button>`;
  document.body.appendChild(bar);
  const stop = (ev: Event) => ev.stopPropagation();                    // 點按鈕不要變成搖桿 / 攻擊
  for (const t of ['pointerdown', 'touchstart', 'mousedown']) bar.addEventListener(t, stop);
  bar.addEventListener('click', ev => {
    const b = (ev.target as HTMLElement).closest('button'); if (!b) return; b.blur();
    if (b.dataset.fx !== undefined) setWeapon(G.me.weapon.type, b.dataset.fx);
    const a = b.dataset.a;
    if (a === 'pack') pack(); else if (a === 'elite') elite(); else if (a === 'bag') sandbag(); else if (a === 'clear') clearFoes(); else if (a === 'boss') toBoss();
    else if (a === 'min') { bar.classList.toggle('min'); b.textContent = bar.classList.contains('min') ? '＋' : '－'; }
  });
  const sel = bar.querySelector('select'); sel.addEventListener('change', () => { setWeapon(sel.value, fxOf(G.me.weapon) || ''); sel.blur(); });
  refresh();
}
