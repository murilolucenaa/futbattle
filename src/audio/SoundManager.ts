"use client";

// ============================================================
// FutBattle — SoundManager (howler.js)
//
// Single audio engine + contract. Channels (ui, music, ambience,
// match) each have an independent volume under a master volume;
// master + per-channel volumes + mute persist in localStorage.
//
// Sounds are declared in manifest.json by an extension-less path and
// loaded as `/audio/<path>.webm`. decodeAudioData sniffs the container
// from the bytes, so a real CC0 .webm or the PCM placeholder both decode;
// dropping a real file swaps a sound with zero code change. A missing
// file fails silently (console.warn, never throws).
//
// Autoplay policy: nothing actually starts until unlock() runs on
// the first user gesture; plays requested before then are queued.
// ============================================================

import { Howl, Howler } from "howler";
import manifestJson from "./manifest.json";

export type Channel = "ui" | "music" | "ambience" | "match";

interface SoundEntry {
  path: string;
  channel: Channel;
  volume: number;
  loop?: boolean;
  duck?: { channel: Channel; to: number; ms?: number };
  desc?: string;
}

const MANIFEST = manifestJson as unknown as {
  channels: Channel[];
  events: Record<string, SoundEntry>;
};

const CHANNELS: Channel[] = ["ui", "music", "ambience", "match"];
const STORAGE_KEY = "futbattle-audio-v2";

interface Settings {
  muted: boolean;
  master: number;
  ui: number;
  music: number;
  ambience: number;
  match: number;
}
const DEFAULTS: Settings = { muted: false, master: 0.9, ui: 1, music: 0.7, ambience: 0.8, match: 1 };

type PlayOpts = { fade?: number; volume?: number };

class SoundManager {
  private settings: Settings = { ...DEFAULTS };
  private howls = new Map<string, Howl>();
  private missing = new Set<string>();
  private loaded = false;

  private unlocked = false;
  private queue: string[] = [];

  private currentMusic: { event: string; howl: Howl; id: number } | null = null;
  private currentAmbience: { event: string; howl: Howl; id: number } | null = null;
  private ambienceIntensity = 1;
  private duckMul: Record<Channel, number> = { ui: 1, music: 1, ambience: 1, match: 1 };
  private duckTimers: Partial<Record<Channel, ReturnType<typeof setTimeout>>> = {};

