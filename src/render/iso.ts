/* 斜視角 demo（?lab 的「斜視角」按鈕，或網址加 ?iso / ?iso=front）：只改「怎麼畫」，遊戲邏輯照舊用方格。
   世界座標 (x, y) → 畫面：
   - 45° 菱形（dia）：px = (x − y)·K，py = (x + y)·K/2（方格變菱形，K = 1/√2 讓橫向距離不變）
   - 正面斜俯視（front）：px = x，py = y（地面跟原本一模一樣，只是牆、高台往上長，看得到正面）
   - 地面、預警圈、刀光：整層斜轉（flat）
   - 角色、怪、樹、房子：站著畫，只把腳底的點換到斜視角的位置（upright）
   - 懸崖、牆：畫成有高度的方塊 */
import { F, LH, LW, ctx } from '../core/canvas';
import { G } from '../core/state';
import { BIGT, CLIFF, CRATE, GRAVE, HOUSE, MH, MW, PILLAR, REGIONS, ROCK, RWALL, TREE, TS, hgt, map, reg } from '../world/map';
import { AR, TA } from '../world/gen';
import { bakeObjectHD } from '../world/tileArt';
import { CH, CPX, groundChunk } from '../world/chunks';
import { elev, gZ, stairs } from '../world/elev';

export const K = Math.SQRT1_2;
import { iso } from './isoState';
export { iso };
const dia = () => iso.mode === 'dia';
const pX = (x: number, y: number) => dia() ? (x - y) * K : x, pY = (x: number, y: number) => dia() ? (x + y) * K / 2 : y;
export const sX = (x: number, y: number) => pX(x, y) + iso.ox;            // 世界 → 畫面
export const sY = (x: number, y: number) => pY(x, y) + iso.oy;
/** 前後順序：越大越晚畫（越靠近鏡頭）。45° 看 x + y，正面看 y */
export const dep = (x: number, y: number) => dia() ? x + y : y * 2;
const snap = (v: number) => Math.round(v * F) / F;

/** 鏡頭跟著玩家（在斜視角的畫面座標裡平滑移動） */
export function isoCam(shx: number, shy: number, ck: number) {
  const me = G.me, tx = pX(me.x, me.y), ty = pY(me.x, me.y) - 8 - (me.z || 0);
  if (!iso.init || Math.hypot(tx - iso.px, ty - iso.py) > 400) { iso.px = tx; iso.py = ty; iso.init = true; }   // 傳送 / 剛打開：直接跳過去
  iso.px += (tx - iso.px) * ck; iso.py += (ty - iso.py) * ck;
  iso.ox = snap(LW / 2 - iso.px + shx); iso.oy = snap(LH / 2 - iso.py + shy);
}
/** 整層斜轉：之後用世界座標畫的東西都會貼在地上 */
export function flat(dz = 0) { if (dia()) ctx.setTransform(F * K, F * K / 2, -F * K, F * K / 2, F * iso.ox, F * (iso.oy - dz)); else ctx.setTransform(F, 0, 0, F, F * iso.ox, F * (iso.oy - dz)); }   // dz = 抬高多少（方塊的頂面）
/** 站著畫：(ax, ay) 這個點移到斜視角的位置，圖本身不變形 */
export function upright(ax: number, ay: number, z = gZ(ax, ay)) { ctx.setTransform(F, 0, 0, F, Math.round(F * (sX(ax, ay) - ax)), Math.round(F * (sY(ax, ay) - ay - z))); }   // z = 離地多高（預設站在這一格的地面上）
/** 世界方向 → 畫面方向的角度（武器、面向用） */
export const scrAng = (a: number) => !dia() ? a : Math.atan2((Math.cos(a) + Math.sin(a)) / 2, Math.cos(a) - Math.sin(a));

/** 畫面四個角對應的世界範圍 */
function worldBox(m: number) {
  const inv = (px: number, py: number) => { if (!dia()) return [px - iso.ox, py - iso.oy]; const u = (px - iso.ox) / K, v = 2 * (py - iso.oy) / K; return [(u + v) / 2, (v - u) / 2]; };
  const P = [inv(-m, -m), inv(LW + m, -m), inv(-m, LH + m * 4), inv(LW + m, LH + m * 4)];   // 下面多留一點：高的東西從畫面下方伸上來
  return { x0: Math.min(...P.map(p => p[0])), x1: Math.max(...P.map(p => p[0])), y0: Math.min(...P.map(p => p[1])), y1: Math.max(...P.map(p => p[1])) };
}

