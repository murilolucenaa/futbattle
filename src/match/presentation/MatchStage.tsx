"use client";

// ============================================================
// PixiJS renderer for the live match. DOM above this is HUD-only.
// All sim/choreography state lives in the director — this component
// just pumps director.update() from the ticker and draws snapshots.
// ============================================================

import { useEffect, useRef } from "react";
import {
  Application, Container, Graphics, Sprite, Text, Texture,
} from "pixi.js";
import type { PitchEra } from "@/lib/game/types";
import { mulberry32 } from "@/lib/game/engine";
import { layoutCrowd, shimmerAlpha, type CrowdDot } from "./crowd";
import type { Director } from "./director";

const ERA_THEME: Record<PitchEra, { grass: number; grassDark: number; stand: number; lineAlpha: number }> = {
  vintage: { grass: 0x5c6e2e, grassDark: 0x41501f, stand: 0x1d1a12, lineAlpha: 0.28 },
  retro:   { grass: 0x2f6b33, grassDark: 0x1f4a22, stand: 0x1a1d16, lineAlpha: 0.35 },
  classic: { grass: 0x0e5e33, grassDark: 0x073a20, stand: 0x161d2c, lineAlpha: 0.35 },
  modern:  { grass: 0x12793f, grassDark: 0x0a4e28, stand: 0x131c30, lineAlpha: 0.4 },
  ultra:   { grass: 0x169a50, grassDark: 0x0b6231, stand: 0x101a30, lineAlpha: 0.45 },
};

const CROWD_COUNT = 1400;

interface Layout {
  w: number; h: number;
  bandX: number; bandY: number;            // side band width / end band height
  pitch: { x: number; y: number; w: number; h: number };
}

function computeLayout(w: number, h: number): Layout {
  const bandY = Math.max(14, h * 0.085);
  const bandX = Math.max(12, w * 0.045);
  return {
    w, h, bandX, bandY,
    pitch: { x: bandX, y: bandY, w: w - bandX * 2, h: h - bandY * 2 },
  };
}

function hexToNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

