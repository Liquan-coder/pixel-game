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
  katana() { const c = 4, g = wgrid(10, 50);                            // 太刀：細長、微彎的刀身 + 圓形刀鐔 + 菱紋刀柄
    for (let r = 0; r < 32; r++) { const off = Math.round(2.2 * Math.pow(1 - r / 31, 2)), d0 = r < 1 ? 0 : -1, d1 = r < 1 ? 0 : r < 3 ? 1 : 2;   // 刀尖往刀背那側彎
      for (let d = d0; d <= d1; d++) wset(g, c + off + d, r, d === d0 ? '1' : d === d1 ? (d1 > 1 ? '5' : '3') : d === 0 ? ((r * 7) % 9 < 4 ? '1' : '2') : '3'); }
    for (let x = c - 1; x <= c + 1; x++) wset(g, x, 32, x < c ? '6' : '7');
    for (let x = 0; x < 9; x++) { wset(g, x, 33, x === 0 || x === 8 ? '8' : 'K'); wset(g, x, 34, x === 0 || x === 8 ? '9' : 'L'); }
    wset(g, 1, 33, '7'); wset(g, 7, 34, '8');
    for (let y = 35; y <= 46; y++) for (let d = -1; d <= 1; d++) wset(g, c + d, y, (y + d) % 3 === 0 ? 'f' : (y + d) % 3 === 1 ? 'K' : 'L');
    for (let x = c - 1; x <= c + 1; x++) { wset(g, x, 47, '7'); wset(g, x, 48, '8'); } wset(g, c, 49, '9');
    return { rows: wrows(g), grip: [c, 40] }; },
  hammer() { const c = 9, g = wgrid(19, 50);                           // 戰鎚：方形鐵鎚頭 + 金箍 + 長柄
    for (let y = 12; y < 47; y++) { wset(g, c - 1, y, 'n'); wset(g, c, y, 'N'); wset(g, c + 1, y, 'M'); }
    for (let y = 1; y <= 12; y++) for (let x = 0; x < 19; x++) {
      const ch = y === 1 ? '1' : y === 12 ? '5' : x === 0 ? '2' : x === 18 ? '5' : x < 3 ? '2' : x > 15 ? '4' : '3';
      wset(g, x, y, ch); }
    for (const x of [5, 13]) for (let y = 1; y <= 12; y++) wset(g, x, y, y < 4 ? '6' : y > 9 ? '8' : '7');
    for (let y = 4; y <= 9; y++) { wset(g, 0, y, '1'); wset(g, 18, y, '4'); }
    wset(g, c, 0, '2'); wset(g, c - 1, 0, '1'); wset(g, c + 1, 0, '3');
    gem(g, c, 6, 'B', 'C', 'D', 'E');
    wrap(g, c, 36, 42, 1, ['p', 'q', 'r']);
    for (let x = c - 2; x <= c + 2; x++) { wset(g, x, 47, '7'); wset(g, x, 48, '8'); } wset(g, c, 49, '9');
    return { rows: wrows(g), grip: [c, 39] }; },
  scythe() { const c = 18, g = wgrid(22, 58);                          // 鐮刀：長柄頂端往一邊彎下去的新月刀
    for (let y = 3; y < 56; y++) { wset(g, c, y, 'n'); wset(g, c + 1, y, (y % 5 === 0) ? 'M' : 'N'); }
    for (let x = 0; x <= c; x++) { const u = (c - x) / c, top = Math.round(2 + 13 * Math.pow(u, 1.7)), th = Math.max(1, Math.round(6.5 * Math.pow(1 - u, .8) + .8));
      for (let k = 0; k <= th; k++) wset(g, x, top + k, k === th ? 'v' : k === th - 1 ? 'w' : k === 0 ? 'L' : k === 1 ? 'K' : 'k'); }
    for (let x = c - 1; x <= c + 2; x++) { wset(g, x, 1, '7'); wset(g, x, 2, '8'); }
    gem(g, c, 5, 'v', 'w', 'x', 'y');
    wrap(g, c, 30, 38, 1, ['K', 'L', 'x']);
    for (let x = c - 1; x <= c + 2; x++) { wset(g, x, 56, '7'); wset(g, x, 57, '9'); }
    return { rows: wrows(g), grip: [c, 34] }; },
  bow() { const c = 21, W = 43, g = wgrid(W, 20), H = c - 1;   // 長弓：紫金反曲弓。圖的「上方」= 射出去的方向；弓臂往後彎、尖端往前捲，弦在後面
    // 弓臂中心線：前段往後彎（拋物線），最後 15% 往前、往外捲一點（反曲）
    const Y = a => a < .85 ? 3 + 10 * Math.pow(a / .85, 1.8) : 13 - Math.pow((a - .85) / .15, 1.6) * 2.4;
    const thick = a => a < .15 ? 4 : 3;
    for (let x = 1; x < W - 1; x++) { const a = Math.abs(x - c) / H, y = Math.round(Y(a));
      if (a > .86) { wset(g, x, y, '6'); wset(g, x, y + 1, '7'); wset(g, x, y + 2, '8'); continue; }   // 金色弓角
      const th = thick(a); wset(g, x, y, a < .5 ? 'n' : '2');                       // 前緣：中段木頭亮面，外段銀色
      for (let k = 1; k <= th; k++) wset(g, x, y + k, k === th ? 'M' : k === 1 ? 'N' : 'M');
      if (a >= .5) { wset(g, x, y, '2'); wset(g, x, y + 1, 'p'); wset(g, x, y + 2, 'q'); wset(g, x, y + 3, 'r'); if (x % 4 === 0) wset(g, x, y + 2, 'w'); }   // 外段：深紫色金屬弓臂
      if (a > .2 && a < .5 && x % 3 === 0) wset(g, x, y + 1, '7'); }                // 金色鑲線
    // 弦：接在弓角上
    const tipY = Math.round(Y(.86)) + 2, sy = tipY + 1;
    for (let x = 2; x < W - 2; x++) if (g[sy][x] === '.') wset(g, x, sy, 'f');
    // 握把 + 寶石 + 箭台
    wrap(g, c, 2, 7, 2, ['p', 'q', 'r']); gem(g, c, 4, 'B', 'C', 'D', 'E');
    for (let x = c - 3; x <= c + 3; x++) { wset(g, x, 1, Math.abs(x - c) === 3 ? '8' : '7'); wset(g, x, 8, '8'); }
    wset(g, c - 1, 0, '6'); wset(g, c, 0, '7'); wset(g, c + 1, 0, '8');
    // 握把兩旁的銀色翼片
    for (const s of [-1, 1]) for (const [dx, dy, ch] of [[3, 2, '2'], [4, 2, '3'], [4, 3, '3'], [5, 3, '4'], [3, 3, '3']] as const) wset(g, c + s * dx, dy, ch);
    // 穗子
    for (let y = 9; y < 14; y++) { wset(g, c - 1, y, y % 2 ? 'R' : 'S'); wset(g, c, y, y < 12 ? 'S' : 'T'); }
    wset(g, c - 1, 14, 'T');
    return { rows: wrows(g), grip: [c, 5] }; },
  greatsword() { const c = 10, g = wgrid(21, 66);   // 大劍：很寬的斬馬刀劍身、斜切的劍尖、黑色血槽 + 紅色符文、劍根倒鉤、皮革長柄、圓形重柄頭（跟長劍一眼就分得出來）
    const B1 = 38;                                             // 劍身 0..37
    for (let r = 0; r < B1; r++) {
      const left = r < 7 ? c + 5 - Math.round(r * 10 / 6) : c - 5, right = c + 5;   // 斜切劍尖：從右上往左下切
      for (let x = left; x <= right; x++) { const d = x - c;
        let ch = d === -5 ? '1' : d === -4 ? '2' : d === 5 ? '5' : d === 4 ? '4' : d < 0 ? '3' : '4';
        if (x === left && left > c - 5) ch = '1';                             // 斜切面也是刃
        if (r > 8 && r < 34 && (d === 0 || d === 1)) ch = d === 0 ? 'L' : 'K';   // 血槽
        wset(g, x, r, ch); } }
    for (const r of [12, 17, 22, 27]) { wset(g, c, r, 'S'); wset(g, c + 1, r, 'T'); wset(g, c, r + 1, 'R'); }   // 符文
    for (const r of [3, 10, 20]) wset(g, c - 3, r, '1');                                 // 劍身上的反光
    // 劍根（窄一點）+ 倒鉤
    for (let r = 38; r < 44; r++) for (let d = -3; d <= 3; d++) wset(g, c + d, r, d === -3 ? '2' : d === 3 ? '5' : d < 0 ? '3' : d === 0 ? 'G' : '4');
    for (const [x, y, ch] of [[c - 4, 38, '7'], [c - 5, 37, '7'], [c - 6, 36, '6'], [c - 5, 38, '8'], [c + 4, 38, '8'], [c + 5, 37, '8'], [c + 6, 36, '7'], [c + 5, 38, '9']] as const) wset(g, x, y, ch);
    // 大護手：鐵灰 + 金色兩端，往下彎
    for (let x = 0; x < 21; x++) { const d = Math.abs(x - c), dy = d > 7 ? 1 : 0;
      wset(g, x, 44 + dy, d > 8 ? '7' : 'F'); wset(g, x, 45 + dy, d > 8 ? '8' : 'G'); if (d <= 7) wset(g, x, 46, d === 0 ? 'G' : 'K'); }
    gem(g, c, 45, 'R', 'S', 'T', 'T');
    // 長皮革握柄（交叉纏繞）
    wrap(g, c, 47, 59, 1, ['n', 'N', 'M']);
    // 沉重的圓形柄頭
    for (let y = 60; y <= 65; y++) for (let x = c - 3; x <= c + 3; x++) { const dx = x - c, dy = y - 62.5;
      if (dx * dx + dy * dy * 1.3 > 11) continue; wset(g, x, y, dx + dy < -2 ? 'f' : dx + dy < 1 ? 'F' : 'G'); }
    wset(g, c, 62, 'S'); wset(g, c, 63, 'T');
    return { rows: wrows(g), grip: [c, 54] }; },
  rapier() { const c = 5, g = wgrid(11, 46);                            // 細劍：很細的長劍身 + 繞到手背的護弓
    for (let r = 0; r < 32; r++) { wset(g, c, r, r < 2 ? '2' : '1'); if (r > 2) wset(g, c + 1, r, r % 7 === 0 ? '3' : '4'); }
    for (let x = 0; x < 11; x++) wset(g, x, 32, x === 0 || x === 10 ? '8' : x < 5 ? '6' : '7');
    for (let x = 2; x < 9; x++) wset(g, x, 33, '8');
    for (let y = 33; y <= 41; y++) wset(g, c + 4, y, y > 39 ? '8' : '7');                     // 護弓：從護手繞到柄尾
    gem(g, c, 33, 'R', 'S', 'T', 'T');
    wrap(g, c, 35, 40, 1, ['p', 'q', 'r']);
    for (let x = c - 1; x <= c + 3; x++) wset(g, x, 41, '7'); for (let x = c - 1; x <= c + 1; x++) { wset(g, x, 42, '8'); wset(g, x, 43, '9'); } wset(g, c, 42, 'C');
    return { rows: wrows(g), grip: [c, 38] }; },
  crescent() { const c = 17, g = wgrid(22, 48);                         // 月牙刀：短柄上一大片新月形的刀（外圈是刃）
    for (let y = 0; y < 31; y++) for (let x = 0; x <= 18; x++) { const dO = Math.hypot(x - 17, y - 15), dI = Math.hypot(x - 21, y - 13);
      if (dO > 14.2 || dI <= 11.5) continue; const e = 14.2 - dO, i = dI - 11.5;
      wset(g, x, y, e < 1 ? '1' : e < 2 ? '2' : i < 1 ? '5' : i < 2.2 ? '4' : '3'); }
    gem(g, 6, 15, 'B', 'C', 'D', 'E');
    for (let y = 27; y < 47; y++) { wset(g, c, y, 'n'); wset(g, c + 1, y, 'N'); }
    for (let x = c - 2; x <= c + 3; x++) { wset(g, x, 28, '7'); wset(g, x, 29, '8'); }
    wrap(g, c, 33, 42, 1, ['p', 'q', 'r']);
    for (let x = c - 1; x <= c + 2; x++) { wset(g, x, 45, '7'); wset(g, x, 46, '8'); wset(g, x, 47, '9'); }
    return { rows: wrows(g), grip: [c, 38] }; },
  twinblade() { const c = 5, g = wgrid(11, 74);                         // 雙頭刀：長柄兩端各一把刀，從中間握
    const blade = (r: number, flip: boolean) => { const hw = Math.round(3 * Math.pow(Math.sin(Math.PI * (r + 1) / 21), .7)), y = flip ? 73 - r : r;
      for (let d = -hw; d <= hw; d++) wset(g, c + d, y, bladeCol(flip ? -d : d, hw, r, r > 5 && r < 16)); };
    for (let r = 0; r < 20; r++) { blade(r, false); blade(r, true); }
    for (const [y, a, b] of [[20, '6', '7'], [21, '8', '8'], [52, '8', '8'], [53, '6', '7']] as const) for (let x = c - 3; x <= c + 3; x++) wset(g, x, y, x < c ? a : b);
    for (let y = 22; y < 52; y++) { wset(g, c, y, 'n'); wset(g, c + 1, y, y % 5 === 0 ? 'M' : 'N'); }
    wrap(g, c, 32, 42, 1, ['K', 'L', 'x']);
    gem(g, c, 21, 'B', 'C', 'D', 'E'); gem(g, c, 52, 'B', 'C', 'D', 'E');
    return { rows: wrows(g), grip: [c, 37] }; },
  darkmoon() { const c = 9, g = wgrid(19, 62);                          // 暗月大劍：深藍色的大劍身，中間一條發光的月光，刃口泛白
    for (let r = 0; r < 41; r++) { const hw = r < 2 ? 0 : r < 4 ? 1 : r < 6 ? 2 : r < 8 ? 3 : 4;
      for (let d = -hw; d <= hw; d++) wset(g, c + d, r, r < 2 ? 'B' : d === -hw ? 'B' : d === hw ? 'C' : d === 0 ? 'D' : Math.abs(d) === 1 ? 'K' : d < 0 ? 'k' : 'L'); }
    for (const r of [11, 19, 27, 34]) wset(g, c - 2, r, '1');                                // 劍身上的星點
    for (let x = 0; x < 19; x++) { wset(g, x, 41, x < 9 ? 'f' : 'F'); wset(g, x, 42, 'G'); if (x > 1 && x < 17) wset(g, x, 43, 'G'); }
    for (const [x, y, ch] of [[0, 40, 'f'], [0, 39, 'f'], [1, 40, 'f'], [18, 40, 'F'], [18, 39, 'F'], [17, 40, 'F']] as const) wset(g, x, y, ch);   // 護手兩端往上翹，像月牙
    gem(g, c, 42, 'B', 'C', 'D', 'E');
    wrap(g, c, 44, 55, 1, ['K', 'L', 'x']);
    for (let x = c - 2; x <= c + 2; x++) { wset(g, x, 56, 'F'); wset(g, x, 60, 'G'); }
    for (let y = 57; y <= 59; y++) { wset(g, c - 2, y, 'f'); wset(g, c + 2, y, 'G'); }
    gem(g, c, 58, 'B', 'C', 'D', 'E');
    return { rows: wrows(g), grip: [c, 50] }; },
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
  katana:   { C:['flat', 'diag', 'slam'], wu:.07, sw:.07, hold:.1, back:.12, up:-2.2, from:-1.4, to:.9, lift:4, P:{ C:[-3, -1, 0], S:[6, 1, 1], H:[6, 2, 1], R:[2, 0, 0] } },
  hammer:   { C:['diag', 'flatR', 'slam'], wu:.22, sw:.13, hold:.18, back:.2, up:-2.9, from:-1.6, to:1.2, lift:8, P:{ C0:[-3, -1, 0], C:[-6, -3, 0], S:[4, 1, 1], H:[7, 4, 1], R:[3, 2, 0] } },
  scythe:   { C:['flat', 'flatR', 'slam'], wu:.13, sw:.12, hold:.14, back:.16, up:-2.5, from:-1.6, to:1.1, lift:5, P:{ C:[-4, -1, 0], S:[5, 1, 1], H:[5, 2, 1], R:[2, 0, 0] } },
  staff:    { wu:.12, sw:.07, hold:.12, back:.16, up:-2.0, to:.35, lift:4, P:{ C:[-2, -2, 0], S:[5, 0, 1], H:[3, 1, 0], R:[0, 0, 0] } },
  bow:      { wu:.12, sw:.05, hold:.1, back:.14, up:0, to:0, lift:2, P:{ C:[-3, 0, 0], S:[2, 0, 1], H:[1, 0, 0], R:[0, 0, 0] } },   // 拉弓：弓一直朝前，身體往後拉
  greatsword:{ C:['flat', 'flatR', 'slam'], wu:.24, sw:.14, hold:.18, back:.2, up:-2.9, from:-1.7, to:1.3, lift:8, P:{ C0:[-3, -1, 0], C:[-6, -3, 0], S:[4, 1, 1], H:[7, 4, 1], R:[3, 2, 0] } },
  rapier:   { wu:.05, sw:.08, hold:.06, back:.1, up:-.1, to:0, lift:0, P:{ C:[-3, 0, 0], S:[7, 0, 1], H:[5, 1, 1], R:[2, 0, 0] } },
  crescent: { C:['diag', 'flatR', 'flat'], wu:.09, sw:.1, hold:.12, back:.14, up:-2.4, from:-1.5, to:1.0, lift:5, P:{ C:[-3, -1, 0], S:[5, 1, 1], H:[5, 2, 1], R:[2, 0, 0] } },
  twinblade:{ C:['flat', 'flatR', 'diag', 'rise'], wu:.06, sw:.08, hold:.08, back:.12, up:-2.3, from:-1.5, to:1.0, lift:3, P:{ C:[-3, -1, 0], S:[5, 1, 1], H:[6, 2, 1], R:[2, 0, 0] } },
  darkmoon: { C:['diag', 'flatR', 'slam'], wu:.22, sw:.13, hold:.16, back:.18, up:-2.9, from:-1.7, to:1.3, lift:8, P:{ C0:[-3, -1, 0], C:[-6, -3, 0], S:[4, 1, 1], H:[7, 4, 1], R:[3, 2, 0] } },
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
