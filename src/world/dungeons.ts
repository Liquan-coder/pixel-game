/* ================= 地城（洞窟 / 古墓 / 石窟）+ 地底遺跡（大型、很多房間） =================
   做法：地城的「裡面」也蓋在同一張地圖上，放在野外的下面（y ≥ WH 那一條，DZONE，走路到不了）。
   野外的入口（山壁上的洞口 / 石門；地底遺跡是建築物裡往下的石階）按攻擊鍵 → 傳送到裡面；裡面入口的傳送門（打倒 Boss 後大廳也會出現一個）→ 回到入口前面。
   這樣碰撞、怪物、燈光、寶箱、存檔都不用另外寫一套。

   每座地城的格局都是自己亂數排的（world/dungeonLayout.ts）：入口 → 彎彎曲曲的主路 → Boss 大廳，路上有三個營火、
   三個解謎區（陷阱房、寶庫的謎題房、Boss 大廳前的謎題房，機關在 world/puzzles.ts）、幾條放寶箱的死路。
   - 小怪：每座地城有自己專屬的小怪（data/items.ts 的 KIND，art/dungeonMonsters.ts），野外不會出現
   - Boss：真正的 Boss（自己的圖、會換招、有預警、二階段），走進大廳的結界就開打。定義在 world/dungeonBoss.ts
     打倒後記在 quest 的 flags（'dgn:編號'）→ 不會再出現、金箱解開封印；Boss 一定掉一件「招牌裝備」（sig，data/uniques.ts 的 UG）
   地底遺跡（style: 'ruin'）：格子比較多（6×6），岔路比較多，最深處的金箱是獨特武器。
   新增地城：在 DUNGEONS 加一筆、PUZ 加一筆，區塊會自動排好。 */
import { G } from '../core/state';
import { mulberry32 } from '../core/util';
import { BIGT, BRIDGE, CAMPS, CLIFF, CRATE, GRAVE, GROUND, LAVA, MH, MW, PILLAR, PROPS, RFLOOR, ROAD, ROCK, RWALL, STAIRS, TREE, TS, WALKABLE, WATER, WH, map, reg, spawns } from './map';
import { POIS } from '../data/poi';
import { carveLayout, slotSize, type Layout, type LRoom } from './dungeonLayout';
import type { Player } from '../types';

