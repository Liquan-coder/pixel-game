/* three.js 模式（網址加 ?three，或 ?lab 的「3D」按鈕）：遊戲邏輯完全不動，只換掉畫面。
   - 地形：每 16×16 格一塊網格，懸崖 / 牆往上長、水往下凹，頂面貼原本的地形圖（world/chunks.ts 的 groundChunk）
   - 樹、石頭、房子：原本的圖做成面向鏡頭的紙片（billboard），同一張圖共用貼圖
   - 角色、怪、掉落物：照原本的畫法畫到 2D 畫布的角落 → 複製成牠自己的貼圖 → 紙片（每一幀更新）
   - 預警圈、刀光、子彈、粒子、傷害數字：照原本的畫法畫在 2D 畫布上（俯視），整張貼在地面上
   - 光：太陽（有影子）+ 天空光，營火 / 火把 / 子彈的光變成點光源；霧和天色照地區
   單位：1 格 = 1 單位（= 16 世界像素）。世界 (x, y) → 3D (x/16, 高度, y/16)，y 往南 = +Z */
import * as THREE from 'three';
import { F, LH, LW, cv, ctx } from '../core/canvas';
import { G } from '../core/state';
import { BIGT, CLIFF, HOUSE, HOUSES, LAVA, MH, MW, REGIONS, RWALL, TS, WATER, hgt, map, reg } from '../world/map';
import { AR, TA } from '../world/gen';
import { bakeObjectHD, objectKey } from '../world/tileArt';
import { CH, groundBake, groundReady } from '../world/chunks';
import { scrAng } from './iso';
import { perf, three } from './isoState';

const U = 1 / TS;                                                      // 世界像素 → 3D 單位
const YAW = Math.PI / 4, PITCH = 50 * Math.PI / 180, DIST = 40;          // 鏡頭：斜 45°、往下看 50°
/* 像素感：3D 用低解析度畫（1 個畫面像素 = 1 個美術像素 = 1/3 世界像素），再用 CSS 放大成方塊；
   鏡頭是正交的（沒有透視，遠近一樣大），而且鏡頭和紙片的位置都對齊到像素格子 → 走路時畫面不會閃 */
const RS = 3, RP = U / RS;                                             // RS = 1 世界像素畫成幾個畫面像素；RP = 1 畫面像素是幾個 3D 單位
const CR = new THREE.Vector3(), CU = new THREE.Vector3(), CB = new THREE.Vector3();   // 鏡頭的右、上、後方向
function snapV(v: THREE.Vector3) { const r = Math.round(v.dot(CR) / RP) * RP, u = Math.round(v.dot(CU) / RP) * RP, b = v.dot(CB); return v.copy(CR).multiplyScalar(r).addScaledVector(CU, u).addScaledVector(CB, b); }
let renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.OrthographicCamera;
let sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight;
const pts: THREE.PointLight[] = [];
let ready = false;

function init() {
  const c3 = document.createElement('canvas'); c3.id = 'cv3';
  c3.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:0;pointer-events:none;image-rendering:pixelated';
  cv.parentElement.insertBefore(c3, cv);                                 // 3D 在下面，2D 畫布（預警圈、刀光、數字）疊在上面
  renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: false });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;   // 硬邊影子：跟像素風比較搭，也比較省
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;                // 不做色彩空間轉換：2D 畫布 → 貼圖可以在顯示卡裡直接複製（轉 sRGB 會讓 Chrome 繞回 CPU，一幀多 26ms）
  THREE.ColorManagement.enabled = false;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xaebccc, 48, 95);                            // 鏡頭離目標 40：近處清楚，畫面上方（遠處）淡淡起霧
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  cam.position.set(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH)); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  CR.set(1, 0, 0).applyQuaternion(cam.quaternion); CU.set(0, 1, 0).applyQuaternion(cam.quaternion); CB.set(0, 0, 1).applyQuaternion(cam.quaternion);
  hemi = new THREE.HemisphereLight(0xdfe8ff, 0x46503a, 1.6); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2dc, 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -22; sc.right = sc.top = 22; sc.near = 1; sc.far = 120; sun.shadow.bias = -.0008;
  scene.add(sun); scene.add(sun.target);
  for (let i = 0; i < 6; i++) { const p = new THREE.PointLight(0xffa050, 0, 6, 1.5); scene.add(p); pts.push(p); }   // 固定 6 盞，每幀挑最近的光源（燈數固定，shader 不用重編）
  ready = true;
}
function px<T extends THREE.Texture>(t: T): T { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = true; return t; }   // premultiplyAlpha：畫布本來就是預乘的，不用再轉

