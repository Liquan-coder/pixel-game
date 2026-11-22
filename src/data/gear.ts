/* ================= 防具、飾品、刻印（新制） =================
   「不一樣」比「比較強」重要：裝備沒有品階、沒有物品等級，每件都有自己的用途。

   防具：輕 / 中 / 重三類，各有取捨（見 ACLS）。有些防具帶「地區抗性」：在那個地區受到的傷害變少。
         可以用素材強化 +1 ～ +5（每級防禦、生命 +15%）。
   飾品：每件只有一個（或兩個）明確的效果（見 EFF）。欄位一開始 2 格，打倒主線 Boss 會增加到 4 格。
   刻印：出血、燃燒…… 變成背包裡的道具，可以裝到任何一般武器上，也可以拆下來換到別把。
   獨特防具 / 飾品（data/uniques.ts 的 UG）：同一套效果，數值比較高，加上名字和背景故事。 */
import type { Item } from '../types';

/* ---- 效果：防具的額外效果、飾品、獨特裝備共用 ---- */
export const REGION_N: Record<string, string> = { plains: '翠風平原', forest: '迷霧森林', wastes: '骸骨荒地', lava: '熔岩高地', snow: '霜寒雪原', swamp: '幽影沼澤' };
export const EFF: Record<string, (v: number) => string> = {
  hpPct: v => '生命上限 +' + v + '%',
  stam: v => '體力上限 +' + v,
  crit: v => '暴擊率 +' + v + '%',
  cdr: v => '技能冷卻 -' + v + '%',
  aspd: v => '攻擊速度 +' + v + '%',
  atkPct: v => '攻擊力 +' + v + '%',
  guard: v => '受到的傷害 -' + v + '%',
  dodgeAtk: v => '瞬移後 1.5 秒內，下一擊傷害 +' + v + '%',
  killHeal: v => '打倒敵人時回復 ' + v + '% 生命',
  charge: v => '蓄力速度 +' + v + '%',
  fxBuild: v => '刻印效果（出血、凍傷、雷鳴的累積，燃燒機率）+' + v + '%',
  lowHp: v => '生命低於 35% 時，攻擊力 +' + v + '%',
  potion: v => '藥水多回 ' + v + '% 生命',
  souls: v => '得到的魂晶 +' + v + '%',
  regen: v => '每秒回復 ' + v + '% 生命（戰鬥中也會）',
  lifesteal: v => '吸血 ' + v + '%（每一下最多回 1% 生命，打 Boss 減半）',
  thorns: v => '反傷：被打中時，把 ' + v + '% 的傷害還給打你的人',
  evade: v => v + '% 機率完全閃開一次攻擊',
  /* 流派飾品：不是加數字，是改變打法（只有獨特版，藏在野外 / 王城的密室） */
  dodgeCut: v => '瞬移穿過敵人時，順手砍他一刀（攻擊力 ' + v + '%）',
  bloodSkill: v => '技能冷卻中也能放：改花 ' + v + '% 生命（不會因此倒下）',
  counter: v => '被打中後 2 秒內，下一擊必定暴擊、傷害 +' + v + '%',
  /* 流派核心（game/builds.ts；spread 在 game/weaponFx.ts） */
  afterimage: v => '完美閃避時，原地留下殘影，0.5 秒後爆炸（攻擊力 ' + v + '%）',
  rage: v => '被打中時累積怒氣，6 秒內的下一擊把怒氣的 ' + v + '% 一次打回去（怒氣最多存到生命上限的 60%）',
  thirst: v => '生命越少吸血越多：剩一半生命時吸血 ' + v / 2 + '%，快倒下時接近 ' + v + '%（每一下最多回 3% 生命，打 Boss 減半）',
  critCdr: v => '暴擊時，技能冷卻減少 ' + v + ' 秒',
  quake: v => '蓄滿的重擊放出震波：周圍的敵人受到攻擊力 ' + v + '% 的傷害並暈眩 0.8 秒',
  spread: v => '刻印發作時，傳染給附近最多 4 個敵人（累積 +' + v + '，燃燒直接點著）',
  res_plains: v => '在' + REGION_N.plains + '受到的傷害 -' + v + '%', res_forest: v => '在' + REGION_N.forest + '受到的傷害 -' + v + '%',
  res_wastes: v => '在' + REGION_N.wastes + '受到的傷害 -' + v + '%', res_lava: v => '在' + REGION_N.lava + '受到的傷害 -' + v + '%',
  res_snow: v => '在' + REGION_N.snow + '受到的傷害 -' + v + '%', res_swamp: v => '在' + REGION_N.swamp + '受到的傷害 -' + v + '%',
};
export const effLines = (e: Record<string, number> | undefined) => e ? Object.keys(e).filter(k => EFF[k]).map(k => EFF[k](e[k])) : [];