  // ── settings persistence ────────────────────────────────────
  private load() {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) this.settings = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* corrupt storage — keep defaults */ }
    this.applyMaster();
  }
  private save() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings)); } catch { /* quota/private */ }
  }
  private applyMaster() {
    if (typeof window === "undefined") return;
    Howler.volume(this.settings.master);
    Howler.mute(this.settings.muted);
  }

  /** Effective per-sound volume = base × channel × duck × (ambience intensity). */
  private volFor(entry: SoundEntry): number {
    const ch = entry.channel;
    let v = entry.volume * this.settings[ch] * this.duckMul[ch];
    if (ch === "ambience") v *= this.ambienceIntensity;
    return Math.max(0, Math.min(1, v));
  }

  private refreshChannel(ch: Channel) {
    for (const [event, howl] of this.howls) {
      const entry = MANIFEST.events[event];
      if (entry?.channel === ch) howl.volume(this.volFor(entry));
    }
  }

  // ── howl factory (lazy, silent-fail) ────────────────────────
  private get(event: string): Howl | null {
    this.load();
    if (this.missing.has(event)) return null;
    let howl = this.howls.get(event);
    if (howl) return howl;
    const entry = MANIFEST.events[event];
    if (!entry) {
      console.warn(`[sound] unknown event "${event}"`);
      this.missing.add(event);
      return null;
    }
    howl = new Howl({
      // Single canonical path. Web Audio's decodeAudioData sniffs the
      // container from the bytes, so a real .webm (CC0) or the PCM
      // placeholder both decode here with no 404 fallback noise.
      src: [`/audio/${entry.path}.webm`],
      loop: !!entry.loop,
      volume: this.volFor(entry),
      onloaderror: () => {
        if (!this.missing.has(event)) {
          console.warn(`[sound] missing audio for "${event}" (${entry.path}.webm) — silenced`);
          this.missing.add(event);
        }
      },
    });
    this.howls.set(event, howl);
    return howl;
  }

  // ── autoplay unlock ─────────────────────────────────────────
  /** Call on the first user gesture. Resumes the context, flushes queue. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.load();
    const c = Howler.ctx;
    if (c && c.state === "suspended") void c.resume();
    const pending = this.queue.splice(0);
    for (const ev of pending) this.play(ev);
  }
  isUnlocked() { return this.unlocked; }

  // ── public API ──────────────────────────────────────────────
  /** Fire a one-shot (or start a loop). No-op + warn if file missing. */
  play(event: string, opts: PlayOpts = {}): number | null {
    this.load();
    if (!this.unlocked) {
      // queue the latest gesture-blocked sounds; dedupe rapid repeats
      if (this.queue[this.queue.length - 1] !== event) this.queue.push(event);
      return null;
    }
    const howl = this.get(event);
    if (!howl) return null;
    const entry = MANIFEST.events[event];
    const id = howl.play();
    if (opts.volume != null) howl.volume(Math.max(0, Math.min(1, opts.volume)), id);
    if (opts.fade) howl.fade(0, this.volFor(entry), opts.fade, id);
    if (entry.duck) this.duck(entry.duck.channel, entry.duck.to, entry.duck.ms ?? 1500);
    return id ?? null;
  }

  /** Start a music loop, cross-fading from the current track. */
  music(event: string, opts: { fade?: number } = {}) {
    this.load();
    const fade = opts.fade ?? 600;
    if (this.currentMusic?.event === event) return;
    this.stopMusic(fade);
    if (!this.unlocked) { if (this.queue[this.queue.length - 1] !== event) this.queue.push(event); return; }
    const howl = this.get(event);
    if (!howl) return;
    const entry = MANIFEST.events[event];
    const id = howl.play();
    howl.fade(0, this.volFor(entry), fade, id);
    this.currentMusic = { event, howl, id };
  }
  stopMusic(fade = 600) {
    const cur = this.currentMusic;
    if (!cur) return;
    this.currentMusic = null;
    try {
      cur.howl.fade(cur.howl.volume(cur.id) as number, 0, fade, cur.id);
      setTimeout(() => { try { cur.howl.stop(cur.id); } catch { /* gone */ } }, fade + 30);
    } catch { /* gone */ }
  }

  /** Start the stadium ambience loop (channel: ambience). */
  ambience(event: string, opts: { fade?: number; intensity?: number } = {}) {
    this.load();
    if (opts.intensity != null) this.ambienceIntensity = Math.max(0, Math.min(1, opts.intensity));
    if (this.currentAmbience?.event === event) return;
    this.stopAmbience();
    if (!this.unlocked) { if (this.queue[this.queue.length - 1] !== event) this.queue.push(event); return; }
    const howl = this.get(event);
    if (!howl) return;
    const entry = MANIFEST.events[event];
    const id = howl.play();
    howl.fade(0, this.volFor(entry), opts.fade ?? 800, id);
    this.currentAmbience = { event, howl, id };
  }
  stopAmbience(fade = 500) {
    const cur = this.currentAmbience;
    if (!cur) return;
    this.currentAmbience = null;
    try {
      cur.howl.fade(cur.howl.volume(cur.id) as number, 0, fade, cur.id);
      setTimeout(() => { try { cur.howl.stop(cur.id); } catch { /* gone */ } }, fade + 30);
    } catch { /* gone */ }
  }
  /** Live crowd excitement 0..1 (scales ambience volume). */
  setAmbienceIntensity(x: number) {
    this.ambienceIntensity = Math.max(0, Math.min(1, x));
    this.refreshChannel("ambience");
  }

  /** Temporarily lower a channel (e.g. duck music under a goal sting). */
  duck(channel: Channel, to: number, ms = 1500) {
    this.duckMul[channel] = Math.max(0, Math.min(1, to));
    this.refreshChannel(channel);
    clearTimeout(this.duckTimers[channel]);
    this.duckTimers[channel] = setTimeout(() => {
      this.duckMul[channel] = 1;
      this.refreshChannel(channel);
    }, ms);
  }

  stopAll() {
    this.currentMusic = null;
    this.currentAmbience = null;
    for (const t of Object.values(this.duckTimers)) clearTimeout(t);
    for (const ch of CHANNELS) this.duckMul[ch] = 1;
    Howler.stop();
  }

  // ── settings controls ───────────────────────────────────────
  setMuted(m: boolean) { this.load(); this.settings.muted = m; this.applyMaster(); this.save(); }
  toggleMuted() { this.setMuted(!this.isMuted()); return this.isMuted(); }
  isMuted() { this.load(); return this.settings.muted; }

  setVolume(ch: Channel | "master", v: number) {
    this.load();
    const vol = Math.max(0, Math.min(1, v));
    this.settings[ch] = vol;
    if (ch === "master") this.applyMaster();
    else this.refreshChannel(ch);
    this.save();
  }
  getVolume(ch: Channel | "master") { this.load(); return this.settings[ch]; }

  /** Manifest listing for settings/debug UIs. */
  events() { return MANIFEST.events; }
  channels() { return CHANNELS; }
}

export const sound = new SoundManager();

/** Haptic tap — safe no-op without support. */
export function vibrate(ms = 8) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(ms); } catch { /* blocked by policy */ }
  }
}

// Convenience named exports (legacy-friendly).
export const setMuted = (m: boolean) => sound.setMuted(m);
export const isMuted = () => sound.isMuted();
export const setVolume = (ch: Channel | "master", v: number) => sound.setVolume(ch, v);
export const getVolume = (ch: Channel | "master") => sound.getVolume(ch);
