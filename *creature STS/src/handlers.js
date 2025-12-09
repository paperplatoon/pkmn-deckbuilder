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

  // Hand interactions: delegate to player panel (element is re-rendered)
  const playerPanel = document.getElementById('player-panel');
  if (playerPanel) playerPanel.onclick = function (e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const handIndexAttr = btn.getAttribute("data-hand-index");
    const action = btn.getAttribute("data-action");
    if (handIndexAttr == null) return;
    const idx = parseInt(handIndexAttr, 10);
    if (action === "play-effect") {
      playCard(state, idx, "effect");
      render(state);
    } else if (action === "play-energy") {
      playCard(state, idx, "energy");
      render(state);
    }
  };

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
}