/* ---- 重量（負重）：武器 + 防具的重量 ÷ 負重上限（20 + 耐力）→ 四段。只影響走路和體力回復，瞬移不受影響
   想拿重武器、穿重甲，就要點耐力（戰鎚 + 皮甲在耐力 5 是沉重；戰鎚 + 鎖甲要耐力 18 才回到普通）。飾品沒有重量。 */
export const W_WEIGHT: Record<string, number> = { dagger: 2, rapier: 2.5, elfrapier: 2.5, bow: 3, elfbow: 3, staff: 3, elfblades: 3.5, sword: 4, katana: 4, wolfblade: 4,
  crescent: 4.5, spear: 5, twinblade: 5, scythe: 6, axe: 7, darkmoon: 9, greatsword: 10, hammer: 12 };
export const A_WEIGHT = { light: 3, medium: 7, heavy: 14 };              // 防具照類型：法袍 / 皮甲 / 鎖甲
export const LOAD_TIERS = [                                              // max = 負重比例上限；mv = 走路速度；st = 體力回復
  { max: .3, n: '輕盈', mv: 1.06, st: 1, d: '走路 +6%', c: '#8ad0ff' },
  { max: .7, n: '普通', mv: 1, st: 1, d: '走路、體力回復都正常', c: '#c8e8a0' },
  { max: 1, n: '沉重', mv: .88, st: .8, d: '走路 −12%、體力回復 −20%', c: '#ffb060' },
  { max: Infinity, n: '超重', mv: .7, st: .6, d: '走路 −30%、體力回復 −40%', c: '#ff6a5a' },
];
export const loadCap = (end: number) => 20 + (end || 0);
export const loadTier = (load: number, cap: number) => LOAD_TIERS.findIndex(T => load / cap <= T.max + 1e-9);
export const fmtW = (w: number) => (Math.round(w * 10) / 10).toString();   // 重量顯示：2.5、12

/* ---- 防具三類：輕的好閃躲、重的耐打 ----
   def / hp = +0 時的防禦和生命；dodgeSt = 瞬移體力（基本 20）多 / 少多少；dodgeMul = 瞬移距離；poise = 被打不會被擊退 */
export const ACLS = {
  light:  { n: '輕甲', def: 4, hp: 14, dodgeSt: -6, dodgeMul: 1.1, cdr: 6, poise: false, d: '瞬移省體力、距離遠，技能冷卻 -6%；防禦低' },
  medium: { n: '中甲', def: 8, hp: 8, dodgeSt: 0, dodgeMul: 1, cdr: 0, poise: false, d: '攻守平均' },
  heavy:  { n: '重甲', def: 13, hp: 0, dodgeSt: 8, dodgeMul: .82, cdr: 0, poise: true, d: '防禦高、被打不會被擊退；瞬移多花體力、距離短' },
};
export type ACls = keyof typeof ACLS;
export const ACLS_OF: Record<string, ACls> = { robe: 'light', leather: 'medium', mail: 'heavy' };   // type = 圖示（法袍 / 皮甲 / 鎖甲）
export const A_UP_MAX = 5;
export const aUpMult = (up: number) => 1 + .15 * (up || 0);

