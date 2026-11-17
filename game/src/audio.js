// Synthesised sound effects through WebAudio: no audio files, nothing fetched. The context
// is created on the first user gesture (browsers block audio before one) and every effect is a
// short oscillator or filtered-noise burst, so a muted tab or a headless screenshot run stays
// silent without any error.

let context = null;
let muted = false;

function ensureContext() {
  if (context !== null) return context;
  try {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  } catch {
    context = null;
  }
  return context;
}

/** Call from a user gesture (start, dash, nova) so the context is allowed to run. */
export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freqFrom, freqTo, duration, type, gain) {
  if (muted) return;
  const ctx = ensureContext();
  if (ctx === null) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), now + duration);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Audio is decoration: never let it break the game.
  }
}

function noise(duration, filterFreq, gain) {
  if (muted) return;
  const ctx = ensureContext();
  if (ctx === null) return;
  try {
    const now = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    source.start(now);
  } catch {
    // Audio is decoration: never let it break the game.
  }
}

/** A collect blip that climbs in pitch as the combo multiplier grows. */
export function playCollect(multiplier) {
  const base = 520 + Math.min(multiplier, 5) * 90;
  tone(base, base * 1.6, 0.12, 'sine', 0.16);
}

/** The dash whoosh. */
export function playDash() {
  noise(0.18, 1400, 0.2);
  tone(300, 90, 0.16, 'sawtooth', 0.06);
}

/** A hit: low thud plus a short downward buzz. */
export function playHit() {
  tone(160, 50, 0.3, 'square', 0.2);
  noise(0.22, 300, 0.22);
}

/** The Nova: a rising arpeggio over a bright wash. */
export function playNova() {
  [523, 659, 784, 1047].forEach((freq, index) => {
    window.setTimeout(() => tone(freq, freq, 0.28, 'triangle', 0.16), index * 70);
  });
  noise(0.5, 2400, 0.08);
}

/** A level-up: two bright notes. */
export function playLevel() {
  tone(660, 660, 0.12, 'triangle', 0.14);
  window.setTimeout(() => tone(880, 880, 0.2, 'triangle', 0.14), 110);
}

/** Game over: a short descending line. */
export function playOver() {
  [392, 311, 233].forEach((freq, index) => {
    window.setTimeout(() => tone(freq, freq * 0.94, 0.3, 'sawtooth', 0.1), index * 160);
  });
}

/** The win fanfare: a rising major line. */
export function playWin() {
  [523, 659, 784, 1047, 1319].forEach((freq, index) => {
    window.setTimeout(() => tone(freq, freq, 0.3, 'triangle', 0.15), index * 110);
  });
}
