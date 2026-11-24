import { G } from '../core/state';
import { $, TAU, pick, rr } from '../core/util';
import { sfx } from '../core/audio';
import { TOWNS, TS } from '../world/map';
import { dungeonAt } from '../world/dungeons';
import { fightingRB } from '../world/regionBoss';
import { STARC } from '../render/fx';
import { toast } from '../ui/hud';
import { flags } from './quest';
import { held, input, keys } from './player';
import { stopCharge } from './combat';
import { locked } from './status';
import { inBossZone } from './playerUpdate';
import type { Player } from '../types';

/* ================= 星狼（坐騎） =================
   打倒狼王之後，巢穴裡的一匹星狼會載你（石碑：狼群曾經是看守森林的騎士）。測試場（?lab、?test）直接開。
   · 按住翻滾鍵 1 秒呼喚（腳下的圈畫滿；按下去的那一下照常翻滾）；騎著時按住 1 秒 = 讓星狼回去。電腦也可以按 R
   · 像法環一樣只能在野外騎：地城、城鎮、Boss 的結界裡叫不出來，騎著走進去會自動下來
   · 跑得比走路快 1.7 倍；騎著按翻滾 = 星狼往前衝一小段（衝 0.14 秒、0.3 秒無敵，沒有站穩的時間；狼停在當下那一格滑出去，人不會閃）
   · 騎著按攻擊 / 技能 / 喝藥 = 先跳下來，再做那個動作
   · 被打中就摔下來（按住呼喚到一半被打中也會中斷，要放開重按） */
export const RIDE_SPD = 1.7, WOLF_DASH = .6, DROP_T = .18;
export const CALL_T = 1, OFF_T = 1, CALL_SHOW = .22;                     // 按住幾秒叫出來 / 騎著按住幾秒讓牠回去 / 按住多久才開始畫圈（比這個短就放開 = 翻滾，跟攻擊的蓄力門檻一樣）
const STRIDE = 2.4;                                                      // 全速時每秒跑幾個步伐（render 用 rideRun 挑奔跑的哪一格）

export const hasWolf = () => G.bossDead || !!G.lab;                     // 狼王倒下就解鎖（舊存檔打過狼王的也算）；開發用的測試場 / 測試版（?lab、?test）直接開

/* 這裡能不能騎？不能的話回傳原因（只寫氛圍，不提等級） */
export function rideBlock(pl: Player): string | null {
  if (dungeonAt(pl.x, pl.y)) return '星狼不肯走進這麼窄的地方';
  if (TOWNS.some(T => Math.hypot(T.tx * TS - pl.x, T.ty * TS - pl.y) < T.r * TS)) return '鎮上的人會被嚇到。星狼在鎮外等你';
  if (fightingRB() || (G.B && !G.bossDead && G.B.state !== 'sleep') || inBossZone(pl.x, pl.y)) return '星狼壓低了耳朵，不肯再往前';
  return null;
}

/** 按住呼喚的進度 0～1（腳下的圈畫到哪；render/player.ts 用）。還沒按夠久 = 0 */
export const callProgress = (pl: Player) => pl.rideT > CALL_SHOW ? Math.min(1, (pl.rideT - CALL_SHOW) / ((pl.ride ? OFF_T : CALL_T) - CALL_SHOW)) : 0;

/* R 鍵：沒騎 → 馬上叫出來；騎著 → 跳下來 */
export function toggleMount(pl: Player) {
  if (!hasWolf() || pl.dead || locked(pl)) return;
  if (pl.ride) { dismount(pl); return; }
  const why = rideBlock(pl); if (why) { toast(why, '#c8b8ff'); return; }
  mountUp(pl);
}

function mountUp(pl: Player) {
  stopCharge(pl); pl.chargeArm = false;
  pl.ride = true; pl.rideIn = .35; pl.rideRun = 0; sfx.howl();
  G.fx.push({ k:'ring', x:pl.x, y:pl.y - 6, r0:6, r1:30, t:0, d:.4, col:'#c8b0ff' });
  for (let i = 0; i < 22; i++) { const a = rr(0, TAU), s = rr(30, 90);
    G.parts.push({ x:pl.x + rr(-14, 14), y:pl.y - rr(2, 22), vx:Math.cos(a) * s, vy:Math.sin(a) * s * .5 - 10, life:rr(.35, .7), max:.7, col:pick(STARC), star:rr(1, 2.6), drag:4 }); }
}

/* 跳下來（thrown = 被打中摔下來）：星狼散成星光。按住呼喚到一半 → 只是中斷 */
export function dismount(pl: Player, thrown = false) {
  if (pl.rideT > 0) { pl.rideT = 0; pl.callLock = true; }
  if (!pl.ride) return;
  pl.ride = false; pl.rideDrop = DROP_T;
  for (let i = 0; i < (thrown ? 30 : 20); i++) { const a = rr(0, TAU), s = rr(20, thrown ? 110 : 70);
    G.parts.push({ x:pl.x + rr(-16, 16), y:pl.y - rr(2, 24), vx:Math.cos(a) * s, vy:Math.sin(a) * s * .5 - 18, life:rr(.4, .8), max:.8, col:pick(STARC), star:rr(.8, 2.4), drag:3 }); }
  if (!thrown) sfx.blink();
}

