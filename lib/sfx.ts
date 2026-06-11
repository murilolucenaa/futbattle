"use client";

// ============================================================
// FUTBATTLE — synthesized SFX (WebAudio, no assets, offline).
// PES-menu-inspired blips: short sine/square envelopes.
// All calls are safe no-ops on the server or without user gesture.
// ============================================================

let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, when = 0, glideTo?: number) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.05, when = 0) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(g).connect(c.destination);
  src.start(t0);
}

/** Menu hover/move — the classic PES tick. */
export const sfxMove = () => tone(740, 0.05, "square", 0.04);

/** Menu confirm — two-step rising blip. */
export function sfxConfirm() {
  tone(620, 0.07, "square", 0.05);
  tone(930, 0.10, "square", 0.05, 0.07);
}

/** Cancel/back. */
export const sfxBack = () => tone(360, 0.09, "square", 0.05);

/** Roulette spin tick (call per frame change). */
export const sfxTick = () => tone(1180, 0.03, "triangle", 0.035);

/** Roulette landed — dramatic hit. */
export function sfxReveal() {
  tone(220, 0.4, "sawtooth", 0.05, 0, 110);
  tone(880, 0.25, "triangle", 0.06, 0.05);
  noise(0.3, 0.04, 0.05);
}

/** Goal! Crowd-ish noise + horn. */
export function sfxGoal() {
  noise(1.2, 0.09);
  tone(392, 0.5, "sawtooth", 0.05, 0.05, 523);
  tone(523, 0.7, "sawtooth", 0.04, 0.4, 659);
}

/** Referee whistle (kickoff/halftime/fulltime). */
export function sfxWhistle(double = false) {
  tone(2400, 0.18, "square", 0.04, 0, 2300);
  if (double) {
    tone(2400, 0.14, "square", 0.04, 0.24, 2300);
    tone(2400, 0.32, "square", 0.04, 0.44, 2200);
  }
}
