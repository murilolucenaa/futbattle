import { createMatch } from "@/lib/game/engine";
import { buildAiTeam } from "@/lib/game/cup";
import { SQUAD_BY_ID } from "@/lib/data/squads";
import { createDirector } from "../director";
import { NULL_AUDIO, type DirectorView } from "../types";

const SEED = 123456;

function freshDirector(onView?: (v: DirectorView) => void) {
  const home = buildAiTeam(SQUAD_BY_ID["bra-1970"]);
  const away = buildAiTeam(SQUAD_BY_ID["arg-1986"]);
  const state = createMatch(home, away, SEED);
  let finished = false;
  const dir = createDirector(state, {
    userSide: "h",
    presSeed: SEED ^ 0x9d2c5680,
    audio: NULL_AUDIO,
    onView: onView ?? (() => {}),
    onEvents: () => {},
    onFinished: () => { finished = true; },
  });
  return { dir, state, isFinished: () => finished };
}

/** Drive with fixed 16.666ms frames, like an ideal 60Hz rAF. */
function drive(dir: ReturnType<typeof freshDirector>["dir"], frames: number, speed = 1) {
  for (let i = 0; i < frames; i++) dir.update(1000 / 60, speed);
}

function trace(dir: ReturnType<typeof freshDirector>["dir"]): string {
  const s = dir.snapshot();
  const nums = [s.ball.x, s.ball.y, ...s.agents.flatMap((a) => [a.x, a.y])];
  return nums.map((n) => n.toFixed(3)).join(",");
}

describe("director", () => {
  it("same seed ⇒ identical engine result AND identical choreography", () => {
    const a = freshDirector();
    const b = freshDirector();
    const traces: [string[], string[]] = [[], []];
    for (let block = 0; block < 40; block++) {
      drive(a.dir, 30);
      drive(b.dir, 30);
      traces[0].push(trace(a.dir));
      traces[1].push(trace(b.dir));
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(a.state.scoreH).toBe(b.state.scoreH);
    expect(a.state.scoreA).toBe(b.state.scoreA);
  });

  it("ball never teleports between frames", () => {
    const { dir, state } = freshDirector();
    let prev = dir.snapshot().ball;
    let frames = 0;
    while (!state.finished && frames < 60 * 240) {
      dir.update(1000 / 60, 2);
      const cur = dir.snapshot().ball;
      const d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      expect(d).toBeLessThanOrEqual(8.0); // shots at 2x are the fastest motion
      prev = cur;
      frames++;
    }
    expect(state.finished).toBe(true);
  });

  it("reaches fulltime and reports views with increasing minutes", () => {
    const minutes: number[] = [];
    const ctx = freshDirector((v) => minutes.push(v.minute));
    drive(ctx.dir, 60 * 180, 2); // plenty of wall time at 2x
    expect(ctx.state.finished).toBe(true);
    expect(ctx.isFinished()).toBe(true);
    expect(minutes[minutes.length - 1]).toBeGreaterThanOrEqual(90);
    for (let i = 1; i < minutes.length; i++) expect(minutes[i]).toBeGreaterThanOrEqual(minutes[i - 1]);
  });

  it("speed 2 consumes sim time about twice as fast as speed 1", () => {
    const s1 = freshDirector();
    const s2 = freshDirector();
    drive(s1.dir, 60 * 20, 1);
    drive(s2.dir, 60 * 10, 2);
    expect(Math.abs(s1.state.minute - s2.state.minute)).toBeLessThanOrEqual(2);
  });

  it("flips render mirror after halftime", () => {
    const ctx = freshDirector();
    expect(ctx.dir.snapshot().mirrored).toBe(false);
    drive(ctx.dir, 60 * 180, 2);
    // finished match was past minute 45
    expect(ctx.dir.snapshot().mirrored).toBe(true);
  });
});
