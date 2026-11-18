import { TAU } from '../core/util';
import { makeSprite } from './sprite';

export const HERO_PAL = {"o":"#0a0610","a":"#3c2c61","b":"#1e1638","c":"#dabbe4","d":"#805db1","e":"#483a83","f":"#b98b53","g":"#af8cc3","h":"#3d374b","i":"#312051","j":"#817acd","k":"#6c6376","l":"#5a46ba","m":"#e4c9ef","n":"#4b4457","p":"#f0cd87","q":"#897a9a","r":"#7a5aa5","s":"#0e0a1d","t":"#5a417e","u":"#413467","v":"#4d3070","w":"#493e76","x":"#67549b","y":"#b9b6f1","z":"#402462","A":"#2a1f47","B":"#c89b61","C":"#39245a"};
export const HERO_W = 57, HERO_H = 66;
const HERO_BODY = ["..............oooooo","............ooaaaaaooo","...........ooaaaaaaaaboo","..........ooaabbaaaaaaabo",".........ooaubbbaaaaaaaaboo",".....oooooaabbbbaaaaaaaaabbo",".....obbobabbbobaaaaaaaaaaabo",".....ooooobbboobaaaaaaaaaaaibo.......oooooooo",".......obbbbooobbaaaaaabbbbbrro...ooobaaaCaabo",".......ooooo..obbaaaabbtrrrrrrtooobaaabooooooo","..............obbbbbbtrrrdrrbbbbaaaboooeeeeo",".............oobbpbtttdrrtbbiaaaabooeeeeeeeo",".............obbnppftttbbbaaaaaaooeeeeeeeeo",".............obffppktbbbaaaaaabooeeeeeeeedo","............ootvffpfbbaaaaaaaozCCoeeeeddddo","............ottvfbbfbaaaaaaaozzzzCoeeddddoto","...........oottbbbbbaaaaaaCoCzzzzCCoeddddoo","........oooobbbbbbbaaaaaaAoCCzzCCdtvoddddo","......ooobbbbbbbbbaaaaaaboCzCzzddddduodddo","..oooobbbbbbbbbbbaaaaaCoozCvddzdddzrroddeo",".obbbbbbbbbbbbbbaaaaaAozzzzddddzddgzdtuooo","obabbbbbbbbbbbaaaaaboozzzzddddgzdgdzddoo","obaaaabbbbbbaaaaaboozzzdiidgdgdzzdddzdo",".oobaaaaaaaaCbbooozzdzrigidddddzizddzdo","..ooooooooooooozzzzddzigggzddddCgiCdzdCo","...........oAiCCzdzddCggggCzdddzgoCdzdCo","...........oozziddzddoooooozdddCooodzdzo","............ozziddzddCogvvmgCddCvgoCddzo","............ozzCddzddzxmddmmczzddmiCrbzio","...........ozzdzCdzzdzcmmmmmmmmdmgivCoooo","..........ozrzdvozzzddCmmmmmmmmmmgodCo",".........oCdzddrooozddzgmmmmmmmmgordo","....oooooddzdddiouuoCddogmmmmmmgoCddo","....oCrdddzddddiouuuozddoCgggtooirroo",".....oozzzdddrCiiouoooddCCiiiooooroiio",".......oCddddCCiiiobboCdCxxABAxaooiiiio","......ozdddzzCiiiobCCbodzxiBpfCioboiiio",".....ozddrzddiiiobaCCCboCCiAfixo.o.oio",".....odddCddiiioobCCCCCoojxAoxijo.ooio..o","....oxddzddriiioobbbCCCoAjxoxoxjoobboooocoo","....ordCzddiiiioaobbbbooAoxoboxoobbCAixogcmo","....orrozddiiiioabauooo.oAobbboAobbbiixoocco","....oarozddoiiiioosuooo.obububuooobbiixoocoo",".....orozddoiAoobibooAoo.oooobboiiobbio..oo",".....oxoorriooobCCiooobboowbubuooiAooCo","......oo.oroobAiCCboooooooibbboiooAo.oo",".........ooxxCiCCioobbooAwoiiiioboo","..........oobrwCCooobbiAwwotitiouboo",".........oqcqbxxoboobiiwwobiiiAoowAo","........ogccqqoobo.obiiwxoiiiwAAowuoo","........ooooogoobbobiiwwrowwwwwwoxuAoo","...........ooooboobiiiwwAowwwwwwioriio","...........obbooobbiiwwxoAwwwwwwwoAwioo","...........obbbooobbixyaowwwwwwwwAoytboo","............obbbboooiiuoowwwwwwwwAoitoio",".............obbAxAooooosbwwwwwwwAoooCro","..............ooaarrrAAArrAwwwwwAAxAAxoo","................oooraaordrrAAAAArxxruoo","...................ooooooooarrarrooooo","......................obbbooooooo","......................ohhhobbbo","......................ohhhobbo","......................ohhhobbo","......................ohhhobbo","......................oAtwooo",".......................oooo"];
const HERO_HAND = ["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","........................................o",".......................................ocoo",".......................................ogcmo",".......................................oocco","........................................ocoo",".........................................oo","","","","","","","","","","","","","","","","","","","","","",""];
for (let y = 0; y < HERO_HAND.length; y++) { const h = HERO_HAND[y]; if (!h) continue; const r = [...HERO_BODY[y].padEnd(HERO_W, '.')]; for (let x = 40; x < h.length; x++) if (h[x] !== '.') r[x] = '.'; HERO_BODY[y] = r.join(''); }   // 身體上的拳頭拿掉：手改成握著武器、繞著身體轉
export const HERO_FULL = ["..............oooooo","............ooaaaaaooo","...........ooaaaaaaaaboo","..........ooaabbaaaaaaabo",".........ooaubbbaaaaaaaaboo",".....oooooaabbbbaaaaaaaaabbo","....oobb.babbbobaaaaaaaaaaabo",".....oo...bbboobaaaaaaaaaaaibo.......oooooooo..ooooooo","......oobbbbooobbaaaaaabbbbbrro...ooobaaaCaaboohkqqqqho",".......ooooo..obbaaaabbtrrrrrrtooobaaaboooooookqqnnnqqno","..............obbbbbbtrrrdrrbbbbaaaboooeeeeookqnoooohqqo",".............oobbpbtttdrrtbbiaaaabooeeeeeeeontho....onqo",".............obbnppftttbbbaaaaaaooeeeeeeeeonnho..oo.ohqqo",".............obffppktbbbaaaaaabooeeeeeeeedonno..ojyo.okqo","............ootvffpfbbaaaaaaaozCCoeeeeddddokho.ojjyo.okqo","............ottvfbbfbaaaaaaaozzzzCoeeddddotkoboljyjo.okko","...........oottbbbbbaaaaaaCoCzzzzCCoeddddokkobollllo.oqho","........oooobbbbbbbaaaaaaAoCCzzCCdtvoddddonkhoolldo.oqno","......ooobbbbbbbbbaaaaaaboCzCzzddddduodddohkhobolo..ooo","..oooobbbbbbbbbbbaaaaaCoozCvddzdddzrroddeoohqhobo..oo",".obbbbbbbbbbbbbbaaaaaAozzzzddddzddgzdtuoooohnqobboorro","obabbbbbbbbbbbaaaaaboozzzzddddgzdgdzddoo...onkqookqrwo","obaaaabbbbbbaaaaaboozzzdiidgdgdzzdddzdo.....ohqnnnhoo",".oobaaaaaaaaCbbooozzdzrigidddddzizddzdo.....ohkqAoo","..ooooooooooooozzzzddzigggzddddCgiCdzdCo....ohkqo",".....oooooooAiCCzdzddCggggCzdddzgoCdzdCo....ohkho","...........oozziddzddoooooozdddCooodzdzo...okkho","............ozziddzddCogvvmgCddCvgoCddzo...oqqho","............ozzCddzddzxmddmmczzddmiCrbzio..ohqno","...........ozzdzCdzzdzcmmmmmmmmdmgivCoooo..ohqho","..........ozrzdvozzzddCmmmmmmmmmmgodCo.....okho",".........oCdzddrooozddzgmmmmmmmmgordo.....onko","....oooooddzdddiouuoCddogmmmmmmgoCddo.....oqho","....oCrdddzddddiouuuozddoCgggtooirroo.....okho",".....oozzzdddrCiiouoooddCCiiiooooroiio...owko",".......oCddddCCiiiobboCdCxxABAxaooiiiio..otno","......ozdddzzCiiiobCCbodzxiBpfCioboiiio..oto",".....ozddrzddiiiobaCCCboCCiAfixo...oio...owo",".....odddCddiiioobCCCCCoojxAoxijo..oio..ohwo","....oxddzddriiioobbbCCCoAjxoxoxjo.bboooocho","....ordCzddiiiioaobbbbooAoxoboxoobbCAixogcmo","....orrozddiiiioabauooo..AobbboAobbbiixokcco","....oarozddoiiiioosuooo..bububuooobbiixokcqo",".....orozddoiAoobibooAoo.....bboiiobbiohhro",".....oxoorriooobCCiooobb..wbubuooiAooCokho","......oo.oroobAiCCboo...ooibbboiooAo.ookho",".........ooxxCiCCioobb..Awoiiiioboo...oqho","..........oobrwCCoo.bbiAwwotitiouboo..oko",".........oqcqbxxob..biiwwobiiiAoowAo.okho","........ogccqqoob...biiwxoiiiwAAowuoooko","........ooooogoobb.biiwwrowwwwwwoxuAooho","...........oooob..biiiwwAowwwwwwioriioho","...........obbo..bbiiwwxoAwwwwwwwoAwiooo","...........obbbooobbixyaowwwwwwwwAoytboo","............obbbboooiiuoowwwwwwwwAoitoio",".............obbAxAooooosbwwwwwwwAoooCro","..............ooaarrrAAArrAwwwwwAAxAAxoo","................oooraaordrrAAAAArxxruoo","...................ooooooooarrarrooooo","......................obbbooooooo.oho","......................ohhhobbbo....o","......................ohhhobbo","......................ohhhobbo","......................ohhhobbo","......................oAtwooo",".......................oooo"];
const STAFF_ART = { rows: [".............ooooooo", "...........oohkqqqqho", "..........ookqqnnnqqno", ".........ookqnoooohqqo", ".........ontho....onqo", "........onnho..oo.ohqqo", "........onno..ojyo.okqo", "........okho.ojjyo.okqo", ".......ookoboljyjo.okko", ".......okkobollllo.oqho", ".......onkhoolldo.oqno", ".......ohkhobolo..ooo", ".......oohqhobo..oo", "........ohnqobboorro", ".........onkqookqrwo", "..........ohqnnnhoo", "..........ohkqAoo", "..........ohkqo", "..........ohkho", ".........okkho", ".........oqqho", ".........ohqno", ".........ohqho", ".........okho", "........onko", "........oqho", "........okho", ".......owko", ".......otno", ".......oto", ".......owo", "......ohwo", "......oho", ".....ooo", ".....okooo", ".....okoqo", "....ohhro", "....okho", "....okho", "....oqho", "....oko", "...okho", "...oko", "...oho", "...ohho", "...okho", "..okho", "..okho", ".okho", ".okho", ".okho", "okho", "ohho", ".oo"], grip: [7, 33], base: -1.249 };
const WPAL2 = { o:'#0a0610',
  1:'#ffffff', 2:'#dcdcf4', 3:'#a9a7d0', 4:'#76739f', 5:'#4a4772',
  6:'#fff0a8', 7:'#f2c14e', 8:'#c0862c', 9:'#7a4a1a',
  p:'#9a7ae8', q:'#6a50b8', r:'#3e2c7a',
  v:'#f4e0ff', w:'#c890ff', x:'#8a4ae0', y:'#4e2296',
  B:'#e0ecff', C:'#8fb0ff', D:'#4a6ae0', E:'#26348a',
  n:'#c08a56', N:'#8a5a34', M:'#5a3820',
  R:'#ff9ab0', S:'#e0486a', T:'#8e2444',
  k:'#5e4c96', K:'#3a2e66', L:'#211a40',
  f:'#e4e0f0', F:'#9a96b4', G:'#5e5a78' };
