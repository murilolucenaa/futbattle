// Renders a faithful preview of the morphed stadium bowl by reusing the SAME
// pure geometry the game uses (src/match/presentation/bowl.ts) and the real
// stadium profiles (lib/data/stadiums.ts). Output: PNG per stadium.
//
//   npm i --no-save sharp && npx tsx scripts/preview-stadium.mts
//
// This is a dev/QA tool — it is NOT shipped or imported by the app, and
// `sharp` is only needed here (install it on demand, as above).

import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { stadiumProfile } from "../lib/data/stadiums.ts";
import {
  bowlSpec, ringPoint, bandTheta, outerSilhouette, tierSilhouette,
  innerRadius, outerRadius, type BowlSpec,
} from "../src/match/presentation/bowl.ts";
import { layoutCrowd } from "../src/match/presentation/crowd.ts";

// A tiny deterministic RNG (same shape as engine's mulberry32) for the crowd.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 900, H = 560;
const bandY = Math.max(14, H * 0.085);
const bandX = Math.max(12, W * 0.045);
const pitch = { x: bandX, y: bandY, w: W - bandX * 2, h: H - bandY * 2 };

const ERA_STAND = "#101a30";
const GRASS = "#12793f", GRASS_DARK = "#0a4e28";

function poly(pts: number[], fill: string, opacity = 1): string {
  const d = pts.reduce((a, v, i) => a + (i % 2 ? `,${v.toFixed(1)} ` : ` ${v.toFixed(1)}`), "");
  return `<polygon points="${d.trim()}" fill="${fill}" fill-opacity="${opacity}" />`;
}

function ringPoly(bowl: BowlSpec, innerDepth: number, outerDepth: number, steps = 96): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = ringPoint(bowl, (i / steps) * Math.PI * 2, outerDepth); pts.push(p.x, p.y);
  }
  for (let i = steps; i >= 0; i--) {
    const p = ringPoint(bowl, (i / steps) * Math.PI * 2, innerDepth); pts.push(p.x, p.y);
  }
  return pts;
}

function renderSvg(name: string, year: number, homeHex: string, awayHex: string): string {
  const st = stadiumProfile(name, year)!;
  const bowl = bowlSpec(pitch, bandX, bandY, st.shape);
  const seat0 = st.seats[0], seat1 = st.seats[1] ?? st.seats[0];
  const trackTone = /fosso|moat/i.test(st.note) ? "#6f6f6f" : "#a8562f";

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${ERA_STAND}" />`);

  // stands: upper bowl + lower tier
  parts.push(poly(outerSilhouette(bowl), seat0, 0.5));
  parts.push(poly(tierSilhouette(bowl, 0.42), seat1, 0.45));

  // fosso / track ring (drawn below the pitch in-game; here we just clip via z-order)
  if (st.track) {
    const tw = Math.min(bandX, bandY) * 0.5;
    const ring: number[] = [];
    const steps = 120;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const ri = innerRadius(bowl, t);
      const ro = Math.min(ri + tw, outerRadius(bowl, t));
      ring.push(bowl.cx + ro * Math.cos(t), bowl.cy + ro * Math.sin(t));
    }
    parts.push(poly(ring, trackTone, 0.65));
  }

  // pitch (masks the bowl centre)
  parts.push(`<rect x="${pitch.x}" y="${pitch.y}" width="${pitch.w}" height="${pitch.h}" fill="${GRASS}" />`);
  const stripes = 12;
  for (let i = 0; i < stripes; i += 2) {
    parts.push(`<rect x="${pitch.x + (pitch.w / stripes) * i}" y="${pitch.y}" width="${pitch.w / stripes}" height="${pitch.h}" fill="${GRASS_DARK}" fill-opacity="0.35" />`);
  }
  const px = (x: number) => pitch.x + (x / 100) * pitch.w;
  const py = (y: number) => pitch.y + (y / 100) * pitch.h;
  const line = `fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="2"`;
  parts.push(`<rect x="${px(1)}" y="${py(1)}" width="${px(99) - px(1)}" height="${py(99) - py(1)}" ${line} />`);
  parts.push(`<line x1="${px(50)}" y1="${py(1)}" x2="${px(50)}" y2="${py(99)}" ${line} />`);
  parts.push(`<circle cx="${px(50)}" cy="${py(50)}" r="${(10 / 100) * pitch.h}" ${line} />`);

  // crowd dots, placed exactly like MatchStage.placeCrowd
  const dots = layoutCrowd(mulberry32(20260614), 1400, 0.95);
  for (const dot of dots) {
    const theta = bandTheta(bowl, dot.band, dot.u);
    const depth = 0.14 + dot.v * 0.78;
    const p = ringPoint(bowl, theta, depth);
    const tint = dot.side === "h" ? homeHex : awayHex;
    parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="${tint}" fill-opacity="0.85" />`);
  }

  // roof shadow
  const roofAlpha = st.roof === "full" ? 0.5 : st.roof === "tent" ? 0.22 : st.roof === "partial" ? 0.32 : 0;
  if (roofAlpha > 0) {
    if (st.roof === "partial") {
      for (const band of ["top", "bottom"] as const) {
        const seg: number[] = [];
        const steps = 40;
        for (let i = 0; i <= steps; i++) { const p = ringPoint(bowl, bandTheta(bowl, band, i / steps), 1); seg.push(p.x, p.y); }
        for (let i = steps; i >= 0; i--) { const p = ringPoint(bowl, bandTheta(bowl, band, i / steps), 0.42); seg.push(p.x, p.y); }
        parts.push(poly(seg, "#0a0e16", roofAlpha));
      }
    } else {
      parts.push(poly(ringPoly(bowl, 0.32, 1), "#0a0e16", roofAlpha));
    }
  }

  // caption
  const cap = `${st.name} · ${st.city} ${st.year} — shape: ${st.shape}, roof: ${st.roof}, track: ${st.track}`;
  parts.push(`<rect x="0" y="${H - 26}" width="${W}" height="26" fill="#000000" fill-opacity="0.55" />`);
  parts.push(`<text x="12" y="${H - 8}" fill="#ffffff" font-family="monospace" font-size="13">${cap}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

const targets: [string, number, string, string][] = [
  ["Maracanã", 1950, "#f2c500", "#2a5bd7"],   // fosso/moat, oval
  ["Sapporo Dome", 2002, "#c23a2b", "#f1f0e9"], // domed/coberto
];

for (const [name, year, home, away] of targets) {
  const svg = renderSvg(name, year, home, away);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const out = `/tmp/stadium-${slug}-${year}.png`;
  await sharp(Buffer.from(svg)).png().toFile(out);
  writeFileSync(`/tmp/stadium-${slug}-${year}.svg`, svg);
  console.log("wrote", out);
}
