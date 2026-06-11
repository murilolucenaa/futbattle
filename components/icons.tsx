// ============================================================
// FUTBATTLE — inline SVG icon set (replaces generic emojis)
// ============================================================

import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: P, children: React.ReactNode, viewBox = "0 0 24 24") {
  return (
    <svg
      width={size} height={size} viewBox={viewBox} fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden {...props}
    >
      {children}
    </svg>
  );
}

export const IconBall = (p: P) => base(p, (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2 8 10l1.5 4.6h5L16 10l-4-2.8Z" fill="currentColor" stroke="none" />
    <path d="M12 3v4.2M4.4 8.6 8 10m-3.3 7 4.8-2.4m5.6 6-.6-4.6M19.6 8.6 16 10m3.3 7-4.8-2.4M9.5 14.6 7 19m7.5-4.4L17 19" strokeWidth={1.2} />
  </>
));

export const IconTrophy = (p: P) => base(p, (
  <>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 5H4.5a0 0 0 0 0 0 0c0 3 1.2 4.6 2.9 5M17 5h2.5c0 3-1.2 4.6-2.9 5" />
    <path d="M12 14v3m-3.5 4h7l-.8-3.2a1 1 0 0 0-1-.8h-3.4a1 1 0 0 0-1 .8L8.5 21Z" />
  </>
));

export const IconWhistle = (p: P) => base(p, (
  <>
    <circle cx="9" cy="14" r="5" />
    <path d="M13.4 11.2 21 8.5V6H10.5a4.9 4.9 0 0 0-1.5.2" />
    <circle cx="9" cy="14" r="1.4" fill="currentColor" stroke="none" />
  </>
));

export const IconCard = ({ color = "#FFC53D", ...p }: P & { color?: string }) => base(p, (
  <rect x="7" y="4" width="10" height="15" rx="1.6" fill={color} stroke="rgba(0,0,0,0.4)" />
));

export const IconSub = (p: P) => base(p, (
  <>
    <path d="M7 4 3.5 7.5 7 11" stroke="#FF4D5E" />
    <path d="M3.5 7.5H14" stroke="#FF4D5E" />
    <path d="m17 13 3.5 3.5L17 20" stroke="#00FF87" />
    <path d="M20.5 16.5H10" stroke="#00FF87" />
  </>
));

export const IconAssist = (p: P) => base(p, (
  <>
    <path d="M4 18c5-1 9-4 12-9" />
    <path d="m13 6.5 3.4 2.6L19 5.4" />
    <circle cx="19.2" cy="17.5" r="2.6" />
  </>
));

export const IconGlove = (p: P) => base(p, (
  <>
    <path d="M8 21v-3.5L5.4 14a2 2 0 0 1 .4-2.8L8 13V6a1.6 1.6 0 0 1 3.2 0v4" />
    <path d="M11.2 10V4.6a1.6 1.6 0 0 1 3.2 0V10m0 0V5.8a1.6 1.6 0 0 1 3.2 0V12l1 2.5a4 4 0 0 1-1 4.5V21" />
  </>
));

export const IconStar = ({ filled = true, ...p }: P & { filled?: boolean }) => base(p, (
  <path
    d="m12 3.6 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8L12 3.6Z"
    fill={filled ? "currentColor" : "none"}
  />
));

export const IconStadium = (p: P) => base(p, (
  <>
    <ellipse cx="12" cy="14.5" rx="9" ry="4.5" />
    <path d="M3 14.5V11c1.8-2.6 5-4 9-4s7.2 1.4 9 4v3.5" />
    <rect x="9" y="12.6" width="6" height="3.6" rx="0.8" />
  </>
));

export const IconCrowd = (p: P) => base(p, (
  <>
    <circle cx="7" cy="8" r="2.4" />
    <circle cx="17" cy="8" r="2.4" />
    <circle cx="12" cy="6.4" r="2.6" />
    <path d="M3 19a4.5 4.5 0 0 1 6.5-4M21 19a4.5 4.5 0 0 0-6.5-4" />
    <path d="M7.5 19.5a4.7 4.7 0 0 1 9 0" />
  </>
));

