// state.js — Game state management

'use strict';

import { ROWS, COLS, PLAYER_DEFS } from './constants.js';

// ---- Mutable game state ----
export let board = [];
export let players = [];
export let numPlayers = 2;
export let currentPlayerIndex = 0;
export let hasMoved = [];
export let gameOver = false;
export let busy = false;

// ---- Stats tracking ----
export let totalMoves = 0;
export let biggestChain = 0;
let gameStartTime = 0;

const STATS_KEY = 'chainReaction:stats:best';

export function getStoredBestStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : { biggestChain: 0, totalMoves: 0, bestTimeMs: 0 };
  } catch {
    return { biggestChain: 0, totalMoves: 0, bestTimeMs: 0 };
  }
}

function saveBestStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* ignore */ }
}

export function recordMove() {
  totalMoves++;
}

export function recordChainWave(waveSize) {
  if (waveSize > biggestChain) biggestChain = waveSize;
}

export function startGameTimer() {
  gameStartTime = performance.now();
}

export function getGameDurationMs() {
  return Math.round(performance.now() - gameStartTime);
}

export function persistBestAndReturnNew(latestBiggestChain, latestTotalMoves, latestDurationMs) {
  const best = getStoredBestStats();
  const updated = {
    biggestChain: Math.max(best.biggestChain, latestBiggestChain),
    totalMoves: best.totalMoves === 0 ? latestTotalMoves : Math.min(best.totalMoves, latestTotalMoves),
    bestTimeMs: best.bestTimeMs === 0 ? latestDurationMs : Math.min(best.bestTimeMs, latestDurationMs),
  };
  saveBestStats(updated);
  return {
    newBestChain: latestBiggestChain > best.biggestChain,
    newBestMoves: best.totalMoves === 0 || latestTotalMoves < best.totalMoves,
    newBestTime: best.bestTimeMs === 0 || latestDurationMs < best.bestTimeMs,
    best,
    latest: { biggestChain: latestBiggestChain, totalMoves: latestTotalMoves, durationMs: latestDurationMs },
  };
}

// CPU vs Player
export let playerTypes = [];
export let cpuDifficulty = 'medium';

/** Cached per-player orb counts, recomputed each render. */
let orbCountCache = {};

/**
 * Set of "dirty" cell coordinates (as "r,c" strings) that need re-rendering.
 * Prevents re-rendering all 54 cells when only a handful changed.
 */
export let dirtyCells = new Set();

/**
 * Mark a cell as needing re-rendering.
 */
export function markDirty(r, c) {
  dirtyCells.add(`${r},${c}`);
}

/**
 * Clear all dirty marks (called after rendering dirty cells).
 */
export function clearDirty() {
  dirtyCells.clear();
}

/**
 * Create a fresh empty cell state.
 */
function createCell() {
  return { count: 0, owner: null };
}

/**
 * Reset the board to all-empty.
 */
function createEmptyBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => createCell())
  );
}

/**
 * Initialize (or re-initialise) the entire game state.
 * @param {number} n — number of players (2–4)
 */
export function initGameState(n) {
  numPlayers = n;
  board = createEmptyBoard();
  players = PLAYER_DEFS.slice(0, n).map((p, i) => ({ ...p, id: i }));
  hasMoved = new Array(n).fill(false);
  currentPlayerIndex = 0;
  gameOver = false;
  busy = false;
  orbCountCache = {};
  dirtyCells = new Set();
  totalMoves = 0;
  biggestChain = 0;
}

/**
 * Reset only play state (board, turn, flags) without rebuilding player defs.
 * Called on rematch when player count hasn't changed.
 */
export function resetBoardState() {
  board = createEmptyBoard();
  hasMoved = new Array(numPlayers).fill(false);
  currentPlayerIndex = 0;
  gameOver = false;
  busy = false;
  orbCountCache = {};
  dirtyCells = new Set();
  totalMoves = 0;
  biggestChain = 0;
}

/**
 * Get a cell at (row, col).
 */
export function getCell(r, c) {
  return board[r][c];
}

/**
 * Compute the total orb count for a given player ID.
 * Result is cached; call clearOrbCountCache() after board mutations.
 */
export function computeOrbCount(playerId) {
  if (orbCountCache[playerId] !== undefined) {
    return orbCountCache[playerId];
  }
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].owner === playerId) {
        n += board[r][c].count;
      }
    }
  }
  orbCountCache[playerId] = n;
  return n;
}

/** Invalidate the orb count cache (call after any board mutation). */
export function clearOrbCountCache() {
  orbCountCache = {};
}

/**
 * Set the busy flag (disables input during animations).
 */
export function setBusy(b) {
  busy = b;
}

/** Set the game-over flag. */
export function setGameOver(val) {
  gameOver = val;
}

/** Set the current player index (advance turn). */
export function setCurrentPlayerIndex(index) {
  currentPlayerIndex = index;
}

export function setPlayerTypes(types) {
  playerTypes = types;
}

export function setCpuDifficulty(level) {
  cpuDifficulty = level;
}

export function isCpuTurn() {
  return playerTypes[currentPlayerIndex] === 'cpu';
}

