import { G } from '../core/state';
import { $, TAU, pick, rr } from '../core/util';
import { isTouch } from '../core/canvas';
import { sfx } from '../core/audio';
import { TOWNS, TS } from '../world/map';
import { dungeonAt } from '../world/dungeons';
import { fightingRB } from '../world/regionBoss';
import { STARC } from '../render/fx';
import { toast } from '../ui/hud';
import { flags } from './quest';
import { input } from './player';
import { busy, stopCharge } from './combat';
import { locked } from './status';
import { inBossZone } from './playerUpdate';
import type { Player } from '../types';

/* ================= 星狼（坐騎） =================
   打倒狼王之後，巢穴裡的一匹星狼會載你（石碑：狼群曾經是看守森林的騎士）。
   · 按 R（手機：狼頭按鈕）呼喚 → 0.5 秒後騎上去；再按一次跳下來
   · 只能在野外騎：地城、城鎮、Boss 的結界裡叫不出來，騎著走進去會自動下來
   · 跑得比走路快 1.7 倍；騎著按攻擊 / 瞬移 / 技能 / 喝藥 = 先跳下來，再做那個動作
   · 被打中就摔下來（呼喚到一半被打中也會中斷） */
export const RIDE_SPD = 1.7, SUMMON_T = .5, DROP_T = .18;
export const RIDE_Y = 14;                                                // 騎著時人抬高幾個世界像素（女巫的腰對到狼背）
const STRIDE = 2.6;                                                      // 全速時每秒跑幾個步伐（render 用 rideRun 挑奔跑的哪一格）

export const hasWolf = () => G.bossDead || !!G.lab;                     // 狼王倒下就解鎖（舊存檔打過狼王的也算）；開發用的測試場 / 測試版（?lab、?test）直接開

/* 這裡能不能騎？不能的話回傳原因（只寫氛圍，不提等級） */
export function rideBlock(pl: Player): string | null {
  if (dungeonAt(pl.x, pl.y)) return '星狼不肯走進這麼窄的地方';
  if (TOWNS.some(T => Math.hypot(T.tx * TS - pl.x, T.ty * TS - pl.y) < T.r * TS)) return '鎮上的人會被嚇到。星狼在鎮外等你';
  if (fightingRB() || (G.B && !G.bossDead && G.B.state !== 'sleep') || inBossZone(pl.x, pl.y)) return '星狼壓低了耳朵，不肯再往前';
  return null;
}

/* R 鍵 / 狼頭按鈕：沒騎 → 呼喚；騎著 → 跳下來 */
export function toggleMount(pl: Player) {
  if (!hasWolf() || pl.dead) return;
  if (pl.ride) { dismount(pl); return; }
  if (pl.rideT > 0 || busy(pl) || locked(pl) || pl.swing) return;
  const why = rideBlock(pl); if (why) { toast(why, '#c8b8ff'); return; }
  stopCharge(pl); pl.chargeArm = false;
  pl.rideT = SUMMON_T; sfx.howl();
  G.fx.push({ k:'rune', x:pl.x, y:pl.y, r:16, t:0, d:SUMMON_T + .1, rot:rr(0, TAU) });   // 腳下浮出魔法陣
}

function mountUp(pl: Player) {
  pl.ride = true; pl.rideIn = .35; pl.rideRun = 0; sfx.blinkIn();
  G.fx.push({ k:'ring', x:pl.x, y:pl.y - 6, r0:6, r1:30, t:0, d:.4, col:'#c8b0ff' });
  for (let i = 0; i < 22; i++) { const a = rr(0, TAU), s = rr(30, 90);
    G.parts.push({ x:pl.x + rr(-14, 14), y:pl.y - rr(2, 22), vx:Math.cos(a) * s, vy:Math.sin(a) * s * .5 - 10, life:rr(.35, .7), max:.7, col:pick(STARC), star:rr(1, 2.6), drag:4 }); }
}

/* 跳下來（thrown = 被打中摔下來）：星狼散成星光 */
export function dismount(pl: Player, thrown = false) {
  if (pl.rideT > 0) { pl.rideT = 0; return; }                         // 還在呼喚 → 只是中斷
  if (!pl.ride) return;
  pl.ride = false; pl.rideDrop = DROP_T;
  for (let i = 0; i < (thrown ? 30 : 20); i++) { const a = rr(0, TAU), s = rr(20, thrown ? 110 : 70);
    G.parts.push({ x:pl.x + rr(-16, 16), y:pl.y - rr(2, 24), vx:Math.cos(a) * s, vy:Math.sin(a) * s * .5 - 18, life:rr(.4, .8), max:.8, col:pick(STARC), star:rr(.8, 2.4), drag:3 }); }
  if (!thrown) sfx.blink();
}

