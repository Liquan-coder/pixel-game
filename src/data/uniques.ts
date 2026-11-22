/* ================= 獨特武器（傳說） =================
   傳說稀有度只屬於這些有名字的武器：固定的基礎攻擊、需求、加成、刻印效果和詞綴。
   來源固定（Boss、地城盡頭），不會隨機掉。存檔只記 uq = 編號，數值改這裡就會套用到舊存檔。
   新增獨特武器：在 UQ 加一筆，再到掉落的地方呼叫 makeUnique('編號')。 */
import { UQ_REQ, UQ_SCALE } from './attrs';
import type { AttrKey } from './attrs';

export interface UniqueDef {
  type: string;                                   // 用哪一種武器的動作和技能（WT 的 key）
  name: string; base: number; fx?: string;        // 獨特武器不用刻印（招牌能力在 UQSIG / game/signatures.ts）
  aff: Record<string, number>;
  req: Partial<Record<AttrKey, number>>; scale?: Partial<Record<AttrKey, number>>;
  lore: string; from: string;                     // 背景故事、從哪裡拿到
}
export const UQ: Record<string, UniqueDef> = {
  // 翠風平原的三座地城（world/dungeons.ts）：早期就拿得到的獨特武器，基礎攻擊只比一般的高一點，重點是招牌能力
  mossfang: { type: 'dagger', name: '苔牙短刀', base: 9, aff: { crit: 6, speed: 8 }, req: { dex: 9 },
    lore: '從洞窟裡一隻長滿苔蘚的老狼口中拔下來的牙，磨成了短刀。', from: '翠風平原・苔石洞窟' },
  barrowblade: { type: 'sword', name: '守墓人長劍', base: 13, aff: { crit: 5 }, req: { str: 8, dex: 7 },
    lore: '無名劍士的佩劍。劍柄上纏著一條褪色的髮帶。', from: '翠風平原・無名古墓' },
  tidespear: { type: 'spear', name: '潮音長槍', base: 13, aff: { speed: 8, cdr: 10 }, req: { str: 7, dex: 10 },
    lore: '槍尖是一枚巨大的螺貝，刺出去的時候會發出浪聲。', from: '翠風平原・潮音石窟' },
  wolfblade: { type: 'wolfblade', name: '狼牙雙刃', base: 14, aff: { crit: 10, lifesteal: 3, speed: 10 }, req: { dex: 12, str: 9 },
    lore: '灰鬃的兩根獠牙磨成的雙刃，握著時能聽見遠方的狼嚎。', from: '狼王巢穴' },
  emberstaff: { type: 'staff', name: '燼翼法杖', base: 13, aff: { crit: 10, cdr: 15, speed: 10 }, req: { int: 16 }, scale: { int: 1.25 },
    lore: '用巨龍燼翼的翼骨削成，杖頭的餘燼從來沒有熄過。', from: '熔岩高地・燼龍火口' },
  frostmaul: { type: 'hammer', name: '霜鬃巨鎚', base: 28, aff: { crit: 6, hp: 40 }, req: { str: 20, end: 12 },
    lore: '雪原巨人拿來敲碎冰河的鎚子，鎚面永遠結著一層霜。', from: '霜寒雪原・雪頂祭壇' },
  rotscythe: { type: 'scythe', name: '腐沼之鐮', base: 17, aff: { lifesteal: 4, cdr: 15, speed: 10 }, req: { dex: 14, int: 16 },
    lore: '巫妖收割魂魄用的鐮刀。刀刃劃過的地方，連影子都會變淡。', from: '幽影沼澤・腐沼祭壇' },
};
for (const k in UQ) { UQ_REQ[k] = UQ[k].req; if (UQ[k].scale) UQ_SCALE[k] = UQ[k].scale; }
/** 舊存檔的獨特武器只有名字 → 對回編號 */
export const UQ_BY_NAME: Record<string, string> = Object.fromEntries(Object.entries(UQ).map(([k, u]) => [u.name, k]));

