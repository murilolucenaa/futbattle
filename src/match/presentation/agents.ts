// ============================================================
// Steering agents for the match presentation. Pure TS — no Pixi.
// Fixed-timestep physics (PHYS_DT) so trajectories are deterministic
// regardless of display refresh rate.
// ============================================================

import type { FormationSlot, Position } from "@/lib/game/types";
import { POSITION_SECTOR } from "@/lib/game/types";
import type { AgentState, Vec } from "./types";

export const PHYS_DT = 1 / 60; // seconds

const SPEED_BY_SECTOR: Record<string, number> = { GK: 14, DEF: 20, MID: 23, ATT: 26 };
const ACCEL = 60;             // field units / s²
const ARRIVE_RADIUS = 6;      // ease into the target inside this radius
const SEP_RADIUS = 3.0;       // personal space
const SEP_FORCE = 26;
const CHASERS_PER_SIDE = 2;

export function maxSpeedFor(pos: Position): number {
  return SPEED_BY_SECTOR[POSITION_SECTOR[pos]];
}

export function makeAgent(
  id: string, name: string, side: "h" | "a", slot: FormationSlot,
  color: string, isGk: boolean, noiseSeed: number
): AgentState {
  const anchor = anchorFor(slot, side, 50, 50);
  return {
    id, side, pos: slot.pos, isGk, name, color,
    x: anchor.x, y: anchor.y, vx: 0, vy: 0,
    anchorX: anchor.x, anchorY: anchor.y,
    maxSpeed: maxSpeedFor(slot.pos),
    chasing: false, noiseSeed, celebrating: false,
  };
}

/**
 * Tactical anchor: same depth curve as the old DOM view (3 + slot.x * 0.44)
 * plus a team-wide push/retreat from the ball zone, plus a small lane shift
 * toward the ball's y. Away side mirrored.
 */
export function anchorFor(slot: FormationSlot, side: "h" | "a", ballX: number, ballY: number): Vec {
  const shift = (ballX - 50) / 50; // -1..1, + = deep in away half
  const push = side === "h" ? Math.max(0, shift) * 14 : Math.max(0, -shift) * 14;
  const retreat = side === "h" ? Math.max(0, -shift) * 7 : Math.max(0, shift) * 7;
  const depth = 3 + slot.x * 0.44 + push - retreat;
  const laneY = slot.y + (ballY - 50) * 0.1;
  const x = side === "h" ? depth : 100 - depth;
  const y = side === "h" ? laneY : 100 - laneY;
  return { x: clamp(x, 1, 99), y: clamp(y, 2, 98) };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Cheap deterministic value noise (no RNG draws — keyed by seed + time). */
function noise(seed: number, t: number): Vec {
  return {
    x: Math.sin(t * 0.7 + seed * 13.7) * 1.4 + Math.sin(t * 1.9 + seed * 5.1) * 0.6,
    y: Math.cos(t * 0.6 + seed * 9.3) * 1.4 + Math.cos(t * 2.1 + seed * 3.7) * 0.6,
  };
}

/**
 * One fixed-timestep update. The 1–2 closest non-GK agents per side chase
 * the ball; everyone else orbits its anchor with idle noise. Celebrating
 * agents converge on the scorer (caller sets `celebrating` + chase target
 * via ball position = scorer position during the celebration beat).
 */
export function stepAgents(
  agents: AgentState[], ball: Vec, carrierId: string | null, tSec: number,
  suppressChase = false,
): void {
  // pick chasers: closest field players per side. Suppressed during a goal
  // celebration so opponents don't get sucked into the scorer's huddle.
  const bySide: Record<"h" | "a", AgentState[]> = { h: [], a: [] };
  for (const a of agents) {
    a.chasing = false;
    if (!a.isGk && !a.celebrating) bySide[a.side].push(a);
  }
  if (!suppressChase) {
    for (const side of ["h", "a"] as const) {
      bySide[side]
        .sort((p, q) => dist2(p, ball) - dist2(q, ball))
        .slice(0, CHASERS_PER_SIDE)
        .forEach((a) => { a.chasing = true; });
    }
  }
  if (carrierId) {
    const c = agents.find((a) => a.id === carrierId);
    if (c) c.chasing = true;
  }

  for (const a of agents) {
    let tx: number, ty: number;
    if (a.celebrating || a.chasing) {
      tx = ball.x; ty = ball.y;
    } else {
      const n = noise(a.noiseSeed, tSec);
      tx = a.anchorX + n.x;
      ty = a.anchorY + n.y;
    }

    // seek with arrival easing
    let dx = tx - a.x, dy = ty - a.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const desired = a.maxSpeed * Math.min(1, d / ARRIVE_RADIUS);
    let dvx = (dx / d) * desired - a.vx;
    let dvy = (dy / d) * desired - a.vy;
    const dvLen = Math.hypot(dvx, dvy) || 1e-6;
    const maxDv = ACCEL * PHYS_DT;
    if (dvLen > maxDv) { dvx = (dvx / dvLen) * maxDv; dvy = (dvy / dvLen) * maxDv; }
    a.vx += dvx; a.vy += dvy;

    // separation
    for (const b of agents) {
      if (b === a) continue;
      const sx = a.x - b.x, sy = a.y - b.y;
      const sd = Math.hypot(sx, sy);
      if (sd > 0 && sd < SEP_RADIUS) {
        const f = SEP_FORCE * (1 - sd / SEP_RADIUS) * PHYS_DT;
        a.vx += (sx / sd) * f;
        a.vy += (sy / sd) * f;
      } else if (sd === 0) {
        // perfectly stacked: deterministic nudge by id-derived angle
        const ang = (hash(a.id) % 360) * (Math.PI / 180);
        a.vx += Math.cos(ang) * SEP_FORCE * PHYS_DT;
        a.vy += Math.sin(ang) * SEP_FORCE * PHYS_DT;
      }
    }

    // clamp speed
    const v = Math.hypot(a.vx, a.vy);
    if (v > a.maxSpeed) { a.vx = (a.vx / v) * a.maxSpeed; a.vy = (a.vy / v) * a.maxSpeed; }

    a.x += a.vx * PHYS_DT;
    a.y += a.vy * PHYS_DT;

    // keepers hold their line
    if (a.isGk) {
      a.x = a.side === "h" ? clamp(a.x, 1, 10) : clamp(a.x, 90, 99);
      a.y = clamp(a.y, 28, 72);
    } else {
      a.x = clamp(a.x, 0.5, 99.5);
      a.y = clamp(a.y, 0.5, 99.5);
    }
  }
}

function dist2(a: { x: number; y: number }, b: Vec): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
