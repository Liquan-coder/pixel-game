/* ================= 地城的 Boss =================
   每座地城最深處的大廳都有一隻真正的 Boss：自己的圖（art/dungeonBosses.ts，一隻一個 hdXxx，之後換成參考圖很方便）、
   一套招式（world/bossAI3.ts 的通用招式庫：衝撞、砸地、跳壓、橫掃、扇射、環射、落雷、毒池、召喚、鞭打）、
   血量剩一半進二階段（招式變多、預警變短）。
   跟區域 Boss 用同一套系統（world/regionBoss.ts 的 RBDEF）：結界、血條、開場名字、死掉不復活……
   genWorld 蓋完地城以後呼叫 registerDungeonBosses()，把 Boss 放到大廳中央。

   moves：[招式, 權重, 參數]；p2：二階段多出來的招式。參數裡的 k = 傷害倍率（基準 = 10 + 3 × 等級） */
import { tier } from '../data/levels';
import { RBDEF } from './regionBoss';
import { DUNGEONS } from './dungeons';
import { TS } from './map';
import { makeUnique, makeUniqueGear } from '../data/items';
import { THEME } from './bossThemes';

export type Move = [string, number, Record<string, any>?];
export interface DBossDef { name: string; sub: string; lv: number; hp: number; spd: number; ring: string[]; aura: string[]; cols: string[]; proj: string; moves: Move[]; p2: Move[] }
const W = ['#2a4a78', '#7ab8e8', '#ffffff'], F = ['#7a1a08', '#f07a32', '#ffe38a'], P = ['#1d5a32', '#4fbf5a', '#c8ffc0'], V = ['#3a1a6a', '#9a6ae8', '#e8d8ff'];
const SAND = ['#6a4a2a', '#d8b878', '#fff0c8'], GOLD = ['#7a4a1a', '#f2c14e', '#fff6d0'], ICE = ['#2a4a78', '#a8dcff', '#ffffff'], BONE = ['#5e584c', '#e2dcc8', '#fffaf0'];
export const DBOSS: Record<string, DBossDef> = {
  snail: { name: '苔蝸王・綠殼', sub: '洞窟的石頭動了一下', lv: 15, hp: 750, spd: 22, ring: ['#7fe07a', '#ffffff'], aura: ['#5aa04a', '#c8ffc0', '#ffffff'], cols: P, proj: 'glob',
    moves: [['charge', 3, { L: 150, W: 26, spd: 230, k: 1.1, trail: P }], ['slam', 2, { r: 46, k: 1.2 }], ['pools', 2, { n: 3, r: 24, t: 4, k: .35 }]],
    p2: [['nova', 2, { n: 10, spd: 120, k: .8 }], ['summon', 1, { n: 2, max: 3 }]] },
  warden: { name: '無名守墓人', sub: '燈火後面站著一個高大的影子', lv: 18, hp: 900, spd: 40, ring: ['#ffd27a', '#ffffff'], aura: ['#c0862c', '#ffe38a', '#ffffff'], cols: GOLD, proj: 'ember',
    moves: [['sweep', 3, { r: 58, half: 1.1, k: 1.3 }], ['mirage', 2, { n: 1, m: 'charge', mo: { L: 120, W: 22, spd: 300, k: 1.1, minD: 50 } }], ['fan', 2, { n: 3, spread: .5, spd: 130, k: .9 }]],   // 燈照出影子分身，跟他一起滑過來
    p2: [['rain', 2, { n: 6, r: 22, k: 1, cols: GOLD }], ['summon', 1, { n: 2, max: 3 }]] },
  tidecrab: { name: '潮音巨蟹・鳴螯', sub: '浪聲停了，石窟深處亮起兩隻眼睛', lv: 18, hp: 1000, spd: 30, ring: ['#7ab8e8', '#ffffff'], aura: ['#3a7ac0', '#a8dcff', '#ffffff'], cols: W, proj: 'claw',
    moves: [['slam', 3, { r: 50, k: 1.3 }], ['charge', 2, { L: 150, W: 30, spd: 260, k: 1.1 }], ['fan', 2, { n: 5, spread: .9, spd: 140, k: .8 }]],
    p2: [['nova', 2, { n: 12, spd: 130, k: .8 }], ['erupt', 1, { r: 46, k: 1.4 }]] },   // 巨蟹：鑽進沙裡再冒出來
  broodmother: { name: '巢母・八目', sub: '網子在震動。牠早就看見你了', lv: 25, hp: 1500, spd: 46, ring: ['#c46ad8', '#ffffff'], aura: ['#7a40a8', '#e0a8ff', '#ffffff'], cols: V, proj: 'glob',
    moves: [['leap', 3, { r: 44, k: 1.3 }], ['pools', 2, { n: 3, r: 26, t: 4, k: .35, cols: ['#d8d8e8', '#ffffff', '#c8c8d8'] }], ['fan', 2, { n: 5, spread: .8, spd: 150, k: .8 }]],
    p2: [['summon', 2, { n: 3, max: 4 }], ['rain', 1, { n: 6, r: 22, k: 1 }], ['nova', 1, { n: 10, spd: 140, k: .8 }]] },
  rootheart: { name: '根縛樹心', sub: '整個地穴的根，同時醒了過來', lv: 28, hp: 1800, spd: 12, ring: ['#86c464', '#ffffff'], aura: ['#367434', '#a8e080', '#ffffff'], cols: P, proj: 'claw',
    moves: [['rain', 3, { n: 5, r: 24, k: 1.1, cols: ['#3a2a14', '#86643e', '#c8a878'] }], ['sweep', 2, { r: 66, half: 1.5, k: 1.2 }], ['summon', 1, { n: 2, max: 3 }]],
    p2: [['nova', 2, { n: 12, spd: 130, k: .8 }], ['rain', 2, { n: 9, r: 24, k: 1.1, cols: ['#3a2a14', '#86643e', '#c8a878'] }]] },
  scorpion: { name: '風蝕巨蠍', sub: '沙子底下伸出了一條尾巴', lv: 35, hp: 2300, spd: 54, ring: ['#e8c890', '#ffffff'], aura: ['#c8a060', '#f0dcb0', '#ffffff'], cols: SAND, proj: 'claw',
    moves: [['charge', 3, { L: 160, W: 28, spd: 300, k: 1.2 }], ['lash', 2, { L: 110, W: 16, k: 1.5 }], ['fan', 2, { n: 5, spread: .8, spd: 160, k: .8 }], ['erupt', 2, { r: 44, k: 1.3 }]],
    p2: [['pools', 2, { n: 3, r: 28, t: 4, k: .35, cols: SAND }], ['rain', 2, { n: 6, r: 22, k: 1.1, cols: SAND }]] },
  sandking: { name: '沙王・未完', sub: '裹布底下傳來一聲很長很長的嘆息', lv: 38, hp: 2500, spd: 30, ring: ['#f2c14e', '#ffffff'], aura: ['#c0862c', '#ffe38a', '#ffffff'], cols: GOLD, proj: 'bolt',
    moves: [['fan', 3, { n: 5, spread: .9, spd: 150, k: .9 }], ['rain', 2, { n: 6, r: 22, k: 1.1, cols: SAND }], ['summon', 1, { n: 2, max: 3 }]],
    p2: [['nova', 2, { n: 12, spd: 140, k: .9 }], ['spiral', 2, { arms: 3, dur: 2, spd: 110, k: .7 }]] },   // 沙王：裹布轉起來噴金沙（以前是跳壓）
  salamander: { name: '熔岩巨蜥・燎', sub: '隧道深處的熔岩，張開了嘴', lv: 48, hp: 3300, spd: 50, ring: ['#ff8a3a', '#fff0a0'], aura: ['#ff6a2a', '#ffb040', '#fff0a0'], cols: F, proj: 'ember',
    moves: [['fan', 3, { n: 7, spread: .9, spd: 160, k: .8 }], ['charge', 2, { L: 150, W: 28, spd: 280, k: 1.2, trail: F }], ['sweep', 2, { r: 62, half: 1.2, k: 1.3 }]],
    p2: [['rain', 2, { n: 7, r: 24, k: 1.1, cols: F }], ['nova', 1, { n: 12, spd: 140, k: .8 }], ['erupt', 2, { r: 48, k: 1.3 }]] },   // 巨蜥：潛進熔岩
  magmaworm: { name: '熔渣蠕蟲', sub: '腳底下的岩石，在往上拱', lv: 50, hp: 3500, spd: 34, ring: ['#ff8a3a', '#fff0a0'], aura: ['#e8743b', '#ffd27a', '#fff4c0'], cols: F, proj: 'ember',
    moves: [['erupt', 3, { r: 52, k: 1.4 }], ['nova', 2, { n: 10, spd: 140, k: .8 }], ['pools', 2, { n: 3, r: 26, t: 4, k: .4, cols: F }]],   // 蠕蟲：鑽地突襲（不會跳）
    p2: [['rain', 2, { n: 8, r: 24, k: 1.1, cols: F }], ['summon', 1, { n: 2, max: 3 }]] },
  icequeen: { name: '冰晶女王・霙', sub: '洞窟裡響起一首很老的歌', lv: 60, hp: 4400, spd: 44, ring: ['#a8dcff', '#ffffff'], aura: ['#7ab8e8', '#dcecff', '#ffffff'], cols: ICE, proj: 'claw',
    moves: [['fan', 3, { n: 5, spread: .8, spd: 170, k: .9 }], ['rain', 2, { n: 7, r: 22, k: 1.1, cols: ICE }], ['nova', 2, { n: 10, spd: 140, k: .8 }], ['orbit', 2, { n: 4, r: 30, dur: 7, spd: 2.4, k: .8 }]],   // 冰晶繞身
    p2: [['summon', 1, { n: 2, max: 3 }], ['meteor', 2, { n: 5, gap: .32, r: 20, k: 1, fall: .7 }]] },   // 冰錐一根接一根追著你落（以前是衝撞：施法者不會衝）
  // 霜墓騎士：全身重甲 + 長戟 → 招式都從「戟」和「重」來：刺（短直線）、橫掃、戟插地（冰劍落下 / 外圈冰爆）、距離遠才放平長戟衝一次（不會連衝三次）。
  // 二階段：刺、刺、橫掃的連段，橫掃順勢甩出寒氣；舉戟叫醒墓裡的屍鬼。動作在 render/bossAnim.ts
  frostknight: { name: '霜墓騎士', sub: '冰封的騎士，抬起了頭', lv: 62, hp: 4800, spd: 46, ring: ['#a8dcff', '#ffffff'], aura: ['#4a6e94', '#a8dcff', '#ffffff'], cols: ICE, proj: 'claw',
    moves: [['thrust', 3, { L: 78, W: 14, k: 1.3, step: 14 }], ['sweep', 3, { r: 62, half: 1.15, k: 1.4, wave: 3 }], ['charge', 1, { L: 140, W: 24, spd: 250, k: 1.3, wind: 1.4, minD: 90 }], ['rain', 1, { n: 5, r: 22, k: 1.1, cols: ICE }]],
    p2: [['chain', 3, { seq: [['thrust', { L: 78, W: 14, k: 1.2, step: 12 }], ['thrust', { L: 84, W: 14, k: 1.2, step: 14 }], ['sweep', { r: 64, half: 1.25, k: 1.4, wave: 3 }]] }], ['summon', 1, { n: 2, max: 3 }]] },
  toadking: { name: '腐沼蛙王', sub: '整片水面鼓了起來', lv: 72, hp: 6000, spd: 30, ring: ['#9aff6a', '#ffffff'], aura: ['#3ac83a', '#9aff6a', '#eaffd0'], cols: P, proj: 'glob',
    moves: [['leap', 3, { r: 56, k: 1.4, pool: P }], ['lash', 3, { L: 150, W: 16, k: 1.4 }], ['fan', 2, { n: 5, spread: .8, spd: 150, k: .8 }], ['grab', 2, { L: 70, W: 16, k: 2, hits: 3, hold: 1.1, miss: 1.6, reach: 26 }]],   // 舌頭捲住你，沒捲到就大硬直
    p2: [['summon', 2, { n: 3, max: 4 }], ['rain', 1, { n: 7, r: 22, k: 1.1, cols: P }]] },
  drowned: { name: '深淵水鬼', sub: '鎖鏈從水底一路響了上來', lv: 75, hp: 6400, spd: 40, ring: ['#4ad0c0', '#ffffff'], aura: ['#1a6a6a', '#7ff0e0', '#ffffff'], cols: ['#0e2828', '#4fd0c0', '#d8fff8'], proj: 'bolt',
    moves: [['fan', 3, { n: 5, spread: .9, spd: 160, k: .9 }], ['pools', 2, { n: 3, r: 28, t: 4, k: .4, cols: ['#0e2828', '#22544e', '#8cc8b0'] }], ['lash', 2, { L: 160, W: 16, k: 1.4 }],
      ['boomerang', 2, { L: 150, spd: 230, pause: .4, k: 1.1 }]],   // 貝殼杖甩出水刃，像退潮一樣捲回來
    p2: [['nova', 2, { n: 14, spd: 140, k: .8 }], ['summon', 1, { n: 2, max: 3 }]] },
  // 近衛隊長・殘燈：骷髏劍士，右手長劍、左手提燈。劍：大步突刺、下劈、二階段「劈、撩、刺」連段；只踏步突進一次（不會連衝三次）。
  // 燈：甩燈噴出火星（扇射）、甩出燈油在地上燒（毒池）、二階段舉燈讓燈火往外炸一圈（甜甜圈）。舉劍叫醒近衛。動作在 render/bossAnim.ts
  captain: { name: '近衛隊長・殘燈', sub: '「誰？報上名來。」', lv: 42, hp: 3600, spd: 56, ring: ['#f2c14e', '#ffffff'], aura: ['#c0862c', '#ffe38a', '#ffffff'], cols: GOLD, proj: 'claw',
    moves: [['thrust', 3, { L: 86, W: 14, k: 1.2, step: 22 }], ['sweep', 3, { r: 60, half: 1.2, k: 1.3 }], ['fan', 2, { n: 3, spread: .5, spd: 180, k: 1 }], ['charge', 1, { L: 140, W: 22, spd: 330, k: 1.2, wind: 1.3, minD: 90 }]],
    p2: [['chain', 3, { seq: [['sweep', { r: 60, half: 1.2, k: 1.2 }], ['sweep', { r: 60, half: 1.2, k: 1.2, rev: true }], ['thrust', { L: 92, W: 14, k: 1.3, step: 24 }]] }],
      ['pools', 2, { n: 3, r: 24, t: 4, k: .4, cols: ['#5a1408', '#f07a32', '#ffd04a'] }], ['summon', 1, { n: 3, max: 4 }],
      ['counter', 2, { dur: 1.4, then: ['sweep', { r: 62, half: 1.3, k: 1.5 }] }]] },   // 架劍：亂砍會被一劍劈回來
  forgeguard: { name: '熔爐守護者', sub: '熔爐重新點火了', lv: 55, hp: 5200, spd: 26, ring: ['#ff8a3a', '#fff0a0'], aura: ['#ff6a2a', '#ffb040', '#fff0a0'], cols: F, proj: 'ember',
    moves: [['slam', 3, { r: 64, k: 1.5 }], ['lash', 2, { L: 170, W: 22, k: 1.3, trail: F }], ['rain', 2, { n: 8, r: 24, k: 1.1, cols: F }], ['wave', 3, { r: 150, spd: 115, W: 10, k: 1.3 }]],   // 錘子砸地，震波往外擴（要抓時機閃過去）
    p2: [['nova', 2, { n: 14, spd: 140, k: .8 }], ['summon', 1, { n: 2, max: 3 }]] },
  starwarden: { name: '星之看守者', sub: '「你終於回來了。……不，你不是她。」', lv: 80, hp: 8800, spd: 48, ring: ['#c8a8ff', '#ffffff'], aura: ['#6a4ad0', '#b49cff', '#ffffff'], cols: V, proj: 'bolt',
    moves: [['fan', 3, { n: 7, spread: 1, spd: 170, k: .9 }], ['rain', 2, { n: 9, r: 24, k: 1.1, cols: V }], ['nova', 2, { n: 16, spd: 140, k: .8 }], ['lash', 1, { L: 180, W: 18, k: 1.4 }],
      ['beam', 2, { L: 180, W: 10, arc: 2.4, dur: 1.3, k: 1 }], ['orb', 2, { n: 1, spd: 55, k: 1.2, mult: 3, stun: 2.2 }]],   // 法杖掃射；星球打得回去
    p2: [['summon', 1, { n: 3, max: 4 }], ['blink', 2, { d: 30, then: ['slam', { r: 50, k: 1.3 }] }], ['grid', 2, { W: 12, gap: 56, n: 1, k: 1.1 }]] },   // 瞬移到你背後砸下去、星光網格（以前是衝撞）
  // 螢月禁林（精靈王國的地城）：月蛾女王。鱗粉一圈一圈地灑、翅膀搧出強風、天上掉下發光的孢子；二階段叫出月蛾
  mothqueen: { name: '月蛾女王・露娜', sub: '整片螢火同時熄滅了', lv: 50, hp: 3800, spd: 40, ring: ['#c8b0ff', '#ffffff'], aura: ['#7a64a8', '#e8dcb0', '#ffffff'], cols: ['#4a3a6a', '#c8b0ff', '#fff6e0'], proj: 'glob',
    moves: [['nova', 3, { n: 12, spd: 120, k: .8 }], ['sweep', 2, { r: 62, half: 1.2, k: 1.2 }], ['rain', 2, { n: 7, r: 22, k: 1 }], ['fan', 2, { n: 5, spread: .8, spd: 150, k: .85 }],
      ['orbit', 2, { n: 5, r: 26, dur: 7, spd: 3, k: .7 }]],   // 蛾群繞著她飛
    p2: [['summon', 1, { n: 2, max: 4 }], ['pools', 2, { n: 3, r: 24, t: 4, k: .35, cols: ['#4a3a6a', '#c8b0ff', '#fff6e0'] }]] },
};
/* 精靈王・艾瑟蘭：精靈王國的區域 Boss（王座中庭）。用地城 Boss 的招式庫：扇形放箭、箭雨、月光貫穿（長直線）、拔劍衝刺；
   二階段叫弓手和劍舞者、射追蹤箭、十字月光。招式定義跟地城 Boss 一樣，但不是地城（registerElfKing 放進 RBDEF） */
