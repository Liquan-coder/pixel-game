// 開發用：開一次遊戲，依序跑很多段 JS、每段截一張圖（比連續呼叫 look.mjs 快很多）
// 用法：node scripts/tour.mjs <輸出資料夾> <場景.json> [寬 高 dpr]
//   場景.json = [{ "name": "lake", "js": "G.me.x = 40*16; G.me.y = 112*16" }, ...]
//   JS 裡可以用 imp('core/state') 這樣 import 遊戲模組；G 已經準備好
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { openChrome } from './cdp.mjs';

const [out, file, w = 1280, h = 720, dpr = 1] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const scenes = JSON.parse(readFileSync(file, 'utf8'));
const server = await createServer({ logLevel: 'error', server: { port: 0 } }); await server.listen();
const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
const { send, onEvent } = await openChrome();                       // scripts/cdp.mjs：自動挑 port、時限、結束時一定關掉 Chrome
onEvent(m => { if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +dpr, mobile: false });
await send('Page.navigate', { url: server.resolvedUrls.local[0] }); await wait(2500);
const ev = async js => { const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => { const imp = p => import('/src/' + p + '.ts');
  const { G } = await imp('core/state'); if (!G.started) { localStorage.clear(); (await imp('main')).startGame(false); await new Promise(r => setTimeout(r, 300)); }
  ${js} })()` });
  if (r.result.exceptionDetails) return 'ERR ' + r.result.exceptionDetails.exception?.description; return r.result.result?.value; };
for (const s of scenes) {
  const v = await ev(s.js); await wait(s.wait ?? 700);
  const shot = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, s.name + '.png'), Buffer.from(shot.result.data, 'base64'));
  console.log(s.name, v === undefined ? '' : JSON.stringify(v));
}
if (errs.length) console.log('PAGE ERRORS', errs);
await server.close(); process.exit(0);
