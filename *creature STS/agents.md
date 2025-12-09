# **agents.md**

## Purpose

This file defines the coding conventions and architecture rules that all agents must follow when generating, modifying, or reasoning about code for this project. The full game logic, mechanics, and content are defined in `design.md`. This file does not duplicate that content; it only specifies *how* code must be written.

## Architecture Requirements

* Project must be implemented in **vanilla JavaScript**, runnable directly in a browser with no build tools.
* All logic must be **state-driven**.
* There must be a single authoritative **global state object** containing:

  * player, creatures, enemies, deck, discard, hand, energy, turn info, UI metadata.
* All functions must take `state` explicitly as a parameter.
* UI must be fully derived from state; no UI stores game logic.

## Rendering Model

* A single `render(state)` function re-renders all visible components anytime state changes.
* Rendering must be decomposed into small deterministic functions such as:

  * `renderPlayer(state)`
  * `renderCreatures(state)`
  * `renderEnemies(state)`
  * `renderHand(state)`
  * `renderEnergy(state)`
* Rendering functions are pure and never mutate state.

## Rendering/Layout Preferences

Adopt a responsive, component-based approach that mirrors prior projects (e.g., hs copy):

- DOM construction
  - Renderers create DOM nodes with `document.createElement` and append children; avoid large `innerHTML` strings except for simple inline content.
  - Build cards by composing elements (avatar, stats chips, moves column, footer) and attaching them to a card container.
  - Event binding uses delegation on stable parent containers to survive re-renders.
- Layout
  - Prefer flexbox (and CSS grid when helpful) with gaps for spacing; avoid per-pixel offsets and absolute positioning unless strictly necessary.
  - Use relative units (`rem`, `%`) and content-driven sizing to keep components responsive.
  - Keep styling in CSS classes (utility + component classes); JS only toggles classes and content.
- Card aesthetics (creatures and enemies)
  - Avatar: centered at the top inside a fixed-aspect (square) container; images use `object-fit: cover`.
  - Health badge: large red badge in the top-right of the card header.
    - Creature cards: badge reflects `maxHp` prominently (MVP request).
    - Enemy cards: may display current vs max (or follow creature format if specified by design).
  - Stat chips: render Strength (sword icon) and Dexterity (shield icon) only if their values are greater than 0; place prominently under the avatar.
    - Chips are styled purely via CSS (e.g., shapes/pseudo-elements), no inline images.
  - Moves: rendered as square tiles in a single column under the avatar.
    - Each move tile shows name, dynamic cost, and computed damage/block preview using `computeMove*` helpers.
    - Tiles are clickable only when playable (enough energy, not already used); disabled state is visual and semantic (disabled attribute where applicable).
- Dynamic text
  - Card and move text are functions (`text(state, card)` and `text(state, creature, move)`) that must call the central compute/preview helpers.
  - Do not hardcode numeric literals in render strings.
- Target indicators
  - Apply highlight classes to the selected friendly/enemy target; do not store logic in DOM attributes beyond data selectors.
  - Invalid targets must result in disabled controls rather than click-time rejection.

## Function Design Principles

* Functions must be **small**, **single-purpose**, and as **pure** as possible.
* Side effects occur only through explicit state mutations.
* All game effects must use a set of general-purpose primitives, including but not limited to:

  * `dealDamage(state, source, target, amount)`
  * `gainBlock(state, target, amount)`
  * `gainStrength(state, target, amount)`
  * `gainDexterity(state, target, amount)`
  * `addEnergy(state, amount)`
  * `summonCreature(state, creatureId)`
  * `applyPermanentBuff(state, creatureId, buff)`
* Cards must call these primitives and never implement bespoke logic inline.

## Modifier Handling

* All temporary or permanent modifiers must be applied inside the primitive functions.
* Example: `dealDamage()` computes final damage using base stats, strength, permanent boosts, and temporary buffs.
* This ensures that new cards or mechanics require minimal patching.

## Interaction Model

* User interactions must trigger small handlers that:

  1. Mutate state through primitive functions.
  2. Call `render(state)`.

## Source of Truth

* All mechanics, card types, creature rules, and combat flow are documented in `design.md`.
* Agents must treat that document as canonical for game logic.


## Instance-Driven Cards and Moves

To support dynamic modification and clean, state-driven behavior, all playable content is represented as instances with base values. Do not operate on bare IDs at runtime.

- CardInstance objects are stored in zones (not IDs):
  - `state.combat.deck: CardInstance[]`
  - `state.combat.hand: CardInstance[]`
  - `state.combat.discard: CardInstance[]`
