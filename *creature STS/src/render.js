"use strict";

// Pure render functions – no state mutation.

function render(state) {
  renderBattlefield(state);
  renderPlayerPanel(state);
  setHtml("controls", renderControls(state));
  setHtml("log", renderLog(state));
}

function renderBattlefield(state) {
  const root = document.getElementById('battlefield');
  if (!root) return;
  root.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'bf-grid';
  const left = document.createElement('div'); left.id = 'lane-left'; left.className = 'bf-lane';
  const right = document.createElement('div'); right.id = 'lane-right'; right.className = 'bf-lane';

  // Player creatures (summoned only)
  state.creatures.forEach((c, i) => {
    if (c.alive && c.hp > 0) left.appendChild(createCreatureCard(state, c, i, { enemy: false }));
  });
  // Enemies
  state.enemies.forEach((e, i) => right.appendChild(createEnemyCard(state, e, i)));

  grid.append(left, right);
  root.append(grid);
}

function renderPlayerPanel(state) {
  const root = document.getElementById('player-panel');
  if (!root) return;
  root.innerHTML = '';
  const panel = document.createElement('div'); panel.className = 'player-panel';
  // HUD row with energy bubble
  const hud = document.createElement('div'); hud.className = 'hud-row';
  const p = state.player;
  const hp = document.createElement('div'); hp.className = 'pill'; hp.textContent = `HP: ${p.hp}/${p.maxHp}`;
  const block = document.createElement('div'); block.className = 'pill'; block.textContent = `Block: ${p.block}`;
  const energy = document.createElement('div'); energy.className = 'energy-bubble'; energy.textContent = `${p.energy}`;
  const turn = document.createElement('div'); turn.className = 'pill small'; turn.textContent = `Turn: ${state.combat.turn.number}`;
  const phase = document.createElement('div'); phase.className = 'pill small'; phase.textContent = `Phase: ${state.combat.turn.phase}`;
  hud.append(hp, block, energy, turn, phase);

  // Belt region (belt + overlay preview)
  const beltRegion = document.createElement('div'); beltRegion.className = 'belt-region';
  const belt = document.createElement('div'); belt.className = 'belt'; belt.id = 'belt';
  state.creatures.forEach((c, i) => {
    const ball = document.createElement('div');
    ball.className = 'belt-ball';
    ball.setAttribute('data-creature-index', String(i));
    if (c.alive) ball.classList.add('belt-ball--alive');
    else if (isSummonableCreature(state, i)) ball.classList.add('belt-ball--playable');
    else ball.classList.add('belt-ball--locked');
    ball.title = c.alive ? `${c.name} (Summoned)` : (isSummonableCreature(state, i) ? `Summon ${c.name}` : `${c.name} (Turn ≥ ${(state.catalogs.creatures[c.id].summonTurn||1)})`);
    belt.appendChild(ball);
  });
  beltRegion.appendChild(belt);
  // Overlay preview (no layout space)
  const idx = state.ui.beltHoverIndex;
  if (idx != null && state.creatures[idx]) {
    const preview = document.createElement('div'); preview.className = 'belt-preview';
    preview.appendChild(createCreatureCard(state, state.creatures[idx], idx, { enemy: false }));
    beltRegion.appendChild(preview);
  }

  const handWrap = document.createElement('div'); handWrap.id = 'hand'; handWrap.innerHTML = renderHand(state);

  panel.append(hud, beltRegion, handWrap);
  root.append(panel);
}

function createCreatureCard(state, c, i, opts = {}) {
  const isTarget = state.ui.friendlyTarget?.type === 'creature' && state.ui.friendlyTarget.index === i;
  const card = document.createElement('div');
  card.className = 'c-card targetable' + (isTarget ? ' is-target-friendly' : '') + (opts.enemy ? ' c-card--enemy' : ' c-card--ally');
  card.setAttribute('data-target', 'creature');
  card.setAttribute('data-index', String(i));
  card.title = 'Click to target Creature';

  // Header: avatar + HP badge
  const header = document.createElement('div');
  header.className = 'c-header';
  const avatar = document.createElement('div');
  avatar.className = 'c-avatar';
  const img = document.createElement('img');
  img.src = creatureArt(c.id);
  img.alt = c.name;
  avatar.appendChild(img);
  const hp = document.createElement('div');
  hp.className = 'c-badge hp';
  hp.textContent = String(c.maxHp);
  header.append(avatar, hp);

  const name = document.createElement('div');
  name.className = 'c-name';
  name.textContent = c.name;

  // Stat chips: Strength/Dex only if > 0
  const chips = document.createElement('div');
  chips.className = 'c-chips';
  const strVal = (c.strength||0) + (c.temporaryStrength||0);
  const dexVal = (c.dexterity||0) + (c.temporaryDexterity||0);
  if (strVal > 0) {
    const chip = document.createElement('div'); chip.className = 'chip chip--sword'; chip.textContent = String(strVal); chips.appendChild(chip);
  }
  if (dexVal > 0) {
    const chip = document.createElement('div'); chip.className = 'chip chip--shield'; chip.textContent = String(dexVal); chips.appendChild(chip);
  }

  // Moves column
  const moves = document.createElement('div');
  moves.className = 'c-moves';
  const def = state.catalogs.creatures[c.id];
  const canUse = state.combat.turn.phase === 'player' && c.alive && c.hp > 0 && !c.movedThisTurn;
  def.moves.forEach((mdef) => {
    const tile = document.createElement('button');
    tile.className = 'move-tile';
    tile.setAttribute('data-action','creature-move');
    tile.setAttribute('data-move-id', mdef.id);
    tile.setAttribute('data-creature-index', String(i));
    const playable = canUse && state.player.energy >= computeMoveCost(state, c, mdef);
    if (!playable) tile.setAttribute('disabled', '');
    const cost = computeMoveCost(state, c, mdef);
    // Pokémon-style: title + rules + cost bubble
    tile.innerHTML = `
      <div class="mv-head">${escapeHtml(mdef.name || '')}</div>
      <div class="mv-text small">${escapeHtml(mdef.text(state, c, mdef))}</div>
      <div class="move-cost">${cost}</div>
    `;
    moves.appendChild(tile);
  });

  card.append(header, name, chips, moves);
  return card;
}

