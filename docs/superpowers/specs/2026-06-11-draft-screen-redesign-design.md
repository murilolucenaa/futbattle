# CONVOCAÇÃO (draft) screen redesign

## Problem

Current `DraftView` (`app/squad/page.tsx`) reads like a SaaS dashboard, not a game:

- 2-column layout (pitch left, sorteio panel right); page **scrolls** at 1366×768.
- The dice/sorteio panel is oversized and isolated.
- The drawn squad's player list lives in a separate place from progress.
- **Three** post-draw buttons confuse: "Roda o dado", "Mudar geração" (permanently
  disabled with no explanation), "Outra seleção".

Density reference: 7a0.com.br — everything visible at once, no scroll.

## Goal

Rebuild the draft screen as a single 100dvh, no-page-scroll, 3-column game screen
using new reusable design-system components. Simulation logic stays untouched.

## Non-negotiable separation

Game logic is **not** modified: `lib/game/store.ts` draft actions (`setDraftDraw`,
`spendReroll`, `fillSlot`, `fillBench`, `grantBenchBonus`), `lib/game/rules.ts`
(`drawSquad`, `squadPower`), `lib/game/formations.ts`. Only `DraftView` (presentation)
is rewritten; `ManageView` is left as-is. The sole data change to the store is a
**cosmetic** `squadName` field.

## New design-system components

### `components/game/GameShell.tsx`
3-column layout, `h-[100dvh] overflow-hidden`. Props: `left`, `center`, `right`
(ReactNode). Desktop grid `[360px_minmax(0,1fr)_320px]`; each column owns its own
internal scroll. Stacks vertically on mobile (graceful fallback; target is 1366×768
desktop). Added to `/styleguide`.

### `components/game/PlayerChip.tsx`
A pitch slot. Encapsulates the markup currently inlined inside `<Pitch>`.
- `variant="empty"` — states: `open` (lima, calling), `dim` (grey, incompatible),
  `idle` (dashed). Shows the position short label.
- `variant="filled"` — OVR badge + nation flag + `shortName`, **stamp** animation
  (`scale 1.2 → 1`), plays `card.reveal` on fill (`card.reveal.legendary` if OVR ≥ 88).
Added to `/styleguide`.

## DraftView layout (3 columns)

### LEFT — sorteio panel (flex column, full height)
- Fixed top: `N GIROS` counter, always visible.
- **State A** (nothing drawn, or current draw already used): compact dice card +
  primary button **RODA O DADO**. Nothing else. The free post-placement roll returns
  here (it is always free in State A: first spin or just-placed).
- **State B** (squad drawn, not yet used): squad header
  (`🏴 Tchecoslováquia 1962 · Média 85`) + scrollable player list with internal scroll.
  Each row is a 7a0-style line: PosChip · name · OVR. Hover plays `ui.move`.
  - Click a player → highlight the fitting open slots on the pitch.
  - Click a highlighted slot (choose position) **or** click the row again →
    confirm into the first free compatible slot.
- **Fixed footer** with **exactly two** secondary actions:
  - `OUTRA SELEÇÃO · −1 giro` → `roll()` (another nation).
  - `OUTRA ÉPOCA · −1 giro` → `rollGeneration()` (same nation, another year).
  - "Mudar geração" disappears as a separate concept.
  - **`OUTRA ÉPOCA` is hidden** (never disabled) when the squad has only one era in
    the dataset (`genPool` empty).
  - When **giros = 0**, both disappear and the text reads
    "Giros esgotados — fecha os 11, mister."
  - `deadSquad` (no usable player) keeps the existing free re-roll behaviour.
- Dice roll animation: 1.2s shake + flickering faces **inside the dice card**, no
  modal (reuses existing `runSpin`).

### CENTER — pitch
- Formation selector: a **single** horizontal row of compact chips, horizontal scroll
  if needed. Never two rows.
- Pitch scales by height (aspect 3/4); slots rendered with `PlayerChip`.

### RIGHT — box score
- Editable `squadName` input (fallback `Seleção {coachName}`).
- **FORÇA / ATA / MEI / DEF** as big Anton numbers (reuses `sectorOvr` / team OVR).
- Vertical list of the 11 slots (GOL, LD, ZAG…): `—` or name+rating, with `7/11`
  progress visible the whole time.
- Bench (4 slots) compact at the bottom.
- On `allDone`, the LEFT panel becomes the **Fechar convocação** CTA (`completeDraft`).

## Store change

Add optional cosmetic `squadName` to `CareerState` + `setSquadName` action.
Bump persist `version: 3 → 4` with a shallow `migrate` that tolerates the new field.
Right-column name input edits `squadName`; displays fall back to `Seleção {coachName}`.

## Sounds

`dado.roll` on roll, `ui.move` on list hover, `card.reveal` (/`.legendary` if OVR ≥ 88)
on confirm. Ensure `card.reveal.legendary` exists in `src/audio/manifest.json`; if not,
add it and regenerate the placeholder.

## Files

- NEW `components/game/GameShell.tsx`
- NEW `components/game/PlayerChip.tsx`
- `~ app/squad/page.tsx` — rewrite `DraftView` (ManageView untouched)
- `~ lib/game/store.ts` — `squadName` + `setSquadName` + migrate v4
- `~ app/styleguide/page.tsx` — GameShell + PlayerChip demo
- `~ src/audio/manifest.json` — ensure `card.reveal.legendary`

## Acceptance criteria

- [ ] Zero page scroll at 1366×768; only the player list scrolls internally.
- [ ] Post-draw there are only 2 re-roll actions, and "Outra época" hides when N/A.
- [ ] The 11 + bench can be filled without ever losing sight of progress (right column).
- [ ] Full flow works with sounds.

## Verification

`npx tsc --noEmit` + `npm run build` + `npm test` (logic untouched). Manual: Playwright
screenshot at 1366×768 → confirm no page scroll + walk the 4 acceptance criteria.
