import { G } from './state';

/* ================= AUDIO ================= */
let AC = null, noiseBuf = null, lastHitSfx = 0;
export function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * .3, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(freq, dur, type = 'square', vol = .05, slide = 0, delay = 0) {
  if (!AC || G.muted) return;
  try { const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + .02); } catch (e) {}
}
function noiseHit(dur, vol, freq = 1200) {
  if (!AC || G.muted || !noiseBuf) return;
  try { const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), t = AC.currentTime;
    s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t); s.stop(t + dur); } catch (e) {}
}
export const sfx = {
  swing: () => tone(500, .07, 'triangle', .03, -260),
  hit: () => { if (G.time - lastHitSfx < .04) return; lastHitSfx = G.time; noiseHit(.08, .12, 1600); tone(140, .06, 'square', .03, -60); },
  crit: () => { noiseHit(.12, .16, 2600); tone(880, .08, 'square', .03, 300); },
  hurt: () => { tone(200, .2, 'sawtooth', .06, -120); noiseHit(.1, .1, 700); },
  pick: () => { tone(880, .06, 'square', .035); tone(1320, .09, 'square', .035, 0, .06); },
  epic: () => { [660, 880, 1100, 1320].forEach((f, i) => tone(f, .12, 'square', .035, 0, i * .07)); },
  level: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, .14, 'triangle', .05, 0, i * .08)); },
  discover: () => { [392, 523, 659].forEach((f, i) => tone(f, .25, 'triangle', .04, 0, i * .12)); },
  dodge: () => noiseHit(.12, .06, 500),
  drink: () => { tone(400, .12, 'sine', .05, 300); tone(600, .15, 'sine', .04, 300, .1); },
  kill: () => { tone(300, .12, 'square', .035, -200); },
  skill: () => { tone(300, .2, 'sawtooth', .04, 500); noiseHit(.15, .08, 2000); },
  howl: () => { tone(180, 1.0, 'sawtooth', .06, 200); tone(240, .9, 'square', .025, 160, .05); },
  boom: () => { noiseHit(.35, .2, 500); tone(80, .3, 'sine', .08, -40); },
  fire: () => tone(1200, .25, 'sine', .04, 600),
  death: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, .3, 'triangle', .05, 0, i * .18)); },
  blink: () => { tone(1500, .09, 'sine', .035, -1100); noiseHit(.06, .04, 3000); },
  blinkIn: () => tone(600, .1, 'sine', .035, 900),
  charge: lv => { tone(lv === 2 ? 990 : 660, .12, 'triangle', .045, 220); if (lv === 2) tone(1320, .16, 'triangle', .03, 0, .08); },
  release: lv => { noiseHit(.14, .1, lv === 2 ? 2600 : 1800); tone(lv === 2 ? 220 : 300, .2, 'sawtooth', .04, 420); },
  coin: () => { tone(1320, .04, 'square', .025); tone(1760, .06, 'square', .02, 0, .04); },
  buy: () => { [880, 1175].forEach((f, i) => tone(f, .08, 'square', .03, 0, i * .06)); },
  win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .25, 'square', .045, 0, i * .12)); },
};

