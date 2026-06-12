// Dev helper: synthesize a persisted career (2026 squad + cup drawn) so the
// match screen can be verified without clicking through the whole draft.
// Usage: npx tsx scripts/gen-verify-state.ts > /tmp/futbattle-state.json
import { useCareer } from "../lib/game/store";

const s = useCareer.getState();
s.newCareer2026("Verificador", "bra-2026");
useCareer.getState().startCup();
const state = useCareer.getState();
process.stdout.write(JSON.stringify({ state, version: 4 }));