/* 一般防具（會掉落、商店賣）：k = 編號 */
export const ARMORS: Record<string, { type: 'robe' | 'leather' | 'mail'; name: string; eff?: Record<string, number>; d?: string }> = {
  cloth:   { type: 'robe', name: '旅人斗篷' },
  hunter:  { type: 'leather', name: '獵人皮甲' },
  chain:   { type: 'mail', name: '鐵環鎖甲' },
  mistcoat:{ type: 'leather', name: '霧行外套', eff: { res_forest: 20 }, d: '在霧裡走久了，衣服也學會了閃開' },
  sandrobe:{ type: 'robe', name: '風沙罩袍', eff: { res_wastes: 20 }, d: '擋得住風沙，也擋得住一點骨頭' },
  ember:   { type: 'mail', name: '燼鱗甲', eff: { res_lava: 25 }, d: '用不會燃燒的鱗片縫成' },
  fur:     { type: 'robe', name: '毛皮斗篷', eff: { res_snow: 25 }, d: '雪狼的毛，暖得讓人想睡' },
  bog:     { type: 'leather', name: '沼行皮甲', eff: { res_swamp: 25 }, d: '泡過沼水還不會爛的皮' },
  thornmail: { type: 'mail', name: '荊棘甲', eff: { thorns: 40 }, d: '每一片甲都朝外長著倒鉤' },
  shade:   { type: 'robe', name: '影織斗篷', eff: { evade: 10 }, d: '穿上之後，連影子都不太確定你在哪裡' },
};
export const ARMOR_BUILD = ['thornmail', 'shade'];                    // 流派防具：反傷、閃避（掉落 / 商店偶爾出現）
export const ARMOR_BASIC = ['cloth', 'hunter', 'chain'];
export const ARMOR_REGION: Record<string, string> = { forest: 'mistcoat', wastes: 'sandrobe', lava: 'ember', snow: 'fur', swamp: 'bog' };

/* 一般飾品：每件一個效果 */
export const TRINKETS: Record<string, { type: 'ring' | 'amulet'; name: string; eff: Record<string, number>; d?: string }> = {
  fang:    { type: 'amulet', name: '狼牙項鍊', eff: { dodgeAtk: 25 } },
  knuckle: { type: 'ring', name: '巨人的指節', eff: { charge: 35 } },
  ember:   { type: 'amulet', name: '殘燈墜子', eff: { lowHp: 20 } },
  herb:    { type: 'amulet', name: '草藥囊', eff: { potion: 15 } },
  greed:   { type: 'ring', name: '貪婪指環', eff: { souls: 20 } },
  feather: { type: 'amulet', name: '風之羽', eff: { stam: 25 } },
  hawk:    { type: 'ring', name: '鷹眼戒指', eff: { crit: 6 } },
  rune:    { type: 'ring', name: '秘儀指環', eff: { cdr: 15 } },
  iron:    { type: 'amulet', name: '鐵心護符', eff: { guard: 8 } },
  life:    { type: 'amulet', name: '生命護符', eff: { hpPct: 10 } },
  frost:   { type: 'ring', name: '霜之心', eff: { fxBuild: 40 } },
  vigil:   { type: 'amulet', name: '守夜燈', eff: { killHeal: 2 } },
  might:   { type: 'ring', name: '力之戒', eff: { atkPct: 6 } },
  wind:    { type: 'ring', name: '疾風戒指', eff: { aspd: 7 } },
  cinder:  { type: 'amulet', name: '燼石護符', eff: { res_lava: 18 } },
  foxtail: { type: 'amulet', name: '雪狐毛結', eff: { res_snow: 18 } },
  bogsack: { type: 'amulet', name: '沼氣濾囊', eff: { res_swamp: 18 } },
  thorn:   { type: 'ring', name: '荊棘指環', eff: { thorns: 25 } },
  shadow:  { type: 'amulet', name: '影步護符', eff: { evade: 8 } },
};
export const TRINKET_KEYS = Object.keys(TRINKETS);

/* 飾品欄位：一開始 2 格，打倒 2 隻主線 Boss → 3 格，4 隻 → 4 格 */
export const T_SLOTS_MAX = 4;
export const MAIN_BOSSES = ['queen', 'mushking', 'general', 'dragon', 'yeti', 'lich'];   // 再加上狼王（G.bossDead）

/* ---- 刻印道具 ---- */
export const SEAL_NAME = (fxN: string) => fxN + '刻印';

/* ---- 物品是哪一種 ---- */
export const isSeal = (it: Item | null) => !!it && it.slot === 'seal';
