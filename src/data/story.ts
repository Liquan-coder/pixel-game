/* ================= 主線劇情（草稿，之後可以整份換掉） =================
   這個檔案只放「文字和條件」，邏輯在 game/quest.ts。改世界觀時只要改這裡。

   暫定前提「星墜之夜」：
   很久以前，一顆星星墜落在荒野，碎成七顆「星核」。吞下星核的生物變得巨大又兇暴，
   就是現在各地的強敵。主角是被起始營火喚醒的見習魔女，她身上帶著和星星同樣的光。
   主線 = 一路往外探索、取回七顆星核；石碑和居民的話會慢慢拼出星星墜落的真相（結局待定）。

   step.done(ctx)：這一步完成了沒（看遊戲狀態就能判斷，不用另外存）。
   順序只是「建議」：玩家先打後面的 Boss 也會直接打勾，畫面永遠指向第一個還沒完成的目標。 */

export interface QuestCtx { boss: (id: string) => boolean; wolf: boolean; lit: (id: string) => boolean; found: (sub: string) => boolean; flag: (f: string) => boolean }
export interface Step { id: string; title: string; hint: string; tx: number; ty: number; done: (q: QuestCtx) => boolean; lore?: string; core?: boolean }

export const PREMISE = '星墜之夜過後，荒野裡出現了七顆星核。把它們找回來，就能知道那天晚上發生了什麼。';

export const STEPS: Step[] = [
  { id: 'town', title: '前往晨風鎮', hint: '沿著路往北走，鎮上的人或許知道些什麼。', tx: 62, ty: 130, done: q => q.found('晨風鎮'),
    lore: '晨風鎮是荒野裡最後一座還有人住的小鎮。鎮上的人說，星墜之夜以後，怪物就越來越多了。' },
  { id: 'elder', title: '和晨風鎮的村長談談', hint: '村長就在廣場旁邊。', tx: 60, ty: 127, done: q => q.flag('talk:dawn:村長'),
    lore: '村長說：「那天晚上，天空裂開一道光，碎片落在荒野各處。拿到碎片的東西……都變了。」' },
  { id: 'queen', title: '擊敗史萊姆女王', hint: '翠綠窪地在鎮的東北邊。', tx: 94, ty: 113, done: q => q.boss('queen'), core: true,
    lore: '星核・翠：史萊姆女王體內的星核，摸起來像一塊溫熱的果凍。它在你手中安靜下來了。' },
  { id: 'forest', title: '進入迷霧森林，點燃林間營火', hint: '往東過河，森林裡很暗，小心腳步。', tx: 150, ty: 147, done: q => q.lit('forest') },
  { id: 'mushking', title: '擊敗蘑菇王', hint: '林間營火往南，有一條小路通往孢子深谷。', tx: 150, ty: 173, done: q => q.boss('mushking'), core: true,
    lore: '星核・菌：孢子在星核周圍長成了王冠的形狀。蘑菇王只是想被誰認可吧。' },
  { id: 'wolf', title: '打開巢穴，擊敗狼王', hint: '巢穴在森林中央，門口有一座營火。', tx: 190, ty: 121, done: q => q.wolf, core: true,
    lore: '星核・牙：狼王死前望向天空，像是在等誰回來。' },
  { id: 'general', title: '擊敗骸骨將軍', hint: '骸骨荒地在西北，將軍守在最北邊的墳場。', tx: 24, ty: 14, done: q => q.boss('general'), core: true,
    lore: '星核・骨：將軍的盔甲上刻著一行字：「守住光，直到她回來。」' },
  { id: 'dragon', title: '擊敗熔岩巨龍', hint: '熔岩高地在東北，巨龍在火口深處。', tx: 222, ty: 58, done: q => q.boss('dragon'), core: true,
    lore: '星核・焰：巨龍守著星核，不是為了力量，而是怕它再次墜落。' },
  { id: 'frost', title: '抵達霜歌鎮', hint: '從熔岩高地往東，越過山口就是雪原。', tx: 268, ty: 68, done: q => q.found('霜歌鎮') },
  { id: 'yeti', title: '擊敗雪原巨人', hint: '雪頂祭壇在雪原最北邊。', tx: 326, ty: 24, done: q => q.boss('yeti'), core: true,
    lore: '星核・霜：祭壇上的壁畫畫著一位戴著尖帽的魔女，和你長得很像。' },
  { id: 'lich', title: '擊敗沼澤巫妖', hint: '腐沼祭壇在沼澤深處，霜歌鎮往南。', tx: 322, ty: 168, done: q => q.boss('lich'), core: true,
    lore: '星核・影：巫妖原本是看守星星的人。他說：「你終於回來了。」' },
  { id: 'end', title: '七顆星核都到手了……（待續）', hint: '故事的下一章還在寫。', tx: 30, ty: 165, done: () => false },
];

/* 石碑：散落在各地，走近按 E 閱讀，讀過的會收進「旅程」 */
export const TABLETS = [
  { id: 't1', tx: 34, ty: 160, title: '營火旁的石碑', text: '「迷途的光啊，在這裡休息吧。火會記得你走過的路。」' },
  { id: 't2', tx: 90, ty: 140, title: '殘破村落的石碑', text: '「星墜之夜，村子燒了一整晚。我們往西逃，在風最溫柔的地方蓋了新的鎮。」' },
  { id: 't3', tx: 205, ty: 172, title: '古樹下的石碑', text: '「古樹記得一切。它說，那顆星不是自己掉下來的。」' },
  { id: 't4', tx: 80, ty: 48, title: '沉沒遺跡的石碑', text: '「觀星者在此記錄：第七夜，星辰的歌聲停止了。」' },
  { id: 't5', tx: 38, ty: 36, title: '墓地的石碑', text: '「這裡長眠著守光的騎士們。他們的將軍沒有閉上眼睛。」' },
  { id: 't6', tx: 200, ty: 40, title: '熔岩裂谷的石碑', text: '「火從地底湧出，像是大地在替星星哭泣。」' },
  { id: 't7', tx: 312, ty: 86, title: '冰封湖畔的石碑', text: '「湖底沉著一頂尖帽。帽子上的星星，還在發光。」' },
  { id: 't8', tx: 276, ty: 156, title: '沉木林的石碑', text: '「看守星星的人背叛了誰？還是被誰背叛了？」' },
];
