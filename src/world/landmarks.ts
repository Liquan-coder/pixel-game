/* ================= 地標：Boss 所在的特別地點，還有各地區認得出來的場景 =================
   像艾爾登法環那樣，Boss 不是隨便站在野外，而是在一眼就記得住的地方：
   湖中島的祭壇（鏡湖）、王城中庭（城門前有營火）、火山口的平台、雪山頂的祭壇、沼澤深處的祭壇……
   genWorld 在地形和植物都放好之後呼叫 buildLandmarks()，再來才鋪路、蓋城鎮。 */
import { CLIFF, CRATE, GRAVE, GROUND, LAVA, MH, MW, PILLAR, RFLOOR, ROCK, RWALL, STAIRS, TREE, TS, WATER, BIGT, braziers, map } from './map';
import { I, clearDisk, inb, wallRect } from './gen';
import { POIS } from '../data/poi';

/* 發光蘑菇特別多的地方（森林、沼澤） */
export const GLOW_ZONES: [number, number, number][] = [[240, 298, 13], [212, 342, 11], [455, 355, 14], [522, 286, 10]];

/* 地圖上顯示的地標（探索到才會出現圖示，點了會顯示說明）。Boss 不標，但 Boss 所在的地方本身是地標 */
const LANDMARKS: [string, string, number, number, string][] = [
  ['mirror', '鏡湖聖堂', 34, 322, '湖面平得像一面鏡子。湖心的島上是一座古老的聖堂，一座橋從東岸通過去'],
  ['fort', '古哨堡', 180, 482, '平原中央的舊哨堡，城門朝北。最後一位哨兵一直沒有等到換班的人'],
  ['howl', '月嚎獵宮', 300, 276, '森林東北的岩丘上，狼騎士們的舊獵宮。夜裡會傳來狼嚎'],
  ['spore', '孢子深谷', 212, 342, '岩壁圍起來的深谷，只有東邊一個開口'],
  ['oak', '古樹空地', 366, 378, '森林裡最古老的一棵樹'],
  ['mist', '霧之學塔', 372, 252, '霧裡的圓形學塔。以前有一群學者在這裡研究霧'],
  ['castle', '古王城', 100, 120, '星墜之夜以前的王都。城門 → 內門 → 中庭 → 內城，城門前有一座營火'],
  ['sunken', '沉沒遺跡', 160, 62, '一半埋在沙裡的觀星台'],
  ['graves', '骸骨墓地', 38, 48, '守光騎士們長眠的墓地'],
  ['beast', '巨獸骸骨', 118, 250, '一頭巨獸的骨架，肋骨像拱門一樣立在沙地上'],
  ['caldera', '燼龍火口', 330, 68, '熔岩高地中央的火山口。古王國在火口外築了要塞，把什麼東西鎖在裡面'],
  ['slag', '熔渣池', 252, 108, '冒著泡的熔渣池，地面在微微震動'],
  ['forge', '古代熔爐', 380, 166, '巨大的熔爐，裡面有往下的階梯。後門通往倒廢渣的後院'],
  ['obsidian', '黑曜石林', 304, 168, '一根根黑曜石柱，像燒焦的森林'],
  ['summit', '霜頂城塞', 600, 34, '雪原東北角的山頂上的城塞。守軍在這裡等光回來'],
  ['icelake', '冰封湖', 560, 174, '結冰的大湖，湖心島上有一座冰龕'],
  ['rotaltar', '腐沼大殿', 590, 442, '沼澤最深處，半沉在水裡的大殿。一座長橋從北邊通進去'],
  ['sunkwood', '沉木林', 455, 355, '泡在水裡的枯樹林，到處是發光的菇'],
  ['witch', '巫婆小屋', 522, 300, '沒有人住的小屋，鍋子還是溫的。後門通往圍起來的菇園'],
];

