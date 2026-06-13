// ============================================================
// FUTBATTLE — match presentation layer: shared types
// Field coords follow the engine: x 0–100 (home attacks → 100),
// y 0–100 (left → right touchline). Render-side mirroring only.
// ============================================================

import type { MatchEvent, Position } from "@/lib/game/types";

export interface Vec { x: number; y: number }

export interface AgentState {
  id: string;
  side: "h" | "a";
  pos: Position;
  isGk: boolean;
  name: string;
  color: string;
  x: number; y: number;
  vx: number; vy: number;
  anchorX: number; anchorY: number;
  maxSpeed: number; // field units / second
  chasing: boolean;
  noiseSeed: number;
  celebrating: boolean;
}

export interface BallState { x: number; y: number; h: number } // h = pseudo-height 0–1

export type BeatKind =
  | "kickoff" | "pass" | "carry" | "shot" | "celebration"
  | "stoppage" | "reset" | "goalkick" | "bounce";

export interface Beat {
  kind: BeatKind;
  durMs: number;
  from: Vec;
  to: Vec;
  curve: number;            // perpendicular bezier control offset (0 = straight)
  arc: number;              // max pseudo-height during flight (0 = ground)
  outcome?: "goal" | "save" | "miss" | "post";
  scorerId?: string;
  owner?: "h" | "a";        // which side controls the ball this beat (carrier lock)
  pauseAfterMs?: number;    // reception micro-pause
}

export interface AudioPort {
  play(event: string): void;
  setAmbienceIntensity(x: number): void;
}

export const NULL_AUDIO: AudioPort = {
  play: () => {},
  setAmbienceIntensity: () => {},
};

export interface DirectorView {
  minute: number;
  scoreH: number;
  scoreA: number;
  possH: number;
  eventCount: number;
}

export interface DirectorSnapshot {
  agents: AgentState[];
  ball: BallState;
  carrierId: string | null;
  mirrored: boolean; // second half: render flipped
  celebration: { scorerId: string; side: "h" | "a"; t: number } | null;
  crowdBurst: { side: "h" | "a"; t: number } | null; // t decays 1 → 0
}

export type DirectorEventsHandler = (evs: MatchEvent[]) => void;