export const DREG = 7;                                                   // 地城的地區編號（REGIONS[7]）
export const DZONE = { x0: 0, y0: WH, x1: MW - 1, y1: MH - 1 };           // 地城區：地圖最下面那一條（大地圖不畫）
/* v12 以前地城蓋在東南邊的海上（這一塊）。現在空著，但一樣填滿岩石：野外生成（gen 的 busy、terrain 的 nearSub）照舊避開這裡 → 野外跟以前一模一樣 */
export const OLDZ = { x0: 266, y0: 500, x1: 636, y1: 674 };
export interface Dungeon {
  id: string; name: string; style: 'cave' | 'crypt' | 'grotto' | 'ruin';
  ent: [number, number];                                                  // 野外入口：山壁正面那一格（玩家站在它下面一格）；地底遺跡 = 地上的石階那一格
  stairs?: boolean;                                                       // 入口是建築物裡的石階（地底遺跡）
  liquid?: 'lava' | 'water';                                              // 石窟的暗河換成熔岩；地底遺跡有了這個才會有一條河（熔岩 / 水）
  mirror?: boolean;                                                       // （舊）地底遺跡左右鏡像；現在每座的格局本來就不一樣，沒有用到
  lv: number; kinds: string[];                                            // 專屬小怪
  boss: string;                                                           // world/dungeonBoss.ts 的 DBOSS 編號
  sig: string;                                                            // Boss 一定掉的招牌裝備（data/uniques.ts 的 UG）
  uq?: string;                                                            // 最深處金箱裡的獨特武器（沒有 = 一般的黃金寶箱）
  lore: { title: string; text: string };                                  // 地城裡的石碑
  desc?: string;                                                          // 地圖上點了顯示的說明
  // 算出來的：
  x0?: number; y0?: number; w?: number; h?: number; inX?: number; inY?: number; exX?: number; exY?: number;
  bossAt?: [number, number, number]; bossChest?: [number, number]; sideChests?: [number, number, number][]; tablet?: [number, number];   // sideChests：[x, y, 寶箱等級]
  portal?: [number, number];                                              // Boss 大廳的傳送門（世界座標，打倒 Boss 後才出現）
  deco?: Deco[];                                                          // 野外入口前院的裝飾（dressEntrances）
  rooms?: LRoom[]; lay?: Layout;                                          // 裡面的房間（world/puzzles.ts 用來放機關）
}
export const DUNGEONS: Dungeon[] = [
  // ---- 翠風平原 ----
  { id: 'moss', name: '苔石洞窟', style: 'cave', ent: [66, 462], lv: 8, kinds: ['spiderM', 'batC'], boss: 'snail', sig: 'mosscloak', uq: 'mossfang',
    lore: { title: '洞窟深處的刻痕', text: '「牙齒長了苔的那隻狼，是第一個聞到星星味道的。」' } },
  { id: 'barrow', name: '無名古墓', style: 'crypt', ent: [172, 576], lv: 10, kinds: ['ghoulB', 'wraithB'], boss: 'warden', sig: 'barrowlamp', uq: 'barrowblade',
    lore: { title: '古墓的墓誌銘', text: '「這裡葬著一位無名的劍士。他守的不是墓，是一盞永遠不能熄的燈。」' } },
  { id: 'grotto', name: '潮音石窟', style: 'grotto', ent: [226, 484], lv: 12, kinds: ['crabT', 'frogG'], boss: 'tidecrab', sig: 'tideshell', uq: 'tidespear',
    lore: { title: '石窟裡的貝殼', text: '「把耳朵貼上去，能聽見海浪——還有一首很久以前的搖籃曲。」' } },
  // ---- 迷霧森林 ----
  { id: 'nest', name: '蛛巢洞窟', style: 'cave', ent: [240, 395], lv: 20, kinds: ['spiderF', 'batF'], boss: 'broodmother', sig: 'silkmail', uq: 'silktwin',
    lore: { title: '蛛網上的字', text: '「巢母從來不出洞。牠在等一個會唱歌的人，來把網上的星星摘走。」' } },
  { id: 'roots', name: '樹根地穴', style: 'crypt', ent: [345, 322], lv: 22, kinds: ['ghoulR', 'wraithR'], boss: 'rootheart', sig: 'rootheart',
    lore: { title: '根上刻的名字', text: '「古樹把死去的守林人收進根裡。他們的名字，一年一年長進了木頭。」' } },
  // ---- 骸骨荒地 ----
  { id: 'windcave', name: '風蝕岩窟', style: 'cave', ent: [28, 150], lv: 30, kinds: ['beetleS', 'batS'], boss: 'scorpion', sig: 'sandeye',
    lore: { title: '岩壁上的風痕', text: '「風在這裡刻了一千年，刻出來的是一隻眼睛。它還在看著天空。」' } },
  { id: 'sandtemple', name: '沙埋神殿', style: 'crypt', ent: [168, 112], lv: 32, kinds: ['ghoulS', 'wraithS'], boss: 'sandking', sig: 'sandwrap', uq: 'sandcrescent',
    lore: { title: '神殿的祭文', text: '「沙之王向星星祈求永生。星星答應了，可是忘了告訴他，永生是很長很長的寂寞。」' } },
  // ---- 熔岩高地 ----
  { id: 'lavatube', name: '熔岩隧道', style: 'cave', ent: [232, 42], lv: 42, kinds: ['spiderL', 'impL'], boss: 'salamander', sig: 'magmacore',
    lore: { title: '燒焦的筆記', text: '「隧道會呼吸。每吐一口氣，牆上的熔岩就亮一次。我想它是在數日子。」' } },
  { id: 'obsidian', name: '黑曜石窟', style: 'grotto', liquid: 'lava', ent: [402, 100], lv: 45, kinds: ['crabL', 'beetleL'], boss: 'magmaworm', sig: 'obsidianmail',
    lore: { title: '黑曜石上的倒影', text: '「在黑曜石裡看見的不是自己，是星墜之夜的天空。」' } },
  // ---- 霜寒雪原 ----
  { id: 'icecave', name: '冰晶洞窟', style: 'cave', ent: [620, 122], lv: 55, kinds: ['spiderI', 'batI'], boss: 'icequeen', sig: 'icering',
    lore: { title: '冰裡的歌', text: '「冰晶女王只會唱一首歌，那是她小時候，一個戴尖帽的人教她的。」' } },
  { id: 'frostcrypt', name: '霜墓', style: 'crypt', ent: [470, 40], lv: 58, kinds: ['ghoulI', 'wraithI'], boss: 'frostknight', sig: 'frostplate', uq: 'darkmoon',
    lore: { title: '騎士的誓言', text: '「直到光回來為止，我不會倒下。」墓碑上的字，被冰封得像昨天才刻的。' } },
  // ---- 幽影沼澤 ----
  { id: 'rotcave', name: '腐根洞窟', style: 'cave', ent: [425, 445], lv: 68, kinds: ['frogP', 'beetleP'], boss: 'toadking', sig: 'rotleather',
    lore: { title: '黏糊糊的石碑', text: '「蛙王吞下了一小塊星星。從那天起，牠每天晚上都在叫，叫得整片沼澤都睡不著。」' } },
  { id: 'sunkgrotto', name: '沉沒石窟', style: 'grotto', ent: [622, 300], lv: 70, kinds: ['crabP', 'wraithP'], boss: 'drowned', sig: 'drownpearl',
    lore: { title: '水底的鎖鏈', text: '「沉下去的人不是被拖下去的。是他自己鎖住了自己，好讓珍珠不被水沖走。」' } },
  // ---- 地底遺跡（大型） ----
  { id: 'undercroft', name: '王城地下墓所', style: 'ruin', stairs: true, ent: [100, 104], lv: 38, kinds: ['ghoulK', 'wraithK', 'batK'], boss: 'captain', sig: 'lastcrown', uq: 'royalguard',
    desc: '古王城內城裡往下的石階。王都的近衛隊在地底守著什麼',
    lore: { title: '近衛隊的點名簿', text: '「點名：一百二十人。到：一百二十人。命令：守住地底之門，直到星星回來。」' } },
  { id: 'forgeruin', name: '熔爐地底遺跡', style: 'ruin', stairs: true, liquid: 'lava', mirror: true, ent: [380, 163], lv: 50, kinds: ['impF', 'beetleF', 'spiderB'], boss: 'forgeguard', sig: 'forgeplate', uq: 'forgehammer',
    desc: '古代熔爐裡往下的石階。地底傳來打鐵的聲音',
    lore: { title: '熔爐的設計圖', text: '「容器的要求：能裝下一顆星星，而且永遠不會碎。」設計圖的角落寫著：失敗了七次。' } },
  { id: 'temple', name: '沉沒神殿地底', style: 'ruin', stairs: true, liquid: 'water', ent: [534, 458], lv: 75, kinds: ['frogT', 'wraithT', 'ghoulT'], boss: 'starwarden', sig: 'wardenveil', uq: 'deepstaff',
    desc: '沉沒神殿裡往下的石階。看守星星的人曾經住在這裡',
    lore: { title: '看守者的日記', text: '「我把七顆星星關進了七個身體。等她回來，她會知道該怎麼做。」' } },
  // ---- 精靈王國（放在最後：前面的地城區塊位置不變）----
  { id: 'mothwood', name: '螢月禁林', style: 'cave', ent: [380, 478], lv: 50, kinds: ['mothE', 'wraithE', 'elfShade'], boss: 'mothqueen', sig: 'mothcloak', uq: 'elfblades',
    desc: '螢火林岩壁上的洞口。精靈說，裡面的月亮從來不會落下',
    lore: { title: '禁林入口的告示', text: '「王命：任何人不得進入。」底下用小刀刻了一行字：「月蛾吃掉了我們的光。王知道，但王不說。」' } },
];
/* 每座地城的三個解謎區（機關在 world/puzzles.ts、puz2.ts、puz3.ts）：
   trap  = 主路上的陷阱房，走過去就好（尖刺、崩塌石橋、潮汐、蛛網、強風、冰面、寒氣、冷卻熔岩、彈跳蘑菇、黑暗迷宮）
   vault = 岔路上的謎題房，解開 → 鐵柵門升起，後面的寶物房有金箱（火盆、符文踏板、雕像、推石、鏡子……）
   boss  = Boss 大廳前的謎題房，解開 → 通往 Boss 大廳的鐵柵門升起
   secret = 某條死路的牆後面藏著金箱（砍一下就碎）；pit = 崩塌石橋下面是水還是熔岩；seq = 符文踏板要記幾步 */
