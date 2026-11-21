// 平衡檢查：每個地區用「玩到那裡時大概的角色」算出生存和擊殺的數字，超出目標範圍的標 ✗
// 用法：npm run balance
//   會開遊戲（headless Chrome），直接用遊戲裡的公式算（calcStats、BEH、bossMul），所以改了數值跑一次就知道。
//
// 假設（每個地區）：等級 = 該地區最高等級；能力值 35% 體魄、40% 力量、25% 耐力；長劍強化到該地區能升到的等級；
//   「好裝」= 中甲強化到該地區的等級 + 飾品欄裝滿（鐵心護符、生命護符、力之戒、鷹眼戒指）；「沒裝」= 只有武器。
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TARGET = { mobGear: [6, 10], bossGear: [5, 8], bossNaked: [3, 4], bossTime: [50, 150], mobKill: [1, 3], under: [2, 4], underTime: [70, 300] };   // under = 比 Boss 低 8 級、穿好裝：被打幾下死 / 打幾秒
const js = `
const I = await imp('data/items'), P = await imp('game/player'), BT = await imp('game/bossTuning'), F = await imp('data/forge');
const pl = P.newPlayer('bal'); const out = [];
const TIERS = [['翠風平原', 5, 2, 1, 2, 6], ['迷霧森林', 10, 4, 2, 2, 10], ['骸骨荒地', 15, 6, 3, 3, 14], ['熔岩高地', 20, 7, 4, 3, 21], ['霜寒雪原', 25, 8, 5, 4, 25], ['幽影沼澤', 30, 10, 5, 4, 30]];
for (const [name, L, wUp, aUp, nT, bossLv] of TIERS) {
  const pts = L - 1; pl.vit = 5 + Math.round(pts * .35); pl.str = 5 + Math.round(pts * .4); pl.end = 5 + (pts - Math.round(pts * .35) - Math.round(pts * .4)); pl.dex = pl.int = pl.luk = 5;
  pl.weapon = I.makeWeapon('sword', wUp);
  const gear = (on) => { pl.armor = on ? I.makeArmor('hunter', aUp) : null; pl.trinkets = on ? ['iron', 'life', 'might', 'hawk'].slice(0, nT).map(k => I.makeTrinket(k)).concat([null, null, null, null]).slice(0, 4) : [null, null, null, null]; P.recalc(pl); };
  const hit = (raw) => Math.max(1, Math.round(raw * (1 - pl.defRed) * (1 - ((pl.tfx || {}).guard || 0) / 100)));
  const B = I.BEH, avg = () => pl.atkPow * (1 + pl.crit / 100 * .8);
  const bossRaw = 38 * BT.bossMul(bossLv), bossHp = { 6: 950, 10: 1700, 14: 2600, 21: 4200, 25: 5600, 30: 7000 }[bossLv] * BT.BOSS_HP;
  const lvOf = () => P.level(pl);
  gear(true); const g = { hp: pl.maxHp, dr: Math.round(pl.defRed * 100), atk: Math.round(avg()), mob: Math.ceil(pl.maxHp / hit(Math.max(B.blade.dmg(L), B.heavy.dmg(L), B.lunge.dmg(L)))), boss: Math.ceil(pl.maxHp / hit(bossRaw)),
    kill: +(B.blade.hp(L) / (avg() / I.WT.sword.cd / pl.aspd)).toFixed(1), bossT: Math.round(bossHp / (avg() / I.WT.sword.cd / pl.aspd * .5)) };   // kill = 一直砍幾秒砍死一隻骷髏；打 Boss 大概一半的時間在出手
  gear(false); const n = { hp: pl.maxHp, boss: Math.ceil(pl.maxHp / hit(bossRaw)) };
  // 低 8 級（能力值少 8 點、其他一樣穿好裝）：等級差讓 Boss 打更痛、你打牠更不痛（bossTuning.ts 的 gapTaken / gapDealt）
  const pts2 = Math.max(0, pts - 8); pl.vit = 5 + Math.round(pts2 * .35); pl.str = 5 + Math.round(pts2 * .4); pl.end = 5 + (pts2 - Math.round(pts2 * .35) - Math.round(pts2 * .4)); gear(true);
  const u = { boss: Math.ceil(pl.maxHp / hit(bossRaw * BT.gapTaken(bossLv, lvOf()))), bossT: Math.round(bossHp / (avg() * BT.gapDealt(lvOf(), bossLv) / I.WT.sword.cd / pl.aspd * .5)) };
  out.push({ name, L, wUp, aUp, nT, bossRaw: Math.round(bossRaw), g, n, u });
}
return out;`;
const look = join(process.cwd(), 'scripts', 'look.mjs'), png = join(mkdtempSync(join(tmpdir(), 'bal-')), 'x.png');
const raw = execFileSync('node', [look, png, js, '480', '300', '1'], { encoding: 'utf8' }).trim().split('\n').filter(l => l.startsWith('[')).pop();
const rows = JSON.parse(raw);
const ok = (v, [a, b]) => (v >= a && v <= b ? '  ' : '✗ ') + v;
console.log('目標：好裝被小怪打 ' + TARGET.mobGear.join('~') + ' 下死、被 Boss 打 ' + TARGET.bossGear.join('~') + ' 下死；沒裝被 Boss 打 ' + TARGET.bossNaked.join('~') + ' 下死；一直砍 ' + TARGET.mobKill.join('~') + ' 秒砍死小怪；打 Boss ' + TARGET.bossTime.join('~') + ' 秒\n');
console.log(['地區', '等級', '武器', '防具', '飾品', '生命', '減傷', '一刀', '小怪幾下死', 'Boss一擊', 'Boss幾下死', '沒裝Boss幾下死', '砍死小怪秒數', '打Boss幾秒', '低8級:Boss幾下死', '低8級:打幾秒'].join('\t'));
for (const r of rows) console.log([r.name, r.L, '+' + r.wUp, '+' + r.aUp, r.nT, r.g.hp, r.g.dr + '%', r.g.atk, ok(r.g.mob, TARGET.mobGear), r.bossRaw, ok(r.g.boss, TARGET.bossGear), ok(r.n.boss, TARGET.bossNaked), ok(r.g.kill, TARGET.mobKill), ok(r.g.bossT, TARGET.bossTime), ok(r.u.boss, TARGET.under), ok(r.u.bossT, TARGET.underTime)].join('\t'));