/* ---------- 地形：一塊 16×16 格一個網格 ---------- */
const hOf = (i: number) => { const t = map[i]; return t === RWALL ? 22 : t === CLIFF ? 10 + Math.min(6, hgt[i]) * 5 : t === WATER || t === LAVA ? -3 : 0; };   // 世界像素
const terr = new Map<number, THREE.Mesh>();
function terrainChunk(gx: number, gy: number) {
  const key = gy * 1000 + gx; let m = terr.get(key); if (m) return m;
  const tex = groundReady(gx, gy); if (!tex) return null;               // 地面還沒烤好：先不畫（groundBake 會一點一點烤）
  const P: number[] = [], N: number[] = [], UV: number[] = [], I: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], uv: number[][]) => {   // a b c d 逆時針
    const o = P.length / 3; for (const v of [a, b, c, d]) P.push(...v); for (let k = 0; k < 4; k++) N.push(...n); for (const t of uv) UV.push(...t); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const tx = gx * CH + lx, ty = gy * CH + ly; if (tx >= MW || ty >= MH) continue;
    const i = ty * MW + tx, h = hOf(i) * U, x0 = tx, x1 = tx + 1, z0 = ty, z1 = ty + 1;
    const u0 = lx / CH, u1 = (lx + 1) / CH, v0 = 1 - ly / CH, v1 = 1 - (ly + 1) / CH;   // 貼圖上這一格的位置
    quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], [[u0, v1], [u1, v1], [u1, v0], [u0, v0]]);   // 頂面
    const side = (nx: number, nz: number, nb: number, A: number[], B: number[]) => {   // 旁邊比較矮 → 補一面牆（貼這一格的圖，往下拉長）
      const hn = (nb < 0 || nb >= MW * MH ? 0 : hOf(nb)) * U; if (hn >= h) return;
      quad([A[0], hn, A[1]], [B[0], hn, B[1]], [B[0], h, B[1]], [A[0], h, A[1]], [nx, 0, nz], [[u0, v1], [u1, v1], [u1, v0], [u0, v0]]); };
    side(0, 1, tx < MW && ty + 1 < MH ? i + MW : -1, [x0, z1], [x1, z1]);
    side(1, 0, tx + 1 < MW ? i + 1 : -1, [x1, z1], [x1, z0]);
    side(0, -1, ty > 0 ? i - MW : -1, [x1, z0], [x0, z0]);
    side(-1, 0, tx > 0 ? i - 1 : -1, [x0, z0], [x0, z1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: px(new THREE.CanvasTexture(tex)) }));
  m.castShadow = m.receiveShadow = true; scene.add(m); terr.set(key, m);
  return m;
}

/* ---------- 樹、石頭、房子：紙片 ---------- */
type Bill = { tex: THREE.Texture; w: number; h: number; fx: number; fy: number };   // fx, fy = 圖上「腳底」的位置（美術像素）
const bills = new Map<string, Bill>();
function objBill(tx: number, ty: number, key: string): Bill {
  let b = bills.get(key); if (b) return b;
  const t = map[ty * MW + tx], hs = t === HOUSE ? HOUSES.find(h => h.tx === tx && h.ty + h.h - 1 === ty) : null;
  const cw = hs ? (hs.w + 2) * TA : t === BIGT ? 7 * TA : 3 * TA, chh = hs ? (hs.h + 2) * TA : t === BIGT ? 9 * TA : 4 * TA;
  const ox = hs ? TA : (cw - TA) / 2, oy = chh - TA;                    // 這一格的左上角畫在圖上的哪裡
  const c = document.createElement('canvas'); c.width = cw; c.height = chh;
  bakeObjectHD(c.getContext('2d'), tx, ty, ox, oy);
  b = { tex: px(new THREE.CanvasTexture(c)), w: cw, h: chh, fx: ox + TA / 2, fy: oy + TA }; bills.set(key, b);
  return b;
}
const inst = new Map<string, { m: THREE.InstancedMesh; cap: number }>();
const quadGeo = new THREE.PlaneGeometry(1, 1);
/** 一張紙片：面向鏡頭，圖上的 (fx, fy) 對齊世界的腳底 (wx, wy)；scale = 1 美術像素幾個 3D 單位 */
function placeBill(list: THREE.Mesh[], idx: number, tex: THREE.Texture, w: number, h: number, fx: number, fy: number, wx: number, wy: number, scale: number, push = .6) {
  let m = list[idx];
  if (!m) { m = new THREE.Mesh(quadGeo, new THREE.MeshLambertMaterial({ transparent: true, alphaTest: .5, side: THREE.DoubleSide, premultipliedAlpha: true })); m.receiveShadow = false; scene.add(m); list[idx] = m; }
  const mat = m.material as THREE.MeshLambertMaterial; if (mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; }
  m.visible = true; m.scale.set(w * scale, h * scale, 1); m.quaternion.copy(cam.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), back = new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion);
  const dx = (w / 2 - fx) * scale, dy = (fy - h / 2) * scale;           // 腳底 → 紙片中心
  snapV(m.position.set(wx * U, 0, wy * U).addScaledVector(right, dx).addScaledVector(up, dy).addScaledVector(back, push));   // 往鏡頭推一點：頭不會插進後面的牆；對齊像素格子
  return m;
}

