// ui.js — Interaction handlers, overlay management, chain reaction loop

'use strict';

import { WAVE_DELAY, PLACE_DELAY } from './constants.js';
import {
  board, players, numPlayers,
  currentPlayerIndex, hasMoved, gameOver, busy,
  getCell, setBusy, clearOrbCountCache,
  initGameState, resetBoardState,
  setPlayerTypes, playerTypes, cpuDifficulty,
  isCpuTurn,
  markDirty,
  recordMove, recordChainWave,
  startGameTimer, getGameDurationMs,
  persistBestAndReturnNew,
  totalMoves, biggestChain,
} from './state.js';
import {
  collectOverflowing, explodeCell,
  checkWinCondition, setGameOverFromRules,
  advanceTurn, canPlace,
} from './rules.js';
import {
  cacheDom, buildBoardDOM,
  renderAll, renderTurnChange,
  renderDirty,
  triggerShockwave,
  triggerJump,
  setThinking,
} from './render.js';
import { executeCpuMove } from './cpu.js';
import * as Sound from './sound.js';

// ---- DOM refs (populated by initUI) ----
let gameOverOverlay, winnerText, rulesOverlay;
let newGameBtn, rematchBtn, howToPlayBtn, closeRulesBtn, closeRulesBtn2;
let muteBtn;
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

  const durationMs = getGameDurationMs();
  const stats = persistBestAndReturnNew(biggestChain, totalMoves, durationMs);

  let statsHtml = `${totalMoves} moves, biggest chain: ${biggestChain}`;
  if (stats.newBestChain) statsHtml += ' <span style="color:#ffd23f">★ New best chain!</span>';
  if (stats.newBestMoves) statsHtml += ' <span style="color:#2fe0ff">★ Fewest moves!</span>';

  const statsEl = document.getElementById('statsText');
  if (statsEl) {
    statsEl.innerHTML = statsHtml;
  }

  gameOverOverlay.classList.remove('hidden');
  Sound.play('win');
}

/**
 * Hide the game-over overlay.
 */
function hideGameOver() {
  gameOverOverlay.classList.add('hidden');
}

// ------- CPU turn -------

let cpuTimer = null;
function scheduleCpuMove() {
  clearTimeout(cpuTimer);
  setThinking(true);
  const delay = 500 + Math.random() * 400;
  cpuTimer = setTimeout(() => executeCpuMove(), delay);
  // Safety: clear thinking if CPU bubbles for any reason
  cpuTimer = setTimeout(() => setThinking(false), delay + 5000);
}

// Listen for CPU move events dispatched by cpu.js
window.addEventListener('cpu-move', (e) => {
  const { r, c } = e.detail;
  setThinking(false);
  if (gameOver) return;
  try {
    handleCellClick(r, c, true);
  } catch (err) {
    console.error('CPU move failed:', err);
    setThinking(false);
    setBusy(false);
  }
});

// ------- Explosion chain (async) -------

/**
 * Resolve all explosions wave by wave.
 * Each wave: collect overflowing cells, explode them simultaneously,
 * render, wait, check win, repeat.
 */
async function resolveExplosions() {
  let overflowing = collectOverflowing();
  let cascadeTotal = 0;
  while (overflowing.length > 0) {
    cascadeTotal += overflowing.length;
    overflowing.forEach(([r, c]) => {
      const color = players[board[r][c].owner].color;
      const affected = explodeCell(r, c);
      affected.forEach(([ar, ac]) => markDirty(ar, ac));
      triggerShockwave(r, c, color);
      triggerJump(r, c);
    });
    Sound.playExplosionBurst(overflowing.length, cascadeTotal);
    recordChainWave(overflowing.length);
    renderDirty();
    await sleep(WAVE_DELAY);

    const winnerId = checkWinCondition();
    if (winnerId !== null) {
      setGameOverFromRules();
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
export async function handleCellClick(r, c, skipCpuCheck = false) {
  if (gameOver || busy) return;
  if (!skipCpuCheck && isCpuTurn()) return;
  const cell = getCell(r, c);
  if (!canPlace(r, c, currentPlayerIndex)) {
    Sound.play('invalid');
    return;
  }

  setBusy(true);
  cell.count += 1;
  cell.owner = currentPlayerIndex;
  hasMoved[currentPlayerIndex] = true;
  clearOrbCountCache();
  markDirty(r, c);
  recordMove();
  Sound.play('place');
  renderDirty();

  await sleep(PLACE_DELAY);
  await resolveExplosions();

  if (!gameOver) {
    advanceTurn();
    renderTurnChange();
    if (isCpuTurn()) {
      scheduleCpuMove();
    }
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

  // Cancel any pending CPU move
  clearTimeout(cpuTimer);
  setThinking(false);

  hideGameOver();
  renderAll();
  startGameTimer();

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
  muteBtn = document.getElementById('muteBtn');
  playerBtns = Array.from(document.querySelectorAll('.player-btn'));

  function syncMuteBtn() {
    const muted = Sound.isMuted();
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(muted));
  }
  syncMuteBtn();

  // Board click + keyboard
  const boardEl = document.getElementById('board');
  boardEl.addEventListener('click', (e) => {
    Sound.unlock();
    const cellEl = e.target.closest('.cell');
    if (!cellEl) return;
    handleCellClick(Number(cellEl.dataset.row), Number(cellEl.dataset.col));
  });

  boardEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    Sound.unlock();
    const cellEl = e.target.closest('.cell');
    if (!cellEl) return;
    e.preventDefault();
    handleCellClick(Number(cellEl.dataset.row), Number(cellEl.dataset.col));
  });

  // Player count buttons
  playerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.unlock();
      Sound.play('click');
      initGame(Number(btn.dataset.players));
    });
  });

  // New game / rematch
  newGameBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.play('click');
    initGame(numPlayers);
  });
  rematchBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.play('click');
    initGame(numPlayers);
  });

  // How to play overlay
  howToPlayBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.play('click');
    rulesOverlay.classList.remove('hidden');
  });
  closeRulesBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.play('click');
    rulesOverlay.classList.add('hidden');
  });
  closeRulesBtn2.addEventListener('click', () => {
    Sound.unlock();
    Sound.play('click');
    rulesOverlay.classList.add('hidden');
  });

  // Mute toggle
  muteBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.toggleMute();
    syncMuteBtn();
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