import type { Camp } from '../types';
/* ================= WORLD ================= */
export const TS = 16, MW = 256, MH = 192;
export const GROUND = 0, ROAD = 1, WATER = 2, LAVA = 3, CLIFF = 4, RWALL = 5, RFLOOR = 6, BRIDGE = 7, TREE = 8, ROCK = 9, PILLAR = 10, CRATE = 11, FOG = 12, GRAVE = 13, BIGT = 14;
export const SOLID = new Set([WATER, LAVA, CLIFF, RWALL, TREE, ROCK, PILLAR, CRATE, GRAVE, BIGT]);
export const BLOCKP = new Set([CLIFF, RWALL, TREE, ROCK, PILLAR, CRATE, GRAVE, BIGT]);
export const WALKABLE = t => t === GROUND || t === ROAD || t === RFLOOR || t === BRIDGE || t === FOG;
export const map = new Uint8Array(MW * MH), reg = new Uint8Array(MW * MH), shade = new Uint8Array(MW * MH);
export const REGIONS = [
  { key:'plains', name:'翠風平原', sub:'建議等級 1–5', c:[64,140], amb:.06, tint:[10,12,30] },
  { key:'forest', name:'迷霧森林', sub:'建議等級 5–10', c:[186,142], amb:.36, tint:[4,14,12] },
  { key:'wastes', name:'骸骨荒地', sub:'建議等級 10–15', c:[66,48], amb:.2, tint:[30,18,8] },
  { key:'lava', name:'熔岩高地', sub:'建議等級 15–20', c:[190,46], amb:.32, tint:[26,4,4] },
  { key:'den', name:'狼王巢穴', sub:'建議等級 7 以上', amb:.52, tint:[8,4,12] },
];
export const ARENA = { x0:181, y0:102, x1:199, y1:119 };
export const DOOR = [189, 190, 191];
export const CAMPS: Camp[] = [
  { id:'start', name:'起始營火', tx:30, ty:165, lit:true },
  { id:'village', name:'村落營火', tx:72, ty:146 },
  { id:'forest', name:'林間營火', tx:150, ty:147 },
  { id:'den', name:'巢穴前營火', tx:185, ty:125 },
  { id:'wastes', name:'遺跡營火', tx:57, ty:76 },
  { id:'lava', name:'熔岩營火', tx:172, ty:67 },
];
for (const c of CAMPS) { c.lit = !!c.lit; c.x = c.tx * TS + 8; c.y = c.ty * TS + 10; }
export const SUBS = [
  { name:'起始營地', x:30, y:165, r:7 }, { name:'殘破村落', x:88, y:150, r:14 }, { name:'鏡湖', x:40, y:112, r:11 },
  { name:'蘑菇谷', x:165, y:120, r:11 }, { name:'翠綠窪地', x:94, y:113, r:10 }, { name:'將軍墳場', x:24, y:14, r:10 }, { name:'燼龍火口', x:222, y:58, r:11 }, { name:'古樹空地', x:205, y:165, r:11 },
  { name:'沉沒遺跡', x:80, y:40, r:16 }, { name:'骸骨墓地', x:35, y:30, r:10 }, { name:'熔岩裂谷', x:206, y:34, r:13 },
];
export const ROADS = [
  [[30,165],[50,152],[88,150]], [[88,150],[78,125],[64,100],[62,72],[80,40]], [[88,150],[125,150],[150,151],[205,165]],
  [[78,125],[125,122],[165,120],[190,128],[190,121]], [[190,128],[215,110],[212,90],[172,63],[206,34]],
  [[80,40],[128,48],[172,63]], [[62,72],[35,30]], [[50,152],[40,120]],
];
export const torches = [], glows = [], braziers = [], spawns = [];
/* fogLocked, bossDead → 已移到 G（core/state.js） */
export const explored = new Uint8Array(MW * MH), discovered = new Set();

/* ---- 區域 boss：每隻有自己的場地（魔法結界圈），走進去就開打，死掉會重置 ---- */
