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

  // Hand interactions: delegate to container
  const handEl = document.getElementById("hand");
  if (handEl) handEl.onclick = function (e) {
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

  // Target selection: player
  const playerEl = document.getElementById("player");
  if (playerEl) playerEl.onclick = function (e) {
    const box = e.target.closest('[data-target="player"]');
    if (!box) return;
    state.ui.friendlyTarget = { type: 'player' };
    log(state, 'Target: Player');
    render(state);
  };

  // Target selection: creatures
  const creaturesEl = document.getElementById("creatures");
  if (creaturesEl) creaturesEl.onclick = function (e) {
    const btn = e.target.closest('button[data-action="creature-move"]');
    if (btn) {
      const idx = parseInt(btn.getAttribute('data-creature-index'), 10);
      const moveId = btn.getAttribute('data-move-id');
      performCreatureAction(state, idx, moveId);
      render(state);
      return;
    }
    const box = e.target.closest('[data-target="creature"]');
    if (!box) return;
    const idx = parseInt(box.getAttribute('data-index'), 10);
    const c = state.creatures[idx];
    if (!c || c.hp <= 0) { log(state, 'Cannot target a dead creature.'); return; }
    state.ui.friendlyTarget = { type: 'creature', index: idx };
    log(state, `Target: ${c.name}`);
    render(state);
  };

  // Target selection: enemies
  const enemiesEl = document.getElementById("enemies");
  if (enemiesEl) enemiesEl.onclick = function (e) {
    const box = e.target.closest('[data-enemy-index]');
    if (!box) return;
    const idx = parseInt(box.getAttribute('data-enemy-index'), 10);
    const enemy = state.enemies[idx];
    if (!enemy || enemy.hp <= 0) { log(state, 'Cannot target a dead enemy.'); return; }
    state.ui.enemyTarget = { index: idx };
    log(state, `Enemy target: ${enemy.name} #${idx+1}`);
    render(state);
  };
}
