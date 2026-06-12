# Match Presentation 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static DOM match view with a deterministic PixiJS spectacle layer (steering agents, procedural ball, living crowd, tactics overlay) that dramatizes the existing engine timeline without changing results.

**Architecture:** A `director` is the only module that knows the engine: it calls `tick()` lazily, converts each engine minute into ball "beats" (bezier pass flights, shot tweens, celebrations) and steps agents/crowd at a fixed 60Hz timestep (accumulator) so the choreography is deterministic regardless of display refresh. `MatchStage.tsx` mounts a Pixi Application, calls `director.update(dt)` from rAF and draws the snapshot. DOM remains HUD-only.

**Tech Stack:** PixiJS v8, existing engine (`lib/game/engine.ts`, untouched), howler via `src/audio/SoundManager` behind an injected `AudioPort` (no-op in tests), Jest.

Spec: `docs/superpowers/specs/2026-06-12-match-presentation-design.md`

---

## Shared interfaces (locked here, used by all tasks)

```ts
// src/match/presentation/types.ts
import type { Position } from "@/lib/game/types";

export interface Vec { x: number; y: number }            // engine field coords 0–100

export interface AgentState {
  id: string; side: "h" | "a"; pos: Position; isGk: boolean;
  name: string; color: string;
  x: number; y: number; vx: number; vy: number;
  anchorX: number; anchorY: number;
  maxSpeed: number;          // field units / second
  chasing: boolean;
  noiseSeed: number;
  celebrating: boolean;      // converge on scorer during celebration
}

export interface BallState { x: number; y: number; h: number } // h = pseudo-height 0–1

export type BeatKind =
  | "kickoff" | "pass" | "carry" | "shot" | "celebration"
  | "stoppage" | "reset" | "goalkick" | "bounce";

export interface Beat {
  kind: BeatKind;
  durMs: number;
  from: Vec; to: Vec;
  curve: number;             // perpendicular bezier control offset (0 = straight)
  arc: number;               // max pseudo-height during flight (0 = ground)
  outcome?: "goal" | "save" | "miss" | "post";
  scorerId?: string;         // celebration beats
  pauseAfterMs?: number;     // reception micro-pause
}

export interface AudioPort {
  play(event: string): void;
  setAmbienceIntensity(x: number): void;
}

export interface DirectorView {
  minute: number; scoreH: number; scoreA: number;
  possH: number; eventCount: number;
}

export interface DirectorSnapshot {
  agents: AgentState[];
  ball: BallState;
  carrierId: string | null;
  mirrored: boolean;          // second half render mirror
  celebration: { scorerId: string; side: "h" | "a"; t: number } | null;
  crowdBurst: { side: "h" | "a"; t: number } | null; // t 1→0 decay
}
```

### Task 1: Install PixiJS

- [x] `npm install pixi.js` (v8.x)
- [x] `npx tsc --noEmit` still clean
- [x] Commit `chore: add pixi.js for match presentation`

### Task 2: `gkColors.ts` (TDD)

**Files:** Create `src/match/presentation/gkColors.ts`, `src/match/presentation/__tests__/gkColors.test.ts`

- [x] Test: for kits (BRA `#FFDC00` + ARG `#75AADB`), both returned colors have Manhattan RGB distance ≥ 150 from each team primary AND ≥ 150 from each other; result deterministic.
- [x] Implement: fixed palette `["#FFD400","#00E5FF","#FF3DA6","#FF7A00","#B6FF00","#9D4DFF","#FFFFFF","#111111"]`; pick GK1 maximizing min-dist to `[homePrimary, awayPrimary, homeSecondary, awaySecondary]`; pick GK2 the same but also vs GK1. Export `colorDist` (Manhattan RGB).
- [x] `npm test -- gkColors` → PASS. Commit.

### Task 3: `agents.ts` steering (TDD)

**Files:** Create `src/match/presentation/agents.ts`, test in `__tests__/agents.test.ts`

