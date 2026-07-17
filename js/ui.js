// ui.js — Interaction handlers, overlay management, chain reaction loop

'use strict';

import { WAVE_DELAY, PLACE_DELAY } from './constants.js';
import {
  board, players, numPlayers,
  currentPlayerIndex, hasMoved, gameOver, busy,
  getCell, setBusy, clearOrbCountCache,
  initGameState, resetBoardState,
  markDirty,
} from './state.js';
import {
  collectOverflowing, explodeCell,
  checkWinCondition, advanceTurn, canPlace,
} from './rules.js';
import {
  cacheDom, buildBoardDOM,
  renderAll, renderTurnChange,
  renderDirty,
  triggerShockwave,
  triggerJump,
} from './render.js';

// ---- DOM refs (populated by initUI) ----
let gameOverOverlay, winnerText, rulesOverlay;
let newGameBtn, rematchBtn, howToPlayBtn, closeRulesBtn, closeRulesBtn2;
let playerBtns = [];

/**
 * Sleep / delay helper.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Show the game-over overlay with the winner's name.
 */
function showGameOver(winner) {
  winnerText.textContent = `${winner.name} wins!`;
  winnerText.style.color = winner.color;
  gameOverOverlay.classList.remove('hidden');
}

/**
 * Hide the game-over overlay.
 */
function hideGameOver() {
  gameOverOverlay.classList.add('hidden');
}

// ------- Explosion chain (async) -------

/**
 * Resolve all explosions wave by wave.
 * Each wave: collect overflowing cells, explode them simultaneously,
 * render, wait, check win, repeat.
 */
async function resolveExplosions() {
  let overflowing = collectOverflowing();
  while (overflowing.length > 0) {
    overflowing.forEach(([r, c]) => {
      const color = players[board[r][c].owner].color;
      const affected = explodeCell(r, c);
      affected.forEach(([ar, ac]) => markDirty(ar, ac));
      triggerShockwave(r, c, color);
      triggerJump(r, c);
    });
    renderDirty();
    await sleep(WAVE_DELAY);

    const winnerId = checkWinCondition();
    if (winnerId !== null) {
      gameOverOverlay && showGameOver(players[winnerId]);
      return;
    }

    overflowing = collectOverflowing();
  }
}

// ------- Cell click handler -------

/**
 * Handle a cell click or keyboard activation.
 */
export async function handleCellClick(r, c) {
  if (gameOver || busy) return;
  const cell = getCell(r, c);
  if (!canPlace(r, c, currentPlayerIndex)) return;

  setBusy(true);
  cell.count += 1;
  cell.owner = currentPlayerIndex;
  hasMoved[currentPlayerIndex] = true;
  clearOrbCountCache();
  markDirty(r, c);
  renderDirty();

  await sleep(PLACE_DELAY);
  await resolveExplosions();

  if (!gameOver) {
    advanceTurn();
    renderTurnChange();
  }
  setBusy(false);
}

// ------- Game init / reset -------

/**
 * Start a new game with `n` players.
 * Rebuilds DOM if player count changed, otherwise resets in place.
 */
export function initGame(n) {
  const rebuild = (numPlayers !== n);

  if (rebuild) {
    initGameState(n);
    buildBoardDOM();
  } else {
    resetBoardState();
  }

  hideGameOver();
  renderAll();

  // Sync player-count buttons
  playerBtns.forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.players) === n);
  });
}

// ------- UI setup -------

/**
 * Wire all DOM event listeners and cache references.
 */
export function initUI() {
  // Cache DOM refs
  cacheDom();

  gameOverOverlay = document.getElementById('gameOverOverlay');
  winnerText = document.getElementById('winnerText');
  rulesOverlay = document.getElementById('rulesOverlay');
  newGameBtn = document.getElementById('newGameBtn');
  rematchBtn = document.getElementById('rematchBtn');
  howToPlayBtn = document.getElementById('howToPlayBtn');
  closeRulesBtn = document.getElementById('closeRulesBtn');
  closeRulesBtn2 = document.getElementById('closeRulesBtn2');
  playerBtns = Array.from(document.querySelectorAll('.player-btn'));

  // Board click + keyboard
  const boardEl = document.getElementById('board');
  boardEl.addEventListener('click', (e) => {
    const cellEl = e.target.closest('.cell');
    if (!cellEl) return;
    handleCellClick(Number(cellEl.dataset.row), Number(cellEl.dataset.col));
  });

  boardEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const cellEl = e.target.closest('.cell');
    if (!cellEl) return;
    e.preventDefault();
    handleCellClick(Number(cellEl.dataset.row), Number(cellEl.dataset.col));
  });

  // Player count buttons
  playerBtns.forEach(btn => {
    btn.addEventListener('click', () => initGame(Number(btn.dataset.players)));
  });

  // New game / rematch
  newGameBtn.addEventListener('click', () => initGame(numPlayers));
  rematchBtn.addEventListener('click', () => initGame(numPlayers));

  // How to play overlay
  howToPlayBtn.addEventListener('click', () => {
    rulesOverlay.classList.remove('hidden');
  });
  closeRulesBtn.addEventListener('click', () => {
    rulesOverlay.classList.add('hidden');
  });
  closeRulesBtn2.addEventListener('click', () => {
    rulesOverlay.classList.add('hidden');
  });

  // Escape key closes overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!rulesOverlay.classList.contains('hidden')) {
        rulesOverlay.classList.add('hidden');
      }
      if (!gameOverOverlay.classList.contains('hidden')) {
        gameOverOverlay.classList.add('hidden');
      }
    }
  });
}
