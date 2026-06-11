"use client";

// ============================================================
// FUTBATTLE — AudioManager + synthesized SFX (WebAudio, no
// assets, offline). PES-menu-inspired blips and stings, all
// generated at runtime — never ripped, never downloaded.
//
// Channels: ui (menu blips), crowd (stadium loop/explosions),
// voice (narration stings). Each channel has its own gain under
// a master gain; mute + volumes persist in localStorage.
// All calls are safe no-ops on the server or without a gesture.
// ============================================================

export type AudioChannel = "ui" | "crowd" | "voice";

interface AudioSettings {
  muted: boolean;
  master: number;
  ui: number;
  crowd: number;
  voice: number;
}

const STORAGE_KEY = "futbattle-audio";

const DEFAULTS: AudioSettings = { muted: false, master: 0.9, ui: 1, crowd: 0.8, voice: 0.9 };

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const channelGains: Partial<Record<AudioChannel, GainNode>> = {};
let settings: AudioSettings = { ...DEFAULTS };
let settingsLoaded = false;

function loadSettings() {
  if (settingsLoaded || typeof window === "undefined") return;
  settingsLoaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* corrupt storage — keep defaults */ }
}

function saveSettings() {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* quota/private mode */ }
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  loadSettings();
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = settings.muted ? 0 : settings.master;
    masterGain.connect(ctx.destination);
    for (const ch of ["ui", "crowd", "voice"] as const) {
      const g = ctx.createGain();
      g.gain.value = settings[ch];
      g.connect(masterGain);
      channelGains[ch] = g;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function out(ch: AudioChannel): AudioNode | null {
  const c = ac();
  if (!c) return null;
  return channelGains[ch] ?? masterGain;
}

// ── Public settings API ──────────────────────────────────────
export function setMuted(m: boolean) {
  loadSettings();
  settings.muted = m;
  if (masterGain && ctx) masterGain.gain.setTargetAtTime(m ? 0 : settings.master, ctx.currentTime, 0.02);
  saveSettings();
}
export function isMuted() { loadSettings(); return settings.muted; }

export function setVolume(ch: AudioChannel | "master", v: number) {
  loadSettings();
  const vol = Math.min(1, Math.max(0, v));
  if (ch === "master") {
    settings.master = vol;
    if (masterGain && ctx && !settings.muted) masterGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
  } else {
    settings[ch] = vol;
    const g = channelGains[ch];
    if (g && ctx) g.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
  }
  saveSettings();
}
export function getVolume(ch: AudioChannel | "master") { loadSettings(); return settings[ch]; }

// ── Synth primitives ─────────────────────────────────────────
function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, when = 0, glideTo?: number, ch: AudioChannel = "ui") {
  const c = ac();
  const dest = out(ch);
  if (!c || !dest || settings.muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.05, when = 0, ch: AudioChannel = "ui", filterFreq?: number) {
  const c = ac();
  const dest = out(ch);
  if (!c || !dest || settings.muted) return;
  const t0 = c.currentTime + when;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let head: AudioNode = src;
  if (filterFreq) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    src.connect(f);
    head = f;
  }
  head.connect(g);
  g.connect(dest);
  src.start(t0);
}

// ── UI sfx (menu navigation, PES-style) ──────────────────────
/** Menu hover/move — the classic PES tick. */
export const sfxMove = () => tone(740, 0.05, "square", 0.04);

/** Menu confirm — two-step rising blip + low thunk body. */
export function sfxConfirm() {
  tone(620, 0.07, "square", 0.05);
  tone(930, 0.10, "square", 0.05, 0.07);
  tone(140, 0.09, "sine", 0.07);
}

/** Cancel/back. */
export const sfxBack = () => tone(360, 0.09, "square", 0.05);

/** Roulette spin tick (call per frame change). */
export const sfxTick = () => tone(1180, 0.03, "triangle", 0.035);

/** Rolling counter tick — softer than sfxTick, safe to spam. */
export const sfxCount = () => tone(980, 0.022, "triangle", 0.02);

/** Screen transition whoosh (forward = up-sweep, back = down-sweep). */
export function sfxWhoosh(reverse = false) {
  noise(0.28, 0.05, 0, "ui", reverse ? 900 : 2400);
  tone(reverse ? 520 : 240, 0.26, "sine", 0.035, 0, reverse ? 240 : 520);
}

/** Rubber-stamp slam (badges, "CONVOCADO", official decisions). */
export function sfxStamp() {
  tone(110, 0.12, "sine", 0.12);
  noise(0.08, 0.07, 0, "ui", 1400);
  tone(70, 0.16, "sine", 0.08, 0.02);
}

/** Drumroll for draws/roulette suspense (~`dur`s of snare taps). */
export function sfxDrumroll(dur = 1.6) {
  const taps = Math.floor(dur / 0.055);
  for (let i = 0; i < taps; i++) {
    const t = i * 0.055;
    noise(0.04, 0.018 + 0.022 * (i / taps), t, "ui", 3000);
    if (i % 4 === 0) tone(180, 0.04, "sine", 0.02, t);
  }
}