export default function MatchStage({
  director, era, paused, speed, homeColor, awayColor, crowdSeed, crowdDensity,
  className = "",
}: {
  director: Director;
  era: PitchEra;
  paused: boolean;
  speed: number;
  homeColor: string;
  awayColor: string;
  crowdSeed: number;
  crowdDensity: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  pausedRef.current = paused;
  speedRef.current = speed;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let app: Application | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      const theme = ERA_THEME[era];
      const a = new Application();
      await a.init({
        background: theme.stand,
        antialias: true,
        resolution: Math.min(2, globalThis.devicePixelRatio || 1),
        autoDensity: true,
        width: Math.max(64, host.clientWidth),
        height: Math.max(64, host.clientHeight),
      });
      if (cancelled) { a.destroy(true); return; }
      app = a;
      host.appendChild(a.canvas);
      a.canvas.style.width = "100%";
      a.canvas.style.height = "100%";
      a.canvas.style.display = "block";

      // ── static layers ──
      const pitchG = new Graphics();
      const crowdLayer = new Container();
      const agentLayer = new Container();
      const ballLayer = new Container();
      a.stage.addChild(pitchG, crowdLayer, agentLayer, ballLayer);

      // shared textures
      const circleG = new Graphics().circle(8, 8, 8).fill(0xffffff);
      const circleTex = a.renderer.generateTexture(circleG);
      const dotG = new Graphics().circle(2, 2, 2).fill(0xffffff);
      const dotTex = a.renderer.generateTexture(dotG);

      let layout = computeLayout(a.renderer.width / a.renderer.resolution, a.renderer.height / a.renderer.resolution);

      const drawPitch = () => {
        const { pitch } = layout;
        const g = pitchG;
        g.clear();
        g.rect(pitch.x, pitch.y, pitch.w, pitch.h).fill(theme.grass);
        // mow stripes
        const stripes = 12;
        for (let i = 0; i < stripes; i += 2) {
          g.rect(pitch.x + (pitch.w / stripes) * i, pitch.y, pitch.w / stripes, pitch.h)
            .fill({ color: theme.grassDark, alpha: 0.35 });
        }
        const line = { width: 2, color: 0xffffff, alpha: theme.lineAlpha };
        const px = (x: number) => pitch.x + (x / 100) * pitch.w;
        const py = (y: number) => pitch.y + (y / 100) * pitch.h;
        g.rect(px(1), py(1), px(99) - px(1), py(99) - py(1)).stroke(line);
        g.moveTo(px(50), py(1)).lineTo(px(50), py(99)).stroke(line);
        g.circle(px(50), py(50), (10 / 100) * pitch.h).stroke(line);
        // boxes
        g.rect(px(1), py(24), px(15) - px(1), py(76) - py(24)).stroke(line);
        g.rect(px(1), py(38), px(6) - px(1), py(62) - py(38)).stroke(line);
        g.rect(px(85), py(24), px(99) - px(85), py(76) - py(24)).stroke(line);
        g.rect(px(94), py(38), px(99) - px(94), py(62) - py(38)).stroke(line);
        // goal mouths
        g.rect(px(0) - 1, py(44), px(1) - px(0) + 1, py(56) - py(44)).fill({ color: 0xffffff, alpha: 0.5 });
        g.rect(px(99), py(44), px(100) - px(99) + 1, py(56) - py(44)).fill({ color: 0xffffff, alpha: 0.5 });
      };

      // ── crowd ──
      const dots: CrowdDot[] = layoutCrowd(mulberry32(crowdSeed >>> 0), CROWD_COUNT, crowdDensity);
      const homeTint = hexToNum(homeColor);
      const awayTint = hexToNum(awayColor);
      const crowdSprites: { sprite: Sprite; dot: CrowdDot; baseX: number; baseY: number }[] = [];
      for (const dot of dots) {
        const s = new Sprite(dotTex);
        s.anchor.set(0.5);
        s.tint = dot.side === "h" ? homeTint : awayTint;
        crowdLayer.addChild(s);
        crowdSprites.push({ sprite: s, dot, baseX: 0, baseY: 0 });
      }

      const placeCrowd = (mirrored: boolean) => {
        const { w, h, bandX, bandY, pitch } = layout;
        for (const c of crowdSprites) {
          const { dot } = c;
          let band = dot.band;
          // fans stay behind their own team's goal after the break
          if (mirrored && band === "left") band = "right";
          else if (mirrored && band === "right") band = "left";
          if (band === "top") {
            c.baseX = pitch.x + dot.u * pitch.w;
            c.baseY = 3 + dot.v * (bandY - 6);
          } else if (band === "bottom") {
            c.baseX = pitch.x + dot.u * pitch.w;
            c.baseY = h - bandY + 3 + dot.v * (bandY - 6);
          } else if (band === "left") {
            c.baseX = 3 + dot.v * (bandX - 6);
            c.baseY = pitch.y + dot.u * pitch.h;
          } else {
            c.baseX = w - bandX + 3 + dot.v * (bandX - 6);
            c.baseY = pitch.y + dot.u * pitch.h;
          }
        }
      };

      // ── agents ──
      interface AgentNode {
        root: Container; body: Sprite; ring: Graphics; label: Text;
      }
      const nodes = new Map<string, AgentNode>();
      const makeNode = (name: string, color: string): AgentNode => {
        const root = new Container();
        const ring = new Graphics().circle(0, 0, 9).stroke({ width: 2, color: 0xffffff });
        ring.visible = false;
        const body = new Sprite(circleTex);
        body.anchor.set(0.5);
        body.width = 13; body.height = 13;
        body.tint = hexToNum(color);
        const outline = new Graphics().circle(0, 0, 6.5).stroke({ width: 1.5, color: 0x000000, alpha: 0.5 });
        const label = new Text({
          text: name,
          style: {
            fontFamily: "Archivo, sans-serif", fontSize: 10, fontWeight: "700",
            fill: 0xffffff, stroke: { color: 0x000000, width: 3 },
          },
        });
        label.anchor.set(0.5, 0);
        label.y = 8;
        label.visible = false;
        root.addChild(ring, body, outline, label);
        agentLayer.addChild(root);
        return { root, body, ring, label };
      };

      // ── ball ──
      const ballShadow = new Graphics().ellipse(0, 0, 4, 2).fill({ color: 0x000000, alpha: 0.35 });
      const ballSprite = new Sprite(circleTex);
      ballSprite.anchor.set(0.5);
      ballSprite.width = 8; ballSprite.height = 8;
      ballLayer.addChild(ballShadow, ballSprite);

      // hover tracking
      let pointer: { x: number; y: number } | null = null;
      const onMove = (e: PointerEvent) => {
        const r = a.canvas.getBoundingClientRect();
        pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const onLeave = () => { pointer = null; };
      a.canvas.addEventListener("pointermove", onMove);
      a.canvas.addEventListener("pointerleave", onLeave);

      drawPitch();
      let lastMirrored = false;
      placeCrowd(false);

      let shimmerT = 0;

      const draw = () => {
        const snap = director.snapshot();
        const { pitch } = layout;
        const fx = (x: number) => pitch.x + ((snap.mirrored ? 100 - x : x) / 100) * pitch.w;
        const fy = (y: number) => pitch.y + (y / 100) * pitch.h;

        if (snap.mirrored !== lastMirrored) {
          lastMirrored = snap.mirrored;
          placeCrowd(snap.mirrored);
        }

        // agents (diff against snapshot)
        const seen = new Set<string>();
        let hoverId: string | null = null;
        if (pointer) {
          let best = 24;
          for (const ag of snap.agents) {
            const d = Math.hypot(fx(ag.x) - pointer.x, fy(ag.y) - pointer.y);
            if (d < best) { best = d; hoverId = ag.id; }
          }
        }
        for (const ag of snap.agents) {
          seen.add(ag.id);
          let node = nodes.get(ag.id);
          if (!node) { node = makeNode(ag.name, ag.color); nodes.set(ag.id, node); }
          node.body.tint = hexToNum(ag.color);
          node.root.x = fx(ag.x);
          node.root.y = fy(ag.y);
          const isCarrier = snap.carrierId === ag.id;
          node.ring.visible = isCarrier;
          node.label.visible = isCarrier || hoverId === ag.id;
          if (ag.celebrating || (snap.celebration && snap.celebration.scorerId === ag.id)) {
            // little hop during the party
            node.root.y -= Math.abs(Math.sin(shimmerT * 9 + ag.noiseSeed)) * 4;
          }
        }
        for (const [id, node] of nodes) {
          if (!seen.has(id)) { node.root.destroy(); nodes.delete(id); }
        }

        // ball: pseudo-height scales the sprite and offsets the shadow
        const bx = fx(snap.ball.x), by = fy(snap.ball.y);
        const lift = snap.ball.h;
        ballSprite.x = bx;
        ballSprite.y = by - lift * 14;
        ballSprite.width = ballSprite.height = 8 + lift * 5;
        ballShadow.x = bx;
        ballShadow.y = by + 3;
        ballShadow.alpha = 0.35 - lift * 0.2;

        // crowd shimmer + goal burst
        const burst = snap.crowdBurst;
        for (const c of crowdSprites) {
          const base = shimmerAlpha(c.dot, shimmerT);
          c.sprite.x = c.baseX;
          c.sprite.y = c.baseY;
          c.sprite.alpha = base;
          c.sprite.tint = c.dot.side === "h" ? homeTint : awayTint;
          if (burst && c.dot.side === burst.side) {
            const k = Math.abs(Math.sin(c.dot.phase * 7 + shimmerT * 14));
            c.sprite.y = c.baseY - k * 5 * burst.t;
            c.sprite.alpha = Math.min(1, base + burst.t * 0.4);
            if (k > 0.82) c.sprite.tint = 0xffffff; // camera flashes
          }
        }
      };

      a.ticker.add((ticker) => {
        shimmerT += ticker.deltaMS / 1000;
        if (!pausedRef.current) director.update(ticker.deltaMS, speedRef.current);
        draw();
      });

      observer = new ResizeObserver(() => {
        if (!app || host.clientWidth === 0 || host.clientHeight === 0) return;
        a.renderer.resize(host.clientWidth, host.clientHeight);
        layout = computeLayout(host.clientWidth, host.clientHeight);
        drawPitch();
        placeCrowd(lastMirrored);
      });
      observer.observe(host);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (app) {
        app.destroy(true, { children: true, texture: true });
        app = null;
      }
    };
    // director/era/colors fixed for the lifetime of a match
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director]);

  return <div ref={hostRef} className={`relative w-full h-full ${className}`} />;
}
