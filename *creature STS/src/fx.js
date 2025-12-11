"use strict";

// Lightweight DOM FX utilities and orchestrators for card/move resolution.

function ensureFxLayer() {
  let layer = document.getElementById('fx-overlay');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'fx-overlay';
  layer.style.position = 'fixed';
  layer.style.left = '0';
  layer.style.top = '0';
  layer.style.width = '100%';
  layer.style.height = '100%';
  layer.style.pointerEvents = 'none';
  layer.style.zIndex = '10000';
  document.body.appendChild(layer);
  return layer;
}

function getCenter(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.2, w: r.width, h: r.height };
}

function flyClone(fromEl, toEl, opts = {}) {
  const { scale = 0.9, duration = 240 } = opts;
  const layer = ensureFxLayer();
  const srcRect = fromEl.getBoundingClientRect();
  const dstRect = toEl.getBoundingClientRect();
  // Use a bright ghost block for visibility
  const ghost = document.createElement('div');
  ghost.className = 'fx-ghost-card';
  ghost.style.position = 'fixed';
  ghost.style.left = '0px';
  ghost.style.top = '0px';
  ghost.style.width = srcRect.width + 'px';
  ghost.style.height = srcRect.height + 'px';
  ghost.style.transformOrigin = 'center center';
  ghost.style.willChange = 'transform, opacity';
  layer.appendChild(ghost);

  const sx = srcRect.left, sy = srcRect.top;
  const ex = dstRect.left, ey = dstRect.top;
  const kf = [
    { transform: `translate(${sx}px, ${sy}px) scale(1)`, opacity: 1 },
    { transform: `translate(${sx}px, ${sy}px) scale(${scale})`, opacity: 0.95, offset: 0.25 },
    { transform: `translate(${ex}px, ${ey}px) scale(${scale})`, opacity: 0.0 }
  ];
  return new Promise((resolve) => {
    const anim = ghost.animate(kf, { duration, easing: 'cubic-bezier(.2,.7,.2,1)' });
    anim.onfinish = () => { ghost.remove(); resolve(); };
  });
}

function floatingText(x, y, text, color) {
  const layer = ensureFxLayer();
  const span = document.createElement('div');
  span.textContent = text;
  span.style.position = 'fixed';
  span.style.left = (x - 6) + 'px';
  span.style.top = (y - 6) + 'px';
  span.style.color = color || '#6aa9ff';
  span.style.fontWeight = '700';
  span.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
  span.className = 'u-float-text';
  layer.appendChild(span);
  return new Promise((resolve) => {
    const anim = span.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(-18px)', opacity: 0 }
    ], { duration: 700, easing: 'ease-out' });
    anim.onfinish = () => { span.remove(); resolve(); };
  });
}

function shake(el, opts = {}) {
  const { duration = 180, intensity = 1 } = opts;
  el.classList.add('u-shake');
  return new Promise((resolve) => setTimeout(() => { el.classList.remove('u-shake'); resolve(); }, duration + 20));
}

function glowShield(el, opts = {}) {
  const { duration = 450 } = opts;
  el.classList.add('u-glow-blue');
  return new Promise((resolve) => setTimeout(() => { el.classList.remove('u-glow-blue'); resolve(); }, duration));
}

function highlightWell(el, opts = {}) {
  const { duration = 300 } = opts;
  el.classList.add('u-pulse-ring');
  return new Promise((resolve) => setTimeout(() => { el.classList.remove('u-pulse-ring'); resolve(); }, duration));
}

// Orchestrators
async function playCardToEnemyWithFx(state, handIndex, enemyIndex) {
  if (state.ui.animating) return;
  const cardEl = document.querySelector(`.h-card[data-hand-index="${handIndex}"]`);
  const enemyEl = document.querySelector(`.c-card.c-card--enemy[data-enemy-index="${enemyIndex}"]`);
  if (!cardEl || !enemyEl) return;
  const card = state.combat.hand[handIndex];
  if (!card) return;
  // Validate
  if (!isPlayable(state, card) || !isValidTarget(state, card, { type:'enemy', index: enemyIndex })) {
    await shake(cardEl, { duration: 160 });
    return;
  }
  state.ui.animating = true;
  // Hide the source card for illusion
  cardEl.style.visibility = 'hidden';
  const dst = getCenter(enemyEl);
  await flyClone(cardEl, enemyEl, { scale: 0.9, duration: 220 });
  // Fire-and-forget impact FX for snappier feel
  shake(enemyEl, { duration: 140 });
  floatingText(dst.x, dst.y, `-${computeCardDamage(state, card, {type:'player'})}`, '#ff6a6a');
  // Immediately resolve after impact
  playCard(state, handIndex, 'effect');
  state.ui.animating = false;
  render(state);
}

