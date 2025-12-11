"use strict";

// Pure render functions – no state mutation.

function render(state) {
  renderBattlefield(state);
  renderPlayerPanel(state);
  renderAimOverlay(state);
  renderLevelUp(state);
  renderRewards(state);
  setHtml("controls", renderControls(state));
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

  // Add drop hints/highlights during aim
  if (state.ui.aim) {
    const vt = getValidDropTargets(state);
    if (vt.creatures) {
      left.querySelectorAll('[data-target="creature"]').forEach((el)=> el.classList.add('drop-hint'));
    }
    if (vt.enemies) {
      right.querySelectorAll('[data-enemy-index]').forEach((el)=> el.classList.add('drop-hint'));
    }
    if (state.ui.dropHover) {
      if (state.ui.dropHover.type === 'creature') {
        const el = left.querySelector(`[data-target="creature"][data-index="${state.ui.dropHover.index}"]`);
        if (el) el.classList.add('drop-hover');
      } else if (state.ui.dropHover.type === 'enemy') {
        const el = right.querySelector(`[data-enemy-index="${state.ui.dropHover.index}"]`);
        if (el) el.classList.add('drop-hover');
      }
    }
  }

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
  hud.append(hp);
  if ((p.block|0) > 0) { hud.append(createShieldChip(p.block)); }
  const turn = document.createElement('div'); turn.className = 'pill small'; turn.textContent = `Turn: ${state.combat.turn.number}`;
  hud.append(turn, renderManaWell(state));

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

function renderManaWell(state) {
  const well = document.createElement('div');
  well.className = 'mana-well';
  well.id = 'mana-well';
  well.setAttribute('data-drop','energy-well');
  const bubble = document.createElement('div');
  bubble.className = 'energy-bubble energy-bubble--big';
  bubble.textContent = `${state.player.energy}`;
  const label = document.createElement('div');
  label.className = 'small';
  label.textContent = 'Energy';
  well.append(bubble, label);
  // Highlight as drop target when aiming
  if (state.ui.aim) {
    const vt = getValidDropTargets(state);
    if (vt.energyWell) well.classList.add('drop-hint');
    if (state.ui.dropHover && state.ui.dropHover.type === 'energy-well') well.classList.add('drop-hover');
  }
  return well;
}

function ensureAimOverlayEl() {
  let svg = document.getElementById('aim-overlay');
  if (svg) return svg;
  const app = document.getElementById('app');
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'aim-overlay');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.position = 'fixed';
  svg.style.left = '0';
  svg.style.top = '0';
  svg.style.pointerEvents = 'none';
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke', '#6aa9ff');
  path.setAttribute('stroke-width', '3');
  path.setAttribute('fill', 'none');
  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  arrow.setAttribute('fill', '#6aa9ff');
  svg.append(path, arrow);
  app.appendChild(svg);
  return svg;
}

function renderAimOverlay(state) {
  const svg = ensureAimOverlayEl();
  const path = svg.querySelector('path');
  const arrow = svg.querySelector('polygon');
  if (!state.ui.aim || !state.ui.pointer) {
    path.setAttribute('d', '');
    arrow.setAttribute('points', '');
    return;
  }
  const start = state.ui.aim.startElRect;
  if (!start) { path.setAttribute('d',''); arrow.setAttribute('points',''); return; }
  const sx = start.left + start.width / 2;
  const sy = start.top + start.height * 0.2;
  const mx = state.ui.pointer.x;
  const my = state.ui.pointer.y;
  const cx = (sx + mx) / 2;
  const cy = Math.min(sy, my) - Math.abs(mx - sx) * 0.2 - 60; // nice arc
  const d = `M ${sx},${sy} Q ${cx},${cy} ${mx},${my}`;
  path.setAttribute('d', d);
  const angle = Math.atan2(my - cy, mx - cx);
  const size = 12;
  const p1 = `${mx},${my}`;
  const p2 = `${mx - size * Math.cos(angle - Math.PI / 6)},${my - size * Math.sin(angle - Math.PI / 6)}`;
  const p3 = `${mx - size * Math.cos(angle + Math.PI / 6)},${my - size * Math.sin(angle + Math.PI / 6)}`;
  arrow.setAttribute('points', `${p1} ${p2} ${p3}`);
}