function wgrid(w, h) { const g = []; for (let y = 0; y < h; y++) g.push(Array(w).fill('.')); return g; }
function wset(g, x, y, ch) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch; }
function wrows(g) { return g.map(r => r.join('')); }
function bladeCol(d, hw, r, fuller) {
  if (d === -hw) return '2';
  if (d === hw) return hw > 1 ? '4' : '3';
  if (d === 0) return fuller ? '4' : '1';
  if (d < 0) return d === -1 ? '2' : '3';
  return d === hw - 1 ? '5' : '4';
}
function gem(g, cx, cy, hi, mid, lo, dk) {
  wset(g, cx - 1, cy - 1, hi); wset(g, cx, cy - 1, mid); wset(g, cx + 1, cy - 1, mid);
  wset(g, cx - 1, cy, mid); wset(g, cx, cy, hi); wset(g, cx + 1, cy, lo);
  wset(g, cx - 1, cy + 1, lo); wset(g, cx, cy + 1, lo); wset(g, cx + 1, cy + 1, dk);
}
function wrap(g, cx, y0, y1, hw, cols) { for (let y = y0; y <= y1; y++) for (let d = -hw; d <= hw; d++) wset(g, cx + d, y, cols[((y - d) % 3 + 3) % 3]); }
const GEN = {
  sword() { const c = 7, g = wgrid(15, 44);
    for (let r = 0; r < 29; r++) { const hw = r < 2 ? 0 : r < 4 ? 1 : r < 6 ? 2 : 3;
      for (let d = -hw; d <= hw; d++) wset(g, c + d, r, bladeCol(d, hw, r, r > 8 && r < 25)); }
    wset(g, c - 1, 6, '1'); wset(g, c - 2, 7, '1');
    for (let x = 0; x < 15; x++) { wset(g, x, 29, x < 7 ? '6' : '7'); wset(g, x, 30, '8'); if (x > 1 && x < 13) wset(g, x, 31, '9'); }
    wset(g, 0, 28, '7'); wset(g, 14, 28, '8'); wset(g, 1, 28, '6'); wset(g, 13, 28, '7');
    gem(g, c, 30, 'v', 'w', 'x', 'y');
    wrap(g, c, 32, 38, 1, ['p', 'q', 'r']);
    for (let x = c - 2; x <= c + 2; x++) { wset(g, x, 39, '7'); wset(g, x, 43, '9'); }
    for (let y = 40; y <= 42; y++) { wset(g, c - 2, y, '7'); wset(g, c + 2, y, '8'); }
    gem(g, c, 41, 'B', 'C', 'D', 'E');
    return { rows: wrows(g), grip: [c, 35] }; },
  dagger() { const c = 5, g = wgrid(11, 26);
    for (let r = 0; r < 15; r++) { const hw = r < 1 ? 0 : r < 3 ? 1 : 2;
      for (let d = -hw; d <= hw; d++) wset(g, c + d, r, bladeCol(d, hw, r, r > 4 && r < 13)); }
    wset(g, c - 1, 4, '1');
    for (let x = 0; x < 11; x++) { wset(g, x, 15, x < 5 ? '6' : '7'); wset(g, x, 16, '8'); }
    wset(g, 0, 14, '7'); wset(g, 10, 14, '8');
    gem(g, c, 16, 'v', 'w', 'x', 'y');
    wrap(g, c, 18, 22, 1, ['p', 'q', 'r']);
    for (let x = c - 1; x <= c + 1; x++) { wset(g, x, 23, '7'); wset(g, x, 25, '9'); } wset(g, c - 1, 24, '7'); wset(g, c, 24, 'C'); wset(g, c + 1, 24, '8');
    return { rows: wrows(g), grip: [c, 20] }; },
  axe() { const c = 15, g = wgrid(21, 48);
    for (let y = 3; y < 46; y++) { wset(g, c - 1, y, 'n'); wset(g, c, y, 'N'); wset(g, c + 1, y, 'M'); }
    for (let y = 0; y < 4; y++) { wset(g, c, y, y < 1 ? '2' : '3'); if (y > 1) wset(g, c + 1, y, '4'); }
    for (let r = 2; r <= 24; r++) { const t = (r - 2) / 22, out = Math.round(12 * Math.pow(Math.sin(Math.PI * t), .55)), inn = Math.round(6 * Math.sin(Math.PI * t));
      const L = c - 3 - out, I = Math.max(L + 2, c - 2 - inn);
      for (let x = L; x <= I; x++) { const k = x - L; wset(g, x, r, k === 0 ? '1' : k === 1 ? '2' : k < 4 ? '3' : x === I ? '5' : '4'); } }
    for (let r = 8; r <= 18; r++) for (let x = c - 4; x <= c - 2; x++) if (g[r][x] === '.') wset(g, x, r, x === c - 2 ? '5' : '4');
    for (let r = 9; r <= 17; r++) { const k = 4 - Math.abs(r - 13); for (let i = 0; i <= k; i++) wset(g, c + 2 + i, r, i === k ? '3' : i === 0 ? '5' : '4'); }
    for (const y of [7, 19]) for (let x = c - 2; x <= c + 2; x++) wset(g, x, y, y === 7 ? (x < c ? '6' : '7') : '8');
    gem(g, c - 7, 13, 'v', 'w', 'x', 'y');
    wrap(g, c, 36, 42, 1, ['p', 'q', 'r']);
    for (let x = c - 2; x <= c + 2; x++) { wset(g, x, 43, '7'); wset(g, x, 46, '9'); } for (let y = 44; y <= 45; y++) { wset(g, c - 2, y, '7'); wset(g, c - 1, y, '7'); wset(g, c, y, '8'); wset(g, c + 1, y, '8'); wset(g, c + 2, y, '9'); }
    return { rows: wrows(g), grip: [c, 39] }; },
  spear() { const c = 5, g = wgrid(11, 64);
    for (let r = 0; r < 17; r++) { const hw = Math.round(4 * Math.pow(Math.sin(Math.PI * (r + 1) / 19), .8));
      for (let d = -hw; d <= hw; d++) wset(g, c + d, r, bladeCol(d, hw, r, false)); }
    for (let x = c - 2; x <= c + 2; x++) { wset(g, x, 17, x < c ? '6' : '7'); wset(g, x, 18, '8'); wset(g, x, 19, '7'); wset(g, x, 20, '9'); }
    gem(g, c, 18, 'B', 'C', 'D', 'E');
    for (const s of [-1, 1]) for (let y = 20; y < 30; y++) { const x = c + s * (3 + (y > 24 ? 1 : 0)); wset(g, x, y, y > 27 ? 'T' : (y % 2 ? 'S' : 'R')); if (y > 21 && y < 28) wset(g, x + s, y, 'T'); }
    for (let y = 21; y < 61; y++) { wset(g, c, y, 'n'); wset(g, c + 1, y, (y % 4 === 0) ? 'M' : 'N'); }
    wrap(g, c, 40, 47, 1, ['p', 'q', 'r']);
    for (let x = c - 1; x <= c + 2; x++) { wset(g, x, 61, '7'); wset(g, x, 62, '8'); wset(g, x, 63, '9'); }
    return { rows: wrows(g), grip: [c, 44] }; },
  wolfblade() { const c = 7, g = wgrid(16, 42);
    for (let r = 0; r < 28; r++) { const off = Math.round(3 * Math.sin(Math.PI * r / 30)), hw = r < 1 ? 0 : r < 3 ? 1 : r < 22 ? 2 : 3;
      for (let d = -hw; d <= hw; d++) { const x = c + off + d; wset(g, x, r, d === -hw ? 'v' : d === -hw + 1 ? 'w' : d === hw ? 'L' : d === hw - 1 ? 'K' : 'k'); } }
    for (const r of [9, 15, 21]) wset(g, c + Math.round(3 * Math.sin(Math.PI * r / 30)) + 3, r, 'L');
    for (let x = 1; x < 15; x++) { wset(g, x, 28, x < 7 ? 'f' : 'F'); wset(g, x, 29, 'G'); }
    for (const [x, y, ch] of [[0,27,'f'],[0,26,'f'],[1,27,'F'],[15,27,'F'],[15,26,'F'],[14,27,'G']]) wset(g, x, y, ch);
    gem(g, c, 29, 'v', 'w', 'x', 'y');
    wrap(g, c, 31, 37, 1, ['K', 'L', 'x']);
    for (let x = c - 2; x <= c + 2; x++) { wset(g, x, 38, 'F'); wset(g, x, 41, 'G'); } for (let y = 39; y <= 40; y++) { wset(g, c - 2, y, 'f'); wset(g, c + 2, y, 'G'); }
    wset(g, c - 1, 39, 'w'); wset(g, c, 39, 'v'); wset(g, c + 1, 39, 'x'); wset(g, c - 1, 40, 'x'); wset(g, c, 40, 'w'); wset(g, c + 1, 40, 'y');
    return { rows: wrows(g), grip: [c, 34] }; },
};
export const WEAP = { staff: { rows: STAFF_ART.rows, grip: STAFF_ART.grip, base: STAFF_ART.base, pal: HERO_PAL } };
for (const k in GEN) { const g = GEN[k](); WEAP[k] = { rows: g.rows, grip: g.grip, base: -Math.PI / 2, pal: WPAL2 }; }
export const WLEN: Record<string, number> = {}; for (const k in WEAP) { const W = WEAP[k]; let top = W.grip[1]; W.rows.forEach((r, y) => { if (y < top && /[^.]/.test(r)) top = y; }); WLEN[k] = (W.grip[1] - top) / 3; }
export const HAND_R = 5, REACH = 3, WREC = .16, HSY = .8;                    // 手離身體中心的距離 / 揮砍時手往前伸多少 / 揮完收刀時間 / 俯視壓扁
export const lerpA = (a, b, t) => { const d = ((b - a) % TAU + TAU * 1.5) % TAU - Math.PI; return a + d * t; };
// walking frames: move the legs under the robe
function heroLegRows(dl, dr) {
  const src = HERO_BODY.map(r => r.padEnd(HERO_W, '.')), out = src.map(r => [...r]);
  for (let y = 60; y < HERO_H; y++) for (let x = 21; x <= 31; x++) out[y][x] = '.';
  const put = (x0, x1, y0, y1, dy) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const ch = src[y][x], ty = y + dy; if (ch !== '.' && ty >= 60 && ty < HERO_H) out[ty][x] = ch; } };
  put(26, 30, 60, 64, dr); put(21, 26, 60, 65, dl);
  return out.map(r => r.join(''));
}
function heroLegs(dl, dr) { return makeSprite(heroLegRows(dl, dr), HERO_PAL); }
/* 攻擊姿勢：從站姿圖推出來 —— lean = 上半身往前（+）或往後（-）傾幾格，crouch = 身體壓低（+）或拉高（-）幾格，legs = 跨步 */
export const PPX = 6, PPY = 4, POSEC = {};                                    // 姿勢圖四周多留空間，傾身時帽子不會被切掉
export function heroPose(lean, crouch, legs) {
  const key = lean + ',' + crouch + ',' + legs; if (POSEC[key]) return POSEC[key];
  const rows = heroLegRows(legs ? -2 : 0, legs ? 1 : 0), FOOT = 59, W = HERO_W + PPX * 2, H = HERO_H + PPY;
  const ys = []; for (let y = 0; y < FOOT; y++) ys.push(y);
  const band = [50, 44, 54, 47, 41];                                        // 壓低時抽掉（拉高時重複）的是袍子中段，臉跟帽子不變形
  for (let i = 0; i < Math.min(5, Math.abs(crouch)); i++) { const j = ys.indexOf(band[i]); if (crouch > 0) ys.splice(j, 1); else ys.splice(j, 0, band[i]); }
  const out = Array.from({ length: H }, () => Array(W).fill('.'));
  for (let y = FOOT; y < HERO_H; y++) for (let x = 0; x < HERO_W; x++) out[y + PPY][x + PPX] = rows[y][x];
  ys.forEach((sy, i) => { const ty = FOOT - ys.length + i; if (ty + PPY < 0) return; const sh = Math.round(lean * (FOOT - ty) / FOOT);   // 越上面傾得越多
    for (let x = 0; x < HERO_W; x++) { const ch = rows[sy][x]; if (ch !== '.') { const tx = x + sh + PPX; if (tx >= 0 && tx < W) out[ty + PPY][tx] = ch; } } });
  return POSEC[key] = makeSprite(out.map(r => r.join('')), HERO_PAL);
}
/* 攻擊四段：Ready 架式 → Charge 蓄力舉刀 → Slash 揮砍 → Recovery 收招停一下，再回到架式
   角度以「面朝右」為準（負 = 往上、正 = 往下）；P = 每段的身體姿勢 [前傾, 下蹲, 跨步] */
