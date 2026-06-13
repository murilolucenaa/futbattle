// ============================================================
// Match director — the ONLY presentation module that knows the
// engine. It calls tick() lazily, turns each engine minute into
// ball Beats (passes / build-ups / shots / celebrations) and
// steps agents + crowd at a fixed timestep, so the same seed
// replays the exact same match AND the exact same choreography.
// ============================================================

import {
  aiMaybeAct, mulberry32, tick, type LiveMatchState,
} from "@/lib/game/engine";
import { FORMATIONS } from "@/lib/game/formations";
import type { FormationSlot, MatchEvent } from "@/lib/game/types";
import { anchorFor, makeAgent, stepAgents, PHYS_DT } from "./agents";
import { carryBeat, passBeat, sampleBeat, shotBeat } from "./ball";
import { pickGkColors } from "./gkColors";
import type {
  AgentState, AudioPort, BallState, Beat, DirectorSnapshot, DirectorView, Vec,
} from "./types";

const PHYS_MS = PHYS_DT * 1000;
const CELEBRATION_MS = 3000;
const AMBIENCE_EVERY_STEPS = 30;

const SUFFIXES = new Set(["Júnior", "Junior", "Jr.", "Filho", "Santos", "Cézar"]);
function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) return name;
  const last = parts[parts.length - 1];
  return SUFFIXES.has(last) ? parts[0] : last;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface DirectorOpts {
  userSide: "h" | "a";
  presSeed: number;
  audio: AudioPort;
  baseMinuteMs?: number;
  onView(v: DirectorView): void;
  onEvents(evs: MatchEvent[]): void;
  onFinished(): void;
}

export interface Director {
  update(elapsedMs: number, speed: number): void;
  snapshot(): DirectorSnapshot;
  syncLineups(): void;
  destroy(): void;
}

const SHOT_TYPES = new Set<MatchEvent["type"]>(["goal", "save", "miss", "post"]);

