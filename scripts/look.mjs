// 開發用：開遊戲 → 在頁面裡執行一段 JS（可以 await）→ 截圖
// 用法：node scripts/look.mjs <輸出.png> "<JS>" [寬 高 dpr]
//   JS 裡可以用 imp('core/state') 這樣 import 遊戲模組，例如：
//   node scripts/look.mjs a.png "const {G}=await imp('core/state'); G.me.x+=100"
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { openChrome } from './cdp.mjs';

const [out, js = '', w = 1280, h = 720, dpr = 1] = process.argv.slice(2);
const server = await createServer({ logLevel: 'error', server: { port: 0 } }); await server.listen();
const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
const { send, onEvent } = await openChrome();                       // scripts/cdp.mjs：自動挑 port、時限、結束時一定關掉 Chrome
onEvent(m => { if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description); });
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
await server.close(); process.exit(0);