/* 騎著按翻滾：星狼往前衝一小段（combat.ts 的 tryDodge 呼叫，代替翻滾的消失特效）。腳下踢起一團土 + 星屑 */
export function wolfDashFx(pl: Player) {
  sfx.dodge(); const back = Math.atan2(-pl.dvy, -pl.dvx);
  for (let i = 0; i < 14; i++) { const a = back + rr(-.8, .8), s = rr(30, 90);
    G.parts.push({ x:pl.x + rr(-6, 6), y:pl.y - rr(0, 3), vx:Math.cos(a) * s, vy:Math.sin(a) * s * .5 - rr(10, 30), life:rr(.3, .55), max:.55, col:pick(['#8a7a68', '#b8a890', ...STARC]), star:rr(.6, 1.8), drag:4 }); }
}

/* 每幀（game/playerUpdate.ts）：按住呼喚、自動下來、奔跑步伐、腳下的星屑 */
export function updateMount(pl: Player, dt: number) {
  intro();
  if (pl.rideIn > 0) pl.rideIn -= dt;
  if (pl.rideDrop > 0) pl.rideDrop -= dt;
  holdCall(pl, dt);
  if (!pl.ride) return;
  if (!hasWolf() || pl.dead || locked(pl)) { dismount(pl, true); return; }
  const why = rideBlock(pl); if (why) { dismount(pl); toast(why, '#c8b8ff'); return; }
  if (pl.dodge > 0) { G.ghosts.push({ x:pl.x, y:pl.y, flip:pl.flip, life:.22, max:.22, col:'wolf', run:pl.rideRun || 0 }); return; }   // 衝刺的殘影
  if (pl.moving) { const m = Math.min(1, Math.hypot(input.mx, input.my));
    pl.rideRun = ((pl.rideRun || 0) + dt * STRIDE * (.5 + .5 * m)) % 1;
    if (Math.random() < dt * 30 * m) { const bx = pl.x + (pl.flip ? 1 : -1) * rr(3, 10);   // 腳下踢起的星屑，往後飄
      G.parts.push({ x:bx, y:pl.y - rr(0, 3), vx:(pl.flip ? 1 : -1) * rr(10, 40), vy:-rr(8, 30), life:rr(.3, .6), max:.6, col:pick(STARC), star:rr(.6, 1.8), drag:3 }); }
    if (Math.random() < dt * 10) { const tx = pl.x + (pl.flip ? 1 : -1) * 11;   // 尾巴拖著的星雲
      G.parts.push({ x:tx + rr(-2, 2), y:pl.y - 10 + rr(-3, 3), vx:(pl.flip ? 1 : -1) * rr(6, 20), vy:-rr(2, 10), life:rr(.4, .8), max:.8, col:pick(['#9a6ae8', '#c8a8ff', '#e8dcff']), star:rr(.6, 1.4), drag:2 }); }
  }
}

/* 按住翻滾鍵：數秒數，滿 1 秒就叫出來（騎著按住 1 秒 = 讓牠回去）。中途放開、被打、去做別的事 → 重算 */
function holdCall(pl: Player, dt: number) {
  const down = held.dodge || keys.dodge;
  if (!down) { pl.rideT = 0; pl.callLock = false; return; }
  if (pl.callLock || !hasWolf() || pl.dead || locked(pl) || pl.drink > 0 || pl.swing || pl.charging) { pl.rideT = 0; return; }
  pl.rideT = (pl.rideT || 0) + dt;
  const q = callProgress(pl);
  if (q > 0 && Math.random() < dt * (10 + 30 * q)) { const a = rr(0, TAU), d = rr(16, 26);   // 星光從四周聚過來，越接近叫出來越多
    G.parts.push({ x:pl.x + Math.cos(a) * d, y:pl.y - 6 + Math.sin(a) * d * .5, vx:-Math.cos(a) * d * 2.4, vy:-Math.sin(a) * d * 1.2, life:.4, max:.4, col:pick(STARC), star:rr(.8, 2), drag:1 }); }
  if (pl.rideT < (pl.ride ? OFF_T : CALL_T)) return;
  pl.rideT = 0; pl.callLock = true;                                      // 叫完要放開才會再算
  if (pl.ride) { dismount(pl); return; }
  const why = rideBlock(pl); if (why) { toast(why, '#c8b8ff'); return; }
  mountUp(pl);
}

/* 第一次見到星狼（剛打倒狼王，或舊存檔已經打過）：兩則提示，之後不再出現 */
let seenAt = -1;
function intro() {
  if (!hasWolf() || flags.has('starwolf') || G.lab) { seenAt = -1; return; }   // 測試場不跳劇情提示
  if (seenAt < 0) { seenAt = G.time; return; }
  if (G.time - seenAt < 4) return;                                      // 等「強敵已擊敗」的橫幅先播完
  flags.add('starwolf');
  toast('巢穴深處走出一匹身上帶著星光的狼，在你面前低下了頭。', '#c8b8ff');
  setTimeout(() => toast('在野外按住翻滾鍵呼喚星狼。騎著按翻滾 = 星狼往前衝，按住 1 秒讓牠回去', '#f1e7d0'), 1600);
}

/* 電腦版下方的按鍵說明：解鎖後加一句 */
let hinted = false;
export function mountHud() {
  if (hinted || !hasWolf()) return; hinted = true;
  const kh = $('keyHint'); if (!kh.textContent.includes('星狼')) kh.textContent += ' · 按住 K 叫星狼';
}