/* ================= 地底的獨特武器（地底遺跡最深處的金箱） ================= */
Object.assign(UQ, {
  royalguard: { type: 'sword', name: '王城近衛劍', base: 22, aff: { crit: 8, speed: 6 }, req: { str: 14, dex: 12 },
    lore: '近衛隊長的佩劍。王都陷落的那一夜，他守在地底的門前，一步也沒有退。', from: '骸骨荒地・王城地下墓所' },
  forgehammer: { type: 'hammer', name: '古爐鍛鎚', base: 34, aff: { crit: 5, hp: 30 }, req: { str: 22, end: 14 },
    lore: '打造星核容器的鎚子。敲在鐵砧上的聲音，聽起來像心跳。', from: '熔岩高地・熔爐地底遺跡' },
  deepstaff: { type: 'staff', name: '深淵祭司杖', base: 19, aff: { cdr: 18, crit: 9, speed: 8 }, req: { int: 24 }, scale: { int: 1.3 },
    lore: '沉沒神殿的祭司用來「關上」星星的手杖。杖頭的寶石裡，有一片小小的夜空。', from: '幽影沼澤・沉沒神殿地底' },
} as Record<string, UniqueDef>);
/* ================= 自己一種武器的獨特武器（月牙刀、雙頭刀、暗月大劍：動作和技能都是自己的，見 game/combat.ts） ================= */
Object.assign(UQ, {
  silktwin: { type: 'twinblade', name: '巢母雙頭刀', base: 16, aff: { speed: 10, crit: 6 }, req: { dex: 13, str: 8 },
    lore: '巢母的兩根毒牙，用蛛絲綁在同一根骨頭的兩端。轉起來的時候，像一張會咬人的網。', from: '迷霧森林・蛛巢洞窟' },
  sandcrescent: { type: 'crescent', name: '沙王的月牙刀', base: 16, aff: { crit: 8, cdr: 10 }, req: { dex: 13, str: 11 },
    lore: '沙之王每晚對著月亮祈禱，月亮就把自己的一角借給了他。丟出去的刀，總會回到主人手上。', from: '骸骨荒地・沙埋神殿' },
  darkmoon: { type: 'darkmoon', name: '暗月大劍', base: 23, aff: { crit: 6, cdr: 12 }, req: { str: 16, int: 18 }, scale: { str: .5, int: .7 },
    lore: '霜墓的騎士一直等著光回來。光沒有回來，月亮卻來了——落在他的劍上，再也沒有離開。', from: '霜寒雪原・霜墓' },
} as Record<string, UniqueDef>);
/* ================= 精靈武器（精靈王國，world/elfland.ts）：三種都是自己的武器種類 ================= */
Object.assign(UQ, {
  elfbow: { type: 'elfbow', name: '精靈王的長弓', base: 16, aff: { crit: 8, speed: 8 }, req: { dex: 15, int: 10 },
    lore: '弓弦是月光搓成的。精靈王說，他射出的每一支箭，都是一句沒說出口的道歉。', from: '精靈王國・精靈王城' },
  elfrapier: { type: 'elfrapier', name: '月泉細劍', base: 13, aff: { crit: 10, cdr: 10 }, req: { dex: 15, int: 8 },
    lore: '月泉湖心的島上插著這把劍。劍身映著的月亮，比天上的還要圓。', from: '精靈王國・月泉' },
  elfblades: { type: 'elfblades', name: '螢火雙刀', base: 14, aff: { speed: 10, crit: 6 }, req: { dex: 17 },
    lore: '月蛾女王吞下的螢火，最後凝成了兩把刀。揮起來的時候，刀光像一群飛走的螢火蟲。', from: '精靈王國・螢月禁林' },
} as Record<string, UniqueDef>);
for (const k of ['royalguard', 'forgehammer', 'deepstaff', 'silktwin', 'sandcrescent', 'darkmoon', 'elfbow', 'elfrapier', 'elfblades']) { UQ_REQ[k] = UQ[k].req; if (UQ[k].scale) UQ_SCALE[k] = UQ[k].scale; UQ_BY_NAME[UQ[k].name] = k; }

/* ================= 獨特武器的招牌能力 =================
   獨特武器不裝刻印，每把有自己的規則（寫在 game/signatures.ts）：n = 名字、d = 卡片上的說明、cols = 刀光顏色（深 / 中 / 亮） */
