/* ================= 主線（碎片化的敘事） =================
   像艾爾登法環 / 黑暗靈魂：沒有「去哪裡、做什麼」的任務清單。故事散在這些地方，要自己拼：
   · 記憶碎片：每顆星核裡封著一段記憶（I～VII）。照劇情時間排序，但打 Boss 的順序是亂的 → 拿到的時候是一片一片、跳著看
   · 傳聞：村民、石碑、Boss 會讓你「聽說」某個地方有什麼。地圖上只畫一個模糊的圈，不給精確位置
   · 石碑、居民的話
   這個檔案只放文字和條件，邏輯在 game/quest.ts。

   QuestCtx：從遊戲狀態判斷（打倒了誰、點了哪個營火、讀過哪塊石碑……），不用另外存。 */

export interface QuestCtx { boss: (id: string) => boolean; wolf: boolean; lit: (id: string) => boolean; found: (sub: string) => boolean; flag: (f: string) => boolean; read: (tablet: string) => boolean }

export const PREMISE = '你在營火旁醒來，帽子上的星星還在發光。你不記得自己是誰——只記得，有什麼東西碎掉了。';

/* ---- 七顆星核 = 七段記憶。mem = 劇情順序（I～VII），跟打 Boss 的順序無關 ---- */
export interface Core { id: string; name: string; mem: number; done: (q: QuestCtx) => boolean; text: string }
export const CORES: Core[] = [
  { id: 'general', name: '星核・骨', mem: 1, done: q => q.boss('general'), text: '王都的觀星塔上，七位看守者輪流守著一顆星。星是活的，夜裡會唱歌。看守者裡有一位戴尖帽的魔女，她最年輕，也最常對著星星說話。' },
  { id: 'mushking', name: '星核・菌', mem: 2, done: q => q.boss('mushking'), text: '魔女發現星星的歌一夜比一夜微弱。「它很痛，」她對其他看守者說，「它想回家。」沒有人相信她。' },
  { id: 'yeti', name: '星核・霜', mem: 3, done: q => q.boss('yeti'), text: '第七夜，魔女獨自爬上觀星塔，解開了繫住星星的七道鎖鏈。她以為，星星會飛回天上。' },
  { id: 'queen', name: '星核・翠', mem: 4, done: q => q.boss('queen'), text: '星星沒有飛走。它掉了下來——碎成七塊，墜進荒野。湖水、菌絲、狼群、骸骨……碰到碎片的東西，全都變了。' },
  { id: 'dragon', name: '星核・焰', mem: 5, done: q => q.boss('dragon'), text: '看守者們追著碎片散去，一個也沒有回來。魔女留在火光裡，把自己剩下的光，分給了一座小小的營火。' },
  { id: 'wolf', name: '星核・牙', mem: 6, done: q => q.wolf, text: '她對營火說：「等我把星星找回來的時候，就叫醒我。」然後她睡著了。營火記得這句話，記了很多很多年。' },
  { id: 'lich', name: '星核・影', mem: 7, done: q => q.boss('lich'), text: '最後的看守者在沉沒的大殿裡等她。「你終於回來了，」他說。可是醒來的你，帽子上的星星和她一模一樣——卻什麼也不記得。' },
];
export const MEM_N = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/* ---- 傳聞：learn = 什麼時候聽到；done = 什麼時候算「解決了」；(tx, ty, r) = 地圖上畫的模糊圈（故意偏一點、畫大一點） ---- */
export interface Rumor { id: string; text: string; src: string; learn: (q: QuestCtx) => boolean; done: (q: QuestCtx) => boolean; tx: number; ty: number; r: number }
export const RUMORS: Rumor[] = [
  { id: 'town', text: '往北走，河的那一邊有人住。', src: '山丘上的石碑', learn: () => true, done: q => q.found('晨風鎮'), tx: 70, ty: 352, r: 18 },
  { id: 'queen', text: '鏡湖的湖心有一座聖堂。晴朗的夜裡，湖水會自己站起來。', src: '晨風鎮的村長', learn: q => q.flag('talk:dawn:村長') || q.read('t10'), done: q => q.boss('queen'), tx: 40, ty: 318, r: 18 },
  { id: 'frag', text: '你撿到的那張舊地圖……晨風鎮有個製圖師，他看得懂這種東西。', src: '自己的直覺', learn: q => q.boss('queen'), done: q => q.flag('given:1'), tx: 62, ty: 346, r: 10 },
  { id: 'wolf', text: '森林東北的岩丘上，有狼每晚朝著星星墜落的方向嚎叫。', src: '晨風鎮的衛兵', learn: q => q.flag('talk:dawn:衛兵') || q.read('t12') || q.boss('queen'), done: q => q.wolf, tx: 296, ty: 282, r: 24 },
  { id: 'mushking', text: '森林深處的深谷裡，所有的蘑菇只聽一個聲音。', src: '晨風鎮的少女', learn: q => q.flag('talk:dawn:少女') || q.read('t19') || q.lit('forest'), done: q => q.boss('mushking'), tx: 220, ty: 336, r: 22 },
  { id: 'general', text: '北方的古王城關上城門很多年了。守城的人，一個也沒有離開。', src: '王城城門的石碑', learn: q => q.read('t14') || q.boss('mushking') || q.lit('castle'), done: q => q.boss('general'), tx: 106, ty: 134, r: 26 },
  { id: 'dragon', text: '高地的火口被粗重的鐵鍊鎖住。鎖住的不是火。', src: '要塞門前的石碑', learn: q => q.read('t16') || q.boss('general'), done: q => q.boss('dragon'), tx: 324, ty: 74, r: 26 },
  { id: 'yeti', text: '雪原東北的山頂上，有一個巨大的白色身影。', src: '霜歌鎮的獵人', learn: q => q.flag('talk:frost:獵人') || q.read('t21') || q.boss('dragon'), done: q => q.boss('yeti'), tx: 594, ty: 40, r: 26 },
  { id: 'lich', text: '沼澤最深處沉著一座大殿。裡面有人，一直在等誰回來。', src: '霜歌鎮的修女', learn: q => q.flag('talk:frost:修女') || q.read('t18') || q.boss('yeti'), done: q => q.boss('lich'), tx: 584, ty: 436, r: 26 },
  { id: 'elf', text: '東岸的海灣對面，有一座月光永遠不落下的白森林。那裡的王，很久沒有走出城門了。', src: '東岸的石碑', learn: q => q.read('t9') || q.found('銀葉城'), done: q => q.boss('elfking'), tx: 340, ty: 446, r: 30 },
];

