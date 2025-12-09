"use strict";

// Turn/Deck flow: shuffle, draw, discard, and combat setup.

function shuffleInPlace(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = state.rng.range(0, i);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function shuffleDeck(state) {
  shuffleInPlace(state, state.combat.deck);
  log(state, "Shuffled deck.");
}

function shuffleDiscardIntoDeck(state) {
  if (state.combat.discard.length === 0) return;
  while (state.combat.discard.length) {
    state.combat.deck.push(state.combat.discard.pop());
  }
  shuffleDeck(state);
  log(state, "Reshuffled discard into deck.");
}

function ensureDeckHasCards(state, need) {
  if (state.combat.deck.length >= need) return;
  if (state.combat.discard.length > 0) {
    shuffleDiscardIntoDeck(state);
  }
}

function draw(state, n) {
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (state.combat.deck.length === 0) {
      if (state.combat.discard.length === 0) break;
      shuffleDiscardIntoDeck(state);
    }
    const card = state.combat.deck.pop();
    if (!card) break;
    state.combat.hand.push(card);
    drawn++;
  }
  log(state, `Drew ${drawn} card(s).`);
}

function discardHand(state) {
  const { hand, discard } = state.combat;
  const count = hand.length;
  while (hand.length) discard.push(hand.pop());
  log(state, `Discarded ${count} card(s) from hand.`);
}

function clearAllBlocks(state) {
  state.player.block = 0;
  for (const c of state.creatures) c.block = 0;
  for (const e of state.enemies) e.block = 0;
}

function makeEnemyInstance(state, enemyDefId) {
  const def = state.catalogs.enemies[enemyDefId];
  return {
    id: def.id,
    name: def.name,
    maxHp: def.maxHp,
    hp: def.maxHp,
    attackValue: def.attackValue,
    blockValue: def.blockValue,
    block: 0,
    intent: null,
  };
}

function seedEncounter(state) {
  const count = state.rng.range(2, 3);
  const arr = [];
  for (let i = 0; i < count; i++) arr.push(makeEnemyInstance(state, "GRUNT"));
  state.enemies = arr;
}

function resetCreaturesForCombat(state) {
  for (const c of state.creatures) {
    c.block = 0;
    c.alive = false; // must be summoned again each combat
    // HP persists per design
    c.temporaryStrength = 0;
    c.temporaryDexterity = 0;
  }
}

function startCombat(state) {
  // Fresh combat state but persistent player/creatures remain.
  state.combat = createEmptyCombatState();
  seedStartingDeck(state); // use player deck; starting deck for MVP
  shuffleDeck(state);

  // Turn + phase
  state.combat.turn.number = 1;
  setPhase(state, "player");

  // Enemies & blocks
  seedEncounter(state);
  clearAllBlocks(state);
  resetCreaturesForCombat(state);

  // Draw opening hand
  // Bring all creature summon cards into opening hand
  bringCreaturesToHand(state);
  draw(state, 5);
  // Set default targets
  state.ui.friendlyTarget = { type: 'player' };
  const firstEnemy = state.enemies.findIndex(e => e.hp > 0);
  state.ui.enemyTarget = { index: Math.max(0, firstEnemy) };
  planEnemyIntents(state);
  resetCreatureMovesForTurn(state);
  log(state, "Combat started. Player turn 1.");
}

function endPlayerTurn(state) {
  if (state.combat.turn.phase !== "player") return;
  discardHand(state);
  draw(state, 5);
  setPhase(state, "enemy");
  log(state, "End turn → Enemy phase");
}

function anyAliveCreatures(state) {
  return state.creatures.some(c => c.alive && c.hp > 0);
}

function chooseEnemyTarget(state) {
  // Prefer a random alive creature; else player
  const aliveIdxs = state.creatures.map((c, i) => (c.alive && c.hp > 0 ? i : -1)).filter(i => i !== -1);
  if (aliveIdxs.length) {
    const pick = aliveIdxs[state.rng.range(0, aliveIdxs.length - 1)];
    return { type: "creature", index: pick };
  }
  return { type: "player" };
}

