"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sound } from "@/src/audio/SoundManager";

// Console-style diagonal screen wipe. Usage:
//   const { wipe, overlay } = useScreenWipe();
//   wipe(() => router.push("/cup"));        // forward
//   wipe(() => router.back(), true);        // reverse
// Render {overlay} once at the page root. onCovered fires while the
// screen is fully hidden, so the route swap happens behind the panel.

type Phase = "idle" | "in" | "out";

const EASE_IN: [number, number, number, number] = [0.7, 0, 0.84, 0];
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function useScreenWipe() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [reverse, setReverse] = useState(false);
  const coveredCb = useRef<(() => void) | null>(null);

  const wipe = useCallback((onCovered?: () => void, back = false) => {
    coveredCb.current = onCovered ?? null;
    setReverse(back);
    setPhase("in");
    sound.play("transition.whoosh");
  }, []);

  const from = reverse ? "110%" : "-110%";
  const to = reverse ? "-110%" : "110%";

  const overlay = (
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          className="wipe-panel"
          style={{ skewX: -12 }}
          initial={{ x: from }}
          animate={{ x: phase === "in" ? "0%" : to }}
          transition={{ duration: 0.3, ease: phase === "in" ? EASE_IN : EASE_OUT }}
          onAnimationComplete={() => {
            if (phase === "in") {
              coveredCb.current?.();
              coveredCb.current = null;
              setPhase("out");
            } else {
              setPhase("idle");
            }
          }}
        >
          {/* accent edge stripe trailing the panel */}
          <div
            className="absolute inset-y-0 w-3"
            style={{ [reverse ? "left" : "right"]: 0, background: "var(--accent)", boxShadow: "0 0 24px var(--accent)" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { wipe, overlay, wiping: phase !== "idle" };
}
