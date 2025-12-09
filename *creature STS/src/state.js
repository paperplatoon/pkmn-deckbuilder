"use strict";

// State and catalogs scaffolding. All functions take `state` explicitly.

function makeRng(seed) {
  // Simple LCG for deterministic tests
  let s = (seed >>> 0) || 123456789;
  return {
    next() {
      s = (1664525 * s + 1013904223) >>> 0;
      return s;
    },
    range(min, max) {
      const n = this.next() / 0xffffffff;
      return Math.floor(min + n * (max - min + 1));
    },
    get seed() { return s; },
  };
}

function createEmptyCombatState() {
  return {
    deck: [],
    discard: [],
    hand: [],
    turn: { number: 0, phase: "player" },
    playedThisCombat: {},
  };
}

function baseCatalogs() {
  // Minimal catalog placeholders; effects wired later in cards/primitives.
  const cards = {}; // definitions moved to src/cards.js

  const creatures = {
    CREATURE_A: {
      id: "CREATURE_A",
      name: "Vanguard",
      maxHp: 20,
      baseAttack: 5,
      baseBlock: 5,
      summonTurn: 1,
      moves: [
        { id: "attack", name: "Attack", energy: 1, baseDamage: 5, text: (state, creature, move) => `Attack ${computeMoveDamage(state, creature, move)}` },
        { id: "defend", name: "Defend", energy: 1, baseBlock: 5, text: (state, creature, move) => `Block ${computeMoveBlock(state, creature, move)}` },
      ],
    },
    CREATURE_B: {
      id: "CREATURE_B",
      name: "Bulwark",
      maxHp: 22,
      baseAttack: 16,
      baseBlock: 8,
      summonTurn: 2,
      moves: [
        { id: "defend", name: "Defend", energy: 1, baseBlock: 8, text: (state, creature, move) => `Block ${computeMoveBlock(state, creature, move)}` },
        { id: "attack", name: "Heavy Strike", energy: 2, baseDamage: 16, text: (state, creature, move) => `Attack ${computeMoveDamage(state, creature, move)}` },
      ],
    },
  };

  const enemies = {
    GRUNT: {
      id: "GRUNT",
      name: "Grunt",
      maxHp: 12,
      attackValue: 4,
      blockValue: 4,
    },
  };

  return { cards, creatures, enemies };
}

function createInitialState() {
  const catalogs = baseCatalogs();
  const rng = makeRng(Date.now());

  const state = {
    player: {
      maxHp: 50,
      hp: 50,
      strength: 0, // player cannot gain str/dex per updated rules
      dexterity: 0,
      energy: 0,
      block: 0,
      gold: 0,
    },
    creatures: [
      {
        id: "CREATURE_A",
        name: catalogs.creatures.CREATURE_A.name,
        maxHp: catalogs.creatures.CREATURE_A.maxHp,
        hp: catalogs.creatures.CREATURE_A.maxHp,
        attack: catalogs.creatures.CREATURE_A.baseAttack,
        blockStat: catalogs.creatures.CREATURE_A.baseBlock,
        strength: 0,
        dexterity: 0,
        permMods: { attack: 0, block: 0 },
        tempMods: {},
        block: 0,
        alive: false,
        movedThisTurn: false,
      },
      {
        id: "CREATURE_B",
        name: catalogs.creatures.CREATURE_B.name,
        maxHp: catalogs.creatures.CREATURE_B.maxHp,
        hp: catalogs.creatures.CREATURE_B.maxHp,
        attack: catalogs.creatures.CREATURE_B.baseAttack,
        blockStat: catalogs.creatures.CREATURE_B.baseBlock,
        strength: 0,
        dexterity: 0,
        permMods: { attack: 0, block: 0 },
        tempMods: {},
        block: 0,
        alive: false,
        movedThisTurn: false,
      },
    ],
    enemies: [],
    combat: createEmptyCombatState(),
    catalogs,
    rng,
    ui: {
      selectedCardId: null,
      selectedMode: "effect",
      selectedCreatureId: null,
      log: [],
      friendlyTarget: { type: "player" },
      enemyTarget: { index: 0 },
      beltHoverIndex: null,
      aim: null,
      pointer: null,
    },
    modifiers: {
      nextCardDiscount: 0,
      nextAttackExtraDamage: 0,
      nextBlockExtraBlock: 0,
      nextSpellCastsTwice: 0,
    },
  };

  // Deck is now seeded by cards.js helper which creates instances
  // seedStartingDeck(state) is called by startCombat()

  return state;
}

// seedStartingDeck moved to cards.js

function pushMany(arr, value, times) {
  for (let i = 0; i < times; i++) arr.push(value);
}

// Logging utility (pure state mutation)
function log(state, message) {
  state.ui.log.push(String(message));
}
