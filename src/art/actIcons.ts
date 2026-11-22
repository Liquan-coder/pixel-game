/* 攻擊鍵的「互動」圖示：靠近可以互動的東西時，攻擊鍵上的劍換成這個（ui/hud.ts）。
   跟世界地圖的圖示一樣是 11×11 的像素圖（o = 外框），輸出成 SVG 字串直接塞進按鈕。
   撿起 / 調查 = 手、打開 = 寶箱、休息 = 營火、閱讀 = 石碑、進入 / 離開 = 洞口、交易 = 錢袋 */
const PAL: Record<string, string> = {
  o: '#07060b',
  f: '#f6d3b0', F: '#c8906a',                                              // 手
  y: '#f2c14e', Y: '#e8743b', w: '#fff0a8', k: '#ffd86a',                 // 火焰、金
  b: '#7a4a1a', B: '#b07a40',                                              // 木頭
  s: '#a6a2c0', S: '#6a6684', h: '#d8d4e6', G: '#4a4660',                  // 石頭
  p: '#c8a8ff', P: '#6a4ad0', x: '#1a1030',                                // 洞口的紫光
  n: '#9a7048', N: '#6a4a2a', d: '#4a2e1a',                                // 布袋
};
const ART: Record<string, string[]> = {
  hand: [
    '..o.o.o....',
    '.ofofofo...',
    '.ofofofoo..',
    '.ofofofofo.',
    '.ofofofofo.',
    'oofffffffo.',
    'ofoffffffFo',
    'offfffffFFo',
    '.offffffFo.',
    '..offfFFo..',
    '...ooooo...',
  ],
  chest: [
    '...........',
    '.ooooooooo.',
    'oByBBBBByBo',
    'obybbbbbybo',
    'ooooooooooo',
    'oByBokoByBo',
    'obybokobybo',
    'obybbobbybo',
    'obybbbbbybo',
    'ooooooooooo',
    '...........',
  ],
  camp: [
    '.....o.....',
    '....oyo....',
    '...oyYo....',
    '...oYyyo...',
    '..oyYwYyo..',
    '..oYwwwYo..',
    '..oYwwwYo..',
    '.ooBoYoBoo.',
    'obBBbobBBbo',
    'oobbooobboo',
    '.oo.....oo.',
  ],
  tablet: [
    '...ooooo...',
    '..ohhhhso..',
    '.ohsssssSo.',
    '.osGGGGsSo.',
    '.ossssssSo.',
    '.osGGGssSo.',
    '.ossssssSo.',
    '.osGGGGsSo.',
    '.ossssssSo.',
    'oSSSSSSSSSo',
    'ooooooooooo',
  ],
  door: [
    '...ooooo...',
    '..ossssso..',
    '.ossoooSso.',
    '.osoxxxoSo.',
    'ososxpxoSso',
    'osoxxPpxoSo',
    'osoxpPPxoSo',
    'osoxxPxxoSo',
    'osoxxxxxoSo',
    'oSSoooooSSo',
    'ooooooooooo',
  ],
  bag: [
    '...ooooo...',
    '...oNdNo...',
    '....odo....',
    '..ooooooo..',
    '.onnnnnnNo.',
    'onnnnoonNNo',
    'onnnokyoNNo',
    'onnnokyoNNo',
    'onnnnoonNNo',
    '.onnnnnNNo.',
    '..ooooooo..',
  ],
};
const OF: Record<string, string> = { pick: 'hand', use: 'hand', chest: 'chest', rest: 'camp', read: 'tablet', door: 'door', shop: 'bag' };
const cache: Record<string, string> = {};
/** 互動種類 → 按鈕上的 SVG（同一種只組一次） */
export function actIconSvg(kind: string): string {
  const k = OF[kind] || 'hand'; if (cache[k]) return cache[k];
  const by: Record<string, string> = {};
  ART[k].forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && PAL[ch]) by[ch] = (by[ch] || '') + 'M' + x + ' ' + y + 'h1v1h-1z'; }));
  return cache[k] = '<svg class="ic" viewBox="0 0 11 11" aria-hidden="true">' + Object.entries(by).map(([ch, d]) => '<path d="' + d + '" fill="' + PAL[ch] + '"/>').join('') + '</svg>';
}
