/* ================= 獨特武器（傳說） =================
   傳說稀有度只屬於這些有名字的武器：固定的基礎攻擊、需求、加成、刻印效果和詞綴。
   來源固定（Boss、地城盡頭），不會隨機掉。存檔只記 uq = 編號，數值改這裡就會套用到舊存檔。
   新增獨特武器：在 UQ 加一筆，再到掉落的地方呼叫 makeUnique('編號')。 */
import { UQ_REQ, UQ_SCALE } from './attrs';
import type { AttrKey } from './attrs';

export interface UniqueDef {
  type: string;                                   // 用哪一種武器的動作和技能（WT 的 key）
  name: string; base: number; fx: string;
  aff: Record<string, number>;
  req: Partial<Record<AttrKey, number>>; scale?: Partial<Record<AttrKey, number>>;
  lore: string; from: string;                     // 背景故事、從哪裡拿到
}
export const UQ: Record<string, UniqueDef> = {
  // 翠風平原的三座地城（world/dungeons.ts）：早期就拿得到的獨特武器，基礎攻擊只比一般的高一點，重點是刻印
  mossfang: { type: 'dagger', name: '苔牙短刀', base: 9, fx: 'bleed', aff: { crit: 6, speed: 8 }, req: { dex: 9 },
    lore: '從洞窟裡一隻長滿苔蘚的老狼口中拔下來的牙，磨成了短刀。', from: '翠風平原・苔石洞窟' },
  barrowblade: { type: 'sword', name: '守墓人長劍', base: 13, fx: 'soul', aff: { lifesteal: 3, crit: 5 }, req: { str: 8, dex: 7 },
    lore: '無名劍士的佩劍。劍柄上纏著一條褪色的髮帶。', from: '翠風平原・無名古墓' },
  tidespear: { type: 'spear', name: '潮音長槍', base: 13, fx: 'shock', aff: { speed: 8, cdr: 10 }, req: { str: 7, dex: 10 },
    lore: '槍尖是一枚巨大的螺貝，刺出去的時候會發出浪聲。', from: '翠風平原・潮音石窟' },
  wolfblade: { type: 'wolfblade', name: '狼牙雙刃', base: 15, fx: 'bleed', aff: { crit: 10, lifesteal: 4, speed: 10 }, req: { dex: 12, str: 9 },
    lore: '灰鬃的兩根獠牙磨成的雙刃，握著時能聽見遠方的狼嚎。', from: '狼王巢穴' },
  emberstaff: { type: 'staff', name: '燼翼法杖', base: 13, fx: 'burn', aff: { crit: 10, cdr: 15, speed: 10 }, req: { int: 16 }, scale: { int: 1.25 },
    lore: '用巨龍燼翼的翼骨削成，杖頭的餘燼從來沒有熄過。', from: '熔岩高地・燼龍火口' },
  frostmaul: { type: 'hammer', name: '霜鬃巨鎚', base: 28, fx: 'frost', aff: { crit: 8, def: 12, hp: 120 }, req: { str: 20, end: 12 },
    lore: '雪原巨人拿來敲碎冰河的鎚子，鎚面永遠結著一層霜。', from: '霜寒雪原・雪頂祭壇' },
  rotscythe: { type: 'scythe', name: '腐沼之鐮', base: 17, fx: 'soul', aff: { lifesteal: 5, cdr: 18, speed: 12 }, req: { dex: 14, int: 16 },
    lore: '巫妖收割魂魄用的鐮刀。刀刃劃過的地方，連影子都會變淡。', from: '幽影沼澤・腐沼祭壇' },
};
for (const k in UQ) { UQ_REQ[k] = UQ[k].req; if (UQ[k].scale) UQ_SCALE[k] = UQ[k].scale; }
/** 舊存檔的獨特武器只有名字 → 對回編號 */
export const UQ_BY_NAME: Record<string, string> = Object.fromEntries(Object.entries(UQ).map(([k, u]) => [u.name, k]));

/* ================= 地底的獨特武器（地底遺跡最深處的金箱） ================= */
Object.assign(UQ, {
  royalguard: { type: 'sword', name: '王城近衛劍', base: 22, fx: 'soul', aff: { crit: 8, lifesteal: 4 }, req: { str: 14, dex: 12 },
    lore: '近衛隊長的佩劍。王都陷落的那一夜，他守在地底的門前，一步也沒有退。', from: '骸骨荒地・王城地下墓所' },
  forgehammer: { type: 'hammer', name: '古爐鍛鎚', base: 34, fx: 'burn', aff: { crit: 6, def: 10, hp: 90 }, req: { str: 22, end: 14 },
    lore: '打造星核容器的鎚子。敲在鐵砧上的聲音，聽起來像心跳。', from: '熔岩高地・熔爐地底遺跡' },
  deepstaff: { type: 'staff', name: '深淵祭司杖', base: 19, fx: 'frost', aff: { cdr: 18, crit: 9, speed: 8 }, req: { int: 24 }, scale: { int: 1.3 },
    lore: '沉沒神殿的祭司用來「關上」星星的手杖。杖頭的寶石裡，有一片小小的夜空。', from: '幽影沼澤・沉沒神殿地底' },
} as Record<string, UniqueDef>);
for (const k of ['royalguard', 'forgehammer', 'deepstaff']) { UQ_REQ[k] = UQ[k].req; if (UQ[k].scale) UQ_SCALE[k] = UQ[k].scale; UQ_BY_NAME[UQ[k].name] = k; }

