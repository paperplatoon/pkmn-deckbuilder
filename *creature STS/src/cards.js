"use strict";

// Card definitions and instance-based play. Uses compute helpers.

(function(){
  let __cid = 1;
  function nextId() { return `c${__cid++}`; }

  const DEFS = {
    DEAL_4: {
      defId: 'DEAL_4', type: 'spell', name: 'Deal 4',
      baseCost: 1, baseEnergyGain: 1, baseDamage: 4, tags: ['damage','spell'],
      text(state, card) {
        const dmg = computeCardDamage(state, card, { type: 'player' });
        return `Cost ${computeCardCost(state, card)} — Deal ${showMonsterAttackDamage(dmg)} damage.`;
      },
      effect(state, card) {
        const t = defaultEnemyTargetSpec(state);
        if (!t) { log(state, 'No valid enemy target.'); return false; }
        const dmg = computeCardDamage(state, card, { type: 'player' });
        dealDamage(state, { source: { type: 'player' }, target: t, amount: dmg });
        consumeNextAttackBuff(state);
        return true;
      },
    },
    BLOCK_4: {
      defId: 'BLOCK_4', type: 'spell', name: 'Block 4',
      baseCost: 1, baseEnergyGain: 1, baseBlock: 4, tags: ['block','spell'],
      text(state, card) {
        const t = defaultFriendlyTargetSpec(state);
        const amount = computeCardBlock(state, card, resolveTargetCtx(state, t));
        return `Cost ${computeCardCost(state, card)} — Gain ${amount} block.`;
      },
      effect(state, card) {
        const t = defaultFriendlyTargetSpec(state);
        const amount = computeCardBlock(state, card, resolveTargetCtx(state, t));
        gainBlock(state, { target: t, amount });
        consumeNextBlockBuff(state);
        return true;
      },
    },
    STR_2: {
      defId: 'STR_2', type: 'spell', name: 'Strength +2',
      baseCost: 1, baseEnergyGain: 1, tags: ['grantStrength','spell'],
      text(state, card) { return `Cost ${computeCardCost(state, card)} — Give a creature +2 Strength.`; },
      effect(state, card) {
        const t = defaultFriendlyTargetSpec(state);
        if (t.type !== 'creature') { log(state,'Strength can only target creatures.'); return false; }
        gainStrength(state, { target: t, amount: 2 });
        return true;
      },
    },
    DEX_2: {
      defId: 'DEX_2', type: 'spell', name: 'Dexterity +2',
      baseCost: 1, baseEnergyGain: 1, tags: ['grantDexterity','spell'],
      text(state, card) { return `Cost ${computeCardCost(state, card)} — Give a creature +2 Dexterity.`; },
      effect(state, card) {
        const t = defaultFriendlyTargetSpec(state);
        if (t.type !== 'creature') { log(state,'Dexterity can only target creatures.'); return false; }
        gainDexterity(state, { target: t, amount: 2 });
        return true;
      },
    },
    PERM_ATK_2: {
      defId: 'PERM_ATK_2', type: 'single-use', name: 'Permanent Attack +2',
      baseCost: 2, baseEnergyGain: 1, tags: ['buff','single-use'],
      text(state, card) { return `Cost ${computeCardCost(state, card)} — Once/combat: permanently give a creature +2 attack.`; },
      effect(state, card) {
        const t = defaultFriendlyTargetSpec(state);
        if (t.type !== 'creature') { log(state,'Choose a creature.'); return false; }
        const cid = state.creatures[t.index].id;
        applyPermanentBuff(state, cid, { attackDelta: 2 });
        return true;
      },
    },
    CREATURE_A: {
      defId: 'CREATURE_A', type: 'creature', name: 'Vanguard',
      baseCost: 0, baseEnergyGain: 2, tags: ['summon','creature'], summonTurn: 1, baseSummonId: 'CREATURE_A',
      text(state, card) { return `Cost ${computeCardCost(state, card)} — Summon Vanguard (Turn ≥ ${card.summonTurn || 1}) • or +${computeCardEnergyGain(state, card)} energy`; },
      effect(state, card) {
        if (!isSummonable(state, card)) { log(state, 'Cannot summon yet.'); return false; }
        const ok = summonCreature(state, 'CREATURE_A');
        if (!ok) { log(state, 'Cannot summon (HP 0).'); return false; }
        return true;
      },
    },
    CREATURE_B: {
      defId: 'CREATURE_B', type: 'creature', name: 'Bulwark',
      baseCost: 0, baseEnergyGain: 2, tags: ['summon','creature'], summonTurn: 2, baseSummonId: 'CREATURE_B',
      text(state, card) { return `Cost ${computeCardCost(state, card)} — Summon Bulwark (Turn ≥ ${card.summonTurn || 1}) • or +${computeCardEnergyGain(state, card)} energy`; },
      effect(state, card) {
        if (!isSummonable(state, card)) { log(state, 'Cannot summon yet.'); return false; }
        const ok = summonCreature(state, 'CREATURE_B');
        if (!ok) { log(state, 'Cannot summon (HP 0).'); return false; }
        return true;
      },
    },
  };

  function createCardInstance(defId) {
    const d = DEFS[defId];
    if (!d) return null;
    return {
      id: nextId(),
      defId: d.defId,
      type: d.type,
      name: d.name,
      baseCost: d.baseCost || 0,
      baseEnergyGain: d.baseEnergyGain || 0,
      baseDamage: d.baseDamage,
      baseBlock: d.baseBlock,
      baseSummonId: d.baseSummonId,
      summonTurn: d.summonTurn || 1,
      permMods: {},
      tempMods: {},
      usedThisCombat: false,
      tags: d.tags || [],
      text: d.text,
      _effect: d.effect,
    };
  }

  function defaultEnemyTargetSpec(state) {
    const t = state.ui.enemyTarget;
    if (t && state.enemies[t.index] && state.enemies[t.index].hp > 0) return { type: 'enemy', index: t.index };
    const idx = state.enemies.findIndex(e => e && e.hp > 0);
    return idx >= 0 ? { type: 'enemy', index: idx } : null;
  }
  function defaultFriendlyTargetSpec(state) {
    const t = state.ui.friendlyTarget;
    if (t?.type === 'player') return { type: 'player' };
    if (t?.type === 'creature' && state.creatures[t.index] && state.creatures[t.index].hp > 0) return { type: 'creature', index: t.index };
    return { type: 'player' };
  }
  function resolveTargetCtx(state, t) {
    if (!t) return null;
    if (t.type === 'creature') return { type: 'creature', creature: state.creatures[t.index] };
    return t;
  }

  function consumeNextCardDiscount(state) { if (state.modifiers?.nextCardDiscount > 0) state.modifiers.nextCardDiscount = 0; }
  function consumeNextAttackBuff(state) { if (state.modifiers?.nextAttackExtraDamage > 0) state.modifiers.nextAttackExtraDamage = 0; }
  function consumeNextBlockBuff(state) { if (state.modifiers?.nextBlockExtraBlock > 0) state.modifiers.nextBlockExtraBlock = 0; }

  function playCard(state, handIndex, mode) {
    const card = state.combat.hand[handIndex];
    if (!card) return false;

    if (mode === 'energy') {
      const gain = computeCardEnergyGain(state, card);
      addEnergy(state, gain);
      log(state, `${card.name} → +${gain} energy`);
      // move to discard
      state.combat.hand.splice(handIndex, 1);
      state.combat.discard.push(card);
      return true;
    }

    const cost = computeCardCost(state, card);
    if (!spendEnergy(state, cost)) {
      log(state, `Not enough energy for ${card.name} (cost ${cost}).`);
      return false;
    }

    // Target validity
    let targetForValidation = null;
    if (card.tags?.includes('damage')) targetForValidation = defaultEnemyTargetSpec(state);
    if (card.tags?.includes('block') || card.tags?.includes('grantStrength') || card.tags?.includes('grantDexterity')) targetForValidation = defaultFriendlyTargetSpec(state);
    if (!isValidTarget(state, { ...card }, targetForValidation)) {
      log(state, 'Invalid target.');
      // refund
      addEnergy(state, cost);
      return false;
    }

    // Spells casting twice support
    let times = 1;
    if (card.type === 'spell' && state.modifiers?.nextSpellCastsTwice > 0) {
      times = 2;
      state.modifiers.nextSpellCastsTwice = Math.max(0, state.modifiers.nextSpellCastsTwice - 1);
    }
    let ok = false;
    for (let i = 0; i < times; i++) ok = card._effect(state, card) || ok;

    if (!ok) {
      addEnergy(state, cost); // refund on failure
      return false;
    }

    consumeNextCardDiscount(state);
    if (card.type === 'single-use') {
      card.usedThisCombat = true;
      // exhaust from combat: remove from hand (already) and DO NOT add to discard
      state.combat.hand.splice(handIndex, 1);
      return true;
    }
    // Move to discard
    state.combat.hand.splice(handIndex, 1);
    state.combat.discard.push(card);
    return true;
  }

  function seedStartingDeckInstances(state) {
    const deck = [];
    pushMany(deck, 'DEAL_4', 5);
    pushMany(deck, 'BLOCK_4', 3);
    pushMany(deck, 'STR_2', 1);
    pushMany(deck, 'DEX_2', 1);
    pushMany(deck, 'CREATURE_A', 1);
    pushMany(deck, 'CREATURE_B', 1);
    state.combat.deck = deck.map(defId => createCardInstance(defId));
  }

  function pushMany(arr, defId, n) { for (let i=0;i<n;i++) arr.push(defId); }

  // Expose
  window.playCard = playCard;
  window.seedStartingDeck = seedStartingDeckInstances;
})();