export const UQSIG: Record<string, { n: string; d: string; cols: [string, string, string] }> = {
  mossfang:     { n: '背刺', d: '從敵人背後打必定暴擊，傷害 ×1.3', cols: ['#2a5a1a', '#8ad060', '#e8ffd0'] },
  barrowblade:  { n: '守墓燈火', d: '打倒敵人時召喚一盞燈魂繞著你轉（最多 3 盞，20 秒），每 1.2 秒射附近的敵人（攻擊力 35%）', cols: ['#6a3a10', '#f0a030', '#fff0c0'] },
  tidespear:    { n: '潮汐', d: '第三下刺出一道水浪，把一整排敵人推開（攻擊力 80%）', cols: ['#1a4a8a', '#6ac8ff', '#e8f8ff'] },
  wolfblade:    { n: '狼群', d: '連續打中 5 下，跳出一隻狼影撲咬目標（攻擊力 200%，暈眩 0.4 秒）', cols: ['#3a2470', '#9a6cff', '#f0e0ff'] },
  emberstaff:   { n: '燼翼', d: '打中的地方燒起一片火海（2.5 秒，每 0.5 秒燒一次，攻擊力 15%）', cols: ['#8a2a0a', '#ff8a2a', '#fff0a0'] },
  frostmaul:    { n: '冰柱', d: '每次砸地，周圍竄出一圈冰柱（每根攻擊力 35%，暈眩 0.3 秒）', cols: ['#1a3a5a', '#9ae0ff', '#f0faff'] },
  rotscythe:    { n: '收割', d: '敵人剩 25% 生命以下直接斬殺（精英 12%，Boss 不會）；打中照樣回血', cols: ['#1a4a2a', '#3ad08a', '#e0fff0'] },
  royalguard:   { n: '近衛之盾', d: '三連擊的最後一下給你一層金色護盾，8 秒內擋下一次攻擊', cols: ['#6a4a10', '#f2c14e', '#fff6d0'] },
  forgehammer:  { n: '鍛打', d: '打中會讓鎚子變燙（最多 6 層），燒到最熱時下一次砸地熔岩爆炸（攻擊力 160%，留下一片火海）', cols: ['#7a2a0a', '#ff6a2a', '#fff0a0'] },
  deepstaff:    { n: '深淵之眼', d: '法彈和火球會轉彎追蹤附近的敵人', cols: ['#1a0a30', '#6a3aa0', '#40e0c0'] },
  silktwin:     { n: '蛛網', d: '打中黏上蛛網 3 秒：敵人變慢，受到的傷害 +20%', cols: ['#3a2a4a', '#c8c8d8', '#ffffff'] },
  sandcrescent: { n: '沙暴月', d: '月牙飛到最遠時捲起一陣沙暴（1.4 秒），把附近的敵人吸過去', cols: ['#6a4a1a', '#d8b870', '#fff0c8'] },
  darkmoon:     { n: '暗月', d: '月光劍浪經過的地方留下冷月光（2.5 秒），踩到的敵人變慢', cols: ['#23206e', '#8aa0ff', '#eef4ff'] },
  elfbow:       { n: '王之箭', d: '每第 6 箭多射一支金色大箭，第一次打中就分裂成 3 支', cols: ['#8a6a10', '#ffe08a', '#ffffff'] },
  elfrapier:    { n: '月痕', d: '連刺同一個敵人疊月痕（頭上的小月亮），5 層時月光爆發（攻擊力 150%，必定暴擊）', cols: ['#2a3a7a', '#a8c4ff', '#ffffff'] },
  elfblades:    { n: '螢火', d: '打中有機會放出螢火蟲（最多 8 隻），飄一下再衝向附近的敵人（攻擊力 40%）', cols: ['#3a5a10', '#c8f060', '#f8ffc0'] },
};

/* ================= 獨特防具 / 飾品 =================
   新制（data/gear.ts）：沒有物品等級。防具的防禦 / 生命看類型（法袍 = 輕、皮甲 = 中、鎖甲 = 重），
   eff = 額外效果（跟一般飾品同一套，數值比較高）。地城 Boss 一定掉一件（地城定義裡的 sig），主線 / 區域 Boss 也各有一件。
   存檔只記 ug = 編號，數值改這裡就會套用到舊存檔。 */