export interface PuzCfg { trap: string; vault: string; boss: string; secret?: boolean; pit?: 'water' | 'lava'; seq?: number }
export const PUZ: Record<string, PuzCfg> = {
  moss:       { trap: 'crumble', vault: 'statues', boss: 'simon', secret: true, seq: 4, pit: 'water' },
  barrow:     { trap: 'spikes', vault: 'simon', boss: 'braziers', secret: true },
  grotto:     { trap: 'tide', vault: 'mirrors', boss: 'boulders' },
  nest:       { trap: 'webs', vault: 'braziers', boss: 'webs3' },
  roots:      { trap: 'crumble', vault: 'simon', boss: 'statues', secret: true, pit: 'water' },
  windcave:   { trap: 'wind', vault: 'boulders', boss: 'simon' },
  sandtemple: { trap: 'spikes', vault: 'mirrors', boss: 'boulders' },
  lavatube:   { trap: 'crumble', vault: 'statues', boss: 'braziers', pit: 'lava' },
  obsidian:   { trap: 'cool', vault: 'simon', boss: 'boulders' },
  icecave:    { trap: 'ice', vault: 'mirrors', boss: 'simon', secret: true },
  frostcrypt: { trap: 'cold', vault: 'statues', boss: 'cold3' },
  rotcave:    { trap: 'jump', vault: 'braziers', boss: 'boulders' },
  sunkgrotto: { trap: 'maze', vault: 'statues', boss: 'mirrors', secret: true },
  undercroft: { trap: 'spikes', vault: 'braziers', boss: 'stealth', secret: true },
  forgeruin:  { trap: 'crumble', vault: 'simon', boss: 'forge', pit: 'lava' },
  temple:     { trap: 'tide', vault: 'statues', boss: 'mirrors' },
  mothwood:   { trap: 'maze', vault: 'simon', boss: 'moonflowers' },
};
const VERT_TRAPS = new Set(['cool', 'jump']);                            // 這兩種陷阱房要「從下面進來、從上面出去」
/* 區塊：照順序一排一排排在地城區裡（一排排滿就換下一排），大小看格子數（world/dungeonLayout.ts 的 slotSize） */
{ let x = 3, y = WH + 2, rowH = 0;
  for (const d of DUNGEONS) { const { w, h } = slotSize(d); if (x + w > MW - 3) { x = 3; y += rowH + 2; rowH = 0; }
    d.x0 = x; d.y0 = y; d.w = w; d.h = h; x += w + 2; rowH = Math.max(rowH, h); }
  if (y + rowH > MH - 3) throw new Error('地城區不夠大：MH 要再加大'); }
