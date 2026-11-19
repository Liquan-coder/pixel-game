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
