"use client";

import type { ReactNode } from "react";

/**
 * Vertical pitch (own goal at bottom). Children are absolutely positioned
 * by the caller using % coordinates.
 * Convert formation coords with: left = `${y}%`, bottom = `${x}%`.
 */
export default function Pitch({
  children,
  className = "",
  horizontal = false,
}: {
  children: ReactNode;
  className?: string;
  horizontal?: boolean;
}) {
  return (
    <div className={`pitch relative rounded-2xl overflow-hidden ${className}`}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {horizontal ? (
          <>
            <rect x="1" y="1" width="98" height="98" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            <line x1="50" y1="1" x2="50" y2="99" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            <circle cx="50" cy="50" r="10" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            {/* left box */}
            <rect x="1" y="24" width="14" height="52" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            <rect x="1" y="38" width="5" height="24" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            {/* right box */}
            <rect x="85" y="24" width="14" height="52" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            <rect x="94" y="38" width="5" height="24" className="pitch-lines" vectorEffect="non-scaling-stroke" />
          </>
        ) : (
          <>
            <rect x="1" y="1" width="98" height="98" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            <line x1="1" y1="50" x2="99" y2="50" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            <circle cx="50" cy="50" r="10" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            {/* bottom box (own goal) */}
            <rect x="24" y="85" width="52" height="14" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            <rect x="38" y="94" width="24" height="5" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            {/* top box */}
            <rect x="24" y="1" width="52" height="14" className="pitch-lines" vectorEffect="non-scaling-stroke" />
            <rect x="38" y="1" width="24" height="5" className="pitch-lines" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {children}
    </div>
  );
}