/* 石碑：散落在各地，走近按 E 閱讀，讀過的會收進「旅程」 */
export const TABLETS = [
  { id: 't0', tx: 122, ty: 568, title: '山丘上的石碑', text: '「醒來的人啊，往北走吧。河的那一邊，風會帶你到有人的地方。」' },
  { id: 't9', tx: 236, ty: 460, title: '東岸的石碑', text: '「海灣的另一邊，有一座白色的森林。星星掉下來的那一夜，那裡的人選擇閉上了眼睛。」' },
  { id: 't1', tx: 34, ty: 376, title: '營火旁的石碑', text: '「迷途的光啊，在這裡休息吧。火會記得你走過的路。」' },
  { id: 't2', tx: 90, ty: 356, title: '殘破村落的石碑', text: '「星墜之夜，村子燒了一整晚。我們往西逃，在風最溫柔的地方蓋了新的鎮。」' },
  { id: 't10', tx: 60, ty: 326, title: '聖堂橋頭的石碑', text: '「聖堂的修女每晚對著湖水祈禱。星墜之夜，湖水回應了——它凝成了一位女王，坐上了聖壇。別在晴朗的夜裡看湖，湖裡的星星會看回來。」' },
  { id: 't11', tx: 184, ty: 462, title: '古哨堡的石碑', text: '「哨兵的命令是：守到換班的人來。換班的人沒有來，青苔先來了。他身上的盔甲，到現在還站著。」' },
  { id: 't3', tx: 366, ty: 384, title: '古樹下的石碑', text: '「古樹記得一切。它說，那顆星不是自己掉下來的。」' },
  { id: 't12', tx: 306, ty: 302, title: '獵宮門前的石碑', text: '「狼群曾經是看守森林的騎士，這座獵宮是他們的家。牠們的王還守在最裡面，朝著星星墜落的方向嚎叫。」' },
  { id: 't19', tx: 232, ty: 346, title: '深谷入口的石碑', text: '「菌絲吃掉了落進谷裡的星光，長出了一頂王冠。從那天起，谷裡的蘑菇只聽一個聲音。」' },
  { id: 't13', tx: 377, ty: 270, title: '學塔門口的石碑', text: '「學者們說：霧是森林的記憶。最後一位學者走進塔裡的霧，再也沒有出來——霧裡多了一個人影。」' },
  { id: 't14', tx: 104, ty: 152, title: '王城城門的石碑', text: '「王都最後一道命令：關上城門，守住光。守城的人，一個也沒有離開。」' },
  { id: 't4', tx: 160, ty: 70, title: '沉沒遺跡的石碑', text: '「觀星者在此記錄：第七夜，星辰的歌聲停止了。」' },
  { id: 't5', tx: 42, ty: 58, title: '墓地的石碑', text: '「這裡長眠著守光的騎士們。他們的將軍沒有閉上眼睛。」' },
  { id: 't15', tx: 118, ty: 264, title: '巨獸骸骨旁的石碑', text: '「這頭巨獸背著王都走了一千年。牠倒下的那天，沙漠從牠的肋骨間長了出來。」' },
  { id: 't6', tx: 300, ty: 180, title: '黑曜石林的石碑', text: '「火從地底湧出，像是大地在替星星哭泣。」' },
  { id: 't16', tx: 337, ty: 102, title: '要塞門前的石碑', text: '「要塞的鐵鍊是為了鎖住龍而打的。龍不是住在火裡。是火跟著龍，從天上一起落下來的。」' },
  { id: 't20', tx: 386, ty: 177, title: '熔爐門口的石碑', text: '「熔爐每打壞一個容器，就把廢渣倒進後院的坑。倒到第七次，坑裡的東西開始自己冒泡了。」' },
  { id: 't7', tx: 546, ty: 156, title: '冰封湖畔的石碑', text: '「湖底沉著一頂尖帽。帽子上的星星，還在發光。」' },
  { id: 't17', tx: 584, ty: 92, title: '山路入口的石碑', text: '「往上走的人，要把名字留在山腳。山頂的風會把名字吹走。」' },
  { id: 't21', tx: 603, ty: 58, title: '城塞門前的石碑', text: '「霜頂城塞的守軍在山頂等光回來。光沒有回來，雪先把他們埋了——然後雪站了起來。」' },
  { id: 't8', tx: 446, ty: 330, title: '沉木林的石碑', text: '「看守星星的人背叛了誰？還是被誰背叛了？」' },
  { id: 't18', tx: 588, ty: 410, title: '孤島營火旁的石碑', text: '「大殿沉進沼澤的那天，看守者沒有逃。他說：我要等她回來。」' },
  { id: 't22', tx: 527, ty: 307, title: '小屋門口的石碑', text: '「巫婆的菇園吃了一小片星光。她說：再等一年就能收成。她沒有等到，菇園自己長大了。」' },
];

