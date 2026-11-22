// 野外指紋：地形、地區、野外的怪、野外寶箱、營火。改地城的時候用來確認野外沒有被動到
// 用法：node scripts/worldhash.mjs [輸出檔]
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { openChrome } from './cdp.mjs';
const server = await createServer({ logLevel: 'error', server: { port: 0, strictPort: false } });
await server.listen(); const url = server.resolvedUrls.local[0];
const wait = ms => new Promise(r => setTimeout(r, ms));
const { send, onEvent } = await openChrome();                       // scripts/cdp.mjs：自動挑 port、時限、結束時一定關掉 Chrome
await send('Runtime.enable'); await send('Page.navigate', { url }); await wait(3500);
const pageScript = async () => {
  const M = await import('/src/world/map.ts'), C = await import('/src/world/chests.ts');
  const W = 680, OZ = (x, y) => x >= 262 && y >= 496 && y <= 678;            // 舊的地城區塊（海上）不算
  let h = 0; const mix = v => { h = (Math.imul(h ^ v, 2654435761) + 1) >>> 0; };
  for (let y = 0; y < W - 3; y++) for (let x = 0; x < M.MW; x++) { if (OZ(x, y)) continue; mix(M.map[y * M.MW + x]); mix(M.reg[y * M.MW + x]); }
  const tiles = h; h = 0;
  for (const s of M.spawns) if (s.ty < W && !OZ(s.tx, s.ty)) { mix(s.tx); mix(s.ty); mix(s.lv); for (const c of s.kind) mix(c.charCodeAt(0)); }
  const spawns = h; h = 0;
  for (const c of C.CHESTS) if (c.ty < W && !OZ(c.tx, c.ty)) { mix(c.tx); mix(c.ty); mix(c.tier); mix(c.lv); mix(+c.mimic); }
  const chests = h; h = 0;
  for (const c of M.CAMPS) if (c.ty < W) { mix(c.tx); mix(c.ty); }
  const list = C.CHESTS.filter(c => c.ty < W && !OZ(c.tx, c.ty)).map(c => c.id + ':' + c.tier + ':' + c.lv + ':' + (+c.mimic));
  return { list, tiles, spawns, chests, camps: h, nSpawn: M.spawns.filter(s => s.ty < W && !OZ(s.tx, s.ty)).length, nChest: C.CHESTS.filter(c => c.ty < W && !OZ(c.tx, c.ty)).length };
};
const r = await send('Runtime.evaluate', { expression: `(${pageScript})()`, awaitPromise: true, returnByValue: true });
const out = JSON.stringify(r.result.result.value || r.result, null, 1); console.log(out); if (process.argv[2]) writeFileSync(process.argv[2], out);
await server.close(); process.exit(0);