- CardInstance shape (minimum):
  - Identity: `id` (unique per instance), `defId` (catalog key), `type: 'spell'|'creature'|'single-use'`
  - Base values (all modifiable): `baseCost`, `baseEnergyGain`, optional `baseDamage`, `baseBlock`, `baseSummonId`
  - Modifiers:
    - Persistent: `permMods` (persist across combats)
    - Temporary: `tempMods` (persist for fight/turn as appropriate)
  - Flags: `usedThisCombat?: boolean`, `exhaustsOnUse?: boolean` (for `type: 'single-use'`)
  - Text: `text(state, card): string` — dynamic card text using compute/preview helpers
  - Effect: `effect(state, card, ctx)` — resolves with primitives; no inline numbers

Note: `type: 'single-use'` means “exhaust for current combat”; the instance returns in future combats.

- Creatures and Moves:
  - Creature instances include both permanent and temporary stats: `strength`, `temporaryStrength`, `dexterity`, `temporaryDexterity`, plus base stats like `attack`, `blockStat`.
  - Creature definitions expose `moves: MoveDef[]`, where each `MoveDef` is data-only, e.g. `{ id, name, baseDamage?, baseBlock?, energy, text(state, creature, move) }`.
  - Move UI is dynamic and backed by compute helpers exactly like cards.


## Central Compute and Preview (Mandatory)

All numbers rendered or resolved must flow through centralized compute helpers so UI and effects stay in sync.

- Cards:
  - `computeCardCost(state, card)` → number
  - `computeCardEnergyGain(state, card)` → number
  - `computeCardDamage(state, card, sourceCtx)` → number
  - `computeCardBlock(state, card, targetCtx)` → number
- Moves:
  - `computeMoveCost(state, creature, move)` → number
  - `computeMoveDamage(state, creature, move)` → number
  - `computeMoveBlock(state, creature, move)` → number
- “Next” modifiers live in `state.modifiers` and are considered by compute/preview without consuming them:
  - Examples: `state.modifiers.nextCardDiscount[]`, `state.modifiers.nextAttackBonus[]`
  - Each modifier targets tags (e.g., `['attack']`, `['spell']`) and modifiers stack. Arithmetic should be deterministic (sum unless specified otherwise).
- Shared formatters for preview text (to be used by card/move `text`):
  - `showMonsterAttackDamage(value)` (and similar helpers) — returns formatted preview strings.


## Targeting, Playability, and UI Contracts

- Event handlers must pass zone + index to operate on live instances:
  - `onPlayCard({ zone: 'hand', index }, mode)` — lookup `state.combat.hand[index]` at click time.
- Buttons must be enabled/disabled via centralized guards:
  - `isPlayable(state, card)` — checks energy (`computeCardCost`), phase, flags (e.g., single-use used).
  - `isValidTarget(state, cardOrMove, target)` — selection legality; invalid targets are greyed out.
- Targeting is state-driven. Rendering reflects `state.ui` selection and never stores logic in the DOM.


## Modifier Lifecycle and Application

- Permanent modifiers:
  - Stored on card instances (`permMods`) and creatures (e.g., `strength`), and persist across combats.
- Temporary modifiers:
  - Stored as `tempMods` or dedicated temporary fields (e.g., `temporaryStrength`) and cleared per combat/turn by flow functions.
- Turn-/combat-scoped “next” effects:
  - Stored under `state.modifiers` as arrays of tagged modifiers. They stack and target tags.
  - Compute helpers read them for previews; consumption happens only during effect resolution.


## Primitives API (Contextual, No Inline Math)

Primitives only mutate state. They receive computed amounts and contextual metadata; they do not compute from definitions.

- Examples:
  - `dealDamage(state, { source, target, amount, via?: 'card'|'move', instanceId?: string })`
  - `gainBlock(state, { target, amount, via?, instanceId? })`
  - `addEnergy(state, amount)` / `spendEnergy(state, amount)`
  - `summonCreature(state, creatureId)`
- Card/move `effect` functions compute values via compute helpers, validate targets, then call primitives.


## Rendering Rules (Dynamic Text)

- Card UI must render from `card.text(state, card)` and `computeCardCost`/`computeCardEnergyGain`.
- Move UI must render from `move.text(state, creature, move)` and `computeMove*` helpers.
- Never hardcode numeric literals in renderers. All previews must call the same compute/preview helpers used by resolution.
