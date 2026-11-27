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
import { rbs } from '../world/regionBoss';
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

/* ---------- 角色、怪：攔截原本的畫法，直接變成 3D 的小方塊（不用每幀上傳圖） ----------
   畫角色的程式幾乎只用 drawImage（貼一張事先畫好的圖）和 fillRect（色塊）。畫角色的時候把這兩個指令換掉：
   不真的畫，而是記下「哪張圖、四個角在哪、透明度」，在 3D 裡用同一個位置畫出來。
   每張圖只在第一次出現時上傳（走路的每一格、每把武器、每隻怪），之後每一幀只送位置 → 幾十 KB，不是幾百 MB。
   攔不到的指令（少數的路徑、文字）照常畫在疊在上面的 2D 畫布，位置一樣對得上 */
type Batch = { pos: number[]; uv: number[]; col: number[]; idx: number[]; tex: THREE.Texture; add: boolean };
const texOf = new WeakMap<object, THREE.Texture>();
const WHITE = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();
let batches = new Map<THREE.Texture, Batch>(), addBatches = new Map<THREE.Texture, Batch>();
let entCount = 0, upBytes = 0;
const cur = { x: 0, y: 0, ox: 0, oy: 0, q: 0, foot: new THREE.Vector3() };
function texFor(img: any) {
  let t = texOf.get(img); if (t) return t;
  t = px(new THREE.CanvasTexture(img)); texOf.set(img, t); upBytes += (img.width * img.height * 4) || 0;   // 第一次見到這張圖：上傳一次
  return t;
}
function cssColor(s: string): number[] | null {                         // '#rrggbb' 或 'rgba(r, g, b, a)' → [r, g, b, a]（0~1）
  if (s[0] === '#' && s.length === 7) return [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255, 1];
  const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map(Number); return [v[0] / 255, v[1] / 255, v[2] / 255, v.length > 3 ? v[3] : 1];
}
/** 一個四邊形：四個角是「這次 drawImage / fillRect 在 2D 畫布上的位置」，換成 3D 裡角色紙片上的位置 */
function addQuad(tex: THREE.Texture, w: number, h: number, u0: number, v0: number, u1: number, v1: number, col: number[]) {
  const m = ctx.getTransform(), add = ctx.globalCompositeOperation === 'lighter';
  const map = add ? addBatches : batches; let B = map.get(tex);
  if (!B) map.set(tex, B = { pos: [], uv: [], col: [], idx: [], tex, add });
  const o = B.pos.length / 3, z = cur.q++ * .004;                         // 後畫的稍微往鏡頭靠：同一個角色身上的順序不會亂
  for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]]) {
    const sx = (m.a * x + m.c * y + m.e) / F - cur.ox, sy = (m.b * x + m.d * y + m.f) / F - cur.oy;   // 相對腳底（世界像素，往下 = 正）
    const p = cur.foot.clone().addScaledVector(CR, sx * U).addScaledVector(CU, -sy * U).addScaledVector(CB, z);
    B.pos.push(p.x, p.y, p.z);
  }
  B.uv.push(u0, 1 - v0, u1, 1 - v0, u1, 1 - v1, u0, 1 - v1);
  for (let k = 0; k < 4; k++) B.col.push(col[0], col[1], col[2], col[3] * ctx.globalAlpha);
  B.idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
}
const realFill = (x: number, y: number, w: number, h: number) => CanvasRenderingContext2D.prototype.fillRect.call(ctx, x, y, w, h);   // 原本的 fillRect（攔截時蓋在 ctx 自己身上，原本的還在 prototype）
function shimDraw(img: any, ...a: number[]) {
  const W = img.width, H = img.height; if (!W || !H) return;
  let sx = 0, sy = 0, sw = W, sh = H, dx: number, dy: number, dw: number, dh: number;
  if (a.length === 2) { dx = a[0]; dy = a[1]; dw = W; dh = H; } else if (a.length === 4) { dx = a[0]; dy = a[1]; dw = a[2]; dh = a[3]; } else { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
  ctx.save(); ctx.translate(dx, dy);
  addQuad(texFor(img), dw, dh, sx / W, sy / H, (sx + sw) / W, (sy + sh) / H, [1, 1, 1, 1]);
  ctx.restore();
}
function shimFill(x: number, y: number, w: number, h: number) {
  const c = typeof ctx.fillStyle === 'string' ? cssColor(ctx.fillStyle) : null;
  if (!c) return realFill(x, y, w, h);                                    // 漸層之類的：照常畫在 2D 疊圖
  ctx.save(); ctx.translate(x, y); addQuad(WHITE, w, h, 0, 0, 1, 1, c); ctx.restore();
}
/** render.ts 呼叫：畫有腳底座標的東西（角色、怪、掉落物、營火…）。2D 疊圖的變換先設成「腳底在畫面上的位置」，攔不到的指令也會畫在對的地方 */
export function captureEnts(items: any[]) {
  if (!ready) init();
  const t0 = performance.now(); batches = new Map(); addBatches = new Map(); entCount = 0; cur.q = 0;
  items.sort((a, b) => a.y - b.y);
  ctx.save();
  (ctx as any).drawImage = shimDraw; (ctx as any).fillRect = shimFill;
  try {
    for (const it of items) {
      cur.x = it.x; cur.y = it.y; cur.ox = ovX(it.x, it.y); cur.oy = ovY(it.x, it.y);
      snapV(cur.foot.set(it.x * U, 0, it.y * U).addScaledVector(CB, 1.2));   // 往鏡頭推一點：頭不會插進後面的牆
      ctx.setTransform(F, 0, 0, F, Math.round(F * (cur.ox - it.x)), Math.round(F * (cur.oy - it.y)));
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const o = it.o, f0 = o?.face, fl0 = o?.flip;
      if (o) {                                                            // 面向、左右翻面換成「畫面上的方向」（鏡頭斜 45°）
        if (typeof f0 === 'number') o.face = scrAng(f0);
        if (G.players.includes(o)) { const c = Math.cos(o.face); if (c < -.1) o.flip = true; else if (c > .1) o.flip = false; }
        else { const wd = G.me.x - o.x, sd = (G.me.x - G.me.y) - (o.x - o.y); if (wd * sd < 0) o.flip = !o.flip; }
      }
      try { it.f(); } finally { if (o) { o.face = f0; o.flip = fl0; } }
      entCount++;
    }
  } finally { delete (ctx as any).drawImage; delete (ctx as any).fillRect; ctx.restore(); }   // 拿掉攔截 → 回到 prototype 上原本的方法
  perf.f.cap = performance.now() - t0; perf.cap += (perf.f.cap - perf.cap) * .05; perf.ents = entCount;
}
const pool: THREE.Mesh[] = [];
function placeEnts() {
  let k = 0;
  for (const B of [...batches.values(), ...addBatches.values()]) {
    let m = pool[k];
    if (!m) { m = new THREE.Mesh(new THREE.BufferGeometry(), null); m.frustumCulled = false; scene.add(m); pool[k] = m; }
    const g = m.geometry; g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 4)); g.setIndex(B.idx); g.computeVertexNormals();
    const key = (B.add ? 'a' : 'n'); let mat = (m.userData[key + B.tex.id]) as THREE.Material;
    if (!mat) mat = m.userData[key + B.tex.id] = B.add ? new THREE.MeshBasicMaterial({ map: B.tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, premultipliedAlpha: true })
      : new THREE.MeshLambertMaterial({ map: B.tex, vertexColors: true, transparent: true, alphaTest: .02, side: THREE.DoubleSide, premultipliedAlpha: true });
    m.material = mat; m.renderOrder = B.add ? 2 : 0; m.visible = true; k++;
  }
  for (; k < pool.length; k++) pool[k].visible = false;
}