/* ================= 打倒 Boss 之後，世界會變 =================
   1. 那個地區的天色亮一點（render/render.ts 用 regionLook()）：REGION_BOSS = 地區編號 → 哪一隻 Boss 倒下就算「解放了」
   2. 鎮民會換新的話（world/towns.ts）：條件成立後，走近的第一次一定先說這句，之後混進他平常的話裡輪流說 */
export const REGION_BOSS: Record<number, (q: QuestCtx) => boolean> = {
  0: q => q.boss('queen'), 1: q => q.boss('mushking'), 2: q => q.boss('general'), 3: q => q.boss('dragon'),
  4: q => q.wolf, 5: q => q.boss('yeti'), 6: q => q.boss('lich'), 8: q => q.boss('elfking'),
};
export const LIFT = .6;                                                // 解放後的黑暗 = 原本的 60%

/* npc = '鎮:名字'（world/towns.ts 的 DEF） */
export interface React { id: string; npc: string; when: (q: QuestCtx) => boolean; line: string }
export const REACTS: React[] = [
  { id: 'r1', npc: 'dawn:村長', when: q => q.boss('queen'), line: '昨晚我又看了一眼鏡湖……湖面上只剩月亮了。謝謝你。' },
  { id: 'r2', npc: 'dawn:衛兵', when: q => q.wolf, line: '狼嚎停了。我站了這麼多年的崗，第一次聽見森林這麼安靜。' },
  { id: 'r3', npc: 'dawn:少女', when: q => q.boss('mushking'), line: '森林裡的蘑菇不發光了耶。有點可惜……可是大家說，這樣比較好。' },
  { id: 'r4', npc: 'dawn:小孩', when: q => q.boss('general'), line: '爺爺說北邊的王城，城門自己打開了。他哭了好久。' },
  { id: 'r5', npc: 'dawn:製圖師', when: q => q.flag('chart:2') && q.flag('chart:3'), line: '你點亮的地方，我一筆一筆描下來了。這張地圖比我師父那張還大。' },
  { id: 'r6', npc: 'dawn:修女', when: q => q.boss('dragon'), line: '東北方的天空不紅了。我還以為，那片火會燒到世界的盡頭。' },
  { id: 'r7', npc: 'frost:獵人', when: q => q.boss('yeti'), line: '山頂的白影不見了。雪……好像下得溫柔一點了。' },
  { id: 'r8', npc: 'frost:修女', when: q => q.boss('lich'), line: '南邊的毒沼開始退了。大殿裡等待的那個人……他等到了嗎？' },
  { id: 'r9', npc: 'frost:小孩', when: q => q.boss('yeti'), line: '媽媽說，現在可以去冰封湖玩了！可是她還是叫我不要去。' },
  { id: 'r10', npc: 'elf:精靈長老', when: q => q.boss('elfking'), line: '王終於閉上了眼睛。月光……落下來了。你看，白樹的葉子在發芽。' },
  { id: 'r11', npc: 'elf:精靈衛兵', when: q => q.boss('elfking'), line: '城門開著，卻沒有人下命令了。我還是每天站在這裡。也許，這就是我選的。' },
  { id: 'r12', npc: 'elf:精靈少女', when: q => q.boss('elfking'), line: '月亮出來了！原來海的那一邊，也看得到同一個月亮。' },
  { id: 'r13', npc: 'dawn:村長', when: q => q.flag('cores:all'), line: '你的帽子……星星亮得我睜不開眼睛。你要去哪裡？……不，別告訴我。' },
  { id: 'r14', npc: 'elf:精靈長老', when: q => q.flag('cores:all'), line: '七顆都回來了。它們想回到最初的地方——北方沙裡，那座觀星的高台。' },
  { id: 'r15', npc: 'dawn:村長', when: q => q.flag('end:home'), line: '昨晚天上多了一顆很亮的星。我總覺得，它在對我們眨眼睛。' },
  { id: 'r16', npc: 'dawn:村長', when: q => q.flag('end:watch'), line: '你回來了啊。……嗯？你的眼神，好像一下子老了好多歲。' },
  { id: 'r17', npc: 'dawn:村長', when: q => q.flag('end:wake'), line: '天上的星星……少了一顆。可是你的帽子，亮得像整片夜空。' },
];