const ringAt = (cx: number, cy: number, r: number, n: number, skip: (a: number) => boolean, t: number) => {
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; if (skip(a)) continue; const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); if (inb(x, y)) map[I(x, y)] = t; } };
const disk = (cx: number, cy: number, r: number, f: (i: number, d: number, x: number, y: number) => void) => {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { if (!inb(x, y)) continue; const d = Math.hypot(x - cx, y - cy); if (d <= r) f(I(x, y), d, x, y); } };
const tower = (x0: number, y0: number, w = 4) => { for (let y = y0; y < y0 + w; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) map[I(x, y)] = RWALL; };   // 角樓：一整塊牆
const fire = (tx: number, ty: number) => braziers.push({ x: tx * TS + 8, y: ty * TS + 12 });   // 火盆（門口、聖壇）
const angDist = (a: number, b: number) => { const d = Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); return d; };

export function buildLandmarks(R: () => number, nE: (x: number, y: number) => number) {
  POIS.length = 0;
  for (const [id, name, tx, ty, desc] of LANDMARKS) POIS.push({ id, name, tx, ty, kind: 'landmark', desc });
  const wobble = (x: number, y: number) => (nE(x * 2.1, y * 2.1) - .5) * 3;

  /* ---------- 平原 ---------- */
  // 殘破村落
  clearDisk(88, 366, 15, true);
  for (const [ox, oy, w, h] of [[-11, -8, 7, 6], [2, -9, 8, 6], [-10, 4, 7, 5], [4, 4, 8, 6], [14, -3, 6, 5]]) {
    wallRect(R, 88 + ox, 366 + oy, w, h, .2, 's');
    if (R() < .7) { const x = 88 + ox + 1 + Math.floor(R() * (w - 2)), y = 366 + oy + 1; if (map[I(x, y)] === RFLOOR) map[I(x, y)] = CRATE; }
  }
  // 鏡湖：一大片圓湖，湖心的小島是史萊姆女王的祭壇（東邊的路會變成橋）
  // 鏡湖聖堂：湖心島上的聖堂，門朝東（東岸的路會變成橋，直通聖堂的門）。史萊姆女王在中殿，聖壇在最西邊
  disk(34, 322, 25, (i, d, x, y) => { const e = ((x - 34) / 21) ** 2 + ((y - 322) / 18) ** 2;
    if (d < 13.5) map[i] = GROUND; else if (e < 1 + (nE(x, y) - .5) * .25) map[i] = WATER; else if (e < 1.25 && (map[i] === TREE || map[i] === ROCK || map[i] === CLIFF)) map[i] = GROUND; });
  wallRect(R, 22, 310, 25, 25, 0, 'e');
  for (const y of [313, 331]) for (let x = 27; x <= 43; x += 4) map[I(x, y)] = PILLAR;          // 中殿兩排柱廊
  for (const y of [318, 326]) map[I(24, y)] = PILLAR; for (let y = 320; y <= 324; y++) map[I(23, y)] = RWALL;   // 聖壇
  fire(25, 319); fire(25, 325);
  // 古哨堡：平原中央的舊哨堡，城門朝北（路從北邊接過來），四角有角樓。苔甲守衛在中庭
  clearDisk(180, 482, 18, false);
  wallRect(R, 168, 471, 25, 23, 0, 'n');
  for (const [x, y] of [[166, 469], [190, 469], [166, 491], [190, 491]]) tower(x, y);
  for (const [x, y] of [[171, 474], [189, 474], [171, 490], [189, 490]]) map[I(x, y)] = CRATE;
  fire(178, 468); fire(182, 468);

  /* ---------- 森林 ---------- */
  // 蘑菇谷：樹比較少，發光蘑菇很多
  disk(240, 298, 13, i => { if (map[i] === TREE && R() < .7) map[i] = GROUND; });
  // 孢子深谷：岩壁圍起來的圓形深谷，只有東邊一個開口
  disk(212, 342, 16, (i, d, x, y) => { const a = Math.atan2(y - 342, x - 212);
    if (d < 11.5) map[i] = GROUND; else if (d < 14.5 + wobble(x, y) && angDist(a, 0) > .42) map[i] = CLIFF; else if (angDist(a, 0) <= .42 && d < 15) map[i] = GROUND; });
  // 古樹空地
  clearDisk(366, 378, 10, false);
  for (const [x, y] of [[366, 377], [367, 377], [366, 376], [367, 376]]) map[I(x, y)] = BIGT;
  // 霧之學塔：圓形的學塔，門朝南，北邊是塔身。女妖在塔裡的大廳
  clearDisk(372, 252, 17, false);
  disk(372, 252, 13, (i, d, x, y) => { if (d < 11) map[i] = R() < .2 ? GROUND : RFLOOR;
    else if (d < 12.8) map[i] = angDist(Math.atan2(y - 252, x - 372), Math.PI / 2) < .15 ? RFLOOR : RWALL; });
  ringAt(372, 252, 10.2, 10, a => angDist(a, Math.PI / 2) < .5, PILLAR);
  tower(369, 235, 7);
  fire(369, 266); fire(375, 266);
  // 獵人小屋
  clearDisk(282, 346, 6, false); wallRect(R, 279, 343, 7, 6, .25, 's'); map[I(281, 345)] = CRATE;
  // 林中湖
  disk(206, 248, 8, (i, d, x, y) => { if (((x - 206) / 7) ** 2 + ((y - 248) / 5) ** 2 < 1 + (nE(x, y) - .5) * .4) map[i] = WATER; });

  /* ---------- 荒地 ---------- */
  // 古王城：外牆 + 四角的塔 + 內城（裡面有往地底的階梯）+ 中庭（骸骨將軍）。城門朝南，門外是王城營火
  clearDisk(100, 120, 33, false);
  wallRect(R, 72, 96, 57, 48, 0, 's');
  for (const [tx, ty] of [[70, 94], [125, 94], [70, 140], [125, 140]]) for (let y = ty; y < ty + 5; y++) for (let x = tx; x < tx + 5; x++) if (inb(x, y)) map[I(x, y)] = RWALL;
  for (let x = 99; x <= 101; x++) for (let y = 140; y <= 144; y++) map[I(x, y)] = RFLOOR;     // 城門不要被塔擋住
  wallRect(R, 88, 99, 25, 17, .03, 's');
  for (const x of [92, 108]) for (const y of [102, 106, 110]) map[I(x, y)] = PILLAR;
  wallRect(R, 76, 100, 9, 12, .3, 'e'); wallRect(R, 116, 100, 9, 12, .3, 'w'); wallRect(R, 76, 125, 8, 10, .35, 'e'); wallRect(R, 117, 125, 8, 10, .35, 'w');
  for (let y = 97; y < 143; y++) for (let x = 73; x < 128; x++) { const i = I(x, y); if (map[i] === RFLOOR && R() < .22 && !(x >= 89 && x <= 111 && y >= 100 && y <= 114)) map[i] = GROUND; }   // 中庭的石板有些碎掉、長出土
  for (const x of [95, 105]) map[I(x, 140)] = PILLAR;
  for (const [x, y] of [[80, 104], [120, 104], [79, 130], [121, 130]]) if (map[I(x, y)] === RFLOOR || map[I(x, y)] === GROUND) map[I(x, y)] = CRATE;
  // 內門：城門進來先是小前院，穿過內門才是中庭（將軍）；中庭兩側有牆和側門、一排柱廊；中庭的北邊是內城的門
  for (let x = 73; x <= 127; x++) map[I(x, 137)] = Math.abs(x - 100) <= 1 ? RFLOOR : RWALL;
  for (let y = 116; y <= 136; y++) for (const x of [86, 114]) map[I(x, y)] = Math.abs(y - 127) <= 1 ? RFLOOR : RWALL;
  for (let y = 119; y <= 135; y += 4) for (const x of [89, 111]) map[I(x, y)] = PILLAR;
  for (let y = 116; y <= 136; y++) for (let x = 87; x <= 113; x++) if (map[I(x, y)] === GROUND) map[I(x, y)] = RFLOOR;
  fire(97, 139); fire(103, 139);
  // 骸骨墓地
  clearDisk(38, 48, 12, true);
  for (let y = 41; y <= 55; y += 3) for (let x = 31; x <= 45; x += 3) if (((x - 38) ** 2 + (y - 48) ** 2) < 64 && R() < .75) map[I(x, y)] = GRAVE;
  // 沉沒遺跡（觀星台）
  clearDisk(160, 62, 18, true);
  wallRect(R, 146, 52, 28, 20, .28, 'nsew');
  for (let x = 150; x <= 170; x += 4) { for (const y of [56, 67]) map[I(x, y)] = PILLAR; }
  wallRect(R, 155, 58, 10, 8, .12, 's');
  // 巨獸骸骨：兩排肋骨（石柱）+ 頭骨（岩石）
  clearDisk(118, 250, 13, false);
  for (let x = 108; x <= 128; x += 4) for (const y of [239, 261]) map[I(x, y)] = PILLAR;
  for (const [x, y] of [[104, 248], [104, 252], [103, 250], [105, 250]]) map[I(x, y)] = ROCK;
  // 紅岩石台
  disk(170, 172, 8, (i, d, x, y) => { if (((x - 170) / 7) ** 2 + ((y - 172) / 5) ** 2 < 1 + (nE(x, y) - .5) * .4) map[i] = CLIFF; });

  /* ---------- 熔岩 ---------- */
  // 燼龍火口：岩壁一圈 → 熔岩湖 → 中間的岩台（南邊的路會切開岩壁、在熔岩上架橋）
  disk(330, 68, 22, (i, d, x, y) => { if (d < 11) map[i] = RFLOOR; else if (d < 14) map[i] = LAVA; else if (d < 18.5 + wobble(x, y)) map[i] = CLIFF; });
  ringAt(330, 68, 10.2, 12, a => angDist(a, Math.PI / 2) < .4, PILLAR);                          // 鎖龍的石樁
  // 火口要塞：火口南邊的前院（兩道門），路穿過岩壁 → 橋 → 中央的石台
  clearDisk(330, 92, 9, true);
  wallRect(R, 320, 86, 21, 12, 0, 'ns');
  tower(316, 93); tower(341, 93);
  fire(327, 99); fire(333, 99);
  // 熔渣池：一圈不完整的熔岩
  clearDisk(252, 108, 10, false);
  disk(252, 108, 14, (i, d, x, y) => { if (d > 10.5 && d < 13.5 && nE(x * 2, y * 2) > .42) map[i] = LAVA; });
  // 古代熔爐（裡面有往地底遺跡的階梯）
  clearDisk(380, 154, 24, false);
  wallRect(R, 370, 158, 21, 14, 0, 'sn');
  // 熔爐的後院：倒廢渣的坑（熔渣母體）。只能從熔爐的後門走過去
  wallRect(R, 368, 128, 25, 22, 0, 's');
  for (const [cx, cy] of [[372, 132], [388, 132], [372, 145], [388, 145]]) disk(cx, cy, 2.2, i => { map[i] = LAVA; });
  for (let y = 150; y <= 157; y++) { for (let x = 377; x <= 383; x++) map[I(x, y)] = Math.abs(x - 380) <= 1 ? RFLOOR : x === 377 || x === 383 ? RWALL : GROUND; }
  fire(377, 173); fire(383, 173);
  for (const [x, y] of [[373, 161], [387, 161], [373, 168], [387, 168]]) map[I(x, y)] = PILLAR;
  for (const [x, y] of [[372, 164], [388, 165], [375, 160]]) map[I(x, y)] = CRATE;
  // 黑曜石林
  disk(304, 168, 11, (i, d, x, y) => { if (map[i] === GROUND && ((x * 7 + y * 13) % 11 === 0 || R() < .06)) map[i] = ROCK; });

  /* ---------- 雪原 ---------- */
  // 雪頂祭壇：一座岩山，山頂是平台 + 一圈石柱，南邊一條山路切上去
  // 霜頂城塞：山頂的城塞（四角有角樓），南邊一個前院，山路從南邊切上來穿過兩道門
  disk(600, 34, 31, (i, d, x, y) => { if (d < 15) map[i] = GROUND; else if (d < 25 + wobble(x, y) * 1.3) map[i] = CLIFF; });
  wallRect(R, 589, 23, 23, 23, 0, 's');
  for (const [x, y] of [[587, 21], [609, 21], [587, 43], [609, 43]]) tower(x, y);
  wallRect(R, 594, 45, 13, 8, 0, 'ns');
  for (const [x, y] of [[591, 25], [609, 25], [591, 43], [609, 43]]) if (map[I(x, y)] === RFLOOR) map[I(x, y)] = PILLAR;
  fire(597, 50); fire(603, 50);
  // 冰封湖：大湖 + 湖心島
  disk(560, 174, 24, (i, d, x, y) => { const e = ((x - 560) / 22) ** 2 + ((y - 174) / 15) ** 2;
    if (d < 11) map[i] = GROUND; else if (e < 1 + (nE(x, y) - .5) * .3) map[i] = WATER; else if (e < 1.2 && map[i] === TREE) map[i] = GROUND; });
  disk(560, 174, 2.2, i => { map[i] = RFLOOR; });                                                // 湖心的冰龕
  ringAt(560, 174, 10.2, 8, a => angDist(a, -Math.PI / 2) < .45, PILLAR);

  /* ---------- 沼澤 ---------- */
  // 腐沼祭壇：一大片深水中間的島，島上一圈石柱（北邊的路會變成橋）
  // 腐沼大殿：半沉在水裡的大殿，門朝北，一座長橋（兩側立著石柱）通進去。巫妖在中殿，聖壇在最南邊
  disk(590, 442, 27, (i, d, x, y) => { if (d < 14) map[i] = GROUND; else if (d < 21 + wobble(x, y) * 1.4) map[i] = WATER; else if (d < 23 && map[i] === TREE) map[i] = GROUND; });
  wallRect(R, 578, 430, 25, 25, 0, 'n');
  for (let y = 412; y <= 426; y += 4) for (const x of [586, 594]) map[I(x, y)] = PILLAR;
  for (const x of [586, 594]) map[I(x, 452)] = PILLAR; for (let x = 588; x <= 592; x++) map[I(x, 453)] = RWALL;
  fire(588, 451); fire(592, 451);
  // 沉沒神殿（地底遺跡的入口）
  clearDisk(534, 458, 10, false);
  wallRect(R, 526, 452, 17, 12, .12, 'n');
  for (const [x, y] of [[529, 455], [539, 455], [529, 460], [539, 460]]) map[I(x, y)] = PILLAR;
  // 沉木林：很密的枯樹 + 水
  disk(455, 355, 16, (i, d, x, y) => { if (map[i] !== GROUND && map[i] !== TREE) return; const v = nE(x * 1.2, y * 1.2); map[i] = v > .6 ? WATER : v > .45 && d > 5 ? TREE : GROUND; });
  // 巫婆小屋
  // 巫婆小屋 + 後面圍起來的菇園（毒菇母后）：從小屋前門進去、後門出去才到得了菇園
  clearDisk(522, 290, 17, false);
  disk(522, 290, 17, i => { if (map[i] === WATER) map[i] = GROUND; });
  wallRect(R, 511, 276, 23, 21, 0, 's');
  for (let y = 277; y <= 295; y++) for (let x = 512; x <= 532; x++) map[I(x, y)] = GROUND;      // 菇園是泥土地（會長發光的菇）
  wallRect(R, 519, 297, 7, 6, 0, 'sn'); map[I(520, 299)] = CRATE; map[I(524, 300)] = CRATE;
  // 毒霧窪地
  disk(610, 260, 12, (i, d, x, y) => { if (map[i] === GROUND && nE(x * 2.6 + 9, y * 2.6) > .55) map[i] = WATER; });

  void MH; void MW; void STAIRS;
}
