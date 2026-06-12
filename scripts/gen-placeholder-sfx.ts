/**
 * Placeholder SFX generator. Synthesizes a short tone/noise for every entry
 * in src/audio/manifest.json and writes it to public/audio/<path>.webm so the
 * whole sound pipeline works end-to-end before real CC0 files arrive.
 *
 * Run:  npm run gen:sfx
 *
 * NOTE: real sounds should be dropped as <path>.webm — they overwrite these
 * placeholders with zero code change. Web Audio API is browser-only, so we
 * synthesize raw PCM in Node and write minimal 16-bit WAV bytes into the .webm
 * file; decodeAudioData sniffs the container from the bytes (not the
 * extension), so the placeholders decode fine and avoid any 404 fallback.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const RATE = 44100;
const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "audio");

type Entry = { path: string; channel: string; volume: number; loop?: boolean };
const manifest = JSON.parse(
  readFileSync(join(ROOT, "src", "audio", "manifest.json"), "utf8"),
) as { events: Record<string, Entry> };

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Build a mono Float32 buffer for one event, shaped by its name/category. */
function synth(event: string, entry: Entry): Float32Array {
  const h = hash(event);
  // Looping placeholders (music/ambience) play forever, so keep them in a calm
  // low register at low gain — a piercing high sine looped at full volume is an
  // ear-splitting drone. One-shots can stay bright.
  const base = entry.loop ? 90 + (h % 70) : 200 + (h % 700); // loop 90–160 Hz · one-shot 200–900 Hz
  let dur = 0.09;
  if (event.startsWith("whistle")) dur = 0.35;
  else if (event === "goal.horn") dur = 1.4;
  else if (event.startsWith("card.reveal.leg")) dur = 1.8;
  else if (event.startsWith("card.reveal")) dur = 0.45;
  else if (event === "dado.roll") dur = 0.8;
  else if (entry.channel === "ambience") dur = 1.6;
  else if (entry.channel === "music") dur = 2.0;
  else if (event.startsWith("crowd")) dur = 1.0;
  else if (event.startsWith("ui")) dur = 0.07;

  const n = Math.floor(RATE * dur);
  const out = new Float32Array(n);
  const noisy = entry.channel === "ambience" || event.startsWith("crowd") || event === "goal.horn";
  const sweep = event.startsWith("card.reveal") || event === "dado.roll";

  // One-shots are bright (0.35); loops stay gentle background pads (0.06) so an
  // autoplaying menu/crowd placeholder never deafens anyone.
  const gain = entry.loop ? 0.06 : 0.35;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const p = i / n;
    // amplitude envelope: quick attack, exp-ish decay; loops get a slow tremolo
    // (so they breathe instead of sitting as a flat tone) and seamless edges.
    const env = entry.loop
      ? Math.min(1, p * 8) * Math.min(1, (1 - p) * 8) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.7 * t))
      : Math.pow(1 - p, 2);
    const freq = sweep ? base * (1 + p * 1.5) : base;
    let s = Math.sin(2 * Math.PI * freq * t);
    s += 0.4 * Math.sin(2 * Math.PI * freq * 2 * t); // a harmonic for body
    if (noisy) s = 0.5 * s + 0.6 * (Math.random() * 2 - 1);
    out[i] = s * env * gain;
  }
  return out;
}

/** Encode mono Float32 (-1..1) as a 16-bit PCM WAV buffer. */
function toWav(samples: Float32Array): Buffer {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);       // PCM chunk size
  buf.writeUInt16LE(1, 20);        // format = PCM
  buf.writeUInt16LE(1, 22);        // channels = mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);        // block align
  buf.writeUInt16LE(16, 34);       // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

let count = 0;
for (const [event, entry] of Object.entries(manifest.events)) {
  const file = join(OUT_DIR, `${entry.path}.webm`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, toWav(synth(event, entry)));
  count++;
}
console.log(`✓ wrote ${count} placeholder sound(s) to public/audio/`);