function planEnemyIntents(state) {
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0) { e.intent = null; continue; }
    const doAttack = state.rng.range(0, 1) === 0; // 50/50
    if (doAttack) {
      const target = chooseEnemyTarget(state);
      e.intent = { type: 'attack', amount: e.attackValue, target };
      const tLabel = target.type === 'player' ? 'Player' : state.creatures[target.index].name;
      log(state, `${e.name} plans Attack ${e.attackValue} → ${tLabel}.`);
    } else {
      e.intent = { type: 'block', amount: e.blockValue };
      log(state, `${e.name} plans Block ${e.blockValue}.`);
    }
  }
}

function resolvePlannedEnemyActions(state) {
  // Simultaneous resolution using planned intents
  const attacks = [];
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0 || !e.intent) continue;
    if (e.intent.type === 'block') {
      gainBlock(state, { target: { type: 'enemy', index: i }, amount: e.intent.amount });
      log(state, `${e.name} blocks for ${e.intent.amount}.`);
    } else if (e.intent.type === 'attack') {
      let t = e.intent.target;
      const needsCreature = anyAliveCreatures(state);
      // Retarget if invalid creature, or if player is targeted while a creature exists
      const creatureInvalid = t && t.type === 'creature' && (!state.creatures[t.index] || !state.creatures[t.index].alive || state.creatures[t.index].hp <= 0);
      const playerShouldBeRedirected = t && t.type === 'player' && needsCreature;
      if (!t || creatureInvalid || playerShouldBeRedirected) {
        t = chooseEnemyTarget(state);
        const tLabel = t.type === 'player' ? 'Player' : state.creatures[t.index].name;
        log(state, `${e.name} retargets → ${tLabel}.`);
      }
      attacks.push({ target: t, amount: e.intent.amount });
    }
  }
  // Aggregate per target
  const byKey = new Map();
  for (const a of attacks) {
    const key = a.target.type + (a.target.index != null ? `:${a.target.index}` : '');
    byKey.set(key, (byKey.get(key) || 0) + a.amount);
  }
  for (const [key, total] of byKey.entries()) {
    let target;
    if (key.startsWith('creature')) {
      const idx = parseInt(key.split(':')[1], 10);
      target = { type: 'creature', index: idx };
    } else {
      target = { type: 'player' };
    }
    dealDamage(state, { source: { type: 'enemy' }, target, amount: total });
    const label = target.type === 'player' ? 'Player' : state.creatures[target.index].name;
    log(state, `Enemies deal ${total} to ${label}.`);
  }
  // Clear intents after resolution
  for (const e of state.enemies) if (e) e.intent = null;
}

function rollEnemyIntents(state) {
  for (const e of state.enemies) {
    if (e.hp <= 0) { e.intent = null; continue; }
    e.intent = (state.rng.range(0, 1) === 0) ? "attack" : "block";
  }
}

function resolveEnemyActions(state) {
  // Simultaneous: sum damage per target, then apply.
  const attacks = [];
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0) continue;
    if (e.intent === "block") {
      gainBlock(state, { target: { type: "enemy", index: i }, amount: e.blockValue });
      log(state, `${e.name} blocks for ${e.blockValue}.`);
    } else if (e.intent === "attack") {
      const target = chooseEnemyTarget(state);
      attacks.push({ target, amount: e.attackValue, enemyName: e.name });
    }
  }
  // Aggregate per target
  const byKey = new Map();
  for (const a of attacks) {
    const key = a.target.type + (a.target.index != null ? `:${a.target.index}` : "");
    byKey.set(key, (byKey.get(key) || 0) + a.amount);
  }
  for (const [key, total] of byKey.entries()) {
    let target;
    if (key.startsWith("creature")) {
      const idx = parseInt(key.split(":")[1], 10);
      target = { type: "creature", index: idx };
    } else {
      target = { type: "player" };
    }
    dealDamage(state, { source: { type: "enemy" }, target, amount: total });
    const label = target.type === "player" ? "Player" : state.creatures[target.index].name;
    log(state, `Enemies deal ${total} to ${label}.`);
  }
}

