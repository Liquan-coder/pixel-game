// 把地城區畫成一張圖（看格局用）：房間角色、鐵柵門、營火、寶箱。用法：node scripts/dungeonmap.mjs 輸出.png [縮放]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
const out = process.argv[2] || 'dungeons.png', Z = +(process.argv[3] || 3);
const server = await createServer({ logLevel: 'error', server: { port: 0, strictPort: false } });
await server.listen(); const url = server.resolvedUrls.local[0];
const port = 9338;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--mute-audio', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, 'about:blank'], { stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
let target; for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { await wait(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.navigate', { url }); await wait(3500);
const pageScript = async (Z) => {
  const M = await import('/src/world/map.ts'), D = await import('/src/world/dungeons.ts'), MM = await import('/src/world/minimap.ts'), C = await import('/src/world/chests.ts'), PU = await import('/src/world/puzzles.ts');
  MM.bakeFullMap(); const y0 = M.WH, h = M.MH - M.WH, cv = document.createElement('canvas'); cv.width = M.MW * Z; cv.height = h * Z;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(MM.miniFull, 0, y0, M.MW, h, 0, 0, M.MW * Z, h * Z);
  const COL = { trap: '#ff5a5a', vault: '#ffb040', boss: '#ff40ff', treasure: '#ffe38a', camp: '#f2c14e', entry: '#7fdcff', end: '#9ad0ff', hall: '#ffffff' };
  g.lineWidth = 1; g.font = (4 * Z) + 'px sans-serif';
  for (const d of D.DUNGEONS) { const L = d.lay; for (const r of [...L.rooms, L.hall]) { const c = COL[r.role]; if (!c) continue; g.strokeStyle = c; g.strokeRect((r.x - r.rx) * Z, (r.y - r.ry - y0) * Z, (r.rx * 2 + 1) * Z, (r.ry * 2 + 1) * Z); }
    g.fillStyle = '#fff'; g.fillText(d.name, (d.x0 + 2) * Z, (d.y0 - y0 + 6) * Z); }
  for (const p of PU.PUZZLES) { g.fillStyle = '#ff3030'; for (const q of p.gate) g.fillRect(q.x / 16 * Z - Z, q.y / 16 * Z - y0 * Z - Z, 2 * Z, 2 * Z);
    g.fillStyle = '#fff'; if (p.room) g.fillText(p.kind, (p.room.x - p.room.rx) * Z, (p.room.y - y0) * Z); }
  for (const c of M.CAMPS) if (c.dg) { g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(c.tx * Z, (c.ty - y0) * Z, 2 * Z, 0, 7); g.fill(); }
  for (const c of C.CHESTS) if (c.ty >= y0) { g.fillStyle = ['#c8a070', '#9ad0ff', '#f2c14e'][c.tier]; g.fillRect(c.tx * Z - Z, (c.ty - y0) * Z - Z, 3 * Z, 3 * Z); g.strokeStyle = '#000'; g.strokeRect(c.tx * Z - Z, (c.ty - y0) * Z - Z, 3 * Z, 3 * Z); }
  const stats = D.DUNGEONS.map(d => d.id + ' rooms=' + d.lay.rooms.length + ' path=' + d.lay.path.length + ' camps=' + M.CAMPS.filter(c => c.dg === d.id).length + ' chests=' + C.CHESTS.filter(c => D.dungeonAt(c.x, c.y) === d).length + ' puz=' + PU.PUZZLES.filter(p => p.d === d).map(p => p.kind).join('/') + ' mobs=' + M.spawns.filter(s => D.dungeonAt(s.x, s.y) === d).length);
  return { png: cv.toDataURL('image/png'), stats };
};
const r = await send('Runtime.evaluate', { expression: `(${pageScript})(${Z})`, awaitPromise: true, returnByValue: true });
const v = r.result.result.value; if (!v) { console.log(JSON.stringify(r.result).slice(0, 2000)); } else { writeFileSync(out, Buffer.from(v.png.split(',')[1], 'base64')); console.log(v.stats.join('\n')); }
ws.close(); chrome.kill(); await server.close(); process.exit(0);
