"use client";

import type { ReactNode } from "react";

interface GameShellProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  /** Column widths for the side panels (desktop). Center always flexes. */
  leftWidth?: number;
  rightWidth?: number;
  className?: string;
}

/**
 * Console-style 3-column game screen. Fills its parent (give it a 100dvh,
 * overflow-hidden ancestor) and never scrolls as a whole — each column owns
 * its own internal scroll. Stacks vertically on small screens.
 */
export default function GameShell({
  left,
  center,
  right,
  leftWidth = 360,
  rightWidth = 320,
  className = "",
}: GameShellProps) {
  return (
    <div
      className={`grid h-full min-h-0 w-full gap-3 overflow-y-auto p-3 lg:grid-cols-[var(--gs-l)_minmax(0,1fr)_var(--gs-r)] lg:gap-4 lg:overflow-hidden lg:p-4 ${className}`}
      style={
        {
          "--gs-l": `${leftWidth}px`,
          "--gs-r": `${rightWidth}px`,
        } as React.CSSProperties
      }
    >
      <section className="flex min-h-0 flex-col lg:overflow-hidden">{left}</section>
      <section className="flex min-h-0 flex-col lg:overflow-hidden">{center}</section>
      <section className="flex min-h-0 flex-col lg:overflow-hidden">{right}</section>
    </div>
  );
}
