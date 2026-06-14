import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // eslint-plugin-react-hooks v7 ships React-Compiler-era rules that flag
    // patterns this codebase uses on purpose: the `mounted` hydration guard
    // for zustand+persist (set-state-in-effect) and refs that hold the latest
    // props for the imperative 60Hz match loop (refs). Keep them visible as
    // warnings instead of blocking — they are tracked debt, not bugs.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