/** 地面：只有地面像素的區塊（樹、房子另外站著畫），整塊斜轉貼上去 */
export function drawIsoGround() {
  const b = worldBox(20);
  flat();
  for (let gy = Math.max(0, Math.floor(b.y0 / CPX)); gy <= Math.floor(b.y1 / CPX); gy++) for (let gx = Math.max(0, Math.floor(b.x0 / CPX)); gx <= Math.floor(b.x1 / CPX); gx++) {
    if (gx * CH >= MW || gy * CH >= MH) continue;
    ctx.drawImage(groundChunk(gx, gy), gx * CPX, gy * CPX, CPX + .5, CPX + .5);   // +.5：斜轉後區塊之間不要有細縫
  }
}

/* 方塊的顏色（頂面、左前面、右前面），依地區 */
const WALLC: Record<string, string[]> = {
  plains: ['#8a9a62', '#6a5a46', '#4e4236'], forest: ['#4e6a4a', '#3c4436', '#2c3228'], wastes: ['#b8a07a', '#8a7454', '#665640'],
  lava: ['#6a3a30', '#4a2824', '#341c1a'], den: ['#5a4a58', '#3e3240', '#2c2430'], snow: ['#e8f0fa', '#aab8cc', '#8494aa'],
  swamp: ['#4a5a3e', '#36402e', '#262e22'], dungeon: ['#5a5070', '#3e3654', '#2c2640'], elf: ['#c8d0ec', '#8e96b8', '#6c7494'],
};
const STAIRC = ['#a8a4b4', '#7c7890', '#5e5a70'];                    // 階梯：石頭色
const OBJ = new Set([TREE, ROCK, PILLAR, CRATE, GRAVE, HOUSE, BIGT]);
const isBlock = (t: number) => t === CLIFF || t === RWALL;
const hOf = (i: number) => { const t = map[i]; return t === RWALL ? 22 : t === CLIFF ? 10 + Math.min(6, hgt[i]) * 5 : elev[i]; };   // elev = 試驗場的高台、階梯   // 方塊多高（山越裡面越高）

/** 把這一畫面的方塊、樹、房子放進要排序的清單（k = 深度：x + y 越大越靠前） */
export function isoWorldList(list: any[]) {
  const b = worldBox(30), me = G.me, mz = me.z || 0, mk = dep(me.x, me.y) + mz, mx = sX(me.x, me.y), my = sY(me.x, me.y) - mz;
  const tx0 = Math.max(0, Math.floor(b.x0 / TS)), tx1 = Math.min(MW - 1, Math.floor(b.x1 / TS)), ty0 = Math.max(0, Math.floor(b.y0 / TS)), ty1 = Math.min(MH - 1, Math.floor(b.y1 / TS));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = ty * MW + tx, t = map[i];
    if (!OBJ.has(t) && !isBlock(t) && !elev[i]) continue;
    const cx = tx * TS + TS / 2, cy = ty * TS + TS / 2, px = sX(cx, cy), py = sY(cx, cy);
    if (px < -60 || px > LW + 60 || py < -40 || py > LH + 220) continue;
    const k = dep(cx, cy) + (elev[i] ? 1 : 0), big = t === HOUSE || t === BIGT;
    // 擋在玩家前面、而且畫出來會蓋到主角 → 變半透明，才看得到自己（主角大約佔畫面上 mx±9、my−28 ~ my）
    const h = hOf(i), top = isBlock(t) ? py - h - 8 : py - (big ? 150 : t === TREE ? 50 : 26), half = big ? 70 : isBlock(t) ? 12 : 14;
    const fade = k > mk && (!elev[i] || h > mz + 4) && Math.abs(px - mx) < half + 9 && top < my && py + 8 > my - 28 ? .38 : 1;
    if (isBlock(t) || elev[i]) {
      const C = stairs[i] ? STAIRC : WALLC[REGIONS[reg[i]]?.key] || WALLC.dungeon;
      const openS = hOf(i + MW) < h, openE = dia() && hOf(i + 1) < h;   // 只畫看得到的面（45°：南、東；正面：只有南）；旁邊的方塊比較矮才露出來
      const rim = [hOf(i - MW) < h, hOf(i - 1) < h, hOf(i + 1) < h, hOf(i + MW) === 0];   // 北、西、東邊比較低 → 描邊；南邊是平地 → 地上畫影子
      list.push({ k, f: () => drawBlock(tx, ty, h, C, openS ? hOf(i + MW) : -1, openE ? hOf(i + 1) : -1, fade, !!stairs[i], rim) });
    } else list.push({ k: t === HOUSE && dia() ? k - TS : k, f: () => {
      const ax = cx, ay = ty * TS + TS;                                  // 腳底 = 這一格的下緣中間
      ctx.globalAlpha = fade;
      ctx.setTransform(F / AR, 0, 0, F / AR, Math.round(F * (sX(ax, ay) - TS / 2)), Math.round(F * (sY(ax, ay) - TS)));
      bakeObjectHD(ctx, tx, ty, 0, 0);
      ctx.globalAlpha = 1;
    } });
  }
}

