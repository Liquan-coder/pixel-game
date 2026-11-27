/* 高度（斜視角 demo 的試驗場用）：每一格的地面有多高（世界像素）。0 = 平地。
   這個檔案只 import map.ts，碰撞、戰鬥、畫面都可以安全地 import 它（不會打亂載入順序） */
import { MH, MW, TS } from './map';
export const elev = new Uint8Array(MW * MH);
export const stairs = new Uint8Array(MW * MH);                        // 1 = 階梯（畫成石頭色）
export const STEP = 8;                                                 // 一次最多跨上多高（階梯一階 7）
export const hill = { on: false };
export const gZ = (x: number, y: number) => { const tx = x / TS | 0, ty = y / TS | 0; return tx < 0 || ty < 0 || tx >= MW || ty >= MH ? 0 : elev[ty * MW + tx]; };
