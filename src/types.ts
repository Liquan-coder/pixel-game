// 遊戲主要資料的「形狀」。
// 寫下來的好處：打錯屬性名稱（例如 pl.hpp）、或把敵人當成玩家傳進去時，編輯器會直接標紅。

export type Slot = 'weapon' | 'armor' | 'trinket' | 'seal';

/** 裝備：武器、防具、飾品共用 */
export interface Item {
  id: number;
  slot: Slot;
  type: string;                   // 圖示 / 動作：WT 的 key、'robe' | 'leather' | 'mail'、'ring' | 'amulet'、'seal'
  ilvl: number;                   // 舊存檔才有（物品等級，新制已經不用）
  up?: number;                    // 強化等級：武器 +0 ～ +10、防具 +0 ～ +5（data/forge.ts）
  uq?: string;                    // 獨特武器的編號（data/uniques.ts）
  ug?: string;                    // 獨特防具 / 飾品的編號（data/uniques.ts 的 UG）
  ak?: string;                    // 一般防具的編號（data/gear.ts 的 ARMORS）
  tk?: string;                    // 一般飾品的編號（data/gear.ts 的 TRINKETS）
  fx?: string;                    // 刻印效果：裝在一般武器上，或刻印道具本身（game/weaponFx.ts）
  rarity: number;                 // 只決定顏色：0 一般、2 地區 / 飾品、3 刻印、4 獨特
  name: string;
  aff: Record<string, number>;    // 只有獨特武器有固定詞綴（例如 { crit: 5 }）
  atk?: number;                   // 只有武器有
  def?: number;                   // 只有防具有
  hp?: number;                    // 只有防具有
}

/** pl.timers 裡的延遲動作：t 秒後執行 fn */
export interface Timer { t: number; fn: () => void }

/** 玩家 */
export interface Player {
  id: string;                     // 'local' = 這台裝置的玩家；連線時是其他玩家的 id

  // 位置、外觀
  x: number; y: number; r: number;
  face: number;                   // 面向角度（弧度）
  flip: boolean; anim: number; moving: boolean;
  leanX?: number; leanY?: number;

  // 數值
  hp: number; maxHp: number; st: number; maxSt: number; stDelay: number;
  vit: number; str: number; end: number;          // 體魄 / 力量 / 耐力
  dex: number; int: number; luk: number;          // 敏捷 / 智識 / 幸運（見 data/attrs.ts）
  souls: number; gold: number; pot: number;
  tears: number; freePts: number;   // 重生水滴的數量；用了之後還沒分配回去的點數（算在等級裡）
  mats: Record<string, number>;   // 強化素材：{ mat1: 3, core: 1, … }（data/forge.ts）

  // 裝備
  inv: Item[];
  weapon: Item; armor: Item | null; trinkets: (Item | null)[];   // 飾品欄 4 格（開放幾格見 menus.ts 的 tSlots）

  // recalc() 依照裝備算出來的
  def: number; defRed: number; crit: number; ls: number; aspd: number; cdr: number; atkPow?: number;
  tfx?: Record<string, number>;   // 防具 + 飾品的效果加總（data/gear.ts 的 EFF）
  acls?: string;                  // 身上防具的類型：'light' | 'medium' | 'heavy'
  dodgeAtkT?: number;             // 「瞬移後下一擊加傷」到什麼時候（G.time）
  counterT?: number;              // 反擊之誓：被打中後「下一擊必定暴擊」到什麼時候（G.time）
  // 流派（game/builds.ts）
  dodgeReady?: number; dodgeBuf?: number;          // 下一次能瞬移的時間、後搖中按的瞬移（記到什麼時候）
  dodgeAt?: number; dodgeX?: number; dodgeY?: number; dodgeCost?: number; pdDone?: boolean;   // 這次瞬移：開始時間、起點、花了多少體力、完美閃避觸發過了沒
  critNext?: number;              // 完美閃避後「下一擊必定暴擊」到什麼時候
  rage?: number; rageT?: number;  // 反傷流：累積的怒氣、到什麼時候消失
  thirstAcc?: number; thirstT?: number; ccT?: number;
  bowAuto?: boolean;              // 蓄力弓放開得太早：自動拉到 0.3 秒再射（game/playerUpdate.ts）   // 吸血流的回血數字（合在一起顯示）、暴擊流上一次減冷卻的時間
  cutSet?: Set<any> | null;       // 月影之鈴：這次瞬移已經砍過的敵人
  healT0?: number; healN?: number; // 鐮刀收割：這一次技能已經回了幾次血

