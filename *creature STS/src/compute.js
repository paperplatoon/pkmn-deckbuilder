"use strict";

// Centralized compute and preview helpers. Pure functions only.

function ensureModifiers(state) {
  state.modifiers = state.modifiers || {
    nextCardDiscount: 0,
    nextAttackExtraDamage: 0,
    nextBlockExtraBlock: 0,
    nextSpellCastsTwice: 0,
  };
  return state.modifiers;
}

function computeCardCost(state, card) {
  ensureModifiers(state);
  const base = (card.baseCost || 0) + (card.permMods?.cost || 0) + (card.tempMods?.cost || 0);
  const discount = state.modifiers.nextCardDiscount || 0;
  return Math.max(0, base - discount);
}

function computeCardEnergyGain(state, card) {
  const base = (card.baseEnergyGain != null ? card.baseEnergyGain : 0) + (card.permMods?.energyGain || 0) + (card.tempMods?.energyGain || 0);
  return Math.max(0, base);
}

function computeCardDamage(state, card, sourceCtx) {
  ensureModifiers(state);
  const base = (card.baseDamage || 0) + (card.permMods?.damage || 0) + (card.tempMods?.damage || 0);
  const bonusNext = state.modifiers.nextAttackExtraDamage || 0;
  // Source strength (creature only)
  let strength = 0;
  if (sourceCtx?.type === 'creature') {
    const c = sourceCtx.creature;
    strength = (c?.strength || 0) + (c?.temporaryStrength || 0);
  }
  return Math.max(0, base + strength + bonusNext);
}

function computeCardBlock(state, card, targetCtx) {
  ensureModifiers(state);
  const base = (card.baseBlock || 0) + (card.permMods?.block || 0) + (card.tempMods?.block || 0);
  const bonusNext = state.modifiers.nextBlockExtraBlock || 0;
  // Target dexterity (creature only)
  let dex = 0;
  if (targetCtx?.type === 'creature') {
    const c = targetCtx.creature;
    dex = (c?.dexterity || 0) + (c?.temporaryDexterity || 0);
  }
  return Math.max(0, base + dex + bonusNext);
}

function computeMoveCost(state, creature, move) {
  const base = (move.energy || 0) + (creature?.tempMods?.moveCost || 0);
  return Math.max(0, base);
}

function computeMoveDamage(state, creature, move) {
  ensureModifiers(state);
  const base = (move.baseDamage || 0) + (creature?.permMods?.attack || 0);
  const str = (creature?.strength || 0) + (creature?.temporaryStrength || 0);
  const next = state.modifiers.nextAttackExtraDamage || 0;
  return Math.max(0, base + str + next);
}

function computeMoveBlock(state, creature, move) {
  ensureModifiers(state);
  const base = (move.baseBlock || 0) + (creature?.permMods?.block || 0);
  const dex = (creature?.dexterity || 0) + (creature?.temporaryDexterity || 0);
  const next = state.modifiers.nextBlockExtraBlock || 0;
  return Math.max(0, (move.baseBlock || 0) + dex + next);
}

function isPlayable(state, card) {
  const cost = computeCardCost(state, card);
  const enoughEnergy = (state.player.energy | 0) >= cost;
  if (card.type === 'single-use' && card.usedThisCombat) return false;
  // Creature summon gating: only playable if summonable this turn
  if (card.type === 'creature') {
    return enoughEnergy && isSummonable(state, card);
  }
  return enoughEnergy;
}

function isValidTarget(state, card, target) {
  // Strength/Dex only valid on creatures
  if (card && card.tags?.includes?.('grantStrength')) return target?.type === 'creature';
  if (card && card.tags?.includes?.('grantDexterity')) return target?.type === 'creature';
  // Block can target player or creature
  if (card && card.tags?.includes?.('block')) return target && (target.type === 'player' || target.type === 'creature');
  // Damage must target alive enemy
  if (card && card.tags?.includes?.('damage')) {
    if (!target || target.type !== 'enemy') return false;
    const e = state.enemies[target.index];
    return Boolean(e && e.hp > 0);
  }
  return true;
}

function showMonsterAttackDamage(value) {
  return String(value);
}

// Export to global scope since we are vanilla JS modules in browser
// In this project, files are script-tagged; expose on window for simplicity
window.computeCardCost = computeCardCost;
window.computeCardEnergyGain = computeCardEnergyGain;
window.computeCardDamage = computeCardDamage;
window.computeCardBlock = computeCardBlock;
window.computeMoveCost = computeMoveCost;
window.computeMoveDamage = computeMoveDamage;
window.computeMoveBlock = computeMoveBlock;
window.isPlayable = isPlayable;
window.isValidTarget = isValidTarget;
window.showMonsterAttackDamage = showMonsterAttackDamage;

// Summoning rules helper
function isSummonable(state, card) {
  if (!card || card.type !== 'creature') return false;
  const turnGate = card.summonTurn || 1;
  if ((state.combat.turn.number | 0) < turnGate) return false;
  // Creature must exist and have HP > 0
  const id = card.baseSummonId || card.defId;
  const idx = state.creatures.findIndex(c => c.id === id);
  if (idx === -1) return false;
  const cr = state.creatures[idx];
  return cr.hp > 0;
}
window.isSummonable = isSummonable;

// Belt summoning helper by creature index
function isSummonableCreature(state, creatureIndex) {
  const def = state.catalogs.creatures[state.creatures[creatureIndex]?.id];
  const c = state.creatures[creatureIndex];
  if (!def || !c) return false;
  const gate = def.summonTurn || 1;
  if ((state.combat.turn.number | 0) < gate) return false;
  if (c.alive) return false;
  return c.hp > 0;
}
window.isSummonableCreature = isSummonableCreature;

// Valid drop targets for current aim
function getValidDropTargets(state) {
  const aim = state.ui.aim;
  if (!aim) return { enemies: false, creatures: false, energyWell: false };
  if (aim.kind === 'move') {
    if (aim.moveId === 'attack') return { enemies: true, creatures: false, energyWell: false };
    if (aim.moveId === 'defend') return { enemies: false, creatures: true, energyWell: false };
    return { enemies: false, creatures: false, energyWell: false };
  }
  if (aim.kind === 'card') {
    const card = state.combat.hand[aim.handIndex];
    if (!card) return { enemies: false, creatures: false, energyWell: false };
    const isDmg = !!(card.tags && card.tags.includes('damage'));
    const isBlock = !!(card.tags && card.tags.includes('block'));
    const isBuff = !!(card.tags && (card.tags.includes('grantStrength') || card.tags.includes('grantDexterity') || card.tags.includes('buff')));
    return {
      enemies: isDmg,
      creatures: isBlock || isBuff,
      energyWell: true,
    };
  }
  return { enemies: false, creatures: false, energyWell: false };
}
window.getValidDropTargets = getValidDropTargets;
