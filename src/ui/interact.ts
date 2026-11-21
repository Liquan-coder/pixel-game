import { G } from '../core/state';
import { cam } from '../game/player';
import { LH, LW } from '../core/canvas';
import { inFight, nearCamp } from '../game/playerUpdate';
import { pickUp } from '../game/worldUpdate';
import { nearChest, openChest } from '../world/chests';
import { nearTablet, readTablet } from '../game/quest';
import { doorLabel, nearDoor, useDoor } from '../world/dungeons';
import { nearNPC, nearSmith } from '../world/towns';
import { nearMerchant, openShop } from './shop';
import { restAt } from './menus';
import { openMenu } from './hud';
import { puzzleTarget } from '../world/puzzles';
import { cartoTarget, statueTarget } from '../world/statues';

/* ================= 互動：靠近東西時，攻擊鍵就變成「撿起 / 休息 / 打開…」 ================= */
export type IKind = 'pick' | 'chest' | 'read' | 'door' | 'shop' | 'rest' | 'use';   // use = 地城機關（點燃火盆、查看壁畫）
export interface Interact { kind: IKind; btn: string; text?: string; run: () => void }   // btn = 攻擊按鈕上顯示的字；text = 畫面下方的提示

export function enterDoor() { const d = nearDoor(G.me); if (!d) return; useDoor(G.me, d, pl => { cam.x = pl.x - LW / 2; cam.y = pl.y - LH / 2; }); G.region = ''; }

// 優先順序：腳邊裝備 > 寶箱 > 石碑 > 門 > 商店 > 營火。被怪追著打時回傳 null（攻擊鍵照樣攻擊）
export function interactTarget(): Interact | null {
  const pl = G.me;
  if (!G.started || G.paused || openMenu || !pl || pl.dead || inFight(pl)) return null;
  if (G.pick) { const d = G.pick; return { kind:'pick', btn:'撿起', run: () => pickUp(pl, d) }; }
  const c = nearChest(pl); if (c) return { kind:'chest', btn:'打開', run: () => openChest(pl, c) };
  const pz = puzzleTarget(pl) || statueTarget(pl) || cartoTarget(pl, nearNPC()); if (pz) return { kind:'use', btn: pz.btn, text: pz.text, run: pz.run };   // 機關、星之神像、製圖師
  const t = nearTablet(); if (t) return { kind:'read', btn:'閱讀', run: () => readTablet(t) };
  const d = nearDoor(pl); if (d) return { kind:'door', btn: d.out ? '離開' : '進入', text: doorLabel(d), run: enterDoor };
  const s = nearSmith(); if (s) return { kind:'shop', btn:'交易', text:'和鐵匠交易', run: () => openShop(s) };
  if (nearMerchant()) return { kind:'shop', btn:'交易', text:'和流浪商人交易', run: () => openShop() };
  const camp = nearCamp(pl); if (camp) return { kind:'rest', btn:'休息', run: () => restAt(camp) };
  return null;
}