/* 一格方塊：側面 = 純色 + 每 5px 一條深色岩層線；頂面 = 原本這一格的地形圖，往上抬 h */
function drawBlock(tx: number, ty: number, h: number, C: string[], hS: number, hE: number, a: number, plain = false, rim = [false, false, false, false]) {
  ctx.setTransform(F, 0, 0, F, 0, 0); ctx.globalAlpha = a;
  const x0 = tx * TS, y0 = ty * TS, x1 = x0 + TS, y1 = y0 + TS, P = (x: number, y: number, z: number) => [sX(x, y), sY(x, y) - z];
  const poly = (pts: number[][], c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill(); };
  const face = (ax: number, ay: number, bx: number, by: number, z0: number, c: string) => {
    poly([P(ax, ay, z0), P(bx, by, z0), P(bx, by, h), P(ax, ay, h)], c);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; for (let z = z0 + 4; z < h - 1; z += 5) poly([P(ax, ay, z), P(bx, by, z), P(bx, by, z + 1), P(ax, ay, z + 1)], 'rgba(0,0,0,.22)');
    poly([P(ax, ay, h - 1), P(bx, by, h - 1), P(bx, by, h), P(ax, ay, h)], 'rgba(255,255,255,.12)');   // 上緣亮一條
  };
  if (rim[3]) poly([P(x0, y1, 0), P(x1, y1, 0), P(x1, y1 + 5, 0), P(x0, y1 + 5, 0)], 'rgba(0,0,0,.2)');   // 牆腳的影子
  if (hS >= 0) face(x0, y1, x1, y1, hS, C[1]);                              // 南面（畫面左下）
  if (hE >= 0) face(x1, y1, x1, y0, hE, C[2]);                              // 東面（畫面右下）
  if (plain) { poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], C[0]); poly([P(x0, y1, h), P(x1, y1, h), P(x1, y1, h - 1), P(x0, y1, h - 1)], 'rgba(255,255,255,.25)'); ctx.globalAlpha = 1; return; }   // 階梯：素色頂面 + 前緣亮線
  const gx = Math.floor(tx / CH), gy = Math.floor(ty / CH);
  flat(h);
  ctx.drawImage(groundChunk(gx, gy), (tx - gx * CH) * TA, (ty - gy * CH) * TA, TA, TA, x0, y0, TS + .4, TS + .4);
  ctx.setTransform(F, 0, 0, F, 0, 0);                                    // 頂面的邊：旁邊比較低就描一條深色線（跟角色的 1px 外框同一個風格）
  const edge = (ax: number, ay: number, bx: number, by: number) => { const A = P(ax, ay, h), B = P(bx, by, h); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); };
  ctx.strokeStyle = 'rgba(24,18,34,.6)'; ctx.lineWidth = .67; ctx.beginPath();
  if (rim[0]) edge(x0, y0, x1, y0); if (rim[1]) edge(x0, y0, x0, y1); if (rim[2]) edge(x1, y0, x1, y1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
