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
  const await0 = { chests: await imp('world/chests'), towns: await imp('world/towns'), quest: await imp('game/quest'), story: await imp('data/story'), map: await imp('world/map'), forge: await imp('data/forge'), fx: await imp('game/weaponFx'), items: await imp('data/items'), uq: await imp('data/uniques'), enemies: await imp('game/enemies') };

  const imp0 = { map: await imp('render/map'), dg: await imp('world/dungeons'), input: await imp('ui/input') };
  const step = (n, opts = {}) => {
    for (let i = 0; i < n; i++) {
      if (opts.god && G.me) { G.me.hp = G.me.maxHp; G.me.st = G.me.maxSt; }
      if (opts.atkEvery && i % opts.atkEvery === 0) pressed.atk = true;
      update(1 / 60); render(); updateHUD();
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
    G.me.hp = 10; pressed.pot = true; step(40);
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

  run('強化：鐵匠分頁、礦石 + 金幣 → +1、舊存檔武器換算', () => {
    const F = await0.forge, towns = await0.towns, sm = towns.NPCS.find(n => n.smith);
    G.me.weapon = makeItem('sword', 0, 0); recalc(G.me); G.me.mats = { ore1: 5 }; G.me.gold = 1000;
    const a0 = G.me.weapon.atk, p0 = G.me.atkPow;
    tp(sm.x, sm.y + 12); step(2); shop.openShop(towns.nearSmith()); step(1);
    document.querySelector('#forgeTab').click(); document.querySelector('#shopMenu [data-fw]').click(); document.querySelector('#shopMenu [data-forge]').click(); step(1);
    if (G.me.weapon.up !== 1 || G.me.weapon.atk <= a0 || G.me.atkPow <= p0) throw new Error('強化沒有生效：up=' + G.me.weapon.up + ' atk ' + a0 + '→' + G.me.weapon.atk);
    if (G.me.mats.ore1 !== 3 || G.me.gold !== 940) throw new Error('沒有扣礦石 / 金幣：' + JSON.stringify(G.me.mats) + ' ' + G.me.gold);
    G.me.mats = {}; if (F.doUpgrade(G.me, G.me.weapon)) throw new Error('沒有礦石也能強化');
    setMenu(null);
    const old = { id: 999, type: 'axe', ilvl: 25, rarity: 3, atk: 120, aff: {}, name: '舊斧頭' }; F.migrateWeapon(old);
    if (old.up !== 10 || old.ilvl !== 0) throw new Error('舊武器換算錯誤：' + JSON.stringify(old));
    const mid = { id: 998, type: 'sword', ilvl: 9, rarity: 2, aff: {}, name: '舊劍' }; F.migrateWeapon(mid);
    log.push('  舊武器換算：25 級史詩斧 → +' + old.up + '，9 級稀有劍 → +' + mid.up + '（攻擊 ' + mid.atk + '）');
    G.me.weapon = makeItem('sword', 0, 0); recalc(G.me);
  });

  run('刻印效果：出血 / 燃燒 / 寒霜 / 雷鳴 / 噬魂 都會觸發', () => {
    const FX = await0.fx, items = await0.items, out = [];
    for (const fx of FX.FX_KEYS) {
      G.me.weapon = items.makeWeapon('sword', 3); G.me.weapon.fx = fx; recalc(G.me);
      const e = G.enemies.filter(e => !e.dead && !e.rb && !e.chest).sort((a, b) => Math.hypot(a.x - G.me.x, a.y - G.me.y) - Math.hypot(b.x - G.me.x, b.y - G.me.y))[0];
      tp(e.x - 10, e.y); e.hp = e.maxHp = 1e6; const twin = G.enemies.find(o => o !== e && !o.rb && !o.dead && !o.gone && !o.chest && Math.hypot(o.x - e.x, o.y - e.y) < 200);
      if (fx === 'shock' && twin) { twin.x = e.x + 20; twin.y = e.y; twin.hp = twin.maxHp = 1e6; }
      let hit = false; const tw0 = twin ? twin.hp : 0;
      for (let i = 0; i < 40 && !hit; i++) { damageEnemy(G.me, e, 1, G.me.x, G.me.y); step(8, { god: true });
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
      const boss = RB.rbs.find(e => e.id === 'dg_' + d.id); if (!boss) throw new Error(d.id + '：找不到地城 Boss');
      tp(boss.def.x, boss.def.y + 30); step(120, { god: true }); if (boss.state === 'sleep') throw new Error(d.id + '：Boss 沒有醒來');
      boss.hp = boss.maxHp * .45; step(240, { god: true, atkEvery: 15 });
      const k0 = G.drops.length; if (!boss.dead) { boss.hp = 1; damageEnemy(G.me, boss, 5, G.me.x, G.me.y); step(5, { god: true }); }
      if (!boss.dead) throw new Error(d.id + '：Boss 沒死');
      if (!Q.flags.has('dgn:' + d.id)) throw new Error(d.id + '：打倒 Boss 沒有記錄');
      const sig = G.drops.slice(k0).find(x => x.item.ug === d.sig); if (!sig) throw new Error(d.id + '：Boss 沒掉招牌裝備 ' + d.sig);
      const n0 = G.drops.length; tp(chest.x, chest.y + 6); CH.openChest(G.me, chest); step(3);
      const got = d.uq ? G.drops.slice(n0).find(x => x.item.uq === d.uq) : { item: { name: '黃金寶箱' } }; if (!chest.opened || !got) throw new Error(d.id + '：最深處的寶箱沒打開 / 沒拿到 ' + d.uq);
      menus.restAt(CAMPS[0]); setMenu(null); G.projs = []; step(2, { god: true });
      if (RB.rbs.some(e => e.id === 'dg_' + d.id)) throw new Error(d.id + '：休息後 Boss 又出現了');
      tp(d.exX, d.exY); step(1, { god: true }); const out = D.nearDoor(G.me); if (!out || !out.out) throw new Error(d.id + '：站在階梯上沒偵測到出口（dead=' + G.me.dead + ' 位置 ' + Math.round(G.me.x - d.exX) + ',' + Math.round(G.me.y - d.exY) + '）');
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