export const ANIM = {
  dagger:   { C:['diag', 'flat', 'diag'], wu:.06, sw:.07, hold:.08, back:.12, up:-2.0, from:-1.3, to:.8, lift:3, P:{ C:[-3, -1, 0], S:[5, 1, 1], H:[6, 2, 1], R:[2, 0, 0] } },
  sword:    { C:['diag', 'flat', 'slam'], wu:.11, sw:.1, hold:.12, back:.15, up:-2.5, from:-1.5, to:.9, lift:5, P:{ C:[-4, -2, 0], S:[5, 0, 1], H:[5, 2, 1], R:[2, 0, 0] } },
  axe:      { C:['flatR', 'flat', 'slam'], wu:.2, sw:.13, hold:.16, back:.18, up:-2.8, from:-1.6, to:1.2, lift:7, P:{ C0:[-3, -1, 0], C:[-6, -3, 0], S:[4, 1, 1], H:[7, 4, 1], R:[3, 2, 0] } },
  wolfblade:{ C:['diag', 'flat', 'slam'], wu:.07, sw:.09, hold:.1, back:.13, up:-2.3, from:-1.4, to:.9, lift:4, P:{ C:[-3, -1, 0], S:[5, 0, 1], H:[5, 2, 1], R:[2, 0, 0] } },
  spear:    { wu:.09, sw:.14, hold:.08, back:.14, up:-.15, to:0, lift:0, P:{ C:[-4, 0, 0], S:[7, 0, 1], H:[6, 1, 1], R:[2, 0, 0] } },
  staff:    { wu:.12, sw:.07, hold:.12, back:.16, up:-2.0, to:.35, lift:4, P:{ C:[-2, -2, 0], S:[5, 0, 1], H:[3, 1, 0], R:[0, 0, 0] } },
};
const BACKP = { C:[-2, 2, 0], S:[4, 1, 1], H:[4, -2, 1] };              // 由下往上撩：壓低 → 往上
/* 揮法：up = 蓄力時刀在哪、from → to = 刀光範圍、lift = 手舉多高、sy = 揮的平面壓多扁（越小越像水平橫掃） */
export const STYLE = {
  diag:  { up:-2.4, from:-1.5, to:.9, lift:5, sy:.8 },                  // 斜劈：頭頂 → 前下方
  rise:  { up:2.0, from:1.5, to:-1.0, lift:-2, sy:.8, P:BACKP },        // 上撩
  flat:  { up:2.5, from:1.9, to:-1.9, lift:0, sy:.36, P:{ C:[-2, 1, 0], S:[4, 1, 1], H:[3, 1, 1] } },   // 橫掃：從身體近側往遠側掃一大圈
  flatR: { up:-2.5, from:-1.9, to:1.9, lift:0, sy:.36, P:{ C:[-2, 1, 0], S:[4, 1, 1], H:[3, 1, 1] } },  // 反向橫掃
  slam:  { up:-2.9, from:-1.6, to:1.3, lift:9, sy:.8, P:{ C:[-6, -3, 0], S:[5, 1, 1], H:[7, 4, 1] } },   // 收尾重劈：舉到最高，砸到底
};
export const HERO = {
  walk: [heroLegs(0, 0), heroLegs(-2, 1), heroLegs(0, 0), heroLegs(1, -2)],
  hand: makeSprite(HERO_HAND.map(r => r.padEnd(HERO_W, '.')), HERO_PAL),
};
for (const t in ANIM) for (const k in ANIM[t].P) heroPose(...(ANIM[t].P[k] as Parameters<typeof heroPose>));
for (const t in STYLE) for (const k in (STYLE[t].P || {})) heroPose(...(STYLE[t].P[k] as Parameters<typeof heroPose>));
for (const k in BACKP) heroPose(...(BACKP[k] as Parameters<typeof heroPose>));
export const ROWS = {
  slime: ["....oooo....","..oogggGoo..",".ogwwggggGo.",".ogwgggggGo.","oggggggggggo","oggoggggoggo","oggggggggGGo","oGGggggggGGo",".oGGGGGGGGo.","..oooooooo.."],
  skel: ["...oooooo...","..obbbbbbo..",".obbbbbbbbo.",".oboobboobo.",".obeobbeobo.","..obbbbbbo..","..oboboboo..","...oooooo...","....obbo....","..oobBBboo..",".obobbbbobo.",".obooBBooboo","..o.obbo.o..","...obo.obo..","...obo.obo..","..obbo.obbo.","..ooo..ooo.."],
  wolf: ["...........o.o...","..........omomo..","..........offffo.","oo........ofeffoo","ofo.oooooofffffft",".ofoffffffffffooo","..offffmmffffo...","..oFFffffffFFo...","..oFo.oFo.oFo....","..oo..oo..oo....."],
  golem: ["....oooooooo....","...ossmmsssSo...","..osssmssssSSo..","..osyyssssyySo..","..ossssssssSSo..",".ooSSSSSSSSSSoo.","ossoossssssoosSo","osSoossmmssooSSo","osSoosssssSooSSo",".ooo.oSSSSSSo.oo","....ossoooSSo...","....osSo.oSSo...","...oSSSo.oSSSo..","...ooooo.ooooo.."],
  shroom: ["....oooo....","..oommmmoo..",".ommwmmmwmo.","ommmmmmmmmmo","omwmmMmmmwmo","oMMMMMMMMMMo",".oootttttoo.","...oteteo...","...otttto...","...oTttTo...","...oooooo..."],
  treant: ["....oooooo....","..ooffffffoo..",".offFffffFffo.","offffffFffffffo","ofFffffffffFfo",".offfffFffffo.","..ooonnnnooo..","..onnyNNynno..","..onnnnnnnno..",".onnoNnnNonno.","oNno.nnnn.oNno","oNo..nNnn..oNo",".o...nnNn...o.","....onnnno....","...onNo.oNno..","...ooo...ooo.."],
};
