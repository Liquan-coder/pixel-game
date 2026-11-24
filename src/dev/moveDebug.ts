/* ================= 開發用：「是誰在推角色？」 =================
   角色連續移動超過 3 秒，畫面上方就出現一行小字，寫出現在讓她移動的東西：
   按著哪些方向鍵、搖桿、翻滾、擊退、衝刺……
   用途：「角色自己一直往一個方向走」的時候看一眼這行字，就知道是輸入卡住還是遊戲邏輯。
   只有開發模式（npm run dev）才會載入，上線的版本裡沒有它。 */
import { G } from '../core/state';
import { input, joy, keys, held } from '../game/player';

export function startMoveDebug() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:4px;transform:translateX(-50%);z-index:60;pointer-events:none;font:12px ui-monospace,monospace;color:#ffe38a;background:#000c;padding:2px 8px;border-radius:4px;white-space:nowrap';
  el.hidden = true; document.body.appendChild(el);
  let px = 0, py = 0, movingT = 0, last = 0;
  const tick = (ts: number) => {
    requestAnimationFrame(tick);
    const dt = Math.min(.1, (ts - last) / 1000); last = ts; const pl = G.me;
    if (!pl || !G.started || G.paused) { el.hidden = true; return; }
    const moved = Math.hypot(pl.x - px, pl.y - py) > .2; px = pl.x; py = pl.y;
    movingT = moved ? movingT + dt : 0;
    if (movingT < 3) { el.hidden = true; return; }
    const why: string[] = [];
    const ks = ['up', 'down', 'left', 'right'].filter(k => keys[k]).map(k => ({ up: '↑', down: '↓', left: '←', right: '→' })[k]);
    if (ks.length) why.push('鍵盤 ' + ks.join(''));
    if (joy.active || Math.hypot(joy.dx, joy.dy) > .18) why.push(`搖桿 ${joy.active ? '按著' : '沒按'} (${joy.dx.toFixed(1)},${joy.dy.toFixed(1)})`);
    if (pl.dodge > 0) why.push('翻滾'); if (pl.dash) why.push('衝刺'); if (pl.lunge) why.push('突進');
    if (Math.abs(pl.kx) + Math.abs(pl.ky) > 2) why.push('擊退'); if (pl.ride) why.push('騎狼');
    if (held.atk || keys.atk) why.push('攻擊鍵按著');
    el.textContent = `移動中 ${movingT.toFixed(0)} 秒｜方向 (${input.mx.toFixed(1)},${input.my.toFixed(1)})｜${why.join('、') || '找不到原因！（遊戲邏輯在推她）'}`;
    el.hidden = false;
  };
  requestAnimationFrame(tick);
}
