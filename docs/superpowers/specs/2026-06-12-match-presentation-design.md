# Match Presentation 2.0 — PixiJS spectacle layer

Date: 2026-06-12 · Branch: feat/draft-screen-redesign (new branch recommended: feat/match-presentation)

## Goal

Turn the live match view into a believable 2D spectacle WITHOUT changing simulation
results. The engine (`lib/game/engine.ts`) stays untouched; the presentation layer
interpolates and dramatizes its per-minute timeline.

## Non-goals

- No engine changes (tick logic, RNG, calibration all untouched).
- No penalty-shootout choreography (engine resolves pens instantly; result shown as today).
- No Phaser — PixiJS per spec.

## Architecture

```
src/match/presentation/
  types.ts        # shared presentation types (PresPlayer, Scene, DirectorView…)
  director.ts     # ONLY module that knows the engine. Owns tick() calls, reads
                  # LiveMatchState, converts each engine minute into scenes
                  # (possession passes / chance build-up / goal celebration / stoppages).
                  # Deterministic: own PRNG = mulberry32(matchSeed ^ 0x9d2c5680).
  agents.ts       # steering: formation anchor (shifted by ball zone), smoothed seek
                  # w/ per-position max speed, short-range separation, value-noise idle.
                  # Pure TS, no Pixi — testable.
  ball.ts         # procedural ball: bezier pass arcs, reception micro-pause,
                  # carry + shot tweens. Pure TS.
  crowd.ts        # crowd ring layout (sector halves per kit color), shimmer state,
                  # goal burst for the scoring half. Pure TS state + Pixi-agnostic.
  gkColors.ts     # auto GK kit colors: high-contrast palette pick avoiding both
                  # team kits and the other GK.
  MatchStage.tsx  # React component. Mounts Pixi Application (canvas/WebGL),
                  # builds pitch/crowd/agents sprites, runs rAF loop calling
                  # director.update(dt). DOM is HUD-only above it.
```

`app/match/page.tsx` changes:
- `LivePitch` + `Stands` replaced by `<MatchStage>`.
- Game loop moves into the director (page no longer runs `setInterval`); page keeps
  `LiveMatchState` in `useRef` (CLAUDE.md rule) and passes it to the director once.
- Footer becomes NARRAÇÃO | ESTATÍSTICAS + speed controls 1x/1.5x/2x + "Pular pro fim".
- New HUD button "TÁTICA": pauses director, opens full-screen overlay reusing the
  existing TacticsPanel (formation/mentality/style/subs + read-only opponent).
  Closing resumes with a short whistle.

## Director contract

- Page creates it at kickoff: `createDirector(state, { userSide, presSeed, callbacks })`.
- `update(dtMs, speed)` advances an internal scene queue. When the queue drains, it
  calls `tick(state)` + `aiMaybeAct` itself, then converts the new minute into scenes:
  - **Possession minute** (no event): infer holder by `possMinH` delta; 2–4 procedural
    passes among nearest agents inside the sector around engine `ballX/ballY`.
  - **chance/miss/post/save/goal**: visible build-up (quick passes into final third →
    carry toward box → shot tween). miss = wide + `crowd.ooh`; post = woodwork bounce;
    save = GK lateral dive intercept; goal = ball in net + ~3s celebration scene
    (teammates converge on `playerId`, crowd burst on scorer's half, horn, score pulse).
  - **halftime**: whistle + side swap (render mirror, as today).
  - **sub/card/cooling/tactic**: brief stoppage beats; sub agent enters from touchline.
- Base pacing: 650ms per engine minute at 1x (scenes may stretch a minute, e.g. goals).
- Callbacks notify React: view (minute/score/possession/eventCount), finished.
- Determinism: presentation PRNG derived from match seed; same seed + same user
  actions ⇒ identical choreography. Live tactic changes alter the engine stream
  (existing, by design) and therefore the choreography — expected.

## Agents

- 22 agents keyed by player id; diffed against `fielded()` every tick (subs join/leave).
- Anchor = formation slot, x-depth scaled as today (3 + slot.x * 0.44) plus team-wide
  push/retreat from ball zone; y nudged toward ball lane slightly.
- Only the 1–2 closest per team chase the ball; others orbit anchors with value noise.
- Separation force with ~3% field radius. Per-position max speed (ATT > MID > DEF > GK).
- GK stays on goal line area; dives only in save/goal scenes.

## Kits & legibility

- Team colors from `MatchTeam.colors` (kit clash already resolved pre-match — reuse).
- GK colors via `pickGkColors(homeKit, awayKit)`: choose 2 from a fixed high-contrast
  palette (amarelo, ciano, rosa, laranja, verde-limão, roxo) maximizing min distance
  to all 4 team colors and to each other.
- Name label rendered only on ball carrier + on pointer hover.

## Crowd

- ~600 dots in a ring band around the pitch (Pixi container of tiny sprites).
- Behind each goal: 100% the defending-that-end team's color; sides: 50/50 mix.
- Constant shimmer (subset alpha oscillation); on goal, scorer's half jumps + white flashes.
- Density scaled by `attendance/capacity` as today.

## Audio

- `crowd.loop` ambience with `setAmbienceIntensity` driven by ball danger
  (proximity to either box) — smoothed.
- `crowd.ooh` on miss/post/save; `goal.horn` on goal; `whistle.half`/`whistle.end`;
  short whistle on tactics-overlay close (reuse `whistle.kickoff`).
- `ui.tick` when a new narration line appears.

## Testing

- Pure modules (director scheduling, agents, ball paths, gkColors, crowd layout) get
  Jest tests in `lib/game/__tests__`-style location `src/match/presentation/__tests__/`:
  - determinism: two headless director runs with same seed produce identical
    position traces (hashed) and identical scene logs;
  - ball continuity: max per-frame ball displacement bounded (no teleports);
  - gkColors: min distance guarantees vs adversarial kits;
  - existing engine tests stay green (`npm test`).
- Manual: `npm run dev`, play a match; verify 60fps, overlay pause/resume, speeds, skip.

## Acceptance criteria (from mission)

- [ ] Same seed ⇒ same match AND same choreography
- [ ] 60fps with 22 agents + ball + ~600 crowd dots
- [ ] Ball never teleports; every event has visible build-up
- [ ] Crowd in real kit colors; GKs always distinguishable
- [ ] Tactics opens as overlay with clean pause/resume
- [ ] Speeds 1x/1.5x/2x and skip-to-end working
