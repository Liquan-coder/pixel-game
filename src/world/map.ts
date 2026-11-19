import type { Camp } from '../types';
/* ================= WORLD ================= */
export const TS = 16, MW = 352, MH = 384;          // 384：往南擴大一倍，新的南半邊整片都是平原（舊地圖是 352×192，再更早是 256 寬）
export const GROUND = 0, ROAD = 1, WATER = 2, LAVA = 3, CLIFF = 4, RWALL = 5, RFLOOR = 6, BRIDGE = 7, TREE = 8, ROCK = 9, PILLAR = 10, CRATE = 11, FOG = 12, GRAVE = 13, BIGT = 14;
export const HOUSE = 15;                                              // 城鎮的房子：一棟佔好幾格，整棟畫成一張圖
export const SOLID = new Set([WATER, LAVA, CLIFF, RWALL, TREE, ROCK, PILLAR, CRATE, GRAVE, BIGT, HOUSE]);
export const BLOCKP = new Set([CLIFF, RWALL, TREE, ROCK, PILLAR, CRATE, GRAVE, BIGT, HOUSE]);
export const WALKABLE = t => t === GROUND || t === ROAD || t === RFLOOR || t === BRIDGE || t === FOG;
export const map = new Uint8Array(MW * MH), reg = new Uint8Array(MW * MH), shade = new Uint8Array(MW * MH);
export const REGIONS = [
  { key:'plains', name:'翠風平原', sub:'建議等級 1–5', c:[150,292], cs:[[64,140],[70,236],[160,236],[110,330],[200,316]], amb:.06, tint:[10,12,30] },   // cs = 用來分地區的中心點（平原很大，用好幾個）；c = 地圖上地名的位置
  { key:'forest', name:'迷霧森林', sub:'建議等級 5–10', c:[186,142], amb:.36, tint:[4,14,12] },
  { key:'wastes', name:'骸骨荒地', sub:'建議等級 10–15', c:[66,48], amb:.2, tint:[30,18,8] },
  { key:'lava', name:'熔岩高地', sub:'建議等級 15–20', c:[190,46], amb:.32, tint:[26,4,4] },
  { key:'den', name:'狼王巢穴', sub:'建議等級 7 以上', amb:.52, tint:[8,4,12] },
  { key:'snow', name:'霜寒雪原', sub:'建議等級 20–25', c:[304,46], amb:.1, tint:[14,22,44] },
  { key:'swamp', name:'幽影沼澤', sub:'建議等級 25–30', c:[302,148], amb:.3, tint:[10,20,8] },
];
export const OPEN_REGIONS = [0, 1, 2, 3, 5, 6];                       // 野外地區（4 = 狼王巢穴，不是野外）
export const ARENA = { x0:181, y0:102, x1:199, y1:119 };
export const DOOR = [189, 190, 191];
export const CAMPS: Camp[] = [
  { id:'start', name:'起始營火', tx:118, ty:356, lit:true },          // 新遊戲從平原最南邊開始（v7 以前的存檔：舊的起始營火改叫 west）
  { id:'ford', name:'古橋營火', tx:124, ty:270 },
  { id:'mill', name:'風車丘營火', tx:198, ty:322 },
  { id:'coast', name:'東岸營火', tx:232, ty:232 },
  { id:'west', name:'西丘營火', tx:30, ty:165 },
  { id:'dawn', name:'晨風鎮營火', tx:62, ty:134 },
  { id:'village', name:'村落營火', tx:72, ty:146 },
  { id:'forest', name:'林間營火', tx:150, ty:147 },
  { id:'den', name:'巢穴前營火', tx:185, ty:125 },
  { id:'wastes', name:'遺跡營火', tx:57, ty:76 },
  { id:'lava', name:'熔岩營火', tx:172, ty:67 },
  { id:'frost', name:'霜歌鎮營火', tx:268, ty:72 },
  { id:'swamp', name:'沼澤營火', tx:292, ty:127 },
];
for (const c of CAMPS) { c.lit = !!c.lit; c.x = c.tx * TS + 8; c.y = c.ty * TS + 10; }
export const SUBS = [
  { name:'起始之丘', x:118, y:356, r:8 }, { name:'牧草原', x:166, y:352, r:14 }, { name:'南湖', x:58, y:332, r:11 }, { name:'古橋', x:122, y:278, r:8 },
  { name:'風車丘', x:198, y:318, r:12 }, { name:'東岸', x:240, y:240, r:12 }, { name:'落石坡', x:66, y:252, r:12 }, { name:'西丘', x:30, y:165, r:7 }, { name:'殘破村落', x:88, y:150, r:14 }, { name:'鏡湖', x:40, y:112, r:11 },
  { name:'蘑菇谷', x:165, y:120, r:11 }, { name:'翠綠窪地', x:94, y:113, r:10 }, { name:'將軍墳場', x:24, y:14, r:10 }, { name:'燼龍火口', x:222, y:58, r:11 }, { name:'古樹空地', x:205, y:165, r:11 },
  { name:'沉沒遺跡', x:80, y:40, r:16 }, { name:'骸骨墓地', x:35, y:30, r:10 }, { name:'熔岩裂谷', x:206, y:34, r:13 },
  { name:'晨風鎮', x:62, y:130, r:12 }, { name:'霜歌鎮', x:268, y:68, r:12 }, { name:'冰封湖', x:318, y:78, r:11 }, { name:'雪頂祭壇', x:326, y:24, r:11 },
  { name:'孢子深谷', x:150, y:173, r:11 }, { name:'沉木林', x:266, y:160, r:14 }, { name:'腐沼祭壇', x:322, y:168, r:11 },
];
export const ROADS = [
  [[118,356],[118,320],[122,284],[108,244],[80,212],[50,178],[50,152]], [[118,320],[160,332],[198,322]], [[198,322],[236,282],[232,236],[214,200],[205,168]],
  [[122,284],[76,292],[60,322]], [[108,244],[168,232],[232,236]],
  [[30,165],[50,152],[88,150]], [[88,150],[78,125],[64,100],[62,72],[80,40]], [[88,150],[125,150],[150,151],[205,165]],
  [[78,125],[125,122],[165,120],[190,128],[190,121]], [[190,128],[215,110],[212,90],[172,63],[206,34]],
  [[80,40],[128,48],[172,63]], [[62,72],[35,30]], [[50,152],[40,120]],
  [[50,152],[56,142],[62,134]], [[62,127],[70,124],[78,125]],
  [[150,151],[150,161]],
  [[212,90],[240,84],[268,70]], [[268,70],[296,50],[312,38]], [[268,70],[290,96],[292,124]], [[292,124],[312,152]], [[292,124],[266,150],[262,166]],
];
export const torches = [], glows = [], braziers = [], spawns = [];
/* 城鎮：中間是廣場和十字街，周圍一圈房子。snow = 屋頂積雪的雪國小鎮 */
export const TOWNS = [
  { id:'dawn', name:'晨風鎮', tx:62, ty:130, r:12, snow:false, lv:4 },
  { id:'frost', name:'霜歌鎮', tx:268, ty:68, r:12, snow:true, lv:23 },
];
/* 房子（genWorld 填）：tx/ty = 左上角那格，w/h = 佔幾格；roof = 屋頂顏色編號；smith = 鐵匠鋪（門口掛鐵砧招牌） */
export const HOUSES: { tx: number; ty: number; w: number; h: number; roof: number; snow: boolean; smith?: boolean }[] = [];
/* fogLocked, bossDead → 已移到 G（core/state.js） */
export const explored = new Uint8Array(MW * MH), discovered = new Set();

/* ---- 區域 boss：每隻有自己的場地（魔法結界圈），走進去就開打，死掉會重置 ---- */
