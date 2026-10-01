/**
 * Procedural game audio (Web Audio API). Most sounds are synthesized.
 * The victory sound is a file (victory.mp3 next to this file) loaded once and played
 * through the same sfx bus, so mute and background-pause still apply.
 */
const KEY = "escape:muted";
// Resolved by the bundler relative to this file, so victory.mp3 must sit next to audio.ts.
const VICTORY_URL = new URL("./victory.mp3", import.meta.url).href;

let ctx: AudioContext | null = null;
let master!: GainNode;
let sfx!: GainNode;
let verbIn!: GainNode;
let noiseBuf!: AudioBuffer;
let victoryBuf: AudioBuffer | null = null;
let victoryLoading = false;
let unlocked = false;
let muted = false;
let mutedLoaded = false;

function loadMuted() {
  if (mutedLoaded || typeof window === "undefined") return;
  mutedLoaded = true;
  try {
    muted = localStorage.getItem(KEY) === "1";
  } catch {
    /* ignore unreadable storage */
  }
}

function impulse(c: AudioContext) {
  const len = Math.floor(c.sampleRate * 2.2);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function build(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(comp);
  comp.connect(ctx.destination);

  sfx = ctx.createGain();
  sfx.gain.value = 0.9;
  sfx.connect(master);

  // Shared soft reverb
  verbIn = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = impulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  verbIn.connect(conv);
  conv.connect(wet);
  wet.connect(master);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Fetch and decode the victory file once. Safe to call repeatedly. */
function loadVictory(c: AudioContext) {
  if (victoryBuf || victoryLoading) return;
  victoryLoading = true;
  fetch(VICTORY_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((data) => c.decodeAudioData(data))
    .then((buf) => {
      victoryBuf = buf;
    })
    .catch((err) => {
      console.warn("[audio] victory sound failed to load:", VICTORY_URL, err);
      // Allow a retry on the next unlock; win() falls back to the synth fanfare meanwhile.
      victoryLoading = false;
    });
}

function ready(): AudioContext | null {
  if (!unlocked || muted) return null;
  const c = build();
  if (!c) return null;
  if (c.state === "suspended") void c.resume();
  return c;
}

function play(fn: (c: AudioContext, t: number) => void) {
  const c = ready();
  if (c) fn(c, c.currentTime + 0.01);
}

/* ---------- building blocks ---------- */

function env(g: GainNode, t: number, peak: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  attack?: number;
  glideTo?: number;
  send?: number;
  bus?: AudioNode;
}

function tone(c: AudioContext, freq: number, t: number, dur: number, o: ToneOpts = {}) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t + dur);
  env(g, t, o.vol ?? 0.15, o.attack ?? 0.01, dur);
  osc.connect(g);
  g.connect(o.bus ?? sfx);
  if (o.send) {
    const s = c.createGain();
    s.gain.value = o.send;
    g.connect(s);
    s.connect(verbIn);
  }
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function swoosh(c: AudioContext, t: number, dur: number, vol: number, f0: number, f1: number, q = 1) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(sfx);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function bell(c: AudioContext, f: number, t: number, dur: number, vol: number) {
  tone(c, f, t, dur, { vol, attack: 0.005, send: 0.5 });
  tone(c, f * 2, t, dur * 0.6, { vol: vol * 0.3, attack: 0.005, send: 0.5 });
}

/* ---------- sound effects ---------- */

/** Soft UI tap (menu arrows, back, mute). */
export const click = () =>
  play((c, t) => {
    tone(c, 660, t, 0.09, { type: "triangle", vol: 0.1 });
    tone(c, 990, t + 0.03, 0.08, { vol: 0.05 });
  });

/** Level start / restart / next level / play. */
export const start = () =>
  play((c, t) => {
    swoosh(c, t, 0.35, 0.06, 300, 1400);
    tone(c, 523.25, t + 0.05, 0.3, { vol: 0.08, send: 0.3 });
    tone(c, 783.99, t + 0.13, 0.4, { vol: 0.08, send: 0.3 });
  });

/** Finger touches a car. */
export const grab = () =>
  play((c, t) => tone(c, 220, t, 0.08, { type: "triangle", vol: 0.07, glideTo: 180 }));

/** Tiny tick each time a dragged car crosses a cell. */
export const tick = () => play((c, t) => tone(c, 900, t, 0.04, { type: "triangle", vol: 0.04 }));

/** A car finished a move: soft whoosh + engine hum + gentle thunk. */
export const move = () =>
  play((c, t) => {
    swoosh(c, t, 0.18, 0.07, 350, 1100, 0.9);
    tone(c, 85, t, 0.22, { type: "triangle", vol: 0.05, glideTo: 110 });
    tone(c, 150, t + 0.11, 0.14, { vol: 0.18, glideTo: 70 });
  });

/** Hint chime (three rising sparkles). */
export const hint = () =>
  play((c, t) => {
    [987.77, 1318.51, 1760].forEach((f, i) =>
      tone(c, f, t + i * 0.09, 0.6, { vol: 0.09, send: 0.5 }),
    );
  });

/** Undo: soft falling blip. */
export const undo = () =>
  play((c, t) => tone(c, 560, t, 0.14, { type: "triangle", vol: 0.1, glideTo: 380 }));

/** Red car drives out: engine rev + whoosh. */
export const escape = () =>
  play((c, t) => {
    swoosh(c, t, 0.7, 0.09, 300, 2500);
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.7);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1600, t + 0.7);
    const g = c.createGain();
    env(g, t, 0.1, 0.08, 0.75);
    o.connect(f);
    f.connect(g);
    g.connect(sfx);
    o.start(t);
    o.stop(t + 0.8);
  });

/** Victory: plays the victory.mp3 file (falls back to a synth fanfare if it has not loaded). */
export const win = () =>
  play((c, t) => {
    if (victoryBuf) {
      const src = c.createBufferSource();
      src.buffer = victoryBuf;
      src.connect(sfx);
      src.start(t);
      return;
    }
    loadVictory(c);
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => bell(c, f, t + i * 0.11, 1.1, 0.12));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => bell(c, f, t + 0.62, 1.8, 0.09));
    tone(c, 130.81, t + 0.62, 1.2, { vol: 0.08 });
    const sparkle = [2093, 2637, 3136, 2349];
    for (let i = 0; i < 8; i++) {
      tone(c, sparkle[i % 4]!, t + 0.7 + i * 0.09, 0.35, { vol: 0.035, send: 0.6 });
    }
  });

/* ---------- public controls ---------- */

/** Call on any user gesture. Safe to call repeatedly. Also preloads the victory sound. */
export function unlockAudio() {
  loadMuted();
  unlocked = true;
  const c = build();
  if (!c) return;
  if (c.state !== "running") void c.resume();
  loadVictory(c);
}

export function isMuted() {
  loadMuted();
  return muted;
}

export function setMuted(m: boolean) {
  loadMuted();
  muted = m;
  try {
    localStorage.setItem(KEY, m ? "1" : "0");
  } catch {
    /* ignore unwritable storage */
  }
  const c = ctx;
  if (!c) return;
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setTargetAtTime(m ? 0 : 1, c.currentTime, 0.04);
  if (!m) void c.resume();
}

// Pause audio when the app/tab goes to the background (saves battery, avoids sound when hidden).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (unlocked && !muted) void ctx.resume();
  });
}