"use strict";

// Event handlers are minimal: mutate state through primitives, then render(state)

function attachHandlers(state) {
  // Controls: delegate click handling to survive re-renders
  const controls = document.getElementById("controls");
  if (controls) controls.onclick = function (e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "start-combat") {
      startCombat(state);
      render(state);
    } else if (action === "end-turn") {
      endPlayerTurn(state);
      enemyTurn(state);
      render(state);
    } else if (action === "draw-5") {
      draw(state, 5);
      render(state);
    } else if (action === "discard-hand") {
      discardHand(state);
      render(state);
    }
  };

  // Hand buttons removed; interactions via drag-to-play
  const playerPanel = document.getElementById('player-panel');

  // Player belt interactions (hover + click)
  if (playerPanel) playerPanel.addEventListener('mousemove', function (e) {
    const ball = e.target.closest('.belt-ball');
    const current = state.ui.beltHoverIndex;
    if (ball) {
      const idx = parseInt(ball.getAttribute('data-creature-index'), 10);
      if (current !== idx) { state.ui.beltHoverIndex = idx; render(state); }
    } else if (current != null) {
      state.ui.beltHoverIndex = null; render(state);
    }
  });
  if (playerPanel) playerPanel.addEventListener('click', function (e) {
    const ball = e.target.closest('.belt-ball');
    if (!ball) return;
    const idx = parseInt(ball.getAttribute('data-creature-index'), 10);
    if (isSummonableCreature(state, idx)) {
      const cid = state.creatures[idx].id;
      if (summonCreature(state, cid)) {
        log(state, `Summoned ${state.creatures[idx].name}.`);
        render(state);
      }
    }
  });

  // Battlefield delegation: creatures + enemies in one place
  const battlefield = document.getElementById('battlefield');
  if (battlefield) battlefield.onclick = function (e) {
    // Creature move buttons
    const btn = e.target.closest('button[data-action="creature-move"]');
    if (btn) {
      const idx = parseInt(btn.getAttribute('data-creature-index'), 10);
      const moveId = btn.getAttribute('data-move-id');
      performCreatureAction(state, idx, moveId);
      render(state);
      return;
    }
    // Target friendly creature
    const cre = e.target.closest('[data-target="creature"]');
    if (cre) {
      const idx = parseInt(cre.getAttribute('data-index'), 10);
      const c = state.creatures[idx];
      if (!c || c.hp <= 0) { log(state, 'Cannot target a dead creature.'); return; }
      state.ui.friendlyTarget = { type: 'creature', index: idx };
      log(state, `Target: ${c.name}`);
      render(state);
      return;
    }
    // Target enemy
    const ene = e.target.closest('[data-enemy-index]');
    if (ene) {
      const idx = parseInt(ene.getAttribute('data-enemy-index'), 10);
      const enemy = state.enemies[idx];
      if (!enemy || enemy.hp <= 0) { log(state, 'Cannot target a dead enemy.'); return; }
      state.ui.enemyTarget = { index: idx };
      log(state, `Enemy target: ${enemy.name} #${idx+1}`);
      render(state);
      return;
    }
  };

  // Drag-to-play from hand (aiming)
  if (playerPanel) playerPanel.addEventListener('pointerdown', function (e) {
    const cardEl = e.target.closest('.h-card');
    if (!cardEl) return;
    const idxAttr = cardEl.getAttribute('data-hand-index');
    if (idxAttr == null) return;
    const idx = parseInt(idxAttr, 10);
    const rect = cardEl.getBoundingClientRect();
    state.ui.aim = { kind: 'card', handIndex: idx, startElRect: rect };
    state.ui.pointer = { x: e.clientX, y: e.clientY };
    render(state);
    const onMove = (ev) => { state.ui.pointer = { x: ev.clientX, y: ev.clientY }; state.ui.dropHover = getDropTargetFromPoint(ev.clientX, ev.clientY); render(state); };
    const onUp = (ev) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp, true);
      resolveAimByPoint(state, ev.clientX, ev.clientY);
      state.ui.aim = null; state.ui.pointer = null; state.ui.dropHover = null; render(state);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, true);
  }, true);

  // Click-to-aim from ally creature for default attack
  if (battlefield) battlefield.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.move-tile')) return; // keep move buttons behavior
    const ally = e.target.closest('.c-card.c-card--ally');
    if (!ally) return;
    const idxAttr = ally.getAttribute('data-index');
    if (idxAttr == null) return;
    const idx = parseInt(idxAttr, 10);
    const rect = ally.getBoundingClientRect();
    state.ui.aim = { kind: 'move', creatureIndex: idx, moveId: 'attack', startElRect: rect };
    state.ui.pointer = { x: e.clientX, y: e.clientY };
    render(state);
    const onMove = (ev) => { state.ui.pointer = { x: ev.clientX, y: ev.clientY }; state.ui.dropHover = getDropTargetFromPoint(ev.clientX, ev.clientY); render(state); };
    const onUp = (ev) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp, true);
      resolveAimByPoint(state, ev.clientX, ev.clientY);
      state.ui.aim = null; state.ui.pointer = null; state.ui.dropHover = null; render(state);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, true);
  }, true);

  // Escape cancels aim
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.ui.aim) {
      state.ui.aim = null; state.ui.pointer = null; state.ui.dropHover = null; render(state);
    }
  });
}

function resolveAimByPoint(state, x, y) {
  const target = getDropTargetFromPoint(x, y);
  if (!target) return;
  const aim = state.ui.aim;
  if (!aim) return;
  if (aim.kind === 'card') {
    const handIdx = aim.handIndex;
    if (target.type === 'energy-well') { playCard(state, handIdx, 'energy'); return; }
    if (target.type === 'enemy') { state.ui.enemyTarget = { index: target.index }; playCard(state, handIdx, 'effect'); return; }
    if (target.type === 'creature') { state.ui.friendlyTarget = { type: 'creature', index: target.index }; playCard(state, handIdx, 'effect'); return; }
    return;
  }
  if (aim.kind === 'move') {
    if (aim.moveId === 'attack' && target.type === 'enemy') {
      state.ui.enemyTarget = { index: target.index };
      performCreatureAction(state, aim.creatureIndex, 'attack');
    }
  }
}

function getDropTargetFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const energy = el.closest('#mana-well, [data-drop="energy-well"]');
  if (energy) return { type: 'energy-well' };
  const enemy = el.closest('[data-enemy-index]');
  if (enemy) return { type: 'enemy', index: parseInt(enemy.getAttribute('data-enemy-index'), 10) };
  const creature = el.closest('[data-target="creature"]');
  if (creature) return { type: 'creature', index: parseInt(creature.getAttribute('data-index'), 10) };
  return null;
}