export const ELFKING: DBossDef = { name: '精靈王・艾瑟蘭', sub: '「星星落下的那一夜，我們選擇了閉上眼睛。」', lv: 52, hp: 4600, spd: 46, ring: ['#7affd8', '#ffffff'], aura: ['#2c5a8a', '#9ad8ff', '#ffffff'],
  cols: ['#1e3a5e', '#9ad8ff', '#ffffff'], proj: 'bolt',
  moves: [['fan', 3, { n: 5, spread: .7, spd: 210, k: .9 }], ['rain', 3, { n: 8, r: 22, k: 1.1 }], ['lash', 2, { L: 190, W: 14, k: 1.3 }], ['thrust', 2, { L: 90, W: 14, k: 1.2, step: 24 }]],   // 拔劍一刺（以前是衝撞）
  p2: [['summon', 1, { n: 2, max: 3 }], ['nova', 2, { n: 14, spd: 130, k: .8 }], ['counter', 1, { dur: 1.4, then: ['thrust', { L: 96, W: 14, k: 1.5, step: 26 }] }]] };   // 架劍：亂砍會被反刺

/* ---- 新招（world/bossAI3.ts 的 pull / donut / cross / homing）：[一階段就會用, 二階段才會用] ----
   吸引 → 要往外走；甜甜圈 → 要往內衝；十字光束 → 站斜角；追蹤彈 → 繞圈甩掉。配合每隻 Boss 的異常狀態（data/ailments.ts）就很難站著硬砍 */
