// 遊戲主要資料的「形狀」。
// 寫下來的好處：打錯屬性名稱（例如 pl.hpp）、或把敵人當成玩家傳進去時，編輯器會直接標紅。

export type Slot = 'weapon' | 'armor' | 'trinket';

/** 裝備：武器、防具、飾品共用 */
export interface Item {
  id: number;
  slot: Slot;
  type: string;                   // WT / AT / TT 的 key，例如 'sword'、'robe'、'ring'
  ilvl: number;                   // 物品等級（只有防具 / 飾品用；武器是 0）
  up?: number;                    // 武器強化等級 +0 ～ +10（data/forge.ts）
  uq?: string;                    // 獨特武器的編號（data/uniques.ts）
  ug?: string;                    // 獨特防具 / 飾品的編號（data/uniques.ts 的 UG）
  fx?: string;                    // 刻印效果（史詩以上，game/weaponFx.ts）
  rarity: number;                 // 0 普通 ～ 4 傳說
  name: string;
  aff: Record<string, number>;    // 詞綴，例如 { crit: 5, hp: 20 }
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
  mats: Record<string, number>;   // 強化礦石：{ ore1: 3, ore2: 0, … }

  // 裝備
  inv: Item[];
  weapon: Item; armor: Item | null; trinket: Item | null;

  // recalc() 依照裝備算出來的
  def: number; defRed: number; crit: number; ls: number; aspd: number; cdr: number; atkPow?: number;

  // 倒數計時（秒），大於 0 代表還在冷卻/持續中
  atkCd: number; skillCd: number; iframe: number; hurt: number; dodge: number; drink: number;
  skillLock: number; aimLock: number; spin: number; thrust: number; slam: number;
  blinkIn?: number; comboT?: number; atkBuf?: number;

  // 速度
  kx: number; ky: number;         // 被擊退
  dvx: number; dvy: number;       // 瞬移

  // 動作狀態（戰鬥中才會出現）
  swing: any; dash: any; lunge?: any;              // 形狀依武器不同，先用 any
  timers: Timer[];
  combo?: number;
  charging?: boolean; charge?: number; chargeLv?: number; chargeHold?: number; chargeArm?: boolean;
  wHist?: number[][] | null; wRec?: number; wRecD?: number; wFrom?: number; wTy?: number; wRot?: number;   // 武器殘影、收招（wRot = 剛剛那一下往哪邊轉）

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
}
