// ============================================================
// Procedural ball motion: quadratic-bezier flights with a pseudo
// height for lobs. Pure TS — the director schedules Beats, the
// stage samples them. Deterministic given a seeded rng.
// ============================================================

import type { BallState, Beat, Vec } from "./types";

const PASS_SPEED_MIN = 45;  // field units / s
const PASS_SPEED_MAX = 65;
const CARRY_SPEED = 20;
const SHOT_SPEED = 110;

function dist(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Sample a beat at progress t01 ∈ [0,1] (already eased by the caller clock). */
export function sampleBeat(beat: Beat, t01: number): BallState {
  const t = beat.kind === "pass" || beat.kind === "shot"
    ? 1 - (1 - t01) * (1 - t01) // easeOutQuad: zips off the foot, eases in
    : t01;
  const { from, to } = beat;
  // control point: midpoint shifted perpendicular by `curve`
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  const cx = mx + (-dy / len) * beat.curve;
  const cy = my + (dx / len) * beat.curve;
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
    y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
    h: beat.arc * 4 * t * (1 - t),
  };
}

/** Ground/lobbed pass with light curve and a reception micro-pause. */
export function passBeat(from: Vec, to: Vec, rng: () => number): Beat {
  const d = dist(from, to);
  const speed = PASS_SPEED_MIN + rng() * (PASS_SPEED_MAX - PASS_SPEED_MIN);
  return {
    kind: "pass",
    durMs: Math.max(160, (d / speed) * 1000),
    from, to,
    curve: (rng() * 2 - 1) * 6,
    arc: d > 22 ? rng() * 0.5 : 0, // long balls may lob
    pauseAfterMs: 80 + Math.floor(rng() * 80),
  };
}

/** Dribbled carry — slow, straight, on the ground. */
export function carryBeat(from: Vec, to: Vec): Beat {
  return {
    kind: "carry",
    durMs: Math.max(200, (dist(from, to) / CARRY_SPEED) * 1000),
    from, to, curve: 0, arc: 0,
  };
}

/** Strike toward goal. Fast, slight curve, low arc. */
export function shotBeat(from: Vec, to: Vec, outcome: NonNullable<Beat["outcome"]>): Beat {
  return {
    kind: "shot",
    durMs: Math.max(120, (dist(from, to) / SHOT_SPEED) * 1000),
    from, to,
    curve: 1.5,
    arc: 0.15,
    outcome,
  };
}