function clearAimOverlay() {
  const svg = ensureAimOverlayEl();
  const path = svg.querySelector('path');
  const arrow = svg.querySelector('polygon');
  if (path) path.setAttribute('d','');
  if (arrow) arrow.setAttribute('points','');
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
  if ((c.block|0) > 0) {
    const b = document.createElement('div'); b.className = 'c-badge block';
    b.appendChild(createShieldChip(c.block, true));
    header.appendChild(b);
  }
  // Name overlay
  const name = document.createElement('div');
  name.className = 'c-name c-name--overlay';
  name.textContent = c.name;
  card.appendChild(name);

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
    const previewText = mdef.text(state, c, mdef);
    const perMove = (c.moveMods && c.moveMods[mdef.id]) || {};
    const bonus = (mdef.baseDamage!=null ? (perMove.damageDelta||0) : (perMove.blockDelta||0));
    const bonusHtml = bonus > 0 ? ` <span style="color:#6aa9ff">(+${bonus})</span>` : '';
    tile.innerHTML = `
      <div class="mv-head">${escapeHtml(mdef.name || '')}</div>
      <div class="mv-text small">${escapeHtml(previewText)}${bonusHtml}</div>
      <div class="move-cost">${cost}</div>
    `;
    moves.appendChild(tile);
  });

  card.append(header, chips, moves);
  // XP bar
  const xpWrap = document.createElement('div'); xpWrap.className = 'xp-bar';
  const fill = document.createElement('div'); fill.className = 'xp-bar__fill';
  const need = (2 + (c.level||1));
  const have = Math.min(need, (c.xp||0));
  const pct = Math.max(0, Math.min(100, Math.round((have/need)*100)));
  fill.style.width = pct + '%';
  xpWrap.appendChild(fill);
  card.appendChild(xpWrap);
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
  if ((e.block|0) > 0) {
    const b = document.createElement('div'); b.className = 'c-badge block';
    b.appendChild(createShieldChip(e.block, true));
    header.appendChild(b);
  }

  // Name overlay
  const name = document.createElement('div'); name.className = 'c-name c-name--overlay'; name.textContent = e.name; card.appendChild(name);
  // Enemy moves (readonly tiles)
  const def = state.catalogs.enemies[e.id];
  const moves = document.createElement('div'); moves.className = 'c-moves';
  (def.moves||[]).forEach(m => {
    const tile = document.createElement('div'); tile.className = 'move-tile move-tile--readonly';
    const txt = typeof m.text === 'function' ? m.text(state, e) : String(m.text||'');
    tile.innerHTML = `
      <div class="mv-head">${escapeHtml(m.name)}</div>
      <div class="mv-text small">${escapeHtml(txt)}</div>
    `;
    moves.appendChild(tile);
  });

  // Highlight intended move tile
  if (e.intent) {
    const desired = e.intent.type === 'attack' ? 'attack' : (e.intent.type === 'buffAttack' ? 'rage' : null);
    if (desired) {
      const tiles = moves.querySelectorAll('.move-tile');
      tiles.forEach(tile => {
        const head = tile.querySelector('.mv-head');
        if (!head) return;
        const txt = (head.textContent||'').toLowerCase();
        if ((desired === 'attack' && txt.includes('attack')) || (desired === 'rage' && txt.includes('rage'))) {
          tile.classList.add('intent','intent-pulse');
        }
      });
    }
  }

  card.append(header, moves);
  return card;
}