/* v12 以前的區塊位置（一格 50×54，一排 7 格）：讀舊存檔時，把站在舊地城裡的人換到新的地城裡；terrain 也照舊避開這幾個地名的範圍 */
export const LEGACY_SLOTS: { id: string; x0: number; y0: number; w: number; h: number; x: number; y: number; r: number }[] = [];
{ let col = 0, row = 0;
  for (const d of DUNGEONS) { const n = d.style === 'ruin' ? 2 : 1; if (col + n > 7) { col = 0; row++; }
    const w = 50 * n + (n === 2 ? 3 : 0), x0 = OLDZ.x0 + col * 53, y0 = OLDZ.y0 + row * 57; col += n;
    LEGACY_SLOTS.push({ id: d.id, x0, y0, w, h: 54, x: x0 + w / 2, y: y0 + 27, r: 27 }); } }
for (const d of DUNGEONS) if (d.style === 'ruin') POIS.push({ id: 'ruin_' + d.id, name: d.name, tx: d.ent[0], ty: d.ent[1], kind: 'ruin', desc: d.desc });
export const inDZone = (tx: number, ty: number) => ty >= WH || (tx >= OLDZ.x0 && tx <= OLDZ.x1 && ty >= OLDZ.y0 && ty <= OLDZ.y1);
export const dungeonAt = (x: number, y: number) => { const tx = x / TS, ty = y / TS; return ty >= WH ? DUNGEONS.find(d => ty >= d.y0 && ty < d.y0 + d.h && tx >= d.x0 && tx < d.x0 + d.w) || null : null; };
export const legacyDungeonAt = (tx: number, ty: number) => { const s = LEGACY_SLOTS.find(s => tx >= s.x0 && tx < s.x0 + s.w && ty >= s.y0 && ty < s.y0 + s.h); return s ? DUNGEONS.find(d => d.id === s.id) : null; };

