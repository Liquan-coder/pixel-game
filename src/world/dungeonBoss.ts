/* ================= 地城的 Boss =================
   每座地城最深處的大廳都有一隻真正的 Boss：自己的圖（art/dungeonBosses.ts，一隻一個 hdXxx，之後換成參考圖很方便）、
   一套招式（world/bossAI3.ts 的通用招式庫：衝撞、砸地、跳壓、橫掃、扇射、環射、落雷、毒池、召喚、鞭打）、
   血量剩一半進二階段（招式變多、預警變短）。
   跟區域 Boss 用同一套系統（world/regionBoss.ts 的 RBDEF）：結界、血條、開場名字、死掉不復活……
   genWorld 蓋完地城以後呼叫 registerDungeonBosses()，把 Boss 放到大廳中央。

   moves：[招式, 權重, 參數]；p2：二階段多出來的招式。參數裡的 k = 傷害倍率（基準 = 10 + 3 × 等級） */
import { RBDEF } from './regionBoss';
import { DUNGEONS } from './dungeons';
import { TS } from './map';
import { makeUniqueGear } from '../data/items';
import { THEME } from './bossThemes';

export type Move = [string, number, Record<string, any>?];
export interface DBossDef { name: string; sub: string; lv: number; hp: number; spd: number; ring: string[]; aura: string[]; cols: string[]; proj: string; moves: Move[]; p2: Move[] }
const W = ['#2a4a78', '#7ab8e8', '#ffffff'], F = ['#7a1a08', '#f07a32', '#ffe38a'], P = ['#1d5a32', '#4fbf5a', '#c8ffc0'], V = ['#3a1a6a', '#9a6ae8', '#e8d8ff'];
const SAND = ['#6a4a2a', '#d8b878', '#fff0c8'], GOLD = ['#7a4a1a', '#f2c14e', '#fff6d0'], ICE = ['#2a4a78', '#a8dcff', '#ffffff'], BONE = ['#5e584c', '#e2dcc8', '#fffaf0'];
export const DBOSS: Record<string, DBossDef> = {
  snail: { name: '苔蝸王・綠殼', sub: '洞窟的石頭動了一下', lv: 6, hp: 750, spd: 22, ring: ['#7fe07a', '#ffffff'], aura: ['#5aa04a', '#c8ffc0', '#ffffff'], cols: P, proj: 'glob',
    moves: [['charge', 3, { L: 150, W: 26, spd: 230, k: 1.1, trail: P }], ['slam', 2, { r: 46, k: 1.2 }], ['pools', 2, { n: 3, r: 24, t: 4, k: .35 }]],
    p2: [['nova', 2, { n: 10, spd: 120, k: .8 }], ['summon', 1, { n: 2, max: 3 }]] },
  warden: { name: '無名守墓人', sub: '燈火後面站著一個高大的影子', lv: 7, hp: 900, spd: 40, ring: ['#ffd27a', '#ffffff'], aura: ['#c0862c', '#ffe38a', '#ffffff'], cols: GOLD, proj: 'ember',
    moves: [['sweep', 3, { r: 58, half: 1.1, k: 1.3 }], ['charge', 2, { L: 120, W: 22, spd: 320, k: 1.2 }], ['fan', 2, { n: 3, spread: .5, spd: 130, k: .9 }]],
    p2: [['rain', 2, { n: 6, r: 22, k: 1, cols: GOLD }], ['summon', 1, { n: 2, max: 3 }]] },
  tidecrab: { name: '潮音巨蟹・鳴螯', sub: '浪聲停了，石窟深處亮起兩隻眼睛', lv: 7, hp: 1000, spd: 30, ring: ['#7ab8e8', '#ffffff'], aura: ['#3a7ac0', '#a8dcff', '#ffffff'], cols: W, proj: 'claw',
    moves: [['slam', 3, { r: 50, k: 1.3 }], ['charge', 2, { L: 150, W: 30, spd: 260, k: 1.1 }], ['fan', 2, { n: 5, spread: .9, spd: 140, k: .8 }]],
    p2: [['nova', 2, { n: 12, spd: 130, k: .8 }], ['leap', 1, { r: 46, k: 1.4 }]] },
  broodmother: { name: '巢母・八目', sub: '網子在震動。牠早就看見你了', lv: 10, hp: 1500, spd: 46, ring: ['#c46ad8', '#ffffff'], aura: ['#7a40a8', '#e0a8ff', '#ffffff'], cols: V, proj: 'glob',
    moves: [['leap', 3, { r: 44, k: 1.3 }], ['pools', 2, { n: 3, r: 26, t: 4, k: .35, cols: ['#d8d8e8', '#ffffff', '#c8c8d8'] }], ['fan', 2, { n: 5, spread: .8, spd: 150, k: .8 }]],
    p2: [['summon', 2, { n: 3, max: 4 }], ['rain', 1, { n: 6, r: 22, k: 1 }], ['nova', 1, { n: 10, spd: 140, k: .8 }]] },
  rootheart: { name: '根縛樹心', sub: '整個地穴的根，同時醒了過來', lv: 11, hp: 1800, spd: 12, ring: ['#86c464', '#ffffff'], aura: ['#367434', '#a8e080', '#ffffff'], cols: P, proj: 'claw',
    moves: [['rain', 3, { n: 5, r: 24, k: 1.1, cols: ['#3a2a14', '#86643e', '#c8a878'] }], ['sweep', 2, { r: 66, half: 1.5, k: 1.2 }], ['summon', 1, { n: 2, max: 3 }]],
    p2: [['nova', 2, { n: 12, spd: 130, k: .8 }], ['rain', 2, { n: 9, r: 24, k: 1.1, cols: ['#3a2a14', '#86643e', '#c8a878'] }]] },
  scorpion: { name: '風蝕巨蠍', sub: '沙子底下伸出了一條尾巴', lv: 14, hp: 2300, spd: 54, ring: ['#e8c890', '#ffffff'], aura: ['#c8a060', '#f0dcb0', '#ffffff'], cols: SAND, proj: 'claw',
    moves: [['charge', 3, { L: 160, W: 28, spd: 300, k: 1.2 }], ['lash', 2, { L: 110, W: 16, k: 1.5 }], ['fan', 2, { n: 5, spread: .8, spd: 160, k: .8 }]],
    p2: [['pools', 2, { n: 3, r: 28, t: 4, k: .35, cols: SAND }], ['rain', 2, { n: 6, r: 22, k: 1.1, cols: SAND }]] },
  sandking: { name: '沙王・未完', sub: '裹布底下傳來一聲很長很長的嘆息', lv: 15, hp: 2500, spd: 30, ring: ['#f2c14e', '#ffffff'], aura: ['#c0862c', '#ffe38a', '#ffffff'], cols: GOLD, proj: 'bolt',
    moves: [['fan', 3, { n: 5, spread: .9, spd: 150, k: .9 }], ['rain', 2, { n: 6, r: 22, k: 1.1, cols: SAND }], ['summon', 1, { n: 2, max: 3 }]],
    p2: [['nova', 2, { n: 12, spd: 140, k: .9 }], ['leap', 2, { r: 48, k: 1.4 }]] },
  salamander: { name: '熔岩巨蜥・燎', sub: '隧道深處的熔岩，張開了嘴', lv: 19, hp: 3300, spd: 50, ring: ['#ff8a3a', '#fff0a0'], aura: ['#ff6a2a', '#ffb040', '#fff0a0'], cols: F, proj: 'ember',
    moves: [['fan', 3, { n: 7, spread: .9, spd: 160, k: .8 }], ['charge', 2, { L: 150, W: 28, spd: 280, k: 1.2, trail: F }], ['sweep', 2, { r: 62, half: 1.2, k: 1.3 }]],
    p2: [['rain', 2, { n: 7, r: 24, k: 1.1, cols: F }], ['nova', 1, { n: 12, spd: 140, k: .8 }]] },
  magmaworm: { name: '熔渣蠕蟲', sub: '腳底下的岩石，在往上拱', lv: 20, hp: 3500, spd: 34, ring: ['#ff8a3a', '#fff0a0'], aura: ['#e8743b', '#ffd27a', '#fff4c0'], cols: F, proj: 'ember',
    moves: [['leap', 3, { r: 52, k: 1.4, air: .9 }], ['nova', 2, { n: 10, spd: 140, k: .8 }], ['pools', 2, { n: 3, r: 26, t: 4, k: .4, cols: F }]],
    p2: [['rain', 2, { n: 8, r: 24, k: 1.1, cols: F }], ['summon', 1, { n: 2, max: 3 }]] },
  icequeen: { name: '冰晶女王・霙', sub: '洞窟裡響起一首很老的歌', lv: 24, hp: 4400, spd: 44, ring: ['#a8dcff', '#ffffff'], aura: ['#7ab8e8', '#dcecff', '#ffffff'], cols: ICE, proj: 'claw',
    moves: [['fan', 3, { n: 5, spread: .8, spd: 170, k: .9 }], ['rain', 2, { n: 7, r: 22, k: 1.1, cols: ICE }], ['nova', 2, { n: 10, spd: 140, k: .8 }]],
    p2: [['summon', 1, { n: 2, max: 3 }], ['charge', 2, { L: 170, W: 24, spd: 340, k: 1.2 }]] },
  frostknight: { name: '霜墓騎士', sub: '冰封的騎士，抬起了頭', lv: 25, hp: 4800, spd: 46, ring: ['#a8dcff', '#ffffff'], aura: ['#4a6e94', '#a8dcff', '#ffffff'], cols: ICE, proj: 'claw',
    moves: [['combo', 3, { L: 120, W: 24, spd: 340, k: 1.1 }], ['sweep', 2, { r: 66, half: 1.2, k: 1.4 }], ['rain', 1, { n: 5, r: 22, k: 1.1, cols: ICE }]],
    p2: [['fan', 2, { n: 5, spread: .9, spd: 170, k: .9 }], ['summon', 1, { n: 2, max: 3 }]] },
  toadking: { name: '腐沼蛙王', sub: '整片水面鼓了起來', lv: 29, hp: 6000, spd: 30, ring: ['#9aff6a', '#ffffff'], aura: ['#3ac83a', '#9aff6a', '#eaffd0'], cols: P, proj: 'glob',
    moves: [['leap', 3, { r: 56, k: 1.4, pool: P }], ['lash', 3, { L: 150, W: 16, k: 1.4 }], ['fan', 2, { n: 5, spread: .8, spd: 150, k: .8 }]],
    p2: [['summon', 2, { n: 3, max: 4 }], ['rain', 1, { n: 7, r: 22, k: 1.1, cols: P }]] },
  drowned: { name: '深淵水鬼', sub: '鎖鏈從水底一路響了上來', lv: 30, hp: 6400, spd: 40, ring: ['#4ad0c0', '#ffffff'], aura: ['#1a6a6a', '#7ff0e0', '#ffffff'], cols: ['#0e2828', '#4fd0c0', '#d8fff8'], proj: 'bolt',
    moves: [['fan', 3, { n: 5, spread: .9, spd: 160, k: .9 }], ['pools', 2, { n: 3, r: 28, t: 4, k: .4, cols: ['#0e2828', '#22544e', '#8cc8b0'] }], ['lash', 2, { L: 160, W: 16, k: 1.4 }]],
    p2: [['nova', 2, { n: 14, spd: 140, k: .8 }], ['summon', 1, { n: 2, max: 3 }]] },
  captain: { name: '近衛隊長・殘燈', sub: '「誰？報上名來。」', lv: 17, hp: 3600, spd: 56, ring: ['#f2c14e', '#ffffff'], aura: ['#c0862c', '#ffe38a', '#ffffff'], cols: GOLD, proj: 'claw',
    moves: [['combo', 3, { L: 120, W: 24, spd: 360, k: 1.1 }], ['sweep', 2, { r: 60, half: 1.2, k: 1.3 }], ['fan', 2, { n: 3, spread: .5, spd: 180, k: 1 }]],
    p2: [['summon', 1, { n: 3, max: 4 }], ['rain', 2, { n: 7, r: 22, k: 1.1, cols: BONE }]] },
  forgeguard: { name: '熔爐守護者', sub: '熔爐重新點火了', lv: 22, hp: 5200, spd: 26, ring: ['#ff8a3a', '#fff0a0'], aura: ['#ff6a2a', '#ffb040', '#fff0a0'], cols: F, proj: 'ember',
    moves: [['slam', 3, { r: 64, k: 1.5 }], ['lash', 2, { L: 170, W: 22, k: 1.3, trail: F }], ['rain', 2, { n: 8, r: 24, k: 1.1, cols: F }]],
    p2: [['nova', 2, { n: 14, spd: 140, k: .8 }], ['summon', 1, { n: 2, max: 3 }]] },
  starwarden: { name: '星之看守者', sub: '「你終於回來了。……不，你不是她。」', lv: 32, hp: 8800, spd: 48, ring: ['#c8a8ff', '#ffffff'], aura: ['#6a4ad0', '#b49cff', '#ffffff'], cols: V, proj: 'bolt',
    moves: [['fan', 3, { n: 7, spread: 1, spd: 170, k: .9 }], ['rain', 2, { n: 9, r: 24, k: 1.1, cols: V }], ['nova', 2, { n: 16, spd: 140, k: .8 }], ['lash', 1, { L: 180, W: 18, k: 1.4 }]],
    p2: [['summon', 1, { n: 3, max: 4 }], ['charge', 2, { L: 170, W: 24, spd: 380, k: 1.2 }]] },
};

/* 把每座地城的 Boss 放進 RBDEF（id = 'dg_' + 地城編號）。打倒 → flags 'dgn:編號'（金箱解封、不再出現）+ 招牌裝備 */
export function registerDungeonBosses() {
  for (const d of DUNGEONS) { const B = DBOSS[d.boss]; if (!B || !d.bossAt) continue;
    const [tx, ty, tr] = d.bossAt;
    RBDEF['dg_' + d.id] = { id: 'dg_' + d.id, name: B.name, short: B.name.split('・')[0], sub: B.sub, tx, ty, tr, lv: B.lv, hp: B.hp, kind: 'db_' + d.boss, ai: 'dgn', boss: B, theme: THEME[d.boss], dg: d.id,
      adds: d.kinds, ring: B.ring, aura: B.aura, souls: B.lv * 45, gold: B.lv * 18, star: B.lv >= 20,
      x: tx * TS + 8, y: ty * TS + 8, R: tr * TS, reward: () => makeUniqueGear(d.sig) };
  }
}
