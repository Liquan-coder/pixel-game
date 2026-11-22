// 手機畫面截圖：用幾種常見手機/平板的尺寸開遊戲，截「遊戲中、角色選單、商店、營火、地圖、Boss 戰」
// 用法：npm run shots -- <輸出資料夾>      （預設 ./shots）
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { openChrome } from './cdp.mjs';

const out = process.argv[2] || 'shots'; mkdirSync(out, { recursive: true });
const server = await createServer({ logLevel: 'error', server: { port: 0 } }); await server.listen();
const url = server.resolvedUrls.local[0];
const DEVICES = [                                                   // CSS 寬高（橫放）、dpr。Safari 網址列會吃掉一點高度，這裡用「加到主畫面」全螢幕的大小
  { name: 'iphone-se', w: 667, h: 375, dpr: 2 },
  { name: 'iphone-14', w: 844, h: 390, dpr: 3 },
  { name: 'iphone-pro-max', w: 932, h: 430, dpr: 3 },
  { name: 'ipad', w: 1180, h: 820, dpr: 2 },
  { name: 'iphone-14-portrait', w: 390, h: 844, dpr: 3 },
];
const wait = ms => new Promise(r => setTimeout(r, ms));
const { send, onEvent } = await openChrome();                       // scripts/cdp.mjs：自動挑 port、時限、結束時一定關掉 Chrome
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) console.log('ERR', r.result.exceptionDetails.exception?.description); return r.result.result?.value; };
const shot = async file => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, file), Buffer.from(s.result.data, 'base64')); };
await send('Runtime.enable'); await send('Page.enable');

const SCENES = `{
  const imp = p => import('/src/' + p + '.ts');
  const { G } = await imp('core/state'); const { startGame } = await imp('main');
  const { setMenu } = await imp('ui/hud'); const menus = await imp('ui/menus'); const shop = await imp('ui/shop');
  const { CAMPS } = await imp('world/map'); const RB = await imp('world/regionBoss'); const { renderBigMap } = await imp('render/map');
  window.__S = {
    play: () => { setMenu(null); },
    inv: () => { setMenu(null); menus.toggleInv(); },
    shop: () => { setMenu(null); shop.openShop(); },
    camp: () => { setMenu(null); menus.restAt(CAMPS[0]); },
    map: () => { setMenu(null); menus.toggleMap(); renderBigMap(); },
    boss: () => { setMenu(null); const e = RB.rbs[0]; G.me.x = e.def.x; G.me.y = e.def.y + 40; },
  };
  startGame(false);
}`;
for (const d of DEVICES) {
  await send('Emulation.setDeviceMetricsOverride', { width: d.w, height: d.h, deviceScaleFactor: d.dpr, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url }); await wait(2500);
  await ev('localStorage.clear()'); await send('Page.reload'); await wait(2500);
  await shot(`${d.name}-0-title.png`);
  await ev(`(async () => ${SCENES})()`); await wait(1500);
  for (const s of ['play', 'inv', 'shop', 'camp', 'map', 'boss']) { await ev(`__S.${s}()`); await wait(s === 'boss' ? 2500 : 600); await shot(`${d.name}-${s}.png`); if (d.name.includes('portrait')) break; }
  console.log('✓', d.name);
}
await server.close(); process.exit(0);
