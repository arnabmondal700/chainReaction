// render.js — DOM rendering (board, cells, orbs, panels, overlays)

'use strict';

import { ROWS, COLS, CLASSES } from './constants.js';
import {
  board, players, numPlayers,
  currentPlayerIndex, gameOver,
  getCell, computeOrbCount,
  dirtyCells, clearDirty,
} from './state.js';
import { getCapacity, isEliminated } from './rules.js';

// ---- DOM element cache ----
let boardEl = null;
let cellEls = [];
let playersListEl = null;
let turnIndicatorEl = null;
let thinkingEl = null;

/**
 * Cache DOM element references.
 */
export function cacheDom() {
  boardEl = document.getElementById('board');
  playersListEl = document.getElementById('playersList');
  turnIndicatorEl = document.getElementById('turnIndicator');
  thinkingEl = document.getElementById('thinkingIndicator');
}

/**
 * Build the board grid DOM elements.
 */
export function buildBoardDOM() {
  boardEl.innerHTML = '';
  boardEl.style.setProperty('--cols', COLS);
  boardEl.style.setProperty('--rows', ROWS);
  cellEls = [];

  for (let r = 0; r < ROWS; r++) {
    const rowArr = [];
    for (let c = 0; c < COLS; c++) {
      const cellEl = document.createElement('div');
      cellEl.className = CLASSES.cell;
      cellEl.dataset.row = String(r);
      cellEl.dataset.col = String(c);
      cellEl.tabIndex = 0;
      cellEl.setAttribute('role', 'button');

      const orbsEl = document.createElement('div');
      orbsEl.className = `${CLASSES.orbs} count-0`;
      cellEl.appendChild(orbsEl);

      boardEl.appendChild(cellEl);
      rowArr.push(cellEl);
    }
    cellEls.push(rowArr);
  }
}

/**
 * Trigger a shockwave animation on a cell.
 */
export function triggerShockwave(r, c, color) {
  const el = cellEls[r][c];
  if (!el) return;
  el.style.setProperty('--explosion-color', color);
  el.classList.remove(CLASSES.exploding);
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add(CLASSES.exploding);
  el.addEventListener('animationend', () => {
    el.classList.remove(CLASSES.exploding);
  }, { once: true });
}

/**
 * Trigger a jump (bounce) animation on a cell's orbs.
 */
export function triggerJump(r, c) {
  const el = cellEls[r][c];
  if (!el) return;
  el.classList.remove(CLASSES.jumping);
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add(CLASSES.jumping);
  el.addEventListener('animationend', () => {
    el.classList.remove(CLASSES.jumping);
  }, { once: true });
}

/**
 * Render a single cell's visual state.
 */
export function renderCell(r, c) {
  const state = getCell(r, c);
  const cellEl = cellEls[r][c];
  if (!cellEl) return;
  const orbsEl = cellEl.firstElementChild;

  const isDisabled = gameOver ||
    (state.owner !== null && state.owner !== currentPlayerIndex);
  const key = `${state.count}|${state.owner}|${isDisabled}`;
  if (cellEl.dataset.renderedKey === key) return; // no change

  cellEl.dataset.renderedKey = key;
  orbsEl.className = `${CLASSES.orbs} count-${state.count}`;
  orbsEl.innerHTML = '';
  const color = state.owner !== null ? players[state.owner].color : null;

  for (let i = 0; i < state.count; i++) {
    const orb = document.createElement('div');
    orb.className = CLASSES.orb;
    if (color) orb.style.color = color;
    orbsEl.appendChild(orb);
  }

  cellEl.style.boxShadow = color
    ? `inset 0 0 0 1px ${color}66`
    : '';

  const capacity = getCapacity(r, c);
  const isPrimed = state.owner !== null &&
    state.count === capacity - 1 && !gameOver;

  cellEl.classList.toggle(CLASSES.primed, isPrimed);
  cellEl.classList.toggle(CLASSES.disabled, isDisabled);

  const ownerName = state.owner !== null
    ? players[state.owner].name
    : 'empty';
  cellEl.setAttribute('aria-label',
    `Cell row ${r + 1} column ${c + 1}, ${state.count} orbs, owned by ${ownerName}`);
}

/**
 * Render the player list panel.
 */
export function renderPlayers() {
  playersListEl.innerHTML = '';
  players.forEach(p => {
    const eliminated = isEliminated(p.id);
    const chip = document.createElement('div');
    chip.className = CLASSES.playerChip +
      (p.id === currentPlayerIndex && !gameOver && !eliminated
        ? ` ${CLASSES.active}` : '') +
      (eliminated ? ` ${CLASSES.eliminated}` : '');
    chip.style.setProperty('--chip-color', p.color);

    const dot = document.createElement('span');
    dot.className = 'chip-dot';
    const name = document.createElement('span');
    name.className = 'chip-name';
    name.textContent = p.name;
    const count = document.createElement('span');
    count.className = 'chip-count';
    count.textContent = String(computeOrbCount(p.id));

    chip.appendChild(dot);
    chip.appendChild(name);
    chip.appendChild(count);
    playersListEl.appendChild(chip);
  });
}

/**
 * Render the turn indicator at the top of the side rail.
 */
export function renderTurnIndicator() {
  if (gameOver) {
    turnIndicatorEl.innerHTML = 'Game over';
    return;
  }
  const p = players[currentPlayerIndex];
  turnIndicatorEl.innerHTML =
    `<span class="turn-dot" style="background:${p.color}; box-shadow:0 0 10px ${p.color}"></span>` +
    `${p.name}'s turn`;
}

export function setThinking(show) {
  if (!thinkingEl) return;
  thinkingEl.classList.toggle('hidden', !show);
}

/**
 * Render only cells that have been marked as dirty, then render
 * the side panel (players + turn indicator). This avoids
 * re-rendering all 54 cells when only a handful changed.
 */
export function renderDirty() {
  for (const key of dirtyCells) {
    const [r, c] = key.split(',').map(Number);
    renderCell(r, c);
  }
  clearDirty();
  renderPlayers();
  renderTurnIndicator();
}

/**
 * Update only the disabled class on all cells after a turn change.
 * Does NOT touch orb DOM — avoids replaying the orbPop animation
 * on every occupied cell.
 */
export function renderTurnChange() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cellEl = cellEls[r][c];
      if (!cellEl) continue;
      const state = getCell(r, c);
      const isDisabled = gameOver ||
        (state.owner !== null && state.owner !== currentPlayerIndex);
      cellEl.classList.toggle(CLASSES.disabled, isDisabled);
    }
  }
  renderPlayers();
  renderTurnIndicator();
}

export function renderAll() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      renderCell(r, c);
    }
  }
  renderPlayers();
  renderTurnIndicator();
}
