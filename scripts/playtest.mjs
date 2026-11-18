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
  const { recalc, pressed, held, input, newPlayer, resetPlayers } = await imp('game/player');
  const BOSS = await imp('game/boss');
  const { update } = await imp('game/worldUpdate');
  const { render } = await imp('render/render');
  const { renderMini, renderBigMap } = await imp('render/map');
  const { updateHUD, setMenu } = await imp('ui/hud');
  const { ARENA, CAMPS, TS } = await imp('world/map');
  const RB = await imp('world/regionBoss');   // 用命名空間讀，才會拿到最新的 rbs
  const { damageEnemy, hurtPlayer } = await imp('game/combat');
  const { serialize, applySave, save, loadSave } = await imp('game/save');
  const { startGame } = await imp('main');
  const menus = await imp('ui/menus');
  const shop = await imp('ui/shop');
  const await0 = { chests: await imp('world/chests'), towns: await imp('world/towns'), quest: await imp('game/quest'), story: await imp('data/story'), map: await imp('world/map') };

  const step = (n, opts = {}) => {
    for (let i = 0; i < n; i++) {
      if (opts.god && G.me) { G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; }
      if (opts.atkEvery && i % opts.atkEvery === 0) pressed.atk = true;
      update(1 / 60); render(); updateHUD();
      for (const k in pressed) pressed[k] = false;
    }
    renderMini();
  };
  const run = (name, fn) => { try { fn(); log.push('✓ ' + name); } catch (e) { fails.push(`✗ ${name}: ${e.stack.split('\n').slice(0, 4).join(' | ')}`); } };
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
    G.me.hp = 10; pressed.pot = true; step(40);
  });

  run('每種小怪都打一輪', () => {
    G.me.weapon = makeItem('sword', 30, 4); G.me.weapon.slot = 'weapon'; recalc(G.me);
    const kinds = new Map(); for (const e of G.enemies) if (!e.rb && !kinds.has(e.kind)) kinds.set(e.kind, e);
    log.push('  小怪種類: ' + [...kinds.keys()].join(', '));
    for (const e of kinds.values()) { tp(e.x - 30, e.y); step(240, { god: true, atkEvery: 12 }); }
  });

  for (const id of Object.keys(RB.RBDEF)) run(`區域 Boss ${id}：一階段 → 二階段 → 擊殺`, () => {
    const e = RB.rbs.find(b => b.id === id); if (!e) throw new Error('找不到 ' + id);
    tp(e.def.x, e.def.y + 40); step(200, { god: true });
    if (e.state === 'sleep') throw new Error('Boss 沒有醒來，state=' + e.state);
    e.hp = e.maxHp * .4; step(400, { god: true, atkEvery: 15 });
    if (!e.dead) { e.hp = 1; damageEnemy(G.me, e, 5, G.me.x, G.me.y); step(120, { god: true }); }
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

  run('選單：角色/地圖/營火/商店', () => {
    menus.toggleInv(); step(2);
    for (const b of document.querySelectorAll('#invMenu button')) { b.click(); step(1); }
    menus.toggleInv(); menus.toggleMap(); renderBigMap(); step(2); menus.toggleMap();
    menus.restAt(CAMPS[0]); step(2);
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

  run('主線：目標會跟著進度前進、石碑可以閱讀', () => {
    const Q = await0.quest, first = Q.current().id;
    log.push('  主線目前目標：' + Q.current().title + '（星核 ' + Q.cores() + '/' + Q.CORE_N + '）');
    const t = Q.TAB[0]; tp(t.x, t.y + 6); step(2); if (Q.nearTablet() !== t) throw new Error('站在石碑旁邊卻沒偵測到');
    Q.readTablet(t); step(2); if (!Q.loreRead.has(t.id)) throw new Error('石碑沒有記下來'); setMenu(null);
    menus.toggleMap(); document.querySelector('#mapTabs [data-mt=journal]').click(); step(2);
    if (!document.querySelector('#journal .qsteps li')) throw new Error('旅程分頁是空的'); setMenu(null);
    if (first === Q.current().id && Q.current().id !== 'end') {
      for (const s of (await0.story).STEPS) if (s.id === first) { /* 用旗標 / 探索直接完成第一步 */ }
      (await0.map).discovered.add('晨風鎮'); Q.flags.add('talk:dawn:村長'); step(3);
      if (Q.current().id === first) throw new Error('完成後目標沒有前進：' + first);
    }
    log.push('  完成前兩步後：' + Q.current().title);
  });

  run('存檔 → 讀檔', () => {
    save(); const s = loadSave(); if (!s) throw new Error('沒有存檔');
    const before = JSON.stringify(serialize());
    applySave(JSON.parse(JSON.stringify(s))); step(10);
    log.push('  存檔大小 ' + before.length + ' bytes');
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
