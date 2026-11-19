/* 世界地圖上的圖示：每個都是 11×11 的像素圖（o = 外框），畫的時候放大 2 倍
   營火（點燃 / 熄滅）、城鎮、地城（未攻略 / 已攻略）、遺跡、地標、商人、魂晶、你 */
const PAL: Record<string, string> = {
  o: '#07060b',
  y: '#f2c14e', Y: '#e8743b', w: '#fff0a8',                                 // 火焰
  b: '#7a4a1a', B: '#b07a40',                                              // 木頭
  g: '#8a869a', G: '#5a566a', h: '#c8c4d6',                                // 灰燼、灰石
  r: '#c0503a', R: '#7a2a20', c: '#e8d6b0', C: '#b8a07a', k: '#ffd86a', d: '#4a2e1a',   // 房子
  s: '#a6a2c0', S: '#6a6684', p: '#c8a8ff', P: '#6a4ad0', x: '#1a1030',   // 石頭、紫光、黑洞
  m: '#6aa84a',                                                            // 青苔
  n: '#9a7048', N: '#6a4a2a',                                              // 布袋
  v: '#f0e8ff', V: '#b49cff',                                              // 魂晶
  a: '#7a66c4', A: '#3b2e66',                                              // 帽子
};
const ART: Record<string, string[]> = {
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
  campOff: [
    '...........',
    '....o.o....',
    '...ogoGo...',
    '....oGo....',
    '...ogoo....',
    '...oGGo....',
    '..oGhhGo...',
    '.ooBoGoBoo.',
    'obBBbobBBbo',
    'oobbooobboo',
    '.oo.....oo.',
  ],
  town: [
    '.....o.....',
    '....oro....',
    '...orrRo...',
    '..orrrrRo..',
    '.orrrrrrRo.',
    'ooooooooooo',
    '.occccccCo.',
    '.ockkcddCo.',
    '.ockkcddCo.',
    '.occcccdCo.',
    '.ooooooooo.',
  ],
  dungeon: [
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
  ruin: [
    '.oo.....oo.',
    'oho....oso.',
    'oso...osSo.',
    'oSo...osSo.',
    'oso...oSSo.',
    'oSo.o.osSo.',
    'osooho.oSo.',
    'oSoosSo.oSo',
    'osooSSoooso',
    'ommmmmmmmmo',
    'ooooooooooo',
  ],
  landmark: [
    '.....o.....',
    '....opo....',
    '....oso....',
    '...ossSo...',
    '...osVSo...',
    '...osSSo...',
    '...ossSo...',
    '...osSSo...',
    '..ossSSSo..',
    '.ooooooooo.',
    'osSSSSSSSSo',
  ],
  merchant: [
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
  lost: [
    '.....o.....',
    '....ovo....',
    '...ovVVo...',
    '...ovVPo...',
    '..ovvVPPo..',
    '..ovVVPPo..',
    '..oVVPPPo..',
    '...oVPPo...',
    '...oVPo....',
    '....oPo....',
    '.....o.....',
  ],
  me: [
    '.....o.....',
    '....oao....',
    '....oao....',
    '...oaaAo...',
    '...oaaAo...',
    '..oaaaaAo..',
    '..oyykyyo..',
    '.oaaaaaaAo.',
    'oaaaaaaaaAo',
    '.oooooooooo',
    '...........',
  ],
};
export const MAP_ICON_SCALE = 2;                                       // 一格像素 = 2 個 CSS 像素 → 圖示 22px
export const MAP_ICONS: Record<string, HTMLCanvasElement> = {};
function build(rows: string[], tint?: (c: string) => string) {
  const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length; const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.') return; g.fillStyle = tint ? tint(PAL[ch]) : PAL[ch]; g.fillRect(x, y, 1, 1); }));
  return c;
}
const grey = (hex: string) => { const n = parseInt(hex.slice(1), 16), l = Math.round(((n >> 16) * .3 + ((n >> 8) & 255) * .5 + (n & 255) * .2) * .8 + 30); return hex === PAL.o ? hex : `rgb(${l},${l},${l + 8})`; };
for (const k in ART) MAP_ICONS[k] = build(ART[k]);
MAP_ICONS.dungeonDone = build(ART.dungeon, grey);                       // 攻略完的地城：變灰