function createEnemyCard(state, e, i) {
  const isTarget = state.ui.enemyTarget && state.ui.enemyTarget.index === i && e.hp > 0;
  const card = document.createElement('div');
  card.className = 'c-card c-card--enemy targetable' + (isTarget ? ' is-target-enemy' : '');
  card.setAttribute('data-enemy-index', String(i));
  card.title = 'Click to target Enemy';

  const header = document.createElement('div'); header.className = 'c-header';
  const avatar = document.createElement('div'); avatar.className = 'c-avatar';
  const img = document.createElement('img'); img.src = enemyArt(e.id); img.alt = e.name; avatar.appendChild(img);
  const hp = document.createElement('div'); hp.className = 'c-badge hp'; hp.textContent = `${e.hp}`;
  header.append(avatar, hp);

  const name = document.createElement('div'); name.className = 'c-name'; name.textContent = e.name;
  const meta = document.createElement('div'); meta.className = 'small'; meta.textContent = `Atk ${e.attackValue} • Block ${e.blockValue}`;
  const intent = document.createElement('div'); intent.className = 'small'; intent.textContent = `Intent: ${formatIntent(e, state)}`;

  card.append(header, name, meta, intent);
  return card;
}

function creatureArt(creatureId) {
  switch (creatureId) {
    case 'CREATURE_A': return 'img/plant1.png';
    case 'CREATURE_B': return 'img/waterpuddle.png';
    default: return 'img/plant1.png';
  }
}
function enemyArt(enemyId) {
  switch (enemyId) {
    case 'GRUNT': return 'img/fireMonster.png';
    default: return 'img/firebaby.png';
  }
}

function htmlNode(html) { const div = document.createElement('div'); div.innerHTML = html; return div.firstChild; }

function formatIntent(enemy, state) {
  const it = enemy.intent;
  if (!it) return '-';
  if (typeof it === 'string') return it; // backward compatibility
  if (it.type === 'attack') return `Attack ${it.amount}`;
  if (it.type === 'block') return `Block ${it.amount}`;
  return '-';
}

function renderHand(state) {
  const { hand } = state.combat;
  const cards = hand.map((card, i) => {
    const canEffect = isPlayable(state, card) && isValidTarget(state, card, card.tags?.includes('damage') ? state.ui.enemyTarget && { type:'enemy', index: state.ui.enemyTarget.index } : state.ui.friendlyTarget);
    const iconClass = card.type === 'creature' ? 'h--creature' : (card.tags?.includes('damage') ? 'h--sword' : (card.tags?.includes('block') ? 'h--shield' : (card.type === 'single-use' ? 'h--star' : '')));
    return `
    <div class="h-card" data-hand-index="${i}">
      <div class="h-cost-badge">${computeCardCost(state, card)}</div>
      <div class="h-header">
        <div class="h-title">${card.name}</div>
        <div class="h-avatar ${iconClass}"></div>
      </div>
      <div class="h-text small">${card.text(state, card)}</div>
      <div class="row" style="margin-top:6px">
        <button data-action="play-effect" data-hand-index="${i}" ${canEffect ? '' : 'disabled'}>Play</button>
        <button data-action="play-energy" data-hand-index="${i}">Energy +${computeCardEnergyGain(state, card)}</button>
      </div>
    </div>
  `}).join("");
  return `<div><strong>Hand</strong><div class="row">${cards || emptyCell("Hand is empty")}</div></div>`;
}

function renderControls(state) {
  return `
    <div class="row">
      <button id="btn-new-combat" data-action="start-combat">Start Combat</button>
      <button id="btn-end-turn" data-action="end-turn">End Turn</button>
      <button id="btn-draw-5" data-action="draw-5">Draw 5</button>
      <button id="btn-discard-hand" data-action="discard-hand">Discard Hand</button>
    </div>
  `;
}

function renderLog(state) {
  const lines = state.ui.log.slice(-8).map(l => `<div class="small">${escapeHtml(l)}</div>`).join("");
  return `<div><strong>Log</strong>${lines || `<div class="small">(empty)</div>`}</div>`;
}

// Helpers
function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function emptyCell(text) {
  return `<div class="small">${escapeHtml(text)}</div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
