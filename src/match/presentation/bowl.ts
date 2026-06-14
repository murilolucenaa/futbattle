// ============================================================
// Stadium bowl geometry. Pure math — no Pixi. The pitch is an
// axis-aligned rectangle (the engine's playing field); the stands
// wrap it as a *ring* between that rectangle and an outer silhouette.
//
// The outer silhouette is a superellipse |x/rx|^n + |y/ry|^n = 1
// whose exponent `n` morphs the shape:
//   rect (boxy, soft corners)  →  rectNfl  →  oval  →  circular (pure ellipse).
// Horseshoe is an oval with one end (the away goal) collapsed to the
// pitch edge, leaving the Marathon-gate opening. Dome is a full oval
// (its roof is drawn separately).
//
// Both the seat-tinted fill and the ~1400 crowd dots use the same
// `innerRadius`/`outerRadius` so they always agree at the edges.
// ============================================================

import type { StandShape } from "@/lib/data/stadiums";

export interface Rect { x: number; y: number; w: number; h: number; }
export type Band = "top" | "bottom" | "left" | "right";
export interface Pt { x: number; y: number; }

export interface BowlSpec {
  cx: number; cy: number;   // pitch centre
  hw: number; hh: number;   // pitch half-extents (inner rect)
  rx: number; ry: number;   // outer silhouette radii (to the band edge)
  n: number;                // superellipse exponent
  shape: StandShape;
}

const TWO_PI = Math.PI * 2;

/** Superellipse exponent per silhouette. Higher = boxier. */
function shapeExponent(shape: StandShape): number {
  switch (shape) {
    case "rect": return 5;       // gently rounded corners, still rectangular
    case "rectNfl": return 3.4;  // NFL-style rounded bowl
    case "oval": return 2.5;
    case "horseshoe": return 2.5;
    case "dome": return 2.15;
    case "circular": return 2;   // pure ellipse — the roundest
    default: return 2.5;
  }
}

export function bowlSpec(pitch: Rect, bandX: number, bandY: number, shape: StandShape): BowlSpec {
  return {
    cx: pitch.x + pitch.w / 2,
    cy: pitch.y + pitch.h / 2,
    hw: pitch.w / 2,
    hh: pitch.h / 2,
    rx: pitch.w / 2 + bandX,
    ry: pitch.h / 2 + bandY,
    n: shapeExponent(shape),
    shape,
  };
}

/** Normalise to (-PI, PI]. */
function normPI(t: number): number {
  let a = t % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  if (a <= -Math.PI) a += TWO_PI;
  return a;
}

/** Radius from centre to the inner (pitch rectangle) edge along `theta`. */
export function innerRadius(s: BowlSpec, theta: number): number {
  const c = Math.abs(Math.cos(theta));
  const sn = Math.abs(Math.sin(theta));
  const rxHit = c > 1e-6 ? s.hw / c : Infinity;
  const ryHit = sn > 1e-6 ? s.hh / sn : Infinity;
  return Math.min(rxHit, ryHit);
}

/**
 * Radius to the outer silhouette along `theta`. Horseshoe collapses the
 * ring toward the pitch around the away goal (theta ≈ 0) so that end reads
 * open. Never returns less than the inner radius.
 */
export function outerRadius(s: BowlSpec, theta: number): number {
  const c = Math.abs(Math.cos(theta));
  const sn = Math.abs(Math.sin(theta));
  const supr = Math.pow(
    Math.pow(c / s.rx, s.n) + Math.pow(sn / s.ry, s.n),
    -1 / s.n,
  );
  let ro = supr;
  if (s.shape === "horseshoe") {
    const d = Math.abs(normPI(theta));   // distance from the open (away) end
    const win = 0.72;
    if (d < win) {
      const k = d / win;
      const smooth = k * k * (3 - 2 * k);  // 0 at the gate → 1 at its edge
      const ri = innerRadius(s, theta);
      ro = ri + (ro - ri) * smooth;
    }
  }
  return Math.max(ro, innerRadius(s, theta));
}

/** Point on the ring at `theta`, `depth` 0 (pitch edge) → 1 (outer edge). */
export function ringPoint(s: BowlSpec, theta: number, depth: number): Pt {
  const ri = innerRadius(s, theta);
  const ro = outerRadius(s, theta);
  const r = ri + (ro - ri) * depth;
  return { x: s.cx + r * Math.cos(theta), y: s.cy + r * Math.sin(theta) };
}

/**
 * Map a crowd band + position-along (`u` 0→1) to an angle, sweeping the arc
 * that faces that band. `left` faces the home goal, `right` the away goal.
 */
export function bandTheta(s: BowlSpec, band: Band, u: number): number {
  const aTR = Math.atan2(-s.hh, s.hw);   // (-90°, 0)
  const aBR = Math.atan2(s.hh, s.hw);    // (0, 90°)
  const aBL = Math.atan2(s.hh, -s.hw);   // (90°, 180°)
  const aTL = Math.atan2(-s.hh, -s.hw);  // (-180°, -90°)
  switch (band) {
    case "top": return aTL + (aTR - aTL) * u;            // through straight up
    case "right": return aTR + (aBR - aTR) * u;          // through the away goal
    case "bottom": return aBR + (aBL - aBR) * u;         // through straight down
    case "left": return aBL + ((aTL + TWO_PI) - aBL) * u; // through the home goal
  }
}

/** Closed polygon (flat [x,y,...]) of the outer silhouette. */
export function outerSilhouette(s: BowlSpec, steps = 96): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TWO_PI;
    const p = ringPoint(s, t, 1);
    out.push(p.x, p.y);
  }
  return out;
}

/** Closed polygon (flat [x,y,...]) of an inner tier at ring `depth`. */
export function tierSilhouette(s: BowlSpec, depth: number, steps = 96): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TWO_PI;
    const p = ringPoint(s, t, depth);
    out.push(p.x, p.y);
  }
  return out;
}