/* 每幀（game/playerUpdate.ts）：呼喚倒數、自動下來、奔跑步伐、腳下的星屑 */
export function updateMount(pl: Player, dt: number) {
  intro();
  if (pl.rideIn > 0) pl.rideIn -= dt;
  if (pl.rideDrop > 0) pl.rideDrop -= dt;
  if (pl.rideT > 0) {
    pl.rideT -= dt;
    for (let i = 0; i < 2; i++) { const a = rr(0, TAU), d = rr(18, 30);   // 星光從四周聚過來
      G.parts.push({ x:pl.x + Math.cos(a) * d, y:pl.y - 8 + Math.sin(a) * d * .5, vx:-Math.cos(a) * d * 2.4, vy:-Math.sin(a) * d * 1.2, life:.4, max:.4, col:pick(STARC), star:rr(.8, 2), drag:1 }); }
    if (pl.rideT <= 0) { pl.rideT = 0; const why = rideBlock(pl); if (why) toast(why, '#c8b8ff'); else mountUp(pl); }
    return;
  }
  if (!pl.ride) return;
  if (!hasWolf() || pl.dead || locked(pl)) { dismount(pl, true); return; }
  const why = rideBlock(pl); if (why) { dismount(pl); toast(why, '#c8b8ff'); return; }
  if (pl.moving) { const m = Math.min(1, Math.hypot(input.mx, input.my));
    pl.rideRun = ((pl.rideRun || 0) + dt * STRIDE * (.5 + .5 * m)) % 1;
    if (Math.random() < dt * 30 * m) { const bx = pl.x + (pl.flip ? 1 : -1) * rr(4, 14);   // 腳下踢起的星屑，往後飄
      G.parts.push({ x:bx, y:pl.y - rr(0, 3), vx:(pl.flip ? 1 : -1) * rr(10, 40), vy:-rr(8, 30), life:rr(.3, .6), max:.6, col:pick(STARC), star:rr(.6, 1.8), drag:3 }); }
    if (Math.random() < dt * 10) { const tx = pl.x + (pl.flip ? 1 : -1) * 16;   // 尾巴拖著的星雲
      G.parts.push({ x:tx + rr(-2, 2), y:pl.y - 16 + rr(-3, 3), vx:(pl.flip ? 1 : -1) * rr(6, 20), vy:-rr(2, 10), life:rr(.4, .8), max:.8, col:pick(['#9a6ae8', '#c8a8ff', '#e8dcff']), star:rr(.6, 1.4), drag:2 }); }
  }
}

/* 第一次見到星狼（剛打倒狼王，或舊存檔已經打過）：兩則提示，之後不再出現 */
let seenAt = -1;
function intro() {
  if (!hasWolf() || flags.has('starwolf') || G.lab) { seenAt = -1; return; }   // 測試場不跳劇情提示
  if (seenAt < 0) { seenAt = G.time; return; }
  if (G.time - seenAt < 4) return;                                      // 等「強敵已擊敗」的橫幅先播完
  flags.add('starwolf');
  toast('巢穴深處走出一匹身上帶著星光的狼，在你面前低下了頭。', '#c8b8ff');
  setTimeout(() => toast(isTouch ? '點右下角的狼頭呼喚星狼，可以騎著在野外奔跑' : '按 R 呼喚星狼，可以騎著在野外奔跑', '#f1e7d0'), 1600);
}

/* 手機的狼頭按鈕：解鎖後才出現；這裡不能騎時變暗；騎著時亮起來 */
let hudKey = '';
export function mountHud(pl: Player) {
  const k = !hasWolf() ? '' : pl.ride || pl.rideT > 0 ? 'on' : rideBlock(pl) ? 'off' : 'ok';
  if (k === hudKey) return; hudKey = k;
  const b = $('bMount'); b.hidden = !k; b.classList.toggle('on', k === 'on'); b.classList.toggle('off', k === 'off');
  const kh = $('keyHint'); if (k && !kh.textContent.includes('R 星狼')) kh.textContent += ' · R 星狼';
}