/* ================= 製圖師的「下一張殘頁在哪」 =================
   三個鎮的製圖師都會說（world/statues.ts 的 cartoHint 挑哪一句）。只講地方的樣子，不講 Boss 的名字、不講強弱。
   數字 = 神像 k（哪隻 Boss 掉那張殘頁，見 world/statues.ts 的 DEF）；mark = 殘頁交了、神像還沒去；done = 全部點亮 */
export const CARTO_HINTS: Record<string, string> = {
  1: '我的舊地圖上，鎮的西邊有一片湖，湖心畫著一座小聖堂。那一頁被水泡爛了……湖水拿走的東西，有時候會自己還回來。',
  6: '森林東邊有一座塔，從前是學者觀霧的地方。後來霧不肯散了，像在替誰守著什麼。我的地圖到塔門口，就是一片灰。',
  2: '森林西南的谷地，我怎麼畫都畫不準。地上的菌絲一夜就換一條路——好像底下有誰，在替它們決定方向。',
  3: '北邊荒地的那座古王城，城牆我畫得出來，城裡面畫不出來。守城的人很多年沒換班了，也沒讓任何人進去過。',
  4: '往北的高地上，有一座要塞用鐵鍊把火口圍住。我只描到鐵鍊那裡。再往裡面……紙會先燒起來。',
  5: '雪原最東北的山頂有一座城塞。上去過的人都說，看見雪站了起來。我的地圖到那裡，只剩下白。',
  mark: '我在你的地圖上做的記號，你去過了嗎？神像不會自己走過來。站到它面前，祈禱就好。',
  done: '整片荒野都在這張紙上了。我畫了一輩子都畫不完的東西，你走了一趟就走完了。',
};

