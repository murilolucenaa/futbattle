import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "var(--bg)",
        surface: "var(--surface)",
        surf2:   "var(--surf-2)",
        border:  "var(--border)",
        text:    "var(--text)",
        muted:   "var(--muted)",
        green:   "var(--green)",
        greend:  "var(--green-d)",
        orange:  "var(--orange)",
        gold:    "var(--gold)",
        roxo:    "var(--roxo)",
        red:     "var(--red)",
      },
      fontFamily: {
        display: ["var(--font-anton)", "sans-serif"],
        sans:    ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
