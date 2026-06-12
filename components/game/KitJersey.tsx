"use client";

import { useId } from "react";

/**
 * Chunky football jersey in the "Fliperama da Copa" language: thick ink
 * outline, flat fills, hard offset shadow. The body is filled with a chosen
 * `pattern` built from the primary (base) + secondary (accent) colors;
 * collar + sleeves stay secondary as trim.
 *
 * The match engine only paints `colors[0]` on the pitch dots, so the pattern
 * is purely cosmetic for the kit-design screen.
 */
const INK = "#141512";

export type KitPattern =
  | "solid" | "vstripe" | "hoops" | "sash" | "band"
  | "halves" | "pin" | "check" | "chevron" | "quarters";

export const PATTERNS: { id: KitPattern; label: string }[] = [
  { id: "solid", label: "Liso" },
  { id: "vstripe", label: "Listras" },
  { id: "hoops", label: "Anéis" },
  { id: "sash", label: "Faixa" },
  { id: "band", label: "Banda" },
  { id: "halves", label: "Metades" },
  { id: "pin", label: "Riscas" },
  { id: "check", label: "Xadrez" },
  { id: "chevron", label: "Seta" },
  { id: "quarters", label: "Quadrantes" },
];

// Body silhouette — reused for the clip and the crisp ink outline on top.
const BODY_D =
  "M40 24 C48 16 72 16 80 24 L85 46 L83 116 C83 121 80 123 76 123 L44 123 C40 123 37 121 37 116 L35 46 Z";

/** Pattern marks drawn inside the body clip, over a primary base rect. */
function patternMarks(pattern: KitPattern, sec: string) {
  const r = (x: number, y: number, w: number, h: number, extra: object = {}) => (
    <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} fill={sec} {...extra} />
  );
  switch (pattern) {
    case "vstripe":
      return [0, 1, 2, 3].map((i) => r(38 + i * 14, 14, 7, 114));
    case "pin":
      return [0, 1, 2, 3, 4, 5, 6].map((i) => r(34 + i * 8, 14, 2.4, 114));
    case "hoops":
      return [0, 1, 2, 3, 4].map((i) => r(30, 22 + i * 22, 60, 9));
    case "sash":
      return [r(8, 60, 104, 17, { transform: "rotate(-33 60 70)" })];
    case "band":
      return [r(52, 14, 16, 114)];
    case "halves":
      return [r(60, 14, 32, 114)];
    case "quarters":
      return [r(60, 14, 32, 57), r(30, 71, 30, 57)];
    case "chevron":
      return [
        <path key="cv1" d="M30 56 L60 74 L90 56 L90 70 L60 88 L30 70 Z" fill={sec} />,
        <path key="cv2" d="M30 90 L60 108 L90 90 L90 102 L60 120 L30 102 Z" fill={sec} />,
      ];
    case "check": {
      const out = [];
      for (let cx = 0; cx < 7; cx++)
        for (let cy = 0; cy < 12; cy++)
          if ((cx + cy) % 2 === 0) out.push(r(30 + cx * 9, 14 + cy * 10, 9, 10));
      return out;
    }
    default:
      return [];
  }
}

export default function KitJersey({
  primary,
  secondary,
  pattern = "solid",
  className = "",
}: {
  primary: string;
  secondary: string;
  pattern?: KitPattern;
  className?: string;
}) {
  const clipId = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 120 132"
      className={className}
      style={{ filter: "drop-shadow(4px 5px 0 rgba(20,21,18,0.9))" }}
      role="img"
      aria-label="Camisa da seleção"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BODY_D} />
        </clipPath>
      </defs>

      {/* sleeves (secondary) — drawn first so the body overlaps the inner edge */}
      <path
        d="M40 24 L13 35 L7 60 L31 66 L46 42 Z"
        fill={secondary} stroke={INK} strokeWidth={4} strokeLinejoin="round"
      />
      <path
        d="M80 24 L107 35 L113 60 L89 66 L74 42 Z"
        fill={secondary} stroke={INK} strokeWidth={4} strokeLinejoin="round"
      />

      {/* body fill: primary base + pattern marks, clipped to the silhouette */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="28" y="12" width="64" height="118" fill={primary} />
        {patternMarks(pattern, secondary)}
      </g>
      {/* crisp ink outline on top of the pattern */}
      <path d={BODY_D} fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />

      {/* collar (secondary V-band) */}
      <path
        d="M49 21 C55 33 65 33 71 21 L66 18 C62 26 58 26 54 18 Z"
        fill={secondary} stroke={INK} strokeWidth={4} strokeLinejoin="round"
      />
    </svg>
  );
}