const PULL = (r = 54, k = 1.3): Move => ['pull', 2, { r, k, pull: 62 }], DONUT = (r0 = 44, r = 124, k = 1.3): Move => ['donut', 2, { r0, r, k }];
const CROSS = (L = 170, k = 1.2): Move => ['cross', 2, { L, W: 18, k }], HOMING = (n = 3, k = .9): Move => ['homing', 2, { n, spd: 90, turn: 2.2, k }];
const EXTRA: Record<string, [Move[], Move[]]> = {
  snail: [[], [DONUT(40, 110)]],            warden: [[HOMING(3)], [CROSS()]],          tidecrab: [[DONUT()], [PULL()]],
  broodmother: [[HOMING(4, .8)], [PULL(50)]], rootheart: [[PULL(58)], [HOMING(4)]],     scorpion: [[], [DONUT(42, 118)]],
  sandking: [[PULL(56)], [CROSS(), HOMING(4)]], salamander: [[], [DONUT()]],          magmaworm: [[PULL(56)], [DONUT()]],
  icequeen: [[HOMING(3)], [DONUT(), CROSS()]], frostknight: [[DONUT(46, 120)], []], toadking: [[PULL(56, 1.4)], [HOMING(4)]],
  drowned: [[PULL(58)], [HOMING(4), DONUT()]], captain: [[], [DONUT()]],  forgeguard: [[DONUT(48, 128, 1.4)], [PULL(60)]],
  starwarden: [[HOMING(4)], [PULL(60), DONUT(46, 130)]],
  mothqueen: [[DONUT(44, 120)], [HOMING(4, .8)]],
};
for (const k in EXTRA) { DBOSS[k].moves.push(...EXTRA[k][0]); DBOSS[k].p2.push(...EXTRA[k][1]); }
ELFKING.moves.push(HOMING(3)); ELFKING.p2.push(CROSS(190, 1.3), PULL(58));
/* 主線 / 區域 Boss：二階段每 6~9 秒插一招新招（world/regionBoss.ts）。牠們原本的招式不變 */
export const REXTRA: Record<string, Move[]> = {
  queen: [DONUT(40, 120), HOMING(3)], general: [CROSS(170, 1.3), PULL(56)], dragon: [DONUT(48, 140, 1.4), PULL(60)], mushking: [PULL(56), HOMING(4)],
  yeti: [DONUT(48, 140, 1.4), PULL(60)], lich: [CROSS(190, 1.3), HOMING(4), PULL(60)], mossguard: [PULL(52)], mistwitch: [HOMING(3), CROSS(170)],
  sandgiant: [PULL(58), DONUT(46, 130)], slagmother: [DONUT(46, 124), HOMING(3)], frostwyrm: [CROSS(190, 1.3), DONUT(48, 140)], toxqueen: [PULL(58), HOMING(4)],
};