API:
```ts
export const PHYS_DT = 1 / 60; // fixed timestep, seconds
export function maxSpeedFor(pos: Position): number;        // GK 14, DEF 20, MID 23, ATT 26
export function makeAgent(card, side, slot, color, isGk, noiseSeed): AgentState;
export function anchorFor(slot: FormationSlot, side: "h"|"a", ballX: number, ballY: number): Vec;
  // depth = 3 + slot.x * 0.44 + push(ball) − retreat(ball)  (mirrors current LivePitch math)
  // y nudged 10% toward ball lane; away side mirrored (100 − depth, 100 − y)
export function stepAgents(agents: AgentState[], ball: Vec, carrierId: string | null,
                           tSec: number): void;
  // top-2 closest non-GK per side chase ball; others seek anchor + value-noise offset
  // (sin-based, keyed by noiseSeed and tSec — no RNG draws);
  // accel-limited seek with arrival easing; pairwise separation radius 3.0 units;
  // speed clamped to maxSpeed; GK clamped to x ∈ [0,10] (or mirrored).
```

- [x] Tests: (a) two agents placed at same point separate after 60 steps; (b) speed never exceeds `maxSpeed * 1.05`; (c) identical inputs ⇒ identical positions across two runs (determinism); (d) GK stays within its box depth.
- [x] Implement minimal; run; commit.

### Task 4: `ball.ts` flights (TDD)

**Files:** Create `src/match/presentation/ball.ts`, test in `__tests__/ball.test.ts`

API:
```ts
export function sampleBeat(beat: Beat, t01: number): BallState;
  // quadratic bezier from→to with control = midpoint + perpendicular * curve;
  // h = arc * 4 * t * (1−t); ease: pass/shot use easeOutQuad on t.
export function passBeat(from: Vec, to: Vec, rng: () => number): Beat;   // speed 45–65 u/s → durMs, curve ±6, arc 0–0.5, pauseAfterMs 80–160
export function carryBeat(from: Vec, to: Vec): Beat;                     // 20 u/s, straight, ground
export function shotBeat(from: Vec, to: Vec, outcome): Beat;             // 110 u/s, slight curve, low arc
```

- [x] Tests: endpoints exact at t=0/1; max displacement between consecutive t samples (1/60 steps) bounded (continuity); determinism with seeded rng.
- [x] Implement; run; commit.

### Task 5: `crowd.ts` (TDD)

**Files:** Create `src/match/presentation/crowd.ts`, test in `__tests__/crowd.test.ts`

API:
```ts
export interface CrowdDot { u: number; v: number; band: "top"|"bottom"|"left"|"right"; side: "h"|"a"; phase: number }
export function layoutCrowd(rng: () => number, count: number, density: number): CrowdDot[];
  // left band (behind home goal, x=0) → all side "h"; right band → all "a";
  // top/bottom alternate h/a ~50/50; u,v normalized within band; count*density dots.
export function shimmerAlpha(dot: CrowdDot, tSec: number): number; // 0.45–0.95 sin pulse
```

- [x] Tests: left band 100% "h", right 100% "a", top+bottom within 40–60% "h"; deterministic layout for same rng seed.
- [x] Implement; run; commit.

### Task 6: `director.ts` (TDD — the core)

**Files:** Create `src/match/presentation/director.ts`, test in `__tests__/director.test.ts`

API:
```ts
export interface DirectorOpts {
  userSide: "h" | "a";
  presSeed: number;                       // fixtureSeed ^ 0x9d2c5680 (page derives)
  audio: AudioPort;
  baseMinuteMs?: number;                  // default 650
  onView(v: DirectorView): void;
  onEvents(evs: MatchEvent[]): void;
  onFinished(): void;
}
export function createDirector(state: LiveMatchState, opts: DirectorOpts): Director;

export interface Director {
  update(elapsedMs: number, speed: number): void; // accumulator → fixed PHYS_DT steps
  snapshot(): DirectorSnapshot;
  destroy(): void;
  syncLineups(): void;   // call after user sub/tactic in overlay: rebuild agent set
}
```