function pruneDead(state) {
  for (const e of state.enemies) if (e.hp <= 0) e.intent = null;
}

function checkVictoryDefeat(state) {
  const allDead = state.enemies.every(e => e.hp <= 0);
  if (allDead) {
    setPhase(state, "victory");
    log(state, "Victory! Rewards granted (MVP stub). Run ends.");
    return true;
  }
  if (state.player.hp <= 0) {
    setPhase(state, "defeat");
    log(state, "Defeat. Run ends.");
    return true;
  }
  return false;
}

function enemyTurn(state) {
  if (state.combat.turn.phase !== "enemy") return;
  resolvePlannedEnemyActions(state);
  pruneDead(state);
  ensureValidTargets(state);
  resetEnemyBlock(state);
  if (checkVictoryDefeat(state)) return;
  // Next player turn
  state.combat.turn.number += 1;
  resetTeamBlock(state);
  setPhase(state, "player");
  resetCreatureMovesForTurn(state);
  log(state, `Player turn ${state.combat.turn.number}.`);
  planEnemyIntents(state);
}

function ensureValidTargets(state) {
  // Friendly target
  if (state.ui.friendlyTarget?.type === 'creature') {
    const i = state.ui.friendlyTarget.index;
    const c = state.creatures[i];
    if (!c || c.hp <= 0) state.ui.friendlyTarget = { type: 'player' };
  }
  // Enemy target
  const t = state.ui.enemyTarget;
  if (!t || !state.enemies[t.index] || state.enemies[t.index].hp <= 0) {
    const idx = state.enemies.findIndex(e => e && e.hp > 0);
    if (idx >= 0) state.ui.enemyTarget = { index: idx };
  }
}

function bringCreaturesToHand(state) {
  const deck = state.combat.deck;
  for (let i = deck.length - 1; i >= 0; i--) {
    const c = deck[i];
    if (c && c.type === 'creature') {
      state.combat.hand.push(c);
      deck.splice(i, 1);
    }
  }
}

function resetCreatureMovesForTurn(state) {
  for (const c of state.creatures) c.movedThisTurn = false;
}

function performCreatureAction(state, creatureIndex, actionId) {
  if (state.combat.turn.phase !== 'player') { log(state, 'Not your turn.'); return false; }
  const c = state.creatures[creatureIndex];
  if (!c) return false;
  if (!c.alive || c.hp <= 0) { log(state, 'Creature must be summoned and alive.'); return false; }
  if (c.movedThisTurn) { log(state, `${c.name} has already moved this turn.`); return false; }
  const def = state.catalogs.creatures[c.id];
  const act = def.moves.find(a => a.id === actionId);
  if (!act) return false;
  // Validate targets before spending
  if (actionId === 'attack') {
    const t = state.ui.enemyTarget;
    if (!t || !state.enemies[t.index] || state.enemies[t.index].hp <= 0) { log(state, 'No valid enemy target.'); return false; }
  }
  const moveCost = computeMoveCost(state, c, act);
  if (!spendEnergy(state, moveCost)) { log(state, 'Not enough energy for move.'); return false; }

  if (actionId === 'attack') {
    const t = state.ui.enemyTarget;
    const dmg = computeMoveDamage(state, c, act);
    dealDamage(state, { source: { type: 'creature', index: creatureIndex }, target: { type: 'enemy', index: t.index }, amount: dmg });
    log(state, `${c.name} attacks ${state.enemies[t.index].name} for ${dmg}.`);
    if (state.modifiers?.nextAttackExtraDamage > 0) state.modifiers.nextAttackExtraDamage = 0;
  } else if (actionId === 'defend') {
    const block = computeMoveBlock(state, c, act);
    gainBlock(state, { target: { type: 'creature', index: creatureIndex }, amount: block });
    log(state, `${c.name} defends for ${block}.`);
    if (state.modifiers?.nextBlockExtraBlock > 0) state.modifiers.nextBlockExtraBlock = 0;
  }
  c.movedThisTurn = true;
  return true;
}