/* 把每座地城的 Boss 放進 RBDEF（id = 'dg_' + 地城編號）。打倒 → flags 'dgn:編號'（金箱解封、不再出現）+ 獨特武器（沒有的地城 = 招牌裝備） */
export function registerDungeonBosses() {
  for (const d of DUNGEONS) { const B = DBOSS[d.boss]; if (!B || !d.bossAt) continue;
    const [tx, ty, tr] = d.bossAt;
    RBDEF['dg_' + d.id] = { id: 'dg_' + d.id, name: B.name, short: B.name.split('・')[0], sub: B.sub, tx, ty, tr, lv: B.lv, hp: B.hp, kind: 'db_' + d.boss, ai: 'dgn', boss: B, theme: THEME[d.boss], dg: d.id,
      adds: d.kinds, ring: B.ring, aura: B.aura, souls: Math.round(tier(B.lv) * 45), gold: Math.round(tier(B.lv) * 18), star: B.lv >= 50,
      x: tx * TS + 8, y: ty * TS + 8, R: tr * TS, reward: () => d.uq ? makeUnique(d.uq) : makeUniqueGear(d.sig) };   // 有獨特武器的地城：Boss 直接掉武器（金箱裡是招牌裝備）
  }  registerElfKing();
}
/* 精靈王：王座中庭的中間（world/elfland.ts 的精靈王城）。打倒 → 精靈弓（rbDead 'elfking'） */
export const ELFKING_AT = { tx: 366, ty: 437, tr: 9.5 };
function registerElfKing() { const B = ELFKING, { tx, ty, tr } = ELFKING_AT;
  RBDEF.elfking = { id: 'elfking', name: B.name, short: '精靈王', sub: B.sub, tx, ty, tr, lv: B.lv, hp: B.hp, kind: 'elfking', ai: 'dgn', boss: B, theme: THEME.elfking, region: true,
    adds: ['elfArcher', 'elfBlade'], ring: B.ring, aura: B.aura, souls: Math.round(tier(B.lv) * 50), gold: Math.round(tier(B.lv) * 20), star: true,
    x: tx * TS + 8, y: ty * TS + 8, R: tr * TS, reward: () => makeUnique('elfbow') };
}
