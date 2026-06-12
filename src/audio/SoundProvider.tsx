"use client";

import { useEffect } from "react";
import { sound } from "./SoundManager";
import { useUISound } from "./useUISound";

/**
 * Mounts the global [data-sound] delegation + keyboard nav, and unlocks
 * the audio context on the first user gesture (autoplay policy), flushing
 * any sounds that were requested while still locked. Render once at the
 * app root (replaces the old <SfxRoot/>).
 */
export default function SoundProvider() {
  useUISound();

  useEffect(() => {
    const unlock = () => sound.unlock();
    const opts = { capture: true, once: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock, opts as EventListenerOptions);
      window.removeEventListener("keydown", unlock, opts as EventListenerOptions);
      window.removeEventListener("touchstart", unlock, opts as EventListenerOptions);
    };
  }, []);

  return null;
}