/* ---------- 角色、怪：每一幀照原本的畫法畫到 2D 畫布角落，再複製進「同一張大圖」（只上傳一次） ---------- */
const CAP = 128, COLS = 6;                                             // 每格 128 世界像素（腳底在 (64, 112)），一排 6 格
const atlas = document.createElement('canvas'), ag = atlas.getContext('2d');
let atlasTex: THREE.CanvasTexture | null = null;
const entMeshes: THREE.Mesh[] = [], entPos: number[] = [];
let entCount = 0;
const keep = document.createElement('canvas');
/** render.ts 呼叫：把有腳底座標的東西（角色、怪、掉落物、營火…）擷取進大圖。2D 畫布上已經畫的東西先存起來，擷取完再放回去 */
export function captureEnts(items: any[]) {
  if (!ready) init();
  const t0 = performance.now(), S = CAP * F;
  items.sort((a, b) => a.y - b.y);
  const n = Math.min(items.length, COLS * 8), rows = Math.max(1, Math.ceil(n / COLS));
  if (atlas.width !== COLS * S || atlas.height < rows * S) { atlas.width = COLS * S; atlas.height = Math.max(atlas.height, rows * S); atlasTex?.dispose(); atlasTex = px(new THREE.CanvasTexture(atlas)); for (const m of entMeshes) { (m.material as THREE.MeshLambertMaterial).map = null; } }
  if (keep.width !== cv.width || keep.height !== cv.height) { keep.width = cv.width; keep.height = cv.height; }
  const kg = keep.getContext('2d'); kg.clearRect(0, 0, keep.width, keep.height); kg.drawImage(cv, 0, 0);
  ctx.save(); ag.clearRect(0, 0, atlas.width, rows * S); entCount = 0;
  for (let k = 0; k < n; k++) { const it = items[k];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, S, S);
    ctx.setTransform(F, 0, 0, F, Math.round(F * (64 - it.x)), Math.round(F * (112 - it.y)));
    const o = it.o, f0 = o?.face, fl0 = o?.flip;
    if (o) {                                                              // 面向、左右翻面換成「畫面上的方向」（鏡頭斜 45°）
      if (typeof f0 === 'number') o.face = scrAng(f0);
      if (G.players.includes(o)) { const c = Math.cos(o.face); if (c < -.1) o.flip = true; else if (c > .1) o.flip = false; }
      else { const wd = G.me.x - o.x, sd = (G.me.x - G.me.y) - (o.x - o.y); if (wd * sd < 0) o.flip = !o.flip; }
    }
    it.f();
    if (o) { o.face = f0; o.flip = fl0; }
    ag.drawImage(cv, 0, 0, S, S, (k % COLS) * S, Math.floor(k / COLS) * S, S, S);
    entPos[2 * k] = it.x; entPos[2 * k + 1] = it.y; entCount++;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(keep, 0, 0);
  ctx.restore();                                                          // 換回原本的變換（後面還要畫刀光、子彈）
  if (atlasTex) atlasTex.needsUpdate = true;
  perf.f.cap = performance.now() - t0; perf.cap += (perf.f.cap - perf.cap) * .05; perf.ents = entCount;
}
function placeEnts() {
  const S = CAP * F, AW = atlas.width, AH = atlas.height;
  for (let k = 0; k < entCount; k++) {
    let m = entMeshes[k];
    if (!m) { m = new THREE.Mesh(quadGeo, new THREE.MeshLambertMaterial({ transparent: true, alphaTest: .5, side: THREE.DoubleSide, premultipliedAlpha: true })); scene.add(m); entMeshes[k] = m; }
    const mat = m.material as THREE.MeshLambertMaterial;
    if (!mat.map || mat.map.source !== atlasTex.source) { mat.map = atlasTex.clone(); mat.needsUpdate = true; }   // clone 共用同一份圖：整張大圖只上傳一次
    mat.map.repeat.set(S / AW, S / AH); mat.map.offset.set((k % COLS) * S / AW, 1 - (Math.floor(k / COLS) + 1) * S / AH);
    m.visible = true; m.scale.set(CAP * U, CAP * U, 1); m.quaternion.copy(cam.quaternion);
    snapV(m.position.set(entPos[2 * k] * U, 0, entPos[2 * k + 1] * U).addScaledVector(CU, (112 - CAP / 2) * U).addScaledVector(CB, 1.2));   // 腳底 → 紙片中心；往鏡頭推一點
  }
  for (let k = entCount; k < entMeshes.length; k++) entMeshes[k].visible = false;
}