/* ---- 野外入口：遠遠就看得出「那裡有個洞」 ----
   洞窟 / 石窟 / 古墓 = 一座岩丘（正面是岩壁，洞口開在正中間，上面還有一根高高的尖岩，dungeonArt 畫）
   + 洞口前清出一塊空地 + 一條小路接到最近的大路。地底遺跡 = 建築物裡的一格石階 */
export function stampEntrances(inb: (x: number, y: number) => boolean) {
  for (const d of DUNGEONS) { const [ex, ey] = d.ent;
    if (d.stairs) { for (let y = ey - 1; y <= ey + 2; y++) for (let x = ex - 1; x <= ex + 1; x++) map[y * MW + x] = RFLOOR; map[ey * MW + ex] = STAIRS; continue; }
    for (let y = ey - 8; y <= ey + 5; y++) for (let x = ex - 9; x <= ex + 9; x++) { if (!inb(x, y)) continue; const i = y * MW + x, t = map[i];
      const e = ((x - ex) / 6.6) ** 2 + ((y - ey + 2.5) / 5) ** 2, wob = (((x * 7 + y * 13) % 5) - 2) * .04;
      if (y <= ey && e < 1 + wob) { if (t !== RWALL && t !== RFLOOR && t !== ROAD) map[i] = CLIFF; }   // 岩丘
      else if (y > ey && Math.abs(x - ex) <= 3 - (y > ey + 3 ? 1 : 0)) { if (t !== RWALL && t !== RFLOOR && t !== BRIDGE) map[i] = map[i] === ROAD ? ROAD : GROUND; }   // 洞口前的空地
    }
    trail(ex, ey + 2, inb);
  }
}
/* ---- 地城的前院：讓人一眼看出「這裡是地城」 ----
   洞口前面鋪一片碎掉的石板地、地面發黑；兩尊守門的雕像（洞窟 / 石窟 = 石像鬼，古墓 = 拿劍的兜帽騎士）、
   兩根破旗、一圈發著紫光的符文石，地上散著頭骨和插在土裡的舊劍（world/dungeonArt.ts 畫）。
   在 main.ts 生成完寶箱、怪物之後才跑：只清掉前院的樹和石頭，不會讓其他東西的位置跑掉（舊存檔照樣對得上）。
   deco 的座標都是世界座標；雕像、石碑、旗桿會擋路（PROPS） */