export const IconSnow = (p: P) => base(p, (
  <>
    <path d="M12 3v18M5 6.5l14 11M19 6.5l-14 11" />
    <path d="M12 3 10 5m2-2 2 2M12 21l-2-2m2 2 2-2M5 6.5 7.7 7M5 6.5 5.4 9.2M19 17.5l-2.7-.5m2.7.5-.4-2.7M19 6.5 16.3 7m2.7-.5-.4 2.7M5 17.5l2.7-.5M5 17.5l.4-2.7" strokeWidth={1.2} />
  </>
));

export const IconChart = (p: P) => base(p, (
  <>
    <path d="M4 4v16h16" />
    <rect x="7.5" y="11" width="3" height="6" rx="0.6" fill="currentColor" stroke="none" />
    <rect x="12.5" y="7" width="3" height="10" rx="0.6" fill="currentColor" stroke="none" />
    <rect x="17.5" y="13" width="3" height="4" rx="0.6" fill="currentColor" stroke="none" />
  </>
));

export const IconShirt = ({ fill = "#00FF87", stroke = "rgba(255,255,255,0.5)", ...p }: P & { fill?: string; stroke?: string }) => base(p, (
  <path
    d="M8.4 3.5 4 6l1.6 4 2-.8V20.5h8.8V9.2l2 .8L20 6l-4.4-2.5a3.6 3.6 0 0 1-7.2 0Z"
    fill={fill} stroke={stroke}
  />
));

export const IconMic = (p: P) => base(p, (
  <>
    <rect x="9.4" y="3" width="5.2" height="10" rx="2.6" />
    <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21m-3.5 0h7" />
  </>
));

export const IconClipboard = (p: P) => base(p, (
  <>
    <rect x="5" y="4.5" width="14" height="17" rx="2" />
    <rect x="9" y="2.5" width="6" height="4" rx="1.2" />
    <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
  </>
));

export const IconArrow = (p: P) => base(p, (
  <path d="M5 12h14m-6-6 6 6-6 6" />
));

export const IconLock = (p: P) => base(p, (
  <>
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </>
));

export const IconWeather = ({ kind = "sun", ...p }: P & { kind?: "sun" | "clouds" | "rain" | "heat" | "night" }) => {
  if (kind === "sun" || kind === "heat") {
    return base(p, (
      <>
        <circle cx="12" cy="12" r="4.2" fill={kind === "heat" ? "#FF8A00" : "#FFC53D"} stroke="none" />
        <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" stroke={kind === "heat" ? "#FF8A00" : "#FFC53D"} />
      </>
    ));
  }
  if (kind === "night") {
    return base(p, <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" fill="#8FB0FF" stroke="none" />);
  }
  return base(p, (
    <>
      <path d="M7 15a4.5 4.5 0 1 1 .8-8.9A5.5 5.5 0 0 1 18 8.3 3.8 3.8 0 0 1 17.5 15H7Z" fill="#A9B8CC" stroke="none" />
      {kind === "rain" && <path d="m8.5 17-1 3M12.5 17l-1 3M16.5 17l-1 3" stroke="#4DA3FF" />}
    </>
  ));
};

export const IconDice = (p: P) => base(p, (
  <>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none" />
  </>
));

export const IconFlame = (p: P) => base(p, (
  <path d="M12 21c-3.9 0-6.5-2.5-6.5-6 0-2.6 1.6-4.4 3-6 .3 1.2 1 2 2 2.4C10.3 8.6 11 5.4 14 3c-.3 2.6.6 4 2 5.5 1.3 1.4 2.5 3 2.5 5.5 0 4.5-2.6 7-6.5 7Z" />
));