/* ---------- 疊在 3D 上面的 2D 畫布：預警圈、刀光、子彈、數字（不用上傳，直接蓋在上面） ----------
   鏡頭沒有透視 → 地面到畫面是「斜轉 + 壓扁」的固定變換，2D 用 setTransform 就能精確貼在地上 */
export const ov = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };                // 世界像素 → 畫面（世界像素為單位）的變換
const tmp = new THREE.Vector3();
function scr(x: number, y: number) { tmp.set(x * U, 0, y * U).project(cam); return [(tmp.x + 1) / 2 * LW, (1 - tmp.y) / 2 * LH]; }
export const ovX = (x: number, y: number) => ov.a * x + ov.c * y + ov.e, ovY = (x: number, y: number) => ov.b * x + ov.d * y + ov.f;
/** 每一幀最先呼叫：鏡頭對準 (wx, wy)（render.ts 傳原本平滑跟隨的鏡頭中心 + 震動），對齊像素格子，算出 2D 疊圖的變換 */
export function threeCam(wx: number, wy: number) {
  if (!ready) init();
  const me = G.me, W = Math.round(LW * RS), H = Math.round(LH * RS);  // 畫面大小跟著原本的鏡頭範圍（LW × LH 世界像素）
  if (renderer.domElement.width !== W || renderer.domElement.height !== H) { renderer.setSize(W, H, false); cam.left = -LW * U / 2; cam.right = LW * U / 2; cam.top = LH * U / 2; cam.bottom = -LH * U / 2; cam.updateProjectionMatrix(); }
  const T = snapV(new THREE.Vector3(wx * U, .5, wy * U));              // 鏡頭對準的點對齊像素格子：整個世界跟著整數像素移動，不會閃。用平滑的鏡頭：第三段往前踏一步時世界不會跟著跳
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
  const t2 = performance.now();
  renderer.render(scene, cam);
  const t3 = performance.now();
  perf.f.up = upBytes / 1e6; upBytes = 0; perf.f.gl = t3 - t2; perf.up += (perf.f.up - perf.up) * .05;   // up 改成「這一幀新上傳了幾 MB」 perf.gl += (perf.f.gl - perf.gl) * .05;
  perf.calls = renderer.info.render.calls;
}
export function setThreeVisible(on: boolean) { if (!ready) { if (on) init(); else return; } renderer.domElement.style.display = on ? '' : 'none'; }
export { three };