export interface Deco { k: 'statue' | 'banner' | 'rune' | 'skull' | 'bones' | 'sword'; x: number; y: number; flip?: boolean }
export function dressEntrances(avoid: { x: number; y: number }[] = []) {   // avoid = 寶箱：不要把雕像蓋在寶箱上
  PROPS.length = 0;
  const CLEAR = new Set([TREE, ROCK, BIGT, GRAVE, CRATE]);
  for (const d of DUNGEONS) { d.deco = []; if (d.stairs) continue; const [ex, ey] = d.ent;
    for (let y = ey + 1; y <= ey + 8; y++) for (let x = ex - 7; x <= ex + 7; x++) { const i = y * MW + x;   // 前院：清掉樹和石頭（水、懸崖不動）
      if (((x - ex) / 7.5) ** 2 + ((y - ey - 1) / 7.5) ** 2 <= 1 && CLEAR.has(map[i])) map[i] = GROUND; }
    const cx = ex * TS + 8, cy = (ey + 1) * TS;                                                  // 洞口正下方
    const free = (x: number, y: number, r: number) => { const t = map[Math.floor(y / TS) * MW + Math.floor(x / TS)];
      return WALKABLE(t) && t !== ROAD && t !== BRIDGE && !PROPS.some(p => Math.hypot(p.x - x, p.y - y) < p.r + r + 6) && !avoid.some(c => Math.hypot(c.x - x, c.y - y) < r + 16); };
    const put = (k: Deco['k'], x: number, y: number, r = 0, flip = false) => { if (r && !free(x, y, r)) return; d.deco.push({ k, x, y, flip }); if (r) PROPS.push({ x, y, r }); };
    for (const s of [-1, 1]) { put('statue', cx + s * 52, cy + 40, 7, s > 0); put('banner', cx + s * 88, cy + 14, 2.5, s > 0); }
    for (let k = 0; k < 6; k++) { const a = Math.PI * (.12 + .76 * k / 5); put('rune', cx + Math.cos(a) * 118, cy + 30 + Math.sin(a) * 72, 5); }   // 前院外圍半圈符文石
    for (const [k, ox, oy] of [['skull', -30, 30], ['sword', 34, 66], ['bones', -42, 84], ['skull', 24, 22], ['sword', -16, 98], ['bones', 46, 40], ['skull', 62, 92]] as [Deco['k'], number, number][]) {
      const x = cx + ox, y = cy + oy, t = map[Math.floor(y / TS) * MW + Math.floor(x / TS)]; if (WALKABLE(t) && t !== ROAD) d.deco.push({ k, x, y, flip: ox < 0 }); }
  }
}
/* 從洞口前面拉一條 2 格寬的小路，接到最近的大路（找 60 格內最近的路）；過水 = 木橋，遇到牆就停 */
function trail(sx: number, sy: number, inb: (x: number, y: number) => boolean) {
  let best: number[] | null = null, bd = 70 * 70;                        // 洞口朝南：往北的路要繞過岩丘，所以北邊的路算遠一點
  for (let y = sy - 60; y <= sy + 70; y++) for (let x = sx - 70; x <= sx + 70; x++) { if (!inb(x, y) || map[y * MW + x] !== ROAD) continue;
    const d = (x - sx) ** 2 + ((y - sy) * (y < sy ? 2.2 : 1)) ** 2 + (y < sy - 1 && Math.abs(x - sx) < 10 ? 1e6 : 0); if (d < bd) { bd = d; best = [x, y]; } }
  if (!best) return;
  const [tx, ty] = best, L = Math.hypot(tx - sx, ty - sy);
  for (let k = 0; k <= L; k += .5) { const t = k / L, w = Math.sin(k * .3) * 1.2 * Math.min(1, k / 5, (L - k) / 5);
    const x = Math.round(sx + (tx - sx) * t + w * (ty - sy) / L), y = Math.round(sy + (ty - sy) * t - w * (tx - sx) / L);
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const X = x + ox, Y = y + oy; if (!inb(X, Y)) continue; const i = Y * MW + X, c = map[i];
      if (c === RWALL || c === PILLAR || c === STAIRS || c === RFLOOR) continue;
      map[i] = c === WATER || c === LAVA || c === BRIDGE ? BRIDGE : ROAD; } }
}
export type Room = { x: number; y: number; rx: number; ry: number };
/* ---- 地城裡面：照 world/dungeonLayout.ts 排好的格局挖房間，再放怪、營火、寶箱、石碑 ---- */
const CAMP_N = ['入口', '深處', '守護者前'];
export function carveDungeons(roomSpawn: (d: Dungeon, tx: number, ty: number, kind: string, lv: number) => void) {
  for (let y = OLDZ.y0 - 2; y <= OLDZ.y1 + 2; y++) for (let x = OLDZ.x0 - 2; x <= OLDZ.x1; x++) { map[y * MW + x] = CLIFF; reg[y * MW + x] = DREG; }   // 舊的地城區塊：照舊填滿岩石
  for (let i = CAMPS.length - 1; i >= 0; i--) if (CAMPS[i].dg) CAMPS.splice(i, 1);
  for (const d of DUNGEONS) {
    const R = mulberry32(d.id.length * 977 + d.ent[0] * 31 + d.ent[1]), built = d.style === 'crypt' || d.style === 'ruin', floor = built ? RFLOOR : GROUND;
    for (let y = d.y0; y < d.y0 + d.h; y++) for (let x = d.x0; x < d.x0 + d.w; x++) reg[y * MW + x] = DREG;
    const lay = carveLayout(d, R, VERT_TRAPS.has(PUZ[d.id]?.trap)); d.lay = lay; d.rooms = lay.rooms;
    const { rooms, hall } = lay, entry = rooms[lay.path[0]];
    d.inX = entry.x * TS + 8; d.inY = (entry.y - 1) * TS + 8; d.exX = entry.x * TS + 8; d.exY = (entry.y + 3) * TS + 8;
    map[(entry.y + 3) * MW + entry.x] = floor; map[(entry.y - 1) * MW + entry.x] = floor;
    // 營火：入口房（傳送門旁邊）、主路中段、Boss 大廳前那間謎題房的前一間
    lay.camps.forEach((ri, k) => { const r = rooms[ri], tx = r.x + (k === 0 ? 3 : 0), ty = r.y + (k === 0 ? 1 : 0);
      for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (map[y * MW + x] === CLIFF || map[y * MW + x] === RWALL || map[y * MW + x] === PILLAR) map[y * MW + x] = floor;
      CAMPS.push({ id: 'dg_' + d.id + '_' + k, name: d.name + '・' + CAMP_N[k] + '營火', tx, ty, lit: false, x: tx * TS + 8, y: ty * TS + 10, dg: d.id }); });
    // 小怪：一般的路、岔路；入口、營火房、解謎區、寶物房不放
    for (const r of rooms) { if (r.role !== 'path' && r.role !== 'branch' && r.role !== 'end') continue;
      const n = 1 + (r.rx * r.ry >= 16 ? 1 : 0) + (R() < .5 ? 1 : 0);
      for (let k = 0; k < n; k++) for (let t = 0; t < 12; t++) { const x = r.x + Math.round((R() - .5) * r.rx * 1.6), y = r.y + Math.round((R() - .5) * r.ry * 1.6); if (map[y * MW + x] !== floor) continue;
        roomSpawn(d, x, y, d.kinds[Math.floor(R() * d.kinds.length)], d.lv + (R() < .4 ? 2 : 0)); break; } }
    d.bossAt = [hall.x, hall.y + 1, Math.min(hall.rx, hall.ry) - .5];        // Boss 的結界：大廳中央，半徑比房間小一點
    d.bossChest = [hall.x, hall.y - hall.ry + 1];
    d.portal = [hall.x * TS + 8, (hall.y + 3) * TS + 8];                   // 大廳中央偏下：不會擋到最深處的金箱
    const tr = rooms[lay.treasure];
    d.sideChests = [[tr.x, tr.y, 2], ...lay.ends.map((ri, k): [number, number, number] => [rooms[ri].x, rooms[ri].y, d.style === 'ruin' && k === 0 ? 2 : 1])];   // 寶物房 = 金箱；死路 = 銀箱（遺跡第一條是金箱）
    const mid = rooms[lay.camps[1]]; d.tablet = [mid.x + mid.rx - 1, mid.y - mid.ry + 1]; map[d.tablet[1] * MW + d.tablet[0]] = floor;
  }
}
export function addDungeonSpawns() {
  carveDungeons((d, tx, ty, kind, lv) => spawns.push({ tx, ty, x: tx * TS + 8, y: ty * TS + 8, kind, lv, alive: false, timer: 0 }));
}

