// 開發用：開遊戲 → 在頁面裡執行一段 JS（可以 await）→ 截圖
// 用法：node scripts/look.mjs <輸出.png> "<JS>" [寬 高 dpr]
//   JS 裡可以用 imp('core/state') 這樣 import 遊戲模組，例如：
//   node scripts/look.mjs a.png "const {G}=await imp('core/state'); G.me.x+=100"
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const [out, js = '', w = 1280, h = 720, dpr = 1] = process.argv.slice(2);
const server = await createServer({ logLevel: 'error', server: { port: 0 } }); await server.listen();
const port = 9336, wait = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--mute-audio',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, 'about:blank'], { stdio: 'ignore' });
let target; for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { await wait(200); } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +dpr, mobile: false });
await send('Page.navigate', { url: server.resolvedUrls.local[0] }); await wait(2500);
const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => { const imp = p => import('/src/' + p + '.ts');
  const { G } = await imp('core/state'); if (!G.started) { localStorage.clear(); (await imp('main')).startGame(false); }
  await new Promise(r => setTimeout(r, 300)); ${js} })()` });
if (r.result.exceptionDetails) console.log('ERR', r.result.exceptionDetails.exception?.description);
else if (r.result.result?.value !== undefined) console.log(JSON.stringify(r.result.result.value));
await wait(200);
const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(out, Buffer.from(s.result.data, 'base64'));
if (errs.length) console.log('PAGE ERRORS', errs);
ws.close(); chrome.kill(); await server.close(); process.exit(0);