/** Roulette landed — dramatic hit. */
export function sfxReveal() {
  tone(220, 0.4, "sawtooth", 0.05, 0, 110);
  tone(880, 0.25, "triangle", 0.06, 0.05);
  noise(0.3, 0.04, 0.05);
}

// ── Match sfx ────────────────────────────────────────────────
/** Goal! Crowd explosion + horn. */
export function sfxGoal() {
  noise(1.2, 0.09, 0, "crowd");
  tone(392, 0.5, "sawtooth", 0.05, 0.05, 523, "crowd");
  tone(523, 0.7, "sawtooth", 0.04, 0.4, 659, "crowd");
}

/** Referee whistle (kickoff/halftime/fulltime). */
export function sfxWhistle(double = false) {
  tone(2400, 0.18, "square", 0.04, 0, 2300, "voice");
  if (double) {
    tone(2400, 0.14, "square", 0.04, 0.24, 2300, "voice");
    tone(2400, 0.32, "square", 0.04, 0.44, 2200, "voice");
  }
}

/** Elimination — crowd deflates, sad descending tones. */
export function sfxElimination() {
  noise(2.0, 0.06, 0, "crowd", 700);
  tone(440, 0.5, "triangle", 0.05, 0.1, 330, "voice");
  tone(330, 0.6, "triangle", 0.05, 0.55, 247, "voice");
  tone(247, 1.0, "triangle", 0.045, 1.1, 165, "voice");
}

/** Trophy fanfare — rising brass-ish arpeggio + crowd roar. */
export function sfxTrophy() {
  const seq: Array<[number, number]> = [[392, 0], [523, 0.14], [659, 0.28], [784, 0.42]];
  for (const [f, t] of seq) tone(f, 0.3, "sawtooth", 0.045, t, undefined, "voice");
  tone(1047, 0.9, "sawtooth", 0.05, 0.56, undefined, "voice");
  tone(784, 0.9, "triangle", 0.04, 0.56, undefined, "voice");
  noise(1.6, 0.07, 0.4, "crowd");
}

// ── Crowd loop (dynamic stadium ambience) ────────────────────
let crowdSrc: AudioBufferSourceNode | null = null;
let crowdGain: GainNode | null = null;

/** Start looping crowd murmur. Intensity 0–1 controls loudness/excitement. */
export function startCrowd(intensity = 0.4) {
  const c = ac();
  const dest = out("crowd");
  if (!c || !dest || crowdSrc) return;
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // brown-ish noise loops smoothly and reads as distant crowd
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.2;
  }
  crowdSrc = c.createBufferSource();
  crowdSrc.buffer = buf;
  crowdSrc.loop = true;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  crowdGain = c.createGain();
  crowdGain.gain.value = 0.05 + intensity * 0.12;
  crowdSrc.connect(f).connect(crowdGain).connect(dest);
  crowdSrc.start();
}

/** Ramp crowd excitement (0 calm → 1 frenzy). */
export function setCrowdIntensity(intensity: number) {
  if (!crowdGain || !ctx) return;
  const v = 0.05 + Math.min(1, Math.max(0, intensity)) * 0.12;
  crowdGain.gain.setTargetAtTime(v, ctx.currentTime, 0.4);
}

export function stopCrowd() {
  try { crowdSrc?.stop(); } catch { /* already stopped */ }
  crowdSrc = null;
  crowdGain = null;
}

// ── Sound map (interaction → SFX), the Fase 1 contract ───────
export const SFX_MAP = [
  { interaction: "Hover / navegar no menu", fn: "sfxMove", channel: "ui" },
  { interaction: "Confirmar", fn: "sfxConfirm", channel: "ui" },
  { interaction: "Voltar / cancelar", fn: "sfxBack", channel: "ui" },
  { interaction: "Transição de tela", fn: "sfxWhoosh", channel: "ui" },
  { interaction: "Contador rolando", fn: "sfxCount", channel: "ui" },
  { interaction: "Sortear (suspense)", fn: "sfxDrumroll", channel: "ui" },
  { interaction: "Roleta girando (tick)", fn: "sfxTick", channel: "ui" },
  { interaction: "Revelação do sorteio", fn: "sfxReveal", channel: "ui" },
  { interaction: "Carimbo / convocado", fn: "sfxStamp", channel: "ui" },
  { interaction: "Apito (início/fim)", fn: "sfxWhistle", channel: "voice" },
  { interaction: "GOL", fn: "sfxGoal", channel: "crowd" },
  { interaction: "Eliminação", fn: "sfxElimination", channel: "crowd+voice" },
  { interaction: "Troféu / campeão", fn: "sfxTrophy", channel: "crowd+voice" },
  { interaction: "Torcida (loop dinâmico)", fn: "startCrowd / setCrowdIntensity", channel: "crowd" },
] as const;