/* ---- 進出 ---- */
export interface Door { d: Dungeon; out: boolean; x: number; y: number; portal?: boolean }
// 「這座地城的 Boss 打倒了沒」：flags 在 game/quest.ts，這個檔案會被地圖生成 import，不能直接 import quest → 由 quest.ts 把判斷塞進來
export const dungeonHooks = { cleared: (_d: Dungeon) => false };
export function nearDoor(pl: Player): Door | null {
  if (!pl || pl.dead) return null;
  for (const d of DUNGEONS) {
    const fx = d.ent[0] * TS + 8, fy = d.stairs ? d.ent[1] * TS + 14 : (d.ent[1] + 1) * TS + 6;   // 野外：站在洞口前 / 石階上
    if (Math.abs(pl.x - fx) < 20 && Math.abs(pl.y - fy) < 18) return { d, out: false, x: fx, y: fy };
    if (d.exX !== undefined && Math.abs(pl.x - d.exX) < 16 && Math.abs(pl.y - d.exY) < 14) return { d, out: true, x: d.exX, y: d.exY };   // 裡面：站在出口的傳送門上
    if (d.portal && Math.abs(pl.x - d.portal[0]) < 16 && Math.abs(pl.y - d.portal[1]) < 14 && dungeonHooks.cleared(d)) return { d, out: true, x: d.portal[0], y: d.portal[1], portal: true };   // Boss 大廳的傳送門
  }
  return null;
}
export function useDoor(pl: Player, door: Door, snap: (pl: Player) => void) {
  const d = door.d;
  if (door.out) { pl.x = d.ent[0] * TS + 8; pl.y = (d.ent[1] + (d.stairs ? 2 : 1)) * TS + 12; }
  else { pl.x = d.inX; pl.y = d.inY; }
  pl.dash = null; pl.dvx = pl.dvy = 0; G.projs = [];
  snap(pl); G.fx.push({ k: 'flash', col: '#000000', a: .9, t: 0, d: .45 });
}

export const doorLabel = (door: Door) => door.portal ? '傳送回地面' : door.out ? '離開「' + door.d.name + '」' : '進入「' + door.d.name + '」';
