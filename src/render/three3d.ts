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
import { CH, groundChunk } from '../world/chunks';
import { scrAng } from './iso';
import { three } from './isoState';

const U = 1 / TS;                                                      // 世界像素 → 3D 單位
const YAW = Math.PI / 4, PITCH = 50 * Math.PI / 180, DIST = 26;          // 鏡頭：斜 45°、往下看 50°
let renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.PerspectiveCamera;
let sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight, decal: THREE.Mesh, decalTex: THREE.CanvasTexture;
const pts: THREE.PointLight[] = [];
let ready = false;

function init() {
  const c3 = document.createElement('canvas'); c3.id = 'cv3';
  c3.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:0;pointer-events:none';
  cv.parentElement.insertBefore(c3, cv.nextSibling);
  renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xaebccc, 30, 70);
  cam = new THREE.PerspectiveCamera(30, 16 / 9, 1, 200);
  hemi = new THREE.HemisphereLight(0xdfe8ff, 0x46503a, 1.6); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff2dc, 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 120; sun.shadow.bias = -.0008;
  scene.add(sun); scene.add(sun.target);
  for (let i = 0; i < 8; i++) { const p = new THREE.PointLight(0xffa050, 0, 6, 1.5); scene.add(p); pts.push(p); }   // 固定 8 盞，每幀挑最近的光源（燈數固定，shader 不用重編）
  decalTex = new THREE.CanvasTexture(cv); px(decalTex);
  decal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, fog: false }));
  decal.rotation.x = -Math.PI / 2; decal.renderOrder = 1; scene.add(decal);
  const fit = () => { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  addEventListener('resize', fit); fit();
  ready = true;
}
function px<T extends THREE.Texture>(t: T): T { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; }

/* ---------- 地形：一塊 16×16 格一個網格 ---------- */
const hOf = (i: number) => { const t = map[i]; return t === RWALL ? 22 : t === CLIFF ? 10 + Math.min(6, hgt[i]) * 5 : t === WATER || t === LAVA ? -3 : 0; };   // 世界像素
const terr = new Map<number, THREE.Mesh>();
function terrainChunk(gx: number, gy: number) {
  const key = gy * 1000 + gx; let m = terr.get(key); if (m) return m;
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
  m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: px(new THREE.CanvasTexture(groundChunk(gx, gy))) }));
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
const objMeshes: THREE.Mesh[] = [];
const quadGeo = new THREE.PlaneGeometry(1, 1);
let objUsed = 0;
/** 一張紙片：面向鏡頭，圖上的 (fx, fy) 對齊世界的腳底 (wx, wy)；scale = 1 美術像素幾個 3D 單位 */
function placeBill(list: THREE.Mesh[], idx: number, tex: THREE.Texture, w: number, h: number, fx: number, fy: number, wx: number, wy: number, scale: number, push = .6) {
  let m = list[idx];
  if (!m) { m = new THREE.Mesh(quadGeo, new THREE.MeshLambertMaterial({ transparent: true, alphaTest: .5, side: THREE.DoubleSide })); m.receiveShadow = false; scene.add(m); list[idx] = m; }
  const mat = m.material as THREE.MeshLambertMaterial; if (mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; }
  m.visible = true; m.scale.set(w * scale, h * scale, 1); m.quaternion.copy(cam.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), back = new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion);
  const dx = (w / 2 - fx) * scale, dy = (fy - h / 2) * scale;           // 腳底 → 紙片中心
  m.position.set(wx * U, 0, wy * U).addScaledVector(right, dx).addScaledVector(up, dy).addScaledVector(back, push);   // 往鏡頭推一點：頭不會插進後面的牆
  return m;
}