export function createDirector(state: LiveMatchState, opts: DirectorOpts): Director {
  const baseMinuteMs = opts.baseMinuteMs ?? 650;
  const rng = mulberry32(opts.presSeed >>> 0);
  const audio = opts.audio;
  const aiSide: "h" | "a" = opts.userSide === "h" ? "a" : "h";
  const [gkH, gkA] = pickGkColors(state.h.team.colors, state.a.team.colors);

  let agents: AgentState[] = [];
  const slotById = new Map<string, { slot: FormationSlot; side: "h" | "a" }>();
  let ball: BallState = { x: 50, y: 50, h: 0 };
  let carrierId: string | null = null;
  let chaseOverride: Vec | null = null;     // celebration: converge on scorer
  let diveGk: { id: string; target: Vec } | null = null;
  let celebration: DirectorSnapshot["celebration"] = null;
  let crowdBurst: DirectorSnapshot["crowdBurst"] = null;

  const queue: Beat[] = [];
  let beat: Beat | null = null;
  let beatClock = 0;
  let pauseLeft = 0;
  let acc = 0;
  let tSec = 0;
  let stepCount = 0;
  let releasedCount = 1; // kickoff event is visible immediately
  let pendingRelease: { count: number; evs: MatchEvent[] } | null = null;
  let finishedNotified = false;
  let destroyed = false;

  function rebuildAgents(): void {
    const next: AgentState[] = [];
    slotById.clear();
    for (const side of ["h", "a"] as const) {
      const ts = side === "h" ? state.h : state.a;
      const slots = FORMATIONS[ts.team.tactics.formation];
      ts.team.lineup.forEach((card, i) => {
        if (!card) return;
        const slot = slots[i];
        const isGk = slot.pos === "GK";
        slotById.set(card.player.id, { slot, side });
        const existing = agents.find((a) => a.id === card.player.id);
        if (existing) {
          existing.pos = slot.pos;
          existing.isGk = isGk;
          existing.color = isGk ? (side === "h" ? gkH : gkA) : ts.team.colors[0];
          next.push(existing);
        } else {
          const a = makeAgent(
            card.player.id, shortName(card.player.name), side, slot,
            isGk ? (side === "h" ? gkH : gkA) : ts.team.colors[0],
            isGk, hashStr(card.player.id) % 97
          );
          // substitutes jog in from the near touchline
          if (agents.length > 0) { a.x = 50; a.y = 2; }
          next.push(a);
        }
      });
    }
    agents = next;
  }
  rebuildAgents();

  function jitter(amount: number): number {
    return (rng() * 2 - 1) * amount;
  }

  function clampField(v: Vec): Vec {
    return { x: Math.min(99.5, Math.max(0.5, v.x)), y: Math.min(97, Math.max(3, v.y)) };
  }

  function teammatesNear(side: "h" | "a", zone: Vec, n: number): Vec[] {
    const pool = agents
      .filter((a) => a.side === side && !a.isGk)
      .sort((p, q) => Math.hypot(p.x - zone.x, p.y - zone.y) - Math.hypot(q.x - zone.x, q.y - zone.y))
      .slice(0, 6);
    const out: Vec[] = [];
    const used = new Set<number>();
    for (let i = 0; i < n && used.size < pool.length; i++) {
      let idx = Math.floor(rng() * pool.length);
      while (used.has(idx)) idx = (idx + 1) % pool.length;
      used.add(idx);
      const p = pool[idx];
      out.push(clampField({ x: p.x + jitter(3), y: p.y + jitter(3) }));
    }
    return out;
  }

  /** Possession passes toward the engine's ball zone, scaled to ~baseMinuteMs. */
  function possessionBeats(side: "h" | "a", zone: Vec): Beat[] {
    const n = 2 + Math.floor(rng() * 2);
    const points = teammatesNear(side, zone, n);
    points.push(clampField({ x: zone.x + jitter(4), y: zone.y + jitter(6) }));
    const beats: Beat[] = [];
    let from: Vec = { x: ball.x, y: ball.y };
    for (const to of points) {
      beats.push(passBeat(from, to, rng));
      from = to;
    }
    const total = beats.reduce((s, b) => s + b.durMs + (b.pauseAfterMs ?? 0), 0);
    const scale = baseMinuteMs / Math.max(total, 1);
    for (const b of beats) {
      b.owner = side;
      // never let scaling push the ball past ~110 u/s (eased peak ≈ 2× avg)
      const dist = Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y);
      b.durMs = Math.max(100, (dist / 110) * 1000, b.durMs * scale);
      if (b.pauseAfterMs) b.pauseAfterMs = Math.max(30, b.pauseAfterMs * scale);
    }
    return beats;
  }

  /** Visible build-up + strike for a goal/save/miss/post minute. */
  function shotBeats(ev: MatchEvent): Beat[] {
    const side = ev.side;
    const goalX = side === "h" ? 99.5 : 0.5;
    const dir = side === "h" ? 1 : -1;
    const boxEdge = clampField({
      x: 50 + dir * (28 + rng() * 8),
      y: 35 + rng() * 30,
    });
    const beats: Beat[] = [];
    const relay = teammatesNear(side, boxEdge, 1)[0]
      ?? clampField({ x: 50 + dir * 15, y: boxEdge.y + jitter(10) });
    beats.push(passBeat({ x: ball.x, y: ball.y }, relay, rng));
    beats.push(passBeat(relay, boxEdge, rng));
    const strikePoint = clampField({ x: boxEdge.x + dir * 6, y: boxEdge.y + jitter(4) });
    beats.push(carryBeat(boxEdge, strikePoint));

    const keeperSpot: Vec = { x: side === "h" ? 95 : 5, y: 50 };
    if (ev.type === "goal") {
      const target = { x: goalX, y: 44 + rng() * 12 };
      const shot = shotBeat(strikePoint, target, "goal");
      shot.scorerId = ev.playerId;
      beats.push(shot);
      beats.push({
        kind: "celebration", durMs: CELEBRATION_MS,
        from: target, to: target, curve: 0, arc: 0, scorerId: ev.playerId,
      });
      beats.push({
        kind: "reset", durMs: 900,
        from: target, to: { x: 50, y: 50 }, curve: 0, arc: 0.3,
      });
    } else if (ev.type === "save") {
      const target = { x: goalX, y: 42 + rng() * 16 };
      beats.push(shotBeat(strikePoint, target, "save"));
      beats.push({ kind: "goalkick", durMs: 700, from: target, to: keeperSpot, curve: 0, arc: 0 });
    } else if (ev.type === "post") {
      const target = { x: goalX, y: rng() < 0.5 ? 38.5 : 61.5 };
      beats.push(shotBeat(strikePoint, target, "post"));
      const out = clampField({ x: side === "h" ? 86 : 14, y: target.y + jitter(10) });
      beats.push({ kind: "bounce", durMs: 450, from: target, to: out, curve: 0, arc: 0.2 });
    } else {
      const wideY = rng() < 0.5 ? 24 + rng() * 10 : 66 + rng() * 10;
      const target = { x: goalX, y: wideY };
      beats.push(shotBeat(strikePoint, target, "miss"));
      beats.push({ kind: "goalkick", durMs: 900, from: target, to: keeperSpot, curve: 0, arc: 0.5 });
    }
    // lock the carrier to the attacking side; restarts (goal kick / kickoff
    // after a goal) belong to the side that conceded.
    const defend: "h" | "a" = side === "h" ? "a" : "h";
    for (const b of beats) {
      b.owner = b.kind === "goalkick" || b.kind === "reset" ? defend : side;
    }
    return beats;
  }

  function stoppage(durMs: number): Beat {
    const here = { x: ball.x, y: ball.y };
    return { kind: "stoppage", durMs, from: here, to: here, curve: 0, arc: 0 };
  }

  /** Advance the engine one minute and choreograph it. */
  function runMinute(): void {
    const baseCount = state.events.length;
    const prevPoss = state.possMinH;
    const evs = tick(state);
    aiMaybeAct(state, aiSide);
    const holder: "h" | "a" = state.possMinH > prevPoss ? "h" : "a";

    const shotIdx = evs.findIndex((e) => SHOT_TYPES.has(e.type));
    if (shotIdx >= 0) {
      releasedCount = baseCount + shotIdx;
      pendingRelease = { count: state.events.length, evs: evs.slice(shotIdx) };
      if (shotIdx > 0) opts.onEvents(evs.slice(0, shotIdx));
      queue.push(...shotBeats(evs[shotIdx]));
    } else {
      releasedCount = state.events.length;
      if (evs.length) opts.onEvents(evs);
      queue.push(...possessionBeats(holder, { x: state.ballX, y: state.ballY }));
    }

    // stoppage beats for non-shot interruptions
    for (const e of evs) {
      if (e.type === "card") queue.push(stoppage(700));
      else if (e.type === "sub") { rebuildAgents(); queue.push(stoppage(1200)); }
      else if (e.type === "tactic") { rebuildAgents(); queue.push(stoppage(300)); }
      else if (e.type === "cooling") queue.push(stoppage(1800));
      else if (e.type === "halftime") {
        audio.play("whistle.half");
        queue.push(stoppage(1000));
        queue.push({ kind: "reset", durMs: 800, from: { x: ball.x, y: ball.y }, to: { x: 50, y: 50 }, curve: 0, arc: 0 });
      } else if (e.type === "fulltime") {
        audio.play("whistle.end");
      }
    }

    emitView();
  }

  function emitView(): void {
    opts.onView({
      minute: state.minute,
      scoreH: state.scoreH,
      scoreA: state.scoreA,
      possH: state.statsH.possession,
      eventCount: releasedCount,
    });
  }

  function onBeatComplete(b: Beat): void {
    if (b.kind === "shot") {
      if (pendingRelease) {
        releasedCount = pendingRelease.count;
        opts.onEvents(pendingRelease.evs);
        pendingRelease = null;
        emitView();
      }
      const side = b.owner ?? (b.to.x > 50 ? "h" as const : "a" as const);
      if (b.outcome === "goal") {
        audio.play("goal.horn");
        celebration = { scorerId: b.scorerId ?? "", side, t: 1 };
        crowdBurst = { side, t: 1 };
      } else {
        audio.play("crowd.ooh");
        // keeper gathers / reacts
        const gk = agents.find((a) => a.isGk && (side === "h" ? a.side === "a" : a.side === "h"));
        if (gk && b.outcome === "save") diveGk = { id: gk.id, target: { x: b.to.x, y: b.to.y } };
      }
      carrierId = null;
    } else if (b.kind === "celebration") {
      celebration = null;
      chaseOverride = null;
      for (const a of agents) a.celebrating = false;
    } else if (b.kind === "goalkick") {
      diveGk = null;
      carrierId = nearestAgentId({ x: b.to.x, y: b.to.y }, b.owner ?? null);
    } else if (b.kind === "pass" || b.kind === "carry" || b.kind === "reset" || b.kind === "bounce") {
      carrierId = nearestAgentId({ x: b.to.x, y: b.to.y }, b.owner ?? null);
    }
  }

  function nearestAgentId(p: Vec, side: "h" | "a" | null): string | null {
    let best: string | null = null;
    let bestD = 14; // only "owns" the ball when reasonably close
    for (const a of agents) {
      if (a.isGk) continue;
      if (side && a.side !== side) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < bestD) { bestD = d; best = a.id; }
    }
    return best;
  }

  function startBeat(b: Beat): void {
    beat = b;
    beatClock = 0;
    // stoppages/resets are scheduled before earlier beats finish moving the
    // ball — re-anchor them to wherever the ball actually is now
    if (b.kind === "stoppage") {
      b.from = { x: ball.x, y: ball.y };
      b.to = b.from;
    } else if (b.kind === "reset") {
      b.from = { x: ball.x, y: ball.y };
    }
    if (b.kind === "celebration") {
      const scorer = agents.find((a) => a.id === b.scorerId);
      const side = scorer?.side;
      for (const a of agents) {
        a.celebrating = !!scorer && a.side === side && !a.isGk && a.id !== scorer.id;
      }
      if (scorer) {
        chaseOverride = { x: scorer.x, y: scorer.y };
        carrierId = scorer.id;
      }
    }
    if (b.kind === "shot" || b.kind === "goalkick" || b.kind === "bounce") carrierId = null;
  }

  function step(): void {
    tSec += PHYS_DT;
    stepCount++;

    if (pauseLeft > 0) {
      pauseLeft = Math.max(0, pauseLeft - PHYS_MS);
    } else {
      if (!beat) {
        const next = queue.shift();
        if (next) startBeat(next);
        else if (!state.finished) runMinute();
        else if (!finishedNotified) { finishedNotified = true; opts.onFinished(); }
      }
      if (beat) {
        beatClock += PHYS_MS;
        const t = Math.min(1, beatClock / beat.durMs);
        ball = sampleBeat(beat, t);
        if (beat.kind === "celebration") {
          const scorer = agents.find((a) => a.id === beat!.scorerId);
          if (scorer) chaseOverride = { x: scorer.x, y: scorer.y };
          if (celebration) celebration.t = Math.max(0, 1 - t);
        }
        if (t >= 1) {
          const done = beat;
          beat = null;
          pauseLeft = done.pauseAfterMs ?? 0;
          onBeatComplete(done);
        }
      }
    }

    // anchors track the presented ball
    for (const a of agents) {
      const rec = slotById.get(a.id);
      if (!rec) continue;
      const anchor = anchorFor(rec.slot, rec.side, ball.x, ball.y);
      a.anchorX = anchor.x;
      a.anchorY = anchor.y;
    }
    if (diveGk) {
      const gk = agents.find((a) => a.id === diveGk!.id);
      if (gk) { gk.anchorX = diveGk.target.x; gk.anchorY = diveGk.target.y; }
    }

    // chaseOverride is only set during a celebration → suppress normal chasing
    stepAgents(agents, chaseOverride ?? { x: ball.x, y: ball.y }, carrierId, tSec, chaseOverride != null);

    if (crowdBurst) {
      crowdBurst.t = Math.max(0, crowdBurst.t - PHYS_DT / 2.5);
      if (crowdBurst.t === 0) crowdBurst = null;
    }

    if (stepCount % AMBIENCE_EVERY_STEPS === 0) {
      const danger = Math.max(0, (Math.abs(ball.x - 50) - 25) / 25);
      audio.setAmbienceIntensity(0.35 + 0.5 * Math.min(1, danger));
    }
  }

  return {
    update(elapsedMs: number, speed: number): void {
      if (destroyed) return;
      if (state.finished && !beat && queue.length === 0 && !finishedNotified) {
        finishedNotified = true;
        releasedCount = state.events.length;
        emitView();
        opts.onFinished();
        return;
      }
      acc += Math.min(elapsedMs, 250) * speed; // clamp tab-switch jumps
      while (acc >= PHYS_MS) {
        acc -= PHYS_MS;
        step();
        if (destroyed) return;
      }
    },

    snapshot(): DirectorSnapshot {
      return {
        agents,
        ball,
        carrierId,
        mirrored: state.minute > 45,
        celebration,
        crowdBurst,
      };
    },

    syncLineups(): void {
      rebuildAgents();
    },

    destroy(): void {
      destroyed = true;
    },
  };
}
