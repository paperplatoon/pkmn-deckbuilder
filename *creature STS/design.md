
# **design.md – MVP GAME DESIGN DOCUMENT**

## 1. Core Concepts

### 1.1 Resource System

* One unified resource: **Energy**.
* Energy persists across turns.
* Any card may be played in two modes:

  * **Effect Mode:** resolve the card’s text.
  * **Energy Mode:** gain +1 energy (creature cards give +2).
* All used cards go to the discard pile.

### 1.2 Turn Structure

* Player draws 5 cards at the start of combat.
* No maximum hand size.
* End of turn: discard entire hand, then draw 5 cards.
* Deck reshuffles from discard when empty.

---

## 2. Player and Creatures

### 2.1 Player

* Player has HP that persists across combats.
* If all creatures are dead, enemies attack the player.
* Player block resets each turn.

### 2.2 Creatures

* Played via creature cards; summoning is free.
* Creature cards then go to discard and cycle like normal.
* Creatures have persistent HP across combats.
* If reduced to 0 HP, a creature cannot be summoned until healed (healing not included in MVP).
* Creatures have two actions:

  * **Attack:** cost 1 → deal 5.
  * **Defend:** cost 5 → block 5 (self only).
* Permanent buffs: increase stats for the entire run.
* Temporary buffs: apply for the current combat only.
* Creatures can be targeted by enemies.

---

## 3. Cards

### 3.1 Types

* **Creature Cards:** summon a creature or provide +2 energy.
* **Spell Cards:** effect mode or +1 energy mode.

### 3.2 Spell Examples

* 1 energy → deal 4.
* 1 energy → block 4 (player only).
* 1 energy → gain 2 strength (combat only).
* 1 energy → gain 2 dexterity (combat only).
* **Permanent Boost:**

  * Cost 2.
  * Once per combat.
  * Increase a creature’s attack stat by +2 permanently.
  * Card is removed for the remainder of the combat.

### 3.3 Scaling Rules

* Strength increases all player and creature damage.
* Dexterity increases player block.
* Creature block is unaffected by dexterity unless specified otherwise.

---

## 4. Energy Economy

### 4.1 Sources

* +1 energy from ordinary cards.
* +2 energy from creature cards.

### 4.2 Uses

* Activating creature actions.
* Paying spell costs.

### 4.3 Purpose

Enforces tradeoff each turn between immediate card effects and long-term energy accumulation.

---

## 5. Enemies

### 5.1 Encounter Setup

* Each combat contains 2–3 enemies.
* Enemies have reduced stats in MVP.

### 5.2 Behavior

* Enemies all act simultaneously.
* Each turn, an enemy chooses randomly between:

  * **Attack:** deal fixed damage.
  * **Block:** temporary block (resets next turn).
* Enemies target creatures first; if none alive, they target the player.

### 5.3 Rewards

Granted after the encounter ends:

* Enemy A: heal player 10.
* Enemy B: give 10 gold.
* Enemy C: add a card (cost 2 → permanently increase a creature’s attack by +1).

Card rewards go to the discard pile.

---

## 6. Combat Flow

1. Start combat with persistent HP values (player and creatures).
2. Draw 5 cards.
3. **Player turn:**

   * Play any number of cards.
   * Use cards for effects or energy.
   * Spend energy on creature actions.
4. End turn: discard hand → draw 5 cards.
5. **Enemy turn:** all enemies act.
6. Repeat until all enemies or player are dead.

---

## 7. Victory and Defeat

### 7.1 Victory

* Defeat all enemies; receive reward; run ends for MVP.

### 7.2 Defeat

* Player HP reaches 0.

---

## 8. Data Structures (MVP Outline)

### 8.1 Creature

```
id
name
max_hp
current_hp
attack_value
block_value
permanent_modifiers
temporary_modifiers
```

### 8.2 Card

```
id
type: spell | creature
cost
effect
energy_value (1 or 2)
once_per_combat: true/false
```

### 8.3 Player

```
hp
max_hp
strength
dexterity
energy
deck
discard
hand
creatures_owned
creatures_summoned
```

### 8.4 Enemy

```
id
hp
attack_value
block_value
behavior_pattern
```

---

## 9. MVP Scope

### In-Scope

* Complete combat loop.
* Creature summoning and actions.
* Persistent creature HP and permanent upgrades.
* Persistent player HP.
* Energy economy.
* Enemy actions (attack/block).
* End-of-combat rewards.
* Single encounter.

### Out-of-Scope

* Creature healing.
* Multi-combat runs.
* Complex enemy behaviors.
* Deck management UI.
* Leveling systems.
* Advanced card effects.

---

## 10. Win Condition

* Player defeats all enemies.
