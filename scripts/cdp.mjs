// 給測試 / 截圖腳本用的 headless Chrome（playtest、look、tour、shots、worldhash、dungeonmap 共用）
//
// 1. port 每次自動挑空的（--remote-debugging-port=0）：好幾個 session 同時跑 playtest 也不會連到別人的 Chrome、互相卡住
// 2. 不管怎麼結束都一定關掉 Chrome：正常結束、丟錯、Ctrl+C、超過時限都會關；
//    連腳本被 kill -9（例如工具的時限到了）都會關：另外開一個很小的「看門狗」程式，發現腳本不見了就把 Chrome 關掉
// 3. 時限：超過就印出訊息、強制結束（預設 15 分鐘，CDP_TIMEOUT=秒數 可以改）
//
// 用法：
//   import { openChrome } from './cdp.mjs';
//   const { send, onEvent } = await openChrome();          // send('Page.navigate', { url })
//   onEvent(m => { if (m.method === 'Runtime.exceptionThrown') ... });
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function openChrome({ timeout = (+process.env.CDP_TIMEOUT || 15 * 60) * 1000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cdp-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--mute-audio', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });

  // 看門狗：每 2 秒看一次腳本還在不在，不在了就關掉 Chrome、刪掉暫存資料夾
  const dog = spawn(process.execPath, ['-e', `const [p, c, d] = process.argv.slice(1);
    setInterval(() => { try { process.kill(+p, 0); } catch { try { process.kill(+c, 'SIGKILL'); } catch {} try { require('fs').rmSync(d, { recursive: true, force: true }); } catch {} process.exit(); } }, 2000);`,
    String(process.pid), String(chrome.pid), dir], { detached: true, stdio: 'ignore' });
  dog.unref();

  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    try { chrome.kill('SIGKILL'); } catch {}
    try { dog.kill(); } catch {}
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', close);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { close(); process.exit(130); });
  process.on('uncaughtException', e => { console.error(e); close(); process.exit(1); });
  process.on('unhandledRejection', e => { console.error(e); close(); process.exit(1); });
  setTimeout(() => { console.error(`\n超過時限 ${timeout / 1000} 秒，強制結束（卡住了？CDP_TIMEOUT=秒數 可以放寬）`); close(); process.exit(2); }, timeout).unref();

  // Chrome 開好後會把自己挑到的 port 寫進 user-data-dir 裡的 DevToolsActivePort
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) { try { port = +readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { await wait(100); } }
  if (!port) throw new Error('Chrome 沒有開起來（10 秒內沒有寫出 DevToolsActivePort）');
  let target;
  for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { await wait(200); } }
  if (!target) throw new Error('連不上 Chrome（port ' + port + '）');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(), listeners = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    for (const f of listeners) f(m);
  };
  ws.onclose = () => { for (const r of pending.values()) r({ error: { message: 'Chrome 的連線斷了' } }); pending.clear(); };   // 斷線 → 不要一直等下去
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, onEvent: f => listeners.push(f), close };
}