export interface UniqueGearDef { type: 'robe' | 'leather' | 'mail' | 'ring' | 'amulet'; name: string; eff: Record<string, number>; lore: string; from: string }
export const UG: Record<string, UniqueGearDef> = {
  /* 流派飾品（world/secrets.ts 的寶箱）：改變打法，不是加數字 */
  shadowbell:  { type: 'amulet', name: '月影之鈴', eff: { dodgeCut: 120 }, lore: '精靈王的刺客戴的鈴鐺。搖起來沒有聲音——聽見的人，已經被穿過去了。', from: '精靈王國・王座後面的密室' },
  bloodpact:   { type: 'ring', name: '血契之戒', eff: { bloodSkill: 10 }, lore: '熔岩裡撈出來的一枚黑戒。戴上它，力氣就不用等，只要付得起。', from: '熔岩高地・黑曜石林' },
  knightoath:  { type: 'amulet', name: '守光騎士的誓言', eff: { counter: 60 }, lore: '刻著一行字：「先挨一劍的人，第二劍不會落空。」', from: '骸骨荒地・骸骨墓地' },
  mosscloak:   { type: 'robe', name: '苔綠斗篷', eff: { regen: .6, hpPct: 8 }, lore: '苔蝸王把它披在殼上睡了很多年。上面的苔蘚到現在還活著，會慢慢把傷口補起來。', from: '翠風平原・苔石洞窟' },
  barrowlamp:  { type: 'amulet', name: '守墓人的燈', eff: { killHeal: 4 }, lore: '一盞永遠不能熄的燈，縮成了項鍊那麼小。火光裡偶爾會映出一個陌生人的笑臉。', from: '翠風平原・無名古墓' },
  tideshell:   { type: 'ring', name: '潮音貝殼', eff: { cdr: 15, aspd: 6 }, lore: '貼在耳邊能聽見搖籃曲。唱歌的人好像就在海的另一邊。', from: '翠風平原・潮音石窟' },
  silkmail:    { type: 'leather', name: '蛛絲軟甲', eff: { dodgeAtk: 20, aspd: 5 }, lore: '巢母吐的絲編成的甲，比皮還輕、比鐵還韌。', from: '迷霧森林・蛛巢洞窟' },
  rootheart:   { type: 'amulet', name: '根心護符', eff: { regen: .5, guard: 5 }, lore: '老樹根纏著的一顆種子。握著它的時候，腳底好像也長出了根。', from: '迷霧森林・樹根地穴' },
  sandeye:     { type: 'ring', name: '砂眼指環', eff: { crit: 10 }, lore: '風蝕的岩窟裡，一隻從沒閉過的眼睛化成的石頭。', from: '骸骨荒地・風蝕岩窟' },
  sandwrap:    { type: 'robe', name: '沙王的裹布', eff: { res_wastes: 30, cdr: 10 }, lore: '沙埋神殿裡的王，用這塊布裹著自己睡了一千年。布上寫滿了他沒說完的話。', from: '骸骨荒地・沙埋神殿' },
  magmacore:   { type: 'amulet', name: '熔核護心', eff: { res_lava: 30, hpPct: 6 }, lore: '熔岩隧道最深處的心臟。戴在胸口，冬天也不會冷。', from: '熔岩高地・熔岩隧道' },
  obsidianmail:{ type: 'mail', name: '黑曜鱗甲', eff: { res_lava: 30 }, lore: '黑曜石磨成的鱗片，一片一片縫上去。刀砍上去會發出玻璃一樣的聲音。', from: '熔岩高地・黑曜石窟' },
  icering:     { type: 'ring', name: '冰晶指環', eff: { fxBuild: 60 }, lore: '冰晶洞窟的女王留下的一滴眼淚，結成了戒指。', from: '霜寒雪原・冰晶洞窟' },
  frostplate:  { type: 'mail', name: '霜墓騎士甲', eff: { res_snow: 30, guard: 5 }, lore: '守在霜墓裡的騎士，到死都沒有脫下這副盔甲。甲片裡結著他的呼吸。', from: '霜寒雪原・霜墓' },
  rotleather:  { type: 'leather', name: '腐根皮甲', eff: { res_swamp: 35 }, lore: '腐根洞窟的蛙王蛻下的皮。聞起來很糟，但什麼毒都滲不進來。', from: '幽影沼澤・腐根洞窟' },
  drownpearl:  { type: 'amulet', name: '水鬼的珍珠', eff: { potion: 25, regen: .3 }, lore: '沉沒石窟的水鬼一直握在手裡的珍珠。牠說：這是要還給一個人的。', from: '幽影沼澤・沉沒石窟' },
  lastcrown:   { type: 'amulet', name: '最後的王冠', eff: { atkPct: 10, lowHp: 15 }, lore: '王都最後一位王的王冠，被壓成了一枚墜子。王冠上本來鑲著一顆星星。', from: '骸骨荒地・王城地下墓所' },
  forgeplate:  { type: 'mail', name: '爐心護甲', eff: { guard: 8, stam: 15 }, lore: '熔爐的守護者用自己的爐心鍛成的鎧甲。胸口那一塊，摸起來是溫的。', from: '熔岩高地・熔爐地底遺跡' },
  wardenveil:  { type: 'robe', name: '看守者的面紗', eff: { cdr: 12, fxBuild: 30, hpPct: 6 }, lore: '看守星星的人戴的面紗。透過它看出去，夜空裡的每一顆星星都有名字。', from: '幽影沼澤・沉沒神殿地底' },
  /* 流派核心（world/secrets.ts 的 FIELD：野外地標旁的金色寶箱）：每個流派一件，改變打法的那一條規則 */
  hawkplume:   { type: 'ring', name: '鷹隼之羽', eff: { critCdr: .4, crit: 4 }, lore: '從不失手的獵鷹掉下來的一根羽毛。牠每一次撲擊，都比上一次更快。', from: '翠風平原・殘破村落' },
  ghostveil:   { type: 'amulet', name: '殘影之紗', eff: { afterimage: 150 }, lore: '古樹下撿到的一片薄紗。風吹過去的時候，好像有另一個你留在原地。', from: '迷霧森林・古樹空地' },
  plaguevial:  { type: 'amulet', name: '瘟疫之瓶', eff: { spread: 50, fxBuild: 15 }, lore: '獵人小屋裡一只封得很緊的小瓶。獵人說過：別打開，裡面的東西會自己找下一個。', from: '迷霧森林・獵人小屋' },
  ragethorn:   { type: 'ring', name: '怒棘之心', eff: { rage: 150 }, lore: '紅岩上長出的一圈荊棘，纏成了戒指。被刺得越深，它長得越旺。', from: '骸骨荒地・紅岩石台' },
  giantheart:  { type: 'amulet', name: '巨人的心臟', eff: { quake: 120, charge: 15 }, lore: '熔渣裡挖出來的一顆石頭心臟，比拳頭還大。偶爾還會跳一下，整片地都跟著震。', from: '熔岩高地・熔渣池' },
  thirstfang:  { type: 'ring', name: '渴血之牙', eff: { thirst: 30 }, lore: '沉木林裡一隻不知名野獸的牙。主人越虛弱，它喝得越急。', from: '幽影沼澤・沉木林' },
  // 主線 / 區域 Boss 的獎勵（world/regionBoss.ts 的 reward）
  queenheart:  { type: 'amulet', name: '翠凝之心', eff: { regen: .5, hpPct: 10 }, lore: '鏡湖的水凝成的心，摸起來還在輕輕跳。', from: '翠風平原・鏡湖' },
  rustplate:   { type: 'mail', name: '朽鋼胸甲', eff: { guard: 8 }, lore: '將軍守城守到盔甲都生鏽了，也沒有讓任何人過去。', from: '骸骨荒地・古王城' },
  sporering:   { type: 'ring', name: '孢冠指環', eff: { fxBuild: 40, crit: 4 }, lore: '蘑菇王冠上掉下來的一圈菌絲，戴久了指頭會癢。', from: '迷霧森林・孢子深谷' },
  mossvest:    { type: 'leather', name: '苔甲護胸', eff: { guard: 4, hpPct: 5 }, lore: '巨石陣的守衛身上剝下來的苔，比皮還厚。', from: '翠風平原・巨石陣' },
  duskrobe:    { type: 'robe', name: '薄暮霧衣', eff: { dodgeAtk: 30 }, lore: '女妖的霧織成的衣服。穿上它，連影子都跟不上你。', from: '迷霧森林・霧之石環' },
  ochrering:   { type: 'ring', name: '赭鬃指環', eff: { charge: 40, atkPct: 4 }, lore: '沙暴巨人的一撮鬃毛，纏成了戒指。', from: '骸骨荒地・巨獸骸骨' },
  boilheart:   { type: 'amulet', name: '沸騰之心', eff: { lowHp: 25, res_lava: 15 }, lore: '從熔渣池撈出來的一顆泡泡，到現在還在冒煙。', from: '熔岩高地・熔渣池' },
  wyrmscale:   { type: 'mail', name: '凜翼鱗甲', eff: { res_snow: 30, guard: 4 }, lore: '冰霜飛龍胸口最硬的那幾片鱗。', from: '霜寒雪原・冰封湖' },
  purplering:  { type: 'ring', name: '紫冠指環', eff: { souls: 25, killHeal: 3 }, lore: '毒菇母后的冠。戴著它的人，打倒的東西會變成養分。', from: '幽影沼澤・沉木林' },
  mothcloak:   { type: 'robe', name: '月蛾鱗衣', eff: { evade: 12, dodgeAtk: 20 }, lore: '月蛾女王翅膀上的鱗粉織成的衣服。在月光下，連影子都會變淡。', from: '精靈王國・螢月禁林' },
};