// Small shield chip with SVG + numeric value
function createShieldChip(value, compact = false) {
  const wrap = document.createElement('div');
  wrap.className = 'shield-chip' + (compact ? ' shield-chip--sm' : '');
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M12 3l7 3v6c0 5-3.8 8.3-7 9-3.2-.7-7-4-7-9V6l7-3z');
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  const num = document.createElement('div');
  num.className = 'shield-chip__num';
  num.textContent = String(value);
  wrap.append(svg, num);
  return wrap;
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

function renderLevelUp(state) {
  const overlayId = 'levelup-overlay';
  let overlay = document.getElementById(overlayId);
  if (!state.ui.levelUp) { if (overlay) overlay.remove(); return; }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = overlayId;
    document.body.appendChild(overlay);
  }
  const lu = state.ui.levelUp;
  const c = state.creatures[lu.creatureIndex];
  const def = state.catalogs.creatures[c.id];
  overlay.className = 'levelup-overlay';
  overlay.innerHTML = '';
  const box = document.createElement('div'); box.className = 'levelup-box';
  const title = document.createElement('div'); title.className = 'levelup-title'; title.textContent = 'Level Up! Choose one stat to increase permanently';

  // Choices row
  const choices = document.createElement('div'); choices.className = 'levelup-choices';

  // HP choice
  const hpChoice = document.createElement('div'); hpChoice.className = 'levelup-choice hp-choice'; hpChoice.setAttribute('data-choice','hp');
  const hpBadge = document.createElement('div'); hpBadge.className = 'energy-bubble energy-bubble--big hp-bubble';
  hpBadge.style.background = '#c12525';
  hpBadge.textContent = `${c.maxHp} (+${lu.hpDelta})`;
  const hpText = document.createElement('div'); hpText.className = 'small'; hpText.textContent = 'Increase Max HP';
  hpChoice.append(hpBadge, hpText);

  // Moves choice
  const mvChoice = document.createElement('div'); mvChoice.className = 'levelup-choice mv-choice'; mvChoice.setAttribute('data-choice','moves');
  const m1 = def.moves[0]; const m2 = def.moves[1];
  const mv1 = document.createElement('div'); mv1.className = 'mv-up'; mv1.textContent = `${m1.name}: (+${lu.moveDeltas.attackDelta})`;
  const mv2 = document.createElement('div'); mv2.className = 'mv-up'; mv2.textContent = `${m2.name}: (+${lu.moveDeltas.blockDelta})`;
  mvChoice.append(mv1, mv2);

  choices.append(hpChoice, mvChoice);
  box.append(title, choices);
  overlay.appendChild(box);
}

function renderRewards(state) {
  const id = 'rewards-overlay';
  let overlay = document.getElementById(id);
  if (!state.ui.rewards) { if (overlay) overlay.remove(); return; }
  if (!overlay) { overlay = document.createElement('div'); overlay.id = id; document.body.appendChild(overlay); }
  overlay.className = 'levelup-overlay';
  overlay.innerHTML = '';
  const box = document.createElement('div'); box.className = 'levelup-box';
  const title = document.createElement('div'); title.className = 'levelup-title'; title.textContent = 'Choose a card to add to your deck';
  const grid = document.createElement('div'); grid.className = 'levelup-choices';
  const choices = state.ui.rewards.choices || [];
  choices.forEach((defId, idx) => {
    const wrap = document.createElement('div'); wrap.className = 'levelup-choice'; wrap.setAttribute('data-reward-index', String(idx));
    const card = createCardInstanceFromDefId(defId);
    // Minimal preview card
    const preview = document.createElement('div'); preview.className = 'h-card';
    const cost = document.createElement('div'); cost.className = 'h-cost-badge'; cost.textContent = String(card.baseCost||0);
    const head = document.createElement('div'); head.className = 'h-header';
    const ttl = document.createElement('div'); ttl.className = 'h-title'; ttl.textContent = card.name;
    const av = document.createElement('div'); av.className = 'h-avatar ' + (card.tags?.includes('damage') ? 'h--sword' : (card.tags?.includes('block') ? 'h--shield' : (card.tags?.includes('move-buff') ? 'h--star' : 'h--creature')));
    head.append(ttl, av);
    const txt = document.createElement('div'); txt.className = 'h-text small'; txt.textContent = card.text ? card.text(state, card) : '';
    preview.append(cost, head, txt);
    wrap.appendChild(preview);
    grid.appendChild(wrap);
  });
  // Skip button
  const skip = document.createElement('div'); skip.className = 'levelup-choice'; skip.setAttribute('data-reward-skip','true'); skip.textContent = 'Skip (+5 gold)';
  const container = document.createElement('div'); container.className = 'levelup-choices'; container.append(skip);
  box.append(title, grid, container);
  overlay.appendChild(box);
}

function formatIntent(enemy, state) {
  const it = enemy.intent;
  if (!it) return '-';
  if (typeof it === 'string') return it; // backward compatibility
  if (it.type === 'attack') return `Attack ${it.amount}`;
  if (it.type === 'gainStrength') return `STR +${it.amount}`;
  return '-';
}

function renderHand(state) {
  const { hand } = state.combat;
  const cards = hand.map((card, i) => {
    const iconClass = card.type === 'creature' ? 'h--creature' : (card.tags?.includes('damage') ? 'h--sword' : (card.tags?.includes('block') ? 'h--shield' : (card.type === 'single-use' ? 'h--star' : '')));
    return `
    <div class="h-card" data-hand-index="${i}">
      <div class="h-cost-badge">${computeCardCost(state, card)}</div>
      <div class="h-header">
        <div class="h-title">${card.name}</div>
        <div class="h-avatar ${iconClass}"></div>
      </div>
      <div class="h-text small">${card.text(state, card)}</div>
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
