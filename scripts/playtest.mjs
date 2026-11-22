// 自動試玩測試：開 headless Chrome，直接 import 遊戲模組，把大部分的程式路徑都跑一遍
// （所有武器、所有小怪、所有 Boss、選單、寶箱、雙人目標、存讀檔、死亡重生）
//
// 用法：npm run playtest
//   會自己開一個全新的 Vite 伺服器（隨機 port），測完就關掉。
//   為什麼不用你開著的 npm run dev？跑很久的伺服器在檔案改過後，會在網址加 ?t=時間戳，
//   測試 import 的模組就跟遊戲用的不是同一份，會出現「找不到 queen」這種假失敗。
//   也可以指定網址：npm run playtest -- http://localhost:5173/
//   只跑幾個：ONLY='地城|機關' npm run playtest
import { writeFileSync } from 'node:fs';

import { createServer } from 'vite';
import { openChrome } from './cdp.mjs';

let server = null, url = process.argv[2];
if (!url || url === '-') {                                          // 沒指定網址 → 自己開一個乾淨的伺服器
  server = await createServer({ logLevel: 'error', server: { port: 0, strictPort: false } });
  await server.listen(); url = server.resolvedUrls.local[0];
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const pageErrors = [];
const { send, onEvent } = await openChrome();                       // scripts/cdp.mjs：自動挑 port、時限、結束時一定關掉 Chrome
onEvent(m => { if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await wait(3000);

const pageScript = async () => {
  const log = [], fails = [], times = [];
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
  const await0 = { chests: await imp('world/chests'), towns: await imp('world/towns'), quest: await imp('game/quest'), story: await imp('data/story'), map: await imp('world/map'), forge: await imp('data/forge'), fx: await imp('game/weaponFx'), items: await imp('data/items'), uq: await imp('data/uniques'), enemies: await imp('game/enemies'), status: await imp('game/status'), bt: await imp('game/bossTuning'), ai3: await imp('world/bossAI3'), puz2: await imp('world/puz2'), coll: await imp('game/collision'), pause: await imp('ui/pause'), puz: await imp('world/puzzles'), mech: await imp('world/bossMech'), statues: await imp('world/statues'), sight: await imp('world/sight'), ending: await imp('world/ending'), secrets: await imp('world/secrets'), cb: await imp('game/combat'), dboss: await imp('world/dungeonBoss') };

  const imp0 = { pu: await imp('game/playerUpdate'), save: await imp('game/save'), map: await imp('render/map'), dg: await imp('world/dungeons'), mount: await imp('game/mount'), input: await imp('ui/interact'), inp: await imp('ui/input'), hud: await imp('ui/hud'), title: await imp('ui/title') };
  const step = (n, opts = {}) => {
    for (let i = 0; i < n; i++) {
      if (opts.god && G.me) { G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; }
      if (opts.atkEvery && i % opts.atkEvery === 0) pressed.atk = true;
      update(1 / 60); if (i % 10 === 9 || i === n - 1) { render(); updateHUD(); }   // 畫面每 10 格畫一次（測試看不到畫面，畫太勤只是拖慢）；最後一格一定畫
      if (opts.god && G.me && G.me.dead) { G.me.dead = false; G.me.hp = G.me.maxHp; }   // 無敵：等級差讓高等怪一下就打死 1 級的測試角色 → 倒下就馬上扶起來（不然會重生回營火）
      for (const k in pressed) pressed[k] = false;
    }
    renderMini();
  };
  const only = window.__ONLY;                                         // ONLY=關鍵字|關鍵字 npm run playtest：只跑名字有這些字的測試（開始新遊戲一定跑）
  const run = (name, fn) => { if (only && !name.startsWith('開始新遊戲') && !only.split('|').some(k => name.includes(k))) return; if (G.me && G.me.dead) { log.push('  （' + name + ' 開始前角色是倒下的 → 先扶起來）'); G.me.dead = false; } if (G.me) { G.me.hp = G.me.maxHp; G.me.iframe = 0; }
    const t0 = performance.now(); try { fn(); log.push('✓ ' + name); } catch (e) { fails.push(`✗ ${name}: ${e.stack.split('\n').slice(0, 4).join(' | ')}`); }
    times.push([name, performance.now() - t0]); };                     // 每個測試花多久：最後印出最慢的幾個
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
    step(30); G.me.st = 60; G.me.atkCd = 0; pressed.atk = true; held.atk = true; step(10);       // 按住攻擊：不揮刀，直接開始蓄力
    if (G.me.swing || G.me.atkCd > 0) throw new Error('按住攻擊還是先揮了一刀');
    step(15);
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
    if (M) {                                                            // 機制：66% 發動 → 護盾打不到 → 引 Boss 的招打壞四個物件 → 破綻
      e.hp = e.maxHp * .6; let k = 0; while (!e.mech && k++ < 600) step(1, { god: true }); if (!e.mech) throw new Error('血量 60% 機制沒發動（' + M.kind + '）state=' + e.state);
      const h0 = e.hp; damageEnemy(G.me, e, 5, G.me.x, G.me.y); if (e.hp !== h0) throw new Error('機制中還打得到 Boss');
      step(30, { god: true });
      { const o = e.mech.objs.find(o => !o.dead), hp0 = o.hp; for (let i = 0; i < 5; i++) damageEnemy(G.me, o, 1, o.x, o.y + 1); if (o.dead || o.hp !== hp0) throw new Error('玩家自己砍得壞機制的物件'); }
      { const m = e.mech; let t = 0; while (e.mech === m && t++ < 60 * 30) { const o = m.objs.find(o => !o.dead); if (o) { const dx = o.x - e.def.x, dy = o.y - e.def.y, L = Math.hypot(dx, dy) || 1; tp(o.x + dx / L * 14, o.y + dy / L * 14); } G.me.iframe = 1; step(1, { god: true }); }   // 站在物件外側，讓 Boss 的招打過來
        if (e.mech === m) throw new Error('站在物件旁邊 30 秒，Boss 的招還沒打壞四個（剩 ' + m.objs.filter(o => !o.dead).length + '）');
        if (m.objs.some(o => o.hatched)) e.mStun = 1; }                 // 卵孵化了 → 沒有破綻是正常的，這裡只測得到破綻的流程
      step(2, { god: true }); if (e.mech) throw new Error('四個物件打碎了機制沒結束');
      if (!(e.mStun > 0)) throw new Error('解開機制沒有破綻');
      const h1 = e.hp; damageEnemy(G.me, e, 5, e.x, e.y + 20); if (!(e.hp < h1)) throw new Error('破綻時打不到 Boss');
      log.push('  ' + e.def.name + '：護盾 → 引招打壞' + M.name + ' ×4 → 破綻');
      e.mi = 9; step(260, { god: true });
    }
    e.hp = e.maxHp * .4; step(400, { god: true, atkEvery: 15 });
    if (!e.dead) { e.hp = 1; e.immune = false; damageEnemy(G.me, e, 5, e.x, e.y + 20); step(120, { god: true }); }
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
    log.push('  寶箱數量 ' + CH.length + '（野外 ' + CH.filter(c => c.wild).length + '、寶箱怪 ' + CH.filter(c => c.mimic).length + '）');
    if (!CH.some(c => c.mimic)) throw new Error('整個遊戲沒有寶箱怪');
    if (CH.some(c => c.wild && c.tier > 1)) throw new Error('野外有黃金寶箱');
    const IT = await0.items; for (let k = 0; k < 2000; k++) { const it = IT.randomLoot(40, k % 2 ? 3 : 2, undefined, await0.chests.WILD_CAP);
      if (it.rarity > 2 || it.slot === 'seal' || it.fx) throw new Error('野外寶箱開出了藍色以上的東西：' + it.name); }
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
    if (ST.STATUES.length !== ST.STATUE_N || ST.STATUE_N !== 6) throw new Error('神像不是 6 座：' + ST.STATUES.length);   // 6 = 精靈王國
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
    { const SI = await0.sight, fc = M.CAMPS.find(c => !c.dg && M.reg[c.ty * M.MW + c.tx] === fz);   // 選項 A：神像只點亮地形，營火要自己看到才標
      Q.flags.delete('saw:' + SI.campKey(fc.id)); SI.sightReveal(); if (SI.saw(SI.campKey(fc.id))) throw new Error('沒看到營火，地圖上就標了 ' + fc.name);
      tp(fc.x, fc.y + 20); step(1); SI.sightReveal(); if (!SI.saw(SI.campKey(fc.id))) throw new Error('站在 ' + fc.name + ' 旁邊，地圖上還是沒有標'); }
    log.push('  神像：' + ST.STATUES.map(s => s.k + '@' + s.tx + ',' + s.ty).join(' '));
    RB.rbDead.delete('queen'); RB.resetRegionBosses();
  });

  run('製圖師：照進度暗示下一張殘頁在哪', () => {
    const ST = await0.statues, Q = await0.quest, S = await0.story, towns = await0.towns, keep = [...Q.flags];
    const c = towns.NPCS.find(n => n.town === 'dawn' && n.name === '製圖師');
    const talk = () => { tp(c.x, c.y + 80); step(2); tp(c.x, c.y + 14); step(2); return document.getElementById('talk').textContent; };
    const wipe = () => { for (const f of [...Q.flags]) if (/^(frag|given|statue|heard:carto):/.test(f)) Q.flags.delete(f); };
    wipe(); if (!talk().includes(S.CARTO_HINTS[1])) throw new Error('一開始製圖師沒有提鏡湖');
    for (const [k, want] of [[1, 6], [6, 2], [2, 3], [3, 4], [4, 5]]) { Q.flags.add('frag:' + k); Q.flags.add('given:' + k); Q.flags.add('statue:' + k);
      if (!talk().includes(S.CARTO_HINTS[want])) throw new Error('拿到殘頁 ' + k + ' 之後，製圖師沒有提下一張（' + want + '）'); }
    wipe(); Q.flags.add('statue:2'); Q.flags.add('frag:1'); Q.flags.add('frag:6'); Q.flags.add('heard:carto:1');
    if (!talk().includes(S.CARTO_HINTS[3])) throw new Error('自己祈禱過的神像（2）沒有跳過');
    wipe(); for (let k = 1; k <= 6; k++) { Q.flags.add('frag:' + k); Q.flags.add('given:' + k); } if (!talk().includes(S.CARTO_HINTS.mark)) throw new Error('殘頁都交了，製圖師沒有提醒去神像');
    for (let k = 1; k <= 6; k++) Q.flags.add('statue:' + k); if (!talk().includes(S.CARTO_HINTS.done)) throw new Error('全部點亮後製圖師沒有說收尾的話');
    if (/Lv|等級|危險|打不過/.test(Object.values(S.CARTO_HINTS).join())) throw new Error('製圖師的提示出現等級 / 危險字眼');
    tp(c.x, c.y + 80); step(2); Q.flags.clear(); for (const f of keep) Q.flags.add(f);
  });

  run('結局：觀星儀 → 七顆星核 + 最後的看守者 → 選結局 → 回到荒野；Boss 倒下後鎮民換台詞、天色變亮', () => {
    const E = await0.ending, Q = await0.quest, S = await0.story, M = await0.map, towns = await0.towns; setMenu(null);
    const keep = { boss: G.bossDead, rb: [...RB.rbDead], fl: [...Q.flags] };
    for (const f of ['dgn:temple', 'cores:all', 'end:home', 'end:watch', 'end:wake', 'rumor:warden', 'rumor:star']) Q.flags.delete(f); RB.rbDead.clear(); G.bossDead = false; step(1);   // 前面的地城測試可能已經打倒看守者
    if (!E.ALTAR.placed) throw new Error('觀星儀沒有放');
    if (await0.coll.collides(E.ALTAR.x, E.ALTAR.y + 18, 5)) throw new Error('觀星儀前面走不到');
    G.enemies = [];
    tp(E.ALTAR.x, E.ALTAR.y + 18); step(2); let it = imp0.input.interactTarget(); if (!it || it.btn !== '調查') throw new Error('觀星儀旁邊沒有「調查」：' + (it && it.btn));
    if (Q.regionLook(0).amb !== M.REGIONS[0].amb) throw new Error('史萊姆女王還活著，平原就變亮了');
    for (const id of ['general', 'mushking', 'yeti', 'queen', 'dragon', 'lich']) RB.rbDead.add(id); G.bossDead = true; step(2);
    if (!Q.flags.has('cores:all')) throw new Error('七顆星核都拿到了，沒有記下 cores:all');
    if (E.endingReady()) throw new Error('最後的看守者還沒倒下就可以選結局');
    if (!Q.rumorsKnown().some(r => r.id === 'warden')) throw new Error('拿齊星核後沒有「最後的看守者」的傳聞');
    Q.flags.add('dgn:temple'); G.enemies = []; step(2);
    if (!E.endingReady() || !Q.rumorsKnown().some(r => r.id === 'star')) throw new Error('看守者倒下後觀星儀沒有醒來 / 沒有觀星台的傳聞');
    it = imp0.input.interactTarget(); if (!it || it.btn !== '仰望') throw new Error('觀星儀旁邊沒有「仰望」：' + (it && it.btn)); it.run(); step(1);
    const sc = document.getElementById('endScreen'), n = sc.querySelectorAll('[data-end]').length, want = await0.quest.loreRead.has('t7') ? 3 : 2;
    if (sc.hidden || n !== want) throw new Error('結局選項不對：' + n + '（應該 ' + want + '）');
    sc.querySelector('[data-end="home"]').click(); step(1);
    if (!Q.flags.has('end:home') || !sc.textContent.includes('結局・歸星')) throw new Error('選了結局沒有記下 / 沒有顯示結局文字');
    sc.querySelector('.endback').click(); step(1);
    if (!sc.hidden || imp0.hud.openMenu) throw new Error('「回到荒野」沒有關掉結局畫面');
    if (!(Q.regionLook(0).amb < M.REGIONS[0].amb)) throw new Error('打倒史萊姆女王後平原沒有變亮');
    const npc = towns.NPCS.find(m => m.town === 'dawn' && m.name === '村長'); Q.flags.delete('heard:r1'); tp(npc.x, npc.y + 60); step(2); tp(npc.x, npc.y + 14); step(2);
    const r1 = S.REACTS.find(r => r.id === 'r1'); if (!document.getElementById('talk').textContent.includes(r1.line)) throw new Error('打倒史萊姆女王後村長沒有說新的話：' + document.getElementById('talk').textContent);
    log.push('  觀星儀：' + Math.round(E.ALTAR.x / 16) + ',' + Math.round(E.ALTAR.y / 16));
    tp(npc.x, npc.y + 80); step(2);
    RB.rbDead.clear(); for (const id of keep.rb) RB.rbDead.add(id); G.bossDead = keep.boss; Q.flags.clear(); for (const f of keep.fl) Q.flags.add(f); RB.resetRegionBosses();
  });

  run('更多機關：符文踏板（苔石洞窟）、轉動雕像（樹根地穴）、崩塌石橋（苔石洞窟）', () => {
    const PU = await0.puz, Q = await0.quest, P = (id, k) => PU.PUZZLES.find(p => p.d.id === id && p.kind === k);
    const enter = d => { tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2); G.enemies = []; };
    const leave = d => { G.enemies = []; tp(d.exX, d.exY); step(1); imp0.input.enterDoor(); step(2); };
    // 符文踏板
    const sp = P('moss', 'simon'); if (!sp || sp.plates.length !== 4 || !sp.stone) throw new Error('苔石洞窟的符文踏板不完整'); Q.flags.delete('puz:moss:fire'); enter(sp.d);
    tp(sp.stone.x, sp.stone.y + 16); step(2); let it = imp0.input.interactTarget(); if (!it || it.btn !== '觸摸') throw new Error('記憶石沒有「觸摸」'); it.run();
    step(Math.ceil(sp.seq.length * .85 * 60) + 10);
    const wrong = sp.plates.findIndex((_, k) => k !== sp.seq[0]); tp(sp.plates[wrong].x, sp.plates[wrong].y + 2); G.me.iframe = 0; step(2); if (sp.step !== 0 || !(sp.plates[0].bad > 0)) throw new Error('踩錯沒有懲罰');
    G.me.dead = false; G.me.hp = G.me.maxHp; tp(sp.stone.x, sp.stone.y + 30); step(30);
    for (const k of sp.seq) { tp(sp.stone.x, sp.stone.y + 30); step(2); tp(sp.plates[k].x, sp.plates[k].y + 2); G.me.iframe = 9; step(2); }
    if (!Q.flags.has('puz:moss:fire')) throw new Error('照順序踩完門沒開（踩到第 ' + sp.step + ' 步）'); leave(sp.d);
    // 轉動雕像
    const so = P('roots', 'statues'); if (!so || so.stats.length < 3 || !so.altar) throw new Error('樹根地穴的雕像不完整'); Q.flags.delete('puz:roots:fire'); step(2); enter(so.d);
    const n = so.stats.length; let guard = 0;                                // 解法：從第一座開始，一直轉到它對準，再換下一座（最後一座會跟著第一座轉，用暴力找）
    const solve = () => { const tryAll = (depth, off) => { if (off.every(o => o === 0)) return []; if (depth === 0) return null;
      for (let i = 0; i < n; i++) { const o2 = [...off]; o2[i] = (o2[i] + 1) % 4; o2[(i + 1) % n] = (o2[(i + 1) % n] + 1) % 4; const r = tryAll(depth - 1, o2); if (r) return [i, ...r]; } return null; };
      for (let dpt = 1; dpt <= 8; dpt++) { const r = tryAll(dpt, [...so.off]); if (r) return r; } return null; };
    const moves = solve(); if (!moves) throw new Error('雕像謎題解不開：' + so.off);
    for (const i of moves) { const s2 = so.stats[i]; tp(s2.x + (s2.want === 1 || s2.want === 3 ? 18 : 0), s2.y + (s2.want === 0 || s2.want === 2 ? 18 : 0)); step(1); it = imp0.input.interactTarget(); if (!it || it.btn !== '轉動') throw new Error('雕像旁邊沒有「轉動」'); it.run(); if (++guard > 20) break; }
    if (!Q.flags.has('puz:roots:fire')) throw new Error('雕像都對準了門沒開'); leave(so.d);
    const cb = P('moss', 'crumble'); enter(cb.d);
    // 崩塌石橋：站在會碎的石頭上 → 裂開 → 掉下去 → 回到起點
    if (!cb.crumb.length) throw new Error('苔石洞窟沒有崩塌石橋');
    const c = cb.crumb[Math.floor(cb.crumb.length / 2)]; tp(c.x, c.y + 2); G.me.hp = G.me.maxHp; const h0 = G.me.hp; step(80);
    if (!(G.me.hp < h0) || Math.hypot(G.me.x - cb.start.x, G.me.y - cb.start.y) > 4) throw new Error('站在石橋上沒有掉下去 / 沒回到起點');
    G.me.dead = false; leave(cb.d);
    log.push('  有機關的地城：' + PU.PUZZLES.map(p => p.d.name).join('、'));
  });

  run('強化：鐵匠分頁、素材 + 金幣 → +1、舊存檔武器換算', () => {
    const F = await0.forge, towns = await0.towns, sm = towns.NPCS.find(n => n.smith);
    G.me.weapon = makeItem('sword', 0, 0); recalc(G.me); const c0 = F.upCost(0, G.me.weapon); G.me.mats = { [c0.mat]: c0.n + 2 }; G.me.gold = c0.gold + 900;
    const a0 = G.me.weapon.atk, p0 = G.me.atkPow;
    tp(sm.x, sm.y + 12); step(2); shop.openShop(towns.nearSmith()); step(1);
    document.querySelector('#forgeTab').click(); document.querySelector('#shopMenu [data-fw]').click(); document.querySelector('#shopMenu [data-forge]').click(); step(1);
    if (G.me.weapon.up !== 1 || G.me.weapon.atk <= a0 || G.me.atkPow <= p0) throw new Error('強化沒有生效：up=' + G.me.weapon.up + ' atk ' + a0 + '→' + G.me.weapon.atk);
    if (G.me.mats[c0.mat] !== 2 || G.me.gold !== 900) throw new Error('沒有扣素材 / 金幣（要 ' + c0.n + ' 個 ' + c0.mat + ' + ' + c0.gold + ' 金）：' + JSON.stringify(G.me.mats) + ' ' + G.me.gold);
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
    const slot = k => document.querySelector('#invMenu [data-eq="' + k + '"]');   // 中間的裝備欄（選了東西之後點它 = 放進去）
    menus.toggleInv(); G.selItem = G.me.inv[0].id; menus.renderInv(); slot('weapon').click();
    if (G.me.weapon.fx !== 'bleed' || G.me.inv.length) throw new Error('刻印沒有裝上：' + JSON.stringify(G.me.weapon));
    G.selItem = G.me.weapon.id; menus.renderInv(); document.querySelector('#cInfo [data-act="unseal"]').click();   // 選著有刻印的武器 → 左上的選中卡有「拆下刻印」
    if (G.me.weapon.fx || G.me.inv[0]?.fx !== 'bleed') throw new Error('刻印沒有拆下來');
    // 飾品：一開始 2 格，第 3 件要換掉一件
    const rb0 = [...RB.rbDead], bd0 = G.bossDead; RB.rbDead.clear(); G.bossDead = false;   // 還沒打倒主線 Boss → 2 格
    if (menus.tSlots() !== 2) throw new Error('一開始飾品欄應該是 2 格：' + menus.tSlots());
    RB.rbDead.add('queen'); RB.rbDead.add('general'); if (menus.tSlots() !== 3) throw new Error('打倒 2 隻主線 Boss 應該變 3 格');
    RB.rbDead.clear(); for (const id of rb0) RB.rbDead.add(id); G.bossDead = bd0; const n = menus.tSlots();
    G.me.inv = [...Array(n).fill(0).map(() => I.makeTrinket('hawk')), I.makeTrinket('might')]; G.me.trinkets = [null, null, null, null];
    for (let k = 0; k < n; k++) { G.selItem = G.me.inv[0].id; menus.renderInv(); slot('t' + k).click(); }
    if (G.me.trinkets.filter(Boolean).length !== n) throw new Error('飾品沒有裝滿 ' + n + ' 格');
    G.selItem = G.me.inv[0].id; menus.renderInv(); slot('t0').click();                // 滿了：點有東西的那一格 → 換下來，舊的回背包
    if (G.me.trinkets[0]?.tk !== 'might' || G.me.inv[0]?.tk !== 'hawk') throw new Error('換飾品失敗：' + JSON.stringify(G.me.trinkets.map(t => t && t.tk)));
    if (G.me.atkPow <= P.calcStats(G.me, { weapon: G.me.weapon, armor: G.me.armor, trinkets: [] }).atk) throw new Error('力之戒沒有加攻擊');
    // 防具：重甲不會被擊退、強化 +1 防禦變高
    G.me.armor = I.makeArmor('chain'); G.me.str = 12; G.me.end = 10; recalc(G.me);
    const d0 = G.me.def, ac = F.upCost(0, G.me.armor); G.me.mats = { [ac.mat]: ac.n }; G.me.gold = ac.gold; if (!F.doUpgrade(G.me, G.me.armor)) throw new Error('防具不能強化'); recalc(G.me);
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
      if (fx === 'soul') { G.me.hp = 10; e.hp = 1; damageEnemy(G.me, e, 1, G.me.x, G.me.y); step(2); if (G.me.hp > 10) throw new Error('噬魂：魂還沒飛回來就回血了'); G.me.iframe = 5; step(60); hit = G.me.hp > 10; }   // 魂飛回主角身上才回血
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

  run('Boss 機制：時間到沒打完 → 剩幾個物件就回幾 × 5% 血、沒有破綻；物件碎掉會炸', () => {
    RB.rbDead.delete('lich'); RB.resetRegionBosses(); const e = RB.rbs.find(b => b.id === 'lich'); if (!e) throw new Error('找不到 lich');
    tp(e.def.x, e.def.y + 40); step(200, { god: true });
    const b = RB.rbs.find(b => b.id === 'lich'); b.mi = 0; b.hp = b.maxHp * .6; let k = 0; while (!b.mech && k++ < 600) step(1, { god: true }); if (!b.mech) throw new Error('機制沒發動');
    const o = b.mech.objs[0], MC = await0.mech; MC.bossHitObj(o, 2); if (!o.dead || !(b.mblast || []).length) throw new Error('物件碎掉沒有排爆炸');
    tp(o.x, o.y); G.me.iframe = 0; let hurt = false;
    for (let i = 0; i < 40; i++) { const h = G.me.hp; step(1); if (G.me.hp < h) hurt = true; G.me.dead = false; G.me.hp = G.me.maxHp; }   // 每一格補滿血（不然被打死會回營火、Boss 重置）
    if (!hurt) throw new Error('站在碎掉的物件上沒被炸到'); if (!b.mech) throw new Error('Boss 被重置了');
    tp(b.def.x, b.def.y + 40);
    const hp0 = b.hp; b.mech.t = 1e9; step(1, { god: true }); if (b.mech) throw new Error('時間到機制沒結束');
    const want = Math.round(b.maxHp * .05 * 3); if (Math.abs(b.hp - hp0 - want) > 2) throw new Error('回血不對：' + Math.round(b.hp - hp0) + '（應該 ' + want + '）');
    if (b.mStun > 0) throw new Error('時間到還給了破綻');
    b.mi = 9; b.hp = 1; b.immune = false; damageEnemy(G.me, b, 5, b.x, b.y + 20); step(120, { god: true });
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

  run('Boss 招牌招：每隻都放得出自己的招，只有史萊姆女王會跳', () => {
    setMenu(null); const was = new Set(RB.rbDead);
    const SIG = { queen: 'jump', slagmother: 'boilWind', mushking: 'spiral', toxqueen: 'mineWind', yeti: 'ballWind', sandgiant: 'twisterWind',
      dragon: 'sweep', frostwyrm: 'freezeWind', mistwitch: 'ringWind', mossguard: 'vine' };
    const PROJ = { yeti: p => p.kind === 'snowball' && p.bounce >= 0, frostwyrm: p => !!p.pause, mistwitch: p => !!p.curve };
    for (const [id, st] of Object.entries(SIG)) {
      RB.rbDead.delete(id); RB.resetRegionBosses(); const b = RB.rbs.find(e => e.id === id); if (!b) throw new Error('找不到 ' + id);
      G.projs = []; tp(b.def.x, b.def.y + 40); step(100, { god: true }); if (b.state === 'sleep') throw new Error(id + '：沒醒');
      const seen = new Set(); let projOk = !PROJ[id], left = 4000;
      while (left-- > 0 && !(seen.has(st) && projOk)) { G.me.iframe = 0; b.hp = b.maxHp; b.phase = left % 1200 < 600 ? 1 : 2;   // 滿血 → 不會觸發機制；一半時間在二階段
        step(1, { god: true }); seen.add(b.state); if (!projOk && G.projs.some(PROJ[id])) projOk = true;
        if (Math.hypot(G.me.x - b.def.x, G.me.y - b.def.y) > b.def.R - 20) tp(b.def.x, b.def.y + 40); }
      if (!seen.has(st)) throw new Error(id + '：沒放出招牌招 ' + st + '，看到的狀態：' + [...seen].join(','));
      if (!projOk) throw new Error(id + '：招牌招的子彈不對');
      if (id !== 'queen' && seen.has('jump')) throw new Error(id + '：還會跳');
      log.push('  ' + b.def.short + '：' + st);
      G.projs = []; RB.rbDead.add(id); RB.resetRegionBosses(); step(2, { god: true });
    }
    RB.rbDead.clear(); for (const x of was) RB.rbDead.add(x); RB.resetRegionBosses();
    menus.restAt(CAMPS[0]); setMenu(null); step(2, { god: true });
  });

  run('地城的規模：每座 3 個營火、2 個以上寶箱（不算 Boss 的）、3 個解謎區、格局都不一樣；在地城營火休息 → 死掉在地城裡重生；舊存檔站在舊地城 → 放到新地城入口', () => {
    const D = imp0.dg, M = await0.map, CH = await0.chests, PU = await0.puz, out = [], shapes = new Set();
    for (const d of D.DUNGEONS) { const cs = M.CAMPS.filter(c => c.dg === d.id), ch = CH.CHESTS.filter(c => D.dungeonAt(c.x, c.y) === d && c.id !== 'd_' + d.id);
      const st = PU.PUZZLES.filter(p => p.d === d && p.at !== 'secret');
      if (cs.length !== 3) throw new Error(d.name + '：營火不是 3 個（' + cs.length + '）');
      for (const c of cs) { if (D.dungeonAt(c.x, c.y) !== d) throw new Error(d.name + '：營火不在地城裡'); const s0 = { x: G.me.x, y: G.me.y }; imp0.pu.placeAtCamp(G.me, c.id); if (await0.coll.collides(G.me.x, G.me.y, G.me.r)) throw new Error(c.name + '：傳送過來會卡在牆裡'); tp(s0.x, s0.y); }
      if (ch.length < 2) throw new Error(d.name + '：寶箱少於 2 個（' + ch.length + '）');
      if (st.length !== 3 || new Set(st.map(p => p.room)).size !== 3 || new Set(st.map(p => p.at)).size !== 3) throw new Error(d.name + '：解謎區不是 3 個不同的房間');
      if (d.w < 100 || d.h < 100) throw new Error(d.name + '：太小 ' + d.w + '×' + d.h);
      shapes.add(d.lay.path.map(i => d.lay.rooms[i].ci + ',' + d.lay.rooms[i].cj).join(' '));
      out.push(d.name + ' ' + d.lay.rooms.length + '間/' + ch.length + '箱'); }
    if (shapes.size !== D.DUNGEONS.length) throw new Error('有地城的主路長得一模一樣');
    // 地城營火：靠近點燃 → 休息 → 死掉回到這裡（還在地城裡）
    const d = D.DUNGEONS[1], c = M.CAMPS.find(c => c.dg === d.id && c.id.endsWith('_1')); c.lit = false; tp(c.x + 30, c.y + 10); step(2);
    if (!c.lit) throw new Error('走到地城營火旁邊沒有點燃'); menus.restAt(c); setMenu(null); G.enemies = [];
    G.me.iframe = 0; G.me.hp = 1; G.me.souls = 0; G.me.gold = 0; hurtPlayer(G.me, 9999, G.me.x + 5, G.me.y); step(400);
    if (G.me.dead || D.dungeonAt(G.me.x, G.me.y) !== d || Math.hypot(G.me.x - c.x, G.me.y - c.y) > 40) throw new Error('死掉後沒有在地城的營火重生');
    if (await0.coll.collides(G.me.x, G.me.y, G.me.r)) throw new Error('在地城營火重生卡在牆裡');
    // 舊存檔（v12）站在舊的地城區塊裡 → 讀檔後放到新地城的入口
    const sv = serialize(), L = D.LEGACY_SLOTS.find(s => s.id === 'grotto'); sv.v = 12; sv.pos = { x: (L.x0 + 20) * 16, y: (L.y0 + 30) * 16 }; sv.lost = { x: (L.x0 + 10) * 16, y: (L.y0 + 10) * 16, amount: 5, gold: 0 };
    applySave(sv); imp0.save.placeFromSave(sv); const g2 = D.DUNGEONS.find(x => x.id === 'grotto');
    if (D.dungeonAt(G.me.x, G.me.y) !== g2) throw new Error('舊存檔站在舊地城裡，讀檔後沒有放進新地城');
    if (!G.lost || D.dungeonAt(G.lost.x, G.lost.y) !== g2) throw new Error('掉在舊地城裡的魂晶沒有搬到新地城');
    G.lost = null; G.lastCamp = 'start'; M.CAMPS.forEach(c => { if (c.dg) c.lit = false; }); imp0.pu.placeAtCamp(G.me, 'start'); imp0.pu.restoreWorld(); step(2);
    log.push('  ' + out.join('、'));
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

  run('流派飾品：月影之鈴（瞬移砍人）、血契之戒（冷卻中花血放技能）、守光騎士的誓言（被打後必暴擊）', () => {
    const E = await0.enemies, C = await0.cb; G.enemies = []; setMenu(null);
    for (const k of ['shadowbell', 'bloodpact', 'knightoath']) if (!await0.uq.UG[k]) throw new Error('沒有 ' + k);
    // 月影之鈴：朝敵人瞬移，穿過去 → 牠被砍一刀
    const e = E.makeEnemy('skel', 1, G.me.x + 30, G.me.y, { alive: true, timer: 0 }); e.hp = e.maxHp = 99999; G.enemies.push(e);
    G.me.tfx = { dodgeCut: 120 }; G.me.st = G.me.maxSt; G.me.face = 0; input.mx = 1; input.my = 0; C.tryDodge(G.me); const h = e.hp; step(12, { god: true }); input.mx = 0;
    if (!(e.hp < h)) throw new Error('月影之鈴：瞬移穿過敵人沒有砍到');
    // 血契之戒：冷卻中 → 花 10% 生命放技能；沒戴 → 放不出來
    G.me.tfx = {}; G.me.hp = G.me.maxHp; G.me.skillCd = 5; G.me.skillLock = 0; C.trySkill(G.me); if (G.me.hp !== G.me.maxHp) throw new Error('沒戴血契之戒，冷卻中也花了血');
    step(40, { god: true }); G.me.tfx = { bloodSkill: 10 }; G.me.skillCd = 5; G.me.hp = G.me.maxHp; C.trySkill(G.me);
    if (G.me.hp !== G.me.maxHp - Math.round(G.me.maxHp * .1)) throw new Error('血契之戒：冷卻中放技能沒有花 10% 生命：' + G.me.hp + '/' + G.me.maxHp);
    step(40, { god: true }); G.me.hp = 5; G.me.skillCd = 5; C.trySkill(G.me); if (G.me.hp !== 5) throw new Error('血契之戒：血不夠還是扣了');
    // 守光騎士的誓言：被打中 → 下一擊必定暴擊
    G.me.hp = G.me.maxHp; G.me.tfx = { counter: 60 }; G.me.crit = 0; G.me.iframe = 0; G.hitCtx = e.hc; hurtPlayer(G.me, 1, e.x, e.y); G.hitCtx = null;
    const n0 = G.nums.length; damageEnemy(G.me, e, 1, G.me.x, G.me.y);
    if (G.me.counterT !== 0) throw new Error('守光騎士的誓言：被打後的下一擊沒有觸發');
    G.me.tfx = {}; recalc(G.me); G.me.hp = G.me.maxHp; G.enemies = [];
  });

  run('星狼（坐騎）：打倒狼王才叫得出來、跑得比較快、按攻擊跳下來、被打摔下來、城鎮 / 地城騎不進去', () => {
    const MT = imp0.mount, Q = await0.quest, M = await0.map, keep = G.bossDead; setMenu(null); G.enemies = [];
    const camp = CAMPS.find(c => c.id === 'start'); tp(camp.x, camp.y + 16); G.me.ride = false; G.me.rideT = 0; step(2);
    G.bossDead = false; pressed.mount = true; step(40); if (G.me.ride) throw new Error('還沒打倒狼王就叫得出星狼');
    G.bossDead = true; Q.flags.delete('starwolf'); pressed.mount = true; step(40); if (!G.me.ride) throw new Error('打倒狼王後按 R 沒有騎上星狼');
    step(250); if (!Q.flags.has('starwolf')) throw new Error('第一次見到星狼的提示沒有出現');
    // 速度：找一個 140 px 內沒有障礙的方向，走路 vs 騎狼各跑 30 格
    const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]], free = d => { for (let t = 0; t <= 140; t += 4) if (await0.coll.collides(camp.x + d[0] * t, camp.y + 16 + d[1] * t, G.me.r + 2)) return false; return true; };
    const d = dirs.find(free); if (!d) throw new Error('營火四周找不到空地測速度');
    const go = () => { tp(camp.x, camp.y + 16); G.me.kx = G.me.ky = 0; input.mx = d[0]; input.my = d[1]; step(30); input.mx = input.my = 0; return Math.hypot(G.me.x - camp.x, G.me.y - camp.y - 16); };
    const dR = go(); MT.dismount(G.me); step(15); const dW = go();
    if (!(dR > dW * 1.5)) throw new Error('騎星狼沒有比較快：騎 ' + dR.toFixed(1) + ' / 走 ' + dW.toFixed(1));
    // 按攻擊 → 先跳下來，這一下照常揮
    tp(camp.x, camp.y + 16); pressed.mount = true; step(40); if (!G.me.ride) throw new Error('第二次呼喚沒騎上去');
    G.me.atkCd = 0; pressed.atk = true; step(1); if (G.me.ride || !(G.me.swing || G.me.atkCd > 0)) throw new Error('騎著按攻擊：應該跳下來並且揮刀');
    // 被打中摔下來；呼喚到一半被打也會中斷
    step(30); pressed.mount = true; step(40); G.me.iframe = 0; hurtPlayer(G.me, 1, G.me.x + 10, G.me.y); if (G.me.ride) throw new Error('被打中沒有摔下來');
    step(30); G.me.iframe = 0; pressed.mount = true; step(5); hurtPlayer(G.me, 1, G.me.x + 10, G.me.y); step(40); if (G.me.ride) throw new Error('呼喚到一半被打，還是騎上去了');
    // 騎進城鎮 → 自動下來；城鎮 / 地城裡叫不出來
    G.me.hp = G.me.maxHp; tp(camp.x, camp.y + 16); pressed.mount = true; step(40); const T = M.TOWNS[0]; tp(T.tx * 16 + 8, T.ty * 16 + 8); step(2);
    if (G.me.ride) throw new Error('騎進城鎮沒有自動下來'); pressed.mount = true; step(40); if (G.me.ride) throw new Error('城鎮裡叫得出星狼');
    const D = imp0.dg.DUNGEONS[0]; tp((D.x0 + D.w / 2) * 16, (D.y0 + D.h / 2) * 16); pressed.mount = true; step(40); if (G.me.ride) throw new Error('地城裡叫得出星狼');
    G.bossDead = keep; G.me.ride = false; tp(camp.x, camp.y + 16); step(2);
  });

  run('精靈王城：城門鎖著 → 從東牆破口繞進去（不經過精靈王）→ 拉桿開城門 → 砍牆找到密室', () => {
    const SC = await0.secrets, Q = await0.quest, M = await0.map, D = await0.dboss; setMenu(null); G.enemies = [];
    const keepRb = RB.rbDead.has('elfking'); RB.rbDead.delete('elfking'); Q.flags.delete('elf:gate'); Q.flags.delete('elf:wall'); step(2);
    const gx = (SC.GATE.x0 + 1) * 16 + 8, gy = SC.GATE.y * 16 + 8;
    if (!await0.coll.collides(gx, gy, 5)) throw new Error('城門沒有擋路');
    // 從營火走得到拉桿：只走地板、不穿過城門、不進精靈王的範圍
    const A = D.ELFKING_AT, camp = CAMPS.find(c => c.id === 'elfcourt'), W = M.MW, ok = (x, y) => M.WALKABLE(M.map[y * W + x]) && !(y === SC.GATE.y && x >= SC.GATE.x0 && x <= SC.GATE.x1) && Math.hypot(x - A.tx, y - A.ty) > A.tr + 1;
    const seen = new Set([camp.ty * W + camp.tx]), q = [[camp.tx, camp.ty]]; let found = false;
    while (q.length && !found) { const [x, y] = q.shift(); if (Math.abs(x - SC.LEVER.tx) + Math.abs(y - SC.LEVER.ty) <= 1) { found = true; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, k = Y * W + X; if (!seen.has(k) && Math.abs(X - camp.tx) < 60 && Math.abs(Y - camp.ty) < 60 && ok(X, Y)) { seen.add(k); q.push([X, Y]); } } }
    if (!found) throw new Error('從王城門前營火走不到城門內側的拉桿（繞路斷了）');
    tp(gx, gy + 22); step(1); let it = imp0.input.interactTarget(); if (!it || it.btn !== '調查') throw new Error('城門外面沒有「調查」：' + (it && it.btn));
    tp(SC.LEVER.tx * 16 + 8, SC.LEVER.ty * 16 + 30); step(1); it = imp0.input.interactTarget(); if (!it || it.btn !== '拉起') throw new Error('拉桿旁邊沒有「拉起」：' + (it && it.btn));
    it.run(); step(90, { god: true }); if (await0.coll.collides(gx, gy, 5)) throw new Error('拉了拉桿城門還是擋路');
    // 密室：面向裂痕砍一刀
    const wx = SC.CRACK.tx * 16 + 8, wy = SC.CRACK.ty * 16 + 8; G.enemies = []; G.me.dead = false; tp(wx, wy + 22); G.me.face = -Math.PI / 2; G.me.iframe = 9; G.me.atkCd = 0; pressed.atk = true; step(20, { god: true });
    if (!Q.flags.has('elf:wall') || M.map[SC.CRACK.ty * W + SC.CRACK.tx] !== M.RFLOOR) throw new Error('砍了密室的牆沒碎');
    for (const id of ['ug_shadowbell', 'ug_bloodpact', 'ug_knightoath']) if (!await0.chests.CHESTS.some(c => c.id === id)) throw new Error('沒有寶箱 ' + id);
    // 舊存檔：打倒過精靈王 → 城門算開著；旗標拿掉 → 門關、牆回來
    Q.flags.delete('elf:gate'); Q.flags.delete('elf:wall'); step(2);
    if (!await0.coll.collides(gx, gy, 5) || M.map[SC.CRACK.ty * W + SC.CRACK.tx] !== M.RWALL) throw new Error('旗標拿掉後城門 / 牆沒有恢復');
    RB.rbDead.add('elfking'); step(2); if (await0.coll.collides(gx, gy, 5)) throw new Error('打倒過精靈王，城門應該是開的');
    if (!keepRb) RB.rbDead.delete('elfking'); RB.resetRegionBosses(); tp(camp.x, camp.y + 16); step(2);
  });

  run('無名古墓的機關：尖刺、火盆謎題、鐵柵門、隱藏的牆', () => {
    const PU = await0.puz, Q = await0.quest, B = k => PU.PUZZLES.find(p => p.d.id === 'barrow' && p.kind === k), p = B('braziers'), ps = B('spikes'), pw = B('secret'); if (!p || !ps || !pw) throw new Error('沒有機關');
    if (p.braz.length !== 4 || !p.gate.length || pw.wall.length !== 3 || ps.spikes.length < 30) throw new Error('機關不完整：' + [p.braz.length, p.gate.length, pw.wall.length, ps.spikes.length]);
    Q.flags.delete('puz:barrow:fire'); Q.flags.delete('puz:barrow:wall'); recalc(G.me);
    const d = p.d; tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2); G.enemies = [];
    // 尖刺：站在尖刺上等一輪 → 一定會被刺到
    const sp = ps.spikes[Math.floor(ps.spikes.length / 2)]; tp(sp.x, sp.y + 2); G.me.hp = G.me.maxHp; const h0 = G.me.hp; step(160); G.me.dead = false;
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
    const W = pw.wallHint, n = pw.wall[1], dx = Math.sign(W.x - (n.tx * 16 + 8)) || 0;
    const wx = W.x, wy = W.y; let sx = wx, sy = wy; for (const [ox, oy] of [[0, 22], [0, -22], [22, 0], [-22, 0]]) if (!await0.coll.collides(wx + ox, wy + oy, 5)) { sx = wx + ox; sy = wy + oy; break; }
    tp(sx, sy); G.me.face = Math.atan2(wy - sy, wx - sx); G.me.iframe = 9; G.me.atkCd = 0; pressed.atk = true; step(20);
    if (!Q.flags.has('puz:barrow:wall')) throw new Error('砍了牆沒碎（站在 ' + Math.round(sx - wx) + ',' + Math.round(sy - wy) + '）');
    if (!await0.chests.CHESTS.some(c => c.id === 'pz_barrow')) throw new Error('牆後面沒有寶箱');
    // 讀檔：沒有旗標 → 門關、牆回來
    Q.flags.delete('puz:barrow:fire'); Q.flags.delete('puz:barrow:wall'); step(2);
    if (!await0.coll.collides(g.x, g.y, 5) || await0.map.map[n.ty * await0.map.MW + n.tx] !== await0.map.RWALL) throw new Error('旗標拿掉後門 / 牆沒有恢復');
    G.enemies = []; tp(d.exX, d.exY); step(1); imp0.input.enterDoor(); step(2); void dx;
  });

  run('每座地城的招牌機關（潮汐、蛛網、強風、推石、冷卻熔岩、冰面、寒氣、蘑菇、迷宮、潛行、熔爐、鏡子）', () => {
    const PU = await0.puz, Q = await0.quest, M = await0.map, P = (id, k) => PU.PUZZLES.find(p => p.d.id === id && p.kind === k), out = [];
    const enter = d => { tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2); G.enemies = []; G.me.hp = G.me.maxHp; await0.status.clearStatus(G.me); };
    const leave = d => { G.enemies = []; G.me.dead = false; tp(d.exX, d.exY); step(1); imp0.input.enterDoor(); step(2); await0.status.clearStatus(G.me); };
    const use = (x, y, btn) => { for (const [ox, oy] of [[0, 16], [0, -16], [16, 0], [-16, 0], [0, 12]]) { if (await0.coll.collides(x + ox, y + oy, 5)) continue; tp(x + ox, y + oy); step(1); const it = imp0.input.interactTarget(); if (it && it.btn === btn) { it.run(); return true; } } throw new Error('找不到「' + btn + '」'); };
    // 每座地城：機關全部解開 → 從入口走得到 Boss 大廳和寶物房；鐵柵門關著 → 走不到（沒有別的路繞過去）。陷阱房當作走得過（冷卻熔岩先凝固、蘑菇 = 傳送點）
    const D = imp0.dg, gates = d => PU.PUZZLES.filter(p => p.d === d && p.fkey);
    const reach = (d, tgt) => { const I = (x, y) => y * M.MW + x, sx = Math.floor(d.inX / 16), sy = Math.floor(d.inY / 16), seen = new Set([I(sx, sy)]), q = [[sx, sy]];
      const ok = (x, y) => M.WALKABLE(M.map[I(x, y)]) && !M.PROPS.some(pp => pp.r > 0 && Math.hypot(pp.x - x * 16 - 8, pp.y - y * 16 - 8) < pp.r + 3);
      const jp = PU.PUZZLES.find(p => p.d === d && p.m.jump), pads = jp ? jp.m.jump.pads.filter(pd => !pd.rot) : [];
      while (q.length) { const [x, y] = q.shift(); if (Math.abs(x - tgt.x) <= 1 && Math.abs(y - tgt.y) <= 1) return true;
        const nx = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [x + a, y + b]);
        for (const pd of pads) if (Math.floor(pd.x / 16) === x && Math.floor(pd.y / 16) === y) nx.push([Math.floor(pd.to.x / 16), Math.floor(pd.to.y / 16)]);
        for (const [a, b] of nx) { const k = I(a, b); if (seen.has(k) || !ok(a, b)) continue; seen.add(k); q.push([a, b]); } }
      return false; };
    const cool = on => { for (const p of PU.PUZZLES) if (p.m.cool) for (const [tx, ty] of p.m.cool.river) M.map[ty * M.MW + tx] = on ? M.GROUND : M.LAVA; };
    cool(true); for (const d of D.DUNGEONS) for (const p of gates(d)) Q.flags.add(p.fkey); step(90);
    for (const d of D.DUNGEONS) { const H = d.lay.hall, T = d.lay.rooms[d.lay.treasure];
      if (!reach(d, { x: H.x, y: H.y })) throw new Error(d.name + '：解開機關後，從入口走不到 Boss 大廳');
      if (!reach(d, T)) throw new Error(d.name + '：解開機關後，走不到寶庫的寶物房');
      for (const ri of d.lay.ends) if (!reach(d, d.lay.rooms[ri])) throw new Error(d.name + '：有一條岔路走不到'); }
    for (const d of D.DUNGEONS) for (const p of gates(d)) Q.flags.delete(p.fkey); step(2);
    for (const d of D.DUNGEONS) { if (reach(d, { x: d.lay.hall.x, y: d.lay.hall.y })) throw new Error(d.name + '：鐵柵門關著也走得到 Boss 大廳（有別的路繞過去）');
      if (reach(d, d.lay.rooms[d.lay.treasure])) throw new Error(d.name + '：寶庫的鐵柵門關著也走得到寶物房'); }
    cool(false); step(2); out.push('路線 OK ×' + D.DUNGEONS.length);
    // 潮汐：漲潮時站在會淹水的地方 → 被沖到石島
    { const p = P('grotto', 'tide'), st = p.m.tide; enter(p.d); const k = [...st.wet][Math.floor(st.wet.size / 2)], wx = (k % M.MW) * 16 + 8, wy = Math.floor(k / M.MW) * 16 + 8;
      while ((G.time % 7.9) < 4.8) step(1); tp(wx, wy + 2); const h = G.me.hp; step(3); G.me.dead = false;
      if (!(G.me.hp < h) || Math.hypot(G.me.x - wx, G.me.y - wy) < 10) throw new Error('漲潮沒有把人沖走'); leave(p.d); out.push('潮汐'); }
    // 蛛網：踩到被纏住；取火 → 燒網；拿火碰巨網 → 開門
    { const p = P('nest', 'webs'), st = p.m.webs, pb = P('nest', 'webs3'); enter(p.d); const k = [...st.webs.keys()].find(k => st.webs.get(k) === 0), x = (k % M.MW) * 16 + 8, y = Math.floor(k / M.MW) * 16 + 8;
      tp(x, y + 2); step(2); if (!(G.me.sx && G.me.sx.root > 0)) throw new Error('踩到蛛網沒有被纏住'); await0.status.clearStatus(G.me);
      const t = st.tor[0]; use(t.x, t.y, '取火'); tp(x, y + 2); step(50); if (st.webs.get(k) !== -1) throw new Error('拿著火網沒有燒掉');
      const g = pb.gate[1]; tp(g.x, g.y + 24); step(3); if (!Q.flags.has('puz:nest:fire')) throw new Error('拿著火碰巨網沒有開門'); leave(p.d); out.push('蛛網'); }
    // 強風：颳風時會被推走
    { const p = P('windcave', 'wind'), st = p.m.wind; enter(p.d); const r = st.r, sx = r.x * 16 + 8, sy = (r.y + r.ry) * 16 + 4, WT_ = 5.9;   // 一輪 = 平靜 2.6 + 預警 0.9 + 颳風 2.4 秒（world/puz2.ts 的 WIND）
      const shielded = d => st.rocks.some(k => (k.x - sx) * d < 0 && Math.abs(k.x - sx) < 40 && Math.abs(k.y - sy) < 12) || await0.coll.collides(sx + d * 12, sy, 5);   // 上風有石頭擋、或下風是牆 → 推不動
      const dir = shielded(1) ? -1 : 1; if (shielded(dir)) throw new Error('強風房的測試位置兩邊都推不動，換個位置');
      let cyc = Math.floor(G.time / WT_) + 2; if ((cyc % 2 ? -1 : 1) !== dir) cyc++; G.time = cyc * WT_ + 3.6;   // 遊戲裡第偶數輪往右吹、奇數輪往左吹
      tp(sx, sy); const x0 = G.me.x; step(10); if (Math.abs(G.me.x - x0) < 3) throw new Error('颳風沒有推人（往 ' + dir + ' 吹，只移動 ' + (G.me.x - x0).toFixed(1) + '）'); leave(p.d); out.push('強風'); }
    // 推石：把兩塊石頭推到壓力板
    { const p = P('sandtemple', 'boulders'), st = p.m.boulders, inp = imp0.inp; enter(p.d);
      const push = (b, dx, dy, n) => { for (let i = 0; i < n; i++) { tp(b.x - dx * 15, b.y - dy * 15 + 2); input.mx = dx; input.my = dy; step(20); input.mx = input.my = 0; step(14); } };
      const [b1, b2] = st.bs; push(b1, 1, 0, 2); push(b1, 0, -1, 2); push(b2, -1, 0, 2); push(b2, 0, -1, 2); step(3); void inp;
      if (!Q.flags.has('puz:sandtemple:fire')) throw new Error('石頭推到壓力板上門沒開：' + st.bs.map(b => b.tx - st.r.x + ',' + (b.ty - st.r.y)).join(' ')); leave(p.d); out.push('推石'); }
    // 冷卻熔岩：敲冰晶 → 熔岩變地板 → 6 秒後變回來
    { const p = P('obsidian', 'cool'), st = p.m.cool; enter(p.d); const [tx, ty] = st.river[3]; use(st.cr[0].x, st.cr[0].y, '敲擊');
      if (M.map[ty * M.MW + tx] !== M.GROUND) throw new Error('敲了冰晶熔岩沒有凝固'); step(400); if (M.map[ty * M.MW + tx] !== M.LAVA) throw new Error('熔岩沒有流回來'); leave(p.d); out.push('冷卻熔岩'); }
    // 冰面：放開方向鍵還會一直滑
    { const p = P('icecave', 'ice'), st = p.m.ice; enter(p.d); const r = st.r; let sx = r.x * 16 + 8, sy = r.y * 16 + 8;
      for (const k of st.ice) if (!st.holes.has(k) && !st.holes.has(k + 1) && !st.holes.has(k + 2) && !st.holes.has(k + 3)) { sx = (k % M.MW) * 16 + 8; sy = Math.floor(k / M.MW) * 16 + 10; break; }
      tp(sx, sy); input.mx = 1; step(20); input.mx = 0; const x1 = G.me.x; step(6); if (!(G.me.x > x1 + 1)) throw new Error('冰面上放開方向鍵就停了（沒有滑）'); leave(p.d); out.push('冰面'); }
    // 寒氣：待在房裡會累積凍傷；點完 4 個火盆 → 開門
    { const p = P('frostcrypt', 'cold3'), st = p.m.cold3; enter(p.d); const r = st.r; tp(r.x * 16 + 8, (r.y + 2) * 16 + 8);
      for (const b of st.braz) b.lit = false; step(60); if (!(G.me.sx && (G.me.sx.frost > 0 || G.me.sx.frozen > 0))) throw new Error('寒氣沒有累積凍傷'); await0.status.clearStatus(G.me);
      for (const b of st.braz) use(b.x, b.y, '點燃'); step(2); if (!Q.flags.has('puz:frostcrypt:fire')) throw new Error('四個火盆都點亮門沒開'); leave(p.d); out.push('寒氣'); }
    // 蘑菇：好的 → 飛到別的島；爛的 → 掉進毒沼、回到入口
    { const p = P('rotcave', 'jump'), st = p.m.jump; enter(p.d); const good = st.pads[0], bad = st.pads.find(q => q.rot);
      tp(good.x, good.y + 2); step(60); if (Math.hypot(G.me.x - good.to.x, G.me.y - good.to.y) > 6) throw new Error('踩好的蘑菇沒有飛到對的島');
      tp(bad.x, bad.y + 2); const h = G.me.hp; step(60); if (!(G.me.hp < h) || Math.hypot(G.me.x - st.back.x, G.me.y - st.back.y) > 6) throw new Error('踩爛的蘑菇沒有掉下去'); leave(p.d); out.push('蘑菇'); }
    // 黑暗迷宮：在裡面畫面會變黑
    { const p = P('sunkgrotto', 'maze'), st = p.m.maze; enter(p.d); const pr = st.pearls[0] || { x: st.r.x * 16 + 8, y: st.r.y * 16 + 8 }; tp(pr.x, pr.y + 2); step(2);
      if (!PU.puzzleDark(G.me)) throw new Error('迷宮裡沒有變黑'); leave(p.d); out.push('迷宮'); }
    // 潛行：被亡衛看到 → 鐘響、拉桿鎖住；沒被看到 → 拉下開門
    { const p = P('undercroft', 'stealth'), st = p.m.stealth; enter(p.d); const g = st.gs[0];
      g.i = 0; g.x = g.pts[0].x; g.y = g.pts[0].y; g.wait = 0; g.spd = 0; st.alarm = 0; step(1);   // 亡衛停在起點、面向下一個點：結果不再看運氣
      tp(g.x + Math.cos(g.a) * 40, g.y + Math.sin(g.a) * 40 + 2); step(2);
      if (!(st.alarm > 0)) throw new Error('站在亡衛面前沒有被發現'); G.enemies = [];
      use(st.lever.x, st.lever.y, '拉下'); if (Q.flags.has('puz:undercroft:fire')) throw new Error('鐘響時拉桿還拉得動');
      st.alarm = 0; for (const q of st.gs) { q.x = -9999; q.pts.forEach(pt => { pt.x = -9999; pt.y = -9999; }); } use(st.lever.x, st.lever.y, '拉下');
      if (!Q.flags.has('puz:undercroft:fire')) throw new Error('沒被發現時拉桿拉不下來'); leave(p.d); out.push('潛行'); }
    // 熔爐：輸送帶會推人；拉桿開門
    { const p = P('forgeruin', 'forge'), st = p.m.forge; enter(p.d); const [ty, dir] = [...st.belts][0]; const r = st.r; let tx = r.x - 2; while (!(await0.map.WALKABLE(M.map[ty * M.MW + tx]))) tx++;
      tp(tx * 16 + 8, ty * 16 + 10); G.me.iframe = 99; const x0 = G.me.x; step(20); if (Math.sign(G.me.x - x0) !== dir) throw new Error('輸送帶沒有推人'); G.me.iframe = 0;
      use(st.lever.x, st.lever.y, '拉下'); if (!Q.flags.has('puz:forgeruin:fire')) throw new Error('熔爐的拉桿沒開門'); leave(p.d); out.push('熔爐'); }
    // 鏡子：試所有方向組合，打到水晶 → 開門
    { const p = P('temple', 'mirrors'), st = p.m.mirrors; enter(p.d); let solved = false;
      for (let m = 0; m < 32 && !solved; m++) { st.ms.forEach((q, i) => q.m = (m >> i) & 1); step(1); solved = Q.flags.has('puz:temple:fire'); }
      if (!solved) throw new Error('鏡子怎麼轉都打不到水晶'); leave(p.d); out.push('鏡子'); }
    log.push('  ' + out.join('、'));
  });

  run('每一個有門的解謎區都解得開（火盆、符文踏板、雕像、推石、鏡子、寒氣火盆、巨網、潛行、熔爐、月光花、牆中之眼、鑰匙、試煉、記憶石板、幽火、燈陣、冰磚）', () => {
    const PU = await0.puz, Q = await0.quest, out = {};
    const enter = d => { tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2); G.enemies = []; G.me.hp = G.me.maxHp; await0.status.clearStatus(G.me); };
    const leave = d => { G.enemies = []; G.me.dead = false; tp(d.exX, d.exY); step(1); imp0.input.enterDoor(); step(2); await0.status.clearStatus(G.me); };
    const it0 = f => f();
    const use = (x, y, btn) => { for (const [ox, oy] of [[0, 16], [0, -16], [16, 0], [-16, 0], [0, 12], [12, 12], [-12, 12], [0, 28], [0, 22]]) { if (await0.coll.collides(x + ox, y + oy, 5)) continue; tp(x + ox, y + oy); step(1); const it = imp0.input.interactTarget(); if (it && it.btn === btn) { it.run(); return true; } } throw new Error('找不到「' + btn + '」'); };
    for (const p of PU.PUZZLES) { if (!p.fkey) continue; const d = p.d, name = d.name + '的' + p.kind + '（' + p.at + '）';
      Q.flags.delete(p.fkey); step(2); for (const k in p.m) PU.MECHS[k].reset?.(p, p.m[k]); enter(d); G.me.iframe = 99;
      if (p.kind === 'braziers') { for (const b of p.braz) b.lit = false; p.got = 0; for (const s2 of p.order) { const b = p.braz.find(x => x.sym === s2); use(b.x, b.y, '點燃'); G.enemies = []; } }
      else if (p.kind === 'simon') { use(p.stone.x, p.stone.y, '觸摸'); step(Math.ceil(p.seq.length * .85 * 60) + 10); for (const k of p.seq) { tp(p.stone.x, p.stone.y + 30); step(2); tp(p.plates[k].x, p.plates[k].y + 2); step(2); } }
      else if (p.kind === 'statues') { const n = p.stats.length, solve = (dep, off) => { if (off.every(o => o === 0)) return []; if (!dep) return null; for (let i = 0; i < n; i++) { const o2 = [...off]; o2[i] = (o2[i] + 1) % 4; o2[(i + 1) % n] = (o2[(i + 1) % n] + 1) % 4; const r = solve(dep - 1, o2); if (r) return [i, ...r]; } return null; };
        let mv = null; for (let k = 1; k <= 8 && !mv; k++) mv = solve(k, [...p.off]); if (!mv) throw new Error(name + '：解不開'); for (const i of mv) use(p.stats[i].x, p.stats[i].y, '轉動'); }
      else if (p.kind === 'boulders') { const st = p.m.boulders, push = (b, dx, dy, n) => { for (let i = 0; i < n; i++) { tp(b.x - dx * 15, b.y - dy * 15 + 2); input.mx = dx; input.my = dy; step(20); input.mx = input.my = 0; step(14); } };
        const [b1, b2] = st.bs; push(b1, 1, 0, 2); push(b1, 0, -1, 2); push(b2, -1, 0, 2); push(b2, 0, -1, 2); step(3); }
      else if (p.kind === 'mirrors') { const st = p.m.mirrors; for (let m = 0; m < 32 && !Q.flags.has(p.fkey); m++) { st.ms.forEach((q, i) => q.m = (m >> i) & 1); step(1); } }
      else if (p.kind === 'cold3') { for (const b of p.m.cold3.braz) use(b.x, b.y, '點燃'); step(2); }
      else if (p.kind === 'webs3') { const w = PU.PUZZLES.find(q => q.d === d && q.m.webs); use(w.m.webs.tor[0].x, w.m.webs.tor[0].y, '取火'); const g = p.gate[1]; tp(g.x, g.y + (p.outD.side === 3 ? 24 : -24)); step(3); }
      else if (p.kind === 'stealth') { const st = p.m.stealth; st.alarm = 0; const keep = st.gs.map(q => ({ x: q.x, y: q.y, pts: q.pts.map(pt => ({ ...pt })) })); for (const q of st.gs) { q.x = -9999; q.pts.forEach(pt => { pt.x = -9999; pt.y = -9999; }); }
        use(st.lever.x, st.lever.y, '拉下'); st.gs.forEach((q, i) => { q.x = keep[i].x; q.y = keep[i].y; q.pts = keep[i].pts; }); }
      else if (p.kind === 'forge') use(p.m.forge.lever.x, p.m.forge.lever.y, '拉下');
      else if (p.kind === 'moonflowers') { for (const f of p.m.moonflowers.fl) use(f.x, f.y, '敲'); step(2); }
      else if (p.kind === 'eyes') { const st = p.m.eyes; if (st.eyes.length !== 3) throw new Error(name + '：牆裡的眼睛不是 3 隻（' + st.eyes.length + '）');
        for (const e of st.eyes) Q.flags.delete('puz:' + d.id + ':eye' + e.i); step(2); if (p.gateOpen) throw new Error(name + '：眼睛都還睜著門就開了');
        for (const e of st.eyes) { tp(e.x, e.y + 26); if (await0.coll.collides(G.me.x, G.me.y, 5)) throw new Error(name + '：眼睛下面站不了人'); G.me.face = Math.atan2(e.y + 8 - G.me.y, e.x - G.me.x); G.me.atkCd = 0; pressed.atk = true; step(20); if (!Q.flags.has('puz:' + d.id + ':eye' + e.i)) throw new Error(name + '：砍了眼睛沒閉上 swing=' + !!G.me.swing + ' face=' + G.me.face.toFixed(2) + ' it=' + (imp0.input.interactTarget()?.text)); }
        step(2); }
      else if (p.kind === 'key') { const st = p.m.key; Q.flags.delete('puz:' + d.id + ':key'); st.drop = null; it0(() => use(st.lock.x, st.lock.y, '查看'));
        tp(st.home.x, st.home.y + 60); step(3); if (!st.e || !st.e.elite) throw new Error(name + '：走近了沒有持鑰的守衛'); const e = st.e; e.hp = 1; damageEnemy(G.me, e, 99, e.x, e.y); step(10);
        if (!st.drop) throw new Error(name + '：守衛倒下沒有掉鑰匙'); tp(st.drop.x, st.drop.y); step(2); if (!Q.flags.has('puz:' + d.id + ':key')) throw new Error(name + '：撿不到鑰匙');
        use(st.lock.x, st.lock.y, '開鎖'); }
      else if (p.kind === 'trial') { const st = p.m.trial; tp(p.room.x * 16 + 8, p.room.y * 16 + 8); step(3); if (!st.on || !st.bar.every(b => b.r > 0)) throw new Error(name + '：走進去試煉沒開始 / 入口沒封住');
        for (let k = 0; k < 40 && !Q.flags.has(p.fkey); k++) { for (const e of st.foes) if (e.hp > 0) { e.hp = 1; damageEnemy(G.me, e, 99, e.x, e.y); } step(90, { god: true }); tp(p.room.x * 16 + 8, p.room.y * 16 + 8); }
        if (st.bar.some(b => b.r > 0)) throw new Error(name + '：試煉結束了入口還封著'); }
      else if (p.kind === 'pairs') { const st = p.m.pairs, off = () => { tp(p.room.x * 16 + 8, (p.room.y - p.room.ry) * 16 + 10); step(2); };
        off(); const a0 = st.slabs.findIndex(q => q.sym === st.slabs[0].sym), b0 = st.slabs.findIndex(q => q.sym !== st.slabs[0].sym);
        tp(st.slabs[a0].x, st.slabs[a0].y + 2); step(2); off(); tp(st.slabs[b0].x, st.slabs[b0].y + 2); step(2); off(); if (st.slabs.some(q => q.done)) throw new Error(name + '：配錯了還亮著'); step(70);
        for (const sym of ['moon', 'sun', 'star', 'eye']) for (const q of st.slabs.filter(q => q.sym === sym)) { tp(q.x, q.y + 2); step(2); off(); } }
      else if (p.kind === 'wisp') { const st = p.m.wisp; use(st.altar.x, st.altar.y, '點亮'); if (!st.w) throw new Error(name + '：點亮祭壇沒有幽火');
        for (let k = 0; k < 900 && st.w; k++) { tp(st.w.x, st.w.y + 12); step(1); } }
      else if (p.kind === 'lightsout') { const st = p.m.lightsout; let sol = -1;
        for (let m = 0; m < 32 && sol < 0; m++) { const on = [...st.on]; for (let i = 0; i < 5; i++) if (m >> i & 1) for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < 5) on[j] ^= 1; if (on.every(v => v)) sol = m; }
        if (sol < 0) throw new Error(name + '：燈陣解不開'); for (let i = 0; i < 5; i++) if (sol >> i & 1) use(st.lev[i].x, st.lev[i].y, '拉'); }
      else if (p.kind === 'iceblock') { const st = p.m.iceblock, b = st.b, r = p.room, M = await0.map, free = (x, y) => Math.abs(x - r.x) <= r.rx && Math.abs(y - r.y) <= r.ry && M.WALKABLE(M.map[y * M.MW + x]) && !st.blocked.has(y * M.MW + x);
        const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]], k0 = b.tx + ',' + b.ty, prev = new Map([[k0, null]]), q = [[b.tx, b.ty]];
        while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of D4) { if (!free(x - dx, y - dy)) continue; let nx = x, ny = y; while (free(nx + dx, ny + dy)) { nx += dx; ny += dy; } const k = nx + ',' + ny; if ((nx !== x || ny !== y) && !prev.has(k)) { prev.set(k, [x, y, dx, dy]); q.push([nx, ny]); } } }
        const moves = []; let k = st.goal.tx + ',' + st.goal.ty; if (!prev.has(k)) throw new Error(name + '：冰磚推不到冰紋上'); while (prev.get(k)) { const [x, y, dx, dy] = prev.get(k); moves.unshift([dx, dy]); k = x + ',' + y; }
        for (const [dx, dy] of moves) { tp(b.x - dx * 15, b.y - dy * 15 + 2); input.mx = dx; input.my = dy; step(20); input.mx = input.my = 0; for (let t = 0; t < 200 && (b.vx || b.vy); t++) step(1); step(2); } }
      else throw new Error(name + '：測試不知道怎麼解');
      if (!Q.flags.has(p.fkey)) throw new Error(name + '：照正確的方法做了，門沒開'); step(90);
      if (p.gate.some(g => await0.coll.collides(g.x, g.y, 5))) throw new Error(name + '：門開了還擋路');
      out[p.kind] = (out[p.kind] || 0) + 1; G.me.iframe = 0; leave(d); }
    log.push('  ' + Object.entries(out).map(([k, n]) => k + '×' + n).join('、'));
  });

  run('新的陷阱房：火輪、滾石、凝視石像、落石、交替石板、幽靈之橋、箭陣（每座地城的陷阱房都不一樣）', () => {
    const PU = await0.puz, D = imp0.dg, P = (id, k) => PU.PUZZLES.find(p => p.d.id === id && p.kind === k), out = [];
    const traps = D.DUNGEONS.map(d => D.PUZ[d.id].trap); if (new Set(traps).size !== traps.length) throw new Error('有兩座地城的陷阱房一樣：' + traps.join(','));
    const enter = d => { tp(d.ent[0] * 16 + 8, (d.ent[1] + 1) * 16 + 10); step(1); imp0.input.enterDoor(); step(2); G.enemies = []; G.me.hp = G.me.maxHp; await0.status.clearStatus(G.me); };
    const leave = d => { G.enemies = []; G.me.dead = false; G.me.hp = G.me.maxHp; tp(d.exX, d.exY); step(1); imp0.input.enterDoor(); step(2); await0.status.clearStatus(G.me); };
    const hurts = (n, put) => { G.me.hp = G.me.maxHp; G.me.iframe = 0; const h = G.me.hp; for (let i = 0; i < n && G.me.hp >= h; i++) { put(); step(1); } const ok = G.me.hp < h; G.me.dead = false; G.me.hp = G.me.maxHp; return ok; };
    const atStart = p => Math.hypot(G.me.x - (p.inD.x * 16 + 8), G.me.y - (p.inD.y * 16 + 8)) < 6;
    { const p = P('lavatube', 'firebar'), q = p.m.firebar.piv[0]; enter(p.d); if (!hurts(400, () => { if (!(G.me.iframe > 0)) tp(q.x + 34, q.y); })) throw new Error('站在火輪旁邊沒被燒到'); leave(p.d); out.push('火輪'); }
    { const p = P('sandtemple', 'rollstone'), st = p.m.rollstone; enter(p.d); const r = st.r; if (!hurts(900, () => { if (st.cur) tp(r.x * 16 + 8, st.cur.y + 4); else tp(r.x * 16 + 8, r.y * 16 + 8); })) throw new Error('站在溝上沒被滾石撞到'); leave(p.d); out.push('滾石'); }
    { const p = P('undercroft', 'gaze'), st = p.m.gaze; enter(p.d); const r = st.r; let hit = false;
      for (const [ox, oy] of [[0, 0], [-4, 2], [4, -2], [2, 3], [-3, -3], [5, 3]]) { const x = (r.x + ox) * 16 + 8, y = (r.y + oy) * 16 + 8; if (await0.coll.collides(x, y, 5)) continue;
        G.time = Math.ceil(G.time / 5.4) * 5.4 + 3.6; tp(x, y); input.mx = .8; step(3); input.mx = 0; if (atStart(p)) { hit = true; break; } }
      input.mx = 0; if (!hit) throw new Error('石像看著的時候亂動沒被打回入口');
      G.time = Math.ceil(G.time / 5.4) * 5.4 + 1; tp(r.x * 16 + 8, r.y * 16 + 8); input.mx = .8; step(3); input.mx = 0; if (atStart(p)) throw new Error('石像背對著也被打回入口'); leave(p.d); out.push('凝視石像'); }
    { const p = P('roots', 'rockfall'), r = p.room; enter(p.d); if (!hurts(400, () => tp(r.x * 16 + 8, r.y * 16 + 8))) throw new Error('落石迴廊站著不動沒被砸到'); leave(p.d); out.push('落石'); }
    { const p = P('forgeruin', 'alternate'), st = p.m.alternate; enter(p.d); const t = [...st.tiles.values()].find(t => t.set === 0); if (!t) throw new Error('交替石板沒有會沉的石板');
      G.time = Math.ceil(G.time / 4.4) * 4.4 + 1; tp(t.tx * 16 + 8, t.ty * 16 + 10); step(2); if (atStart(p)) throw new Error('石板浮著的時候站上去就掉下去了');
      G.time = Math.ceil(G.time / 4.4) * 4.4 + 3; step(2); if (!atStart(p)) throw new Error('石板沉下去了還站得住'); leave(p.d); out.push('交替石板'); }
    { const p = P('temple', 'ghostbridge'), st = p.m.ghostbridge, r = p.room, M = await0.map; enter(p.d);
      let off = null; for (let ty = r.y - r.ry; ty <= r.y + r.ry && !off; ty++) for (let tx = r.x - r.rx; tx <= r.x + r.rx; tx++) if (!st.path.has(ty * M.MW + tx) && M.WALKABLE(M.map[ty * M.MW + tx]) && !await0.coll.collides(tx * 16 + 8, ty * 16 + 10, 5)) { off = [tx, ty]; break; }
      tp(off[0] * 16 + 8, off[1] * 16 + 10); step(2); if (!atStart(p)) throw new Error('踩到橋外面沒有掉下去');
      const [cx, cy] = st.cells[4]; tp(cx * 16 + 8, cy * 16 + 10); step(2); if (atStart(p)) throw new Error('站在看不見的橋上也掉下去了');
      const s0 = st.stones[0]; tp(s0.x, s0.y + 2); step(1); const it = imp0.input.interactTarget(); if (!it || it.btn !== '觸摸') throw new Error('發光的石頭摸不到'); it.run(); if (!(st.lit > 0)) throw new Error('摸了石頭橋沒亮'); leave(p.d); out.push('幽靈之橋'); }
    { const p = P('mothwood', 'arrows'), st = p.m.arrows; enter(p.d); const q = [...st.plates.values()][0]; if (!q) throw new Error('箭陣沒有壓力板');
      if (!hurts(120, () => { if (!st.arrows.length) { tp(q.tx * 16 + 8, (q.ty - 1) * 16 + 10); step(1); tp(q.tx * 16 + 8, q.ty * 16 + 10); } })) throw new Error('踩到壓力板沒被箭射到'); leave(p.d); out.push('箭陣'); }
    log.push('  ' + out.join('、'));
  });

  run('重生水滴：找修女洗點 → 能力值回到 5 → 點數到營火重新分配', () => {
    const towns = await0.towns, n = towns.NPCS.find(n => n.town === 'dawn' && n.respec); if (!n) throw new Error('晨風鎮沒有修女');
    if (towns.NPCS.filter(n => n.respec).length !== 3) throw new Error('洗點的 NPC 不是三個（晨風鎮、霜歌鎮、銀葉城）');
    const me = G.me, s0 = { str: me.str, dex: me.dex }; me.str = 25; me.dex = 20; recalc(me); const lv = (me.vit + me.end + me.str + me.dex + me.int + me.luk - 29) + (me.freePts || 0);
    me.tears = 0; tp(n.x, n.y + 16); step(2); let it = imp0.input.interactTarget(); if (it && it.btn === '洗點') throw new Error('沒有重生水滴也能洗點');
    me.tears = 1; step(1); it = imp0.input.interactTarget(); if (!it || it.btn !== '洗點') throw new Error('站在修女旁邊沒有「洗點」：' + (it && it.btn)); it.run(); step(1);
    it = imp0.input.interactTarget(); if (!it || it.btn !== '確定') throw new Error('洗點沒有先確認'); it.run(); step(1);
    if (me.str !== 5 || me.dex !== 5 || me.tears !== 0) throw new Error('洗完能力值沒有回到 5 / 水滴沒扣：' + me.str + ' ' + me.tears);
    if (me.freePts !== lv - 1) throw new Error('免費點數不對：' + me.freePts + '（應該 ' + (lv - 1) + '）');
    me.freePts = 0; me.str = s0.str; me.dex = s0.dex; recalc(me);
  });

  run('精靈王國：島、三座橋走得到、銀葉城、月泉的金箱、月光花機關', () => {
    const M = await0.map, PU = await0.puz, Q = await0.quest, C = await0.chests, I = (x, y) => y * M.MW + x;
    let n = 0; for (let i = 0; i < M.MW * M.MH; i++) if (M.reg[i] === 8) n++; if (n < 4000) throw new Error('精靈王國太小：' + n + ' 格');
    const seen = new Uint8Array(M.MW * M.MH), q = [I(118, 573)]; seen[q[0]] = 1;            // 從起點走得到島上的三個營火、王城門口、地城洞口
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % M.MW, y = (i / M.MW) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = I(x + a, y + b); if (!seen[j] && M.WALKABLE(M.map[j])) { seen[j] = 1; q.push(j); } } }
    for (const id of ['elfbridge', 'elfspring', 'elfcourt']) { const c = M.CAMPS.find(c => c.id === id); if (!seen[I(c.tx, c.ty + 1)]) throw new Error('走不到營火 ' + id); }
    if (!seen[I(366, 450)]) throw new Error('走不到精靈王的王座中庭'); if (!seen[I(380, 479)]) throw new Error('走不到螢月禁林的洞口'); if (!seen[I(334, 433)]) throw new Error('走不到月泉的湖心島');
    if (M.spawns.filter(s => M.reg[I(s.tx, s.ty)] === 8).length < 100) throw new Error('精靈王國的怪太少');
    const ch = C.CHESTS.find(c => c.id === 'c_elfspring'); ch.opened = false; tp(ch.x, ch.y + 14); step(2); C.openChest(G.me, ch); step(2);
    if (!(G.drops.some(d => d.item && d.item.uq === 'elfrapier') || G.me.inv.some(x => x.uq === 'elfrapier'))) throw new Error('月泉的金箱沒有掉出精靈細劍');
    const p = PU.PUZZLES.find(p => p.d.id === 'mothwood' && p.kind === 'moonflowers'); if (!p || !p.m.moonflowers) throw new Error('螢月禁林沒有月光花');
    Q.flags.delete('puz:mothwood:fire'); p.gateOpen = false; const st = p.m.moonflowers; for (const f of st.fl) f.t = 0; step(2);
    st.fl[0].t = 9; st.fl[1].t = 9; st.fl[2].t = 9; step(2); if (p.gateOpen) throw new Error('三朵就開門了');
    st.fl[3].t = 9; step(2); if (!p.gateOpen) throw new Error('四朵同時開，門沒有開');
    log.push('  精靈王國 ' + n + ' 格、怪 ' + M.spawns.filter(s => M.reg[I(s.tx, s.ty)] === 8).length + ' 隻');
    const c0 = M.CAMPS[0]; tp(c0.x + 30, c0.y + 20); G.enemies = G.enemies.filter(e => e.rb); G.drops.length = 0; G.coins.length = 0; step(30);   // 回到起點，別讓島上的怪影響下一個測試
  });

  run('死亡 → 重生：魂晶和金幣掉 80%、撿回來；死在 Boss 結界裡，那包放在結界外面', () => {
    const die = () => { G.me.iframe = 0; G.me.hp = 1; hurtPlayer(G.me, 9999, G.me.x + 5, G.me.y); step(400); if (G.me.dead) throw new Error('沒有重生'); };
    // 野外：1000 魂晶、500 金幣 → 身上剩 200 / 100，那包是 800 / 400，走回去全部拿回來
    G.lost = null; G.me.souls = 1000; G.me.gold = 500; const x0 = G.me.x, y0 = G.me.y; die();
    if (G.me.souls !== 200 || G.me.gold !== 100) throw new Error('死掉後身上應該剩 20%：' + G.me.souls + ' / ' + G.me.gold);
    if (!G.lost || G.lost.amount !== 800 || G.lost.gold !== 400 || Math.hypot(G.lost.x - x0, G.lost.y - y0) > 4) throw new Error('掉的那包不對：' + JSON.stringify(G.lost));
    tp(G.lost.x, G.lost.y); step(2); if (G.lost || G.me.souls !== 1000 || G.me.gold !== 500) throw new Error('撿回來後沒有全部拿回：' + G.me.souls + ' / ' + G.me.gold);
    // Boss 結界：先站在結界外，再走到正中間死掉 → 那包在最後站在外面的地方
    const rb = RB.rbs.find(e => !e.dead && !e.def.dg), d = rb.def; G.me.souls = 300;
    tp(d.x + d.R + 30, d.y); step(2); const sx = G.me.safeX, sy = G.me.safeY;
    if (sx === undefined || Math.hypot(sx - d.x, sy - d.y) < d.R + 8) throw new Error('站在結界外面沒有記下位置');
    tp(d.x, d.y); step(2); die();
    if (!G.lost || Math.hypot(G.lost.x - sx, G.lost.y - sy) > 1 || Math.hypot(G.lost.x - d.x, G.lost.y - d.y) < d.R + 8) throw new Error('死在 ' + d.short + ' 的結界裡，那包沒有放在外面：' + JSON.stringify(G.lost));
    log.push('  死在' + d.short + '的結界裡：那包在結界外 ' + Math.round(Math.hypot(G.lost.x - d.x, G.lost.y - d.y) - d.R) + ' px');
    G.lost = null;
  });

  const T = times.reduce((a, t) => a + t[1], 0);
  log.push('\n總共 ' + (T / 1000).toFixed(0) + ' 秒，最慢的：' + times.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, t]) => '\n  ' + (t / 1000).toFixed(1) + 's  ' + n.slice(0, 40)).join(''));
  return { log, fails };
};

await send('Runtime.evaluate', { expression: 'window.__ONLY = ' + JSON.stringify(process.env.ONLY || '') });
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
if (server) await server.close(); process.exit(fails.length || pageErrors.length ? 1 : 0);
