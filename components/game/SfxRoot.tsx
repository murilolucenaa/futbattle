"use client";

import { useEffect } from "react";
import { initUiSfx } from "@/lib/sfx";

/** Mounts the global [data-sfx] click/hover/haptics delegation once. */
export default function SfxRoot() {
  useEffect(() => { initUiSfx(); }, []);
  return null;
}