/* ================= 結局：七顆星核 → 觀星台（沉沒遺跡）=================
   條件：七顆星核都拿到 + FINAL_GATE（最後的看守者倒下）。之後到北方沙裡的觀星台，把星核放上觀星儀，選一個結局。
   · FINAL_GATE 現在是「沉沒神殿地底的星之看守者（Lv80）」。之後主線 Boss 換人，只要改這一行。
   · 結局選過以後還是可以回觀星台再選一次（看別的結局），世界照常繼續。
   · need = 這個選項什麼時候才會出現（探索得夠深才看得到的結局） */
export const FINAL_GATE = (q: QuestCtx) => q.flag('dgn:temple');
export interface Ending { id: string; pick: string; hint: string; title: string; need?: (q: QuestCtx) => boolean; lines: string[] }
export const ENDINGS: Ending[] = [
  { id: 'home', pick: '送星星回家', hint: '完成她當年沒有完成的事', title: '結局・歸星', lines: [
    '你把七顆星核捧在手心。它們不燙了，像七隻剛睡醒的小鳥。',
    '觀星儀轉了起來。星核一顆一顆合在一起，歌聲越來越清楚。',
    '這一次，沒有鎖鏈了。星星慢慢升起，越過沙丘、越過王城的塔尖，回到很高很高的地方。',
    '帽子上的光一點一點暗下去。你終於想起來：你是她留給營火的那一點光。',
    '光用完了，也沒關係。荒野的夜空，從來沒有這麼亮過。'] },
  { id: 'watch', pick: '留下來守著它', hint: '成為第八位看守者', title: '結局・守星', lines: [
    '你把星核一顆一顆放回觀星儀。它們拼成一顆完整的星，輕輕浮在你面前。',
    '它在唱歌。很小聲，只唱給你一個人聽。',
    '七位看守者都不在了。觀星台上，只剩下你。',
    '你在台階上坐下。這一次，你會聽它說話；它痛的時候，你會第一個知道。',
    '營火在很遠的地方燒著。它等到了你，你也會一直等下去。'] },
  { id: 'wake', pick: '把星星收進帽子裡', hint: '你想起了湖底的那頂尖帽', title: '結局・醒星', need: q => q.read('t7'), lines: [
    '湖底的那頂尖帽，帽子上還在發光的星星——你想起來了。你不是她留下的光。你就是她。',
    '你沒有把星星送走，也沒有把它關起來。你把七顆星核，按進帽子上的那顆星。',
    '很燙。很痛。然後，很安靜。',
    '天上少了一顆星。同一個瞬間，荒野裡的每一座營火都亮了一下。',
    '從今以後，星星不用再回家了。它就在這裡，在你身上，跟你一起走。'] },
];
/* 結局前的兩則傳聞（加進上面的 RUMORS） */
RUMORS.push(
  { id: 'warden', text: '七顆星核在帽子上發燙，卻沒有一顆安靜下來。沼澤神殿的最底下，還有一個人沒有閉上眼睛。', src: '星核的歌聲', learn: q => q.flag('cores:all'), done: FINAL_GATE, tx: 540, ty: 452, r: 26 },
  { id: 'star', text: '北方沙裡的觀星台上，傳來了歌聲。星星想回到最初的地方。', src: '星核的歌聲', learn: q => q.flag('cores:all') && FINAL_GATE(q), done: q => ENDINGS.some(e => q.flag('end:' + e.id)), tx: 156, ty: 66, r: 22 },
);