Behavior per fixed step:
1. Beat queue empty → `tick(state)`; `aiMaybeAct(state, aiSide)`; infer possession holder via `possMinH` delta; build beats:
   - no event → 2–4 `passBeat`s among points near engine `ballX/ballY` (within holder's attacking sector, jitter from PRNG);
   - `miss` → buildup (1 pass + carry to box edge) + `shot(outcome:"miss")` wide of goal mouth (y < 36 or > 64 at x≈100) + `goalkick` beat back to defender GK; audio `crowd.ooh`;
   - `post` → buildup + shot to post (y 38/62) + `bounce` to (88, ±10 jitter); `crowd.ooh`;
   - `save` → buildup + shot at goal mouth (y 42–58) + GK dive (flag carrier=GK, GK target = shot end) + `goalkick`; `crowd.ooh`;
   - `goal` → buildup + shot into net (x 101 clamped render-side, y 44–56) + `celebration` 3000ms (scorerId, teammates `celebrating=true`, crowdBurst side, audio `goal.horn`) + `reset` to center;
   - `card`/`sub`/`tactic`/`cooling` → `stoppage` beats (700/1200/300/1800ms); sub: rebuild agents, newcomer spawns at touchline (50, 2);
   - `halftime` → whistle.half + `reset`; mirrored flips when `minute > 45`;
   - `fulltime` → whistle.end + onFinished.
   Beat durations scaled so a no-event minute ≈ `baseMinuteMs`.
2. Sample current beat → ball pos; advance beat clock by `PHYS_DT * 1000 * speed`… **no**: speed multiplies elapsed before the accumulator, physics dt constant. Beats consume scaled time.
3. `stepAgents` with celebration override (celebrating agents target scorer).
4. Ambience: every 30 steps `audio.setAmbienceIntensity(0.35 + 0.5 * danger)` where danger = max(0, (|ballX−50| − 25) / 25).

- [x] Tests (stub AudioPort, real squads via `SQUAD_BY_ID["bra-1970"]` etc. + `assignLineup`):
  - determinism: two directors, same seed, stepped identically for 120s of sim ⇒ identical position/event hash;
  - pacing: after `update` totalling ~`650 * 95`ms at speed 1, `state.finished === true`;
  - continuity: ball displacement per step ≤ 4.0 field units;
  - speed: at speed 2 the same sim time finishes in half the wall ms.
- [x] Implement; run (`npm test -- director`); commit.

### Task 7: `MatchStage.tsx` (Pixi renderer)

**Files:** Create `src/match/presentation/MatchStage.tsx`

- [x] Pixi `Application` init async in useEffect (guard double-mount/unmount); `resolution: devicePixelRatio`, `autoDensity`, resize via ResizeObserver.
- [x] Layers: pitch Graphics (era-tinted greens + stripes + lines), crowd Container (~600 sprites from generated circle texture, shimmer each frame, burst = jump + white flash on scoring side), agent containers (circle + carrier ring + Text label hidden unless carrier/hover), ball sprite (scale by `h`, shadow).
- [x] rAF: `if (!paused) director.update(elapsed, speed)`; draw `snapshot()`; mirror x when `snapshot.mirrored`; away agents already mirrored by anchors.
- [x] Hover: pointermove → nearest agent < 24px shows label.
- [x] Props: `{ director, era, paused, speed, className }`.
- [x] `npx tsc --noEmit`; commit.

### Task 8: Integrate in `app/match/page.tsx`

**Files:** Modify `app/match/page.tsx`

- [x] Replace `LivePitch` + `Stands` with `<MatchStage>`; delete both components and the rAF/easing code.
- [x] Kickoff: create director with `presSeed = pre.seed ^ 0x9d2c5680`, GK colors via `pickGkColors`, store in ref; remove the `setInterval` game loop (director ticks). Keep `LiveMatchState` in `useRef`.
- [x] Goal banner: non-blocking top strip (no full-pitch black overlay) so the Pixi celebration stays visible; keep cooling overlay.
- [x] Footer: tabs `Narração | Estatísticas` only; new `TÁTICA` button in controls row → full-screen overlay (`fixed inset-0`, arc-panel) hosting existing `TacticsPanel`; opening sets `paused=true`; closing plays `whistle.kickoff` short, calls `director.syncLineups()`, resumes.
- [x] Narration: play `ui.tick` on new event line.
- [x] Speeds 1/1.5/2 wire to MatchStage prop; `skipToEnd` unchanged (sync engine loop, director destroyed).
- [x] Remove page-level `goal.horn`/whistle/ambience-intensity calls now owned by director (keep `stopAmbience` on result).
- [x] `npm test && npx tsc --noEmit && npm run build`; commit.

### Task 9: Verify acceptance criteria

- [x] `npm test` all green (engine calibration untouched).
- [x] `npm run dev` + browser: play a match — build-ups visible, crowd colors, GK distinct, overlay pause/resume, speeds, skip, ~60fps (no long frames in devtools).
- [x] Commit any polish; update CLAUDE.md arquitetura section with `src/match/presentation/`.

## Self-review

- Spec coverage: renderer (T1/T7), steering (T3), ball (T4/T6), crowd (T5/T7), kits/GK (T2), overlay tática (T8), audio (T6/T8), determinism+tests (T6). ✓
- Types consistent with `types.ts` block above. ✓