/* ---------- 角色、怪：每一幀照原本的畫法畫到 2D 畫布角落，再複製成貼圖 ---------- */
const CAP = 128;                                                       // 擷取範圍（世界像素）：腳底在 (64, 112)
type Ent = { c: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
const ents: Ent[] = [], entMeshes: THREE.Mesh[] = [];
function entSlot(k: number) {
  let e = ents[k]; const S = CAP * F;
  if (!e || e.c.width !== S) { const c = document.createElement('canvas'); c.width = c.height = S; e = ents[k] = { c, g: c.getContext('2d'), tex: px(new THREE.CanvasTexture(c)) }; }
  return e;
}
/** render.ts 呼叫：把有腳底座標的東西（角色、怪、掉落物、營火…）擷取成貼圖。2D 畫布上已經畫的東西先存起來，擷取完再放回去 */
const keep = document.createElement('canvas');
let entCount = 0;
export function captureEnts(items: any[]) {
  if (!ready) init();
  if (keep.width !== cv.width || keep.height !== cv.height) { keep.width = cv.width; keep.height = cv.height; }
  const kg = keep.getContext('2d'); kg.clearRect(0, 0, keep.width, keep.height); kg.drawImage(cv, 0, 0);
  const S = CAP * F; entCount = 0;
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
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
    const e = entSlot(entCount); e.g.clearRect(0, 0, S, S); e.g.drawImage(cv, 0, 0, S, S, 0, 0, S, S); e.tex.needsUpdate = true;
    (e as any).x = it.x; (e as any).y = it.y; entCount++;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(keep, 0, 0);
}

/* ---------- 每一幀 ---------- */
const v3 = new THREE.Vector3();
export function drawThree(cx: number, cy: number, L: any[], amb: number, tint: number[], regionKey: string) {
  if (!ready) init();
  const me = G.me, tx = me.x * U, tz = me.y * U;
  cam.position.set(tx + Math.sin(YAW) * Math.cos(PITCH) * DIST, Math.sin(PITCH) * DIST, tz + Math.cos(YAW) * Math.cos(PITCH) * DIST);
  cam.lookAt(tx, .5, tz); cam.updateMatrixWorld();
  // 天色：地區越暗（amb 大），太陽越弱、霧越接近地區的色調
  const day = Math.max(.15, 1 - amb * 1.6);
  sun.intensity = 2.4 * day; hemi.intensity = .5 + 1.2 * day;
  const fogC = new THREE.Color(`rgb(${Math.round(150 * day + tint[0] * 2)},${Math.round(165 * day + tint[1] * 2)},${Math.round(185 * day + tint[2] * 2)})`);
  (scene.fog as THREE.Fog).color.copy(fogC); renderer.setClearColor(fogC);
  sun.position.set(tx - 14, 26, tz + 8); sun.target.position.set(tx, 0, tz);
  // 地形：玩家周圍 5×5 塊
  const gx0 = Math.floor(me.x / (CH * TS)), gy0 = Math.floor(me.y / (CH * TS));
  for (const m of terr.values()) m.visible = false;
  for (let gy = gy0 - 2; gy <= gy0 + 2; gy++) for (let gx = gx0 - 2; gx <= gx0 + 2; gx++) if (gx >= 0 && gy >= 0 && gx * CH < MW && gy * CH < MH) terrainChunk(gx, gy).visible = true;
  if (terr.size > 60) for (const [k, m] of terr) { if (m.visible) continue; m.geometry.dispose(); ((m.material as THREE.MeshLambertMaterial).map)?.dispose(); scene.remove(m); terr.delete(k); if (terr.size <= 40) break; }
  // 物件紙片：玩家周圍 ±26 格
  objUsed = 0; const R = 26, ptx = Math.floor(me.x / TS), pty = Math.floor(me.y / TS);
  for (let y = Math.max(0, pty - R); y <= Math.min(MH - 1, pty + R); y++) for (let x = Math.max(0, ptx - R); x <= Math.min(MW - 1, ptx + R); x++) {
    const k = objectKey(x, y); if (!k) continue;
    const b = objBill(x, y, k); placeBill(objMeshes, objUsed++, b.tex, b.w, b.h, b.fx, b.fy, x * TS + 8, y * TS + 16, U / AR, .3);
  }
  for (let i = objUsed; i < objMeshes.length; i++) objMeshes[i].visible = false;
  // 角色紙片（擷取範圍 CAP 世界像素 = CAP·F 貼圖像素）
  for (let i = 0; i < entCount; i++) { const e = ents[i] as any; placeBill(entMeshes, i, e.tex, CAP * F, CAP * F, 64 * F, 112 * F, e.x, e.y, U / F, 1.2); }
  for (let i = entCount; i < entMeshes.length; i++) entMeshes[i].visible = false;
  // 地面貼花：2D 畫布（俯視，範圍 cx ~ cx+LW、cy ~ cy+LH）
  decalTex.needsUpdate = true; decal.scale.set(LW * U, LH * U, 1); decal.position.set((cx + LW / 2) * U, .03, (cy + LH / 2) * U);
  // 點光源：挑離玩家最近的 8 個暖光（營火、火把、子彈）
  const cols = [0xfff0d8, 0xff9040, 0x5af0dc, 0xaa96ff, 0xffd75a, 0xebf0ff, 0x6eff8c];
  const near = L.filter(l => l.r > 14).map(l => ({ l, d: (l.x - me.x) ** 2 + (l.y - me.y) ** 2 })).sort((a, b) => a.d - b.d).slice(0, pts.length);
  pts.forEach((p, i) => { const n = near[i]; if (!n) { p.intensity = 0; return; }
    p.position.set(n.l.x * U, 1.1, n.l.y * U); p.color.setHex(cols[n.l.warm] ?? cols[0]); p.distance = n.l.r * U * 1.6; p.intensity = (n.l.warm ? 3 : 1.5) * (1.2 - day * .6); });
  renderer.render(scene, cam);
}
export function setThreeVisible(on: boolean) { if (!ready) { if (on) init(); else return; } renderer.domElement.style.display = on ? '' : 'none'; cv.style.visibility = on ? 'hidden' : ''; }
export { three };
