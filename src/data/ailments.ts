/* ================= 誰會讓你中什麼狀態（game/status.ts） =================
   數字：frost / bleed = 每打中一下累積多少（滿 100 發作）；其他 = 持續幾秒。
   小怪照種類（冰的會凍、火的會燒、毒菇會毒、骷髏的刀會出血……），精英怪 ×1.6。
   Boss 照主題；另外 Boss 的重擊（砸地、跳壓、衝撞）會暈眩，寫在招式裡（world/bossAI3.ts、bossAI2.ts 的 landHit）。 */
import type { FX } from '../game/status';

const ICE: FX = { frost: 22 }, FIRE: FX = { burn: 2.5 }, TOX: FX = { poison: 4 }, CUT: FX = { bleed: 20 }, WET: FX = { slow: 2 }, SAND: FX = { blind: 2.5 }, WEB: FX = { root: .9 }, HEAVY: FX = { stun: .45 };
export const MOB_FX: Record<string, FX> = {
  slimeI: ICE, wolfS: ICE, golemI: { frost: 30, stun: .45 }, spiderI: ICE, batI: ICE, ghoulI: ICE, wraithI: ICE,
  slimeM: FIRE, golemL: { burn: 3, stun: .45 }, spiderL: FIRE, impL: FIRE, beetleL: FIRE, impF: FIRE, spiderB: FIRE,
  shroom: TOX, shroomP: TOX, frogP: TOX, beetleP: TOX, spiderM: TOX, wraithR: TOX,
  skel: CUT, skelE: CUT, skelS: { bleed: 16, poison: 2 }, ghoulB: CUT, ghoulS: CUT, ghoulK: CUT, ghoulR: CUT, ghoulT: CUT, mimic: { bleed: 30 },
  spiderF: WEB, treant: { root: .8 }, treantS: { root: .9, poison: 3 },
  golem: HEAVY, crabT: { stun: .45, slow: 1.5 }, crabL: { stun: .45, burn: 2 }, crabP: { stun: .45, poison: 3 }, beetleF: HEAVY,
  frogG: WET, frogT: WET, wraithP: WET,
  wraithB: { silence: 3 }, wraithK: { silence: 3 }, wraithT: { silence: 3, slow: 1.5 },
  wraithS: SAND, beetleS: { blind: 1.5 },
};
export function mobFx(kind: string, elite: boolean): FX | undefined {
  const f = MOB_FX[kind]; if (!f || !elite) return f;
  const o: FX = {}; for (const k in f) o[k] = f[k] * 1.6; return o;
}

/* 主線 / 區域 Boss（RBDEF 的 id）+ 狼王 */
export const RB_FX: Record<string, FX> = {
  queen: { slow: 2.5 }, general: { bleed: 30 }, dragon: { burn: 3 }, mushking: { poison: 5 }, yeti: { frost: 32 }, lich: { poison: 5, silence: 2 },
  mossguard: { bleed: 25 }, mistwitch: { blind: 2.5 }, sandgiant: { blind: 2 }, slagmother: { burn: 3 }, frostwyrm: { frost: 32 }, toxqueen: { poison: 6 },
  wolf: { bleed: 28 },
};
/* 地城 Boss（world/dungeonBoss.ts 的 DBOSS key） */
export const DB_FX: Record<string, FX> = {
  snail: { poison: 4 }, warden: { burn: 2.5 }, tidecrab: { slow: 2 }, broodmother: { poison: 4, root: .6 }, rootheart: { root: .8 },
  scorpion: { poison: 5 }, sandking: { blind: 2.5 }, salamander: { burn: 3 }, magmaworm: { burn: 3 }, icequeen: { frost: 30 }, frostknight: { frost: 26, bleed: 14 },
  toadking: { poison: 5 }, drowned: { slow: 2.5 }, captain: { bleed: 30 }, forgeguard: { burn: 3 }, starwarden: { silence: 3, frost: 16 },
};
