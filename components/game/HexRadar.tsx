"use client";

import { motion } from "framer-motion";

interface HexRadarProps {
  /** Six values, 0–100, clockwise from top. */
  values: [number, number, number, number, number, number];
  labels?: [string, string, string, string, string, string];
  size?: number;
  color?: string;
}

const DEFAULT_LABELS: [string, string, string, string, string, string] = ["ATA", "VEL", "PAS", "DEF", "FIS", "TEC"];

function hexPoint(cx: number, cy: number, r: number, i: number): [number, number] {
  const angle = (Math.PI / 3) * i - Math.PI / 2; // start at top, clockwise
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

/** PES-style animated hexagonal attribute radar (pure SVG). */
export default function HexRadar({ values, labels = DEFAULT_LABELS, size = 200, color = "var(--accent)" }: HexRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size * 0.36;

  const ring = (r: number) =>
    Array.from({ length: 6 }, (_, i) => hexPoint(cx, cy, r, i).join(",")).join(" ");

  const dataPoints = values
    .map((v, i) => hexPoint(cx, cy, rMax * Math.max(0.08, Math.min(100, v) / 100), i).join(","))
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar de atributos">
      {/* grid rings */}
      {[1, 0.75, 0.5, 0.25].map((f) => (
        <polygon key={f} points={ring(rMax * f)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={f === 1 ? 1.5 : 1} />
      ))}
      {/* spokes */}
      {Array.from({ length: 6 }, (_, i) => {
        const [x, y] = hexPoint(cx, cy, rMax, i);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />;
      })}
      {/* animated data polygon */}
      <motion.polygon
        key={values.join("-")}
        points={dataPoints}
        fill={color}
        fillOpacity={0.22}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* vertex dots */}
      {values.map((v, i) => {
        const [x, y] = hexPoint(cx, cy, rMax * Math.max(0.08, v / 100), i);
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />;
      })}
      {/* labels + values */}
      {labels.map((label, i) => {
        const [x, y] = hexPoint(cx, cy, rMax + size * 0.085, i);
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={size * 0.052}
            fontWeight={700}
            letterSpacing="0.08em"
            fill="rgba(255,255,255,0.75)"
          >
            {label}
            <tspan x={x} dy={size * 0.055} fill={color} fontSize={size * 0.05}>
              {Math.round(values[i])}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
