"use strict";

// Pure render functions – no state mutation.

function render(state) {
  setHtml("energy", renderEnergy(state));
  setHtml("player", renderPlayer(state));
  renderCreaturesDOM(state);
  renderEnemiesDOM(state);
  setHtml("hand", renderHand(state));
  setHtml("controls", renderControls(state));
  setHtml("log", renderLog(state));
}

function renderEnergy(state) {
  return `
    <div class="row">
      <div class="pill">Energy: ${state.player.energy}</div>
      <div class="pill">Turn: ${state.combat.turn.number}</div>
      <div class="pill">Phase: ${state.combat.turn.phase}</div>
    </div>
  `;
}

function renderPlayer(state) {
  const p = state.player;
  const isTarget = state.ui.friendlyTarget?.type === "player";
  return `
    <div class="${isTarget ? 'is-target-friendly ' : ''}targetable" data-target="player" title="Click to target Player">
      <strong>Player</strong>
      <div class="row small">
        <div>HP: ${p.hp}/${p.maxHp}</div>
        <div>Block: ${p.block}</div>
        <div>Str: 0</div>
        <div>Dex: 0</div>
        <div>Gold: ${p.gold}</div>
      </div>
    </div>
  `;
}

function renderCreaturesDOM(state) {
  const root = document.getElementById('creatures');
  if (!root) return;
  root.innerHTML = '';
  const title = document.createElement('div');
  title.innerHTML = '<strong>Creatures</strong>';
  const row = document.createElement('div');
  row.className = 'row';
  // Only show summoned creatures; zone is empty until summon
  state.creatures.forEach((c, i) => {
    if (c.alive && c.hp > 0) row.appendChild(createCreatureCard(state, c, i));
  });
  root.append(title, row);
}

function renderEnemiesDOM(state) {
  const root = document.getElementById('enemies');
  if (!root) return;
  root.innerHTML = '';
  const title = document.createElement('div');
  title.innerHTML = '<strong>Enemies</strong>';
  const row = document.createElement('div');
  row.className = 'row';
  if (state.enemies.length === 0) {
    row.appendChild(htmlNode(`<div class="small">${escapeHtml('No enemies yet')}</div>`));
  } else {
    state.enemies.forEach((e, i) => row.appendChild(createEnemyCard(state, e, i)));
  }
  root.append(title, row);
}

function createCreatureCard(state, c, i) {
  const isTarget = state.ui.friendlyTarget?.type === 'creature' && state.ui.friendlyTarget.index === i;
  const card = document.createElement('div');
  card.className = 'c-card targetable' + (isTarget ? ' is-target-friendly' : '');
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
    tile.textContent = `${mdef.text(state, c, mdef)}  •  ${cost}`;
    moves.appendChild(tile);
  });

  card.append(header, name, chips, moves);
  return card;
}

function createEnemyCard(state, e, i) {
  const isTarget = state.ui.enemyTarget && state.ui.enemyTarget.index === i && e.hp > 0;
  const card = document.createElement('div');
  card.className = 'c-card targetable' + (isTarget ? ' is-target-enemy' : '');
  card.setAttribute('data-enemy-index', String(i));
  card.title = 'Click to target Enemy';

  const header = document.createElement('div'); header.className = 'c-header';
  const avatar = document.createElement('div'); avatar.className = 'c-avatar';
  const img = document.createElement('img'); img.src = enemyArt(e.id); img.alt = e.name; avatar.appendChild(img);
  const hp = document.createElement('div'); hp.className = 'c-badge hp'; hp.textContent = `${e.hp}/${e.maxHp}`;
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
      <div class="h-header">
        <div class="h-avatar ${iconClass}"></div>
        <div class="h-title">${card.name}</div>
        <div class="h-cost">Cost ${computeCardCost(state, card)}</div>
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