/* ---------- 疊在 3D 上面的 2D 畫布：預警圈、刀光、子彈、數字（不用上傳，直接蓋在上面） ----------
   鏡頭沒有透視 → 地面到畫面是「斜轉 + 壓扁」的固定變換，2D 用 setTransform 就能精確貼在地上 */
export const ov = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };                // 世界像素 → 畫面（世界像素為單位）的變換
const tmp = new THREE.Vector3();
function scr(x: number, y: number) { tmp.set(x * U, 0, y * U).project(cam); return [(tmp.x + 1) / 2 * LW, (1 - tmp.y) / 2 * LH]; }
export const ovX = (x: number, y: number) => ov.a * x + ov.c * y + ov.e, ovY = (x: number, y: number) => ov.b * x + ov.d * y + ov.f;
/** 每一幀最先呼叫：鏡頭跟著玩家（對齊像素格子），算出 2D 疊圖的變換 */
export function threeCam() {
  if (!ready) init();
  const me = G.me, W = Math.round(LW * RS), H = Math.round(LH * RS);  // 畫面大小跟著原本的鏡頭範圍（LW × LH 世界像素）
  if (renderer.domElement.width !== W || renderer.domElement.height !== H) { renderer.setSize(W, H, false); cam.left = -LW * U / 2; cam.right = LW * U / 2; cam.top = LH * U / 2; cam.bottom = -LH * U / 2; cam.updateProjectionMatrix(); }
  const T = snapV(new THREE.Vector3(me.x * U, .5, me.y * U));          // 鏡頭對準的點對齊像素格子：整個世界跟著整數像素移動，不會閃
  cam.position.copy(T).addScaledVector(CB, DIST); cam.updateMatrixWorld();
  const o = scr(0, 0), px1 = scr(100, 0), py1 = scr(0, 100);
  ov.a = (px1[0] - o[0]) / 100; ov.b = (px1[1] - o[1]) / 100; ov.c = (py1[0] - o[0]) / 100; ov.d = (py1[1] - o[1]) / 100; ov.e = o[0]; ov.f = o[1];
}