async function playCardToCreatureWithFx(state, handIndex, creatureIndex) {
  if (state.ui.animating) return;
  const cardEl = document.querySelector(`.h-card[data-hand-index="${handIndex}"]`);
  const creatureEl = document.querySelector(`.c-card.c-card--ally[data-index="${creatureIndex}"] .c-header`) || document.querySelector(`.c-card.c-card--ally[data-index="${creatureIndex}"]`);
  if (!cardEl || !creatureEl) return;
  const card = state.combat.hand[handIndex];
  if (!card) return;
  const target = { type:'creature', index: creatureIndex };
  if (!isPlayable(state, card) || !isValidTarget(state, card, target)) {
    await shake(cardEl, { duration: 160 });
    return;
  }
  state.ui.animating = true;
  cardEl.style.visibility = 'hidden';
  const cInst = state.creatures[creatureIndex];
  const blk = computeCardBlock(state, card, { type:'creature', creature: cInst });
  await flyClone(cardEl, creatureEl, { scale: 0.9, duration: 220 });
  // Fire-and-forget block FX
  glowShield(creatureEl, { duration: 300 });
  const cpt = getCenter(creatureEl);
  floatingText(cpt.x, cpt.y, `+${blk}`, '#6aa9ff');
  state.ui.friendlyTarget = target;
  playCard(state, handIndex, 'effect');
  state.ui.animating = false;
  render(state);
}

async function playCardToEnergyWithFx(state, handIndex) {
  if (state.ui.animating) return;
  const cardEl = document.querySelector(`.h-card[data-hand-index="${handIndex}"]`);
  const wellEl = document.getElementById('mana-well');
  if (!cardEl || !wellEl) return;
  const card = state.combat.hand[handIndex];
  if (!card) return;
  state.ui.animating = true;
  cardEl.style.visibility = 'hidden';
  await flyClone(cardEl, wellEl, { scale: 0.85, duration: 200 });
  // Pulse the well but resolve immediately
  highlightWell(wellEl, { duration: 220 });
  playCard(state, handIndex, 'energy');
  state.ui.animating = false;
  render(state);
}

async function attackMoveWithFx(state, creatureIndex, enemyIndex) {
  if (state.ui.animating) return;
  const creatureEl = document.querySelector(`.c-card.c-card--ally[data-index="${creatureIndex}"]`);
  const enemyEl = document.querySelector(`.c-card.c-card--enemy[data-enemy-index="${enemyIndex}"]`);
  if (!creatureEl || !enemyEl) return;
  state.ui.animating = true;
  await flyClone(creatureEl, enemyEl, { scale: 1.02, duration: 200 });
  shake(enemyEl, { duration: 140 });
  const dmg = computeMoveDamage(state, state.creatures[creatureIndex], state.catalogs.creatures[state.creatures[creatureIndex].id].moves.find(m=>m.id==='attack'));
  const ect = getCenter(enemyEl);
  floatingText(ect.x, ect.y, `-${dmg}`, '#ff6a6a');
  performCreatureAction(state, creatureIndex, 'attack');
  state.ui.animating = false;
  render(state);
}

async function applyMoveBuffWithFx(state, handIndex, creatureIndex, moveId) {
  if (state.ui.animating) return;
  const cardEl = document.querySelector(`.h-card[data-hand-index="${handIndex}"]`);
  const tileEl = document.querySelector(`.move-tile[data-creature-index="${creatureIndex}"][data-move-id="${moveId}"]`);
  if (!cardEl || !tileEl) return;
  const card = state.combat.hand[handIndex];
  if (!card || !(card.tags||[]).includes('move-buff')) { await shake(cardEl,{duration:160}); return; }
  state.ui.animating = true;
  cardEl.style.visibility = 'hidden';
  await flyClone(cardEl, tileEl, { scale: 0.9, duration: 200 });
  const ct = getCenter(tileEl);
  floatingText(ct.x, ct.y, `+3`, '#6aa9ff');
  // Resolve with ctx to let card effect apply
  playCard(state, handIndex, 'effect', { move: { creatureIndex, moveId } });
  state.ui.animating = false;
  render(state);
}

// Expose orchestrators
window.playCardToEnemyWithFx = playCardToEnemyWithFx;
window.playCardToCreatureWithFx = playCardToCreatureWithFx;
window.playCardToEnergyWithFx = playCardToEnergyWithFx;
window.attackMoveWithFx = attackMoveWithFx;
window.applyMoveBuffWithFx = applyMoveBuffWithFx;
