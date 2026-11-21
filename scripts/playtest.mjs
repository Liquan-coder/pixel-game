// 自動試玩測試：開 headless Chrome，直接 import 遊戲模組，把大部分的程式路徑都跑一遍
// （所有武器、所有小怪、所有 Boss、選單、寶箱、雙人目標、存讀檔、死亡重生）
//
// 用法：npm run playtest
//   會自己開一個全新的 Vite 伺服器（隨機 port），測完就關掉。
//   為什麼不用你開著的 npm run dev？跑很久的伺服器在檔案改過後，會在網址加 ?t=時間戳，
//   測試 import 的模組就跟遊戲用的不是同一份，會出現「找不到 queen」這種假失敗。
//   也可以指定網址：npm run playtest -- http://localhost:5173/
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createServer } from 'vite';

let server = null, url = process.argv[2];
if (!url || url === '-') {                                          // 沒指定網址 → 自己開一個乾淨的伺服器
  server = await createServer({ logLevel: 'error', server: { port: 0, strictPort: false } });
  await server.listen(); url = server.resolvedUrls.local[0];
}
const port = 9334;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--mute-audio',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, 'about:blank'], { stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { await wait(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const pageErrors = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await wait(3000);

const pageScript = async () => {
  const log = [], fails = [];
  const imp = p => import(`/src/${p}.ts`);
  const { G } = await imp('core/state');
  const { WT, makeItem } = await imp('data/items');
  const ITEMS = await imp('data/items'), PLAYER = await imp('game/player');
  const { recalc, pressed, held, input, newPlayer, resetPlayers } = await imp('game/player');
  const BOSS = await imp('game/boss');
  const { update } = await imp('game/worldUpdate');
  const { render } = await imp('render/render');
  const { renderMini, renderBigMap } = await imp('render/map');
  const { updateHUD, setMenu } = await imp('ui/hud');
  const { ARENA, CAMPS, TS } = await imp('world/map');
  const RB = await imp('world/regionBoss');
  const { canSee } = await imp('game/collision');   // 用命名空間讀，才會拿到最新的 rbs
  const { damageEnemy, hurtPlayer } = await imp('game/combat');
  const { serialize, applySave, save, loadSave } = await imp('game/save');
  const { startGame } = await imp('main');
  const menus = await imp('ui/menus');
  const shop = await imp('ui/shop');
  const await0 = { chests: await imp('world/chests'), towns: await imp('world/towns'), quest: await imp('game/quest'), story: await imp('data/story'), map: await imp('world/map'), forge: await imp('data/forge'), fx: await imp('game/weaponFx'), items: await imp('data/items'), uq: await imp('data/uniques'), enemies: await imp('game/enemies'), status: await imp('game/status'), bt: await imp('game/bossTuning'), ai3: await imp('world/bossAI3'), coll: await imp('game/collision'), pause: await imp('ui/pause'), puz: await imp('world/puzzles'), mech: await imp('world/bossMech'), statues: await imp('world/statues') };

  const imp0 = { map: await imp('render/map'), dg: await imp('world/dungeons'), input: await imp('ui/interact'), inp: await imp('ui/input'), hud: await imp('ui/hud'), title: await imp('ui/title') };
  const step = (n, opts = {}) => {
    for (let i = 0; i < n; i++) {
      if (opts.god && G.me) { G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; }
      if (opts.atkEvery && i % opts.atkEvery === 0) pressed.atk = true;
      update(1 / 60); render(); updateHUD();
      if (opts.god && G.me && G.me.dead) { G.me.dead = false; G.me.hp = G.me.maxHp; }   // 無敵：等級差讓高等怪一下就打死 1 級的測試角色 → 倒下就馬上扶起來（不然會重生回營火）
      for (const k in pressed) pressed[k] = false;
    }
    renderMini();
  };
  const run = (name, fn) => { if (G.me && G.me.dead) { log.push('  （' + name + ' 開始前角色是倒下的 → 先扶起來）'); G.me.dead = false; } if (G.me) { G.me.hp = G.me.maxHp; G.me.iframe = 0; }
    try { fn(); log.push('✓ ' + name); } catch (e) { fails.push(`✗ ${name}: ${e.stack.split('\n').slice(0, 4).join(' | ')}`); } };
  const tp = (x, y) => { G.me.x = x; G.me.y = y; };

  run('開始新遊戲', () => { startGame(false); step(30); });

  for (const type of Object.keys(WT)) run(`武器 ${type}：普攻/蓄力/技能/瞬移/喝藥`, () => {
    G.me.weapon = makeItem(type, 5, 3); G.me.weapon.slot = 'weapon'; recalc(G.me);
    const e = G.enemies.filter(e => !e.dead && !e.rb).sort((a, b) => Math.hypot(a.x - G.me.x, a.y - G.me.y) - Math.hypot(b.x - G.me.x, b.y - G.me.y))[0];
    tp(e.x - 14, e.y);
    pressed.atk = true; step(25, { god: true });
    held.atk = true; step(70, { god: true }); held.atk = false; step(15, { god: true });
    G.me.skillCd = 0; pressed.skill = true; step(60, { god: true });
    input.mx = 1; pressed.dodge = true; step(25, { god: true }); input.mx = 0;
    G.me.hp = 10; G.me.pot = Math.max(1, G.me.pot); pressed.pot = true; for (let k = 0; k < 60; k++) { G.me.iframe = 1; step(1); }   // 喝藥時不能被怪打死（不然測不到回血）
    if (G.me.hp <= 10) throw new Error('喝藥水沒有回血（hp ' + G.me.hp + '）');
    step(30); G.me.st = 60; G.me.atkCd = 0; pressed.atk = true; held.atk = true; step(25);       // 按住攻擊：先揮一刀，然後開始蓄力
    if (!G.me.charging) throw new Error('按住攻擊沒有開始蓄力');
    const st0 = G.me.st; step(40); const stHold = G.me.st;
    if (stHold > st0 + .5) throw new Error('蓄力時體力還在回（' + st0.toFixed(1) + ' → ' + stHold.toFixed(1) + '）');
    held.atk = false; step(3); if (G.me.st > stHold - 15) throw new Error('放出蓄力沒有扣體力（' + stHold.toFixed(1) + ' → ' + G.me.st.toFixed(1) + '）');
    step(40, { god: true });
  });

  run('每種小怪都打一輪', () => {
    G.me.weapon = makeItem('sword', 30, 4); G.me.weapon.slot = 'weapon'; recalc(G.me);
    const SP = (await0.map).spawns, kinds = new Map(); for (const sp of SP) if (sp.alive && !kinds.has(sp.kind)) kinds.set(sp.kind, sp);   // 怪物只在玩家附近生成：從生成點找每一種，走過去
    log.push('  小怪種類: ' + [...kinds.keys()].join(', ') + '（生成點 ' + SP.length + '，目前在場上 ' + G.enemies.length + '）');
    for (const sp of kinds.values()) { tp(sp.x - 30, sp.y); step(15, { god: true }); if (!sp.ent && sp.alive) throw new Error(sp.kind + '：走到旁邊卻沒有生成'); step(225, { god: true, atkEvery: 12 }); }
    if (G.enemies.length > 160) throw new Error('場上的怪物太多（沒有只在附近生成）：' + G.enemies.length);
  });

  for (const id of Object.keys(RB.RBDEF)) run(`區域 Boss ${id}：一階段 → 二階段 → 擊殺`, () => {
    const e = RB.rbs.find(b => b.id === id); if (!e) throw new Error('找不到 ' + id);
    tp(e.def.x, e.def.y + 40); step(200, { god: true });
    if (e.state === 'sleep') throw new Error('Boss 沒有醒來，state=' + e.state);
    const MC = await0.mech, M = MC.mechOf(e);
    if (M) {                                                            // 機制：66% 發動 → 打不到 → 打碎四個物件 → 破綻
      e.hp = e.maxHp * .6; let k = 0; while (!e.mech && k++ < 600) step(1, { god: true }); if (!e.mech) throw new Error('血量 60% 機制沒發動（' + M.kind + '）state=' + e.state);
      const h0 = e.hp; damageEnemy(G.me, e, 5, G.me.x, G.me.y); if (e.hp !== h0) throw new Error('機制中還打得到 Boss');
      if (MC.MECH && M.kind !== 'shield' && !e.hidden) throw new Error('鑽地 / 升空時 Boss 還看得到');
      step(30, { god: true });
      for (const o of e.mech.objs) for (let i = 0; i < 3; i++) damageEnemy(G.me, o, 1, o.x, o.y + 1);
      step(2, { god: true }); if (e.mech) throw new Error('四個物件打碎了機制沒結束');
      if (!(e.mStun > 0)) throw new Error('解開機制沒有破綻');
      const h1 = e.hp; damageEnemy(G.me, e, 5, e.x, e.y + 20); if (!(e.hp < h1)) throw new Error('破綻時打不到 Boss');
      log.push('  ' + e.def.name + '：' + ({ burrow: '鑽地', sky: '升空', shield: '護盾' })[M.kind] + ' → ' + M.name + ' ×4 → 破綻');
      e.mi = 9; step(260, { god: true });
    }
    e.hp = e.maxHp * .4; step(400, { god: true, atkEvery: 15 });
    if (!e.dead) { e.hp = 1; e.immune = false; e.hidden = false; damageEnemy(G.me, e, 5, e.x, e.y + 20); step(120, { god: true }); }
    if (!e.dead) throw new Error('Boss 沒死');
  });

  run('狼王：甦醒 → 二階段 → 擊殺', () => {
    tp((ARENA.x0 + ARENA.x1) / 2 * TS, (ARENA.y0 + ARENA.y1) / 2 * TS); step(200, { god: true });
    if (!G.B || G.B.state === 'sleep') throw new Error('狼王沒醒');
    G.B.hp = G.B.maxHp * .45; step(600, { god: true, atkEvery: 15 });
    log.push('  狼王二階段後: ' + (G.B ? 'state=' + G.B.state + ' phase=' + G.B.phase : '已被擊殺'));
    if (G.B) { G.B.hp = 1; damageEnemy(G.me, G.B, 5, G.me.x, G.me.y); step(120, { god: true }); }
    if (!G.bossDead) throw new Error('狼王沒死');
  });

  run('攻擊鍵互動：靠近裝備 = 撿起、靠近營火 = 休息、被怪追 = 照樣攻擊', () => {
    const { readInput } = imp0.inp, HUD = imp0.hud; setMenu(null);
    const c = CAMPS[0]; tp(c.x, c.y + 16); G.enemies = []; G.drops = []; step(2);
    const it = makeItem(WT.sword ? 'sword' : Object.keys(WT)[0], 1); const n0 = G.me.inv.length;
    G.drops.push({ x:G.me.x + 4, y:G.me.y, z:0, vz:0, vx:0, vy:0, item:it, t:0, warned:false }); step(1);
    if (document.getElementById('bAtkTxt').textContent !== '撿起') throw new Error('靠近裝備時攻擊鍵沒變「撿起」：' + document.getElementById('bAtkTxt').textContent);
    pressed.atk = true; readInput(); const sw = pressed.atk; step(1);
    if (sw) throw new Error('撿東西那一下還是揮刀了');
    if (G.me.inv.length !== n0 + 1) throw new Error('按攻擊鍵沒撿起裝備');
    if (document.getElementById('bAtkTxt').textContent !== '休息') throw new Error('靠近營火時攻擊鍵沒變「休息」：' + document.getElementById('bAtkTxt').textContent);
    pressed.atk = true; readInput(); step(1);
    if (HUD.openMenu !== 'camp') throw new Error('按攻擊鍵沒在營火休息，openMenu=' + HUD.openMenu);
    setMenu(null); step(1);
    const e = { state:'chase', x:G.me.x + 30, y:G.me.y }; G.enemies.push(e);
    pressed.atk = true; readInput();
    if (!pressed.atk) throw new Error('被怪追的時候攻擊鍵被拿去互動了');
    for (const k in pressed) pressed[k] = false; G.enemies = []; step(1);
    if (document.getElementById('bAtkTxt').textContent !== '休息') throw new Error('怪清掉後沒變回「休息」');
  });

  run('選單：角色/地圖/營火/商店', () => {
    menus.toggleInv(); step(2);
    for (const b of document.querySelectorAll('#invMenu button')) { b.click(); step(1); }
    menus.toggleInv(); menus.toggleMap(); renderBigMap(); step(2); menus.toggleMap();
    menus.restAt(CAMPS[0]); step(2);
    const lv0 = G.me.vit + G.me.str, s0 = G.me.souls = 100000;
    document.querySelector('#campMenu [data-stat=vit]').click(); document.querySelector('#campMenu [data-stat=str]').click(); document.querySelector('#campMenu [data-stat=str]').click();
    document.querySelector('#campMenu [data-dec=str]').click();
    if (G.me.souls !== s0 || G.me.vit + G.me.str !== lv0) throw new Error('還沒按確定就扣了魂晶 / 加了點');
    document.querySelector('#campMenu [data-confirm]').click();
    if (G.me.vit + G.me.str !== lv0 + 2 || G.me.souls >= s0) throw new Error('按確定後沒有升 2 級：' + (G.me.vit + G.me.str - lv0));
    log.push('  營火升 2 級花了 ' + (s0 - G.me.souls) + ' 魂晶');
    for (const b of document.querySelectorAll('#campMenu [data-tab], #campMenu button')) { b.click(); step(1); }
    setMenu(null);
    shop.openShop(); step(2);
    for (const b of document.querySelectorAll('#shopMenu [data-stab], #shopMenu button')) { if (!b.hasAttribute('data-close')) { b.click(); step(1); } }
    setMenu(null); step(2);
    const towns = await0.towns; const sm = towns.NPCS.find(n => n.smith); tp(sm.x, sm.y + 12); step(2);
    if (!towns.nearSmith()) throw new Error('站在鐵匠旁邊卻沒偵測到');
    shop.openShop(towns.nearSmith()); step(2);
    if (!sm.stock || sm.stock.length < 5) throw new Error('鐵匠沒有貨');
    for (const b of document.querySelectorAll('#shopMenu [data-s]')) { b.click(); step(1); }
    setMenu(null); step(2);
  });

  run('雙人：狼王會去打離牠比較近的隊友', () => {
    BOSS.resetBoss(); G.bossDead = false; BOSS.resetBoss();            // 讓狼王復活
    const p2 = newPlayer('p2'); G.players.push(p2);
    const cx = (ARENA.x0 + ARENA.x1) / 2 * TS, cy = (ARENA.y0 + ARENA.y1) / 2 * TS;
    tp(cx - 60, cy + 40); p2.x = cx; p2.y = cy;                          // 隊友站中間，我站遠一點
    const myHp = G.me.hp; let p2Hurt = false;
    for (let i = 0; i < 600 && !p2Hurt; i++) { G.me.hp = myHp; step(1); if (p2.hp < p2.maxHp) p2Hurt = true; p2.hp = Math.max(p2.hp, 50); }
    if (!G.B || G.B.tgt !== p2) throw new Error('狼王的目標不是 p2：' + (G.B?.tgt?.id));
    if (!p2Hurt) throw new Error('p2 沒有被打到');
    log.push('  狼王目標 = ' + G.B.tgt.id + '，p2 有受傷，我的血 ' + G.me.hp + '/' + myHp);
    G.players = [G.me]; step(5);
  });

  run('寶箱：一般寶箱、寶箱怪、存檔記得打開過', () => {
    const CH = (await0.chests).CHESTS;
    log.push('  寶箱數量 ' + CH.length + '（寶箱怪 ' + CH.filter(c => c.mimic).length + '）');
    const c = CH.find(c => !c.mimic && !c.opened); tp(c.x, c.y + 4); step(2);
    const coins = G.coins.length, drops = G.drops.length;
    if (await0.chests.nearChest(G.me) !== c) throw new Error('站在寶箱旁邊卻沒偵測到');
    await0.chests.openChest(G.me, c); step(5);
    if (!c.opened) throw new Error('寶箱沒打開');
    if (G.coins.length <= coins && G.drops.length <= drops) throw new Error('寶箱沒掉東西');
    const m = CH.find(c => c.mimic); tp(m.x, m.y + 4); step(2); await0.chests.openChest(G.me, m); step(3);
    if (!m.foe) throw new Error('寶箱怪沒跳出來');
    m.foe.hp = 1; damageEnemy(G.me, m.foe, 5, G.me.x, G.me.y); step(5);
    if (!m.opened) throw new Error('打倒寶箱怪後寶箱沒算打開');
    save(); const s = loadSave(); m.opened = false; c.opened = false; applySave(s); step(2);
    if (!c.opened || !m.opened) throw new Error('讀檔後寶箱又關起來了');
  });

  run('主線（碎片化）：傳聞、記憶碎片、石碑、旅程', () => {
    const Q = await0.quest, SY = await0.story;
    step(2); if (!Q.rumorsKnown().some(r => r.id === 'town')) throw new Error('一開始沒有「往北走」的傳聞');
    Q.flags.add('talk:dawn:村長'); step(2); if (!Q.rumorsKnown().some(r => r.id === 'queen')) throw new Error('和村長說話後沒有鏡湖的傳聞');
    const t = Q.TAB[0]; tp(t.x, t.y + 6); step(2); if (Q.nearTablet() !== t) throw new Error('站在石碑旁邊卻沒偵測到');
    Q.readTablet(t); step(2); if (!Q.loreRead.has(t.id)) throw new Error('石碑沒有記下來'); setMenu(null);
    menus.toggleMap(); document.querySelector('#mapTabs [data-mt=journal]').click(); step(2);
    const J = document.getElementById('journal'); if (!J.querySelector('.qsteps li') || J.querySelectorAll('.memx').length + J.querySelectorAll('details').length < 7) throw new Error('旅程分頁不完整'); setMenu(null);
    log.push('  傳聞 ' + Q.rumorsKnown().length + ' 則（未解 ' + Q.rumorsOpen().length + '）· 記憶碎片 ' + Q.cores() + '/' + Q.CORE_N);
    if (SY.CORES.map(c => c.mem).sort().join() !== '1,2,3,4,5,6,7') throw new Error('記憶碎片編號不是 I～VII');
  });

  run('地圖：一開始只亮平原 → 殘頁 → 製圖師 → 神像祈禱 → 整片地區亮起來', () => {
    const ST = await0.statues, Q = await0.quest, M = await0.map, towns = await0.towns;
    if (ST.STATUES.length !== 5) throw new Error('神像不是 5 座：' + ST.STATUES.length);
    for (const s of ST.STATUES) if (await0.coll.collides(s.x, s.y + 18, 5) && await0.coll.collides(s.x + 18, s.y, 5) && await0.coll.collides(s.x - 18, s.y, 5)) throw new Error('神像 ' + s.k + ' 四周走不到');
    step(2); if (!Q.flags.has('chart:0')) throw new Error('平原沒有一開始就亮');
    const s1 = ST.STATUES[0], fz = M.REGIONS.findIndex(r => r.key === 'forest'), fi = M.reg.findIndex((r, i) => r === fz && !M.explored[i]);
    if (fi < 0) throw new Error('森林一開始就全亮了');
    Q.flags.delete('given:1'); Q.flags.delete('statue:1'); Q.flags.delete('seen:s1');
    RB.rbDead.add('queen'); step(2); if (!Q.flags.has('frag:1')) throw new Error('打倒史萊姆女王沒拿到地圖殘頁');
    if (ST.statueKnown(s1)) throw new Error('還沒交殘頁，地圖上就有神像');
    const c = towns.NPCS.find(n => n.name === '製圖師'); tp(c.x, c.y + 14); step(2);
    let it = imp0.input.interactTarget(); if (!it || it.btn !== '交出') throw new Error('站在製圖師旁邊沒有「交出」：' + (it && it.btn)); it.run();
    if (!ST.statueKnown(s1)) throw new Error('交了殘頁地圖上還是沒有神像');
    tp(s1.x, s1.y + 18); step(2); it = imp0.input.interactTarget(); if (!it || it.btn !== '祈禱') throw new Error('站在神像旁邊沒有「祈禱」'); it.run(); step(2);
    if (!M.explored[fi]) throw new Error('祈禱後森林沒有亮');
    log.push('  神像：' + ST.STATUES.map(s => s.k + '@' + s.tx + ',' + s.ty).join(' '));
    RB.rbDead.delete('queen'); RB.resetRegionBosses();
  });

  run('更多機關：符文踏板（苔石洞窟）、轉動雕像（潮音石窟）、崩塌石橋（潮音石窟）', () => {
    const PU = await0.puz, Q = await0.quest, P = id => PU.PUZZLES.find(p => p.d.id === id);
    const enter = d => { tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2); G.enemies = []; };
    const leave = d => { G.enemies = []; tp(d.exX, d.exY); step(1); imp0.input.enterDoor(); step(2); };
    // 符文踏板
    const sp = P('moss'); if (!sp || sp.plates.length !== 4 || !sp.stone) throw new Error('苔石洞窟的符文踏板不完整'); Q.flags.delete('puz:moss:fire'); enter(sp.d);
    tp(sp.stone.x, sp.stone.y + 16); step(2); let it = imp0.input.interactTarget(); if (!it || it.btn !== '觸摸') throw new Error('記憶石沒有「觸摸」'); it.run();
    step(Math.ceil(sp.seq.length * .85 * 60) + 10);
    const wrong = sp.plates.findIndex((_, k) => k !== sp.seq[0]); tp(sp.plates[wrong].x, sp.plates[wrong].y + 2); G.me.iframe = 0; step(2); if (sp.step !== 0 || !(sp.plates[0].bad > 0)) throw new Error('踩錯沒有懲罰');
    G.me.dead = false; G.me.hp = G.me.maxHp; tp(sp.stone.x, sp.stone.y + 30); step(30);
    for (const k of sp.seq) { tp(sp.stone.x, sp.stone.y + 30); step(2); tp(sp.plates[k].x, sp.plates[k].y + 2); G.me.iframe = 9; step(2); }
    if (!Q.flags.has('puz:moss:fire')) throw new Error('照順序踩完門沒開（踩到第 ' + sp.step + ' 步）'); leave(sp.d);
    // 轉動雕像
    const so = P('grotto'); if (!so || so.stats.length < 3 || !so.altar) throw new Error('潮音石窟的雕像不完整'); Q.flags.delete('puz:grotto:fire'); step(2); enter(so.d);
    const n = so.stats.length; let guard = 0;                                // 解法：從第一座開始，一直轉到它對準，再換下一座（最後一座會跟著第一座轉，用暴力找）
    const solve = () => { const tryAll = (depth, off) => { if (off.every(o => o === 0)) return []; if (depth === 0) return null;
      for (let i = 0; i < n; i++) { const o2 = [...off]; o2[i] = (o2[i] + 1) % 4; o2[(i + 1) % n] = (o2[(i + 1) % n] + 1) % 4; const r = tryAll(depth - 1, o2); if (r) return [i, ...r]; } return null; };
      for (let dpt = 1; dpt <= 8; dpt++) { const r = tryAll(dpt, [...so.off]); if (r) return r; } return null; };
    const moves = solve(); if (!moves) throw new Error('雕像謎題解不開：' + so.off);
    for (const i of moves) { const s2 = so.stats[i]; tp(s2.x + (s2.want === 1 || s2.want === 3 ? 18 : 0), s2.y + (s2.want === 0 || s2.want === 2 ? 18 : 0)); step(1); it = imp0.input.interactTarget(); if (!it || it.btn !== '轉動') throw new Error('雕像旁邊沒有「轉動」'); it.run(); if (++guard > 20) break; }
    if (!Q.flags.has('puz:grotto:fire')) throw new Error('雕像都對準了門沒開');
    // 崩塌石橋：站在會碎的石頭上 → 裂開 → 掉下去 → 回到起點
    if (!so.crumb.length) throw new Error('潮音石窟沒有崩塌石橋');
    const c = so.crumb[Math.floor(so.crumb.length / 2)]; tp(c.x, c.y + 2); G.me.hp = G.me.maxHp; const h0 = G.me.hp; step(80);
    if (!(G.me.hp < h0) || Math.hypot(G.me.x - so.start.x, G.me.y - so.start.y) > 4) throw new Error('站在石橋上沒有掉下去 / 沒回到起點');
    G.me.dead = false; leave(so.d);
    log.push('  有機關的地城：' + PU.PUZZLES.map(p => p.d.name).join('、'));
  });

  run('強化：鐵匠分頁、素材 + 金幣 → +1、舊存檔武器換算', () => {
    const F = await0.forge, towns = await0.towns, sm = towns.NPCS.find(n => n.smith);
    G.me.weapon = makeItem('sword', 0, 0); recalc(G.me); G.me.mats = { mat1: 5 }; G.me.gold = 1000;
    const a0 = G.me.weapon.atk, p0 = G.me.atkPow;
    tp(sm.x, sm.y + 12); step(2); shop.openShop(towns.nearSmith()); step(1);
    document.querySelector('#forgeTab').click(); document.querySelector('#shopMenu [data-fw]').click(); document.querySelector('#shopMenu [data-forge]').click(); step(1);
    if (G.me.weapon.up !== 1 || G.me.weapon.atk <= a0 || G.me.atkPow <= p0) throw new Error('強化沒有生效：up=' + G.me.weapon.up + ' atk ' + a0 + '→' + G.me.weapon.atk);
    if (G.me.mats.mat1 !== 3 || G.me.gold !== 940) throw new Error('沒有扣素材 / 金幣：' + JSON.stringify(G.me.mats) + ' ' + G.me.gold);
    G.me.mats = {}; if (F.doUpgrade(G.me, G.me.weapon)) throw new Error('沒有素材也能強化');
    setMenu(null);
    const old = { id: 999, type: 'axe', ilvl: 25, rarity: 3, atk: 120, aff: {}, name: '舊斧頭' }; F.migrateWeapon(old);
    if (old.up !== 10 || old.ilvl !== 0) throw new Error('舊武器換算錯誤：' + JSON.stringify(old));
    const mid = { id: 998, type: 'sword', ilvl: 9, rarity: 2, aff: {}, name: '舊劍' }; F.migrateWeapon(mid);
    log.push('  舊武器換算：25 級史詩斧 → +' + old.up + '，9 級稀有劍 → +' + mid.up + '（攻擊 ' + mid.atk + '）');
    G.me.weapon = makeItem('sword', 0, 0); recalc(G.me);
  });

  run('裝備新制：刻印拆裝、飾品欄、防具強化、效果、舊存檔換算', () => {
    const I = ITEMS, F = await0.forge, P = PLAYER; setMenu(null);
    // 刻印：裝上 → 武器有效果；拆下 → 變回道具
    G.me.weapon = makeItem('sword', 0, 0); G.me.inv = [I.makeSeal('bleed')]; recalc(G.me);
    menus.toggleInv(); G.selItem = G.me.inv[0].id; menus.renderInv();
    document.querySelector('#cInfo [data-act="seal"]').click();
    if (G.me.weapon.fx !== 'bleed' || G.me.inv.length) throw new Error('刻印沒有裝上：' + JSON.stringify(G.me.weapon));
    G.selItem = G.me.weapon.id; menus.renderInv(); document.querySelector('#cInfo [data-act="unseal"]').click();
    if (G.me.weapon.fx || G.me.inv[0]?.fx !== 'bleed') throw new Error('刻印沒有拆下來');
    // 飾品：一開始 2 格，第 3 件要換掉一件
    const rb0 = [...RB.rbDead], bd0 = G.bossDead; RB.rbDead.clear(); G.bossDead = false;   // 還沒打倒主線 Boss → 2 格
    if (menus.tSlots() !== 2) throw new Error('一開始飾品欄應該是 2 格：' + menus.tSlots());
    RB.rbDead.add('queen'); RB.rbDead.add('general'); if (menus.tSlots() !== 3) throw new Error('打倒 2 隻主線 Boss 應該變 3 格');
    RB.rbDead.clear(); for (const id of rb0) RB.rbDead.add(id); G.bossDead = bd0; const n = menus.tSlots();
    G.me.inv = [...Array(n).fill(0).map(() => I.makeTrinket('hawk')), I.makeTrinket('might')]; G.me.trinkets = [null, null, null, null];
    for (let k = 0; k < n; k++) { G.selItem = G.me.inv[0].id; menus.renderInv(); document.querySelector('#cInfo [data-act="equip"]').click(); }
    if (G.me.trinkets.filter(Boolean).length !== n) throw new Error('飾品沒有裝滿 ' + n + ' 格');
    G.selItem = G.me.inv[0].id; menus.renderInv();
    if (document.querySelector('#cInfo [data-act="equip"]')) throw new Error('飾品欄滿了還能直接裝');
    document.querySelector('#cInfo [data-act="tswap"]').click();
    if (!G.me.trinkets.some(t => t && t.tk === 'might')) throw new Error('換飾品失敗');
    if (G.me.atkPow <= P.calcStats(G.me, { weapon: G.me.weapon, armor: G.me.armor, trinkets: [] }).atk) throw new Error('力之戒沒有加攻擊');
    // 防具：重甲不會被擊退、強化 +1 防禦變高
    G.me.armor = I.makeArmor('chain'); G.me.str = 12; G.me.end = 10; recalc(G.me);
    const d0 = G.me.def; G.me.mats = { mat1: 2 }; G.me.gold = 500; if (!F.doUpgrade(G.me, G.me.armor)) throw new Error('防具不能強化'); recalc(G.me);
    if (!(G.me.def > d0) || G.me.armor.up !== 1) throw new Error('防具強化沒有生效');
    G.me.iframe = 0; G.me.hp = G.me.maxHp; hurtPlayer(G.me, 10, G.me.x - 10, G.me.y); if (G.me.kx !== 0) throw new Error('重甲還是會被擊退');
    // 地區抗性：在熔岩高地穿燼鱗甲，受到的傷害變少
    G.me.armor = I.makeArmor('ember'); recalc(G.me); const reg0 = G.region;
    G.region = 'plains'; G.me.iframe = 0; G.me.hp = 999; hurtPlayer(G.me, 100, G.me.x, G.me.y + 5); const a1 = 999 - G.me.hp;
    G.region = 'lava'; G.me.iframe = 0; G.me.hp = 999; hurtPlayer(G.me, 100, G.me.x, G.me.y + 5); const a2 = 999 - G.me.hp; G.region = reg0;
    if (!(a2 < a1)) throw new Error('燼鱗甲在熔岩高地沒有減傷：' + a1 + ' / ' + a2);
    // 舊存檔：物品等級 + 詞綴的防具 / 飾品 / 史詩武器 → 新制
    const d = serialize(); d.armor = { id: 1, slot: 'armor', type: 'mail', ilvl: 20, rarity: 3, def: 40, hp: 30, aff: { hp: 90 }, name: '舊鎖甲' };
    d.trinket = { id: 2, slot: 'trinket', type: 'ring', ilvl: 15, rarity: 2, aff: { crit: 8 }, name: '舊戒指' }; delete d.trinkets;
    d.inv = [{ id: 3, slot: 'weapon', type: 'axe', ilvl: 0, up: 4, rarity: 3, fx: 'burn', aff: { crit: 5, lifesteal: 4 }, name: '烈焰戰斧' }]; d.mats = { ore1: 3, ore4: 1 };
    applySave(d);
    if (!G.me.armor.ak || G.me.armor.aff.hp || !G.me.trinkets[0]?.tk || G.me.inv[0].aff.lifesteal || G.me.inv[0].fx !== 'burn' || G.me.mats.mat1 !== 3 || G.me.mats.core !== 1)
      throw new Error('舊存檔換算錯誤：' + JSON.stringify({ a: G.me.armor, t: G.me.trinkets[0], w: G.me.inv[0], m: G.me.mats }));
    G.me.armor = null; G.me.trinkets = [null, null, null, null]; G.me.inv = []; G.me.weapon = makeItem('sword', 0, 0); recalc(G.me); setMenu(null);
  });

  run('刻印效果：出血 / 燃燒 / 寒霜 / 雷鳴 / 噬魂 都會觸發', () => {
    const FX = await0.fx, items = await0.items, out = [];
    for (const fx of FX.FX_KEYS) {
      G.me.weapon = items.makeWeapon('sword', 3); G.me.weapon.fx = fx; recalc(G.me);
      let e = G.enemies.filter(e => !e.dead && !e.rb && !e.chest).sort((a, b) => Math.hypot(a.x - G.me.x, a.y - G.me.y) - Math.hypot(b.x - G.me.x, b.y - G.me.y))[0];
      if (!e) { for (let k = 0; k < 2; k++) G.enemies.push(await0.enemies.makeEnemy('wolf', 10, G.me.x + 20 + k * 20, G.me.y, { alive: true, timer: 0 })); e = G.enemies[G.enemies.length - 2]; }   // 附近剛好沒有怪 → 放兩隻
      tp(e.x - 10, e.y); e.hp = e.maxHp = 1e6; const twin = G.enemies.find(o => o !== e && !o.rb && !o.dead && !o.gone && !o.chest && Math.hypot(o.x - e.x, o.y - e.y) < 200);
      if (fx === 'shock' && twin) { twin.x = e.x + 20; twin.y = e.y; twin.hp = twin.maxHp = 1e6; }
      let hit = false; const tw0 = twin ? twin.hp : 0;
      for (let i = 0; i < 40 && !hit; i++) { if (fx === 'shock' && twin) { twin.x = e.x + 20; twin.y = e.y; } damageEnemy(G.me, e, 1, G.me.x, G.me.y); step(8, { god: true });   // 第二隻怪會走開 → 每次拉回來
        hit = fx === 'bleed' ? e.hp < 1e6 - 40 * G.me.atkPow * 1.2 : fx === 'burn' ? e.burnT > 0 : fx === 'frost' ? (e.frostB || 0) === 0 && i > 2 : fx === 'shock' ? !twin || twin.hp < tw0 : true; }
      if (fx === 'soul') { G.me.hp = 10; e.hp = 1; damageEnemy(G.me, e, 1, G.me.x, G.me.y); step(2); hit = G.me.hp > 10; }
      if (!hit) throw new Error(fx + ' 沒有觸發');
      out.push(fx);
    }
    log.push('  觸發：' + out.join(', '));
    const old = { id: 997, type: 'wolfblade', ilvl: 9, rarity: 4, atk: 40, aff: {}, name: '狼牙雙刃' }; await0.forge.migrateWeapon(old); items.fixWeapon(old);
    if (old.uq !== 'wolfblade' || FX.fxOf(old) !== 'bleed') throw new Error('舊狼牙雙刃沒有變成獨特武器：' + JSON.stringify(old));
    for (const k of Object.keys(await0.uq.UQ)) { const u = items.makeUnique(k); if (!u.atk || u.rarity !== 4 || !FX.fxOf(u)) throw new Error('獨特武器 ' + k + ' 不完整'); }
    G.me.weapon = makeItem('sword', 0, 0); recalc(G.me);
  });

  run('世界地圖：拖曳、縮放、點營火快速傳送', () => {
    const M = imp0.map, cv = document.getElementById('bigmap'); setMenu(null);
    const dst = CAMPS.find(c => c.id === 'dawn'); dst.lit = true; for (const e of G.enemies) e.state = 'idle'; if (G.B) G.B.state = 'sleep'; tp(CAMPS[0].x, CAMPS[0].y + 16);
    menus.toggleMap(); step(1);
    const r = cv.getBoundingClientRect(), ev = (type, x, y, id = 1) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true }));
    const x0 = M.mv.x; ev('pointerdown', 100, 100); ev('pointermove', 160, 100); ev('pointerup', 160, 100);
    if (!(M.mv.x < x0)) throw new Error('拖曳沒有移動地圖');
    const z0 = M.mv.z; cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, clientX: r.left + 50, clientY: r.top + 50, bubbles: true })); if (!(M.mv.z > z0)) throw new Error('滾輪沒有放大');
    M.mv.x = dst.tx + .5; M.mv.y = dst.ty + .5; M.renderBigMap();
    ev('pointerdown', M.mv.w / 2, M.mv.h / 2, 2); ev('pointerup', M.mv.w / 2, M.mv.h / 2, 2);
    if (M.mapSel !== 'dawn') throw new Error('點營火沒有選到：' + M.mapSel);
    const b = document.querySelector('#mapFoot [data-travel]'); if (!b || b.disabled) throw new Error('傳送按鈕不能按：' + document.getElementById('mapFoot').textContent);
    b.click(); step(2);
    if (Math.hypot(G.me.x - dst.x, G.me.y - dst.y) > 40) throw new Error('沒有傳送到晨風鎮營火');
    if (G.lastCamp !== 'dawn') throw new Error('最後休息的營火沒有更新');
  });

  run('地城：進入 → 寶箱被封印 → 打倒 Boss → 招牌裝備 + 金箱 → 休息後 Boss 不再出現 → 離開', () => {
    const D = imp0.dg, CH = await0.chests, Q = await0.quest; setMenu(null);
    const vit0 = G.me.vit; G.me.vit = 80; recalc(G.me); G.me.hp = G.me.maxHp;           // 30 級地城的怪會一擊打倒 1 級角色 → 測試時先把生命加高
    for (const d of D.DUNGEONS) {
      tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1);
      const door = D.nearDoor(G.me); if (!door || door.out) throw new Error(d.id + '：站在入口前沒偵測到門');
      imp0.input.enterDoor(); step(2);
      if (!D.dungeonAt(G.me.x, G.me.y)) throw new Error(d.id + '：沒有傳送進地城');
      Q.flags.delete('dgn:' + d.id); RB.rbDead.delete('dg_' + d.id); RB.resetRegionBosses();          // 前面的「區域 Boss」測試已經打倒過 → 先讓它復活
      const chest = CH.CHESTS.find(c => c.id === 'd_' + d.id); if (!chest) throw new Error(d.id + '：找不到最深處的寶箱');
      chest.opened = false; tp(chest.x, chest.y + 6); step(14); CH.openChest(G.me, chest); if (chest.opened) throw new Error(d.id + '：Boss 還在，寶箱卻打開了');
      if (CH.nearChest(G.me) === chest) throw new Error(d.id + '：Boss 還在，封住的寶箱卻能互動（攻擊鍵會變「打開」）');
      tp(d.portal[0], d.portal[1]); step(1); if (D.nearDoor(G.me)?.portal) throw new Error(d.id + '：Boss 還在，大廳的傳送門卻已經能用');
      const boss = RB.rbs.find(e => e.id === 'dg_' + d.id); if (!boss) throw new Error(d.id + '：找不到地城 Boss');
      tp(boss.def.x, boss.def.y + 30); step(120, { god: true }); if (boss.state === 'sleep') throw new Error(d.id + '：Boss 沒有醒來');
      if (document.getElementById('bossBar').hidden) throw new Error(d.id + '：開打了卻沒有血條');
      boss.mi = 9; boss.hp = boss.maxHp * .45; step(240, { god: true, atkEvery: 15 });   // mi = 9：這個測試不測機制（區域 Boss 的測試有測）
      const k0 = G.drops.length; if (!boss.dead) { boss.hp = 1; boss.immune = boss.hidden = boss.mound = false; /* 鑽地突襲中打不到 → 先讓牠出來 */ damageEnemy(G.me, boss, 5, G.me.x, G.me.y); step(5, { god: true }); }
      if (!boss.dead) throw new Error(d.id + '：Boss 沒死');
      step(1, { god: true }); if (!document.getElementById('bossBar').hidden) throw new Error(d.id + '：Boss 死了血條還在');
      if (!Q.flags.has('dgn:' + d.id)) throw new Error(d.id + '：打倒 Boss 沒有記錄');
      const sig = G.drops.slice(k0).find(x => x.item.ug === d.sig); if (!sig) throw new Error(d.id + '：Boss 沒掉招牌裝備 ' + d.sig);
      const n0 = G.drops.length; tp(chest.x, chest.y + 6); CH.openChest(G.me, chest); step(3);
      const got = d.uq ? G.drops.slice(n0).find(x => x.item.uq === d.uq) : { item: { name: '黃金寶箱' } }; if (!chest.opened || !got) throw new Error(d.id + '：最深處的寶箱沒打開 / 沒拿到 ' + d.uq);
      menus.restAt(CAMPS[0]); setMenu(null); G.projs = []; step(2, { god: true });
      if (RB.rbs.some(e => e.id === 'dg_' + d.id)) throw new Error(d.id + '：休息後 Boss 又出現了');
      const viaPortal = D.DUNGEONS.indexOf(d) % 2 === 1;                    // 一半的地城從 Boss 大廳的傳送門離開，一半走入口的傳送門
      if (viaPortal) { tp(d.portal[0], d.portal[1]); step(1, { god: true }); const pd = D.nearDoor(G.me); if (!pd || !pd.portal) throw new Error(d.id + '：打倒 Boss 後大廳沒有傳送門'); }
      else tp(d.exX, d.exY); step(1, { god: true }); const out = D.nearDoor(G.me); if (!out || !out.out) throw new Error(d.id + '：站在出口傳送門上沒偵測到出口（dead=' + G.me.dead + ' 位置 ' + Math.round(G.me.x - d.exX) + ',' + Math.round(G.me.y - d.exY) + '）');
      imp0.input.enterDoor(); step(2); if (D.dungeonAt(G.me.x, G.me.y)) throw new Error(d.id + '：沒有離開地城');
      log.push('  ' + d.name + '：' + boss.def.name + ' → ' + sig.item.name + (d.uq ? ' + ' + got.item.name : ''));
      G.drops = [];
    }
    G.drops = []; G.me.vit = vit0; recalc(G.me);
  });

  run('掉落：小怪主要掉魂晶 / 礦石，武器很少', () => {
    const E = await0.enemies, N = 400; let w = 0, g = 0; const ore0 = { ...G.me.mats }; G.drops = []; G.coins = [];
    for (let i = 0; i < N; i++) { const e = E.makeEnemy('wolf', 3, G.me.x + 30, G.me.y, { alive: true, timer: 0 }); G.enemies.push(e); E.killEnemy(e, G.me); }
    for (const d of G.drops) d.item.slot === 'weapon' ? w++ : g++;
    const ore = G.coins.filter(c => c.mat).length;
    log.push('  打倒 ' + N + ' 隻野狼：武器 ' + w + '、防具飾品 ' + g + '、礦石 ' + ore);
    if (w > N * .04) throw new Error('武器掉太多：' + w);
    if (ore < N * .12) throw new Error('礦石太少：' + ore);
    G.drops = []; G.coins = [];
  });

  run('存檔 → 讀檔', () => {
    save(); const s = loadSave(); if (!s) throw new Error('沒有存檔');
    const before = JSON.stringify(serialize());
    applySave(JSON.parse(JSON.stringify(s))); step(10);
    log.push('  存檔大小 ' + before.length + ' bytes');
  });

  run('舊存檔（v6）：舊的起始營火變成西丘營火（v8 整塊平原往南移 216 格）', () => {
    save(); const s = loadSave(); s.v = 6; s.lastCamp = 'start'; s.camps = ['start', 'dawn']; s.merchant = { camp: 'start', stock: [] };
    applySave(s); const W = CAMPS.find(c => c.id === 'west'), S0 = CAMPS.find(c => c.id === 'start');
    if (G.lastCamp !== 'west' || !W.lit || !S0.lit) throw new Error('營火沒有換算：' + G.lastCamp + ' west=' + W.lit + ' start=' + S0.lit);
    if (W.tx !== 30 || W.ty !== 165 + 216) throw new Error('西丘營火位置不對');
    save(); applySave(loadSave()); step(5);
  });

  run('打 Boss 打到一半死掉 → 血條收起來、Boss 回去睡、攻擊鍵可以互動', () => {
    setMenu(null); RB.rbDead.delete('queen'); RB.resetRegionBosses(); const q = () => RB.rbs.find(e => e.id === 'queen');
    tp(q().def.x, q().def.y + 30); step(120); if (q().state === 'sleep') throw new Error('Boss 沒有醒來');
    if (document.getElementById('bossBar').hidden) throw new Error('開打了卻沒有血條');
    G.me.iframe = 0; G.me.hp = 1; hurtPlayer(G.me, 9999, G.me.x + 5, G.me.y); step(400);
    if (G.me.dead) throw new Error('沒有重生');
    if (!document.getElementById('bossBar').hidden) throw new Error('死掉重生後 Boss 血條還在');
    if (q().state !== 'sleep' || q().hp !== q().maxHp) throw new Error('死掉重生後 Boss 沒有重置：' + q().state);
  });

  run('仇恨：隔著牆的怪不會追你，也不會擋住互動', () => {
    const E = await0.enemies, M = await0.map, D = imp0.dg, d = D.DUNGEONS[0];
    tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2);
    const px = G.me.x, py = G.me.y; let wall = null;                     // 找一個離玩家 50~100px、中間隔著牆的位置
    for (let r = 50; r <= 190 && !wall; r += 6) for (let a = 0; a < 6.28 && !wall; a += .2) { const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r, i = Math.floor(y / 16) * M.MW + Math.floor(x / 16);
      const open = [-1, 0, 1].every(oy => [-1, 0, 1].every(ox => M.WALKABLE(M.map[i + oy * M.MW + ox])));   // 周圍一圈都是地板：怪不會被牆推到看得到的地方
      if (open && !canSee(Math.floor(x / 16) * 16 + 8, Math.floor(y / 16) * 16 + 2, px, py - 6)) wall = [Math.floor(x / 16) * 16 + 8, Math.floor(y / 16) * 16 + 8]; }
    if (!wall) throw new Error('找不到隔著牆的位置');
    const e = E.makeEnemy('wolf', 1, wall[0], wall[1], { alive: true, timer: 0 }); e.aggro = 200; G.enemies = [e]; step(10, { god: true });
    if (e.state !== 'idle') throw new Error('隔著牆的怪看到你了：' + e.state + ' e=' + Math.round(e.x - G.me.x) + ',' + Math.round(e.y - G.me.y) + ' start=' + Math.round(wall[0] - px) + ',' + Math.round(wall[1] - py) + ' see=' + canSee(e.x, e.y - 6, G.me.x, G.me.y - 6) + ' me=' + Math.round(G.me.x - px) + ',' + Math.round(G.me.y - py) + ' dead=' + G.me.dead);
    e.state = 'chase'; step(150, { god: true });
    if (e.state === 'chase' && !canSee(e.x, e.y - 6, G.me.x, G.me.y - 6)) throw new Error('看不到你還一直追');
    G.enemies = [];
    tp(d.exX, d.exY); step(1); imp0.input.enterDoor(); step(2);
  });

  run('異常狀態：冰凍 / 暈眩不能動、狂按掙脫、中毒扣血、出血爆發、目盲、封印', () => {
    const ST = await0.status; setMenu(null); G.enemies = []; ST.clearStatus(G.me); G.me.hp = G.me.maxHp;
    G.me.iframe = 0; hurtPlayer(G.me, 1, G.me.x + 5, G.me.y, { frost: 120 }); G.me.kx = G.me.ky = 0; const x0 = G.me.x;   // 擊退不算
    if (!(G.me.sx.frozen > 0)) throw new Error('凍傷滿了沒有冰凍');
    input.mx = 1; step(20); input.mx = 0; if (Math.abs(G.me.x - x0) > 6) throw new Error('冰凍中還能走路：' + (G.me.x - x0));
    const f0 = G.me.sx.frozen; pressed.atk = true; step(1); if (!(G.me.sx.frozen < f0 - .1)) throw new Error('狂按沒有比較快掙脫');
    step(80); if (G.me.sx.frozen > 0) throw new Error('冰凍沒有解除');
    G.me.iframe = 0; hurtPlayer(G.me, 1, G.me.x + 5, G.me.y, { stun: .5 }); if (!ST.locked(G.me)) throw new Error('沒有暈眩');
    step(40); G.me.iframe = 0; hurtPlayer(G.me, 1, G.me.x + 5, G.me.y, { stun: .5 }); if (ST.locked(G.me)) throw new Error('剛暈完又被暈（應該有一段時間不會再暈）');
    G.me.hp = G.me.maxHp; G.me.iframe = 0; hurtPlayer(G.me, 1, G.me.x + 5, G.me.y, { poison: 3 }); const h0 = G.me.hp; step(120);
    if (!(G.me.hp < h0 - 1)) throw new Error('中毒沒有扣血');
    G.me.hp = G.me.maxHp; G.me.iframe = 0; const h1 = G.me.hp; hurtPlayer(G.me, 1, G.me.x + 5, G.me.y, { bleed: 100 }); if (!(G.me.hp < h1 - G.me.maxHp * .1)) throw new Error('出血沒有爆發');
    G.me.iframe = 0; hurtPlayer(G.me, 1, G.me.x + 5, G.me.y, { silence: 2, blind: 2, root: 1, slow: 2 });
    step(2); if (document.getElementById('statusRow').hidden) throw new Error('HUD 沒有顯示異常狀態');
    G.me.skillCd = 0; pressed.skill = true; step(1); if (G.me.skillCd > 0) throw new Error('封印中還能用技能');
    ST.clearStatus(G.me); G.me.hp = G.me.maxHp; step(2); if (!document.getElementById('statusRow').hidden) throw new Error('狀態解除了 HUD 還在');
  });

  run('等級差：低等打高等怪比較痛、比較難打', () => {
    const BT = await0.bt;
    if (!(BT.gapTaken(50, 25) > 1.3 && BT.gapTaken(25, 50) < 1 && BT.gapTaken(0, 5) === 1)) throw new Error('被打的倍率不對');   // 等級尺度 ×2.5：差 25 級 = 以前差 10 級
    if (!(BT.gapDealt(25, 50) < .8 && BT.gapDealt(50, 25) > 1)) throw new Error('打怪的倍率不對');
  });

  run('Boss 新招：吸引 / 甜甜圈 / 十字光束 / 追蹤彈（地城 Boss 和主線 Boss 都能用）', () => {
    const A3 = await0.ai3; setMenu(null);
    for (const id of ['dg_' + imp0.dg.DUNGEONS[0].id, 'yeti']) {
      RB.rbDead.delete(id); await0.quest.flags.delete('dgn:' + imp0.dg.DUNGEONS[0].id); RB.resetRegionBosses(); const b = RB.rbs.find(e => e.id === id); if (!b) throw new Error('找不到 ' + id);
      if (id.startsWith('dg_')) { tp(imp0.dg.DUNGEONS[0].ent[0] * 16 + 8, (imp0.dg.DUNGEONS[0].ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2); }
      tp(b.def.x, b.def.y + 40); step(100, { god: true }); if (b.state === 'sleep') throw new Error(id + '：沒醒');
      for (const [m, mo] of [['pull', { r: 56, k: 1.3, pull: 62 }], ['donut', { r0: 44, r: 124, k: 1.3 }], ['cross', { L: 170, W: 18, k: 1.2 }], ['homing', { n: 3, spd: 90, turn: 2.2, k: .9 }]]) {
        b.state = 'idle'; b.phase = 2; A3.startExtra(b, m, mo, 10, 10); if (!A3.EXTRA_STATES.has(b.state)) throw new Error(id + '：' + m + ' 沒有開始');
        const p0 = G.projs.length; let left = 300; while (A3.EXTRA_STATES.has(b.state) && left-- > 0) { G.me.iframe = 0; step(1, { god: true }); b.hp = b.maxHp; }
        if (A3.EXTRA_STATES.has(b.state)) throw new Error(id + '：' + m + ' 一直沒結束 t=' + b.t + ' same=' + RB.rbs.includes(b) + ' d=' + Math.round(Math.hypot(G.me.x - b.def.x, G.me.y - b.def.y)) + ' R=' + b.def.R + ' dead=' + G.me.dead + ' paused=' + G.paused);
        if (m === 'homing' && !G.projs.some(p => p.home)) throw new Error(id + '：追蹤彈沒射出來'); }
      log.push('  ' + b.def.name + '：四招都放得出來');
      G.projs = []; menus.restAt(CAMPS[0]); setMenu(null); step(2, { god: true });
    }
  });

  run('地城前院：每個野外洞口都有雕像 / 旗子 / 符文石，雕像擋路', () => {
    const D = imp0.dg, M = await0.map;
    for (const d of D.DUNGEONS) { if (d.stairs) continue;
      const k = new Set((d.deco || []).map(o => o.k)); if (!k.has('rune') || (!k.has('statue') && !k.has('banner'))) throw new Error(d.name + '：前院裝飾太少 ' + [...k].join(','));
      for (const o of d.deco) if (o.k === 'statue' && !(await0.coll.collides(o.x, o.y, 4))) throw new Error(d.name + '：雕像不會擋路'); }
    if (!M.PROPS.length) throw new Error('沒有任何擋路的裝飾');
  });

  run('暫停選單：Esc 打開 → 遊戲停住 → 設定 → 回到標題 → 繼續存檔', () => {
    const PZ = await0.pause; setMenu(null); step(2);
    PZ.openPause(); if (!G.paused || document.getElementById('pauseMenu').hidden) throw new Error('暫停沒有打開 / 遊戲沒停');
    const t0 = G.me.x; input.mx = 1; step(10); input.mx = 0; if (G.me.x !== t0) {}             // step 直接呼叫 update，只檢查選單狀態
    document.querySelector('#pauseMenu [data-ptab=set]').click(); const tg = document.querySelector('#pauseMenu [data-tog=shake]'); tg.click();
    if (PZ.SET.shake) throw new Error('畫面震動關不掉'); document.querySelector('#pauseMenu [data-tog=shake]').click();
    document.querySelector('#pauseMenu [data-bs="1.18"]').click(); if (getComputedStyle(document.documentElement).getPropertyValue('--bs').trim() !== '1.18') throw new Error('按鈕大小沒套用');
    document.querySelector('#pauseMenu [data-bs="1"]').click();
    document.querySelector('#pauseMenu [data-ptab=main]').click(); document.querySelector('#pauseMenu [data-pa=title]').click();
    if (G.started || document.getElementById('title').hidden) throw new Error('沒有回到標題畫面');
    imp0.title.pickSlot(); step(2); if (!G.started || !document.getElementById('title').hidden) throw new Error('從標題畫面繼續失敗');
  });

  run('隔著牆：打不到怪、怪也打不到你', () => {
    const M = await0.map, D = imp0.dg, d = D.DUNGEONS[0];
    tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2);
    const px = G.me.x, py = G.me.y; let w = null;
    for (let r = 40; r <= 190 && !w; r += 6) for (let a = 0; a < 6.28 && !w; a += .2) { const x = Math.floor((px + Math.cos(a) * r) / 16) * 16 + 8, y = Math.floor((py + Math.sin(a) * r) / 16) * 16 + 8;
      if (M.WALKABLE(M.map[Math.floor(y / 16) * M.MW + Math.floor(x / 16)]) && !await0.coll.canSee(x, y - 6, px, py - 6)) w = [x, y]; }
    if (!w) throw new Error('找不到隔著牆的位置');
    const e = await0.enemies.makeEnemy('wolf', 1, w[0], w[1], { alive: true, timer: 0 }); G.enemies = [e]; const h = e.hp;
    damageEnemy(G.me, e, 5, G.me.x, G.me.y); if (e.hp !== h) throw new Error('隔著牆打到怪了');
    G.me.iframe = 0; const ph = G.me.hp; if (hurtPlayer(G.me, 10, w[0], w[1]) || G.me.hp !== ph) throw new Error('隔著牆被打到了');
    G.enemies = []; tp(d.exX, d.exY); step(1); imp0.input.enterDoor(); step(2);
  });

  run('反傷流 / 閃避流', () => {
    const E = await0.enemies; G.enemies = []; const e = E.makeEnemy('skel', 1, G.me.x + 20, G.me.y, { alive: true, timer: 0 }); G.enemies.push(e);
    G.me.tfx = { thorns: 50 }; G.me.iframe = 0; const h = e.hp; G.hitCtx = e.hc; hurtPlayer(G.me, 20, e.x, e.y); G.hitCtx = null;
    if (!(e.hp < h)) throw new Error('反傷沒有打回去');
    G.me.tfx = { evade: 100 }; let miss = 0; for (let i = 0; i < 60; i++) { G.me.iframe = 0; G.me.hp = G.me.maxHp; if (!hurtPlayer(G.me, 1, e.x, e.y)) miss++; }
    if (miss < 10 || miss > 40) throw new Error('閃避最多 40%：60 下應該閃掉 10~40 下，結果 ' + miss);
    G.me.tfx = {}; recalc(G.me); G.enemies = [];
  });

  run('無名古墓的機關：尖刺、火盆謎題、鐵柵門、隱藏的牆', () => {
    const PU = await0.puz, Q = await0.quest, p = PU.PUZZLES.find(p => p.d.id === 'barrow'); if (!p) throw new Error('沒有機關');
    if (p.braz.length !== 4 || !p.gate.length || p.wall.length !== 3 || p.spikes.length < 30) throw new Error('機關不完整：' + [p.braz.length, p.gate.length, p.wall.length, p.spikes.length]);
    Q.flags.delete('puz:barrow:fire'); Q.flags.delete('puz:barrow:wall'); recalc(G.me);
    const d = p.d; tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2); G.enemies = [];
    // 尖刺：站在尖刺上等一輪 → 一定會被刺到
    const sp = p.spikes[Math.floor(p.spikes.length / 2)]; tp(sp.x, sp.y + 2); G.me.hp = G.me.maxHp; const h0 = G.me.hp; step(160); G.me.dead = false;
    if (!(G.me.hp < h0)) throw new Error('站在尖刺上沒被刺到');
    // 鐵柵門擋路
    const g = p.gate[Math.floor(p.gate.length / 2)]; if (!await0.coll.collides(g.x, g.y, 5)) throw new Error('鐵柵門沒有擋路');
    // 點錯 → 火熄掉、叫出怪
    G.me.hp = G.me.maxHp; const wrong = p.braz.find(b => b.sym !== p.order[0]); tp(wrong.x, wrong.y + 14); step(1); G.enemies = [];
    let it = imp0.input.interactTarget(); if (!it || it.kind !== 'use') throw new Error('站在火盆旁邊沒有「點燃」'); it.run();
    if (p.braz.some(b => b.lit) || G.enemies.length < 2) throw new Error('點錯沒有懲罰');
    G.enemies = []; G.me.dead = false; G.me.hp = G.me.maxHp;
    for (const s2 of p.order) { const b = p.braz.find(x => x.sym === s2); tp(b.x, b.y + 14); G.me.iframe = 9; step(1); it = imp0.input.interactTarget(); if (!it) throw new Error('點不到 ' + s2); it.run(); }
    if (!Q.flags.has('puz:barrow:fire')) throw new Error('照順序點完門沒開'); step(90);
    if (await0.coll.collides(g.x, g.y, 5)) throw new Error('門開了還擋路');
    // 隱藏的牆：面向它砍一刀 → 碎掉、後面的金箱
    const W = p.wallHint, n = p.wall[1], dx = Math.sign(W.x - (n.tx * 16 + 8)) || 0;
    const wx = W.x, wy = W.y; let sx = wx, sy = wy; for (const [ox, oy] of [[0, 22], [0, -22], [22, 0], [-22, 0]]) if (!await0.coll.collides(wx + ox, wy + oy, 5)) { sx = wx + ox; sy = wy + oy; break; }
    tp(sx, sy); G.me.face = Math.atan2(wy - sy, wx - sx); G.me.iframe = 9; G.me.atkCd = 0; pressed.atk = true; step(20);
    if (!Q.flags.has('puz:barrow:wall')) throw new Error('砍了牆沒碎（站在 ' + Math.round(sx - wx) + ',' + Math.round(sy - wy) + '）');
    if (!await0.chests.CHESTS.some(c => c.id === 'pz_barrow')) throw new Error('牆後面沒有寶箱');
    // 讀檔：沒有旗標 → 門關、牆回來
    Q.flags.delete('puz:barrow:fire'); Q.flags.delete('puz:barrow:wall'); step(2);
    if (!await0.coll.collides(g.x, g.y, 5) || await0.map.map[n.ty * await0.map.MW + n.tx] !== await0.map.RWALL) throw new Error('旗標拿掉後門 / 牆沒有恢復');
    G.enemies = []; tp(d.exX, d.exY); step(1); imp0.input.enterDoor(); step(2); void dx;
  });

  run('死亡 → 重生', () => {
    G.me.iframe = 0; G.me.hp = 1; hurtPlayer(G.me, 9999, G.me.x + 5, G.me.y); step(400);
    if (G.me.dead) throw new Error('沒有重生');
  });

  return { log, fails };
};

const r = await send('Runtime.evaluate', { expression: `(${pageScript})()`, awaitPromise: true, returnByValue: true });
if (r.result.exceptionDetails) console.log('TEST CRASH', r.result.exceptionDetails.exception?.description);
const { log = [], fails = [] } = r.result.result?.value || {};
console.log(log.join('\n'));
console.log(fails.length ? '\n失敗:\n' + fails.join('\n') : '\n全部通過');
console.log('頁面錯誤:', pageErrors.length ? pageErrors : '無');
if (process.argv[3]) {                                              // 第二個參數 = 截圖存檔路徑（可省略）
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(process.argv[3], Buffer.from(shot.result.data, 'base64'));
}
ws.close(); chrome.kill(); if (server) await server.close(); process.exit(fails.length || pageErrors.length ? 1 : 0);