/* ---------- 每一幀 ---------- */
const v3 = new THREE.Vector3();
export function drawThree(cx: number, cy: number, L: any[], amb: number, tint: number[], regionKey: string) {
  if (!ready) init();
  const me = G.me, tx = me.x * U, tz = me.y * U;
  // 天色：地區越暗（amb 大），太陽越弱、霧越接近地區的色調
  const day = Math.max(.15, 1 - amb * 1.6);
  sun.intensity = 2.4 * day; hemi.intensity = .5 + 1.2 * day;
  const fogC = new THREE.Color(`rgb(${Math.round(150 * day + tint[0] * 2)},${Math.round(165 * day + tint[1] * 2)},${Math.round(185 * day + tint[2] * 2)})`);
  (scene.fog as THREE.Fog).color.copy(fogC); renderer.setClearColor(fogC);
  sun.position.set(tx - 14, 26, tz + 8); sun.target.position.set(tx, 0, tz);
  // 地形：玩家周圍 5×5 塊
  const gx0 = Math.floor(me.x / (CH * TS)), gy0 = Math.floor(me.y / (CH * TS));
  for (const m of terr.values()) m.visible = false;
  const want: [number, number][] = [];                                  // 周圍 7×7 塊，近的先烤；畫面上用到的是中間 5×5
  for (let gy = gy0 - 3; gy <= gy0 + 3; gy++) for (let gx = gx0 - 3; gx <= gx0 + 3; gx++) if (gx >= 0 && gy >= 0 && gx * CH < MW && gy * CH < MH) want.push([gx, gy]);
  const pcx = me.x / (CH * TS) - .5, pcy = me.y / (CH * TS) - .5; want.sort((a, b) => Math.hypot(a[0] - pcx, a[1] - pcy) - Math.hypot(b[0] - pcx, b[1] - pcy));
  const nearMissing = want.slice(0, 9).some(([x, y]) => !groundReady(x, y));
  groundBake(want, nearMissing ? 12 : 4);                                // 身邊缺地面：多花一點時間補；不缺：每幀 4ms 慢慢預先烤
  for (const [gx, gy] of want) if (Math.abs(gx - gx0) <= 2 && Math.abs(gy - gy0) <= 2) { const m = terrainChunk(gx, gy); if (m) m.visible = true; }
  if (terr.size > 60) for (const [k, m] of terr) { if (m.visible) continue; m.geometry.dispose(); ((m.material as THREE.MeshLambertMaterial).map)?.dispose(); scene.remove(m); terr.delete(k); if (terr.size <= 40) break; }
  // 物件紙片：玩家周圍 ±26 格
  // 同一張圖的樹 / 石頭合成一次繪圖（InstancedMesh）：森林裡幾百棵樹也只要十幾次
  const R = 20, ptx = Math.floor(me.x / TS), pty = Math.floor(me.y / TS), groups = new Map<string, number[]>();
  for (let y = Math.max(0, pty - R); y <= Math.min(MH - 1, pty + R + 4); y++) for (let x = Math.max(0, ptx - R); x <= Math.min(MW - 1, ptx + R); x++) {
    const k = objectKey(x, y); if (!k) continue;
    objBill(x, y, k); let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(x, y);
  }
  for (const [k, e] of inst) if (!groups.has(k)) e.m.count = 0;
  const mtx = new THREE.Matrix4(), sc3 = new THREE.Vector3();
  for (const [k, g] of groups) {
    const b = bills.get(k), n = g.length / 2; let e = inst.get(k);
    if (!e || e.cap < n) { if (e) { scene.remove(e.m); e.m.dispose(); }
      const cap = Math.max(16, 2 ** Math.ceil(Math.log2(n))), m = new THREE.InstancedMesh(quadGeo, new THREE.MeshLambertMaterial({ map: b.tex, transparent: true, alphaTest: .5, side: THREE.DoubleSide, premultipliedAlpha: true }), cap);
      m.frustumCulled = false; scene.add(m); inst.set(k, e = { m, cap }); }
    const s = U / AR, dx = (b.w / 2 - b.fx) * s, dy = (b.fy - b.h / 2) * s; sc3.set(b.w * s, b.h * s, 1);
    for (let j = 0; j < n; j++) { const p = snapV(new THREE.Vector3((g[2 * j] * TS + 8) * U, 0, (g[2 * j + 1] * TS + 16) * U).addScaledVector(CR, dx).addScaledVector(CU, dy).addScaledVector(CB, .3));
      e.m.setMatrixAt(j, mtx.compose(p, cam.quaternion, sc3)); }
    e.m.count = n; e.m.instanceMatrix.needsUpdate = true;
  }
  placeEnts();
  // 點光源：挑離玩家最近的 8 個暖光（營火、火把、子彈）
  const cols = [0xfff0d8, 0xff9040, 0x5af0dc, 0xaa96ff, 0xffd75a, 0xebf0ff, 0x6eff8c];
  perf.lights = L.length;
  const near = L.filter(l => l.r > 14).map(l => ({ l, d: (l.x - me.x) ** 2 + (l.y - me.y) ** 2 })).sort((a, b) => a.d - b.d).slice(0, pts.length);
  pts.forEach((p, i) => { const n = near[i]; if (!n) { p.intensity = 0; return; }
    p.position.set(n.l.x * U, 1.1, n.l.y * U); p.color.setHex(cols[n.l.warm] ?? cols[0]); p.distance = n.l.r * U * 1.6; p.intensity = (n.l.warm ? 3 : 1.5) * (1.2 - day * .6); });
  const t1 = performance.now();
  if (atlasTex && entCount) renderer.initTexture(atlasTex);             // 先上傳大圖（分開計時）
  const t2 = performance.now();
  renderer.render(scene, cam);
  const t3 = performance.now();
  perf.f.up = t2 - t1; perf.f.gl = t3 - t2; perf.up += (perf.f.up - perf.up) * .05; perf.gl += (perf.f.gl - perf.gl) * .05;
  perf.calls = renderer.info.render.calls;
}
export function setThreeVisible(on: boolean) { if (!ready) { if (on) init(); else return; } renderer.domElement.style.display = on ? '' : 'none'; }
export { three };