  // 倒數計時（秒），大於 0 代表還在冷卻/持續中
  atkCd: number; skillCd: number; iframe: number; hurt: number; dodge: number; drink: number;
  skillLock: number; aimLock: number; spin: number; thrust: number; slam: number;
  blinkIn?: number; comboT?: number; atkBuf?: number;
  healGlow?: number;                  // 喝完藥水：身上綠光還剩幾秒（render/player.ts 畫外框）
  axeN?: number; axeSide?: boolean;   // 戰斧：連續砍中幾下（越砍越快）、這一下往哪邊掃
  moonN?: number;                     // 暗月大劍：存了幾層月光
  rapT?: Enemy; rapN?: number;        // 細劍：正在連刺哪一隻、刺了幾下
  wheelT?: number;                    // 雙頭刀風車轉到什麼時候（G.time）
  safeX?: number; safeY?: number;     // 最後一次站在 Boss 區外面的位置（死在 Boss 區時，掉的那包放這裡）

  // 星狼（坐騎，game/mount.ts）
  ride?: boolean;                     // 正騎著
  rideT?: number;                     // 呼喚中：還剩幾秒騎上去
  rideIn?: number;                    // 剛騎上：星狼從白光裡浮現還剩幾秒
  rideDrop?: number;                  // 剛跳下來：人從狼背落到地上還剩幾秒
  rideRun?: number;                   // 奔跑步伐進度 0～1（挑奔跑動畫的哪一格）

  // 速度
  kx: number; ky: number;         // 被擊退
  dvx: number; dvy: number;       // 瞬移

  // 動作狀態（戰鬥中才會出現）
  swing: any; dash: any; lunge?: any;              // 形狀依武器不同，先用 any
  timers: Timer[];
  combo?: number;
  charging?: boolean; charge?: number; chargeLv?: number; chargeHold?: number; chargeArm?: boolean;
  wHist?: number[][] | null; wRec?: number; wRecD?: number; wFrom?: number; wTy?: number; wRot?: number;   // 武器殘影、收招（wRot = 剛剛那一下往哪邊轉）

  // 異常狀態（game/status.ts）：冰凍、暈眩、中毒……沒中過就是 undefined
  sx?: import('./game/status').Status; silT?: number;   // silT = 上次跳「被封印了」提示的時間

  // 死亡
  dead: boolean;
  deathT: number;                 // 倒下後經過幾秒（到 2.6 秒重生）
}

/** 敵人、區域 Boss、狼王。
 *  欄位很多、而且每種 AI 會自己加欄位，所以先只寫共通的，其餘用 [key: string]: any 放行。 */
export interface Enemy {
  x: number; y: number; r: number;
  hp: number; maxHp: number;
  kind: string;
  state: string;                  // 狀態機目前的狀態：'idle'、'chase'、'biteWind'…
  dead?: boolean;
  boss?: boolean;                 // 狼王與區域 Boss
  rb?: boolean;                   // 區域 Boss
  tgt?: Player;                   // 這一幀瞄準的玩家
  [key: string]: any;
}

/** 營火 */
export interface Camp {
  id: string; name: string;
  tx: number; ty: number;         // 格子座標
  lit?: boolean;                  // 點燃了沒
  x?: number; y?: number;         // 像素座標（載入時由 tx/ty 算出來）
  dg?: string;                    // 地城裡的營火：哪一座地城（world/dungeons.ts 生成時加進 CAMPS）
}