/* ================= 獨特防具 / 飾品（傳說） =================
   每座地城的 Boss 一定會掉一件「招牌裝備」（地城定義裡的 sig）。數值固定：
   lv = 物品等級（決定防具的基礎防禦 / 生命，跟一般防具同一條公式，再乘傳說倍率）；aff 裡的 hp / def / st 是「1 級時的數值」，會跟一般詞綴一樣隨物品等級放大。
   存檔只記 ug = 編號，數值改這裡就會套用到舊存檔。 */
export interface UniqueGearDef { type: 'robe' | 'leather' | 'mail' | 'ring' | 'amulet'; name: string; lv: number; aff: Record<string, number>; lore: string; from: string }
export const UG: Record<string, UniqueGearDef> = {
  mosscloak:   { type: 'robe', name: '苔綠斗篷', lv: 5, aff: { hp: 24, lifesteal: 3, speed: 8 }, lore: '洞窟深處的史萊姆王把它當成床。上面的苔蘚到現在還活著，會慢慢把傷口補起來。', from: '翠風平原・苔石洞窟' },
  barrowlamp:  { type: 'amulet', name: '守墓人的燈', lv: 6, aff: { hp: 26, crit: 6, cdr: 10 }, lore: '一盞永遠不能熄的燈，縮成了項鍊那麼小。火光裡偶爾會映出一個陌生人的笑臉。', from: '翠風平原・無名古墓' },
  tideshell:   { type: 'ring', name: '潮音貝殼', lv: 6, aff: { crit: 7, cdr: 14, speed: 8 }, lore: '貼在耳邊能聽見搖籃曲。唱歌的人好像就在海的另一邊。', from: '翠風平原・潮音石窟' },
  silkmail:    { type: 'leather', name: '蛛絲軟甲', lv: 9, aff: { def: 4, speed: 12, crit: 5 }, lore: '巢母吐的絲編成的甲，比皮還輕、比鐵還韌。', from: '迷霧森林・蛛巢洞窟' },
  rootheart:   { type: 'amulet', name: '根心護符', lv: 10, aff: { hp: 30, lifesteal: 4, def: 3 }, lore: '老樹根纏著的一顆種子。握著它的時候，腳底好像也長出了根。', from: '迷霧森林・樹根地穴' },
  sandeye:     { type: 'ring', name: '砂眼指環', lv: 13, aff: { crit: 9, speed: 10, hp: 14 }, lore: '風蝕的岩窟裡，一隻從沒閉過的眼睛化成的石頭。', from: '骸骨荒地・風蝕岩窟' },
  sandwrap:    { type: 'robe', name: '沙王的裹布', lv: 14, aff: { hp: 28, cdr: 16, lifesteal: 3 }, lore: '沙埋神殿裡的王，用這塊布裹著自己睡了一千年。布上寫滿了他沒說完的話。', from: '骸骨荒地・沙埋神殿' },
  magmacore:   { type: 'amulet', name: '熔核護心', lv: 18, aff: { hp: 30, crit: 7, def: 3 }, lore: '熔岩隧道最深處的心臟。戴在胸口，冬天也不會冷。', from: '熔岩高地・熔岩隧道' },
  obsidianmail:{ type: 'mail', name: '黑曜鱗甲', lv: 19, aff: { hp: 22, def: 4, st: 10 }, lore: '黑曜石磨成的鱗片，一片一片縫上去。刀砍上去會發出玻璃一樣的聲音。', from: '熔岩高地・黑曜石窟' },
  icering:     { type: 'ring', name: '冰晶指環', lv: 23, aff: { crit: 9, cdr: 16, st: 10 }, lore: '冰晶洞窟的女王留下的一滴眼淚，結成了戒指。', from: '霜寒雪原・冰晶洞窟' },
  frostplate:  { type: 'mail', name: '霜墓騎士甲', lv: 24, aff: { hp: 26, def: 4, lifesteal: 3 }, lore: '守在霜墓裡的騎士，到死都沒有脫下這副盔甲。甲片裡結著他的呼吸。', from: '霜寒雪原・霜墓' },
  rotleather:  { type: 'leather', name: '腐根皮甲', lv: 28, aff: { hp: 28, def: 4, speed: 10 }, lore: '腐根洞窟的蛙王蛻下的皮。聞起來很糟，但什麼毒都滲不進來。', from: '幽影沼澤・腐根洞窟' },
  drownpearl:  { type: 'amulet', name: '水鬼的珍珠', lv: 29, aff: { hp: 30, cdr: 18, crit: 7 }, lore: '沉沒石窟的水鬼一直握在手裡的珍珠。牠說：這是要還給一個人的。', from: '幽影沼澤・沉沒石窟' },
  lastcrown:   { type: 'amulet', name: '最後的王冠', lv: 16, aff: { hp: 34, crit: 8, lifesteal: 4, cdr: 10 }, lore: '王都最後一位王的王冠，被壓成了一枚墜子。王冠上本來鑲著一顆星星。', from: '骸骨荒地・王城地下墓所' },
  forgeplate:  { type: 'mail', name: '爐心護甲', lv: 21, aff: { hp: 30, def: 5, st: 12, crit: 4 }, lore: '熔爐的守護者用自己的爐心鍛成的鎧甲。胸口那一塊，摸起來是溫的。', from: '熔岩高地・熔爐地底遺跡' },
  wardenveil:  { type: 'robe', name: '看守者的面紗', lv: 30, aff: { hp: 34, cdr: 20, lifesteal: 5, crit: 6 }, lore: '看守星星的人戴的面紗。透過它看出去，夜空裡的每一顆星星都有名字。', from: '幽影沼澤・沉沒神殿地底' },
};
