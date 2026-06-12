// ============================================================
// Crowd ring around the pitch. Home fans behind the home goal
// (left, x=0 in field coords), away fans behind the right goal,
// sides ~50/50. Pure layout + shimmer math — Pixi draws it.
// ============================================================

export interface CrowdDot {
  u: number;                 // 0–1 along the band
  v: number;                 // 0–1 across the band depth
  band: "top" | "bottom" | "left" | "right";
  side: "h" | "a";
  phase: number;             // shimmer phase offset
}

const BAND_SHARE: [CrowdDot["band"], number][] = [
  ["top", 0.3], ["bottom", 0.3], ["left", 0.2], ["right", 0.2],
];

/**
 * `count` is the target for a full stadium; `density` (0–1, attendance/capacity)
 * thins it out. Deterministic for a given rng.
 */
export function layoutCrowd(rng: () => number, count: number, density: number): CrowdDot[] {
  const dots: CrowdDot[] = [];
  for (const [band, share] of BAND_SHARE) {
    const n = Math.round(count * share * Math.max(0.3, Math.min(1, density)));
    for (let i = 0; i < n; i++) {
      const side: "h" | "a" =
        band === "left" ? "h"
        : band === "right" ? "a"
        : rng() < 0.5 ? "h" : "a";
      dots.push({ u: rng(), v: rng(), band, side, phase: rng() * Math.PI * 2 });
    }
  }
  return dots;
}

/** Constant idle shimmer: gentle alpha pulse, always visible. */
export function shimmerAlpha(dot: CrowdDot, tSec: number): number {
  return 0.7 + 0.25 * Math.sin(tSec * 2.1 + dot.phase);
}
