"use strict";

// Core primitives. All state mutations flow through these.

function addEnergy(state, amount) {
  state.player.energy += Math.max(0, amount|0);
}

function spendEnergy(state, amount) {
  const cost = Math.max(0, amount|0);
  if (state.player.energy < cost) return false;
  state.player.energy -= cost;
  return true;
}

function setPhase(state, phase) {
  state.combat.turn.phase = phase;
}

function entityFromSpec(state, spec) {
  if (!spec) return null;
  if (spec.type === "player") return state.player;
  if (spec.type === "enemy") return state.enemies[spec.index|0] || null;
  if (spec.type === "creature") return state.creatures[spec.index|0] || null;
  return null;
}

function effectiveStrength(state, sourceSpec) {
  // Only creatures have strength per updated rule.
  if (!sourceSpec) return 0;
  if (sourceSpec.type === "creature") {
    const c = entityFromSpec(state, sourceSpec);
    return (c && (c.strength | 0)) || 0;
  }
  return 0;
}

function takeDamage(target, raw) {
  let dmg = Math.max(0, raw|0);
  const initialBlock = target.block || 0;
  if (initialBlock > 0) {
    const absorbed = Math.min(initialBlock, dmg);
    target.block = initialBlock - absorbed;
    dmg -= absorbed;
  }
  if (dmg > 0) {
    target.hp = Math.max(0, (target.hp|0) - dmg);
  }
}

function dealDamage(state, { source, target, amount }) {
  const src = entityFromSpec(state, source);
  const tgt = entityFromSpec(state, target);
  if (!tgt) return;
  const total = Math.max(0, (amount|0));
  takeDamage(tgt, total);
  if (target.type === "creature" && tgt.hp === 0) tgt.alive = false;
}

function gainBlock(state, { target, amount }) {
  const tgt = entityFromSpec(state, target);
  if (!tgt) return;
  let val = Math.max(0, amount|0);
  tgt.block = (tgt.block|0) + val;
}

function gainStrength(state, { target, amount }) {
  if (!target || target.type !== "creature") { log(state, "Strength can only target creatures."); return; }
  const tgt = entityFromSpec(state, target);
  if (!tgt) return;
  tgt.temporaryStrength = (tgt.temporaryStrength|0) + Math.max(0, amount|0);
}

function gainDexterity(state, { target, amount }) {
  if (!target || target.type !== "creature") { log(state, "Dexterity can only target creatures."); return; }
  const tgt = entityFromSpec(state, target);
  if (!tgt) return;
  tgt.temporaryDexterity = (tgt.temporaryDexterity|0) + Math.max(0, amount|0);
}

function summonCreature(state, creatureId) {
  const idx = state.creatures.findIndex(c => c.id === creatureId);
  if (idx === -1) return false;
  const c = state.creatures[idx];
  if (c.hp <= 0) return false; // cannot summon at 0 HP per design
  c.alive = true;
  return true;
}

function applyPermanentBuff(state, creatureId, buff) {
  const c = state.creatures.find(c => c.id === creatureId);
  if (!c) return;
  if (buff.attackDelta) c.permMods.attack += buff.attackDelta|0;
  if (buff.blockDelta) c.permMods.block += buff.blockDelta|0;
}

function resetTeamBlock(state) {
  state.player.block = 0;
  for (const c of state.creatures) c.block = 0;
}

function resetEnemyBlock(state) {
  for (const e of state.enemies) e.block = 0;
}
